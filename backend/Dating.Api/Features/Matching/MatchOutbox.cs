using Dating.Api.Persistence;
using Microsoft.EntityFrameworkCore;
namespace Dating.Api.Features.Matching;
public sealed class MatchOutbox(AppDbContext db,TimeProvider clock) {
 public async Task<int> Process(CancellationToken ct) {
  await using var tx=await db.Database.BeginTransactionAsync(ct);
  var now=clock.GetUtcNow();
  var events=await db.Set<MatchEvent>().FromSqlInterpolated(
   $"""SELECT * FROM "MatchEvent" WHERE "ProcessedAt" IS NULL AND "DeadLetterAt" IS NULL AND "NextAttemptAt" <= {now} ORDER BY "CreatedAt","Id" LIMIT 20 FOR UPDATE SKIP LOCKED""").ToListAsync(ct);
  foreach(var e in events) {
   await tx.CreateSavepointAsync("delivery",ct);
   try {
    var match=await db.Set<DatingMatch>().AsNoTracking().SingleAsync(m=>m.Id==e.MatchId,ct);
    foreach(var user in new[]{match.FirstId,match.SecondId})
     await db.Database.ExecuteSqlInterpolatedAsync($"""
      INSERT INTO "MatchNotice" ("EventId","UserId","MatchId","SeenAt") VALUES ({e.Id},{user},{match.Id},NULL)
      ON CONFLICT ("EventId","UserId") DO NOTHING
      """,ct);
    e.ProcessedAt=clock.GetUtcNow();e.LastErrorCode=null;
   } catch(OperationCanceledException) { throw; }
   catch(Exception) {
    await tx.RollbackToSavepointAsync("delivery",ct);
    // Only bounded safe status codes are persisted, never exception text or private payloads.
    e.Attempts++;e.LastErrorCode="delivery_failed";
    e.NextAttemptAt=clock.GetUtcNow().AddSeconds(Math.Min(300,Math.Pow(2,e.Attempts)));
    if(e.Attempts>=8) e.DeadLetterAt=clock.GetUtcNow();
   }
   db.Entry(e).State=EntityState.Modified;
   await db.SaveChangesAsync(ct);await tx.ReleaseSavepointAsync("delivery",ct);
  }
  await tx.CommitAsync(ct);return events.Count;
 }
}
public sealed class MatchOutboxWorker(IServiceScopeFactory scopes,ILogger<MatchOutboxWorker> log):BackgroundService {
 protected override async Task ExecuteAsync(CancellationToken stoppingToken) {
  var failures=0;
  while(!stoppingToken.IsCancellationRequested) {
   try { using var scope=scopes.CreateScope(); await scope.ServiceProvider.GetRequiredService<MatchOutbox>().Process(stoppingToken);failures=0; }
   catch(OperationCanceledException) when(stoppingToken.IsCancellationRequested) { break; }
   catch(Exception) { failures=Math.Min(6,failures+1);log.LogWarning("Match outbox batch unavailable; retry scheduled."); }
   try { await Task.Delay(TimeSpan.FromSeconds(Math.Min(300,5*Math.Pow(2,failures))),stoppingToken); }
   catch(OperationCanceledException) when(stoppingToken.IsCancellationRequested) { break; }
  }
 }
}
