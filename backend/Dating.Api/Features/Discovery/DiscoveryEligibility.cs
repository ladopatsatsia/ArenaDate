using Dating.Api.Features.Auth;
using Dating.Api.Features.Profiles;
using Dating.Api.Persistence;
using Microsoft.EntityFrameworkCore;
namespace Dating.Api.Features.Discovery;
public sealed class DiscoveryEligibility(AppDbContext db, TimeProvider clock)
{
    public async Task<DatingProfile?> Viewer(Guid id, CancellationToken ct) =>
        await db.Set<DatingProfile>().AsNoTracking().Include(p => p.User).SingleOrDefaultAsync(p => p.UserId == id, ct);
    public IQueryable<DatingProfile> Candidates(DatingProfile viewer)
    {
        var today = DateOnly.FromDateTime(clock.GetUtcNow().UtcDateTime);
        var minimumDob = today.AddYears(-(viewer.MaxAge + 1));
        var maximumDob = today.AddYears(-viewer.MinAge);
        var oldestAllowed = today.AddYears(-120);
        var myAge = ProfileRules.Age(viewer.User.DateOfBirth, clock.GetUtcNow());
        var q = db.Set<DatingProfile>().AsNoTracking();
        if (!viewer.Visible || !viewer.User.IsActive || !viewer.User.EmailConfirmed || !ProfileRules.Complete(viewer) ||
            !AdultPolicy.IsAdult(viewer.User.DateOfBirth, clock.GetUtcNow())) return q.Where(_ => false);
        q = q.Where(p => p.UserId != viewer.UserId && p.Visible && p.User.IsActive && p.User.EmailConfirmed &&
            p.DisplayName.Length >= 2 && p.Bio.Length >= 10 && p.CityKey != "" && p.Interests.Length > 0 &&
            ProfileRules.Genders.Contains(p.Gender) && ProfileRules.Goals.Contains(p.RelationshipGoal) &&
            p.User.DateOfBirth >= oldestAllowed && p.User.DateOfBirth > minimumDob && p.User.DateOfBirth <= maximumDob &&
            p.MinAge <= myAge && p.MaxAge >= myAge &&
            viewer.DesiredGenders.Contains(p.Gender) && p.DesiredGenders.Contains(viewer.Gender) &&
            db.Set<ProfilePhoto>().Any(f => f.UserId == viewer.UserId && !f.Deleted && f.State != "rejected") &&
            db.Set<ProfilePhoto>().Any(f => f.UserId == p.UserId && !f.Deleted && f.State != "rejected") &&
            !db.Set<UserBlock>().Any(b => (b.BlockerId == viewer.UserId && b.BlockedId == p.UserId) || (b.BlockerId == p.UserId && b.BlockedId == viewer.UserId)) &&
            !db.Set<DiscoveryDecision>().Any(d => d.UserId == viewer.UserId && d.TargetId == p.UserId) &&
            !db.Set<UnmatchedPair>().Any(u => (u.FirstId == viewer.UserId && u.SecondId == p.UserId) || (u.SecondId == viewer.UserId && u.FirstId == p.UserId)));
        if (viewer.LocationMode == "global")
        {
            // Global mode: anywhere in the world!
        }
        else if (viewer.LocationMode == "country" && !string.IsNullOrEmpty(viewer.CityKey))
        {
            if (viewer.CityKey == "GE")
            {
                q = q.Where(p => DiscoveryRules.GeorgianCityKeys.Contains(p.CityKey));
            }
            else
            {
                q = q.Where(p => p.CityKey == viewer.CityKey || p.City.ToUpper().Contains(viewer.CityKey));
            }
        }
        else if (viewer.LocationMode == "all")
        {
            // Local: all of Georgia
            q = q.Where(p => DiscoveryRules.GeorgianCityKeys.Contains(p.CityKey));
        }
        else if (viewer.LocationMode == "city" && !string.IsNullOrEmpty(viewer.CityKey))
        {
            q = q.Where(p => p.CityKey == viewer.CityKey);
        }
        else if (viewer.Location is not null)
        {
            q = q.Where(p => p.Location != null && p.Location.IsWithinDistance(viewer.Location, viewer.RadiusKm * 1000));
        }
        else return q.Where(_ => false);

        q = q.Where(p =>
            viewer.LocationMode == "global" ||
            p.LocationMode == "global" ||
            p.LocationMode == "all" ||
            (p.LocationMode == "country" && (p.CityKey == viewer.CityKey || (viewer.CityKey != null && DiscoveryRules.GeorgianCityKeys.Contains(viewer.CityKey) && p.CityKey == "GE"))) ||
            (p.LocationMode == "city" && (string.IsNullOrEmpty(p.CityKey) || string.IsNullOrEmpty(viewer.CityKey) || p.CityKey == viewer.CityKey)) ||
            (p.LocationMode == "distance" && p.Location != null && viewer.Location != null && p.Location.IsWithinDistance(viewer.Location, p.RadiusKm * 1000)));
        return q;
    }
    public async Task<bool> CanSee(Guid viewerId, Guid targetId, CancellationToken ct)
    {
        var viewer = await Viewer(viewerId, ct);
        return viewer is not null && await Candidates(viewer).AnyAsync(p => p.UserId == targetId, ct);
    }
    // Later swipe handlers must call after acquiring their pair/user locks, not trust a cached card.
    public async Task RequireCurrent(Guid viewerId, Guid targetId, CancellationToken ct)
    { if (!await CanSee(viewerId, targetId, ct)) throw new AuthFailure(404, "profile_unavailable"); }
}
