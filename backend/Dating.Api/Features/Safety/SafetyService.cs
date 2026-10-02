using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Dating.Api.Features.Auth;
using Dating.Api.Features.Chat;
using Dating.Api.Features.Discovery;
using Dating.Api.Features.Matching;
using Dating.Api.Features.Profiles;
using Dating.Api.Persistence;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.EntityFrameworkCore;
namespace Dating.Api.Features.Safety;
public sealed class SafetyService(AppDbContext db,PairSynchronization pairs,PairLifecycle lifecycle,DiscoveryEligibility eligibility,IDataProtectionProvider protection,TimeProvider clock) {
 public async Task Execute(Guid actor,SafetyRequest input,CancellationToken ct) {
  if(input.RequestId==Guid.Empty || input.Action is not ("block" or "unblock" or "unmatch" or "report") ||
   (input.Action=="report" && input.Report is null) || (input.Action=="unblock" && input.Report is not null))
   throw new AuthFailure(400,"invalid_safety_request");
  if(input.Report is {} r && (r.Kind is not ("profile" or "message") || r.Category is not ("harassment" or "spam" or "impersonation" or "underage" or "sexual_content" or "other") ||
    r.Description.Length>1000 || r.Description.Contains('\0') || (r.Kind=="profile" && r.MessageId is not null)))
   throw new AuthFailure(400,"invalid_report");
  var fingerprint=Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(JsonSerializer.Serialize(input))));
  await using var tx=await db.Database.BeginTransactionAsync(ct);
  var prior= input.ConversationId is {} conversation ? await (from c in db.Set<Conversation>() join m in db.Set<DatingMatch>() on c.MatchId equals m.Id
   where c.Id==conversation && (m.FirstId==actor || m.SecondId==actor) select m).AsNoTracking().SingleOrDefaultAsync(ct) : null;
  if(input.ConversationId is not null && prior is null) throw new AuthFailure(404,"conversation_unavailable");
  var target=prior is null?input.TargetId??Guid.Empty:prior.FirstId==actor?prior.SecondId:prior.FirstId;
  if(input.TargetId is {} supplied && supplied!=target) throw new AuthFailure(400,"invalid_target");
  await pairs.Lock(actor,target,ct);
  if(!await db.Users.AnyAsync(u=>u.Id==actor && u.IsActive && u.EmailConfirmed,ct))throw new AuthFailure(401,"invalid_session");
  var receipt=await db.Set<SafetyReceipt>().SingleOrDefaultAsync(r=>r.ActorId==actor && r.RequestId==input.RequestId,ct);
  if(receipt is not null) {
   if(receipt.Fingerprint!=fingerprint)throw new AuthFailure(409,"request_id_reused");
   await tx.CommitAsync(ct);return;
  }
  var (first,second)=PairSynchronization.Order(actor,target);
  var known=prior is not null || await db.Set<DatingMatch>().AnyAsync(m=>m.FirstId==first && m.SecondId==second,ct);
  var interacted=known || await db.Set<DiscoveryDecision>().AnyAsync(d=>d.UserId==actor && d.TargetId==target,ct);
  var ownBlock=await db.Set<UserBlock>().AnyAsync(b=>b.BlockerId==actor && b.BlockedId==target,ct);
  if(input.Action=="unmatch" && !known)throw new AuthFailure(404,"match_unavailable");
  if(input.Action!="unblock" && !interacted && !ownBlock && !await eligibility.CanSee(actor,target,ct))throw new AuthFailure(404,"profile_unavailable");
  if(input.Report is {} report) {
   var now=clock.GetUtcNow();
   if(await db.Set<SafetyReport>().CountAsync(r=>r.ReporterId==actor && r.CreatedAt>now.AddDays(-1),ct)>=5)throw new AuthFailure(429,"report_rate_limited");
   object evidence;
   if(report.Kind=="message") {
    if(input.ConversationId is null)throw new AuthFailure(400,"conversation_required");
    var query=db.Set<ChatMessage>().AsNoTracking().Where(m=>m.ConversationId==input.ConversationId && m.SenderId==target);
    if(report.MessageId is {} message)query=query.Where(m=>m.Id==message);
    var messages=await query.OrderByDescending(m=>m.Sequence).Take(report.MessageId is null?5:1).Select(m=>new {m.Id,m.Text,m.SentAt,m.Sequence}).ToArrayAsync(ct);
    if(messages.Length==0)throw new AuthFailure(404,"evidence_unavailable");
    evidence=new {ConversationId=input.ConversationId,Messages=messages};
   } else {
    evidence=await db.Set<DatingProfile>().Where(p=>p.UserId==target).Select(p=>new {p.DisplayName,p.Bio,p.City,p.Gender,p.RelationshipGoal,p.Interests,
     PhotoIds=db.Set<ProfilePhoto>().Where(f=>f.UserId==target && !f.Deleted && f.State=="approved").OrderBy(f=>f.Position).Select(f=>f.Id).ToArray()}).SingleOrDefaultAsync(ct)
     ?? throw new AuthFailure(404,"evidence_unavailable");
   }
   db.Add(new SafetyReport {Id=Guid.NewGuid(),ReporterId=actor,SubjectId=target,Category=report.Category,CreatedAt=now,DeleteAfter=now.AddDays(180),
    ProtectedEvidence=protection.CreateProtector("Dating.Safety.Evidence.v1").Protect(JsonSerializer.Serialize(new {report.Kind,report.Description,Evidence=evidence}))});
  }
  var closed=await lifecycle.Apply(actor,target,input.Action,ct);
  db.Add(new SafetyReceipt{ActorId=actor,RequestId=input.RequestId,Fingerprint=fingerprint,CreatedAt=clock.GetUtcNow()});
  await db.SaveChangesAsync(ct);await tx.CommitAsync(ct);lifecycle.Evict(closed);
 }
 public async Task<SafetyPage> List(Guid actor,bool blocked,Guid? cursor,CancellationToken ct) {
  var query=blocked?db.Set<UserBlock>().Where(b=>b.BlockerId==actor).Select(b=>new {Id=b.BlockedId,CreatedAt=(DateTimeOffset?)null}):
   from c in db.Set<Conversation>() join m in db.Set<DatingMatch>() on c.MatchId equals m.Id
   where !m.Active && (m.FirstId==actor || m.SecondId==actor) select new {Id=c.Id,CreatedAt=(DateTimeOffset?)m.CreatedAt};
  if(cursor is {} after)query=query.Where(x=>x.Id.CompareTo(after)>0);
  var rows=await query.OrderBy(x=>x.Id).Take(21).ToArrayAsync(ct);
  return new(rows.Take(20).Select(x=>new SafetyItem(x.Id,x.CreatedAt)).ToArray(),rows.Length>20?rows[19].Id:null);
 }
 public async Task Purge(CancellationToken ct) {
  var now=clock.GetUtcNow();
  await db.Set<SafetyReport>().Where(r=>r.DeleteAfter<=now).OrderBy(r=>r.DeleteAfter).Take(500).ExecuteDeleteAsync(ct);
  await db.Set<SafetyReceipt>().Where(r=>r.CreatedAt<now.AddDays(-365)).OrderBy(r=>r.CreatedAt).Take(500).ExecuteDeleteAsync(ct);
 }
}
public sealed class SafetyCleanup(IServiceScopeFactory scopes,ILogger<SafetyCleanup> log):BackgroundService {
 protected override async Task ExecuteAsync(CancellationToken ct) {
  while(!ct.IsCancellationRequested) {
   try {using var scope=scopes.CreateScope();await scope.ServiceProvider.GetRequiredService<SafetyService>().Purge(ct);}
   catch(OperationCanceledException) when(ct.IsCancellationRequested){break;}
   catch(Exception){log.LogWarning("Safety retention cleanup unavailable; retry scheduled.");}
   try {await Task.Delay(TimeSpan.FromMinutes(10),ct);}catch(OperationCanceledException) when(ct.IsCancellationRequested){break;}
  }
 }
}
