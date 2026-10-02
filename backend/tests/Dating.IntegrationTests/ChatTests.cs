using System.Net;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using Dating.Api.Features.Auth;
using Dating.Api.Features.Chat;
using Dating.Api.Features.Matching;
using Dating.Api.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Xunit;
namespace Dating.IntegrationTests;
public class ChatTests {
 private static Task<HttpResponseMessage> Send(AuthHarness h,TokenResponse u,Guid c,SendMessage input)=>ProfileTests.Send(h,u,HttpMethod.Post,$"/api/conversations/{c}/messages",input);
 private static async Task<T> Body<T>(HttpResponseMessage response) {
  Assert.Equal(HttpStatusCode.OK,response.StatusCode);return (await response.Content.ReadFromJsonAsync<T>())!;
 }
 internal static async Task<Guid> Pair(AuthHarness h,TokenResponse a,TokenResponse b) {
  await Body<SwipeResult>(await ProfileTests.Send(h,a,HttpMethod.Post,"/api/swipes",new SwipeRequest(Guid.NewGuid(),b.Account.Id,"like")));
  await Body<SwipeResult>(await ProfileTests.Send(h,b,HttpMethod.Post,"/api/swipes",new SwipeRequest(Guid.NewGuid(),a.Account.Id,"like")));
  Guid id=default;await h.Db(async db=>id=(await db.Set<Conversation>().OrderByDescending(c=>c.Id).ToArrayAsync()).Single(c=>
   db.Set<DatingMatch>().Any(m=>m.Id==c.MatchId && (m.FirstId==a.Account.Id || m.SecondId==a.Account.Id) && (m.FirstId==b.Account.Id || m.SecondId==b.Account.Id))).Id);return id;
 }
 private static async Task Run<T>(AuthHarness h,Func<T,Task> action) where T:notnull { using var scope=h.Factory.Services.CreateScope();await action(scope.ServiceProvider.GetRequiredService<T>()); }
 [Fact] public async Task Concurrent_duplicate_and_distinct_sends_have_one_identity_and_monotonic_order() {
  await using var h=await AuthHarness.Create();var a=await MatchingTests.Person(h,"a");var b=await MatchingTests.Person(h,"b");var c=await Pair(h,a,b);
  var request=new SendMessage(Guid.NewGuid(),"hello <b>literal text</b>");
  var responses=await Task.WhenAll(Enumerable.Range(0,10).Select(_=>Send(h,a,c,request)));
  var messages=await Task.WhenAll(responses.Select(Body<MessageDto>));Assert.Single(messages.Select(m=>m.Id).Distinct());
  Assert.All(messages,m=>Assert.Equal("1",m.Sequence));
  var distinct=await Task.WhenAll(Enumerable.Range(0,10).Select(i=>Send(h,i%2==0?a:b,c,new(Guid.NewGuid(),"message "+i))));
  await Task.WhenAll(distinct.Select(Body<MessageDto>));
  var page=await Body<HistoryPage>(await ProfileTests.Send(h,b,HttpMethod.Get,$"/api/conversations/{c}/messages"));
  Assert.Equal(Enumerable.Range(1,11).Select(i=>i.ToString()),page.Items.Select(m=>m.Sequence));
  Assert.Equal(messages[0],await Body<MessageDto>(await Send(h,a,c,request))); // lost response retry
  Assert.Equal(HttpStatusCode.Conflict,(await Send(h,a,c,request with {Text="different"})).StatusCode);
  await h.Db(async db=>{Assert.Equal(11,await db.Set<ChatMessage>().CountAsync());Assert.Equal(11,await db.Set<ChatEvent>().CountAsync());});
 }
 [Fact] public async Task Unauthorized_and_closed_conversations_reject_every_read_send_and_read_cursor() {
  await using var h=await AuthHarness.Create();var a=await MatchingTests.Person(h,"a");var b=await MatchingTests.Person(h,"b");var outsider=await MatchingTests.Person(h,"c");var c=await Pair(h,a,b);
  var m=await Body<MessageDto>(await Send(h,a,c,new(Guid.NewGuid(),"private")));
  foreach(var u in new[]{outsider}) {
   Assert.Equal(HttpStatusCode.NotFound,(await ProfileTests.Send(h,u,HttpMethod.Get,$"/api/conversations/{c}/messages")).StatusCode);
   Assert.Equal(HttpStatusCode.NotFound,(await Send(h,u,c,new(Guid.NewGuid(),"attack"))).StatusCode);
   Assert.Equal(HttpStatusCode.NotFound,(await ProfileTests.Send(h,u,HttpMethod.Post,$"/api/conversations/{c}/read",new ReadMessage(m.Id))).StatusCode);
  }
  await Run<PairLifecycle>(h,s=>s.Block(b.Account.Id,a.Account.Id,default));
  Assert.Equal(HttpStatusCode.NotFound,(await Send(h,a,c,new(m.ClientMessageId,m.Text))).StatusCode);
  Assert.Equal(HttpStatusCode.NotFound,(await ProfileTests.Send(h,a,HttpMethod.Get,$"/api/conversations/{c}/messages")).StatusCode);
  Assert.Equal(HttpStatusCode.NotFound,(await ProfileTests.Send(h,b,HttpMethod.Post,$"/api/conversations/{c}/read",new ReadMessage(m.Id))).StatusCode);
 }
 [Fact] public async Task Read_cursors_are_monotonic_conversation_scoped_and_unread_previews_are_correct() {
  await using var h=await AuthHarness.Create();var a=await MatchingTests.Person(h,"a");var b=await MatchingTests.Person(h,"b");var other=await MatchingTests.Person(h,"c");
  var c=await Pair(h,a,b);var otherC=await Pair(h,a,other);
  var one=await Body<MessageDto>(await Send(h,a,c,new(Guid.NewGuid(),"one")));var two=await Body<MessageDto>(await Send(h,a,c,new(Guid.NewGuid(),"two")));
  var foreign=await Body<MessageDto>(await Send(h,a,otherC,new(Guid.NewGuid(),"elsewhere")));
  var list=await Body<MatchPage>(await ProfileTests.Send(h,b,HttpMethod.Get,"/api/matches"));Assert.Equal(2,list.Items.Single().UnreadCount);Assert.Equal("two",list.Items.Single().LastMessage);
  Assert.Equal(HttpStatusCode.BadRequest,(await ProfileTests.Send(h,b,HttpMethod.Post,$"/api/conversations/{c}/read",new ReadMessage(foreign.Id))).StatusCode);
  var reads=await Task.WhenAll(ProfileTests.Send(h,b,HttpMethod.Post,$"/api/conversations/{c}/read",new ReadMessage(two.Id)),ProfileTests.Send(h,b,HttpMethod.Post,$"/api/conversations/{c}/read",new ReadMessage(one.Id)));
  Assert.All(reads,r=>Assert.Equal(HttpStatusCode.OK,r.StatusCode));
  var page=await Body<HistoryPage>(await ProfileTests.Send(h,a,HttpMethod.Get,$"/api/conversations/{c}/messages"));Assert.Equal("2",page.PeerReadSequence);
  Assert.Equal(0,(await Body<MatchPage>(await ProfileTests.Send(h,b,HttpMethod.Get,"/api/matches"))).Items.Single().UnreadCount);
 }
 [Fact] public async Task History_pagination_and_reconnect_catch_up_have_no_gaps_or_duplicate_timestamps() {
  await using var h=await AuthHarness.Create();var a=await MatchingTests.Person(h,"a");var b=await MatchingTests.Person(h,"b");var c=await Pair(h,a,b);
  // History fixtures only in isolated test DB. Equal timestamps deliberately cannot order these.
  await h.Db(async db=>{var time=DateTimeOffset.UtcNow;for(var i=1;i<=125;i++)db.Add(new ChatMessage{Id=Guid.NewGuid(),ConversationId=c,SenderId=a.Account.Id,ClientMessageId=Guid.NewGuid(),Sequence=i,Text="fixture "+i,SentAt=time});(await db.Set<Conversation>().SingleAsync()).LastSequence=125;await db.SaveChangesAsync();});
  var latest=await Body<HistoryPage>(await ProfileTests.Send(h,b,HttpMethod.Get,$"/api/conversations/{c}/messages"));Assert.Equal(50,latest.Items.Length);Assert.Equal("76",latest.NextBefore);
  var older=await Body<HistoryPage>(await ProfileTests.Send(h,b,HttpMethod.Get,$"/api/conversations/{c}/messages?before={latest.NextBefore}"));Assert.Equal("26",older.NextBefore);Assert.Equal("75",older.Items[^1].Sequence);
  var gap1=await Body<HistoryPage>(await ProfileTests.Send(h,b,HttpMethod.Get,$"/api/conversations/{c}/messages?after=5"));Assert.Equal("55",gap1.NextAfter);
  var gap2=await Body<HistoryPage>(await ProfileTests.Send(h,b,HttpMethod.Get,$"/api/conversations/{c}/messages?after={gap1.NextAfter}"));Assert.Equal("56",gap2.Items[0].Sequence);
  Assert.Equal(HttpStatusCode.BadRequest,(await ProfileTests.Send(h,b,HttpMethod.Get,$"/api/conversations/{c}/messages?before=5&after=1")).StatusCode);
 }
 [Fact] public async Task Message_size_rate_and_transactional_outbox_rollback_are_enforced() {
  await using var h=await AuthHarness.Create();var a=await MatchingTests.Person(h,"a");var b=await MatchingTests.Person(h,"b");var c=await Pair(h,a,b);
  Assert.Equal(HttpStatusCode.BadRequest,(await Send(h,a,c,new(Guid.NewGuid(),new string('x',2001)))).StatusCode);
  Assert.Equal(HttpStatusCode.BadRequest,(await Send(h,a,c,new(Guid.NewGuid(),"  "))).StatusCode);
  await h.Db(db=>db.Database.ExecuteSqlRawAsync("""
   CREATE FUNCTION fail_chat_event() RETURNS trigger LANGUAGE plpgsql AS $$
   BEGIN RAISE EXCEPTION 'test'; END $$;
   CREATE TRIGGER fail_chat BEFORE INSERT ON "ChatEvent" FOR EACH ROW EXECUTE FUNCTION fail_chat_event();
   """));
  var retry=new SendMessage(Guid.NewGuid(),"atomic");
  Assert.Equal(HttpStatusCode.InternalServerError,(await Send(h,a,c,retry)).StatusCode);
  await h.Db(async db=>{Assert.Empty(await db.Set<ChatMessage>().ToListAsync());Assert.Equal(0,(await db.Set<Conversation>().SingleAsync()).LastSequence);
   await db.Database.ExecuteSqlRawAsync("""DROP TRIGGER fail_chat ON "ChatEvent"; DROP FUNCTION fail_chat_event();""");});
  Assert.Equal("1",(await Body<MessageDto>(await Send(h,a,c,retry))).Sequence);
  for(var i=0;i<29;i++)await Body<MessageDto>(await Send(h,a,c,new(Guid.NewGuid(),"bounded")));
  Assert.Equal(HttpStatusCode.TooManyRequests,(await Send(h,a,c,new(Guid.NewGuid(),"over limit"))).StatusCode);
  Assert.Equal("1",(await Body<MessageDto>(await Send(h,a,c,retry))).Sequence); // retry is not a new message
 }
 internal sealed class Wire(AuthHarness h,TokenResponse user,string token) {
  private string Path=>"/hubs/chat?id="+Uri.EscapeDataString(token);
  public async Task<string> Poll() {
   using var timeout=new CancellationTokenSource(TimeSpan.FromSeconds(8));
   using var request=new HttpRequestMessage(HttpMethod.Get,Path);request.Headers.Authorization=new("Bearer",user.AccessToken);
   var response=await h.Client.SendAsync(request,timeout.Token);Assert.Equal(HttpStatusCode.OK,response.StatusCode);return await response.Content.ReadAsStringAsync(timeout.Token);
  }
  public async Task Post(object value) {
   using var request=new HttpRequestMessage(HttpMethod.Post,Path);request.Headers.Authorization=new("Bearer",user.AccessToken);
   request.Content=new StringContent(JsonSerializer.Serialize(value)+"\u001e",Encoding.UTF8,"text/plain");
   Assert.Equal(HttpStatusCode.OK,(await h.Client.SendAsync(request)).StatusCode);
  }
  public async Task<string> Invoke(Guid conversation) {
   await Post(new{type=1,invocationId="1",target="Subscribe",arguments=new[]{conversation}});return await Poll();
  }
  public static async Task<Wire> Open(AuthHarness h,TokenResponse user) {
   var response=await ProfileTests.Send(h,user,HttpMethod.Post,"/hubs/chat/negotiate?negotiateVersion=1",new{});
   var data=await Body<JsonElement>(response);var wire=new Wire(h,user,data.GetProperty("connectionToken").GetString()!);
   await wire.Poll();await wire.Post(new{protocol="json",version=1});await wire.Poll();return wire;
  }
 }
 [Fact] public async Task Actual_SignalR_protocol_denies_unauthorized_subscription_and_delivers_only_authorized_hints() {
  await using var h=await AuthHarness.Create();var a=await MatchingTests.Person(h,"a");var b=await MatchingTests.Person(h,"b");var outsider=await MatchingTests.Person(h,"c");var c=await Pair(h,a,b);
  Assert.Equal(HttpStatusCode.Unauthorized,(await h.Client.PostAsJsonAsync("/hubs/chat/negotiate?negotiateVersion=1",new{})).StatusCode);
  var bad=await Wire.Open(h,outsider);Assert.Contains("conversation_unavailable",await bad.Invoke(c));
  var good=await Wire.Open(h,b);Assert.DoesNotContain("error",await good.Invoke(c));
  await Body<MessageDto>(await Send(h,a,c,new(Guid.NewGuid(),"never in hint")));
  await Run<ChatOutbox>(h,s=>s.Process(default));
  var hint=await good.Poll();Assert.Contains("ConversationChanged",hint);Assert.DoesNotContain("never in hint",hint);
  await Run<PairLifecycle>(h,s=>s.Block(a.Account.Id,b.Account.Id,default));
  Assert.Contains("conversation_unavailable",await good.Invoke(c));
  Assert.Empty(h.Factory.Services.GetRequiredService<ChatConnections>().For(c));
 }
 [Fact] public async Task Send_racing_unmatch_leaves_no_authorized_history_and_revoked_sessions_fail_hub_validation() {
  await using var h=await AuthHarness.Create();var a=await MatchingTests.Person(h,"a");var b=await MatchingTests.Person(h,"b");var c=await Pair(h,a,b);
  var send=Send(h,a,c,new(Guid.NewGuid(),"racing"));await Task.WhenAll(send,Run<PairLifecycle>(h,s=>s.Unmatch(b.Account.Id,a.Account.Id,default)));
  Assert.Contains((await send).StatusCode,new[]{HttpStatusCode.OK,HttpStatusCode.NotFound});
  Assert.Equal(HttpStatusCode.NotFound,(await ProfileTests.Send(h,a,HttpMethod.Get,$"/api/conversations/{c}/messages")).StatusCode);
  await h.Db(async db=>{await db.Sessions.Where(s=>s.UserId==a.Account.Id).ExecuteUpdateAsync(s=>s.SetProperty(x=>x.RevokedAt,DateTimeOffset.UtcNow));});
  Assert.Equal(HttpStatusCode.Unauthorized,(await ProfileTests.Send(h,a,HttpMethod.Post,"/hubs/chat/negotiate?negotiateVersion=1",new{})).StatusCode);
 }

