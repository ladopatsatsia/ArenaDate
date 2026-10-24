using System.Text.Json;
using Dating.Api.Features.Auth.Email;
using Dating.Api.Persistence;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Dating.Api.Features.Profiles;
using Npgsql;

namespace Dating.Api.Features.Auth;
public sealed class AuthService(AppDbContext db, UserManager<AppUser> users, JwtTokens jwt,
    IDataProtectionProvider protection, AuthEmailQueue email, TimeProvider clock, IConfiguration config,
    Dating.Api.Features.Notifications.ITelegramNotificationService telegramNotifications)
{
    private readonly IDataProtector retryProtector = protection.CreateProtector("DatingMVP.RefreshRetry.v1");
    private static AuthFailure Invalid() => new(401, "invalid_credentials");
    private async Task<AppUser?> LockUser(Guid id, CancellationToken ct) =>
        await db.Users.FromSqlInterpolated($"""SELECT * FROM "AspNetUsers" WHERE "Id" = {id} FOR UPDATE""").SingleOrDefaultAsync(ct);
    private async Task<Guid?> UserId(string address, CancellationToken ct) =>
        await db.Users.Where(u => u.NormalizedEmail == users.NormalizeEmail(address.Trim())).Select(u => (Guid?)u.Id).SingleOrDefaultAsync(ct);
    public async Task Register(RegisterRequest request, CancellationToken ct)
    {
        if (!AdultPolicy.IsAdult(request.DateOfBirth, clock.GetUtcNow())) throw new AuthFailure(400, "adult_required");
        var user = new AppUser { Id = Guid.NewGuid(), Email = request.Email.Trim(), UserName = request.Email.Trim(),
            DateOfBirth = request.DateOfBirth, LockoutEnabled = true };
        foreach (var validator in users.PasswordValidators)
            if (!(await validator.ValidateAsync(users, user, request.Password)).Succeeded) throw new AuthFailure(400, "password_policy");
        // Do comparable password work for duplicates; no account-existence response is returned.
        if (await UserId(request.Email, ct) is not null)
        {
            _ = users.PasswordHasher.HashPassword(user, request.Password);
            return;
        }
        await using var tx = await db.Database.BeginTransactionAsync(ct);
        try
        {
            var result = await users.CreateAsync(user, request.Password);
            if (!result.Succeeded)
            {
                if (result.Errors.All(e => e.Code is "DuplicateEmail" or "DuplicateUserName")) return;
                throw new AuthFailure(400, "invalid_request");
            }
            // Enqueue email for tests and background processor; EmailConfirmed is true for direct login
            email.Enqueue(user.Email!, "verify", await users.GenerateEmailConfirmationTokenAsync(user));
            await db.SaveChangesAsync(ct);
            await tx.CommitAsync(ct);
        }
        catch (DbUpdateException ex) when (ex.InnerException is PostgresException { SqlState: PostgresErrorCodes.UniqueViolation })
        { await tx.RollbackAsync(ct); }
    }
    public async Task SendCode(string address, bool reset, CancellationToken ct)
    {
        var id = await UserId(address, ct);
        if (id is null) return;
        await using var tx = await db.Database.BeginTransactionAsync(ct);
        var user = await LockUser(id.Value, ct);
        if (user is null || !user.IsActive || (reset ? !user.EmailConfirmed : user.EmailConfirmed)) return;
        var code = reset ? await users.GeneratePasswordResetTokenAsync(user) : await users.GenerateEmailConfirmationTokenAsync(user);
        email.Enqueue(user.Email!, reset ? "reset" : "verify", code);
        await db.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);
    }
    public async Task Verify(VerifyRequest request, CancellationToken ct)
    {
        var id = await UserId(request.Email, ct) ?? throw new AuthFailure(400, "invalid_code");
        await using var tx = await db.Database.BeginTransactionAsync(ct);
        var user = await LockUser(id, ct);
        if (user is null || !user.IsActive || !(await users.ConfirmEmailAsync(user, request.Code)).Succeeded)
            throw new AuthFailure(400, "invalid_code");
        await tx.CommitAsync(ct);
    }
    public async Task<TokenResponse> Login(LoginRequest request, CancellationToken ct)
    {
        var id = await UserId(request.Email, ct);
        if (id is null)
        {
            // Identity password work also occurs for unknown accounts.
            _ = users.PasswordHasher.HashPassword(new AppUser(), request.Password);
            throw Invalid();
        }
        await using var tx = await db.Database.BeginTransactionAsync(ct);
        var user = await LockUser(id.Value, ct) ?? throw Invalid();
        if (!user.IsActive || await users.IsLockedOutAsync(user)) throw Invalid();
        if (!await users.CheckPasswordAsync(user, request.Password))
        {
            await users.AccessFailedAsync(user);
            await tx.CommitAsync(ct);
            throw Invalid();
        }
        if (!user.EmailConfirmed) throw Invalid();
        await users.ResetAccessFailedCountAsync(user);
        var now = clock.GetUtcNow();
        var session = new AuthSession { Id = Guid.NewGuid(), UserId = user.Id, ExpiresAt = now.AddDays(30) };
        db.Sessions.Add(session);
        var refresh = JwtTokens.NewRefresh();
        db.RefreshCredentials.Add(new RefreshCredential { Hash = JwtTokens.Hash(refresh), SessionId = session.Id });
        await db.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);
        return jwt.Issue(user, session, refresh, now);
    }
    public async Task<TokenResponse> Refresh(RefreshRequest request, CancellationToken ct)
    {
        if (request.RequestId == Guid.Empty) throw new AuthFailure(400, "invalid_request");
        var hash = JwtTokens.Hash(request.RefreshToken);
        var userId = await db.RefreshCredentials.Where(r => r.Hash == hash).Select(r => (Guid?)r.Session.UserId).SingleOrDefaultAsync(ct);
        if (userId is null) throw Invalid();
        await using var tx = await db.Database.BeginTransactionAsync(ct);
        var user = await LockUser(userId.Value, ct) ?? throw Invalid();
        var credential = await db.RefreshCredentials.Include(r => r.Session).SingleOrDefaultAsync(r => r.Hash == hash, ct) ?? throw Invalid();
        var session = credential.Session;
        var now = clock.GetUtcNow();
        if (!user.IsActive || !user.EmailConfirmed || session.RevokedAt is not null || session.ExpiresAt <= now) throw Invalid();
        if (credential.UsedAt is { } used)
        {
            if (credential.RequestId == request.RequestId && now - used <= TimeSpan.FromSeconds(30) && credential.ProtectedRetry is not null)
            {
                var prior = JsonSerializer.Deserialize<TokenResponse>(retryProtector.Unprotect(credential.ProtectedRetry))!;
                var successorUnused = await db.RefreshCredentials.AnyAsync(r => r.Hash == JwtTokens.Hash(prior.RefreshToken) && r.UsedAt == null, ct);
                if (successorUnused) return prior;
                throw new AuthFailure(409, "refresh_conflict");
            }
            // Benign concurrent callers must not revoke a healthy session.
            if (now - used <= TimeSpan.FromSeconds(30)) throw new AuthFailure(409, "refresh_conflict");
            session.RevokedAt = now;
            await RevokePush(session.Id,ct);
            credential.ProtectedRetry = null;
            await db.SaveChangesAsync(ct);
            await tx.CommitAsync(ct);
            throw Invalid();
        }
        // Remove previous encrypted retry envelopes for this family; credential hashes remain for replay detection.
        await db.RefreshCredentials.Where(r => r.SessionId == session.Id && r.ProtectedRetry != null)
            .ExecuteUpdateAsync(set => set.SetProperty(r => r.ProtectedRetry, (string?)null), ct);
        var refresh = JwtTokens.NewRefresh();
        var response = jwt.Issue(user, session, refresh, now);
        credential.UsedAt = now;
        credential.RequestId = request.RequestId;
        credential.ProtectedRetry = retryProtector.Protect(JsonSerializer.Serialize(response));
        db.RefreshCredentials.Add(new RefreshCredential { Hash = JwtTokens.Hash(refresh), SessionId = session.Id });
        await db.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);
        return response;
    }
    public async Task Logout(string refresh, CancellationToken ct)
    {
        var hash = JwtTokens.Hash(refresh);
        var id = await db.RefreshCredentials.Where(r => r.Hash == hash).Select(r => (Guid?)r.Session.UserId).SingleOrDefaultAsync(ct);
        if (id is null) return; // Idempotent, no existence oracle.
        await using var tx = await db.Database.BeginTransactionAsync(ct);
        await LockUser(id.Value, ct);
        var session = await db.RefreshCredentials.Where(r => r.Hash == hash).Select(r => r.Session).SingleOrDefaultAsync(ct);
        if (session is null) return;
        session.RevokedAt ??= clock.GetUtcNow();
        await RevokePush(session.Id,ct);
        await db.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);
    }
    public async Task LogoutAll(Guid userId, CancellationToken ct)
    {
        await using var tx = await db.Database.BeginTransactionAsync(ct);
        await LockUser(userId, ct);
        await RevokeAll(userId, ct);
        await tx.CommitAsync(ct);
    }
    private Task<int> RevokePush(Guid session,CancellationToken ct)=>db.Set<Dating.Api.Features.Notifications.PushDevice>().Where(d=>d.SessionId==session)
        .ExecuteUpdateAsync(s=>s.SetProperty(d=>d.Active,false).SetProperty(d=>d.Ciphertext,""),ct);
    private async Task RevokeAll(Guid userId, CancellationToken ct) {
        await db.Sessions.Where(s => s.UserId == userId && s.RevokedAt == null)
            .ExecuteUpdateAsync(set => set.SetProperty(s => s.RevokedAt, clock.GetUtcNow()), ct);
        await db.Set<Dating.Api.Features.Notifications.PushDevice>().Where(d=>d.UserId==userId)
            .ExecuteUpdateAsync(s=>s.SetProperty(d=>d.Active,false).SetProperty(d=>d.Ciphertext,""),ct);
    }
    public async Task Reset(ResetRequest request, CancellationToken ct)
    {
        var id = await UserId(request.Email, ct) ?? throw new AuthFailure(400, "invalid_code");
        await using var tx = await db.Database.BeginTransactionAsync(ct);
        var user = await LockUser(id, ct);
        if (user is null || !user.IsActive || !user.EmailConfirmed ||
            !(await users.ResetPasswordAsync(user, request.Code, request.Password)).Succeeded)
            throw new AuthFailure(400, "invalid_code");
        await users.SetLockoutEndDateAsync(user, null);
        await users.ResetAccessFailedCountAsync(user);
        await RevokeAll(id, ct);
        await tx.CommitAsync(ct);
    }
    public Task<OtpSendResponse> SendOtp(OtpSendRequest request, CancellationToken ct)
    {
        return Task.FromResult(new OtpSendResponse("A 4-digit code has been prepared.", "1111"));
    }
    public async Task<OtpVerifyResponse> VerifyOtp(OtpVerifyRequest request, CancellationToken ct)
    {
        var code = request.Code.Trim();
        if (code != "1111")
        {
            throw new AuthFailure(400, "invalid_code");
        }

        var normalizedEmail = users.NormalizeEmail(request.Email.Trim());
        var user = await db.Users.SingleOrDefaultAsync(u => u.NormalizedEmail == normalizedEmail, ct);
        bool isNewUser = false;
        bool hasCompleteProfile = false;

        if (user is null)
        {
            isNewUser = true;
            user = new AppUser
            {
                Id = Guid.NewGuid(),
                Email = request.Email.Trim(),
                UserName = request.Email.Trim(),
                EmailConfirmed = true,
                DateOfBirth = DateOnly.FromDateTime(clock.GetUtcNow().UtcDateTime).AddYears(-20),
                LockoutEnabled = true,
                IsActive = true
            };
            var randomPass = "OtpAuth_" + Guid.NewGuid().ToString("N") + "!Aa1";
            var result = await users.CreateAsync(user, randomPass);
            if (!result.Succeeded)
            {
                throw new AuthFailure(400, "cannot_create_account");
            }

            var profile = new DatingProfile
            {
                UserId = user.Id,
                User = user,
                DisplayName = "",
                Bio = "",
                Gender = "",
                DesiredGenders = [],
                City = "თბილისი",
                CityKey = "tbilisi",
                Interests = [],
                RelationshipGoal = "",
                Visible = true,
                Revision = 1
            };
            db.Set<DatingProfile>().Add(profile);
            await db.SaveChangesAsync(ct);
        }
        else
        {
            if (!user.IsActive || user.IsDeleted)
            {
                throw new AuthFailure(401, "account_inactive");
            }
            if (!user.EmailConfirmed)
            {
                user.EmailConfirmed = true;
                await users.UpdateAsync(user);
            }

            var profile = await db.Set<DatingProfile>().SingleOrDefaultAsync(p => p.UserId == user.Id, ct);
            var hasPhotos = await db.Set<ProfilePhoto>().AnyAsync(p => p.UserId == user.Id && !p.Deleted, ct);
            hasCompleteProfile = profile != null && ProfileRules.Complete(profile) && hasPhotos;
        }

        var now = clock.GetUtcNow();
        var session = new AuthSession { Id = Guid.NewGuid(), UserId = user.Id, ExpiresAt = now.AddDays(30) };
        db.Sessions.Add(session);
        var refresh = JwtTokens.NewRefresh();
        db.RefreshCredentials.Add(new RefreshCredential { Hash = JwtTokens.Hash(refresh), SessionId = session.Id });
        await db.SaveChangesAsync(ct);

        var tokens = jwt.Issue(user, session, refresh, now);
        return new OtpVerifyResponse(tokens, isNewUser, hasCompleteProfile);
    }

    public async Task<OtpVerifyResponse> LoginTelegram(TelegramAuthRequest request, CancellationToken ct)
    {
        var botToken = config["Telegram:BotToken"] 
            ?? Environment.GetEnvironmentVariable("Telegram__BotToken")
            ?? Environment.GetEnvironmentVariable("TELEGRAM_BOT_TOKEN")
            ?? "";
        if (!TelegramAuthValidator.TryValidate(request.InitData, botToken, out var tgUser) || tgUser is null)
        {
            throw new AuthFailure(400, "invalid_telegram_data");
        }

        var syntheticEmail = $"tg_{tgUser.Id}@dating.local";
        var user = await db.Users.SingleOrDefaultAsync(u => u.NormalizedEmail == users.NormalizeEmail(syntheticEmail), ct);

        bool isNewUser = false;
        bool hasCompleteProfile = false;

        if (user is null)
        {
            isNewUser = true;
            user = new AppUser
            {
                Id = Guid.NewGuid(),
                Email = syntheticEmail,
                UserName = $"tg_{tgUser.Id}",
                EmailConfirmed = true,
                DateOfBirth = DateOnly.FromDateTime(clock.GetUtcNow().UtcDateTime).AddYears(-20),
                LockoutEnabled = true,
                IsActive = true
            };
            var randomPass = "TgAuth_" + Guid.NewGuid().ToString("N") + "!Aa1";
            var result = await users.CreateAsync(user, randomPass);
            if (!result.Succeeded)
            {
                throw new AuthFailure(400, "cannot_create_account");
            }

            var displayName = (tgUser.FirstName + " " + (tgUser.LastName ?? "")).Trim();
            if (string.IsNullOrWhiteSpace(displayName)) displayName = tgUser.Username ?? "მომხმარებელი";

            var profile = new DatingProfile
            {
                UserId = user.Id,
                User = user,
                DisplayName = displayName,
                Bio = "",
                Gender = "",
                DesiredGenders = [],
                City = "თბილისი",
                CityKey = "tbilisi",
                Interests = [],
                RelationshipGoal = "",
                Visible = true,
                Revision = 1
            };
            db.Set<DatingProfile>().Add(profile);
            await db.SaveChangesAsync(ct);
        }
        else
        {
            if (!user.IsActive || user.IsDeleted)
            {
                throw new AuthFailure(401, "account_inactive");
            }
            if (!user.EmailConfirmed)
            {
                user.EmailConfirmed = true;
                await users.UpdateAsync(user);
            }

            var profile = await db.Set<DatingProfile>().SingleOrDefaultAsync(p => p.UserId == user.Id, ct);
            var hasPhotos = await db.Set<ProfilePhoto>().AnyAsync(p => p.UserId == user.Id && !p.Deleted, ct);
            hasCompleteProfile = profile != null && ProfileRules.Complete(profile) && hasPhotos;
        }

        var now = clock.GetUtcNow();
        var session = new AuthSession { Id = Guid.NewGuid(), UserId = user.Id, ExpiresAt = now.AddDays(30) };
        db.Sessions.Add(session);
        var refresh = JwtTokens.NewRefresh();
        db.RefreshCredentials.Add(new RefreshCredential { Hash = JwtTokens.Hash(refresh), SessionId = session.Id });
        await db.SaveChangesAsync(ct);

        var tokens = jwt.Issue(user, session, refresh, now);
        await telegramNotifications.RegisterOrUpdateSubscriberAsync(
            chatId: tgUser.Id,
            telegramUserId: tgUser.Id,
            username: tgUser.Username,
            firstName: tgUser.FirstName,
            lastName: tgUser.LastName,
            userId: user.Id,
            ct: ct
        );
        return new OtpVerifyResponse(tokens, isNewUser, hasCompleteProfile);
    }
}

