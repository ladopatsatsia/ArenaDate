using System.Net;
using System.Net.Http.Json;
using System.Security.Cryptography;
using Dating.Api.Features.Auth;
using Dating.Api.Features.Chat;
using Dating.Api.Features.Moderation;
using Dating.Api.Features.Notifications;
using Dating.Api.Features.Profiles;
using Dating.Api.Features.Safety;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Xunit;
namespace Dating.IntegrationTests;
public class ModerationTests {
 internal static async Task<string> Provision(AuthHarness h,Guid id) {
  using var scope=h.Factory.Services.CreateScope();var users=scope.ServiceProvider.GetRequiredService<UserManager<AppUser>>();var user=(await users.FindByIdAsync(id.ToString()))!;
  Assert.True((await users.ResetAuthenticatorKeyAsync(user)).Succeeded);
  var key=(await users.GetAuthenticatorKeyAsync(user))!;
  await h.Db(async db=>{db.Add(new StaffAccount{UserId=id,Role="Admin"});await db.SaveChangesAsync();});return key;
 }
 internal static string Code(string key) {
  const string alphabet="ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";var bytes=new List<byte>();var bits=0;var value=0;
  foreach(var c in key.ToUpperInvariant()){value=(value<<5)|alphabet.IndexOf(c);bits+=5;if(bits>=8){bits-=8;bytes.Add((byte)(value>>bits));}}
  var step=DateTimeOffset.UtcNow.ToUnixTimeSeconds()/30;var counter=BitConverter.GetBytes(System.Net.IPAddress.HostToNetworkOrder(step));
  var hash=HMACSHA1.HashData(bytes.ToArray(),counter);var offset=hash[^1]&15;
  var number=((hash[offset]&127)<<24)|(hash[offset+1]<<16)|(hash[offset+2]<<8)|hash[offset+3];return (number%1000000).ToString("D6");
 }
 internal static HttpClient Browser(AuthHarness h)=>h.Factory.CreateClient(new WebApplicationFactoryClientOptions{BaseAddress=new Uri("https://localhost"),HandleCookies=true,AllowAutoRedirect=false});
 internal static async Task Csrf(HttpClient browser) {
  var response=await browser.GetAsync("/api/moderation/csrf");Assert.Equal(HttpStatusCode.NoContent,response.StatusCode);
  var token=response.Headers.GetValues("Set-Cookie").Single(s=>s.StartsWith("XSRF-TOKEN=",StringComparison.Ordinal)).Split(';')[0]["XSRF-TOKEN=".Length..];
  browser.DefaultRequestHeaders.Remove("X-XSRF-TOKEN");browser.DefaultRequestHeaders.Add("X-XSRF-TOKEN",Uri.UnescapeDataString(token));
 }
 internal static async Task<HttpClient> SignedIn(AuthHarness h,TokenResponse account,string email) {
  var key=await Provision(h,account.Account.Id);var browser=Browser(h);await Csrf(browser);
  var response=await browser.PostAsJsonAsync("/api/moderation/login",new AdminLogin(email,AuthHarness.Password,Code(key)));
  Assert.Equal(HttpStatusCode.NoContent,response.StatusCode);await Csrf(browser);return browser;
 }
 [Fact] public async Task Every_staff_endpoint_rejects_mobile_bearer_even_with_legacy_role() {
  await using var h=await AuthHarness.Create();var user=await h.Account("user@example.test");
  await h.Db(async db=>{var role=new IdentityRole<Guid>("Moderator"){Id=Guid.NewGuid(),NormalizedName="MODERATOR"};db.Roles.Add(role);db.UserRoles.Add(new IdentityUserRole<Guid>{UserId=user.Account.Id,RoleId=role.Id});await db.SaveChangesAsync();});
  var id=Guid.NewGuid();
  foreach(var path in new[]{"me","photos",$"photos/{id}/content","reports",$"reports/{id}/evidence",$"users/{id}","audit"})
   Assert.Equal(HttpStatusCode.Unauthorized,(await ProfileTests.Send(h,user,HttpMethod.Get,"/api/moderation/"+path)).StatusCode);
  foreach(var path in new[]{"logout",$"photos/{id}",$"reports/{id}",$"users/{id}"})
   Assert.Equal(HttpStatusCode.Unauthorized,(await ProfileTests.Send(h,user,HttpMethod.Post,"/api/moderation/"+path,new{state="approved",active=false,reason="test reason"})).StatusCode);
  using var browser=Browser(h);await Csrf(browser);
  Assert.Equal(HttpStatusCode.Unauthorized,(await browser.PostAsJsonAsync("/api/moderation/login",new{email="user@example.test",password=AuthHarness.Password,code="123456",role="Admin"})).StatusCode);
  Assert.Equal(HttpStatusCode.NotFound,(await browser.PostAsJsonAsync("/api/moderation/roles",new{userId=user.Account.Id,role="Admin"})).StatusCode);
 }
 [Fact] public async Task Mfa_csrf_secure_cookie_replay_logout_and_expiry_are_enforced() {
  await using var h=await AuthHarness.Create();var user=await h.Account("staff@example.test");var key=await Provision(h,user.Account.Id);
  Assert.Equal(HttpStatusCode.BadRequest,(await h.Client.GetAsync("/api/moderation/csrf")).StatusCode);
  using var browser=Browser(h);var input=new AdminLogin("staff@example.test",AuthHarness.Password,Code(key));
  Assert.Equal(HttpStatusCode.BadRequest,(await browser.PostAsJsonAsync("/api/moderation/login",input)).StatusCode);
  await Csrf(browser);
  Assert.Equal(HttpStatusCode.Unauthorized,(await browser.PostAsJsonAsync("/api/moderation/login",input with{Code="000000"})).StatusCode);
  input=input with{Code=Code(key)};
  var login=await browser.PostAsJsonAsync("/api/moderation/login",input);Assert.Equal(HttpStatusCode.NoContent,login.StatusCode);
  var cookie=login.Headers.GetValues("Set-Cookie").Single(s=>s.StartsWith("__Host-DatingAdmin=",StringComparison.Ordinal)).ToLowerInvariant();
  Assert.Contains("secure",cookie);Assert.Contains("httponly",cookie);Assert.Contains("samesite=strict",cookie);
  await Csrf(browser);Assert.Equal(HttpStatusCode.OK,(await browser.GetAsync("/api/moderation/me")).StatusCode);
  Assert.Equal(HttpStatusCode.Unauthorized,(await browser.GetAsync("/api/auth/me")).StatusCode); // cookie cannot become a mobile token
  using var replay=Browser(h);await Csrf(replay);Assert.Equal(HttpStatusCode.Unauthorized,(await replay.PostAsJsonAsync("/api/moderation/login",input)).StatusCode);
  browser.DefaultRequestHeaders.Remove("X-XSRF-TOKEN");Assert.Equal(HttpStatusCode.BadRequest,(await browser.PostAsJsonAsync("/api/moderation/logout",new{})).StatusCode);
  foreach(var path in new[]{"photos/","reports/","users/"})Assert.Equal(HttpStatusCode.BadRequest,(await browser.PostAsJsonAsync("/api/moderation/"+path+Guid.NewGuid(),new{state="approved",active=false,reason="test rationale"})).StatusCode);
  await Csrf(browser);Assert.Equal(HttpStatusCode.NoContent,(await browser.PostAsJsonAsync("/api/moderation/logout",new{})).StatusCode);
  Assert.Equal(HttpStatusCode.Unauthorized,(await browser.GetAsync("/api/moderation/me")).StatusCode);
  await h.Db(async db=>Assert.All(await db.Set<AdminSession>().ToArrayAsync(),s=>Assert.NotNull(s.RevokedAt)));
 }
 [Theory][InlineData("expired")][InlineData("role")][InlineData("stamp")]
 public async Task Cookie_rechecks_persisted_session_staff_and_security_stamp(string kind) {
  await using var h=await AuthHarness.Create();var user=await h.Account("staff@example.test");using var browser=await SignedIn(h,user,"staff@example.test");
  await h.Db(async db=>{if(kind=="expired")(await db.Set<AdminSession>().SingleAsync()).ExpiresAt=DateTimeOffset.UtcNow.AddMinutes(-1);if(kind=="role")(await db.Set<StaffAccount>().SingleAsync()).Enabled=false;if(kind=="stamp")(await db.Users.SingleAsync()).SecurityStamp=Guid.NewGuid().ToString();await db.SaveChangesAsync();});
  Assert.Equal(HttpStatusCode.Unauthorized,(await browser.GetAsync("/api/moderation/audit")).StatusCode);
 }
 [Fact] public async Task Photo_decisions_are_atomic_audited_conflict_checked_and_reflected_in_owner_profile() {
  await using var h=await AuthHarness.Create();var owner=await h.Account("owner@example.test");var staff=await h.Account("staff@example.test");using var browser=await SignedIn(h,staff,"staff@example.test");
  await ProfileTests.Send(h,owner,HttpMethod.Post,"/api/profile",ProfileTests.Input());var photo=await ProfileTests.Upload(h,owner);
  Assert.Single((await browser.GetFromJsonAsync<PhotoReview[]>("/api/moderation/photos"))!);
  Assert.Equal(HttpStatusCode.OK,(await browser.GetAsync($"/api/moderation/photos/{photo.Id}/content")).StatusCode);
  var races=await Task.WhenAll(browser.PostAsJsonAsync($"/api/moderation/photos/{photo.Id}",new ReviewRequest("approved","Suitable profile photo")),browser.PostAsJsonAsync($"/api/moderation/photos/{photo.Id}",new ReviewRequest("rejected","Unsuitable profile photo")));
  Assert.Single(races,r=>r.StatusCode==HttpStatusCode.NoContent);Assert.Single(races,r=>r.StatusCode==HttpStatusCode.Conflict);
  var profile=(await (await ProfileTests.Send(h,owner,HttpMethod.Get,"/api/profile")).Content.ReadFromJsonAsync<OwnProfileDto>())!;Assert.True(profile.Revision>1);Assert.NotEqual("pending",profile.Photos.Single().State);
  Assert.Empty((await browser.GetFromJsonAsync<PhotoReview[]>("/api/moderation/photos"))!);
  Assert.Equal(HttpStatusCode.NotFound,(await browser.GetAsync($"/api/moderation/photos/{photo.Id}/content")).StatusCode);
  await h.Db(async db=>Assert.Single(await db.Set<ModerationAudit>().Where(a=>a.Action=="photo_approved"||a.Action=="photo_rejected").ToArrayAsync()));
 }
 [Fact] public async Task Report_evidence_is_scoped_audited_retained_and_never_grants_chat_access() {
  await using var h=await AuthHarness.Create();var a=await MatchingTests.Person(h,"a");var b=await MatchingTests.Person(h,"b");var c=await ChatTests.Pair(h,a,b);var staff=await h.Account("staff@example.test");using var browser=await SignedIn(h,staff,"staff@example.test");
  var message=(await (await ProfileTests.Send(h,b,HttpMethod.Post,$"/api/conversations/{c}/messages",new SendMessage(Guid.NewGuid(),"reported text"))).Content.ReadFromJsonAsync<MessageDto>())!;
  await ProfileTests.Send(h,b,HttpMethod.Post,$"/api/conversations/{c}/messages",new SendMessage(Guid.NewGuid(),"unreported private text"));
  Assert.Equal(HttpStatusCode.NoContent,(await ProfileTests.Send(h,a,HttpMethod.Post,"/api/safety",new SafetyRequest(Guid.NewGuid(),"report",ConversationId:c,Report:new("message","harassment","Reason",message.Id)))).StatusCode);
  var report=Assert.Single((await browser.GetFromJsonAsync<ReportSummary[]>("/api/moderation/reports"))!);
  var evidence=await browser.GetStringAsync($"/api/moderation/reports/{report.Id}/evidence");Assert.Contains("reported text",evidence);Assert.DoesNotContain("unreported private text",evidence);Assert.DoesNotContain(a.Account.Id.ToString(),evidence);
  Assert.Equal(HttpStatusCode.Unauthorized,(await browser.GetAsync($"/api/conversations/{c}/messages")).StatusCode);
  Assert.Equal(HttpStatusCode.NotFound,(await ProfileTests.Send(h,staff,HttpMethod.Get,$"/api/conversations/{c}/messages")).StatusCode);
  Assert.Equal(HttpStatusCode.NotFound,(await browser.GetAsync($"/api/moderation/reports/{Guid.NewGuid()}/evidence")).StatusCode);
  Assert.Equal(HttpStatusCode.NoContent,(await browser.PostAsJsonAsync($"/api/moderation/reports/{report.Id}",new ReviewRequest("closed","Reviewed retained evidence"))).StatusCode);
  Assert.Empty((await browser.GetFromJsonAsync<ReportSummary[]>("/api/moderation/reports"))!);
  Assert.Single((await browser.GetFromJsonAsync<ReportSummary[]>("/api/moderation/reports?closed=true"))!);
  await h.Db(async db=>{Assert.Single(await db.Set<ModerationAudit>().Where(x=>x.Action=="evidence_view").ToArrayAsync());(await db.Set<SafetyReport>().SingleAsync()).DeleteAfter=DateTimeOffset.UtcNow.AddSeconds(-1);await db.SaveChangesAsync();});
  Assert.Equal(HttpStatusCode.NotFound,(await browser.GetAsync($"/api/moderation/reports/{report.Id}/evidence")).StatusCode);
 }
 [Fact] public async Task Suspension_revokes_sessions_live_membership_discovery_messages_and_requires_new_login_after_reactivation() {
  await using var h=await AuthHarness.Create();var a=await MatchingTests.Person(h,"a");var b=await MatchingTests.Person(h,"b");var c=await ChatTests.Pair(h,a,b);var staff=await h.Account("staff@example.test");using var browser=await SignedIn(h,staff,"staff@example.test");
  var connections=h.Factory.Services.GetRequiredService<ChatConnections>();connections.Set(new("test-live",a.Account.Id,Guid.NewGuid(),long.MaxValue,c));
  var wire=await ChatTests.Wire.Open(h,b);Assert.DoesNotContain("error",await wire.Invoke(c));
  Assert.Equal(HttpStatusCode.NoContent,(await browser.PostAsJsonAsync($"/api/moderation/users/{a.Account.Id}",new AccountReview(false,"Confirmed harassment"))).StatusCode);
  Assert.Empty(connections.For(c));Assert.Equal(HttpStatusCode.Unauthorized,(await h.Me(a.AccessToken)).StatusCode);
  Assert.Contains("conversation_unavailable",await wire.Invoke(c));
  Assert.Equal(HttpStatusCode.NotFound,(await ProfileTests.Send(h,b,HttpMethod.Get,$"/api/conversations/{c}/messages")).StatusCode);
  Assert.Equal(HttpStatusCode.NotFound,(await ProfileTests.Send(h,b,HttpMethod.Post,$"/api/conversations/{c}/messages",new SendMessage(Guid.NewGuid(),"blocked"))).StatusCode);
  Assert.Equal(HttpStatusCode.NotFound,(await ProfileTests.Send(h,b,HttpMethod.Get,$"/api/discovery/{a.Account.Id}")).StatusCode);
  using(var scope=h.Factory.Services.CreateScope())await Assert.ThrowsAsync<AuthFailure>(()=>scope.ServiceProvider.GetRequiredService<ChatService>().AuthorizeSession(a.Account.Id,Guid.NewGuid(),long.MaxValue,c,default));
  Assert.Equal(HttpStatusCode.Unauthorized,(await h.Client.PostAsJsonAsync("/api/auth/refresh",new RefreshRequest(a.RefreshToken,Guid.NewGuid()))).StatusCode);
  Assert.Equal(HttpStatusCode.NoContent,(await browser.PostAsJsonAsync($"/api/moderation/users/{a.Account.Id}",new AccountReview(true,"Appeal reviewed"))).StatusCode);
  Assert.Equal(HttpStatusCode.Unauthorized,(await h.Me(a.AccessToken)).StatusCode);
  Assert.Equal(HttpStatusCode.Forbidden,(await browser.PostAsJsonAsync($"/api/moderation/users/{staff.Account.Id}",new AccountReview(false,"Attempt self suspension"))).StatusCode);
 }
 [Fact] public async Task Suspension_races_sends_and_cancels_queued_push_without_delivery() {
  await using var h=await AuthHarness.Create(true);var a=await MatchingTests.Person(h,"a");var b=await MatchingTests.Person(h,"b");var c=await ChatTests.Pair(h,a,b);var staff=await h.Account("staff@example.test");using var browser=await SignedIn(h,staff,"staff@example.test");
  var device=new DeviceRequest(Guid.NewGuid(),new string('a',64),1,"expo",AuthHarness.PushProject,"ios",true,"ExpoPushToken[abcdefghijklmnop]");
  Assert.Equal(HttpStatusCode.NoContent,(await ProfileTests.Send(h,a,HttpMethod.Post,"/api/notifications/device",device)).StatusCode);
  Assert.Equal(HttpStatusCode.NoContent,(await ProfileTests.Send(h,a,HttpMethod.Post,"/api/notifications/preferences",new PushPreferences(true,true))).StatusCode);
  Assert.Equal(HttpStatusCode.OK,(await ProfileTests.Send(h,b,HttpMethod.Post,$"/api/conversations/{c}/messages",new SendMessage(Guid.NewGuid(),"queued"))).StatusCode);
  var sending=ProfileTests.Send(h,b,HttpMethod.Post,$"/api/conversations/{c}/messages",new SendMessage(Guid.NewGuid(),"racing"));
  var suspending=browser.PostAsJsonAsync($"/api/moderation/users/{a.Account.Id}",new AccountReview(false,"Confirmed safety issue"));
  await Task.WhenAll(sending,suspending);Assert.Equal(HttpStatusCode.NoContent,(await suspending).StatusCode);Assert.Contains((await sending).StatusCode,new[]{HttpStatusCode.OK,HttpStatusCode.NotFound});
  Assert.Equal(HttpStatusCode.NotFound,(await ProfileTests.Send(h,b,HttpMethod.Post,$"/api/conversations/{c}/messages",new SendMessage(Guid.NewGuid(),"after commit"))).StatusCode);
  using(var scope=h.Factory.Services.CreateScope()){var outbox=scope.ServiceProvider.GetRequiredService<PushOutbox>();while(await outbox.Process(default)){} }
  Assert.Empty(h.Push.Sent);
  await h.Db(async db=>{Assert.All(await db.Set<PushDevice>().ToArrayAsync(),d=>{Assert.False(d.Active);Assert.Empty(d.Ciphertext);});Assert.All(await db.Set<PushDelivery>().ToArrayAsync(),d=>Assert.NotNull(d.FinishedAt));});
 }
}
