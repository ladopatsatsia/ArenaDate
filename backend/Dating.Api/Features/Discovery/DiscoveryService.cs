using System.Security.Cryptography;
using System.Text.Json;
using Dating.Api.Features.Auth;
using Dating.Api.Features.Profiles;
using Dating.Api.Persistence;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.EntityFrameworkCore;
namespace Dating.Api.Features.Discovery;
public sealed class DiscoveryService(AppDbContext db, ProfileService profiles, DiscoveryEligibility eligibility, IDataProtectionProvider protection, TimeProvider clock)
{
    private readonly IDataProtector cursors = protection.CreateProtector("DatingMVP.DiscoveryCursor.v1");
    private sealed record Cursor(Guid Viewer, long Revision, long Last, DateOnly Date, DateTimeOffset Expires);
    public async Task<DiscoverySettings> Settings(Guid id, CancellationToken ct)
    {
        var p = await db.Set<DatingProfile>().AsNoTracking().SingleOrDefaultAsync(p => p.UserId == id, ct);
        return p is null ? new(0,18,99,[],25,"city","",false) : Dto(p);
    }
    private static DiscoverySettings Dto(DatingProfile p) => new(p.Revision, p.MinAge, p.MaxAge, p.DesiredGenders, p.RadiusKm, p.LocationMode, p.City, p.Location is not null);
    public async Task<DiscoverySettings> Save(Guid id, SettingsRequest request, CancellationToken ct)
    {
        if (request.City.Trim().Length < 2 || request.MinAge > request.MaxAge || !DiscoveryRules.Radii.Contains(request.RadiusKm) || request.Mode is not ("city" or "distance" or "all") ||
            request.DesiredGenders.Any(g => !ProfileRules.Genders.Contains(g)) || request.DesiredGenders.Distinct().Count() != request.DesiredGenders.Length)
            throw new AuthFailure(400, "invalid_preferences");
        await using var tx = await db.Database.BeginTransactionAsync(ct);
        var p = await profiles.Lock(id, ct);
        if (p.Revision != request.Revision) throw new AuthFailure(409, "profile_changed");
        if (request.Mode == "distance" && p.Location is null) throw new AuthFailure(400, "location_required");
        p.MinAge = request.MinAge; p.MaxAge = request.MaxAge; p.DesiredGenders = request.DesiredGenders;
        p.City = request.City.Trim(); p.CityKey = DiscoveryRules.CityKey(p.City);
        p.RadiusKm = request.RadiusKm; p.LocationMode = request.Mode; p.Revision++;
        await db.SaveChangesAsync(ct); await tx.CommitAsync(ct); return Dto(p);
    }
    public async Task<DiscoverySettings> Location(Guid id, LocationRequest request, CancellationToken ct)
    {
        if (!request.Consent) throw new AuthFailure(400, "location_consent_required");
        var point = DiscoveryRules.Coarsen(request.Latitude, request.Longitude);
        await using var tx = await db.Database.BeginTransactionAsync(ct);
        var p = await profiles.Lock(id, ct); p.Location = point; p.Revision++;
        await db.SaveChangesAsync(ct); await tx.CommitAsync(ct); return Dto(p);
    }
    public async Task<DiscoverySettings> ClearLocation(Guid id, CancellationToken ct)
    {
        await using var tx = await db.Database.BeginTransactionAsync(ct);
        var p = await profiles.Lock(id, ct); p.Location = null; p.LocationMode = "city"; p.Revision++;
        await db.SaveChangesAsync(ct); await tx.CommitAsync(ct); return Dto(p);
    }
    public async Task<DiscoveryPage> Page(Guid id, string? cursor, CancellationToken ct, Guid? only = null)
    {
        var viewer = await eligibility.Viewer(id, ct);
        if (viewer is null) return new([], null);
        long last = 0;
        var today = DateOnly.FromDateTime(clock.GetUtcNow().UtcDateTime);
        if (cursor is not null)
        {
            try
            {
                var value = JsonSerializer.Deserialize<Cursor>(cursors.Unprotect(cursor));
                if (value is null || value.Viewer != id || value.Revision != viewer.Revision || value.Date != today || value.Expires <= clock.GetUtcNow() || value.Last < 0)
                    throw new AuthFailure(409, "discovery_changed");
                last = value.Last;
            }
            catch (Exception ex) when (ex is CryptographicException or JsonException or ArgumentException)
            { throw new AuthFailure(400, "invalid_cursor"); }
        }
        var q = eligibility.Candidates(viewer).Where(p => p.DiscoverySequence > last);
        if (only is not null) q = q.Where(p => p.UserId == only.Value);
        var rows = await q.OrderBy(p => p.DiscoverySequence).Take(21).Select(p => new {
            p.UserId, p.DiscoverySequence, p.DisplayName, p.User.DateOfBirth, p.Bio, p.Gender, p.City, p.Interests, p.Languages, p.RelationshipGoal,
            Distance = viewer.LocationMode == "distance" && p.LocationMode == "distance" && p.Location != null && viewer.Location != null
                ? (double?)p.Location.Distance(viewer.Location) : null
        }).ToListAsync(ct);
        var page = rows.Take(20).ToArray(); var ids = page.Select(p => p.UserId).ToArray();
        // One bounded batch for all page photos, not one query per card.
        var photos = await db.Set<ProfilePhoto>().AsNoTracking().Where(p => ids.Contains(p.UserId) && !p.Deleted && p.State == "approved")
            .OrderBy(p => p.Position).Select(p => new { p.UserId, Photo = new PhotoDto(p.Id, p.State, p.Position, p.Width, p.Height) }).ToListAsync(ct);
        var items = page.Select(p => new DiscoveryCard(p.UserId, p.DisplayName, ProfileRules.Age(p.DateOfBirth, clock.GetUtcNow()), p.Bio, p.Gender,
            p.City, p.Interests, p.RelationshipGoal, DiscoveryRules.Bucket(p.Distance), photos.Where(f => f.UserId == p.UserId).Select(f => f.Photo).ToArray(), p.Languages)).ToArray();
        var next = rows.Count > 20 ? cursors.Protect(JsonSerializer.Serialize(new Cursor(id, viewer.Revision, page[^1].DiscoverySequence, today, clock.GetUtcNow().AddMinutes(15)))) : null;
        return new(items, next);
    }
}
