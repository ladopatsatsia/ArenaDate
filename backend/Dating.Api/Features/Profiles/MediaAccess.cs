using System.Security.Cryptography;
using System.Text.Json;
using Dating.Api.Features.Auth;
using Dating.Api.Features.Discovery;
using Dating.Api.Features.Matching;
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

        // If either user has blocked the other, media is strictly forbidden
        if (await db.Set<UserBlock>().AnyAsync(b => (b.BlockerId == viewer && b.BlockedId == photo.UserId) || (b.BlockerId == photo.UserId && b.BlockedId == viewer), ct))
            throw new AuthFailure(404, "photo_not_found");

        // If they have unmatched each other, media is forbidden
        if (await db.Set<UnmatchedPair>().AnyAsync(u => (u.FirstId == viewer && u.SecondId == photo.UserId) || (u.SecondId == viewer && u.FirstId == photo.UserId), ct))
            throw new AuthFailure(404, "photo_not_found");

        if (photo.State == "approved")
        {
            // 1. Undecided discovery candidate
            if (await discovery.CanSee(viewer, photo.UserId, ct)) return photo;

            // 2. Confirmed mutual match
            if (await db.Set<DatingMatch>().AnyAsync(m => m.Active && ((m.FirstId == viewer && m.SecondId == photo.UserId) || (m.FirstId == photo.UserId && m.SecondId == viewer)), ct))
                return photo;

            // 3. Incoming suitor (someone who liked the viewer) or game kiss sender
            if (await db.Set<DiscoveryDecision>().AnyAsync(d => d.UserId == photo.UserId && d.TargetId == viewer && d.Kind == "like", ct) ||
                await db.Set<Dating.Api.Features.Game.GameKiss>().AnyAsync(k => k.SenderUserId == photo.UserId && k.RecipientUserId == viewer, ct))
                return photo;

            // 4. Profile view relationship (viewer viewed target or target viewed viewer)
            if (await db.Set<UserProfileView>().AnyAsync(pv => (pv.ViewerUserId == viewer && pv.TargetUserId == photo.UserId) || (pv.ViewerUserId == photo.UserId && pv.TargetUserId == viewer), ct))
                return photo;

            // 5. Active co-members at the same Game table
            var sharedGameRoom = await (
                from m1 in db.Set<Dating.Api.Features.Game.GameMembership>()
                join m2 in db.Set<Dating.Api.Features.Game.GameMembership>() on m1.RoomId equals m2.RoomId
                where m1.UserId == viewer && (m1.Status == Dating.Api.Features.Game.GameMembershipStatus.Active || m1.Status == Dating.Api.Features.Game.GameMembershipStatus.Disconnected)
                   && m2.UserId == photo.UserId && (m2.Status == Dating.Api.Features.Game.GameMembershipStatus.Active || m2.Status == Dating.Api.Features.Game.GameMembershipStatus.Disconnected)
                select m1.RoomId
            ).AnyAsync(ct);
            if (sharedGameRoom) return photo;

            // 6. Game profile unlock
            if (await db.Set<Dating.Api.Features.Game.Wallet.GameProfileUnlock>().AnyAsync(u => u.ViewerUserId == viewer && u.TargetUserId == photo.UserId, ct))
                return photo;

            // 7. Today Plans author (plans published to community feed)
            if (await db.Set<Dating.Api.Features.TodayPlans.TodayPlan>().AnyAsync(p => p.AuthorUserId == photo.UserId, ct))
                return photo;

            // 8. Today Plans applicant or co-participant
            var isPlanParticipant = await (
                from r in db.Set<Dating.Api.Features.TodayPlans.TodayPlanResponse>()
                join p in db.Set<Dating.Api.Features.TodayPlans.TodayPlan>() on r.PlanId equals p.Id
                where (p.AuthorUserId == viewer && r.ApplicantUserId == photo.UserId)
                   || (p.AuthorUserId == photo.UserId && r.ApplicantUserId == viewer)
                select r.Id
            ).AnyAsync(ct);
            if (isPlanParticipant) return photo;
        }

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
