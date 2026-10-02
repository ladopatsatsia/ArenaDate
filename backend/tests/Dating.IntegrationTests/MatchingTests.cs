using System.Net;
using System.Net.Http.Json;
using Dating.Api.Features.Auth;
using Dating.Api.Features.Discovery;
using Dating.Api.Features.Profiles;
using Dating.Api.Features.Matching;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Xunit;
namespace Dating.IntegrationTests;
public class MatchingTests {
 private static Task<HttpResponseMessage> Send(AuthHarness h,TokenResponse user,SwipeRequest r)=>
  ProfileTests.Send(h,user,HttpMethod.Post,"/api/swipes",r);
 internal static async Task<TokenResponse> Person(AuthHarness h,string name) {
  var user=await h.Account(name+"@example.test");
  Assert.Equal(HttpStatusCode.OK,(await ProfileTests.Send(h,user,HttpMethod.Post,"/api/profile",ProfileTests.Input())).StatusCode);
  await h.Db(async db=>{ db.Add(new ProfilePhoto { Id=Guid.NewGuid(),UserId=user.Account.Id,RequestId=Guid.NewGuid(),
   State="approved",ObjectKey=Guid.NewGuid().ToString("N")+".jpg",ThumbnailKey=Guid.NewGuid().ToString("N")+".jpg",Position=0,Width=600,Height=400 }); await db.SaveChangesAsync(); });
  return user;
 }
 private static async Task<SwipeResult> Ok(HttpResponseMessage response) {
  Assert.Equal(HttpStatusCode.OK,response.StatusCode); return (await response.Content.ReadFromJsonAsync<SwipeResult>())!;
 }
 private static async Task Run<T>(AuthHarness h,Func<T,Task> action) where T:notnull {
  using var scope=h.Factory.Services.CreateScope(); await action(scope.ServiceProvider.GetRequiredService<T>());
 }
 [Fact] public async Task Simultaneous_reciprocal_likes_and_retries_create_exactly_one_identity() {
  await using var h=await AuthHarness.Create(); var a=await Person(h,"a"); var b=await Person(h,"b");
  var ar=new SwipeRequest(Guid.NewGuid(),b.Account.Id,"like"); var br=new SwipeRequest(Guid.NewGuid(),a.Account.Id,"like");
  var results=await Task.WhenAll(Enumerable.Range(0,12).Select(i=>Send(h,i%2==0?a:b,i%2==0?ar:br)));
  var values=await Task.WhenAll(results.Select(Ok));
  Assert.Single(values.Where(v=>v.MatchId!=null).Select(v=>v.MatchId).Distinct());
  await h.Db(async db=>{
   Assert.Equal(2,await db.Set<DiscoveryDecision>().CountAsync()); Assert.Equal(2,await db.Set<SwipeReceipt>().CountAsync());
   var match=Assert.Single(await db.Set<DatingMatch>().ToListAsync()); Assert.True(match.Active);
   Assert.Equal(match.Id,Assert.Single(await db.Set<Conversation>().ToListAsync()).MatchId);
   Assert.Equal(match.Id,Assert.Single(await db.Set<MatchEvent>().ToListAsync()).MatchId);
  });
  // Separate scopes/connections imitate competing outbox consumers.
  await Task.WhenAll(Run<MatchOutbox>(h,s=>s.Process(default)),Run<MatchOutbox>(h,s=>s.Process(default)));
  await h.Db(async db=>{Assert.Equal(2,await db.Set<MatchNotice>().CountAsync());var e=await db.Set<MatchEvent>().SingleAsync(); e.ProcessedAt=null;await db.SaveChangesAsync();});
  await Run<MatchOutbox>(h,s=>s.Process(default)); // delivery replay retains the same inbox identities
  await h.Db(async db=>Assert.Equal(2,await db.Set<MatchNotice>().CountAsync()));
 }
 [Fact] public async Task Opposite_actions_and_conflicting_request_reuse_are_final() {
  await using var h=await AuthHarness.Create();var a=await Person(h,"a");var b=await Person(h,"b");
  var id=Guid.NewGuid();
  var results=await Task.WhenAll(Send(h,a,new(id,b.Account.Id,"like")),Send(h,a,new(id,b.Account.Id,"pass")));
  Assert.Single(results,r=>r.StatusCode==HttpStatusCode.OK);Assert.Single(results,r=>r.StatusCode==HttpStatusCode.Conflict);
  var winner=await Ok(results.Single(r=>r.StatusCode==HttpStatusCode.OK));
  Assert.Equal(winner,await Ok(await Send(h,a,new(id,b.Account.Id,winner.Kind))));
  Assert.Equal(HttpStatusCode.Conflict,(await Send(h,a,new(Guid.NewGuid(),b.Account.Id,winner.Kind))).StatusCode);
  // The ID cannot be reused against a different existing target.
  var c=await Person(h,"c");Assert.Equal(HttpStatusCode.Conflict,(await Send(h,a,new(id,c.Account.Id,winner.Kind))).StatusCode);
  await h.Db(async db=>Assert.Single(await db.Set<DiscoveryDecision>().ToListAsync()));
 }
 [Fact] public async Task Pass_prevents_match_and_swipes_revalidate_current_eligibility() {
  await using var h=await AuthHarness.Create();var a=await Person(h,"a");var b=await Person(h,"b");
  Assert.Null((await Ok(await Send(h,a,new(Guid.NewGuid(),b.Account.Id,"pass")))).MatchId);
  Assert.Null((await Ok(await Send(h,b,new(Guid.NewGuid(),a.Account.Id,"like")))).MatchId);
  await h.Db(async db=>Assert.Empty(await db.Set<DatingMatch>().ToListAsync()));
  var c=await Person(h,"c");
  await h.Db(async db=>{(await db.Set<DatingProfile>().SingleAsync(p=>p.UserId==c.Account.Id)).Visible=false;await db.SaveChangesAsync();});
  Assert.Equal(HttpStatusCode.NotFound,(await Send(h,a,new(Guid.NewGuid(),c.Account.Id,"like"))).StatusCode);
  Assert.Equal(HttpStatusCode.BadRequest,(await Send(h,a,new(Guid.NewGuid(),a.Account.Id,"like"))).StatusCode);
  Assert.Equal(HttpStatusCode.BadRequest,(await Send(h,a,new(Guid.Empty,b.Account.Id,"like"))).StatusCode);
  Assert.Equal(HttpStatusCode.Unauthorized,(await h.Client.PostAsJsonAsync("/api/swipes",new SwipeRequest(Guid.NewGuid(),a.Account.Id,"like"))).StatusCode);
 }
 [Fact] public async Task Block_racing_reciprocal_like_never_leaves_an_active_blocked_match() {
  await using var h=await AuthHarness.Create();var a=await Person(h,"a");var b=await Person(h,"b");
  await Ok(await Send(h,a,new(Guid.NewGuid(),b.Account.Id,"like")));
  var input=new SwipeRequest(Guid.NewGuid(),a.Account.Id,"like");
  var like=Send(h,b,input);var block=Run<PairLifecycle>(h,s=>s.Block(a.Account.Id,b.Account.Id,default));
  await Task.WhenAll(like,block);
  Assert.Contains((await like).StatusCode,new[]{HttpStatusCode.OK,HttpStatusCode.NotFound});
  await h.Db(async db=>{Assert.Single(await db.Set<UserBlock>().ToListAsync());Assert.Empty(await db.Set<DatingMatch>().Where(m=>m.Active).ToListAsync());});
  await Run<MatchOutbox>(h,s=>s.Process(default));
  await Run<MatchService>(h,async s=>{Assert.Empty(await s.Notices(a.Account.Id,default));var receipt=await s.Receipt(b.Account.Id,input.RequestId,default);Assert.Null(receipt?.MatchId);});
  Assert.Null((await like).StatusCode==HttpStatusCode.OK?(await Ok(await Send(h,b,input))).MatchId:null);
 }
 [Fact] public async Task Unmatch_racing_replay_never_reactivates_and_cannot_implicitly_rematch() {
  await using var h=await AuthHarness.Create();var a=await Person(h,"a");var b=await Person(h,"b");
  await Ok(await Send(h,a,new(Guid.NewGuid(),b.Account.Id,"like")));var input=new SwipeRequest(Guid.NewGuid(),a.Account.Id,"like");
  var result=await Ok(await Send(h,b,input));Assert.NotNull(result.MatchId);
  await Task.WhenAll(Send(h,b,input),Run<PairLifecycle>(h,s=>s.Unmatch(a.Account.Id,b.Account.Id,default)));
  Assert.Null((await Ok(await Send(h,b,input))).MatchId);
  Assert.Equal(HttpStatusCode.Conflict,(await Send(h,b,new(Guid.NewGuid(),a.Account.Id,"like"))).StatusCode);
  await h.Db(async db=>{Assert.False((await db.Set<DatingMatch>().SingleAsync()).Active);Assert.Single(await db.Set<Conversation>().ToListAsync());Assert.Single(await db.Set<MatchEvent>().ToListAsync());Assert.Single(await db.Set<UnmatchedPair>().ToListAsync());});
 }
 [Fact] public async Task Receipt_and_notice_access_are_owner_scoped_and_ack_survives_delivery_retry() {
  await using var h=await AuthHarness.Create();var a=await Person(h,"a");var b=await Person(h,"b");var c=await Person(h,"c");
  var ar=new SwipeRequest(Guid.NewGuid(),b.Account.Id,"like");await Ok(await Send(h,a,ar));
  var matched=await Ok(await Send(h,b,new(Guid.NewGuid(),a.Account.Id,"like")));
  Assert.Equal(HttpStatusCode.NotFound,(await ProfileTests.Send(h,c,HttpMethod.Get,"/api/swipes/"+ar.RequestId)).StatusCode);
  Assert.Equal(HttpStatusCode.OK,(await ProfileTests.Send(h,a,HttpMethod.Get,"/api/swipes/"+ar.RequestId)).StatusCode);
  Assert.Equal(HttpStatusCode.NotFound,(await ProfileTests.Send(h,c,HttpMethod.Post,$"/api/matches/{matched.MatchId}/acknowledge",new{})).StatusCode);
  Assert.Equal(HttpStatusCode.NoContent,(await ProfileTests.Send(h,b,HttpMethod.Post,$"/api/matches/{matched.MatchId}/acknowledge",new{})).StatusCode);
  await Run<MatchOutbox>(h,s=>s.Process(default));
  await Run<MatchService>(h,async s=>{Assert.Empty(await s.Notices(b.Account.Id,default));Assert.Single(await s.Notices(a.Account.Id,default));Assert.Empty(await s.Notices(c.Account.Id,default));});
 }
 [Fact] public async Task Database_constraints_prevent_duplicate_pair_conversation_event_and_decision_mutation() {
  await using var h=await AuthHarness.Create();var a=await Person(h,"a");var b=await Person(h,"b");
  await Ok(await Send(h,a,new(Guid.NewGuid(),b.Account.Id,"like")));var result=await Ok(await Send(h,b,new(Guid.NewGuid(),a.Account.Id,"like")));
  await h.Db(async db=>{var m=await db.Set<DatingMatch>().SingleAsync();db.Add(new DatingMatch{Id=Guid.NewGuid(),FirstId=m.FirstId,SecondId=m.SecondId});await Assert.ThrowsAsync<DbUpdateException>(()=>db.SaveChangesAsync());});
  await h.Db(async db=>{db.Add(new Conversation{Id=Guid.NewGuid(),MatchId=result.MatchId!.Value});await Assert.ThrowsAsync<DbUpdateException>(()=>db.SaveChangesAsync());});
  await h.Db(async db=>{db.Add(new MatchEvent{Id=Guid.NewGuid(),MatchId=result.MatchId!.Value});await Assert.ThrowsAsync<DbUpdateException>(()=>db.SaveChangesAsync());});
  await h.Db(async db=>{var d=await db.Set<DiscoveryDecision>().FirstAsync();d.Kind="pass";await Assert.ThrowsAsync<DbUpdateException>(()=>db.SaveChangesAsync());});
 }

