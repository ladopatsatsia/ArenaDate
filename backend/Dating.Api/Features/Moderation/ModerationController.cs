using System.Security.Claims;
using System.Text.Json;
using Dating.Api.Features.Auth;
using Dating.Api.Features.Profiles;
using Dating.Api.Features.Safety;
using Dating.Api.Persistence;
using Microsoft.AspNetCore.Antiforgery;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
namespace Dating.Api.Features.Moderation;
[ApiController,Route("api/moderation"),Authorize(Policy="Staff"),AdminCsrf,EnableRateLimiting("profile")]
[ResponseCache(NoStore=true,Location=ResponseCacheLocation.None)]
public sealed class ModerationController(AppDbContext db,ModerationService service,IAntiforgery csrf,IPrivateStorage storage):ControllerBase {
 private Guid Actor=>Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
 [HttpGet("csrf"),AllowAnonymous]
 public async Task<IActionResult> Csrf() {
  var auth=await HttpContext.AuthenticateAsync(AdminSetup.Scheme);HttpContext.User=auth.Succeeded?auth.Principal!:new ClaimsPrincipal(new ClaimsIdentity());
  var tokens=csrf.GetAndStoreTokens(HttpContext);
  Response.Cookies.Append("XSRF-TOKEN",tokens.RequestToken!,new CookieOptions{HttpOnly=false,Secure=true,SameSite=SameSiteMode.Strict,Path="/"});
  return NoContent();
 }
 [HttpPost("login"),AllowAnonymous,EnableRateLimiting("auth"),RequestSizeLimit(2048)]
 public async Task<IActionResult> Login(AdminLogin input,CancellationToken ct){await service.Login(HttpContext,input,ct);return NoContent();}
 [HttpGet("me")] public async Task<AdminIdentity> Me(CancellationToken ct)=>new(Actor,await db.Set<StaffAccount>().Where(s=>s.UserId==Actor).Select(s=>s.Role).SingleAsync(ct));
 [HttpPost("logout")] public async Task<IActionResult> Logout(CancellationToken ct){await service.Logout(Actor,Guid.Parse(User.FindFirstValue("admin_session")!),ct);await HttpContext.SignOutAsync(AdminSetup.Scheme);return NoContent();}
 [HttpGet("photos")] public Task<PhotoReview[]> Photos(Guid? after,CancellationToken ct)=>db.Set<ProfilePhoto>().Where(p=>!p.Deleted && p.State=="pending" && (after==null || p.Id.CompareTo(after.Value)>0)).OrderBy(p=>p.Id).Take(50).Select(p=>new PhotoReview(p.Id,p.UserId,p.CreatedAt)).ToArrayAsync(ct);
 [HttpGet("photos/{id:guid}/content")] public async Task<IActionResult> Photo(Guid id,CancellationToken ct) {
  var photo=await db.Set<ProfilePhoto>().AsNoTracking().SingleOrDefaultAsync(p=>p.Id==id && !p.Deleted && p.State=="pending",ct)??throw new AuthFailure(404,"photo_not_found");
  service.Audit(Actor,id,"photo_view","Pending photo review");await db.SaveChangesAsync(ct);
  Response.Headers["X-Content-Type-Options"]="nosniff";return File(await storage.Get(photo.ObjectKey,ct),"image/jpeg");
 }
 [HttpPost("photos/{id:guid}"),RequestSizeLimit(4096)] public async Task<IActionResult> PhotoReview(Guid id,ReviewRequest input,CancellationToken ct){await service.ReviewPhoto(Actor,id,input,ct);return NoContent();}
 [HttpGet("reports")] public Task<ReportSummary[]> Reports(Guid? after,bool closed,CancellationToken ct) {
  var now=DateTimeOffset.UtcNow;return db.Set<SafetyReport>().Where(r=>r.DeleteAfter>now && (r.ClosedAt!=null)==closed && (after==null || r.Id.CompareTo(after.Value)>0)).OrderBy(r=>r.Id).Take(50).Select(r=>new ReportSummary(r.Id,r.SubjectId,r.Category,r.CreatedAt,r.ClosedAt!=null)).ToArrayAsync(ct);
 }
 [HttpGet("reports/{id:guid}/evidence")] public Task<JsonElement> Evidence(Guid id,CancellationToken ct)=>service.Evidence(Actor,id,ct);
 [HttpPost("reports/{id:guid}"),RequestSizeLimit(4096)] public async Task<IActionResult> Close(Guid id,ReviewRequest input,CancellationToken ct){await service.CloseReport(Actor,id,input,ct);return NoContent();}
 [HttpGet("users/{id:guid}")] public async Task<UserReview> Account(Guid id,CancellationToken ct)=>await (from u in db.Users join p in db.Set<DatingProfile>() on u.Id equals p.UserId into profiles from p in profiles.DefaultIfEmpty() where u.Id==id select new UserReview(u.Id,p==null?"":p.DisplayName,u.IsActive)).SingleOrDefaultAsync(ct)??throw new AuthFailure(404,"user_unavailable");
 [HttpPost("users/{id:guid}"),RequestSizeLimit(4096)] public async Task<IActionResult> Account(Guid id,AccountReview input,CancellationToken ct){await service.Account(Actor,id,input,ct);return NoContent();}
 [HttpGet("audit")] public Task<AuditDto[]> Audit(long? before,CancellationToken ct)=>db.Set<ModerationAudit>().AsNoTracking().Where(a=>before==null || a.Id<before).OrderByDescending(a=>a.Id).Take(50).Select(a=>new AuditDto(a.Id,a.ActorId,a.TargetId,a.Action,a.Reason,a.At)).ToArrayAsync(ct);
}
