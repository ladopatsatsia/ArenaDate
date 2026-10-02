using Dating.Api.Features.Auth;
using Dating.Api.Persistence;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
namespace Dating.Api.Features.Chat;
public sealed class ChatOutbox(AppDbContext db,ChatService service,ChatConnections connections,IHubContext<ChatHub> hub,TimeProvider clock) {
 public async Task<bool> Process(CancellationToken ct) {
  await using var tx=await db.Database.BeginTransactionAsync(ct);var now=clock.GetUtcNow();
  var e=await db.Set<ChatEvent>().FromSqlInterpolated(
   $"""SELECT * FROM "ChatEvent" WHERE "ProcessedAt" IS NULL AND "DeadLetterAt" IS NULL AND "NextAttemptAt" <= {now} ORDER BY "CreatedAt","Id" LIMIT 1 FOR UPDATE SKIP LOCKED""").SingleOrDefaultAsync(ct);
  if(e is null) return false;
  await tx.CreateSavepointAsync("delivery",ct);
  try {
   foreach(var subscription in connections.Known(e.ConversationId)) {
    var available=true;
    try { await service.Lock(subscription.User,e.ConversationId,ct); }
    catch(AuthFailure) { available=false;connections.Revoke(e.ConversationId); }
    if(!await service.SessionValid(subscription.User,subscription.Session,subscription.Expiration,ct)) { connections.Remove(subscription.Connection);continue; }
    // Not a group broadcast: current DB authorization is checked for EACH connection.
    // Hints contain no text/sender/sequence; clients catch up from authorized persisted history.
    using var timeout=CancellationTokenSource.CreateLinkedTokenSource(ct);timeout.CancelAfter(TimeSpan.FromSeconds(5));
    await hub.Clients.Client(subscription.Connection).SendAsync(available?"ConversationChanged":"ConversationUnavailable",e.ConversationId,timeout.Token);
   }
   e.ProcessedAt=clock.GetUtcNow();
  } catch(Exception) when(!ct.IsCancellationRequested) {
   await tx.RollbackToSavepointAsync("delivery",ct);e.Attempts++;
   e.NextAttemptAt=clock.GetUtcNow().AddSeconds(Math.Min(300,Math.Pow(2,e.Attempts)));
   if(e.Attempts>=8)e.DeadLetterAt=clock.GetUtcNow();
  }
  await db.SaveChangesAsync(ct);await tx.CommitAsync(ct);return true;
 }
}
public sealed class ChatOutboxWorker(IServiceScopeFactory scopes,ILogger<ChatOutboxWorker> log):BackgroundService {
 protected override async Task ExecuteAsync(CancellationToken ct) {
  var failures=0;
  while(!ct.IsCancellationRequested) {
   try { for(var i=0;i<20;i++) { using var scope=scopes.CreateScope();if(!await scope.ServiceProvider.GetRequiredService<ChatOutbox>().Process(ct))break; } failures=0; }
   catch(OperationCanceledException) when(ct.IsCancellationRequested) { break; }
   catch(Exception) { failures=Math.Min(7,failures+1);log.LogWarning("Chat hint delivery unavailable; retry scheduled."); }
   try { await Task.Delay(TimeSpan.FromSeconds(Math.Min(300,2*Math.Pow(2,failures))),ct); }
   catch(OperationCanceledException) when(ct.IsCancellationRequested) { break; }
  }
 }
}