 [Fact] public async Task Different_request_ids_with_opposite_actions_have_one_immutable_winner() {
  await using var h=await AuthHarness.Create();var a=await Person(h,"a");var b=await Person(h,"b");
  var responses=await Task.WhenAll(Send(h,a,new(Guid.NewGuid(),b.Account.Id,"like")),Send(h,a,new(Guid.NewGuid(),b.Account.Id,"pass")));
  Assert.Single(responses,r=>r.StatusCode==HttpStatusCode.OK);Assert.Single(responses,r=>r.StatusCode==HttpStatusCode.Conflict);
  await h.Db(async db=>{Assert.Single(await db.Set<DiscoveryDecision>().ToListAsync());Assert.Single(await db.Set<SwipeReceipt>().ToListAsync());});
 }
 [Fact] public async Task Failed_conversation_write_rolls_back_second_decision_match_and_event() {
  await using var h=await AuthHarness.Create();var a=await Person(h,"a");var b=await Person(h,"b");
  await Ok(await Send(h,a,new(Guid.NewGuid(),b.Account.Id,"like")));
  await h.Db(db=>db.Database.ExecuteSqlRawAsync("""
   CREATE FUNCTION test_fail_conversation() RETURNS trigger LANGUAGE plpgsql AS $$
   BEGIN RAISE EXCEPTION 'test failure'; END $$;
   CREATE TRIGGER test_fail BEFORE INSERT ON "Conversation" FOR EACH ROW EXECUTE FUNCTION test_fail_conversation();
   """));
  var request=new SwipeRequest(Guid.NewGuid(),a.Account.Id,"like");
  Assert.Equal(HttpStatusCode.InternalServerError,(await Send(h,b,request)).StatusCode);
  await h.Db(async db=>{
   Assert.Equal(1,await db.Set<DiscoveryDecision>().CountAsync());Assert.Equal(1,await db.Set<SwipeReceipt>().CountAsync());
   Assert.Empty(await db.Set<DatingMatch>().ToListAsync());Assert.Empty(await db.Set<MatchEvent>().ToListAsync());
   await db.Database.ExecuteSqlRawAsync("""DROP TRIGGER test_fail ON "Conversation"; DROP FUNCTION test_fail_conversation();""");
  });
  Assert.NotNull((await Ok(await Send(h,b,request))).MatchId);
 }
 [Fact] public async Task Match_list_is_member_only_bounded_and_hides_blocked_pairs() {
  await using var h=await AuthHarness.Create();var a=await Person(h,"a");var b=await Person(h,"b");var outsider=await Person(h,"c");
  await Ok(await Send(h,a,new(Guid.NewGuid(),b.Account.Id,"like")));var matched=await Ok(await Send(h,b,new(Guid.NewGuid(),a.Account.Id,"like")));
  var response=await ProfileTests.Send(h,a,HttpMethod.Get,"/api/matches");
  Assert.Equal(HttpStatusCode.OK,response.StatusCode);
  var page=(await response.Content.ReadFromJsonAsync<MatchPage>())!;Assert.Single(page.Items);Assert.Equal(matched.MatchId,page.Items[0].Id);
  Assert.DoesNotContain("dateOfBirth",await response.Content.ReadAsStringAsync());
  await Run<MatchService>(h,async s=>{Assert.Empty((await s.List(outsider.Account.Id,null,default)).Items);Assert.Empty((await s.List(a.Account.Id,matched.MatchId,default)).Items);});
  Assert.Equal(HttpStatusCode.BadRequest,(await ProfileTests.Send(h,a,HttpMethod.Get,"/api/matches?limit=999")).StatusCode);
  await Run<PairLifecycle>(h,s=>s.Block(a.Account.Id,b.Account.Id,default));
  await Run<MatchService>(h,async s=>Assert.Empty((await s.List(a.Account.Id,null,default)).Items));
 }
 [Theory]
 [InlineData("inactive")] [InlineData("gender")] [InlineData("photo")] [InlineData("block")]
 public async Task Cached_candidate_cannot_bypass_current_eligibility(string change) {
  await using var h=await AuthHarness.Create();var a=await Person(h,"a");var b=await Person(h,"b");
  await h.Db(async db=>{
   if(change=="inactive") (await db.Users.SingleAsync(u=>u.Id==b.Account.Id)).IsActive=false;
   if(change=="gender") (await db.Set<DatingProfile>().SingleAsync(p=>p.UserId==b.Account.Id)).DesiredGenders=["woman"];
   if(change=="photo") (await db.Set<ProfilePhoto>().SingleAsync(p=>p.UserId==b.Account.Id)).State="rejected";
   if(change=="block") db.Add(new UserBlock{BlockerId=b.Account.Id,BlockedId=a.Account.Id});
   await db.SaveChangesAsync();
  });
  Assert.Equal(HttpStatusCode.NotFound,(await Send(h,a,new(Guid.NewGuid(),b.Account.Id,"like"))).StatusCode);
  await h.Db(async db=>{Assert.Empty(await db.Set<DiscoveryDecision>().ToListAsync());Assert.Empty(await db.Set<DatingMatch>().ToListAsync());});
 }

