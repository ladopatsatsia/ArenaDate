using System.Net;
using System.Net.Http.Json;
using Dating.Api.Features.Auth;
using Dating.Api.Features.Chat;
using Dating.Api.Features.Notifications;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Xunit;
namespace Dating.IntegrationTests;
public class PushTests {
 private static DeviceRequest Device(string platform="ios")=>new(Guid.NewGuid(),Guid.NewGuid().ToString("N")+Guid.NewGuid().ToString("N"),1,"expo",AuthHarness.PushProject,platform,true,"ExpoPushToken["+Guid.NewGuid().ToString("N")+"]");
 private static Task<HttpResponseMessage> Register(AuthHarness h,TokenResponse user,DeviceRequest request)=>ProfileTests.Send(h,user,HttpMethod.Post,"/api/notifications/device",request);
 private static async Task Preferences(AuthHarness h,TokenResponse user,bool match=false,bool message=true){
  Assert.Equal(HttpStatusCode.NoContent,(await ProfileTests.Send(h,user,HttpMethod.Post,"/api/notifications/preferences",new PushPreferences(match,message))).StatusCode);
 }
 private static async Task Step(AuthHarness h){using var scope=h.Factory.Services.CreateScope();Assert.True(await scope.ServiceProvider.GetRequiredService<PushOutbox>().Process(default));}
 private static Task Due(AuthHarness h)=>h.Db(db=>db.Set<PushDelivery>().Where(d=>d.FinishedAt==null&&d.DeadLetterAt==null).ExecuteUpdateAsync(s=>s.SetProperty(d=>d.NextAttemptAt,DateTimeOffset.UnixEpoch)));
 private static async Task Message(AuthHarness h,TokenResponse sender,Guid conversation,Guid? request=null){
  Assert.Equal(HttpStatusCode.OK,(await ProfileTests.Send(h,sender,HttpMethod.Post,$"/api/conversations/{conversation}/messages",new SendMessage(request??Guid.NewGuid(),"private message must not be in push"))).StatusCode);
 }
 [Fact]public async Task Registration_is_authenticated_validated_encrypted_and_supports_devices_and_rotation(){
  await using var h=await AuthHarness.Create(true);var a=await MatchingTests.Person(h,"a");var first=Device();var second=Device("android");
  Assert.Equal(HttpStatusCode.Unauthorized,(await h.Client.PostAsJsonAsync("/api/notifications/device",first)).StatusCode);
  Assert.Equal(HttpStatusCode.BadRequest,(await Register(h,a,first with{ProjectId=Guid.NewGuid().ToString()})).StatusCode);
  Assert.Equal(HttpStatusCode.BadRequest,(await Register(h,a,first with{Platform="web"})).StatusCode);
  Assert.Equal(HttpStatusCode.BadRequest,(await Register(h,a,first with{Provider="fcm"})).StatusCode);
  Assert.Equal(HttpStatusCode.NoContent,(await Register(h,a,first)).StatusCode);
  Assert.Equal(HttpStatusCode.NoContent,(await Register(h,a,second)).StatusCode);
  Assert.Equal(HttpStatusCode.NoContent,(await Register(h,a,first)).StatusCode);
  var rotated=first with{Revision=2,Token="ExponentPushToken["+Guid.NewGuid().ToString("N")+"]"};
  Assert.Equal(HttpStatusCode.NoContent,(await Register(h,a,rotated)).StatusCode);
  Assert.Equal(HttpStatusCode.Conflict,(await Register(h,a,first)).StatusCode);
  Assert.Equal(HttpStatusCode.Conflict,(await Register(h,a,Device() with{Token=rotated.Token})).StatusCode);
  using var scope=h.Factory.Services.CreateScope();var crypto=scope.ServiceProvider.GetRequiredService<PushCrypto>();
  await h.Db(async db=>{
   var rows=await db.Set<PushDevice>().ToArrayAsync();Assert.Equal(2,rows.Length);var stored=rows.Single(d=>d.Id==first.InstallationId);
   Assert.DoesNotContain(rotated.Token!,stored.Ciphertext);Assert.DoesNotContain(first.Secret,stored.SecretHash);
   Assert.Equal(PushCrypto.Hash(rotated.Token!),stored.TokenHash);Assert.Equal(rotated.Token,crypto.Open(stored));
   Assert.Equal(2,stored.BindingRevision);
  });
  var response=await ProfileTests.Send(h,a,HttpMethod.Get,"/api/notifications/configuration");var text=await response.Content.ReadAsStringAsync();
  Assert.DoesNotContain(first.Token!,text);Assert.DoesNotContain(first.Secret,text);Assert.DoesNotContain("key",text,StringComparison.OrdinalIgnoreCase);
 }
 [Fact]public async Task Match_and_message_events_commit_one_delivery_per_device_and_same_token_refresh_preserves_pending(){
  await using var h=await AuthHarness.Create(true);var a=await MatchingTests.Person(h,"a");var b=await MatchingTests.Person(h,"b");var device=Device();
  await Preferences(h,a,true,true);Assert.Equal(HttpStatusCode.NoContent,(await Register(h,a,device)).StatusCode);
  Assert.Equal(HttpStatusCode.NoContent,(await Register(h,a,Device("android"))).StatusCode);
  var conversation=await ChatTests.Pair(h,a,b);var request=Guid.NewGuid();await Message(h,b,conversation,request);await Message(h,b,conversation,request);
  Assert.Equal(HttpStatusCode.NoContent,(await Register(h,a,device with{Revision=2})).StatusCode);
  await h.Db(async db=>{var rows=await db.Set<PushDelivery>().ToArrayAsync();Assert.Equal(4,rows.Length);Assert.Contains(rows,d=>d.Kind=="match");Assert.Contains(rows,d=>d.Kind=="message");Assert.All(rows,d=>Assert.Equal(1,d.DeviceRevision));});
  for(var i=0;i<4;i++)await Step(h);Assert.Equal(4,h.Push.Sent.Count);Assert.Equal(2,h.Push.Sent.Select(x=>x.Token).Distinct().Count());
  await Due(h);for(var i=0;i<4;i++)await Step(h);
  await h.Db(async db=>Assert.All(await db.Set<PushDelivery>().ToArrayAsync(),d=>{Assert.NotNull(d.FinishedAt);Assert.Equal("accepted",d.LastCode);}));
 }
 [Fact]public async Task Invalid_token_receipt_deactivates_registration_and_clears_ciphertext(){
  await using var h=await AuthHarness.Create(true);var a=await MatchingTests.Person(h,"a");var b=await MatchingTests.Person(h,"b");
  await Preferences(h,a);Assert.Equal(HttpStatusCode.NoContent,(await Register(h,a,Device())).StatusCode);var c=await ChatTests.Pair(h,a,b);await Message(h,b,c);
  await Step(h);await h.Db(async db=>{var d=await db.Set<PushDelivery>().SingleAsync();Assert.NotNull(d.ReceiptId);Assert.Null(d.FinishedAt);});
  h.Push.Receipts.Enqueue(new("invalid","invalid_token"));await Due(h);await Step(h);
  await h.Db(async db=>{var device=await db.Set<PushDevice>().SingleAsync();Assert.False(device.Active);Assert.Equal("",device.Ciphertext);Assert.NotNull((await db.Set<PushDelivery>().SingleAsync()).FinishedAt);});
  await Message(h,b,c);await h.Db(async db=>Assert.Equal(1,await db.Set<PushDelivery>().CountAsync()));
 }
 [Fact]public async Task Transient_failures_persist_backoff_across_scopes_and_end_in_visible_dead_letter(){
  await using var h=await AuthHarness.Create(true);var a=await MatchingTests.Person(h,"a");var b=await MatchingTests.Person(h,"b");await Preferences(h,a);
  await Register(h,a,Device());var c=await ChatTests.Pair(h,a,b);await Message(h,b,c);h.Push.Fail=true;
  await Step(h);await h.Db(async db=>{var d=await db.Set<PushDelivery>().SingleAsync();Assert.Equal(1,d.Attempts);Assert.True(d.NextAttemptAt>d.CreatedAt);Assert.Equal("delivery_unavailable",d.LastCode);});
  for(var i=1;i<8;i++){await Due(h);await Step(h);}
  await h.Db(async db=>{var d=await db.Set<PushDelivery>().SingleAsync();Assert.Equal(8,d.Attempts);Assert.NotNull(d.DeadLetterAt);
   Assert.Equal(1,await db.Database.SqlQueryRaw<int>("SELECT count(*)::int AS \"Value\" FROM \"PushDeadLetters\"").SingleAsync());});
 }
 [Fact]public async Task Crash_after_provider_acceptance_retries_same_notification_identity(){
  await using var h=await AuthHarness.Create(true);var a=await MatchingTests.Person(h,"a");var b=await MatchingTests.Person(h,"b");await Preferences(h,a);
  await Register(h,a,Device());var c=await ChatTests.Pair(h,a,b);await Message(h,b,c);
  await h.Db(db=>db.Database.ExecuteSqlRawAsync("""
   CREATE FUNCTION fail_push() RETURNS trigger LANGUAGE plpgsql AS $$
   BEGIN RAISE EXCEPTION 'test'; END $$;
   CREATE TRIGGER fail_push BEFORE UPDATE ON "PushDelivery" FOR EACH ROW EXECUTE FUNCTION fail_push();
   """));
  await Assert.ThrowsAnyAsync<Exception>(()=>Step(h));Assert.Single(h.Push.Sent);
  await h.Db(async db=>{Assert.Null((await db.Set<PushDelivery>().SingleAsync()).ReceiptId);await db.Database.ExecuteSqlRawAsync("""DROP TRIGGER fail_push ON "PushDelivery"; DROP FUNCTION fail_push();""");});
  await Step(h);Assert.Equal(2,h.Push.Sent.Count);Assert.Equal(h.Push.Sent[0].Notification,h.Push.Sent[1].Notification);
 }
 [Theory][InlineData("block")][InlineData("unmatch")][InlineData("inactive")][InlineData("logout")][InlineData("preferences")]
 public async Task Delivery_rechecks_authorization_and_preferences(string change){
  await using var h=await AuthHarness.Create(true);var a=await MatchingTests.Person(h,"a");var b=await MatchingTests.Person(h,"b");await Preferences(h,a);
  await Register(h,a,Device());var c=await ChatTests.Pair(h,a,b);await Message(h,b,c);
  if(change is "block" or "unmatch")Assert.Equal(HttpStatusCode.NoContent,(await ProfileTests.Send(h,b,HttpMethod.Post,"/api/safety",new Dating.Api.Features.Safety.SafetyRequest(Guid.NewGuid(),change,ConversationId:c))).StatusCode);
  if(change=="inactive")await h.Db(db=>db.Users.Where(u=>u.Id==a.Account.Id).ExecuteUpdateAsync(s=>s.SetProperty(u=>u.IsActive,false)));
  if(change=="logout")Assert.Equal(HttpStatusCode.NoContent,(await ProfileTests.Send(h,a,HttpMethod.Post,"/api/auth/logout",new{refreshToken=a.RefreshToken})).StatusCode);
  if(change=="preferences")await Preferences(h,a,false,false);
  await Step(h);Assert.Empty(h.Push.Sent);
  await h.Db(async db=>{Assert.Equal("cancelled",(await db.Set<PushDelivery>().SingleAsync()).LastCode);if(change=="logout"){Assert.False((await db.Set<PushDevice>().SingleAsync()).Active);Assert.Equal("",(await db.Set<PushDevice>().SingleAsync()).Ciphertext);}});
 }
 [Fact]public async Task Account_transfer_requires_installation_proof_cancels_old_delivery_and_rejects_delayed_owner(){
  await using var h=await AuthHarness.Create(true);var a=await MatchingTests.Person(h,"a");var b=await MatchingTests.Person(h,"b");var peer=await MatchingTests.Person(h,"peer");await Preferences(h,a);
  var device=Device();await Register(h,a,device);var c=await ChatTests.Pair(h,a,peer);await Message(h,peer,c);
  Assert.Equal(HttpStatusCode.Conflict,(await Register(h,b,device with{Revision=2,Secret=Device().Secret})).StatusCode);
  Assert.Equal(HttpStatusCode.NoContent,(await Register(h,b,device with{Revision=2})).StatusCode);
  Assert.Equal(HttpStatusCode.Conflict,(await Register(h,a,device)).StatusCode);
  await ProfileTests.Send(h,a,HttpMethod.Post,"/api/auth/logout",new{refreshToken=a.RefreshToken});
  await Step(h);Assert.Empty(h.Push.Sent);
  await h.Db(async db=>{var d=await db.Set<PushDevice>().SingleAsync();Assert.Equal(b.Account.Id,d.UserId);Assert.True(d.Active);});
 }
 [Fact]public async Task Payload_ID_is_not_authority_and_closed_targets_never_resolve(){
  await using var h=await AuthHarness.Create(true);var a=await MatchingTests.Person(h,"a");var b=await MatchingTests.Person(h,"b");await Preferences(h,a);
  await Register(h,a,Device());var c=await ChatTests.Pair(h,a,b);await Message(h,b,c);Guid notification=default;
  await h.Db(async db=>notification=(await db.Set<PushDelivery>().SingleAsync()).Id);
  Assert.Equal(HttpStatusCode.NotFound,(await ProfileTests.Send(h,b,HttpMethod.Post,"/api/notifications/resolve",new ResolveNotification(notification))).StatusCode);
  var response=await ProfileTests.Send(h,a,HttpMethod.Post,"/api/notifications/resolve",new ResolveNotification(notification));Assert.Equal(c,(await response.Content.ReadFromJsonAsync<NotificationTarget>())!.ConversationId);
  await ProfileTests.Send(h,a,HttpMethod.Post,"/api/safety",new Dating.Api.Features.Safety.SafetyRequest(Guid.NewGuid(),"unmatch",ConversationId:c));
  Assert.Equal(HttpStatusCode.NotFound,(await ProfileTests.Send(h,a,HttpMethod.Post,"/api/notifications/resolve",new ResolveNotification(notification))).StatusCode);
 }
 [Fact]public async Task Disabled_provider_cannot_report_registration_success(){
  await using var h=await AuthHarness.Create();var a=await MatchingTests.Person(h,"a");
  Assert.Equal(HttpStatusCode.ServiceUnavailable,(await Register(h,a,Device())).StatusCode);
  var response=await ProfileTests.Send(h,a,HttpMethod.Get,"/api/notifications/configuration");Assert.False((await response.Content.ReadFromJsonAsync<PushConfiguration>())!.Enabled);
 }

