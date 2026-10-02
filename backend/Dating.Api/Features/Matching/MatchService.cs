using Dating.Api.Features.Chat;
using Dating.Api.Features.Auth;
using Dating.Api.Features.Discovery;
using Dating.Api.Features.Profiles;
using Dating.Api.Persistence;
using Microsoft.EntityFrameworkCore;
namespace Dating.Api.Features.Matching;
public sealed class MatchService(AppDbContext db, PairSynchronization pairs, DiscoveryEligibility eligibility, TimeProvider clock,Dating.Api.Features.Notifications.PushQueue push) {
 public IQueryable<DatingMatch> Available(Guid user) => db.Set<DatingMatch>().Where(m => m.Active &&
  (m.FirstId == user || m.SecondId == user) &&
  db.Users.Any(u => u.Id == m.FirstId && u.IsActive && u.EmailConfirmed) &&
  db.Users.Any(u => u.Id == m.SecondId && u.IsActive && u.EmailConfirmed) &&
  !db.Set<UserBlock>().Any(b => (b.BlockerId == m.FirstId && b.BlockedId == m.SecondId) || (b.BlockerId == m.SecondId && b.BlockedId == m.FirstId)) &&
  !db.Set<UnmatchedPair>().Any(p => (p.FirstId == m.FirstId && p.SecondId == m.SecondId) || (p.SecondId == m.FirstId && p.FirstId == m.SecondId)));
 private async Task<SwipeResult> Result(SwipeReceipt receipt, CancellationToken ct) {
  var match = receipt.MatchId is not null && await Available(receipt.UserId).AnyAsync(m => m.Id == receipt.MatchId, ct) ? receipt.MatchId : null;
  return new(receipt.RequestId, receipt.TargetId, receipt.Kind, match);
 }
 public async Task<MatchPage> List(Guid user,Guid? after,CancellationToken ct) {
  var query=Available(user).Where(m=>after==null || m.Id.CompareTo(after.Value)>0);
  var rows=await query.OrderBy(m=>m.Id).Take(21).Select(m=>new {
   m.Id,
   ConversationId=db.Set<Conversation>().Where(c=>c.MatchId==m.Id).Select(c=>c.Id).Single(),
   LastMessage=(from c in db.Set<Conversation>() join message in db.Set<ChatMessage>() on c.Id equals message.ConversationId
     where c.MatchId==m.Id orderby message.Sequence descending select message.Text).FirstOrDefault(),
   Unread=(from c in db.Set<Conversation>() join message in db.Set<ChatMessage>() on c.Id equals message.ConversationId
     where c.MatchId==m.Id && message.SenderId!=user &&
      message.Sequence>(db.Set<ChatRead>().Where(r=>r.ConversationId==c.Id && r.UserId==user).Select(r=>(long?)r.Sequence).SingleOrDefault()??0)
     select message.Id).Count(),
   Profile=db.Set<DatingProfile>().Where(p=>p.UserId==(m.FirstId==user?m.SecondId:m.FirstId))
    .Select(p=>new {p.DisplayName,p.City,p.User.DateOfBirth}).Single()
  }).ToArrayAsync(ct);
  var items=rows.Take(20).Select(r=>new MatchSummary(r.Id,r.Profile.DisplayName,ProfileRules.Age(r.Profile.DateOfBirth,clock.GetUtcNow()),r.Profile.City,r.ConversationId,r.LastMessage==null?null:r.LastMessage.Substring(0,Math.Min(120,r.LastMessage.Length)),r.Unread)).ToArray();
  return new(items,rows.Length>20?items[^1].Id:null);
 }
 public async Task<SwipeResult> Decide(Guid user, SwipeRequest input, CancellationToken ct) {
  if (input.RequestId == Guid.Empty || input.Kind is not ("like" or "pass")) throw new AuthFailure(400,"invalid_decision");
  await using var tx = await db.Database.BeginTransactionAsync(ct);
  await pairs.Lock(user, input.TargetId, ct);
  var receipt = await db.Set<SwipeReceipt>().SingleOrDefaultAsync(r => r.UserId == user && r.RequestId == input.RequestId, ct);
  if (receipt is not null) {
   if (receipt.TargetId != input.TargetId || receipt.Kind != input.Kind) throw new AuthFailure(409,"request_id_reused");
   var replay = await Result(receipt, ct); await tx.CommitAsync(ct); return replay;
  }
  if (await db.Set<DiscoveryDecision>().AnyAsync(d => d.UserId == user && d.TargetId == input.TargetId, ct))
   throw new AuthFailure(409,"decision_final");
  // Includes BOTH people's current preferences, account status, photos, blocks and unmatches.
  await eligibility.RequireCurrent(user, input.TargetId, ct);
  db.Add(new DiscoveryDecision { UserId = user, TargetId = input.TargetId, Kind = input.Kind });
  receipt = new SwipeReceipt { UserId=user, TargetId=input.TargetId, RequestId=input.RequestId, Kind=input.Kind, CreatedAt=clock.GetUtcNow() };
  db.Add(receipt);
  if (input.Kind == "like" && await db.Set<DiscoveryDecision>().AnyAsync(d => d.UserId == input.TargetId && d.TargetId == user && d.Kind == "like", ct)) {
   var (first,second) = PairSynchronization.Order(user,input.TargetId);
   var match = new DatingMatch { Id=Guid.NewGuid(), FirstId=first, SecondId=second, CreatedAt=clock.GetUtcNow() };
   var conversation=new Conversation {Id=Guid.NewGuid(),MatchId=match.Id};var matchEvent=new MatchEvent {Id=Guid.NewGuid(),MatchId=match.Id,CreatedAt=clock.GetUtcNow()};
   db.Add(match);db.Add(conversation);db.Add(matchEvent);
   await push.Enqueue(matchEvent.Id,conversation.Id,first,"match",ct);await push.Enqueue(matchEvent.Id,conversation.Id,second,"match",ct);
   receipt.MatchId=match.Id;
  }
  await db.SaveChangesAsync(ct); await tx.CommitAsync(ct);
  return new(receipt.RequestId,receipt.TargetId,receipt.Kind,receipt.MatchId);
 }
 public async Task<SwipeResult?> Receipt(Guid user, Guid request, CancellationToken ct) {
  var receipt = await db.Set<SwipeReceipt>().AsNoTracking().SingleOrDefaultAsync(r=>r.UserId==user && r.RequestId==request,ct);
  return receipt is null ? null : await Result(receipt,ct);
 }
 public Task<MatchNotification[]> Notices(Guid user,CancellationToken ct) =>
  db.Set<MatchNotice>().Where(n=>n.UserId==user && n.SeenAt==null && Available(user).Any(m=>m.Id==n.MatchId))
   .OrderBy(n=>n.EventId).Take(20).Select(n=>new MatchNotification(n.EventId,n.MatchId)).ToArrayAsync(ct);
 public async Task Acknowledge(Guid user,Guid match,CancellationToken ct) {
  // Acknowledge only caller's records. A receipt may arrive before outbox processing:
  // upsert the same event/user identity so a later delivery cannot resurrect its modal.
  var item = await db.Set<MatchEvent>().Where(e=>e.MatchId==match &&
   db.Set<DatingMatch>().Any(m=>m.Id==match && (m.FirstId==user || m.SecondId==user))).SingleOrDefaultAsync(ct);
  if(item is null) throw new AuthFailure(404,"match_unavailable");
  var now=clock.GetUtcNow();
  await db.Database.ExecuteSqlInterpolatedAsync($"""
   INSERT INTO "MatchNotice" ("EventId","UserId","MatchId","SeenAt") VALUES ({item.Id},{user},{match},{now})
   ON CONFLICT ("EventId","UserId") DO UPDATE SET "SeenAt" = EXCLUDED."SeenAt"
   """,ct);
 }
}
