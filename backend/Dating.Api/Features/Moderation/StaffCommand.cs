using Dating.Api.Features.Auth;
using Dating.Api.Persistence;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
namespace Dating.Api.Features.Moderation;
// Operator-only process branch: never starts HTTP or background workers.
public static class StaffCommand {
 public static async Task Run(IServiceProvider services,string[] args) {
  Console.WriteLine("STAFF_ARGS: [" + string.Join("], [", args) + "]");
  if (args.Length >= 4 && args[1] == "ensure-admin") {
   using var s = services.CreateScope();
   var dbCtx = s.ServiceProvider.GetRequiredService<AppDbContext>();
   var uMgr = s.ServiceProvider.GetRequiredService<UserManager<AppUser>>();
   var email = args[2];
   var pwd = args[3];
   var u = await uMgr.FindByEmailAsync(email);
   if (u is null) {
    u = new AppUser { UserName = email, Email = email, EmailConfirmed = true, IsActive = true, DateOfBirth = new DateOnly(1995, 1, 1) };
    var res = await uMgr.CreateAsync(u, pwd);
    if (!res.Succeeded) throw new InvalidOperationException(string.Join(", ", res.Errors.Select(e => e.Description)));
   } else {
    var token = await uMgr.GeneratePasswordResetTokenAsync(u);
    await uMgr.ResetPasswordAsync(u, token, pwd);
    u.EmailConfirmed = true;
    u.IsActive = true;
    await uMgr.UpdateAsync(u);
   }
   var staffAcct = await dbCtx.Set<StaffAccount>().SingleOrDefaultAsync(sa => sa.UserId == u.Id);
   if (staffAcct is null) {
    staffAcct = new StaffAccount { UserId = u.Id, Role = "Admin", Enabled = true };
    dbCtx.Add(staffAcct);
   } else {
    staffAcct.Role = "Admin";
    staffAcct.Enabled = true;
   }
   await dbCtx.SaveChangesAsync();
   Console.WriteLine($"Admin account successfully configured: {email}");
   return;
  }
  if(args.Length!=4 || args[1] is not ("grant" or "revoke" or "reset-mfa") || args[3] is not ("Admin" or "Moderator"))throw new InvalidOperationException("Usage: staff grant|revoke|reset-mfa <verified-account-id> Admin|Moderator");
  if(!Guid.TryParse(args[2],out var id))throw new InvalidOperationException("Use the verified account UUID.");
  if(Console.IsOutputRedirected && args[1]!="revoke")throw new InvalidOperationException("Authenticator provisioning requires a private interactive terminal, not redirected output.");
  using var scope=services.CreateScope();var db=scope.ServiceProvider.GetRequiredService<AppDbContext>();var users=scope.ServiceProvider.GetRequiredService<UserManager<AppUser>>();
  await using var tx=await db.Database.BeginTransactionAsync();
  var user=await db.Users.FromSqlInterpolated($"SELECT * FROM \"AspNetUsers\" WHERE \"Id\"={id} FOR UPDATE").SingleOrDefaultAsync();
  if(user is null || !user.EmailConfirmed || !user.IsActive)throw new InvalidOperationException("An active, verified account is required.");
  var staff=await db.Set<StaffAccount>().SingleOrDefaultAsync(s=>s.UserId==id);
  if(args[1]=="grant" && staff is {Enabled:true})throw new InvalidOperationException("Already enabled; use reset-mfa explicitly if recovery is required.");
  if(args[1]!="grant" && staff is null)throw new InvalidOperationException("Staff account does not exist.");
  if(staff is null){staff=new StaffAccount{UserId=id};db.Add(staff);}
  staff.Enabled=args[1]!="revoke";if(args[1]=="grant")staff.Role=args[3];staff.LastMfaAt=null;
  await db.Set<AdminSession>().Where(s=>s.UserId==id && s.RevokedAt==null).ExecuteUpdateAsync(s=>s.SetProperty(x=>x.RevokedAt,DateTimeOffset.UtcNow));
  string? key=null;
  if(staff.Enabled){var result=await users.ResetAuthenticatorKeyAsync(user);if(!result.Succeeded)throw new InvalidOperationException("Authenticator setup failed.");key=await users.GetAuthenticatorKeyAsync(user);}
  scope.ServiceProvider.GetRequiredService<ModerationService>().Audit(Guid.Empty,id,"operator_"+args[1],"Local privileged operator command");
  await db.SaveChangesAsync();await tx.CommitAsync();
  Console.WriteLine("Staff operation completed. Operator actor is recorded as the system UUID.");
  if(key is not null)Console.WriteLine("Enter this secret manually in the owner's authenticator (DatingMVP, SHA1, 6 digits, 30 seconds); do not save it in logs: "+key);
 }
}
