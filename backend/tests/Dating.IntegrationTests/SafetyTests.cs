using System.Net;
using System.Net.Http.Json;
using Dating.Api.Features.Auth;
using Dating.Api.Features.Chat;
using Dating.Api.Features.Discovery;
using Dating.Api.Features.Matching;
using Dating.Api.Features.Profiles;
using Dating.Api.Features.Safety;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Xunit;
namespace Dating.IntegrationTests;
public class SafetyTests {
 private static Task<HttpResponseMessage> Act(AuthHarness h,TokenResponse a,SafetyRequest r)=>ProfileTests.Send(h,a,HttpMethod.Post,"/api/safety",r);
 private static async Task<T> Get<T>(AuthHarness h,TokenResponse a,string path){var response=await ProfileTests.Send(h,a,HttpMethod.Get,path);Assert.Equal(HttpStatusCode.OK,response.StatusCode);return (await response.Content.ReadFromJsonAsync<T>())!;}
 [Theory][InlineData(false)][InlineData(true)]
 public async Task Blocks_are_private_bidirectional_and_unblock_never_restores_match(bool reverse){
  await using var h=await AuthHarness.Create();var a=await MatchingTests.Person(h,"a");var b=await MatchingTests.Person(h,"b");var c=await ChatTests.Pair(h,a,b);
  var actor=reverse?b:a;var peer=reverse?a:b;
  var input=new SafetyRequest(Guid.NewGuid(),"block",ConversationId:c);
  Assert.Equal(HttpStatusCode.NoContent,(await Act(h,actor,input)).StatusCode);
  Assert.Single((await Get<SafetyPage>(h,actor,"/api/safety/blocks")).Items);
  Assert.Empty((await Get<SafetyPage>(h,peer,"/api/safety/blocks")).Items);
  foreach(var user in new[]{a,b})Assert.Equal(HttpStatusCode.NotFound,(await ProfileTests.Send(h,user,HttpMethod.Get,$"/api/conversations/{c}/messages")).StatusCode);
  Assert.Equal(HttpStatusCode.NoContent,(await Act(h,peer,new(Guid.NewGuid(),"block",ConversationId:c))).StatusCode);
  Assert.Equal(HttpStatusCode.NoContent,(await Act(h,actor,new(Guid.NewGuid(),"unblock",peer.Account.Id))).StatusCode);
  Assert.Empty((await Get<SafetyPage>(h,actor,"/api/safety/blocks")).Items);
  Assert.Single((await Get<SafetyPage>(h,peer,"/api/safety/blocks")).Items);
  // Replay of the original block cannot undo a later unblock.
  Assert.Equal(HttpStatusCode.NoContent,(await Act(h,actor,input)).StatusCode);
  Assert.Empty((await Get<SafetyPage>(h,actor,"/api/safety/blocks")).Items);
  Assert.Equal(HttpStatusCode.NoContent,(await Act(h,peer,new(Guid.NewGuid(),"unblock",actor.Account.Id))).StatusCode);
  Assert.Equal(HttpStatusCode.NotFound,(await ProfileTests.Send(h,a,HttpMethod.Post,$"/api/conversations/{c}/messages",new SendMessage(Guid.NewGuid(),"denied"))).StatusCode);
  Assert.Equal(HttpStatusCode.Conflict,(await Act(h,actor,input with{Action="unmatch"})).StatusCode);
  await h.Db(async db=>Assert.False((await db.Set<DatingMatch>().SingleAsync()).Active));
 }
 [Fact] public async Task Reporting_at_unmatch_and_later_preserves_only_server_owned_protected_evidence(){
  await using var h=await AuthHarness.Create();var a=await MatchingTests.Person(h,"a");var b=await MatchingTests.Person(h,"b");var outsider=await MatchingTests.Person(h,"c");var c=await ChatTests.Pair(h,a,b);
  var response=await ProfileTests.Send(h,b,HttpMethod.Post,$"/api/conversations/{c}/messages",new SendMessage(Guid.NewGuid(),"sensitive evidence"));response.EnsureSuccessStatusCode();
  var message=(await response.Content.ReadFromJsonAsync<MessageDto>())!;
  var request=new SafetyRequest(Guid.NewGuid(),"unmatch",ConversationId:c,Report:new("message","harassment","private description",message.Id));
  Assert.Equal(HttpStatusCode.NoContent,(await Act(h,a,request)).StatusCode);
  Assert.Equal(HttpStatusCode.NoContent,(await Act(h,a,request)).StatusCode);
  Assert.Equal(HttpStatusCode.NotFound,(await Act(h,b,request with{RequestId=Guid.NewGuid(),Action="report"})).StatusCode); // own message
  Assert.Equal(HttpStatusCode.NotFound,(await Act(h,outsider,request with{RequestId=Guid.NewGuid()})).StatusCode);
  Assert.Equal(HttpStatusCode.NoContent,(await Act(h,a,request with{RequestId=Guid.NewGuid(),Action="report",Report=new("message","spam","",null)})).StatusCode);
  Assert.Equal(HttpStatusCode.NotFound,(await GetResponse(h,a,c)).StatusCode);
  var prior=await Get<SafetyPage>(h,a,"/api/safety/prior-conversations");Assert.Equal(c,prior.Items.Single().Id);
  Assert.Empty((await Get<SafetyPage>(h,outsider,"/api/safety/prior-conversations")).Items);
  var protector=h.Factory.Services.GetRequiredService<IDataProtectionProvider>().CreateProtector("Dating.Safety.Evidence.v1");
  await h.Db(async db=>{
   var reports=await db.Set<SafetyReport>().ToArrayAsync();Assert.Equal(2,reports.Length);
   foreach(var report in reports){Assert.DoesNotContain("sensitive evidence",report.ProtectedEvidence);Assert.Contains("sensitive evidence",protector.Unprotect(report.ProtectedEvidence));Assert.Equal(TimeSpan.FromDays(180),report.DeleteAfter-report.CreatedAt);}
   Assert.Single(await db.Set<UnmatchedPair>().ToArrayAsync());
  });
 }
 private static Task<HttpResponseMessage> GetResponse(AuthHarness h,TokenResponse a,Guid c)=>ProfileTests.Send(h,a,HttpMethod.Get,$"/api/conversations/{c}/messages");
 [Fact] public async Task Invalid_evidence_rolls_back_block_and_reports_are_rate_limited_and_purged(){
  await using var h=await AuthHarness.Create();var a=await MatchingTests.Person(h,"a");var b=await MatchingTests.Person(h,"b");var c=await ChatTests.Pair(h,a,b);
  var bad=new SafetyRequest(Guid.NewGuid(),"block",ConversationId:c,Report:new("message","spam","",Guid.NewGuid()));
  Assert.Equal(HttpStatusCode.NotFound,(await Act(h,a,bad)).StatusCode);
  Assert.Equal(HttpStatusCode.OK,(await GetResponse(h,a,c)).StatusCode);
  for(var i=0;i<5;i++)Assert.Equal(HttpStatusCode.NoContent,(await Act(h,a,new(Guid.NewGuid(),"report",ConversationId:c,Report:new("profile","spam","description")))).StatusCode);
  Assert.Equal(HttpStatusCode.TooManyRequests,(await Act(h,a,new(Guid.NewGuid(),"report",ConversationId:c,Report:new("profile","spam","description")))).StatusCode);
  Assert.Equal(HttpStatusCode.BadRequest,(await Act(h,a,new(Guid.NewGuid(),"report",ConversationId:c,Report:new("profile","spam",new string('x',1001))))).StatusCode);
  await h.Db(db=>db.Set<SafetyReport>().ExecuteUpdateAsync(r=>r.SetProperty(x=>x.DeleteAfter,DateTimeOffset.UtcNow.AddDays(-1))));
  using(var scope=h.Factory.Services.CreateScope())await scope.ServiceProvider.GetRequiredService<SafetyService>().Purge(default);
  await h.Db(async db=>{Assert.Empty(await db.Set<SafetyReport>().ToListAsync());Assert.Equal(5,await db.Set<SafetyReceipt>().CountAsync());});
 }
 [Fact] public async Task Block_racing_send_evicts_existing_socket_and_only_sends_generic_revocation(){
  await using var h=await AuthHarness.Create();var a=await MatchingTests.Person(h,"a");var b=await MatchingTests.Person(h,"b");var c=await ChatTests.Pair(h,a,b);
  var wire=await ChatTests.Wire.Open(h,b);Assert.DoesNotContain("error",await wire.Invoke(c));
  var send=ProfileTests.Send(h,b,HttpMethod.Post,$"/api/conversations/{c}/messages",new SendMessage(Guid.NewGuid(),"racing"));
  var block=Act(h,a,new(Guid.NewGuid(),"block",ConversationId:c));
  await Task.WhenAll(send,block);Assert.Equal(HttpStatusCode.NoContent,(await block).StatusCode);
  Assert.Contains((await send).StatusCode,new[]{HttpStatusCode.OK,HttpStatusCode.NotFound});
  Assert.Empty(h.Factory.Services.GetRequiredService<ChatConnections>().For(c));
  using(var scope=h.Factory.Services.CreateScope())await scope.ServiceProvider.GetRequiredService<ChatOutbox>().Process(default);
  var hint=await wire.Poll();Assert.Contains("ConversationUnavailable",hint);Assert.DoesNotContain(a.Account.Id.ToString(),hint);Assert.DoesNotContain("racing",hint);Assert.DoesNotContain("block",hint);
  Assert.Equal(HttpStatusCode.NotFound,(await ProfileTests.Send(h,b,HttpMethod.Post,$"/api/conversations/{c}/messages",new SendMessage(Guid.NewGuid(),"after commit"))).StatusCode);
  Assert.Contains("conversation_unavailable",await wire.Invoke(c));
 }
 [Fact] public async Task Discovery_block_racing_like_cannot_create_or_reactivate_pair(){
  await using var h=await AuthHarness.Create();var a=await MatchingTests.Person(h,"a");var b=await MatchingTests.Person(h,"b");
  var block=Act(h,a,new(Guid.NewGuid(),"block",b.Account.Id));
  var like=ProfileTests.Send(h,b,HttpMethod.Post,"/api/swipes",new SwipeRequest(Guid.NewGuid(),a.Account.Id,"like"));
  await Task.WhenAll(block,like);Assert.Equal(HttpStatusCode.NoContent,(await block).StatusCode);
  Assert.Contains((await like).StatusCode,new[]{HttpStatusCode.OK,HttpStatusCode.NotFound});
  Assert.Equal(HttpStatusCode.NotFound,(await ProfileTests.Send(h,a,HttpMethod.Post,"/api/swipes",new SwipeRequest(Guid.NewGuid(),b.Account.Id,"like"))).StatusCode);
  using(var scope=h.Factory.Services.CreateScope()){
   var eligibility=scope.ServiceProvider.GetRequiredService<DiscoveryEligibility>();Assert.False(await eligibility.CanSee(a.Account.Id,b.Account.Id,default));Assert.False(await eligibility.CanSee(b.Account.Id,a.Account.Id,default));
  }
  await h.Db(async db=>Assert.Empty(await db.Set<DatingMatch>().ToArrayAsync()));
 }

