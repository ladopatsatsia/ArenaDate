using System.Security.Claims;
using System.Text.Json;
using Dating.Api.Features.Auth;
using Dating.Api.Features.Chat;
using Dating.Api.Features.Matching;
using Dating.Api.Features.Notifications;
using Dating.Api.Features.Profiles;
using Dating.Api.Features.Safety;
using Dating.Api.Persistence;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
namespace Dating.Api.Features.Moderation;
public sealed class ModerationService(AppDbContext db,UserManager<AppUser> users,IDataProtectionProvider protection,ChatConnections connections,TimeProvider clock) {
 public void Audit(Guid actor,Guid target,string action,string reason) => db.Add(new ModerationAudit{ActorId=actor,TargetId=target,Action=action,Reason=reason,At=clock.GetUtcNow()});
 private static void Reason(string reason) {if(reason.Trim().Length<3 || reason.Length>500 || reason.Any(char.IsControl))throw new AuthFailure(400,"invalid_reason");}
 public async Task Login(HttpContext context,AdminLogin input,CancellationToken ct) {
  await using var tx=await db.Database.BeginTransactionAsync(ct);
  var normalized=users.NormalizeEmail(input.Email);
  var user=await db.Users.FromSqlInterpolated($"SELECT * FROM \"AspNetUsers\" WHERE \"NormalizedEmail\"={normalized} FOR UPDATE").SingleOrDefaultAsync(ct);
  var staff=user is null?null:await db.Set<StaffAccount>().SingleOrDefaultAsync(s=>s.UserId==user.Id && s.Enabled,ct);
  if(user is null || staff is null || !user.IsActive || !user.EmailConfirmed || staff.Role is not ("Admin" or "Moderator") || await users.IsLockedOutAsync(user))throw new AuthFailure(401,"invalid_admin_login");
  var now=clock.GetUtcNow();
  var codeHash=Convert.ToHexString(System.Security.Cryptography.SHA256.HashData(System.Text.Encoding.UTF8.GetBytes(input.Code)));
  await db.Set<AdminMfaUse>().Where(m=>m.UserId==user.Id && m.At<now.AddMinutes(-4)).ExecuteDeleteAsync(ct);
  if(!await users.CheckPasswordAsync(user,input.Password) || !await users.VerifyTwoFactorTokenAsync(user,TokenOptions.DefaultAuthenticatorProvider,input.Code) || await db.Set<AdminMfaUse>().AnyAsync(m=>m.UserId==user.Id && m.CodeHash==codeHash,ct)) {
   await users.AccessFailedAsync(user);await tx.CommitAsync(ct);throw new AuthFailure(401,"invalid_admin_login");
  }
  await users.ResetAccessFailedCountAsync(user);staff.LastMfaAt=now;
  db.Add(new AdminMfaUse{UserId=user.Id,CodeHash=codeHash,At=now});
  var session=new AdminSession{Id=Guid.NewGuid(),UserId=user.Id,SecurityStamp=user.SecurityStamp!,ExpiresAt=now.AddMinutes(30)};db.Add(session);
  Audit(user.Id,user.Id,"login","Password and authenticator verified");await db.SaveChangesAsync(ct);await tx.CommitAsync(ct);
  await context.SignInAsync(AdminSetup.Scheme,new ClaimsPrincipal(new ClaimsIdentity(new[]{new Claim(ClaimTypes.NameIdentifier,user.Id.ToString()),new Claim("admin_session",session.Id.ToString()),new Claim("mfa","true")},AdminSetup.Scheme)),new AuthenticationProperties{IsPersistent=false,ExpiresUtc=session.ExpiresAt,AllowRefresh=false});
 }
 public async Task Logout(Guid actor,Guid session,CancellationToken ct) {
  await db.Set<AdminSession>().Where(s=>s.Id==session && s.UserId==actor).ExecuteUpdateAsync(s=>s.SetProperty(x=>x.RevokedAt,clock.GetUtcNow()),ct);
  Audit(actor,actor,"logout","Session ended");await db.SaveChangesAsync(ct);
 }
 public async Task ReviewPhoto(Guid actor,Guid id,ReviewRequest input,CancellationToken ct) {
  Reason(input.Reason);if(input.State is not ("approved" or "rejected"))throw new AuthFailure(400,"invalid_state");
  var owner=await db.Set<ProfilePhoto>().Where(p=>p.Id==id && !p.Deleted).Select(p=>(Guid?)p.UserId).SingleOrDefaultAsync(ct)??throw new AuthFailure(404,"photo_not_found");
  await using var tx=await db.Database.BeginTransactionAsync(ct);
  await LockUser(owner,ct);
  var photo=await db.Set<ProfilePhoto>().SingleAsync(p=>p.Id==id,ct);
  if(photo.Deleted || photo.State!="pending")throw new AuthFailure(409,"photo_already_reviewed");
  photo.State=input.State;
  await db.Set<DatingProfile>().Where(p=>p.UserId==owner).ExecuteUpdateAsync(s=>s.SetProperty(p=>p.Revision,p=>p.Revision+1),ct);
  Audit(actor,id,"photo_"+input.State,input.Reason.Trim());await db.SaveChangesAsync(ct);await tx.CommitAsync(ct);
 }
 public async Task<JsonElement> Evidence(Guid actor,Guid id,CancellationToken ct) {
  var now=clock.GetUtcNow();var report=await db.Set<SafetyReport>().AsNoTracking().SingleOrDefaultAsync(r=>r.Id==id && r.DeleteAfter>now,ct)??throw new AuthFailure(404,"report_unavailable");
  var result=JsonSerializer.Deserialize<JsonElement>(protection.CreateProtector("Dating.Safety.Evidence.v1").Unprotect(report.ProtectedEvidence));
  Audit(actor,id,"evidence_view","Report-scoped evidence read");await db.SaveChangesAsync(ct);return result;
 }
 public async Task CloseReport(Guid actor,Guid id,ReviewRequest input,CancellationToken ct) {
  Reason(input.Reason);if(input.State!="closed")throw new AuthFailure(400,"invalid_state");
  await using var tx=await db.Database.BeginTransactionAsync(ct);
  var now=clock.GetUtcNow();var report=await db.Set<SafetyReport>().FromSqlInterpolated($"SELECT * FROM \"SafetyReport\" WHERE \"Id\"={id} FOR UPDATE").SingleOrDefaultAsync(ct);
  if(report is null || report.DeleteAfter<=now)throw new AuthFailure(404,"report_unavailable");
  if(report.ClosedAt is not null)throw new AuthFailure(409,"report_already_closed");
  report.ClosedAt=now;Audit(actor,id,"report_closed",input.Reason.Trim());await db.SaveChangesAsync(ct);await tx.CommitAsync(ct);
 }
 private async Task<AppUser> LockUser(Guid id,CancellationToken ct)=>await db.Users.FromSqlInterpolated($"SELECT * FROM \"AspNetUsers\" WHERE \"Id\"={id} FOR UPDATE").SingleOrDefaultAsync(ct)??throw new AuthFailure(404,"user_unavailable");
 public async Task Account(Guid actor,Guid id,AccountReview input,CancellationToken ct) {
  Reason(input.Reason);
  await using var tx=await db.Database.BeginTransactionAsync(ct);
  var user=await LockUser(id,ct);
  // Staff lifecycle is operator-only, preventing a moderator suspending administrators or themselves.
  if(await db.Set<StaffAccount>().AnyAsync(s=>s.UserId==id,ct))throw new AuthFailure(403,"staff_requires_operator");
  user.IsActive=input.Active;var now=clock.GetUtcNow();
  if(!input.Active) {
   await db.Sessions.Where(s=>s.UserId==id && s.RevokedAt==null).ExecuteUpdateAsync(s=>s.SetProperty(x=>x.RevokedAt,now),ct);
   await db.Set<PushDevice>().Where(d=>d.UserId==id).ExecuteUpdateAsync(s=>s.SetProperty(d=>d.Active,false).SetProperty(d=>d.Ciphertext,""),ct);
  }
  var conversations=await (from c in db.Set<Conversation>() join m in db.Set<DatingMatch>() on c.MatchId equals m.Id where m.FirstId==id || m.SecondId==id select c.Id).ToArrayAsync(ct);
  foreach(var cid in conversations)db.Add(new ChatEvent{Id=Guid.NewGuid(),ConversationId=cid,Kind=input.Active?"changed":"revoked",CreatedAt=now});
  Audit(actor,id,input.Active?"reactivated":"suspended",input.Reason.Trim());await db.SaveChangesAsync(ct);await tx.CommitAsync(ct);
  if(!input.Active)foreach(var cid in conversations)connections.Revoke(cid);
 }
}