 [Fact]public async Task A_late_invalid_receipt_cannot_deactivate_a_rotated_token(){
  await using var h=await AuthHarness.Create(true);var a=await MatchingTests.Person(h,"a");var b=await MatchingTests.Person(h,"b");await Preferences(h,a);
  var device=Device();await Register(h,a,device);var c=await ChatTests.Pair(h,a,b);await Message(h,b,c);await Step(h);
  Assert.Equal(HttpStatusCode.NoContent,(await Register(h,a,device with{Revision=2,Token=Device().Token})).StatusCode);
  h.Push.Receipts.Enqueue(new("invalid","invalid_token"));await Due(h);await Step(h);
  await h.Db(async db=>{Assert.True((await db.Set<PushDevice>().SingleAsync()).Active);Assert.Equal("cancelled",(await db.Set<PushDelivery>().SingleAsync()).LastCode);});
  Assert.Single(h.Push.Receipts); // Old provider receipt was not applied to the replacement binding.
 }

 [Fact]public async Task Concurrent_workers_claim_one_delivery_and_do_not_send_duplicate_tickets(){
  await using var h=await AuthHarness.Create(true);var a=await MatchingTests.Person(h,"a");var b=await MatchingTests.Person(h,"b");await Preferences(h,a);
  await Register(h,a,Device());var c=await ChatTests.Pair(h,a,b);await Message(h,b,c);
  async Task<bool> Run(){using var scope=h.Factory.Services.CreateScope();return await scope.ServiceProvider.GetRequiredService<PushOutbox>().Process(default);}
  var outcomes=await Task.WhenAll(Enumerable.Range(0,8).Select(_=>Run()));
  Assert.Single(outcomes,x=>x);Assert.Single(h.Push.Sent);
  await h.Db(async db=>Assert.Equal(1,(await db.Set<PushDelivery>().SingleAsync()).Attempts));
 }
}
