using Dating.Api.Features.Auth;
using Dating.Api.Features.Chat;
using Dating.Api.Features.Matching;
using Dating.Api.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
namespace Dating.Api.Features.Notifications;
public sealed class PushOutbox(AppDbContext db,PairSynchronization pairs,MatchService matches,PushCrypto crypto,IPushProvider provider,IOptions<PushOptions> options,TimeProvider clock){
 public async Task<bool> Process(CancellationToken ct){
  if(!options.Value.Enabled)return false;
  await using var tx=await db.Database.BeginTransactionAsync(ct);var now=clock.GetUtcNow();
  var item=await db.Set<PushDelivery>().FromSqlInterpolated($"""
   SELECT * FROM "PushDelivery" WHERE "FinishedAt" IS NULL AND "DeadLetterAt" IS NULL AND "NextAttemptAt"<={now}
   ORDER BY "CreatedAt","Id" LIMIT 1 FOR UPDATE SKIP LOCKED
   """).SingleOrDefaultAsync(ct);
  if(item is null)return false;
  var pair=await (from c in db.Set<Conversation>() join m in db.Set<DatingMatch>() on c.MatchId equals m.Id where c.Id==item.ConversationId select m).AsNoTracking().SingleOrDefaultAsync(ct);
  bool allowed=false;
  if(pair is not null){
   try{await pairs.Lock(pair.FirstId,pair.SecondId,ct);allowed=await matches.Available(item.UserId).AnyAsync(m=>m.Id==pair.Id,ct);}
   catch(AuthFailure){allowed=false;}
  }
  var device=await db.Set<PushDevice>().FromSqlInterpolated($"""SELECT * FROM "PushDevice" WHERE "Id"={item.DeviceId} FOR UPDATE""").SingleOrDefaultAsync(ct);
  allowed=allowed&&device is not null&&device.Active&&device.UserId==item.UserId&&device.BindingRevision==item.DeviceRevision&&
   device.ProjectId==options.Value.ProjectId&&await db.Sessions.AnyAsync(s=>s.Id==device.SessionId&&s.UserId==item.UserId&&s.RevokedAt==null&&s.ExpiresAt>now,ct)&&
   await db.Set<PushPreference>().AnyAsync(p=>p.UserId==item.UserId&&(item.Kind=="match"?p.Matches:p.Messages),ct);
  if(!allowed||item.CreatedAt<now.AddHours(-24)){
   item.FinishedAt=now;item.LastCode="cancelled";
  }else{
   item.Attempts++;
   try{
    using var timeout=CancellationTokenSource.CreateLinkedTokenSource(ct);timeout.CancelAfter(TimeSpan.FromSeconds(3));
    var result=item.ReceiptId is null?await provider.Send(crypto.Open(device!),item.Id,item.Kind,timeout.Token):await provider.Receipt(item.ReceiptId,timeout.Token);
    item.LastCode=result.Code;
    switch(result.Status){
     case "ticket":item.ReceiptId=result.Ticket;item.NextAttemptAt=now.AddMinutes(15);break;
     case "ok":item.FinishedAt=now;break;
     case "invalid":device!.Active=false;device.Ciphertext="";item.FinishedAt=now;break;
     case "permanent":item.DeadLetterAt=now;break;
     default:if(item.ReceiptId is not null&&result.Code=="provider_rate")item.ReceiptId=null;Retry(item,now);break;
    }
   }catch(OperationCanceledException) when(ct.IsCancellationRequested){throw;}
   catch(Exception){item.LastCode="delivery_unavailable";Retry(item,now);}
  }
  await db.SaveChangesAsync(ct);await tx.CommitAsync(ct);return true;
 }
 private static void Retry(PushDelivery item,DateTimeOffset now){
  item.NextAttemptAt=now.AddSeconds(Math.Min(300,Math.Pow(2,item.Attempts)));
  if(item.Attempts>=8)item.DeadLetterAt=now;
 }
}
public sealed class PushWorker(IServiceScopeFactory scopes,ILogger<PushWorker> log):BackgroundService {
 protected override async Task ExecuteAsync(CancellationToken ct){
  var failures=0;
  while(!ct.IsCancellationRequested){
   try{for(var i=0;i<20;i++){using var scope=scopes.CreateScope();if(!await scope.ServiceProvider.GetRequiredService<PushOutbox>().Process(ct))break;}failures=0;}
   catch(OperationCanceledException) when(ct.IsCancellationRequested){break;}
   catch(Exception){failures=Math.Min(7,failures+1);log.LogWarning("Push delivery unavailable; retry scheduled.");}
   try{await Task.Delay(TimeSpan.FromSeconds(Math.Min(300,2*Math.Pow(2,failures))),ct);}catch(OperationCanceledException) when(ct.IsCancellationRequested){break;}
  }
 }
}
