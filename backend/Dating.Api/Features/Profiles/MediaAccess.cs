using System.Security.Cryptography;
using System.Text.Json;
using Dating.Api.Features.Auth;
using Dating.Api.Persistence;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.EntityFrameworkCore;
namespace Dating.Api.Features.Profiles;
public sealed class MediaAccess(AppDbContext db, IDataProtectionProvider protection, TimeProvider clock, Dating.Api.Features.Discovery.DiscoveryEligibility discovery)
{
    private readonly IDataProtector signer = protection.CreateProtector("DatingMVP.PrivateMedia.v1");
    private sealed record Ticket(Guid Viewer, Guid Photo, DateTimeOffset Expires);
    public async Task<bool> IsModerator(Guid id, CancellationToken ct) =>
        await (from ur in db.UserRoles join r in db.Roles on ur.RoleId equals r.Id
               where ur.UserId == id && r.NormalizedName == "MODERATOR" select ur).AnyAsync(ct);
    public async Task<ProfilePhoto> Authorize(Guid viewer, Guid photoId, CancellationToken ct)
    {
        var photo = await db.Set<ProfilePhoto>().AsNoTracking().Include(p => p.User)
            .SingleOrDefaultAsync(p => p.Id == photoId && !p.Deleted && p.State != "uploading", ct)
            ?? throw new AuthFailure(404, "photo_not_found");
        if (photo.UserId == viewer) return photo;
        if (photo.State == "approved" && await discovery.CanSee(viewer, photo.UserId, ct)) return photo;
        throw new AuthFailure(404, "photo_not_found");
    }
    public async Task<MediaGrant> Grant(Guid viewer, Guid photo, CancellationToken ct)
    {
        await Authorize(viewer, photo, ct);
        var expires = clock.GetUtcNow().AddMinutes(2);
        return new(signer.Protect(JsonSerializer.Serialize(new Ticket(viewer, photo, expires))), expires);
    }
    public async Task<ProfilePhoto> Redeem(Guid viewer, Guid photo, string ticket, CancellationToken ct)
    {
        try
        {
            var value = JsonSerializer.Deserialize<Ticket>(signer.Unprotect(ticket));
            if (value is null || value.Viewer != viewer || value.Photo != photo || value.Expires <= clock.GetUtcNow())
                throw new AuthFailure(404, "photo_not_found");
        }
        catch (Exception ex) when (ex is CryptographicException or JsonException or ArgumentException)
        { throw new AuthFailure(404, "photo_not_found"); }
        return await Authorize(viewer, photo, ct);
    }
}
