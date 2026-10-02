using System.Security.Cryptography;
using System.Text;
using Dating.Api.Features.Auth;
using Dating.Api.Features.Auth.Email;
using Dating.Api.Features.Chat;
using Dating.Api.Features.Matching;
using Dating.Api.Features.Moderation;
using Dating.Api.Features.Notifications;
using Dating.Api.Features.Profiles;
using Dating.Api.Persistence;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace Dating.Api.Features.AccountLifecycle;

public sealed class AccountLifecycleService(
    AppDbContext db,
    UserManager<AppUser> users,
    ChatConnections connections,
    AuthEmailQueue email,
    IDataProtectionProvider protection,
    TimeProvider clock)
{
    public const string PublicDeletionPurpose = "DatingMVP.AccountDeletion.v1";
    private readonly IDataProtector deletionProtector = protection.CreateProtector(PublicDeletionPurpose);

    private static string HashEmail(string normalizedEmail)
    {
        var bytes = SHA256.HashData(Encoding.UTF8.GetBytes(normalizedEmail));
        return Convert.ToHexString(bytes).ToLowerInvariant();
    }

    private async Task<AppUser?> LockUser(Guid id, CancellationToken ct) =>
        await db.Users.FromSqlInterpolated($"""SELECT * FROM "AspNetUsers" WHERE "Id" = {id} FOR UPDATE""").SingleOrDefaultAsync(ct);

    public async Task DeleteAccountInApp(Guid userId, string password, CancellationToken ct)
    {
        await using var tx = await db.Database.BeginTransactionAsync(ct);
        var user = await LockUser(userId, ct) ?? throw new AuthFailure(404, "account_not_found");
        if (!user.IsActive) throw new AuthFailure(401, "invalid_credentials");

        if (await db.Set<StaffAccount>().AnyAsync(s => s.UserId == userId, ct))
            throw new AuthFailure(403, "staff_requires_operator");

        if (!await users.CheckPasswordAsync(user, password))
            throw new AuthFailure(401, "invalid_credentials");

        await ExecuteDeletionCore(user, ct);
        await tx.CommitAsync(ct);
    }

    public async Task<DeletionStatusResponse> GetStatus(Guid userId, CancellationToken ct)
    {
        var job = await db.Set<AccountDeletionJob>()
            .AsNoTracking()
            .Where(j => j.UserId == userId)
            .OrderByDescending(j => j.CreatedAt)
            .FirstOrDefaultAsync(ct);

        if (job is null)
        {
            var tombstone = await db.Set<DeletionTombstone>()
                .AsNoTracking()
                .SingleOrDefaultAsync(t => t.UserId == userId, ct);

            if (tombstone is not null)
                return new DeletionStatusResponse(userId, "completed", tombstone.DeletedAt, tombstone.DeletedAt);

            throw new AuthFailure(404, "deletion_not_found");
        }

        return new DeletionStatusResponse(userId, job.State, job.CreatedAt, job.CompletedAt);
    }

    public async Task RequestPublicDeletion(string emailAddress, CancellationToken ct)
    {
        var normalized = users.NormalizeEmail(emailAddress.Trim());
        var user = await db.Users.SingleOrDefaultAsync(u => u.NormalizedEmail == normalized, ct);
        if (user is null || !user.IsActive) return;

        var token = deletionProtector.Protect($"{user.Id}:{clock.GetUtcNow().ToUnixTimeSeconds()}");
        email.Enqueue(user.Email!, "deletion", token);
        await db.SaveChangesAsync(ct);
    }

    public async Task ConfirmPublicDeletion(string emailAddress, string token, CancellationToken ct)
    {
        string payload;
        try { payload = deletionProtector.Unprotect(token); }
        catch { throw new AuthFailure(400, "invalid_token"); }

        var parts = payload.Split(':');
        if (parts.Length != 2 || !Guid.TryParse(parts[0], out var userId) || !long.TryParse(parts[1], out var timestamp))
            throw new AuthFailure(400, "invalid_token");

        var tokenTime = DateTimeOffset.FromUnixTimeSeconds(timestamp);
        if (clock.GetUtcNow() - tokenTime > TimeSpan.FromHours(24))
            throw new AuthFailure(400, "invalid_token");

        await using var tx = await db.Database.BeginTransactionAsync(ct);
        var user = await LockUser(userId, ct);
        if (user is null || !user.IsActive)
            throw new AuthFailure(400, "invalid_token");

        var normalized = users.NormalizeEmail(emailAddress.Trim());
        if (user.NormalizedEmail != normalized)
            throw new AuthFailure(400, "invalid_token");

        await ExecuteDeletionCore(user, ct);
        await tx.CommitAsync(ct);
    }

    public async Task SetDiscoverabilityPause(Guid userId, bool paused, CancellationToken ct)
    {
        await using var tx = await db.Database.BeginTransactionAsync(ct);
        var user = await LockUser(userId, ct) ?? throw new AuthFailure(404, "account_not_found");
        if (!user.IsActive) throw new AuthFailure(401, "invalid_credentials");

        var profile = await db.Set<DatingProfile>().SingleOrDefaultAsync(p => p.UserId == userId, ct);
        if (profile is not null)
        {
            profile.Visible = !paused;
            profile.Revision++;
            await db.SaveChangesAsync(ct);
        }
        await tx.CommitAsync(ct);
    }

    private async Task ExecuteDeletionCore(AppUser user, CancellationToken ct)
    {
        var now = clock.GetUtcNow();
        var id = user.Id;
        var oldNormalized = user.NormalizedEmail ?? "";

        user.IsActive = false;
        user.IsDeleted = true;
        user.DeletedAt = now;
        user.Email = $"deleted_{id:N}@deleted.local";
        user.NormalizedEmail = $"DELETED_{id:N}@DELETED.LOCAL";
        user.UserName = user.Email;
        user.NormalizedUserName = user.NormalizedEmail;
        user.PasswordHash = null;
        user.SecurityStamp = Guid.NewGuid().ToString("N");
        user.LockoutEnd = DateTimeOffset.MaxValue;

        var profile = await db.Set<DatingProfile>().SingleOrDefaultAsync(p => p.UserId == id, ct);
        if (profile is not null)
        {
            profile.Visible = false;
            profile.DisplayName = "Deleted Account";
            profile.Bio = "";
            profile.City = "";
            profile.CityKey = "";
            profile.Location = null;
            profile.Revision++;
        }

        await db.Sessions.Where(s => s.UserId == id && s.RevokedAt == null)
            .ExecuteUpdateAsync(s => s.SetProperty(x => x.RevokedAt, now), ct);

        await db.Set<PushDevice>().Where(d => d.UserId == id)
            .ExecuteUpdateAsync(d => d.SetProperty(x => x.Active, false).SetProperty(x => x.Ciphertext, "").SetProperty(x => x.TokenHash, ""), ct);

        var matches = await db.Set<DatingMatch>()
            .Where(m => (m.FirstId == id || m.SecondId == id) && m.Active)
            .ToListAsync(ct);
        foreach (var m in matches)
        {
            m.Active = false;
        }

        await db.Set<PushDelivery>()
            .Where(d => d.UserId == id && d.FinishedAt == null)
            .ExecuteUpdateAsync(d => d.SetProperty(x => x.FinishedAt, now).SetProperty(x => x.DeadLetterAt, now), ct);

        var conversations = await (from c in db.Set<Conversation>()
                                   join m in db.Set<DatingMatch>() on c.MatchId equals m.Id
                                   where m.FirstId == id || m.SecondId == id
                                   select c.Id).ToArrayAsync(ct);

        foreach (var cid in conversations)
        {
            db.Add(new ChatEvent { Id = Guid.NewGuid(), ConversationId = cid, Kind = "revoked", CreatedAt = now });
        }

        db.Set<DeletionTombstone>().Add(new DeletionTombstone
        {
            UserId = id,
            EmailHash = HashEmail(oldNormalized),
            DeletedAt = now
        });

        db.Set<AccountDeletionJob>().Add(new AccountDeletionJob
        {
            Id = Guid.NewGuid(),
            UserId = id,
            State = "pending",
            Attempts = 0,
            CreatedAt = now,
            NextAttemptAt = now
        });

        await db.SaveChangesAsync(ct);

        foreach (var cid in conversations)
        {
            connections.Revoke(cid);
        }
    }
}
