using System.Text.RegularExpressions;
using Dating.Api.Features.Auth;
using Dating.Api.Features.Chat;
using Dating.Api.Features.Matching;
using Dating.Api.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
namespace Dating.Api.Features.Notifications;
public sealed class PushService(AppDbContext db,PairSynchronization pairs,PushCrypto crypto,IOptions<PushOptions> options,TimeProvider clock){
 private async Task LockUser(Guid user,CancellationToken ct){
  var row=await db.Users.FromSqlInterpolated($"""SELECT * FROM "AspNetUsers" WHERE "Id"={user} FOR UPDATE""").SingleOrDefaultAsync(ct);
  if(row is null||!row.IsActive||!row.EmailConfirmed)throw new AuthFailure(401,"invalid_session");
 }
 public PushConfiguration Configuration()=>new(options.Value.Enabled,options.Value.Enabled?options.Value.ProjectId:null);
 public async Task Register(Guid actor,Guid session,DeviceRequest input,CancellationToken ct){
  var o=options.Value;if(!o.Enabled)throw new AuthFailure(503,"push_not_configured");
  if(input.InstallationId==Guid.Empty||input.Revision<=0||!Regex.IsMatch(input.Secret,"\\A[0-9a-f]{64}\\z")||
   input.Provider!="expo"||!Guid.TryParse(input.ProjectId,out var project)||project!=Guid.Parse(o.ProjectId)||input.Platform is not ("ios" or "android")||
   (input.Enabled&&(input.Token is null||!Regex.IsMatch(input.Token,"\\A(?:Expo|Exponent)PushToken\\[[A-Za-z0-9_-]{10,200}\\]\\z"))))
   throw new AuthFailure(400,"invalid_push_registration");
  await using var tx=await db.Database.BeginTransactionAsync(ct);
  // Serialize installation/token ownership changes before ordered user locks. Delivery never takes this advisory lock.
  await db.Database.ExecuteSqlRawAsync("SELECT pg_advisory_xact_lock(8012026)",ct);
  var existing=await db.Set<PushDevice>().AsNoTracking().SingleOrDefaultAsync(d=>d.Id==input.InstallationId,ct);
  if(existing is not null&&existing.UserId!=actor)await pairs.Lock(existing.UserId,actor,ct);else await LockUser(actor,ct);
  if(!await db.Sessions.AnyAsync(s=>s.Id==session&&s.UserId==actor&&s.RevokedAt==null&&s.ExpiresAt>clock.GetUtcNow()&&s.User.IsActive&&s.User.EmailConfirmed,ct))
   throw new AuthFailure(401,"invalid_session");
  var secret=PushCrypto.Hash(input.Secret);var hash=input.Token is null?"":PushCrypto.Hash(input.Token);
  if(existing is not null){
   if(!PushCrypto.SameHash(existing.SecretHash,secret))throw new AuthFailure(409,"installation_conflict");
   if(input.Revision<existing.Revision)throw new AuthFailure(409,"installation_stale");
   if(input.Revision==existing.Revision){
    if(existing.UserId!=actor||existing.SessionId!=session||existing.Active!=input.Enabled||(input.Enabled&&existing.TokenHash!=hash)||existing.Platform!=input.Platform||existing.ProjectId!=o.ProjectId)
     throw new AuthFailure(409,"installation_stale");
    await tx.CommitAsync(ct);return;
   }
  }
  if(input.Enabled&&await db.Set<PushDevice>().AnyAsync(d=>d.Id!=input.InstallationId&&d.TokenHash==hash,ct))throw new AuthFailure(409,"installation_conflict");
  if(input.Enabled&&await db.Set<PushDevice>().CountAsync(d=>d.UserId==actor&&d.Id!=input.InstallationId&&d.Active,ct)>=10)throw new AuthFailure(429,"device_limit");
  var changed=existing is null||existing.ProjectId!=o.ProjectId||existing.Platform!=input.Platform||existing.UserId!=actor||existing.SessionId!=session||existing.Active!=input.Enabled||(input.Enabled&&existing.TokenHash!=hash);
  var device=existing??new PushDevice{Id=input.InstallationId,SecretHash=secret};
  if(existing is null)db.Add(device);else db.Update(device);
  if(changed)device.BindingRevision=input.Revision;
  device.UserId=actor;device.SessionId=session;device.Revision=input.Revision;device.Active=input.Enabled;
  device.Platform=input.Platform;device.ProjectId=o.ProjectId;device.UpdatedAt=clock.GetUtcNow();
  if(input.Enabled){var encrypted=crypto.Seal(device.Id,input.Token!);device.KeyId=encrypted.KeyId;device.Ciphertext=encrypted.Ciphertext;device.TokenHash=hash;}
  else device.Ciphertext="";
  await db.SaveChangesAsync(ct);await tx.CommitAsync(ct);
 }
 public async Task<PushPreferences> Preferences(Guid user,CancellationToken ct){
  var p=await db.Set<PushPreference>().AsNoTracking().SingleOrDefaultAsync(p=>p.UserId==user,ct);return new(p?.Matches??false,p?.Messages??false);
 }
 public async Task SetPreferences(Guid user,PushPreferences input,CancellationToken ct){
  await using var tx=await db.Database.BeginTransactionAsync(ct);await LockUser(user,ct);
  var row=await db.Set<PushPreference>().SingleOrDefaultAsync(p=>p.UserId==user,ct);
  if(row is null){row=new PushPreference{UserId=user};db.Add(row);}row.Matches=input.Matches;row.Messages=input.Messages;
  await db.SaveChangesAsync(ct);await tx.CommitAsync(ct);
 }
 public async Task<NotificationTarget> Resolve(Guid actor,Guid notification,ChatService chat,CancellationToken ct){
  var row=await db.Set<PushDelivery>().AsNoTracking().SingleOrDefaultAsync(d=>d.Id==notification&&d.UserId==actor,ct)
   ??throw new AuthFailure(404,"notification_unavailable");
  await using var tx=await db.Database.BeginTransactionAsync(ct);await chat.Lock(actor,row.ConversationId,ct);await tx.CommitAsync(ct);
  return new(row.ConversationId);
 }
}
public sealed class PushQueue(AppDbContext db,TimeProvider clock,IOptions<PushOptions> options){
 // Called within the authoritative match/message transaction with both participant locks held.
 public async Task Enqueue(Guid eventId,Guid conversation,Guid recipient,string kind,CancellationToken ct){
  if(db.Database.CurrentTransaction is null)throw new InvalidOperationException("Transaction required.");
  if(!options.Value.Enabled)return;
  var devices=await db.Set<PushDevice>().Where(d=>d.UserId==recipient&&d.Active&&
   db.Set<PushPreference>().Any(p=>p.UserId==recipient&&(kind=="match"?p.Matches:p.Messages))&&
   db.Sessions.Any(s=>s.Id==d.SessionId&&s.RevokedAt==null&&s.ExpiresAt>clock.GetUtcNow())).ToArrayAsync(ct);
  foreach(var device in devices)db.Add(new PushDelivery{Id=Guid.NewGuid(),EventId=eventId,DeviceId=device.Id,DeviceRevision=device.BindingRevision,
   UserId=recipient,ConversationId=conversation,Kind=kind,CreatedAt=clock.GetUtcNow(),NextAttemptAt=clock.GetUtcNow()});
 }
}
