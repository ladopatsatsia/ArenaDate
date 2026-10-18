using Dating.Api.Features.Auth;
using Dating.Api.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
namespace Dating.Api.Features.Profiles;
public sealed class ProfileService(AppDbContext db, IPrivateStorage storage, PhotoProcessor processor, IOptions<MediaOptions> media, TimeProvider clock)
{
    public async Task<DatingProfile> Lock(Guid id, CancellationToken ct)
    {
        var user = await db.Users.FromSqlInterpolated($"SELECT * FROM \"AspNetUsers\" WHERE \"Id\" = {id} FOR UPDATE").SingleOrDefaultAsync(ct);
        if (user is null || !user.IsActive || !user.EmailConfirmed) throw new AuthFailure(401, "invalid_credentials");
        var p = await db.Set<DatingProfile>().SingleOrDefaultAsync(p => p.UserId == id, ct);
        if (p is null) { p = new DatingProfile { UserId = id, User = user }; db.Add(p); }
        return p;
    }
    public async Task<OwnProfileDto> Get(Guid id, CancellationToken ct)
    {
        var user = await db.Users.AsNoTracking().SingleAsync(u => u.Id == id, ct);
        var p = await db.Set<DatingProfile>().AsNoTracking().SingleOrDefaultAsync(p => p.UserId == id, ct) ?? new DatingProfile { UserId = id };
        var photos = await db.Set<ProfilePhoto>().AsNoTracking().Where(p => p.UserId == id && !p.Deleted).OrderBy(p => p.Position)
            .Select(p => new PhotoDto(p.Id, p.State, p.Position, p.Width, p.Height)).ToArrayAsync(ct);
        return new(p.Revision, p.DisplayName, ProfileRules.Age(user.DateOfBirth, clock.GetUtcNow()), p.Bio, p.Gender,
            p.DesiredGenders, p.City, p.Interests, p.RelationshipGoal, p.Visible, ProfileRules.Complete(p), photos, p.Languages);
    }
    public async Task<OwnProfileDto> Save(Guid id, ProfileUpdate request, CancellationToken ct)
    {
        ProfileRules.Validate(request);
        await using var tx = await db.Database.BeginTransactionAsync(ct);
        var p = await Lock(id, ct);
        if (p.Revision != request.Revision) throw new AuthFailure(409, "profile_changed");
        p.DisplayName = request.DisplayName.Trim();
        p.Bio = (request.Bio ?? "").Trim();
        p.Gender = request.Gender;
        p.DesiredGenders = request.DesiredGenders ?? [];
        p.City = (request.City ?? "").Trim();
        p.CityKey = Dating.Api.Features.Discovery.DiscoveryRules.CityKey(p.City);
        p.Interests = request.Interests ?? [];
        p.Languages = request.Languages ?? [];
        p.RelationshipGoal = request.RelationshipGoal ?? "";
        p.Visible = request.Visible;
        if (request.DateOfBirth.HasValue)
        {
            if (!AdultPolicy.IsAdult(request.DateOfBirth.Value, clock.GetUtcNow()))
                throw new AuthFailure(400, "adult_required");
            p.User.DateOfBirth = request.DateOfBirth.Value;
        }
        p.Revision++;
        await db.SaveChangesAsync(ct); await tx.CommitAsync(ct);
        return await Get(id, ct);
    }
    public async Task<PhotoDto> Begin(Guid id, Guid requestId, CancellationToken ct)
    {
        if (requestId == Guid.Empty) throw new AuthFailure(400, "invalid_request");
        await using var tx = await db.Database.BeginTransactionAsync(ct);
        var p = await Lock(id, ct);
        var photos = db.Set<ProfilePhoto>();
        var existing = await photos.SingleOrDefaultAsync(p => p.UserId == id && p.RequestId == requestId, ct);
        if (existing is not null)
        { if (existing.Deleted) throw new AuthFailure(410, "upload_expired"); return Dto(existing); }
        var count = await photos.CountAsync(p => p.UserId == id && !p.Deleted, ct);
        if (count >= 6) throw new AuthFailure(400, "photo_limit");
        var photo = new ProfilePhoto { Id = Guid.NewGuid(), UserId = id, RequestId = requestId,
            ObjectKey = Guid.NewGuid().ToString("N") + ".jpg", ThumbnailKey = Guid.NewGuid().ToString("N") + ".jpg",
            CreatedAt = clock.GetUtcNow(), Position = count };
        photos.Add(photo); p.Revision++;
        await db.SaveChangesAsync(ct); await tx.CommitAsync(ct); return Dto(photo);
    }
    public async Task<PhotoDto> Finalize(Guid id, Guid photoId, byte[] bytes, CancellationToken ct)
    {
        await using var tx = await db.Database.BeginTransactionAsync(ct);
        var p = await Lock(id, ct);
        var photo = await db.Set<ProfilePhoto>().SingleOrDefaultAsync(p => p.Id == photoId && p.UserId == id && !p.Deleted, ct)
            ?? throw new AuthFailure(404, "photo_not_found");
        if (photo.State != "uploading") return Dto(photo);
        if (photo.CreatedAt.AddHours(1) <= clock.GetUtcNow()) throw new AuthFailure(410, "upload_expired");
        var output = await processor.Process(bytes, ct);
        // Keys were committed by Begin before object writes. Interrupted writes remain reachable by cleanup.
        await storage.Put(photo.ObjectKey, output.Image, ct);
        await storage.Put(photo.ThumbnailKey, output.Thumbnail, ct);
        photo.Width = output.Width; photo.Height = output.Height;
        photo.State = media.Value.AutoApprove ? "approved" : "pending"; p.Revision++;
        await db.SaveChangesAsync(ct); await tx.CommitAsync(ct); return Dto(photo);
    }
    public async Task<OwnProfileDto> Reorder(Guid id, ReorderRequest request, CancellationToken ct)
    {
        await using var tx = await db.Database.BeginTransactionAsync(ct);
        var p = await Lock(id, ct);
        if (p.Revision != request.Revision) throw new AuthFailure(409, "profile_changed");
        var photos = await db.Set<ProfilePhoto>().Where(p => p.UserId == id && !p.Deleted).ToListAsync(ct);
        if (request.PhotoIds.Length != photos.Count || request.PhotoIds.Distinct().Count() != photos.Count ||
            photos.Any(p => !request.PhotoIds.Contains(p.Id))) throw new AuthFailure(400, "invalid_photo_order");
        await SetOrder(id, request.PhotoIds.Select(photoId => photos.Single(p => p.Id == photoId)).ToList(), ct);
        p.Revision++; await db.SaveChangesAsync(ct); await tx.CommitAsync(ct); return await Get(id, ct);
    }
    public async Task SetOrder(Guid id, List<ProfilePhoto> photos, CancellationToken ct)
    {
        await db.Set<ProfilePhoto>().Where(p => p.UserId == id && !p.Deleted).ExecuteUpdateAsync(s => s.SetProperty(p => p.Position, p => -p.Position - 1), ct);
        for (var i = 0; i < photos.Count; i++) { photos[i].Position = i; db.Entry(photos[i]).Property(p => p.Position).IsModified = true; }
    }
    public async Task Remove(Guid id, Guid photoId, CancellationToken ct)
    {
        await using var tx = await db.Database.BeginTransactionAsync(ct);
        var p = await Lock(id, ct);
        var photo = await db.Set<ProfilePhoto>().SingleOrDefaultAsync(p => p.Id == photoId && p.UserId == id, ct)
            ?? throw new AuthFailure(404, "photo_not_found");
        if (photo.Deleted) return;
        photo.Deleted = true; p.Revision++; await db.SaveChangesAsync(ct);
        var remaining = await db.Set<ProfilePhoto>().Where(p => p.UserId == id && !p.Deleted).OrderBy(p => p.Position).ToListAsync(ct);
        await SetOrder(id, remaining, ct); await db.SaveChangesAsync(ct); await tx.CommitAsync(ct);
    }
    public async Task Moderate(Guid photoId, string state, CancellationToken ct)
    {
        if (state is not ("approved" or "rejected")) throw new AuthFailure(400, "invalid_photo_state");
        var owner = await db.Set<ProfilePhoto>().Where(p => p.Id == photoId && !p.Deleted).Select(p => (Guid?)p.UserId).SingleOrDefaultAsync(ct)
            ?? throw new AuthFailure(404, "photo_not_found");
        await using var tx = await db.Database.BeginTransactionAsync(ct);
        var p = await Lock(owner, ct);
        var photo = await db.Set<ProfilePhoto>().SingleAsync(p => p.Id == photoId, ct);
        if (photo.Deleted || photo.State == "uploading") throw new AuthFailure(409, "photo_not_ready");
        photo.State = state; p.Revision++; await db.SaveChangesAsync(ct); await tx.CommitAsync(ct);
    }
    public static PhotoDto Dto(ProfilePhoto p) => new(p.Id, p.State, p.Position, p.Width, p.Height);
}
