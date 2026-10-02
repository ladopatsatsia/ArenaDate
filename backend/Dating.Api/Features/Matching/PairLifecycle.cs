using Dating.Api.Features.Discovery;
using Dating.Api.Features.Profiles;
using Dating.Api.Features.Chat;
using Dating.Api.Persistence;
using Microsoft.EntityFrameworkCore;
namespace Dating.Api.Features.Matching;
public sealed class PairLifecycle(AppDbContext db,PairSynchronization pairs,ChatConnections connections,TimeProvider clock) {
 public Task Block(Guid actor,Guid target,CancellationToken ct)=>Change(actor,target,"block",ct);
 public Task Unmatch(Guid actor,Guid target,CancellationToken ct)=>Change(actor,target,"unmatch",ct);
 private async Task Change(Guid actor,Guid target,string action,CancellationToken ct) {
  await using var tx=await db.Database.BeginTransactionAsync(ct);await pairs.Lock(actor,target,ct);
  var closed=await Apply(actor,target,action,ct);await db.SaveChangesAsync(ct);await tx.CommitAsync(ct);Evict(closed);
 }
 // Caller holds both ordered user row locks until commit.
 public async Task<Guid?> Apply(Guid actor,Guid target,string action,CancellationToken ct) {
  if(db.Database.CurrentTransaction is null)throw new InvalidOperationException("Transaction required.");
  var(first,second)=PairSynchronization.Order(actor,target);
  if(action=="unblock") {await db.Set<UserBlock>().Where(b=>b.BlockerId==actor && b.BlockedId==target).ExecuteDeleteAsync(ct);return null;}
  if(action=="report")return null;
  if(action=="block" && !await db.Set<UserBlock>().AnyAsync(b=>b.BlockerId==actor && b.BlockedId==target,ct))
   db.Add(new UserBlock{BlockerId=actor,BlockedId=target});
  var match=await db.Set<DatingMatch>().SingleOrDefaultAsync(m=>m.FirstId==first && m.SecondId==second,ct);
  if(action=="unmatch") {
   if(match is null)throw new Dating.Api.Features.Auth.AuthFailure(404,"match_unavailable");
   if(!await db.Set<UnmatchedPair>().AnyAsync(p=>p.FirstId==first && p.SecondId==second,ct))db.Add(new UnmatchedPair{FirstId=first,SecondId=second});
  }
  if(match is null || !match.Active)return null;
  match.Active=false;
  var id=await db.Set<Conversation>().Where(c=>c.MatchId==match.Id).Select(c=>c.Id).SingleAsync(ct);
  db.Add(new ChatEvent{Id=Guid.NewGuid(),ConversationId=id,Kind="revoked",CreatedAt=clock.GetUtcNow()});
  return id;
 }
 public void Evict(Guid? conversation){if(conversation is {} id)connections.Revoke(id);}
}