 [Fact] public async Task Outbox_failures_back_off_dead_letter_and_recover_without_duplicate_notices() {
  await using var h=await AuthHarness.Create();var a=await Person(h,"a");var b=await Person(h,"b");
  await Ok(await Send(h,a,new(Guid.NewGuid(),b.Account.Id,"like")));await Ok(await Send(h,b,new(Guid.NewGuid(),a.Account.Id,"like")));
  await h.Db(db=>db.Database.ExecuteSqlRawAsync("""
   CREATE FUNCTION test_fail_notice() RETURNS trigger LANGUAGE plpgsql AS $$
   BEGIN RAISE EXCEPTION 'test failure'; END $$;
   CREATE TRIGGER test_fail BEFORE INSERT ON "MatchNotice" FOR EACH ROW EXECUTE FUNCTION test_fail_notice();
   """));
  await Run<MatchOutbox>(h,s=>s.Process(default));
  await h.Db(async db=>{var e=await db.Set<MatchEvent>().SingleAsync();Assert.Equal(1,e.Attempts);Assert.True(e.NextAttemptAt>e.CreatedAt);Assert.Null(e.ProcessedAt);Assert.Equal("delivery_failed",e.LastErrorCode);Assert.Empty(await db.Set<MatchNotice>().ToListAsync());});
  await Run<MatchOutbox>(h,s=>s.Process(default));
  await h.Db(async db=>Assert.Equal(1,(await db.Set<MatchEvent>().SingleAsync()).Attempts));
  for(var i=1;i<8;i++) {
   await h.Db(async db=>{var e=await db.Set<MatchEvent>().SingleAsync();e.NextAttemptAt=DateTimeOffset.UnixEpoch;await db.SaveChangesAsync();});
   await Run<MatchOutbox>(h,s=>s.Process(default));
  }
  await h.Db(async db=>{
   var e=await db.Set<MatchEvent>().SingleAsync();Assert.Equal(8,e.Attempts);Assert.NotNull(e.DeadLetterAt);
   Assert.Equal(1,await db.Database.SqlQueryRaw<int>("SELECT count(*)::int AS \"Value\" FROM \"MatchOutboxDeadLetters\"").SingleAsync());
   await db.Database.ExecuteSqlRawAsync("""DROP TRIGGER test_fail ON "MatchNotice"; DROP FUNCTION test_fail_notice();""");
   e.DeadLetterAt=null;e.Attempts=0;e.NextAttemptAt=DateTimeOffset.UnixEpoch;await db.SaveChangesAsync();
  });
  await Run<MatchOutbox>(h,s=>s.Process(default));
  await h.Db(async db=>{Assert.Equal(2,await db.Set<MatchNotice>().CountAsync());Assert.NotNull((await db.Set<MatchEvent>().SingleAsync()).ProcessedAt);});
 }
}
