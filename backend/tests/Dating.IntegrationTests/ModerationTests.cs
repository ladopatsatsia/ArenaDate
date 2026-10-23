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
 [Fact] public async Task Admin_can_delete_user_soft_deleting_profile_and_auditing_action() {
  await using var h=await AuthHarness.Create();var target=await MatchingTests.Person(h,"target");var staff=await h.Account("staff@example.test");using var browser=await SignedIn(h,staff,"staff@example.test");
  var response=await browser.DeleteAsync($"/api/moderation/users/{target.Account.Id}?reason=Account+permanently+removed");
  Assert.Equal(HttpStatusCode.NoContent,response.StatusCode);
  await h.Db(async db=>{
   var u=await db.Users.IgnoreQueryFilters().SingleAsync(x=>x.Id==target.Account.Id);
   Assert.True(u.IsDeleted);
   Assert.False(u.IsActive);
   Assert.Single(await db.Set<ModerationAudit>().Where(a=>a.TargetId==target.Account.Id && a.Action=="account_deleted").ToArrayAsync());
  });
  var profilesRes=await browser.GetFromJsonAsync<AdminProfileSummary[]>("/api/moderation/profiles");
  Assert.DoesNotContain(profilesRes!,p=>p.UserId==target.Account.Id);
 }
 [Fact] public async Task Admin_can_create_new_user_and_wallet_is_initialized() {
  await using var h=await AuthHarness.Create();
  var staff=await h.Account("staff@example.test");
  using var browser=await SignedIn(h,staff,"staff@example.test");

  var createReq = new AdminCreateUserRequest(
   "newperson@example.test",
   "SuperPassword123!",
   "New Candidate",
   new DateOnly(2000, 5, 10),
   "woman",
   "Tbilisi",
   50
  );
  var postRes = await browser.PostAsJsonAsync("/api/moderation/users", createReq);
  Assert.Equal(HttpStatusCode.OK, postRes.StatusCode);
  var created = await postRes.Content.ReadFromJsonAsync<AdminProfileSummary>();
  Assert.NotNull(created);
  Assert.Equal("newperson@example.test", created.Email);
  Assert.Equal("New Candidate", created.DisplayName);
  Assert.Equal(50, created.Crystals);

  await h.Db(async db => {
   var wallet = await db.Set<Dating.Api.Features.Game.Wallet.UserWallet>().SingleAsync(w => w.UserId == created.UserId);
   Assert.Equal(50, wallet.Balance);
   var tx = await db.Set<Dating.Api.Features.Game.Wallet.CrystalTransaction>().SingleAsync(t => t.UserId == created.UserId);
   Assert.Equal(50, tx.Amount);
   Assert.Equal("AdminGrant", tx.Type);
   Assert.Single(await db.Set<ModerationAudit>().Where(a => a.TargetId == created.UserId && a.Action == "admin_user_created").ToArrayAsync());
  });

  var loginRes = await h.Client.PostAsJsonAsync("/api/auth/login", new LoginRequest("newperson@example.test", "SuperPassword123!"));
  Assert.Equal(HttpStatusCode.OK, loginRes.StatusCode);
 }
 [Fact] public async Task Admin_can_adjust_user_crystals_and_ledger_is_recorded() {
  await using var h=await AuthHarness.Create();
  var target=await MatchingTests.Person(h,"target");
  var staff=await h.Account("staff@example.test");
  using var browser=await SignedIn(h,staff,"staff@example.test");

  var adj1 = new AdminAdjustCrystalsRequest(100, "delta", "Admin test bonus");
  var res1 = await browser.PostAsJsonAsync($"/api/moderation/users/{target.Account.Id}/crystals", adj1);
  Assert.Equal(HttpStatusCode.OK, res1.StatusCode);
  var result1 = await res1.Content.ReadFromJsonAsync<AdminCrystalAdjustmentResult>();
  Assert.NotNull(result1);
  Assert.Equal(0, result1.OldBalance);
  Assert.Equal(100, result1.NewBalance);
  Assert.Equal(100, result1.Delta);

  var adj2 = new AdminAdjustCrystalsRequest(-30, "delta", "Admin penalty");
  var res2 = await browser.PostAsJsonAsync($"/api/moderation/users/{target.Account.Id}/crystals", adj2);
  Assert.Equal(HttpStatusCode.OK, res2.StatusCode);
  var result2 = await res2.Content.ReadFromJsonAsync<AdminCrystalAdjustmentResult>();
  Assert.NotNull(result2);
  Assert.Equal(100, result2.OldBalance);
  Assert.Equal(70, result2.NewBalance);
  Assert.Equal(-30, result2.Delta);

  var adj3 = new AdminAdjustCrystalsRequest(250, "set", "Set exact balance");
  var res3 = await browser.PostAsJsonAsync($"/api/moderation/users/{target.Account.Id}/crystals", adj3);
  Assert.Equal(HttpStatusCode.OK, res3.StatusCode);
  var result3 = await res3.Content.ReadFromJsonAsync<AdminCrystalAdjustmentResult>();
  Assert.NotNull(result3);
  Assert.Equal(70, result3.OldBalance);
  Assert.Equal(250, result3.NewBalance);
  Assert.Equal(180, result3.Delta);

  await h.Db(async db => {
   var wallet = await db.Set<Dating.Api.Features.Game.Wallet.UserWallet>().SingleAsync(w => w.UserId == target.Account.Id);
   Assert.Equal(250, wallet.Balance);
   var audits = await db.Set<ModerationAudit>().Where(a => a.TargetId == target.Account.Id && a.Action == "crystal_adjustment").ToListAsync();
   Assert.Equal(3, audits.Count);
  });
 }

 [Fact]
 public async Task Admin_can_query_transactions_history_and_summary_statistics()
 {
  await using var h = await AuthHarness.Create();
  var admin = await h.Account("tx_admin@example.test");
  var user = await h.Account("paying_user@example.test");
  var browser = await SignedIn(h, admin, "tx_admin@example.test");

  var now = DateTimeOffset.UtcNow;
  var subId = Guid.NewGuid();
  var purchaseId = Guid.NewGuid();
  var txId = Guid.NewGuid();

  await h.Db(async db => {
   db.Set<Dating.Api.Features.Premium.UserSubscription>().Add(new Dating.Api.Features.Premium.UserSubscription
   {
    Id = subId,
    UserId = user.Account.Id,
    PackageId = "one_month",
    PriceAmount = 4.90m,
    Currency = "GEL",
    Platform = "Mobile",
    TransactionId = "sub_tx_test_123",
    StartedAtUtc = now,
    ExpiresAtUtc = now.AddDays(30),
    IsActive = true,
    CreatedAtUtc = now
   });

   db.Set<Dating.Api.Features.Game.Wallet.StorePurchase>().Add(new Dating.Api.Features.Game.Wallet.StorePurchase
   {
    Id = purchaseId,
    UserId = user.Account.Id,
    Platform = "TelegramStars",
    ProductId = "dating.crystals.500",
    Amount = 500,
    PriceAmount = 100m,
    PriceCurrency = "XTR",
    Status = "Credited",
    TransactionId = "stars_charge_999",
    PurchaseToken = "tok_test_abc",
    CreatedAtUtc = now.AddMinutes(5)
   });

   db.Set<Dating.Api.Features.Game.Wallet.CrystalTransaction>().Add(new Dating.Api.Features.Game.Wallet.CrystalTransaction
   {
    Id = txId,
    UserId = user.Account.Id,
    Amount = -25,
    BalanceAfter = 475,
    Type = "gift",
    Description = "Sent romantic rose",
    IdempotencyKey = "idem_gift_1",
    CreatedAtUtc = now.AddMinutes(10)
   });

   await db.SaveChangesAsync();
  });

  // 1. Query all real money transactions
  var allRes = await browser.GetAsync("/api/moderation/transactions?category=all");
  Assert.Equal(HttpStatusCode.OK, allRes.StatusCode);
  var allData = await allRes.Content.ReadFromJsonAsync<AdminTransactionsResponse>();
  Assert.NotNull(allData);
  Assert.True(allData.TotalCount >= 2);
  Assert.Equal(4.90m, allData.Stats.TotalRevenueGel);
  Assert.Equal(100, allData.Stats.TotalRevenueStars);
  Assert.True(allData.Stats.TotalSubscriptionsCount >= 1);
  Assert.True(allData.Stats.TotalCrystalsSold >= 500);
  Assert.True(allData.Stats.TotalPayingUsersCount >= 1);

  var subItem = allData.Items.FirstOrDefault(x => x.Id == subId.ToString());
  Assert.NotNull(subItem);
  Assert.Equal("subscription", subItem.Category);
  Assert.Equal(4.90m, subItem.PriceAmount);
  Assert.Equal("GEL", subItem.Currency);
  Assert.Equal("sub_tx_test_123", subItem.TransactionId);

  var purchaseItem = allData.Items.FirstOrDefault(x => x.Id == purchaseId.ToString());
  Assert.NotNull(purchaseItem);
  Assert.Equal("crystal_purchase", purchaseItem.Category);
  Assert.Equal(500, purchaseItem.Crystals);
  Assert.Equal("stars_charge_999", purchaseItem.TransactionId);

  // 2. Query subscriptions only
  var subsRes = await browser.GetAsync("/api/moderation/transactions?category=subscriptions");
  Assert.Equal(HttpStatusCode.OK, subsRes.StatusCode);
  var subsData = await subsRes.Content.ReadFromJsonAsync<AdminTransactionsResponse>();
  Assert.NotNull(subsData);
  Assert.All(subsData.Items, item => Assert.Equal("subscription", item.Category));

  // 3. Query crystals store only
  var cryRes = await browser.GetAsync("/api/moderation/transactions?category=crystals");
  Assert.Equal(HttpStatusCode.OK, cryRes.StatusCode);
  var cryData = await cryRes.Content.ReadFromJsonAsync<AdminTransactionsResponse>();
  Assert.NotNull(cryData);
  Assert.All(cryData.Items, item => Assert.Equal("crystal_purchase", item.Category));

  // 4. Query spends only
  var spendRes = await browser.GetAsync("/api/moderation/transactions?category=spends");
  Assert.Equal(HttpStatusCode.OK, spendRes.StatusCode);
  var spendData = await spendRes.Content.ReadFromJsonAsync<AdminTransactionsResponse>();
  Assert.NotNull(spendData);
  Assert.All(spendData.Items, item => Assert.Equal("crystal_spend", item.Category));

  // 5. Query with search
  var searchRes = await browser.GetAsync("/api/moderation/transactions?search=stars_charge_999");
  Assert.Equal(HttpStatusCode.OK, searchRes.StatusCode);
  var searchData = await searchRes.Content.ReadFromJsonAsync<AdminTransactionsResponse>();
  Assert.NotNull(searchData);
  Assert.Single(searchData.Items);
  Assert.Equal("stars_charge_999", searchData.Items[0].TransactionId);
 }
}