 [Theory]
 [InlineData("block")] [InlineData("revoked")] [InlineData("inactive")] [InlineData("expired")]
 public async Task Stale_connection_membership_cannot_receive_hints_after_authorization_changes(string change) {
  await using var h=await AuthHarness.Create();var a=await MatchingTests.Person(h,"a");var b=await MatchingTests.Person(h,"b");var c=await Pair(h,a,b);
  await Body<MessageDto>(await Send(h,a,c,new(Guid.NewGuid(),"private")));
  Guid session=default;await h.Db(async db=>{session=await db.Sessions.Where(s=>s.UserId==b.Account.Id).Select(s=>s.Id).SingleAsync();});
  var connections=h.Factory.Services.GetRequiredService<ChatConnections>();
  connections.Set(new("stale-connection",b.Account.Id,session,DateTimeOffset.UtcNow.AddMinutes(change=="expired"?-1:5).ToUnixTimeSeconds(),c));
  if(change=="block")await Run<PairLifecycle>(h,s=>s.Block(a.Account.Id,b.Account.Id,default));
  if(change=="revoked")await h.Db(db=>db.Sessions.Where(s=>s.Id==session).ExecuteUpdateAsync(s=>s.SetProperty(x=>x.RevokedAt,DateTimeOffset.UtcNow)));
  if(change=="inactive")await h.Db(db=>db.Users.Where(u=>u.Id==b.Account.Id).ExecuteUpdateAsync(s=>s.SetProperty(u=>u.IsActive,false)));
  await Run<ChatOutbox>(h,s=>s.Process(default));Assert.Empty(connections.For(c));
  await h.Db(async db=>Assert.NotNull((await db.Set<ChatEvent>().Where(e=>e.Kind=="changed").SingleAsync()).ProcessedAt));
 }
}
