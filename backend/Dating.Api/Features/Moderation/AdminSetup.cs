using System.Security.Claims;
using Dating.Api.Features.Auth;
using Dating.Api.Persistence;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.EntityFrameworkCore;
namespace Dating.Api.Features.Moderation;
public static class AdminSetup {
 public const string Scheme="AdminCookie";
 public static IServiceCollection AddModeration(this IServiceCollection services) {
  services.AddScoped<ModerationService>();
  services.AddAntiforgery(o=>{o.HeaderName="X-XSRF-TOKEN";o.Cookie.Name="Dating.Admin.Csrf";o.Cookie.SameSite=SameSiteMode.Strict;o.Cookie.SecurePolicy=CookieSecurePolicy.Always;});
  services.AddAuthentication().AddCookie(Scheme,o=>{
   o.Cookie.Name="__Host-DatingAdmin";o.Cookie.HttpOnly=true;o.Cookie.SecurePolicy=CookieSecurePolicy.Always;o.Cookie.SameSite=SameSiteMode.Strict;o.Cookie.Path="/";
   o.ExpireTimeSpan=TimeSpan.FromMinutes(30);o.SlidingExpiration=false;
   o.Events.OnRedirectToLogin=c=>{c.Response.StatusCode=401;return Task.CompletedTask;};
   o.Events.OnRedirectToAccessDenied=c=>{c.Response.StatusCode=403;return Task.CompletedTask;};
   o.Events.OnValidatePrincipal=async c=>{
    var db=c.HttpContext.RequestServices.GetRequiredService<AppDbContext>();var ct=c.HttpContext.RequestAborted;
    if(!Guid.TryParse(c.Principal?.FindFirstValue(ClaimTypes.NameIdentifier),out var uid)||!Guid.TryParse(c.Principal?.FindFirstValue("admin_session"),out var sid)) {c.RejectPrincipal();return;}
    var now=DateTimeOffset.UtcNow;
    var valid=await (from s in db.Set<AdminSession>() join u in db.Users on s.UserId equals u.Id join staff in db.Set<StaffAccount>() on u.Id equals staff.UserId
     where s.Id==sid && s.UserId==uid && s.RevokedAt==null && s.ExpiresAt>now && s.SecurityStamp==u.SecurityStamp && u.IsActive && u.EmailConfirmed && staff.Enabled && (staff.Role=="Admin" || staff.Role=="Moderator") select s).AnyAsync(ct);
    if(!valid)c.RejectPrincipal();
   };
  });
  services.AddAuthorizationBuilder().AddPolicy("Staff",p=>p.AddAuthenticationSchemes(Scheme).RequireAuthenticatedUser().RequireClaim("mfa","true"));
  return services;
 }
}