 [Fact] public async Task Block_revokes_existing_media_tickets_in_both_directions(){
  await using var h=await AuthHarness.Create();var a=await MatchingTests.Person(h,"a");var b=await MatchingTests.Person(h,"b");
  Guid photoA=default,photoB=default;await h.Db(async db=>{photoA=await db.Set<ProfilePhoto>().Where(p=>p.UserId==a.Account.Id).Select(p=>p.Id).SingleAsync();photoB=await db.Set<ProfilePhoto>().Where(p=>p.UserId==b.Account.Id).Select(p=>p.Id).SingleAsync();});
  MediaGrant grantA,grantB;
  using(var scope=h.Factory.Services.CreateScope()){var media=scope.ServiceProvider.GetRequiredService<MediaAccess>();grantA=await media.Grant(a.Account.Id,photoB,default);grantB=await media.Grant(b.Account.Id,photoA,default);}
  Assert.Equal(HttpStatusCode.NoContent,(await Act(h,b,new(Guid.NewGuid(),"block",a.Account.Id))).StatusCode);
  using(var scope=h.Factory.Services.CreateScope()){
   var media=scope.ServiceProvider.GetRequiredService<MediaAccess>();
   Assert.Equal(404,(await Assert.ThrowsAsync<AuthFailure>(()=>media.Redeem(a.Account.Id,photoB,grantA.Ticket,default))).Status);
   Assert.Equal(404,(await Assert.ThrowsAsync<AuthFailure>(()=>media.Redeem(b.Account.Id,photoA,grantB.Ticket,default))).Status);
  }
 }
 [Fact] public async Task Subscribe_racing_block_cannot_register_after_revocation(){
  await using var h=await AuthHarness.Create();var a=await MatchingTests.Person(h,"a");var b=await MatchingTests.Person(h,"b");var c=await ChatTests.Pair(h,a,b);
  var wire=await ChatTests.Wire.Open(h,b);
  var subscribe=wire.Invoke(c);var block=Act(h,a,new(Guid.NewGuid(),"block",ConversationId:c));
  await Task.WhenAll(subscribe,block);Assert.Equal(HttpStatusCode.NoContent,(await block).StatusCode);
  Assert.Empty(h.Factory.Services.GetRequiredService<ChatConnections>().For(c));
  Assert.Contains("conversation_unavailable",await wire.Invoke(c));
 }

 [Fact] public async Task A_committed_own_like_does_not_prevent_blocking_the_seen_profile(){
  await using var h=await AuthHarness.Create();var a=await MatchingTests.Person(h,"a");var b=await MatchingTests.Person(h,"b");
  Assert.Equal(HttpStatusCode.OK,(await ProfileTests.Send(h,a,HttpMethod.Post,"/api/swipes",new SwipeRequest(Guid.NewGuid(),b.Account.Id,"like"))).StatusCode);
  Assert.Equal(HttpStatusCode.NoContent,(await Act(h,a,new(Guid.NewGuid(),"block",b.Account.Id))).StatusCode);
  Assert.Equal(HttpStatusCode.NotFound,(await ProfileTests.Send(h,b,HttpMethod.Post,"/api/swipes",new SwipeRequest(Guid.NewGuid(),a.Account.Id,"like"))).StatusCode);
  await h.Db(async db=>{Assert.Single(await db.Set<UserBlock>().ToArrayAsync());Assert.Empty(await db.Set<DatingMatch>().ToArrayAsync());});
 }
}
