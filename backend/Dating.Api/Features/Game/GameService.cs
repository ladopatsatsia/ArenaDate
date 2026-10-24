using System.Security.Cryptography;
using System.Text.Json;
using Dating.Api.Features.Auth;
using Dating.Api.Features.Chat;
using Dating.Api.Features.Discovery;
using Dating.Api.Features.Game.Ai;
using Dating.Api.Features.Game.Wallet;
using Dating.Api.Features.Matching;
using Dating.Api.Features.Profiles;
using Dating.Api.Persistence;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Options;

namespace Dating.Api.Features.Game;

public sealed class GameService(
    AppDbContext db,
    IOptions<GameOptions> options,
    TimeProvider clock,
    IHostEnvironment env,
    IHubContext<GameHub>? hub = null,
    MatchService? matchService = null,
    IAiCommentaryProvider? aiCommentaryProvider = null,
    DeterministicAiCommentaryProvider? deterministicProvider = null,
    Dating.Api.Features.Notifications.ITelegramNotificationService? telegramNotifications = null)
{
    private readonly GameOptions _options = options.Value;
    private readonly IAiCommentaryProvider _aiCommentaryProvider = aiCommentaryProvider ?? deterministicProvider ?? new DeterministicAiCommentaryProvider();
    private readonly DeterministicAiCommentaryProvider _deterministicProvider = deterministicProvider ?? new DeterministicAiCommentaryProvider();

    private async Task<bool> CheckIncompatible(Guid userId, Guid[] otherUserIds, CancellationToken ct)
    {
        if (otherUserIds.Length == 0) return false;

        var blocked = await db.Set<UserBlock>()
            .AsNoTracking()
            .AnyAsync(b => (b.BlockerId == userId && otherUserIds.Contains(b.BlockedId)) ||
                           (b.BlockedId == userId && otherUserIds.Contains(b.BlockerId)), ct);
        if (blocked) return true;

        var unmatched = await db.Set<UnmatchedPair>()
            .AsNoTracking()
            .AnyAsync(u => (u.FirstId == userId && otherUserIds.Contains(u.SecondId)) ||
                           (u.SecondId == userId && otherUserIds.Contains(u.FirstId)), ct);
        return unmatched;
    }

    private async Task<HashSet<Guid>> GetIncompatibleUserIds(Guid userId, CancellationToken ct)
    {
        var blocked = await db.Set<UserBlock>()
            .AsNoTracking()
            .Where(b => b.BlockerId == userId || b.BlockedId == userId)
            .Select(b => b.BlockerId == userId ? b.BlockedId : b.BlockerId)
            .ToListAsync(ct);

        var unmatched = await db.Set<UnmatchedPair>()
            .AsNoTracking()
            .Where(u => u.FirstId == userId || u.SecondId == userId)
            .Select(u => u.FirstId == userId ? u.SecondId : u.FirstId)
            .ToListAsync(ct);

        return blocked.Concat(unmatched).ToHashSet();
    }

    public const string AiDisclosureGeorgian = "ხელოვნური ინტელექტის კომენტარები: ნებას რთავთ მესამე მხარის AI პროვაიდერს (OpenAI) დაამუშაოს თქვენ მიერ არჩეული კითხვა-პასუხები რაუნდის მოკლე კომენტარებისთვის. თქვენი სახელი, ფოტო, ასაკი, ლოკაცია და პირადი ჩატი არასოდეს გადაეცემა AI-ს.";

    public async Task<UserAiConsentResponse> GetUserAiConsentAsync(Guid userId, CancellationToken ct)
    {
        var settings = await db.Set<UserGameSettings>().AsNoTracking().SingleOrDefaultAsync(s => s.UserId == userId, ct);
        return new UserAiConsentResponse(
            AiConsent: settings?.AiConsent ?? false,
            DisclosureText: AiDisclosureGeorgian,
            ConsentGivenAtUtc: settings?.AiConsentGivenAtUtc
        );
    }

    public async Task<UserAiConsentResponse> SetUserAiConsentAsync(Guid userId, bool consent, CancellationToken ct)
    {
        var now = clock.GetUtcNow();
        var settings = await db.Set<UserGameSettings>().SingleOrDefaultAsync(s => s.UserId == userId, ct);
        if (settings == null)
        {
            settings = new UserGameSettings
            {
                UserId = userId,
                AiConsent = consent,
                AiConsentGivenAtUtc = consent ? now : null,
                UpdatedAtUtc = now
            };
            db.Set<UserGameSettings>().Add(settings);
        }
        else
        {
            settings.AiConsent = consent;
            if (consent && settings.AiConsentGivenAtUtc == null)
            {
                settings.AiConsentGivenAtUtc = now;
            }
            else if (!consent)
            {
                settings.AiConsentGivenAtUtc = null;
            }
            settings.UpdatedAtUtc = now;
        }

        await db.SaveChangesAsync(ct);

        return new UserAiConsentResponse(
            AiConsent: settings.AiConsent,
            DisclosureText: AiDisclosureGeorgian,
            ConsentGivenAtUtc: settings.AiConsentGivenAtUtc
        );
    }

    private async Task<bool> HasAiConsentAsync(Guid userA, Guid userB, CancellationToken ct)
    {
        var consents = await db.Set<UserGameSettings>()
            .AsNoTracking()
            .Where(s => (s.UserId == userA || s.UserId == userB) && s.AiConsent)
            .CountAsync(ct);

        return consents == 2;
    }

    private async Task<string> GenerateRoundSummaryCommentaryAsync(GameRound round, CancellationToken ct)
    {
        var bothConsent = await HasAiConsentAsync(round.SpinnerUserId, round.TargetUserId, ct);
        var questions = JsonSerializer.Deserialize<List<FrozenQuestionDto>>(round.QuestionsJson) ?? [];
        var revealed = JsonSerializer.Deserialize<List<RevealedSelectionDto>>(round.RevealedSelectionsJson) ?? [];
        var answered = revealed.Where(r => !r.IsSuppressed).ToList();
        var matches = answered.Count(r => r.IsMatch);
        var diffs = answered.Count - matches;

        var summaryItems = new List<RoundQuestionSummaryItem>();
        foreach (var r in answered)
        {
            var q = questions.ElementAtOrDefault(r.QuestionIndex);
            var qText = q?.QuestionText ?? $"კითხვა {r.QuestionIndex + 1}";
            var opts = q?.Options ?? [];
            var spinText = (r.SpinnerOption.HasValue && r.SpinnerOption.Value >= 0 && r.SpinnerOption.Value < opts.Length) ? opts[r.SpinnerOption.Value] : "";
            var targText = (r.TargetOption.HasValue && r.TargetOption.Value >= 0 && r.TargetOption.Value < opts.Length) ? opts[r.TargetOption.Value] : "";
            summaryItems.Add(new RoundQuestionSummaryItem(qText, spinText, targText, r.IsMatch));
        }

        var recentCommentaries = revealed.Select(r => r.FallbackCommentary).Where(c => !string.IsNullOrWhiteSpace(c)).TakeLast(3).ToList();

        var sumContext = new RoundSummaryContext(
            TotalQuestionsCount: 5,
            AnsweredQuestionsCount: answered.Count,
            MatchesCount: matches,
            DifferencesCount: diffs,
            CompletedQuestions: summaryItems,
            Language: "ka",
            RecentCommentaries: recentCommentaries
        );

        AiCommentaryResult result;
        if (bothConsent)
        {
            result = await _aiCommentaryProvider.GenerateRoundSummaryAsync(sumContext, ct);
        }
        else
        {
            result = await _deterministicProvider.GenerateRoundSummaryAsync(sumContext, ct);
        }

        return result.Commentary;
    }

    public async Task<GameRoomSummary[]> ListRooms(Guid viewerId, CancellationToken ct)
    {
        var now = clock.GetUtcNow();
        // In the lobby list, ONLY show rooms created by someone with crystals (CreatedByUserId != Guid.Empty)
        var rooms = await db.Set<GameRoom>()
            .AsNoTracking()
            .Where(r => r.State == GameRoomState.Lobby && r.CreatedByUserId != Guid.Empty)
            .OrderByDescending(r => r.CreatedAtUtc)
            .Take(50)
            .ToListAsync(ct);

        if (rooms.Count == 0) return [];

        var roomIds = rooms.Select(r => r.Id).ToArray();
        var lobbyStaleCutoff = clock.GetUtcNow().AddSeconds(-15);
        var activeMembers = await db.Set<GameMembership>()
            .AsNoTracking()
            .Where(m => roomIds.Contains(m.RoomId) && m.Status == GameMembershipStatus.Active && m.LastHeartbeatUtc >= lobbyStaleCutoff)
            .ToListAsync(ct);

        var incompatibleSet = await GetIncompatibleUserIds(viewerId, ct);

        var result = new List<GameRoomSummary>();
        foreach (var r in rooms)
        {
            var members = activeMembers.Where(m => m.RoomId == r.Id).ToList();
            if (members.Count == 0 && r.State == GameRoomState.Lobby)
                continue;

            // Blocked, unmatched, or already matched pairs cannot share a room; exclude from list
            if (members.Any(m => incompatibleSet.Contains(m.UserId)))
                continue;

            var fCount = members.Count(m => m.Gender == "woman");
            var mCount = members.Count(m => m.Gender == "man");

            result.Add(new GameRoomSummary(
                r.Id,
                r.Title,
                r.State.ToString(),
                members.Count,
                fCount,
                mCount,
                r.Capacity,
                r.FemaleQuota,
                r.MaleQuota,
                r.CreatedAtUtc,
                r.LobbyDeadlineUtc,
                r.Version,
                r.HasPassword
            ));
        }

        return result.ToArray();
    }

    public async Task<GameRoomDetail> GetRoom(Guid roomId, Guid viewerId, CancellationToken ct)
    {
        var now = clock.GetUtcNow();
        var room = await db.Set<GameRoom>()
            .AsNoTracking()
            .SingleOrDefaultAsync(r => r.Id == roomId, ct);

        if (room is null || room.State == GameRoomState.Ended)
            throw new AuthFailure(404, "room_not_found");

        var lobbyStaleCutoff = now.AddSeconds(-15);
        var activeMembers = await db.Set<GameMembership>()
            .AsNoTracking()
            .Where(m => m.RoomId == roomId && m.Status == GameMembershipStatus.Active && (room.State != GameRoomState.Lobby || m.LastHeartbeatUtc >= lobbyStaleCutoff))
            .OrderBy(m => m.JoinedAtUtc)
            .ToListAsync(ct);

        var memberUserIds = activeMembers.Select(m => m.UserId).Distinct().ToArray();
        var isJoined = activeMembers.Any(m => m.UserId == viewerId);

        // Ongoing / starting tables are private to joined members
        if ((room.State == GameRoomState.Starting || room.State == GameRoomState.Playing) && !isJoined)
            throw new AuthFailure(404, "room_unavailable");

        // Non-identifying unavailable response if viewer has blocked, unmatched, or matched with any active member
        var incompatible = await CheckIncompatible(viewerId, memberUserIds, ct);
        if (incompatible)
            throw new AuthFailure(404, "room_unavailable");

        var users = await db.Users
            .AsNoTracking()
            .Where(u => memberUserIds.Contains(u.Id))
            .ToDictionaryAsync(u => u.Id, ct);

        var profiles = await db.Set<DatingProfile>()
            .AsNoTracking()
            .Where(p => memberUserIds.Contains(p.UserId))
            .ToDictionaryAsync(p => p.UserId, ct);

        var photos = await db.Set<ProfilePhoto>()
            .AsNoTracking()
            .Where(p => memberUserIds.Contains(p.UserId) && !p.Deleted && p.State != "rejected" && p.State != "uploading")
            .OrderBy(p => p.State == "approved" ? 0 : 1)
            .ThenBy(p => p.Position)
            .ToListAsync(ct);

        var photoByUser = photos
            .GroupBy(p => p.UserId)
            .ToDictionary(g => g.Key, g => g.First());

        var memberDtos = new List<GameMemberDto>();
        foreach (var m in activeMembers)
        {
            if (!users.TryGetValue(m.UserId, out var u) || !profiles.TryGetValue(m.UserId, out var p))
                continue;

            photoByUser.TryGetValue(m.UserId, out var ph);
            var photoDto = ph is not null ? new PhotoDto(ph.Id, ph.State, ph.Position, ph.Width, ph.Height) : null;
            var age = ProfileRules.Age(u.DateOfBirth, now);

            memberDtos.Add(new GameMemberDto(
                m.UserId,
                p.DisplayName,
                age,
                m.Gender,
                photoDto,
                m.JoinedAtUtc
            ));
        }

        var femaleCount = activeMembers.Count(m => m.Gender == "woman");
        var maleCount = activeMembers.Count(m => m.Gender == "man");

        var canStart = (femaleCount >= room.FemaleQuota && maleCount >= room.MaleQuota) ||
                       (now >= room.LobbyDeadlineUtc && femaleCount >= room.MinFemaleStart && maleCount >= room.MinMaleStart);

        return new GameRoomDetail(
            room.Id,
            room.Title,
            room.State.ToString(),
            activeMembers.Count,
            femaleCount,
            maleCount,
            room.Capacity,
            room.FemaleQuota,
            room.MaleQuota,
            room.MinFemaleStart,
            room.MinMaleStart,
            room.CreatedAtUtc,
            room.LobbyDeadlineUtc,
            room.Version,
            canStart,
            isJoined,
            memberDtos.ToArray(),
            room.HasPassword
        );
    }

    public async Task<(AppUser User, DatingProfile Profile)> ValidateEligibility(Guid userId, CancellationToken ct)
    {
        var now = clock.GetUtcNow();
        var user = await db.Users.AsNoTracking().SingleOrDefaultAsync(u => u.Id == userId, ct);
        if (user is null || !user.IsActive || user.IsDeleted)
            throw new AuthFailure(403, "account_inactive");

        if (!user.EmailConfirmed)
            throw new AuthFailure(403, "email_not_confirmed");

        if (!AdultPolicy.IsAdult(user.DateOfBirth, now))
            throw new AuthFailure(403, "underage");

        var profile = await db.Set<DatingProfile>().AsNoTracking().SingleOrDefaultAsync(p => p.UserId == userId, ct);
        if (profile is null || !ProfileRules.Complete(profile))
            throw new AuthFailure(403, "profile_incomplete");
        // Bottle game photo restriction removed per user request: players can join without an approved photo

        // Default 5F/5M format requires reciprocal matching preferences
        if (profile.Gender == "woman")
        {
            if (!profile.DesiredGenders.Contains("man"))
                throw new AuthFailure(400, "ineligible_preferences");
        }
        else if (profile.Gender == "man")
        {
            if (!profile.DesiredGenders.Contains("woman"))
                throw new AuthFailure(400, "ineligible_preferences");
        }
        else
        {
            throw new AuthFailure(400, "ineligible_gender_format");
        }

        return (user, profile);
    }

    public async Task<GameRoomDetail?> GetCurrentRoom(Guid userId, CancellationToken ct)
    {
        var now = clock.GetUtcNow();
        var lobbyStaleCutoff = now.AddSeconds(-15);
        var membership = await (
            from m in db.Set<GameMembership>()
            join r in db.Set<GameRoom>() on m.RoomId equals r.Id
            where m.UserId == userId
               && (m.Status == GameMembershipStatus.Active || m.Status == GameMembershipStatus.Disconnected)
               && r.State != GameRoomState.Ended
               && (r.State != GameRoomState.Lobby || m.Status != GameMembershipStatus.Active || m.LastHeartbeatUtc >= lobbyStaleCutoff)
            select m
        ).AsNoTracking().FirstOrDefaultAsync(ct);

        if (membership is null) return null;

        try
        {
            var detail = await GetRoom(membership.RoomId, userId, ct);
            if (!detail.IsJoined) return null;
            return detail;
        }
        catch (AuthFailure ex) when (ex.Status == 404)
        {
            return null;
        }
    }

    public async Task<GameRoomDetail> JoinQueue(Guid userId, JoinQueueRequest request, CancellationToken ct)
    {
        var (_, profile) = await ValidateEligibility(userId, ct);

        var capacity = request.Capacity is 6 or 8 or 10 ? request.Capacity : 10;
        var quota = capacity / 2;

        await using var tx = await db.Database.BeginTransactionAsync(ct);
        await db.Database.ExecuteSqlRawAsync("SET LOCAL lock_timeout = '5s'", ct);

        var now = clock.GetUtcNow();
        var lobbyStaleCutoff = now.AddSeconds(-15);

        // Expire any stale Lobby memberships for this user
        var staleMyMemberships = await db.Set<GameMembership>()
            .Include(m => m.Room)
            .Where(m => m.UserId == userId
                     && m.Status == GameMembershipStatus.Active
                     && m.Room.State == GameRoomState.Lobby
                     && m.LastHeartbeatUtc < lobbyStaleCutoff)
            .ToListAsync(ct);

        foreach (var sm in staleMyMemberships)
        {
            sm.Status = GameMembershipStatus.Left;
            sm.LeftAtUtc = now;
        }
        if (staleMyMemberships.Count > 0)
        {
            await db.SaveChangesAsync(ct);
        }

        // One active room membership per account (only for non-ended rooms)
        var activeElsewhere = await (
            from m in db.Set<GameMembership>()
            join r in db.Set<GameRoom>() on m.RoomId equals r.Id
            where m.UserId == userId
               && (m.Status == GameMembershipStatus.Active || m.Status == GameMembershipStatus.Disconnected)
               && r.State != GameRoomState.Ended
            select m
        ).AnyAsync(ct);

        if (activeElsewhere)
            throw new AuthFailure(409, "active_membership_exists");

        var incompatibleSet = await GetIncompatibleUserIds(userId, ct);

        // Look for:
        // 1. Ongoing Playing rooms that have an open slot due to a player leaving mid-game
        // 2. Open Lobby rooms that are waiting for players
        var candidateRooms = await db.Set<GameRoom>()
            .Where(r => r.Capacity == capacity && string.IsNullOrEmpty(r.Password) && (r.State == GameRoomState.Lobby || r.State == GameRoomState.Playing))
            .OrderByDescending(r => r.State == GameRoomState.Playing) // Prefer filling empty slots in ongoing games!
            .ThenBy(r => r.CreatedAtUtc)
            .ToListAsync(ct);

        GameRoom? selectedRoom = null;

        foreach (var r in candidateRooms)
        {
            var members = await db.Set<GameMembership>()
                .Where(m => m.RoomId == r.Id && 
                           ((m.Status == GameMembershipStatus.Active && (r.State != GameRoomState.Lobby || m.LastHeartbeatUtc >= lobbyStaleCutoff)) || 
                            (r.State == GameRoomState.Playing && m.Status == GameMembershipStatus.Disconnected && m.ReservationExpiresAtUtc > now)))
                .ToListAsync(ct);

            if (members.Count >= r.Capacity) continue;

            var fCount = members.Count(m => m.Gender == "woman");
            var mCount = members.Count(m => m.Gender == "man");

            if (profile.Gender == "woman" && fCount >= r.FemaleQuota) continue;
            if (profile.Gender == "man" && mCount >= r.MaleQuota) continue;

            // Incompatibility check: no blocked or unmatched member allowed
            if (members.Any(m => incompatibleSet.Contains(m.UserId))) continue;

            selectedRoom = r;
            break;
        }

        now = clock.GetUtcNow();

        if (selectedRoom is not null)
        {
            var lockedRoom = await db.Set<GameRoom>()
                .FromSqlInterpolated($"SELECT * FROM \"GameRooms\" WHERE \"Id\" = {selectedRoom.Id} FOR UPDATE")
                .SingleAsync(ct);

            var activeMembers = await db.Set<GameMembership>()
                .Where(m => m.RoomId == lockedRoom.Id && 
                           ((m.Status == GameMembershipStatus.Active && (lockedRoom.State != GameRoomState.Lobby || m.LastHeartbeatUtc >= lobbyStaleCutoff)) || 
                            (lockedRoom.State == GameRoomState.Playing && m.Status == GameMembershipStatus.Disconnected && m.ReservationExpiresAtUtc > now)))
                .ToListAsync(ct);

            var fCount = activeMembers.Count(m => m.Gender == "woman");
            var mCount = activeMembers.Count(m => m.Gender == "man");

            if (activeMembers.Count < lockedRoom.Capacity &&
                ((profile.Gender == "woman" && fCount < lockedRoom.FemaleQuota) ||
                 (profile.Gender == "man" && mCount < lockedRoom.MaleQuota)) &&
                !activeMembers.Any(m => incompatibleSet.Contains(m.UserId)))
            {
                var membership = new GameMembership
                {
                    Id = Guid.NewGuid(),
                    RoomId = lockedRoom.Id,
                    UserId = userId,
                    Gender = profile.Gender,
                    Status = GameMembershipStatus.Active,
                    Generation = 1,
                    JoinedAtUtc = now,
                    LastHeartbeatUtc = now
                };
                db.Set<GameMembership>().Add(membership);

                await EmitOutboxEventAsync(lockedRoom, "MemberJoined", new
                {
                    RoomId = lockedRoom.Id,
                    UserId = userId,
                    Gender = profile.Gender,
                    TimestampUtc = now
                }, ct);

                if (lockedRoom.State == GameRoomState.Lobby)
                {
                    var newFCount = fCount + (profile.Gender == "woman" ? 1 : 0);
                    var newMCount = mCount + (profile.Gender == "man" ? 1 : 0);

                    if (newFCount >= lockedRoom.FemaleQuota && newMCount >= lockedRoom.MaleQuota)
                    {
                        lockedRoom.State = GameRoomState.Starting;
                        lockedRoom.DeadlineUtc = now.AddSeconds(5);
                        lockedRoom.DeadlineType = "StartingCountdown";

                        await EmitOutboxEventAsync(lockedRoom, "RoomStarting", new
                        {
                            RoomId = lockedRoom.Id,
                            State = "Starting",
                            FemaleCount = newFCount,
                            MaleCount = newMCount,
                            DeadlineUtc = lockedRoom.DeadlineUtc,
                            TimestampUtc = now
                        }, ct);
                    }
                }
                else if (lockedRoom.State == GameRoomState.Playing)
                {
                    // Mid-game join to replace a leaver!
                    if (lockedRoom.IsPaused && lockedRoom.RemainingDeadlineMs.HasValue)
                    {
                        lockedRoom.IsPaused = false;
                        lockedRoom.DeadlineUtc = now.AddMilliseconds(lockedRoom.RemainingDeadlineMs.Value);
                        lockedRoom.RemainingDeadlineMs = null;
                        if (lockedRoom.DeadlineType == "DisconnectPause")
                        {
                            lockedRoom.DeadlineType = "TurnPending";
                        }
                    }
                    lockedRoom.StateVersion++;
                }

                await db.SaveChangesAsync(ct);
                await tx.CommitAsync(ct);

                return await GetRoom(lockedRoom.Id, userId, ct);
            }
        }

        // Create new room for this capacity
        var newRoom = new GameRoom
        {
            Id = Guid.NewGuid(),
            Title = $"{capacity}-მოთამაშიანი მაგიდა",
            State = GameRoomState.Lobby,
            Capacity = capacity,
            FemaleQuota = quota,
            MaleQuota = quota,
            MinFemaleStart = quota,
            MinMaleStart = quota,
            LobbyTimeoutSeconds = _options.LobbyTimeoutSeconds,
            CreatedAtUtc = now,
            LobbyDeadlineUtc = now.AddSeconds(_options.LobbyTimeoutSeconds),
            DeadlineUtc = now.AddSeconds(_options.LobbyTimeoutSeconds),
            DeadlineType = "LobbyTimeout",
            Version = 1,
            CreatedByUserId = Guid.Empty // System queue room (not a crystal room)
        };
        db.Set<GameRoom>().Add(newRoom);

        var firstMembership = new GameMembership
        {
            Id = Guid.NewGuid(),
            RoomId = newRoom.Id,
            UserId = userId,
            Gender = profile.Gender,
            Status = GameMembershipStatus.Active,
            Generation = 1,
            JoinedAtUtc = now,
            LastHeartbeatUtc = now
        };
        db.Set<GameMembership>().Add(firstMembership);

        await EmitOutboxEventAsync(newRoom, "MemberJoined", new
        {
            RoomId = newRoom.Id,
            UserId = userId,
            Gender = profile.Gender,
            TimestampUtc = now
        }, ct);

        await db.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);

        return await GetRoom(newRoom.Id, userId, ct);
    }

    public async Task<GameRoomDetail> CreateRoom(Guid userId, CreateRoomRequest request, CancellationToken ct)
    {
        var (_, profile) = await ValidateEligibility(userId, ct);

        await using var tx = await db.Database.BeginTransactionAsync(ct);

        var now = clock.GetUtcNow();
        var lobbyStaleCutoff = now.AddSeconds(-15);

        // Expire any stale Lobby memberships for this user
        var staleMyMemberships = await db.Set<GameMembership>()
            .Include(m => m.Room)
            .Where(m => m.UserId == userId
                     && m.Status == GameMembershipStatus.Active
                     && m.Room.State == GameRoomState.Lobby
                     && m.LastHeartbeatUtc < lobbyStaleCutoff)
            .ToListAsync(ct);

        foreach (var sm in staleMyMemberships)
        {
            sm.Status = GameMembershipStatus.Left;
            sm.LeftAtUtc = now;
        }
        if (staleMyMemberships.Count > 0)
        {
            await db.SaveChangesAsync(ct);
        }

        // One active room membership per account (only for non-ended rooms)
        var activeElsewhere = await (
            from m in db.Set<GameMembership>()
            join r in db.Set<GameRoom>() on m.RoomId equals r.Id
            where m.UserId == userId
               && (m.Status == GameMembershipStatus.Active || m.Status == GameMembershipStatus.Disconnected)
               && r.State != GameRoomState.Ended
            select m
        ).AnyAsync(ct);

        if (activeElsewhere)
            throw new AuthFailure(409, "active_membership_exists");

        // Deduct 25 crystals for custom room creation if not testing
        if (!env.IsEnvironment("Testing"))
        {
            var wallet = await db.Set<UserWallet>()
                .FromSqlInterpolated($"""SELECT "UserId", "Balance", "OutstandingDebt", "UpdatedAtUtc", xmin FROM "UserWallets" WHERE "UserId" = {userId} FOR UPDATE""")
                .SingleOrDefaultAsync(ct);

            if (wallet is null || wallet.Balance < 25)
            {
                throw new AuthFailure(400, "insufficient_crystals");
            }

            wallet.Balance -= 25;
            wallet.UpdatedAtUtc = now;

            var txCrystal = new CrystalTransaction
            {
                Id = Guid.NewGuid(),
                UserId = userId,
                Amount = -25,
                BalanceAfter = wallet.Balance,
                Type = "RoomCreation",
                ReferenceId = string.Empty, // Will update below if needed
                IdempotencyKey = $"room_create_{Guid.NewGuid()}",
                Description = "მაგიდის შექმნა (25 კრისტალი)",
                CreatedAtUtc = now
            };
            db.Add(txCrystal);
        }

        var capacity = request.Capacity is 6 or 8 or 10 ? request.Capacity : _options.DefaultCapacity;
        var quota = capacity / 2;

        var title = string.IsNullOrWhiteSpace(request?.Title)
            ? $"{capacity}-მოთამაშიანი მაგიდა #{Random.Shared.Next(100, 999)}"
            : request.Title.Trim();

        var password = string.IsNullOrWhiteSpace(request?.Password) ? null : request.Password.Trim();

        var room = new GameRoom
        {
            Id = Guid.NewGuid(),
            Title = title,
            State = GameRoomState.Lobby,
            Capacity = capacity,
            FemaleQuota = quota,
            MaleQuota = quota,
            MinFemaleStart = quota,
            MinMaleStart = quota,
            LobbyTimeoutSeconds = _options.LobbyTimeoutSeconds,
            CreatedAtUtc = now,
            LobbyDeadlineUtc = now.AddSeconds(_options.LobbyTimeoutSeconds),
            DeadlineUtc = now.AddSeconds(_options.LobbyTimeoutSeconds),
            DeadlineType = "LobbyTimeout",
            Version = 1,
            CreatedByUserId = userId,
            Password = password
        };

        db.Set<GameRoom>().Add(room);

        var membership = new GameMembership
        {
            Id = Guid.NewGuid(),
            RoomId = room.Id,
            UserId = userId,
            Gender = profile.Gender,
            Status = GameMembershipStatus.Active,
            Generation = 1,
            JoinedAtUtc = now,
            LastHeartbeatUtc = now
        };

        db.Set<GameMembership>().Add(membership);

        await EmitOutboxEventAsync(room, "MemberJoined", new
        {
            RoomId = room.Id,
            UserId = userId,
            Gender = profile.Gender,
            TimestampUtc = now
        }, ct);

        await db.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);

        return await GetRoom(room.Id, userId, ct);
    }

    public async Task<JoinRoomResult> JoinRoom(Guid roomId, Guid userId, JoinRoomRequest? request = null, CancellationToken ct = default)
    {
        var (_, profile) = await ValidateEligibility(userId, ct);

        await using var tx = await db.Database.BeginTransactionAsync(ct);
        await db.Database.ExecuteSqlRawAsync("SET LOCAL lock_timeout = '5s'", ct);

        var room = await db.Set<GameRoom>()
            .FromSqlInterpolated($"SELECT * FROM \"GameRooms\" WHERE \"Id\" = {roomId} FOR UPDATE")
            .SingleOrDefaultAsync(ct);

        if (room is null || room.State == GameRoomState.Ended)
            throw new AuthFailure(404, "room_not_found");

        if (room.State != GameRoomState.Lobby)
            throw new AuthFailure(404, "room_unavailable");

        if (!string.IsNullOrEmpty(room.Password) && room.CreatedByUserId != userId)
        {
            if (string.IsNullOrEmpty(request?.Password) || request.Password.Trim() != room.Password)
            {
                throw new AuthFailure(400, "invalid_room_password");
            }
        }

        // Idempotent join if already actively joined in THIS room
        var existing = await db.Set<GameMembership>()
            .SingleOrDefaultAsync(m => m.RoomId == roomId && m.UserId == userId && m.Status == GameMembershipStatus.Active, ct);

        if (existing is not null)
            return new JoinRoomResult(roomId, existing.Id, room.State.ToString(), room.Version);

        var now = clock.GetUtcNow();
        var lobbyStaleCutoff = now.AddSeconds(-15);

        // Expire any stale Lobby memberships for this user elsewhere
        var staleMyMemberships = await db.Set<GameMembership>()
            .Include(m => m.Room)
            .Where(m => m.UserId == userId
                     && m.RoomId != roomId
                     && m.Status == GameMembershipStatus.Active
                     && m.Room.State == GameRoomState.Lobby
                     && m.LastHeartbeatUtc < lobbyStaleCutoff)
            .ToListAsync(ct);

        foreach (var sm in staleMyMemberships)
        {
            sm.Status = GameMembershipStatus.Left;
            sm.LeftAtUtc = now;
        }
        if (staleMyMemberships.Count > 0)
        {
            await db.SaveChangesAsync(ct);
        }

        // Reject if active in another room (one active room membership per account, only for non-ended rooms)
        var activeElsewhere = await (
            from m in db.Set<GameMembership>()
            join r in db.Set<GameRoom>() on m.RoomId equals r.Id
            where m.UserId == userId
               && m.RoomId != roomId
               && (m.Status == GameMembershipStatus.Active || m.Status == GameMembershipStatus.Disconnected)
               && r.State != GameRoomState.Ended
            select m
        ).AnyAsync(ct);

        if (activeElsewhere)
            throw new AuthFailure(409, "active_membership_exists");

        var activeMembers = await db.Set<GameMembership>()
            .Where(m => m.RoomId == roomId && m.Status == GameMembershipStatus.Active && (room.State != GameRoomState.Lobby || m.LastHeartbeatUtc >= lobbyStaleCutoff))
            .ToListAsync(ct);

        if (activeMembers.Count >= room.Capacity)
            throw new AuthFailure(400, "room_full");

        // Quota check
        if (profile.Gender == "woman" && activeMembers.Count(m => m.Gender == "woman") >= room.FemaleQuota)
            throw new AuthFailure(400, "female_quota_full");

        if (profile.Gender == "man" && activeMembers.Count(m => m.Gender == "man") >= room.MaleQuota)
            throw new AuthFailure(400, "male_quota_full");

        // Incompatible check: blocked, unmatched, or already matched pairs cannot share a room
        var memberUserIds = activeMembers.Select(m => m.UserId).ToArray();
        var incompatible = await CheckIncompatible(userId, memberUserIds, ct);
        if (incompatible)
            throw new AuthFailure(404, "room_unavailable");

        now = clock.GetUtcNow();
        var membership = new GameMembership
        {
            Id = Guid.NewGuid(),
            RoomId = roomId,
            UserId = userId,
            Gender = profile.Gender,
            Status = GameMembershipStatus.Active,
            Generation = 1,
            JoinedAtUtc = now,
            LastHeartbeatUtc = now
        };

        db.Set<GameMembership>().Add(membership);

        await EmitOutboxEventAsync(room, "MemberJoined", new
        {
            RoomId = roomId,
            UserId = userId,
            Gender = profile.Gender,
            TimestampUtc = now
        }, ct);

        // Full start condition: female quota + male quota filled
        var newFemaleCount = activeMembers.Count(m => m.Gender == "woman") + (profile.Gender == "woman" ? 1 : 0);
        var newMaleCount = activeMembers.Count(m => m.Gender == "man") + (profile.Gender == "man" ? 1 : 0);

        if (newFemaleCount >= room.FemaleQuota && newMaleCount >= room.MaleQuota)
        {
            room.State = GameRoomState.Starting;
            room.DeadlineUtc = now.AddSeconds(5);
            room.DeadlineType = "StartingCountdown";

            await EmitOutboxEventAsync(room, "RoomStarting", new
            {
                RoomId = roomId,
                State = "Starting",
                FemaleCount = newFemaleCount,
                MaleCount = newMaleCount,
                DeadlineUtc = room.DeadlineUtc,
                TimestampUtc = now
            }, ct);
        }

        await db.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);

        return new JoinRoomResult(roomId, membership.Id, room.State.ToString(), room.Version);
    }

    public async Task<LeaveRoomResult> LeaveRoom(Guid roomId, Guid userId, CancellationToken ct)
    {
        await using var tx = await db.Database.BeginTransactionAsync(ct);
        await db.Database.ExecuteSqlRawAsync("SET LOCAL lock_timeout = '5s'", ct);

        var room = await db.Set<GameRoom>()
            .FromSqlInterpolated($"SELECT * FROM \"GameRooms\" WHERE \"Id\" = {roomId} FOR UPDATE")
            .SingleOrDefaultAsync(ct);

        if (room is null)
            throw new AuthFailure(404, "room_not_found");

        var membership = await db.Set<GameMembership>()
            .SingleOrDefaultAsync(m => m.RoomId == roomId && m.UserId == userId && (m.Status == GameMembershipStatus.Active || m.Status == GameMembershipStatus.Disconnected), ct);

        if (membership is null)
            return new LeaveRoomResult(roomId, true); // Idempotent

        var now = clock.GetUtcNow();
        membership.Status = GameMembershipStatus.Left;
        membership.LeftAtUtc = now;
        membership.ReservationExpiresAtUtc = null;
        membership.DisconnectedAtUtc = null;

        await EmitOutboxEventAsync(room, "MemberLeft", new
        {
            RoomId = roomId,
            UserId = userId,
            Reason = "explicit_leave",
            TimestampUtc = now
        }, ct);

        var pendingKisses = await db.Set<GameKiss>()
            .Where(k => k.RoomId == roomId && (k.SenderUserId == userId || k.RecipientUserId == userId) && k.Status == "Pending")
            .ToListAsync(ct);
        foreach (var k in pendingKisses)
        {
            k.Status = "Expired";
            k.ExpiredAtUtc = now;
        }

        var remainingActive = await db.Set<GameMembership>()
            .CountAsync(m => m.RoomId == roomId && (m.Status == GameMembershipStatus.Active || m.Status == GameMembershipStatus.Disconnected) && m.Id != membership.Id, ct);

        if (remainingActive == 0 && room.State == GameRoomState.Lobby)
        {
            room.State = GameRoomState.Ended;
        }

        await db.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);

        return new LeaveRoomResult(roomId, true);
    }

    public async Task InvalidateUserMemberships(Guid userId, DateTimeOffset now, CancellationToken ct)
    {
        var memberships = await db.Set<GameMembership>()
            .Where(m => m.UserId == userId && (m.Status == GameMembershipStatus.Active || m.Status == GameMembershipStatus.Disconnected))
            .ToListAsync(ct);

        foreach (var m in memberships)
        {
            m.Status = GameMembershipStatus.Left;
            m.LeftAtUtc = now;
            m.ReservationExpiresAtUtc = null;
        }

        if (memberships.Count > 0)
        {
            await db.SaveChangesAsync(ct);
        }
    }

    private async Task EmitOutboxEventAsync(GameRoom room, string eventType, object payload, CancellationToken ct)
    {
        var maxSeq = await db.Set<GameOutboxEvent>().Where(e => e.RoomId == room.Id).MaxAsync(e => (long?)e.Sequence, ct) ?? 0;
        if (room.Sequence <= maxSeq) room.Sequence = maxSeq;
        room.Sequence++;
        room.StateVersion++;
        room.Version++;
        var outbox = new GameOutboxEvent
        {
            Id = Guid.NewGuid(),
            RoomId = room.Id,
            Sequence = room.Sequence,
            StateVersion = room.StateVersion,
            EventType = eventType,
            PayloadJson = System.Text.Json.JsonSerializer.Serialize(payload),
            CreatedAtUtc = clock.GetUtcNow()
        };
        db.Set<GameOutboxEvent>().Add(outbox);
    }

    public async Task DispatchPendingOutboxEvents(CancellationToken ct)
    {
        if (hub is null) return;
        var pending = await db.Set<GameOutboxEvent>()
            .Where(e => e.DispatchedAtUtc == null)
            .OrderBy(e => e.CreatedAtUtc)
            .ThenBy(e => e.Sequence)
            .Take(50)
            .ToListAsync(ct);

        if (pending.Count == 0) return;

        var now = clock.GetUtcNow();
        foreach (var ev in pending)
        {
            try
            {
                var group = GameHub.RoomGroup(ev.RoomId);
                await hub.Clients.Group(group).SendAsync(ev.EventType, ev.PayloadJson, ct);
                ev.DispatchedAtUtc = now;
            }
            catch (Exception)
            {
                break;
            }
        }

        await db.SaveChangesAsync(ct);
    }

    public async Task AuthorizeRoomSubscription(Guid roomId, Guid userId, CancellationToken ct)
    {
        var room = await db.Set<GameRoom>()
            .AsNoTracking()
            .SingleOrDefaultAsync(r => r.Id == roomId, ct);

        if (room is null || room.State == GameRoomState.Ended)
            throw new AuthFailure(404, "room_not_found");

        var isMember = await db.Set<GameMembership>()
            .AsNoTracking()
            .AnyAsync(m => m.RoomId == roomId && m.UserId == userId &&
                           (m.Status == GameMembershipStatus.Active || m.Status == GameMembershipStatus.Disconnected), ct);

        if (!isMember)
            throw new AuthFailure(403, "membership_required");
    }

    public async Task HandleMemberConnected(Guid roomId, Guid userId, CancellationToken ct)
    {
        await using var tx = await db.Database.BeginTransactionAsync(ct);
        await db.Database.ExecuteSqlRawAsync("SET LOCAL lock_timeout = '5s'", ct);

        var membership = await db.Set<GameMembership>()
            .FromSqlInterpolated($"SELECT * FROM \"GameMemberships\" WHERE \"RoomId\" = {roomId} AND \"UserId\" = {userId} FOR UPDATE")
            .SingleOrDefaultAsync(ct);

        if (membership is null) return;

        var now = clock.GetUtcNow();
        membership.LastHeartbeatUtc = now;

        if (membership.Status == GameMembershipStatus.Disconnected)
        {
            membership.Status = GameMembershipStatus.Active;
            membership.Generation++;
            membership.DisconnectedAtUtc = null;
            membership.ReservationExpiresAtUtc = null;

            var room = await db.Set<GameRoom>()
                .FromSqlInterpolated($"SELECT * FROM \"GameRooms\" WHERE \"Id\" = {roomId} FOR UPDATE")
                .SingleAsync(ct);

            await EmitOutboxEventAsync(room, "MemberReconnected", new
            {
                RoomId = roomId,
                UserId = userId,
                Generation = membership.Generation,
                TimestampUtc = now
            }, ct);
        }

        await db.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);
    }

    public async Task HandleTransientDisconnect(Guid userId, Guid roomId, CancellationToken ct)
    {
        await using var tx = await db.Database.BeginTransactionAsync(ct);
        await db.Database.ExecuteSqlRawAsync("SET LOCAL lock_timeout = '5s'", ct);

        var membership = await db.Set<GameMembership>()
            .FromSqlInterpolated($"SELECT * FROM \"GameMemberships\" WHERE \"RoomId\" = {roomId} AND \"UserId\" = {userId} FOR UPDATE")
            .SingleOrDefaultAsync(ct);

        if (membership is null || membership.Status != GameMembershipStatus.Active) return;

        var now = clock.GetUtcNow();
        membership.Status = GameMembershipStatus.Disconnected;
        membership.DisconnectedAtUtc = now;
        membership.ReservationExpiresAtUtc = now.AddSeconds(60);

        var room = await db.Set<GameRoom>()
            .FromSqlInterpolated($"SELECT * FROM \"GameRooms\" WHERE \"Id\" = {roomId} FOR UPDATE")
            .SingleAsync(ct);

        // Check disconnect pause budget (15 seconds per round)
        if (room.State == GameRoomState.Starting || room.State == GameRoomState.Playing)
        {
            if (room.DeadlineUtc.HasValue && !room.IsPaused && room.DisconnectPauseBudgetMs > 0)
            {
                var remainingMs = Math.Max(0, (int)(room.DeadlineUtc.Value - now).TotalMilliseconds);
                room.RemainingDeadlineMs = remainingMs;
                room.IsPaused = true;
                room.DeadlineType = "DisconnectPause";
            }
        }

        await EmitOutboxEventAsync(room, "MemberDisconnected", new
        {
            RoomId = roomId,
            UserId = userId,
            ReservationExpiresAtUtc = membership.ReservationExpiresAtUtc,
            TimestampUtc = now
        }, ct);

        await db.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);
    }

    public async Task<ReconnectRoomResult> ReconnectRoom(Guid roomId, Guid userId, CancellationToken ct)
    {
        await using var tx = await db.Database.BeginTransactionAsync(ct);
        await db.Database.ExecuteSqlRawAsync("SET LOCAL lock_timeout = '5s'", ct);

        var membership = await db.Set<GameMembership>()
            .FromSqlInterpolated($"SELECT * FROM \"GameMemberships\" WHERE \"RoomId\" = {roomId} AND \"UserId\" = {userId} FOR UPDATE")
            .SingleOrDefaultAsync(ct);

        if (membership is null || membership.Status == GameMembershipStatus.Left)
            throw new AuthFailure(404, "membership_not_found");

        var now = clock.GetUtcNow();

        if (membership.Status == GameMembershipStatus.Expired ||
            (membership.ReservationExpiresAtUtc.HasValue && membership.ReservationExpiresAtUtc.Value < now))
        {
            membership.Status = GameMembershipStatus.Expired;
            membership.LeftAtUtc = now;
            await db.SaveChangesAsync(ct);
            await tx.CommitAsync(ct);
            throw new AuthFailure(410, "seat_expired");
        }

        var room = await db.Set<GameRoom>()
            .FromSqlInterpolated($"SELECT * FROM \"GameRooms\" WHERE \"Id\" = {roomId} FOR UPDATE")
            .SingleAsync(ct);

        membership.Status = GameMembershipStatus.Active;
        membership.Generation++;
        membership.DisconnectedAtUtc = null;
        membership.ReservationExpiresAtUtc = null;
        membership.LastHeartbeatUtc = now;

        // If room was paused due to disconnect and has sufficient players, resume
        if (room.IsPaused && room.RemainingDeadlineMs.HasValue)
        {
            room.IsPaused = false;
            room.DeadlineUtc = now.AddMilliseconds(room.RemainingDeadlineMs.Value);
            room.RemainingDeadlineMs = null;
        }

        await EmitOutboxEventAsync(room, "MemberReconnected", new
        {
            RoomId = roomId,
            UserId = userId,
            Generation = membership.Generation,
            TimestampUtc = now
        }, ct);

        await db.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);

        var snapshot = await GetRoomSnapshot(roomId, userId, ct);
        return new ReconnectRoomResult(roomId, membership.Id, membership.Generation, snapshot);
    }

    public async Task<HeartbeatResult> Heartbeat(Guid roomId, Guid userId, CancellationToken ct)
    {
        var now = clock.GetUtcNow();
        var membership = await db.Set<GameMembership>()
            .SingleOrDefaultAsync(m => m.RoomId == roomId && m.UserId == userId && m.Status == GameMembershipStatus.Active, ct);

        if (membership is null)
            throw new AuthFailure(404, "membership_not_found");

        membership.LastHeartbeatUtc = now;
        await db.SaveChangesAsync(ct);

        return new HeartbeatResult(roomId, now);
    }

    public async Task<GameRoomSnapshot> GetRoomSnapshot(Guid roomId, Guid userId, CancellationToken ct)
    {
        var now = clock.GetUtcNow();

        var room = await db.Set<GameRoom>()
            .AsNoTracking()
            .SingleOrDefaultAsync(r => r.Id == roomId, ct);

        if (room is null || room.State == GameRoomState.Ended)
            throw new AuthFailure(404, "room_not_found");

        var memberships = await db.Set<GameMembership>()
            .AsNoTracking()
            .Where(m => m.RoomId == roomId && (m.Status == GameMembershipStatus.Active || m.Status == GameMembershipStatus.Disconnected))
            .Include(m => m.User)
            .OrderBy(m => m.JoinedAtUtc)
            .ThenBy(m => m.Id)
            .ToListAsync(ct);

        var callerMembership = memberships.SingleOrDefault(m => m.UserId == userId);
        if (callerMembership is null)
        {
            // Outsider caller
            if (room.State != GameRoomState.Lobby)
                throw new AuthFailure(404, "room_unavailable");

            var otherIds = memberships.Select(m => m.UserId).ToArray();
            var incompatible = await CheckIncompatible(userId, otherIds, ct);
            if (incompatible)
                throw new AuthFailure(404, "room_unavailable");
        }

        var userIds = memberships.Select(m => m.UserId).ToList();
        var profiles = await db.Set<DatingProfile>()
            .AsNoTracking()
            .Where(p => userIds.Contains(p.UserId))
            .ToDictionaryAsync(p => p.UserId, ct);

        var photos = await db.Set<ProfilePhoto>()
            .AsNoTracking()
            .Where(p => userIds.Contains(p.UserId) && !p.Deleted && p.State != "rejected" && p.State != "uploading")
            .OrderBy(p => p.State == "approved" ? 0 : 1)
            .ThenBy(p => p.Position)
            .ToListAsync(ct);

        var photoByUser = photos
            .GroupBy(p => p.UserId)
            .ToDictionary(g => g.Key, g => g.First());

        var memberDtos = memberships.Select(m =>
        {
            profiles.TryGetValue(m.UserId, out var p);
            photoByUser.TryGetValue(m.UserId, out var ph);
            var age = m.User != null ? ProfileRules.Age(m.User.DateOfBirth, now) : 18;
            var isSelf = (m.UserId == userId);
            int? reservationRemaining = null;
            if (m.Status == GameMembershipStatus.Disconnected && m.ReservationExpiresAtUtc.HasValue)
            {
                reservationRemaining = Math.Max(0, (int)(m.ReservationExpiresAtUtc.Value - now).TotalSeconds);
            }

            return new GameMemberDto(
                m.UserId,
                p?.DisplayName ?? "Player",
                age,
                m.Gender,
                ph is null ? null : new PhotoDto(ph.Id, ph.State, ph.Position, ph.Width, ph.Height),
                m.JoinedAtUtc,
                m.Status.ToString(),
                m.Generation,
                reservationRemaining,
                isSelf
            );
        }).ToArray();

        var femaleCount = memberships.Count(m => m.Gender == "woman" && m.Status == GameMembershipStatus.Active);
        var maleCount = memberships.Count(m => m.Gender == "man" && m.Status == GameMembershipStatus.Active);

        GameRoundDto? roundDto = null;
        if (room.CurrentRoundId.HasValue)
        {
            var round = await db.Set<GameRound>()
                .Include(r => r.Answers)
                .AsNoTracking()
                .SingleOrDefaultAsync(r => r.Id == room.CurrentRoundId.Value, ct);

            if (round != null)
            {
                var isParticipant = (userId == round.SpinnerUserId || userId == round.TargetUserId);
                string? summaryCommentary = null;
                if (isParticipant)
                {
                    summaryCommentary = round.SummaryCommentary;
                }
                if (string.IsNullOrEmpty(summaryCommentary))
                {
                    summaryCommentary = await db.Set<GameRound>()
                        .AsNoTracking()
                        .Where(r => r.RoomId == roomId && (r.SpinnerUserId == userId || r.TargetUserId == userId) && r.SummaryCommentary != null && r.SummaryCommentary != "")
                        .OrderByDescending(r => r.StartedAtUtc)
                        .Select(r => r.SummaryCommentary)
                        .FirstOrDefaultAsync(ct);
                }

                var questions = JsonSerializer.Deserialize<List<FrozenQuestionDto>>(round.QuestionsJson) ?? [];
                var revealedList = JsonSerializer.Deserialize<List<RevealedSelectionDto>>(round.RevealedSelectionsJson) ?? [];

                FrozenQuestionDto? currentQ = null;
                if (round.CurrentQuestionIndex >= 0 && round.CurrentQuestionIndex < questions.Count)
                {
                    currentQ = questions[round.CurrentQuestionIndex];
                }

                int? callerPendingAnswer = null;
                if (isParticipant)
                {
                    var callerAnswer = round.Answers.SingleOrDefault(a => a.UserId == userId && a.QuestionIndex == round.CurrentQuestionIndex);
                    callerPendingAnswer = callerAnswer?.SelectedOption;
                }

                var sanitizedRevealed = revealedList.Select(r =>
                {
                    if (isParticipant) return r;
                    return new RevealedSelectionDto(
                        r.QuestionIndex,
                        null,
                        null,
                        r.IsSuppressed,
                        r.IsMatch,
                        ""
                    );
                }).ToArray();

                var callerKiss = await db.Set<GameKiss>()
                    .AsNoTracking()
                    .FirstOrDefaultAsync(k => k.RoundId == round.Id && k.SenderUserId == userId, ct);

                var callerKissRecipient = callerKiss != null && callerKiss.Status != "Skipped" ? callerKiss.RecipientUserId : (Guid?)null;
                var callerKissSkipped = callerKiss?.Status == "Skipped" || (userId == round.SpinnerUserId && round.KissSkipped);

                var partnerUserId = (userId == round.SpinnerUserId) ? round.TargetUserId : round.SpinnerUserId;
                var hasPendingKissFromPartner = isParticipant && await db.Set<GameKiss>()
                    .AsNoTracking()
                    .AnyAsync(k => k.RoundId == round.Id && k.SenderUserId == partnerUserId && (k.Status == "Pending" || k.Status == "Matched"), ct);

                roundDto = new GameRoundDto(
                    round.Id,
                    round.RoundNumber,
                    round.SpinnerUserId,
                    round.TargetUserId,
                    round.AngleDegrees,
                    round.State,
                    round.CurrentQuestionIndex,
                    currentQ,
                    callerPendingAnswer,
                    sanitizedRevealed,
                    room.DeadlineUtc,
                    room.DeadlineType,
                    callerKissRecipient,
                    callerKissSkipped,
                    hasPendingKissFromPartner,
                    summaryCommentary
                );
            }
        }

        var pendingDirectRequests = await db.Set<GameDirectMatchRequest>()
            .AsNoTracking()
            .Where(r => r.TargetUserId == userId && r.Status == "Pending")
            .OrderByDescending(r => r.CreatedAtUtc)
            .ToListAsync(ct);

        DirectMatchRequestDto[]? pendingDirectRequestDtos = null;
        if (pendingDirectRequests.Count > 0)
        {
            var senderIds = pendingDirectRequests.Select(r => r.SenderUserId).Distinct().ToList();
            var senderUsers = await db.Set<AppUser>()
                .AsNoTracking()
                .Where(u => senderIds.Contains(u.Id))
                .ToDictionaryAsync(u => u.Id, ct);

            var senderProfiles = await db.Set<DatingProfile>()
                .AsNoTracking()
                .Where(p => senderIds.Contains(p.UserId))
                .ToDictionaryAsync(p => p.UserId, ct);

            var senderPhotos = await db.Set<ProfilePhoto>()
                .AsNoTracking()
                .Where(p => senderIds.Contains(p.UserId) && !p.Deleted && p.State != "rejected" && p.State != "uploading")
                .OrderBy(p => p.State == "approved" ? 0 : 1)
                .ThenBy(p => p.Position)
                .ToListAsync(ct);

            var senderPhotoByUser = senderPhotos
                .GroupBy(p => p.UserId)
                .ToDictionary(g => g.Key, g => g.First());

            pendingDirectRequestDtos = pendingDirectRequests.Select(r =>
            {
                senderProfiles.TryGetValue(r.SenderUserId, out var p);
                senderUsers.TryGetValue(r.SenderUserId, out var u);
                senderPhotoByUser.TryGetValue(r.SenderUserId, out var ph);
                var age = u != null ? ProfileRules.Age(u.DateOfBirth, now) : 18;
                return new DirectMatchRequestDto(
                    r.Id,
                    r.SenderUserId,
                    p?.DisplayName ?? "მოთამაშე",
                    age,
                    ph != null ? new PhotoDto(ph.Id, ph.State, ph.Position, ph.Width, ph.Height) : null,
                    r.Message,
                    r.CreatedAtUtc
                );
            }).ToArray();
        }

        var sentDirectRequestUserIds = await db.Set<GameDirectMatchRequest>()
            .AsNoTracking()
            .Where(r => r.SenderUserId == userId)
            .Select(r => r.TargetUserId)
            .Distinct()
            .ToArrayAsync(ct);

        var recentCutoff = now.AddSeconds(-25);
        var recentGifts = await db.Set<GameGift>()
            .AsNoTracking()
            .Where(g => g.RoomId == room.Id && g.CreatedAtUtc >= recentCutoff)
            .OrderBy(g => g.CreatedAtUtc)
            .Select(g => new GameGiftEventDto(
                g.Id,
                g.SenderUserId,
                g.RecipientUserId,
                g.GiftId,
                g.GiftName,
                g.GiftIcon,
                g.CrystalCost,
                g.CreatedAtUtc
            ))
            .ToArrayAsync(ct);

        return new GameRoomSnapshot(
            room.Id,
            room.Title,
            room.State.ToString(),
            room.Capacity,
            room.FemaleQuota,
            room.MaleQuota,
            memberships.Count(m => m.Status == GameMembershipStatus.Active),
            femaleCount,
            maleCount,
            room.StateVersion,
            room.Sequence,
            room.DeadlineUtc,
            room.DeadlineType,
            room.IsPaused,
            room.RemainingDeadlineMs,
            room.DisconnectPauseBudgetMs,
            room.MinActivePlayers,
            now,
            memberDtos,
            room.CurrentTurnUserId,
            roundDto,
            pendingDirectRequestDtos,
            sentDirectRequestUserIds,
            recentGifts
        );
    }

    public async Task<int> ProcessDeadlinesAndOutboxAsync(CancellationToken ct)
    {
        var now = clock.GetUtcNow();
        var processedCount = 0;

        // 1. Process expired reservations (60s elapsed without reconnect)
        var expiredMemberships = await db.Set<GameMembership>()
            .Where(m => m.Status == GameMembershipStatus.Disconnected && m.ReservationExpiresAtUtc <= now)
            .ToListAsync(ct);

        foreach (var m in expiredMemberships)
        {
            await using var tx = await db.Database.BeginTransactionAsync(ct);
            await db.Database.ExecuteSqlRawAsync("SET LOCAL lock_timeout = '5s'", ct);

            var lockedM = await db.Set<GameMembership>()
                .FromSqlInterpolated($"SELECT * FROM \"GameMemberships\" WHERE \"Id\" = {m.Id} FOR UPDATE")
                .SingleOrDefaultAsync(ct);

            if (lockedM != null && lockedM.Status == GameMembershipStatus.Disconnected && lockedM.ReservationExpiresAtUtc <= now)
            {
                lockedM.Status = GameMembershipStatus.Expired;
                lockedM.LeftAtUtc = now;

                var lockedRoom = await db.Set<GameRoom>()
                    .FromSqlInterpolated($"SELECT * FROM \"GameRooms\" WHERE \"Id\" = {lockedM.RoomId} FOR UPDATE")
                    .SingleOrDefaultAsync(ct);

                if (lockedRoom != null)
                {
                    await EmitOutboxEventAsync(lockedRoom, "MemberLeft", new
                    {
                        RoomId = lockedRoom.Id,
                        UserId = lockedM.UserId,
                        Reason = "reservation_expired",
                        TimestampUtc = now
                    }, ct);

                    var pendingKisses = await db.Set<GameKiss>()
                        .Where(k => k.RoomId == lockedRoom.Id && (k.SenderUserId == lockedM.UserId || k.RecipientUserId == lockedM.UserId) && k.Status == "Pending")
                        .ToListAsync(ct);
                    foreach (var k in pendingKisses)
                    {
                        k.Status = "Expired";
                        k.ExpiredAtUtc = now;
                    }

                    var activeCount = await db.Set<GameMembership>()
                        .CountAsync(mb => mb.RoomId == lockedRoom.Id && mb.Status == GameMembershipStatus.Active, ct);

                    if (activeCount == 0 && lockedRoom.State == GameRoomState.Lobby)
                    {
                        lockedRoom.State = GameRoomState.Ended;
                    }
                }

                await db.SaveChangesAsync(ct);
                await tx.CommitAsync(ct);
                processedCount++;
            }
        }

        // 1b. Process stale lobby memberships (15s elapsed without heartbeat in Lobby)
        var lobbyStaleCutoff = now.AddSeconds(-15);
        var staleLobbyMemberships = await db.Set<GameMembership>()
            .Include(m => m.Room)
            .Where(m => m.Status == GameMembershipStatus.Active && m.Room.State == GameRoomState.Lobby && m.LastHeartbeatUtc < lobbyStaleCutoff)
            .ToListAsync(ct);

        foreach (var m in staleLobbyMemberships)
        {
            await using var tx = await db.Database.BeginTransactionAsync(ct);
            await db.Database.ExecuteSqlRawAsync("SET LOCAL lock_timeout = '5s'", ct);

            var lockedM = await db.Set<GameMembership>()
                .FromSqlInterpolated($"SELECT * FROM \"GameMemberships\" WHERE \"Id\" = {m.Id} FOR UPDATE")
                .SingleOrDefaultAsync(ct);

            if (lockedM != null && lockedM.Status == GameMembershipStatus.Active && lockedM.LastHeartbeatUtc < lobbyStaleCutoff)
            {
                lockedM.Status = GameMembershipStatus.Left;
                lockedM.LeftAtUtc = now;
                lockedM.ReservationExpiresAtUtc = null;
                lockedM.DisconnectedAtUtc = null;

                var lockedRoom = await db.Set<GameRoom>()
                    .FromSqlInterpolated($"SELECT * FROM \"GameRooms\" WHERE \"Id\" = {lockedM.RoomId} FOR UPDATE")
                    .SingleOrDefaultAsync(ct);

                if (lockedRoom != null)
                {
                    await EmitOutboxEventAsync(lockedRoom, "MemberLeft", new
                    {
                        RoomId = lockedRoom.Id,
                        UserId = lockedM.UserId,
                        Reason = "heartbeat_timeout",
                        TimestampUtc = now
                    }, ct);

                    var pendingKisses = await db.Set<GameKiss>()
                        .Where(k => k.RoomId == lockedRoom.Id && (k.SenderUserId == lockedM.UserId || k.RecipientUserId == lockedM.UserId) && k.Status == "Pending")
                        .ToListAsync(ct);
                    foreach (var k in pendingKisses)
                    {
                        k.Status = "Expired";
                        k.ExpiredAtUtc = now;
                    }

                    var remainingActive = await db.Set<GameMembership>()
                        .CountAsync(mb => mb.RoomId == lockedRoom.Id && mb.Status == GameMembershipStatus.Active && mb.Id != lockedM.Id, ct);

                    if (remainingActive == 0 && lockedRoom.State == GameRoomState.Lobby)
                    {
                        lockedRoom.State = GameRoomState.Ended;
                    }
                }

                await db.SaveChangesAsync(ct);
                await tx.CommitAsync(ct);
                processedCount++;
            }
        }

        // 2. Process room deadlines
        var expiredRooms = await db.Set<GameRoom>()
            .Where(r => !r.IsPaused && r.DeadlineUtc != null && r.DeadlineUtc <= now && r.State != GameRoomState.Ended)
            .ToListAsync(ct);

        foreach (var r in expiredRooms)
        {
            await using var tx = await db.Database.BeginTransactionAsync(ct);
            await db.Database.ExecuteSqlRawAsync("SET LOCAL lock_timeout = '5s'", ct);

            var lockedRoom = await db.Set<GameRoom>()
                .FromSqlInterpolated($"SELECT * FROM \"GameRooms\" WHERE \"Id\" = {r.Id} FOR UPDATE")
                .SingleOrDefaultAsync(ct);

            if (lockedRoom != null && !lockedRoom.IsPaused && lockedRoom.DeadlineUtc <= now)
            {
                if (lockedRoom.State == GameRoomState.Lobby)
                {
                    var members = await db.Set<GameMembership>()
                        .Where(m => m.RoomId == lockedRoom.Id && m.Status == GameMembershipStatus.Active)
                        .ToListAsync(ct);

                    var fCount = members.Count(m => m.Gender == "woman");
                    var mCount = members.Count(m => m.Gender == "man");

                    if (fCount >= lockedRoom.MinFemaleStart && mCount >= lockedRoom.MinMaleStart)
                    {
                        lockedRoom.State = GameRoomState.Starting;
                        lockedRoom.DeadlineUtc = now.AddSeconds(5);
                        lockedRoom.DeadlineType = "StartingCountdown";

                        await EmitOutboxEventAsync(lockedRoom, "RoomStarting", new
                        {
                            RoomId = lockedRoom.Id,
                            State = "Starting",
                            FemaleCount = fCount,
                            MaleCount = mCount,
                            DeadlineUtc = lockedRoom.DeadlineUtc,
                            TimestampUtc = now
                        }, ct);
                    }
                }
                else if (lockedRoom.DeadlineType == "StartingCountdown")
                {
                    lockedRoom.State = GameRoomState.Playing;
                    var firstTurn = await SelectNextTurnUserIdAsync(lockedRoom.Id, Guid.Empty, ct);
                    if (firstTurn.HasValue)
                    {
                        await StartNextRoundAsync(lockedRoom, firstTurn.Value, now, ct);
                    }
                    else
                    {
                        lockedRoom.CurrentTurnUserId = null;
                        lockedRoom.DeadlineUtc = now.AddSeconds(15);
                        lockedRoom.DeadlineType = "TurnPending";
                        lockedRoom.StateVersion++;
                    }
                }
                else if (lockedRoom.DeadlineType == "TurnPending")
                {
                    var totalRounds = await db.Set<GameRound>().CountAsync(r => r.RoomId == lockedRoom.Id, ct);
                    if (totalRounds >= 18)
                    {
                        await EndGameAsync(lockedRoom, totalRounds, now, ct);
                    }
                    else
                    {
                        var turnUser = lockedRoom.CurrentTurnUserId;
                        if (!turnUser.HasValue)
                        {
                            turnUser = await SelectNextTurnUserIdAsync(lockedRoom.Id, Guid.Empty, ct);
                        }
                        if (turnUser.HasValue)
                        {
                            await StartNextRoundAsync(lockedRoom, turnUser.Value, now, ct);
                        }
                    }
                }
                else if (lockedRoom.DeadlineType == "Spinning")
                {
                    if (lockedRoom.CurrentRoundId.HasValue)
                    {
                        var round = await db.Set<GameRound>().SingleOrDefaultAsync(rd => rd.Id == lockedRoom.CurrentRoundId.Value, ct);
                        if (round != null && round.State == "Spinning")
                        {
                            if (round.TargetUserId != Guid.Empty)
                            {
                                await TransitionToQuestionPhaseAsync(lockedRoom, round, round.TargetUserId, now, ct);
                            }
                            else
                            {
                                round.State = "SelectingTarget";
                                lockedRoom.DeadlineUtc = now.AddSeconds(15);
                                lockedRoom.DeadlineType = "TargetSelection";
                                lockedRoom.StateVersion++;

                                await EmitOutboxEventAsync(lockedRoom, "TargetSelectionStarted", new
                                {
                                    RoomId = lockedRoom.Id,
                                    RoundId = round.Id,
                                    SpinnerUserId = round.SpinnerUserId,
                                    DeadlineUtc = lockedRoom.DeadlineUtc,
                                    TimestampUtc = now
                                }, ct);
                            }
                        }
                    }
                }
                else if (lockedRoom.DeadlineType == "TargetSelection")
                {
                    if (lockedRoom.CurrentRoundId.HasValue)
                    {
                        var round = await db.Set<GameRound>().SingleOrDefaultAsync(rd => rd.Id == lockedRoom.CurrentRoundId.Value, ct);
                        if (round != null && round.State == "SelectingTarget")
                        {
                            round.State = "EndedEarly";
                            round.CompletedAtUtc = now;
                            var totalRounds = await db.Set<GameRound>().CountAsync(r => r.RoomId == lockedRoom.Id, ct);
                            if (totalRounds >= 18)
                            {
                                await EndGameAsync(lockedRoom, totalRounds, now, ct);
                            }
                            else
                            {
                                var nextTurn = await SelectNextTurnUserIdAsync(lockedRoom.Id, round.SpinnerUserId, ct);
                                lockedRoom.CurrentTurnUserId = nextTurn;
                                lockedRoom.DeadlineUtc = now.AddSeconds(15);
                                lockedRoom.DeadlineType = "TurnPending";
                                lockedRoom.StateVersion++;

                                await EmitOutboxEventAsync(lockedRoom, "RoundEndedEarly", new
                                {
                                    RoomId = lockedRoom.Id,
                                    RoundId = round.Id,
                                    Reason = "target_selection_timeout",
                                    NextTurnUserId = nextTurn,
                                    DeadlineUtc = lockedRoom.DeadlineUtc,
                                    TimestampUtc = now
                                }, ct);
                            }
                        }
                    }
                }
                else if (lockedRoom.DeadlineType == "QuestionAnswering")
                {
                    if (lockedRoom.CurrentRoundId.HasValue)
                    {
                        var round = await db.Set<GameRound>().SingleOrDefaultAsync(rd => rd.Id == lockedRoom.CurrentRoundId.Value, ct);
                        if (round != null && round.State == "QuestionAnswering")
                        {
                            var qIndex = round.CurrentQuestionIndex;
                            var existingAnswers = await db.Set<GameRoundAnswer>()
                                .Where(a => a.RoundId == round.Id && a.QuestionIndex == qIndex)
                                .ToListAsync(ct);

                            if (!existingAnswers.Any(a => a.UserId == round.SpinnerUserId))
                            {
                                db.Set<GameRoundAnswer>().Add(new GameRoundAnswer
                                {
                                    Id = Guid.NewGuid(),
                                    RoundId = round.Id,
                                    QuestionIndex = qIndex,
                                    UserId = round.SpinnerUserId,
                                    IsSkipped = true,
                                    IdempotencyKey = "timeout_" + Guid.NewGuid().ToString("N"),
                                    SubmittedAtUtc = now
                                });
                            }

                            if (!existingAnswers.Any(a => a.UserId == round.TargetUserId))
                            {
                                db.Set<GameRoundAnswer>().Add(new GameRoundAnswer
                                {
                                    Id = Guid.NewGuid(),
                                    RoundId = round.Id,
                                    QuestionIndex = qIndex,
                                    UserId = round.TargetUserId,
                                    IsSkipped = true,
                                    IdempotencyKey = "timeout_" + Guid.NewGuid().ToString("N"),
                                    SubmittedAtUtc = now
                                });
                            }

                            round.ConsecutiveIncompleteQuestions++;
                            var revealedList = JsonSerializer.Deserialize<List<RevealedSelectionDto>>(round.RevealedSelectionsJson) ?? [];
                            revealedList.Add(new RevealedSelectionDto(
                                qIndex,
                                null,
                                null,
                                true,
                                false,
                                "დრო ამოიწურა. კითხვა გამოტოვებულია."
                            ));
                            round.RevealedSelectionsJson = JsonSerializer.Serialize(revealedList);

                            if (round.ConsecutiveIncompleteQuestions >= 2)
                            {
                                round.State = "EndedEarly";
                                round.CompletedAtUtc = now;
                                var nextTurn = await SelectNextTurnUserIdAsync(lockedRoom.Id, round.SpinnerUserId, ct);
                                lockedRoom.CurrentTurnUserId = nextTurn;
                                lockedRoom.DeadlineUtc = now.AddSeconds(15);
                                lockedRoom.DeadlineType = "TurnPending";
                                lockedRoom.StateVersion++;

                                await EmitOutboxEventAsync(lockedRoom, "RoundEndedEarly", new
                                {
                                    RoomId = lockedRoom.Id,
                                    RoundId = round.Id,
                                    Reason = "consecutive_incomplete_questions",
                                    NextTurnUserId = nextTurn,
                                    DeadlineUtc = lockedRoom.DeadlineUtc,
                                    TimestampUtc = now
                                }, ct);
                            }
                            else
                            {
                                round.State = "QuestionRevealing";
                                lockedRoom.DeadlineUtc = now.AddSeconds(4);
                                lockedRoom.DeadlineType = "QuestionRevealing";
                                lockedRoom.StateVersion++;

                                await EmitOutboxEventAsync(lockedRoom, "QuestionRevealed", new
                                {
                                    RoomId = lockedRoom.Id,
                                    RoundId = round.Id,
                                    QuestionIndex = qIndex,
                                    IsSuppressed = true,
                                    IsMatch = false,
                                    Commentary = "დრო ამოიწურა. კითხვა გამოტოვებულია.",
                                    TimestampUtc = now
                                }, ct);
                            }
                        }
                    }
                }
                else if (lockedRoom.DeadlineType == "QuestionRevealing")
                {
                    if (lockedRoom.CurrentRoundId.HasValue)
                    {
                        var round = await db.Set<GameRound>().SingleOrDefaultAsync(rd => rd.Id == lockedRoom.CurrentRoundId.Value, ct);
                        if (round != null && round.State == "QuestionRevealing")
                        {
                            var roundQuestions = JsonSerializer.Deserialize<List<FrozenQuestionDto>>(round.QuestionsJson) ?? [];
                            if (round.CurrentQuestionIndex < (roundQuestions.Count - 1) && round.ConsecutiveIncompleteQuestions < 2)
                            {
                                round.CurrentQuestionIndex++;
                                round.State = "QuestionAnswering";
                                lockedRoom.DeadlineUtc = now.AddSeconds(20);
                                lockedRoom.DeadlineType = "QuestionAnswering";
                                lockedRoom.StateVersion++;

                                await EmitOutboxEventAsync(lockedRoom, "QuestionStarted", new
                                {
                                    RoomId = lockedRoom.Id,
                                    RoundId = round.Id,
                                    QuestionIndex = round.CurrentQuestionIndex,
                                    SpinnerUserId = round.SpinnerUserId,
                                    TargetUserId = round.TargetUserId,
                                    DeadlineUtc = lockedRoom.DeadlineUtc,
                                    TimestampUtc = now
                                }, ct);
                            }
                            else if (round.ConsecutiveIncompleteQuestions >= 2)
                            {
                                round.State = "EndedEarly";
                                round.CompletedAtUtc = now;
                                round.SummaryCommentary = await GenerateRoundSummaryCommentaryAsync(round, ct);
                                var totalRounds = await db.Set<GameRound>().CountAsync(r => r.RoomId == lockedRoom.Id, ct);
                                if (totalRounds >= 18)
                                {
                                    await EndGameAsync(lockedRoom, totalRounds, now, ct);
                                }
                                else
                                {
                                    var nextTurn = await SelectNextTurnUserIdAsync(lockedRoom.Id, round.SpinnerUserId, ct);
                                    lockedRoom.CurrentTurnUserId = nextTurn;
                                    lockedRoom.DeadlineUtc = now.AddSeconds(15);
                                    lockedRoom.DeadlineType = "TurnPending";
                                    lockedRoom.StateVersion++;
                                }

                                await EmitOutboxEventAsync(lockedRoom, "RoundEndedEarly", new
                                {
                                    RoomId = lockedRoom.Id,
                                    RoundId = round.Id,
                                    Reason = "consecutive_incomplete_questions",
                                    SummaryCommentary = round.SummaryCommentary,
                                    NextTurnUserId = lockedRoom.CurrentTurnUserId,
                                    DeadlineUtc = lockedRoom.DeadlineUtc,
                                    TimestampUtc = now
                                }, ct);
                            }
                            else
                            {
                                round.State = "KissChoice";
                                round.SummaryCommentary = await GenerateRoundSummaryCommentaryAsync(round, ct);
                                lockedRoom.DeadlineUtc = now.AddSeconds(15);
                                lockedRoom.DeadlineType = "KissChoice";
                                lockedRoom.StateVersion++;

                                await EmitOutboxEventAsync(lockedRoom, "KissChoiceStarted", new
                                {
                                    RoomId = lockedRoom.Id,
                                    RoundId = round.Id,
                                    SpinnerUserId = round.SpinnerUserId,
                                    DefaultTargetUserId = round.TargetUserId,
                                    SummaryCommentary = round.SummaryCommentary,
                                    DeadlineUtc = lockedRoom.DeadlineUtc,
                                    TimestampUtc = now
                                }, ct);
                            }
                        }
                    }
                }
                else if (lockedRoom.DeadlineType == "KissChoice")
                {
                    if (lockedRoom.CurrentRoundId.HasValue)
                    {
                        var round = await db.Set<GameRound>().SingleOrDefaultAsync(rd => rd.Id == lockedRoom.CurrentRoundId.Value, ct);
                        if (round != null && round.State == "KissChoice")
                        {
                            round.KissSkipped = true;
                            round.State = "Completed";
                            round.CompletedAtUtc = now;

                            var totalRounds = await db.Set<GameRound>().CountAsync(r => r.RoomId == lockedRoom.Id, ct);
                            if (totalRounds >= 18)
                            {
                                await EndGameAsync(lockedRoom, totalRounds, now, ct);
                            }
                            else
                            {
                                var nextTurn = await SelectNextTurnUserIdAsync(lockedRoom.Id, round.SpinnerUserId, ct);
                                lockedRoom.CurrentTurnUserId = nextTurn;
                                lockedRoom.DeadlineUtc = now.AddSeconds(15);
                                lockedRoom.DeadlineType = "TurnPending";
                                lockedRoom.StateVersion++;
                            }

                            await EmitOutboxEventAsync(lockedRoom, "RoundCompleted", new
                            {
                                RoomId = lockedRoom.Id,
                                RoundId = round.Id,
                                NextTurnUserId = lockedRoom.CurrentTurnUserId,
                                DeadlineUtc = lockedRoom.DeadlineUtc,
                                TimestampUtc = now
                            }, ct);
                        }
                    }
                }

                await db.SaveChangesAsync(ct);
                await tx.CommitAsync(ct);
                processedCount++;
            }
        }

        // 3. Dispatch pending outbox events
        await DispatchPendingOutboxEvents(ct);

        return processedCount;
    }

    public async Task EnsureSeededQuestionsAsync(CancellationToken ct)
    {
        var count = await db.Set<GameQuestion>().CountAsync(ct);
        if (count < 20)
        {
            var now = clock.GetUtcNow();
            var existingTexts = await db.Set<GameQuestion>().Select(q => q.QuestionText).ToListAsync(ct);
            var seed = GameQuestionCatalog.CreateSeedQuestions(now);
            foreach (var q in seed)
            {
                if (!existingTexts.Contains(q.QuestionText))
                {
                    db.Set<GameQuestion>().Add(q);
                }
            }
            await db.SaveChangesAsync(ct);
        }
    }

    public async Task<Guid?> SelectNextTurnUserIdAsync(Guid roomId, Guid currentUserId, CancellationToken ct)
    {
        var activeMembers = await db.Set<GameMembership>()
            .Where(m => m.RoomId == roomId && m.Status == GameMembershipStatus.Active)
            .OrderBy(m => m.JoinedAtUtc)
            .ToListAsync(ct);

        if (activeMembers.Count == 0) return null;

        var women = activeMembers.Where(m => m.Gender == "woman").OrderBy(m => m.JoinedAtUtc).ToList();
        var men = activeMembers.Where(m => m.Gender == "man").OrderBy(m => m.JoinedAtUtc).ToList();

        var interleaved = new List<Guid>();
        var maxCount = Math.Max(women.Count, men.Count);
        for (var i = 0; i < maxCount; i++)
        {
            if (i < women.Count) interleaved.Add(women[i].UserId);
            if (i < men.Count) interleaved.Add(men[i].UserId);
        }

        if (interleaved.Count == 0) return activeMembers[0].UserId;

        var currentIndex = interleaved.IndexOf(currentUserId);
        if (currentIndex < 0) return interleaved[0];

        var nextIndex = (currentIndex + 1) % interleaved.Count;
        return interleaved[nextIndex];
    }

    public async Task StartNextRoundAsync(GameRoom room, Guid spinnerUserId, DateTimeOffset now, CancellationToken ct)
    {
        var activeMembers = await db.Set<GameMembership>()
            .Where(m => m.RoomId == room.Id && m.Status == GameMembershipStatus.Active)
            .OrderBy(m => m.JoinedAtUtc)
            .ThenBy(m => m.Id)
            .ToListAsync(ct);

        var index = activeMembers.FindIndex(m => m.UserId == spinnerUserId);
        var total = activeMembers.Count > 0 ? activeMembers.Count : 6;
        var angle = index >= 0 ? (int)((index / (double)total) * 360) : RandomNumberGenerator.GetInt32(0, 360);

        var roundNumber = await db.Set<GameRound>().CountAsync(r => r.RoomId == room.Id, ct) + 1;

        var round = new GameRound
        {
            Id = Guid.NewGuid(),
            RoomId = room.Id,
            RoundNumber = roundNumber,
            SpinnerUserId = spinnerUserId,
            TargetUserId = Guid.Empty,
            AngleDegrees = angle,
            State = "Spinning",
            CurrentQuestionIndex = 0,
            ConsecutiveIncompleteQuestions = 0,
            QuestionsJson = "[]",
            RevealedSelectionsJson = "[]",
            StartedAtUtc = now
        };
        db.Set<GameRound>().Add(round);

        room.CurrentRoundId = round.Id;
        room.CurrentTurnUserId = spinnerUserId;
        room.DeadlineUtc = now.AddSeconds(4);
        room.DeadlineType = "Spinning";
        room.State = GameRoomState.Playing;
        room.StateVersion++;

        await EmitOutboxEventAsync(room, "BottleSpun", new
        {
            RoomId = room.Id,
            RoundId = round.Id,
            SpinnerUserId = spinnerUserId,
            TargetUserId = Guid.Empty,
            AngleDegrees = angle,
            SpinDurationMs = 4000,
            DeadlineUtc = room.DeadlineUtc,
            TimestampUtc = now
        }, ct);
    }

    public async Task<Guid?> PickFallbackTargetUserIdAsync(Guid roomId, Guid spinnerUserId, CancellationToken ct)
    {
        var callerMembership = await db.Set<GameMembership>()
            .SingleOrDefaultAsync(m => m.RoomId == roomId && m.UserId == spinnerUserId && m.Status == GameMembershipStatus.Active, ct);
        if (callerMembership is null) return null;

        var oppositeGender = callerMembership.Gender == "woman" ? "man" : "woman";
        var candidateMembers = await db.Set<GameMembership>()
            .Where(m => m.RoomId == roomId && m.Status == GameMembershipStatus.Active && m.Gender == oppositeGender && m.UserId != spinnerUserId)
            .ToListAsync(ct);

        var eligible = new List<GameMembership>();
        foreach (var c in candidateMembers)
        {
            if (!await CheckIncompatible(spinnerUserId, [c.UserId], ct))
                eligible.Add(c);
        }

        if (eligible.Count == 0) return null;
        var idx = RandomNumberGenerator.GetInt32(eligible.Count);
        return eligible[idx].UserId;
    }

    private async Task<FrozenQuestionDto> TransitionToQuestionPhaseAsync(
        GameRoom room,
        GameRound round,
        Guid targetUserId,
        DateTimeOffset now,
        CancellationToken ct)
    {
        round.TargetUserId = targetUserId;

        var existing = !string.IsNullOrWhiteSpace(round.QuestionsJson) && round.QuestionsJson != "[]"
            ? JsonSerializer.Deserialize<List<FrozenQuestionDto>>(round.QuestionsJson)
            : null;

        List<FrozenQuestionDto> frozen;
        if (existing != null && existing.Count > 0)
        {
            frozen = existing;
        }
        else
        {
            await EnsureSeededQuestionsAsync(ct);
            var allQuestions = await db.Set<GameQuestion>()
                .Where(q => q.IsActive)
                .ToListAsync(ct);

            var shuffled = allQuestions.OrderBy(_ => RandomNumberGenerator.GetInt32(10000)).Take(1).ToList();
            frozen = shuffled.Select(q => new FrozenQuestionDto(
                q.Id,
                q.QuestionText,
                JsonSerializer.Deserialize<string[]>(q.OptionsJson) ?? Array.Empty<string>(),
                q.Category
            )).ToList();

            round.QuestionsJson = JsonSerializer.Serialize(frozen);
        }

        round.State = "QuestionAnswering";
        round.CurrentQuestionIndex = 0;

        room.DeadlineUtc = now.AddSeconds(15);
        room.DeadlineType = "QuestionAnswering";
        room.StateVersion++;

        var currentQ = frozen.First();

        await EmitOutboxEventAsync(room, "QuestionStarted", new
        {
            RoomId = room.Id,
            RoundId = round.Id,
            QuestionIndex = 0,
            SpinnerUserId = round.SpinnerUserId,
            TargetUserId = targetUserId,
            DeadlineUtc = room.DeadlineUtc,
            TimestampUtc = now
        }, ct);

        return currentQ;
    }

    private async Task EndGameAsync(GameRoom room, int totalRounds, DateTimeOffset now, CancellationToken ct)
    {
        room.State = GameRoomState.Ended;
        room.DeadlineType = "GameEnded";
        room.DeadlineUtc = null;
        room.CurrentRoundId = null;
        room.CurrentTurnUserId = null;
        room.StateVersion++;

        var roomMembers = await db.Set<GameMembership>()
            .Where(m => m.RoomId == room.Id && (m.Status == GameMembershipStatus.Active || m.Status == GameMembershipStatus.Disconnected))
            .ToListAsync(ct);
        foreach (var m in roomMembers)
        {
            m.Status = GameMembershipStatus.Expired;
            m.LeftAtUtc = now;
        }

        await EmitOutboxEventAsync(room, "GameEnded", new
        {
            RoomId = room.Id,
            TotalRounds = totalRounds,
            TimestampUtc = now
        }, ct);
    }

    public async Task<SelectTargetResult> SelectTarget(Guid roomId, Guid roundId, Guid userId, Guid targetUserId, CancellationToken ct)
    {
        if (userId == targetUserId)
            throw new AuthFailure(400, "cannot_target_self");

        await using var tx = await db.Database.BeginTransactionAsync(ct);
        await db.Database.ExecuteSqlRawAsync("SET LOCAL lock_timeout = '5s'", ct);

        var room = await db.Set<GameRoom>()
            .FromSqlInterpolated($"SELECT * FROM \"GameRooms\" WHERE \"Id\" = {roomId} FOR UPDATE")
            .SingleOrDefaultAsync(ct);

        if (room is null) throw new AuthFailure(404, "room_not_found");
        if (room.State != GameRoomState.Playing) throw new AuthFailure(400, "room_not_playing");

        var round = await db.Set<GameRound>()
            .FromSqlInterpolated($"SELECT * FROM \"GameRounds\" WHERE \"Id\" = {roundId} FOR UPDATE")
            .SingleOrDefaultAsync(ct);

        if (round is null || round.RoomId != roomId) throw new AuthFailure(404, "round_not_found");
        if (round.SpinnerUserId != userId) throw new AuthFailure(403, "not_spinner");
        if (round.State != "SelectingTarget") throw new AuthFailure(400, "round_not_selecting_target");

        var callerMembership = await db.Set<GameMembership>()
            .SingleOrDefaultAsync(m => m.RoomId == roomId && m.UserId == userId && m.Status == GameMembershipStatus.Active, ct);
        if (callerMembership is null) throw new AuthFailure(403, "not_active_member");

        var targetMembership = await db.Set<GameMembership>()
            .SingleOrDefaultAsync(m => m.RoomId == roomId && m.UserId == targetUserId && m.Status == GameMembershipStatus.Active, ct);
        if (targetMembership is null) throw new AuthFailure(404, "target_not_active_member");

        var oppositeGender = callerMembership.Gender == "woman" ? "man" : "woman";
        if (targetMembership.Gender != oppositeGender)
            throw new AuthFailure(400, "target_not_opposite_gender");

        var incomp = await CheckIncompatible(userId, [targetUserId], ct);
        if (incomp) throw new AuthFailure(403, "target_incompatible");

        var now = clock.GetUtcNow();
        var q = await TransitionToQuestionPhaseAsync(room, round, targetUserId, now, ct);

        await db.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);

        return new SelectTargetResult(round.Id, userId, targetUserId, q, room.DeadlineUtc!.Value);
    }

    public async Task<SkipTargetResult> SkipTarget(Guid roomId, Guid roundId, Guid userId, string? idempotencyKey, CancellationToken ct)
    {
        await using var tx = await db.Database.BeginTransactionAsync(ct);
        await db.Database.ExecuteSqlRawAsync("SET LOCAL lock_timeout = '5s'", ct);

        var room = await db.Set<GameRoom>()
            .FromSqlInterpolated($"SELECT * FROM \"GameRooms\" WHERE \"Id\" = {roomId} FOR UPDATE")
            .SingleOrDefaultAsync(ct);

        if (room is null) throw new AuthFailure(404, "room_not_found");
        if (room.State != GameRoomState.Playing) throw new AuthFailure(400, "room_not_playing");

        var round = await db.Set<GameRound>()
            .FromSqlInterpolated($"SELECT * FROM \"GameRounds\" WHERE \"Id\" = {roundId} FOR UPDATE")
            .SingleOrDefaultAsync(ct);

        if (round is null || round.RoomId != roomId) throw new AuthFailure(404, "round_not_found");
        if (round.SpinnerUserId != userId) throw new AuthFailure(403, "not_spinner");
        if (round.State != "SelectingTarget" && round.State != "Spinning") throw new AuthFailure(400, "round_not_selecting_target");

        var now = clock.GetUtcNow();
        round.State = "EndedEarly";
        round.CompletedAtUtc = now;
        round.TargetUserId = Guid.Empty;

        var totalRounds = await db.Set<GameRound>().CountAsync(r => r.RoomId == roomId, ct);
        Guid? nextTurn = null;
        if (totalRounds >= 18)
        {
            await EndGameAsync(room, totalRounds, now, ct);
        }
        else
        {
            nextTurn = await SelectNextTurnUserIdAsync(roomId, round.SpinnerUserId, ct);
            room.CurrentTurnUserId = nextTurn;
            room.DeadlineUtc = now.AddSeconds(15);
            room.DeadlineType = "TurnPending";
            room.StateVersion++;

            await EmitOutboxEventAsync(room, "RoundEndedEarly", new
            {
                RoomId = roomId,
                RoundId = round.Id,
                Reason = "target_skipped",
                NextTurnUserId = nextTurn,
                DeadlineUtc = room.DeadlineUtc,
                TimestampUtc = now
            }, ct);
        }

        await db.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);

        return new SkipTargetResult(round.Id, userId, "Skipped", room.DeadlineUtc);
    }

    public async Task<PostGameKissResult> PostGameKiss(Guid roomId, Guid userId, PostGameKissRequest req, CancellationToken ct)
    {
        if (req.RecipientUserId == userId)
            throw new AuthFailure(400, "cannot_kiss_self");

        await using var tx = await db.Database.BeginTransactionAsync(ct);
        await db.Database.ExecuteSqlRawAsync("SET LOCAL lock_timeout = '5s'", ct);

        var room = await db.Set<GameRoom>()
            .FromSqlInterpolated($"SELECT * FROM \"GameRooms\" WHERE \"Id\" = {roomId} FOR UPDATE")
            .SingleOrDefaultAsync(ct);

        if (room is null) throw new AuthFailure(404, "room_not_found");
        if (room.State != GameRoomState.Ended)
            throw new AuthFailure(400, "room_not_ended");

        var callerMembership = await db.Set<GameMembership>()
            .SingleOrDefaultAsync(m => m.RoomId == roomId && m.UserId == userId, ct);
        if (callerMembership is null) throw new AuthFailure(403, "not_room_member");

        var recipientMembership = await db.Set<GameMembership>()
            .SingleOrDefaultAsync(m => m.RoomId == roomId && m.UserId == req.RecipientUserId, ct);
        if (recipientMembership is null) throw new AuthFailure(404, "recipient_not_member");

        var incomp = await CheckIncompatible(userId, [req.RecipientUserId], ct);
        if (incomp) throw new AuthFailure(403, "incompatible_user");

        var lastRound = await db.Set<GameRound>()
            .Where(r => r.RoomId == roomId)
            .OrderByDescending(r => r.RoundNumber)
            .FirstOrDefaultAsync(ct);
        var roundId = lastRound?.Id ?? Guid.Empty;

        var existingKiss = await db.Set<GameKiss>()
            .SingleOrDefaultAsync(k => k.RoomId == roomId && k.SenderUserId == userId && k.RecipientUserId == req.RecipientUserId, ct);

        if (existingKiss != null)
        {
            return new PostGameKissResult(existingKiss.Id, userId, req.RecipientUserId, existingKiss.Status, existingKiss.Status == "Matched");
        }

        var now = clock.GetUtcNow();

        var reciprocalKiss = await db.Set<GameKiss>()
            .SingleOrDefaultAsync(k => k.RoomId == roomId && k.SenderUserId == req.RecipientUserId && k.RecipientUserId == userId && k.Status == "Pending", ct);

        var isMutualMatch = reciprocalKiss != null;
        Guid? createdMatchId = null;
        Guid? createdConvId = null;

        var kiss = new GameKiss
        {
            Id = Guid.NewGuid(),
            RoomId = roomId,
            RoundId = roundId,
            SenderUserId = userId,
            RecipientUserId = req.RecipientUserId,
            SenderGeneration = callerMembership.Generation,
            RecipientGeneration = recipientMembership.Generation,
            Status = isMutualMatch ? "Matched" : "Pending",
            IdempotencyKey = req.IdempotencyKey,
            CreatedAtUtc = now,
            MatchedAtUtc = isMutualMatch ? now : null
        };
        db.Set<GameKiss>().Add(kiss);

        if (isMutualMatch && matchService != null)
        {
            reciprocalKiss!.Status = "Matched";
            reciprocalKiss.MatchedAtUtc = now;

            var (match, conversation, _) = await matchService.CreateOrUnlockGameMatchAsync(userId, req.RecipientUserId, ct);
            createdMatchId = match.Id;
            createdConvId = conversation.Id;

            var decA = await db.Set<DiscoveryDecision>().SingleOrDefaultAsync(d => d.UserId == userId && d.TargetId == req.RecipientUserId, ct);
            if (decA == null) db.Set<DiscoveryDecision>().Add(new DiscoveryDecision { UserId = userId, TargetId = req.RecipientUserId, Kind = "like" });
            else decA.Kind = "like";

            var decB = await db.Set<DiscoveryDecision>().SingleOrDefaultAsync(d => d.UserId == req.RecipientUserId && d.TargetId == userId, ct);
            if (decB == null) db.Set<DiscoveryDecision>().Add(new DiscoveryDecision { UserId = req.RecipientUserId, TargetId = userId, Kind = "like" });
            else decB.Kind = "like";

            await EmitOutboxEventAsync(room, "GameMatchCreated", new
            {
                RoomId = roomId,
                MatchId = match.Id,
                UserA = userId,
                UserB = req.RecipientUserId,
                Origin = "GameArena",
                HasChatEntitlement = false,
                TimestampUtc = now
            }, ct);
        }
        else
        {
            var dec = await db.Set<DiscoveryDecision>().SingleOrDefaultAsync(d => d.UserId == userId && d.TargetId == req.RecipientUserId, ct);
            if (dec is null)
            {
                db.Set<DiscoveryDecision>().Add(new DiscoveryDecision
                {
                    UserId = userId,
                    TargetId = req.RecipientUserId,
                    Kind = "like"
                });
            }
            else if (dec.Kind != "like")
            {
                dec.Kind = "like";
            }
        }

        await db.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);

        return new PostGameKissResult(kiss.Id, userId, req.RecipientUserId, kiss.Status, isMutualMatch, createdMatchId, createdConvId);
    }

    public async Task<SpinResult> SpinBottle(Guid roomId, Guid userId, bool autoPickTarget = true, CancellationToken ct = default)
    {
        await using var tx = await db.Database.BeginTransactionAsync(ct);
        await db.Database.ExecuteSqlRawAsync("SET LOCAL lock_timeout = '5s'", ct);

        var room = await db.Set<GameRoom>()
            .FromSqlInterpolated($"SELECT * FROM \"GameRooms\" WHERE \"Id\" = {roomId} FOR UPDATE")
            .SingleOrDefaultAsync(ct);

        if (room is null) throw new AuthFailure(404, "room_not_found");
        if (room.State != GameRoomState.Playing && room.State != GameRoomState.Starting)
            throw new AuthFailure(400, "room_not_playing");

        if (room.CurrentTurnUserId != null && room.CurrentTurnUserId != userId)
            throw new AuthFailure(403, "not_your_turn");

        var callerMembership = await db.Set<GameMembership>()
            .SingleOrDefaultAsync(m => m.RoomId == roomId && m.UserId == userId && m.Status == GameMembershipStatus.Active, ct);
        if (callerMembership is null) throw new AuthFailure(403, "not_active_member");

        var activeMembers = await db.Set<GameMembership>()
            .Where(m => m.RoomId == roomId && m.Status == GameMembershipStatus.Active)
            .OrderBy(m => m.JoinedAtUtc)
            .ThenBy(m => m.Id)
            .ToListAsync(ct);

        var oppositeGender = callerMembership.Gender == "woman" ? "man" : "woman";
        var candidateMembers = activeMembers.Where(m => m.UserId != userId && m.Gender == oppositeGender).ToList();

        var eligible = new List<GameMembership>();
        foreach (var candidate in candidateMembers)
        {
            var incomp = await CheckIncompatible(userId, [candidate.UserId], ct);
            if (!incomp)
            {
                eligible.Add(candidate);
            }
        }

        if (eligible.Count == 0)
            throw new AuthFailure(400, "no_eligible_partners");

        var now = clock.GetUtcNow();

        if (room.CurrentRoundId.HasValue)
        {
            var activeRound = await db.Set<GameRound>().SingleOrDefaultAsync(r => r.Id == room.CurrentRoundId.Value, ct);
            if (activeRound != null && activeRound.SpinnerUserId == userId)
            {
                if (activeRound.State == "Spinning" && activeRound.TargetUserId == Guid.Empty)
                {
                    if (autoPickTarget)
                    {
                        var fallbackTarget = eligible[RandomNumberGenerator.GetInt32(eligible.Count)];
                        activeRound.TargetUserId = fallbackTarget.UserId;
                        await db.SaveChangesAsync(ct);
                        await tx.CommitAsync(ct);
                        return new SpinResult(activeRound.Id, userId, fallbackTarget.UserId, activeRound.AngleDegrees, 4000, room.DeadlineUtc ?? now.AddSeconds(4));
                    }
                    else
                    {
                        return new SpinResult(activeRound.Id, userId, Guid.Empty, activeRound.AngleDegrees, 4000, room.DeadlineUtc ?? now.AddSeconds(4));
                    }
                }
                if (activeRound.State == "SelectingTarget")
                {
                    if (autoPickTarget)
                    {
                        var fallbackTarget = eligible[RandomNumberGenerator.GetInt32(eligible.Count)];
                        await TransitionToQuestionPhaseAsync(room, activeRound, fallbackTarget.UserId, now, ct);
                        await db.SaveChangesAsync(ct);
                        await tx.CommitAsync(ct);
                        return new SpinResult(activeRound.Id, userId, fallbackTarget.UserId, activeRound.AngleDegrees, 4000, room.DeadlineUtc!.Value);
                    }
                    else
                    {
                        return new SpinResult(activeRound.Id, userId, Guid.Empty, activeRound.AngleDegrees, 4000, room.DeadlineUtc ?? now.AddSeconds(15));
                    }
                }
            }
            if (activeRound != null && activeRound.State != "Completed" && activeRound.State != "EndedEarly")
            {
                throw new AuthFailure(409, "round_in_progress");
            }
        }

        var targetUserId = autoPickTarget ? eligible[RandomNumberGenerator.GetInt32(eligible.Count)].UserId : Guid.Empty;

        var index = activeMembers.FindIndex(m => m.UserId == userId);
        var total = activeMembers.Count > 0 ? activeMembers.Count : 6;
        var angle = index >= 0 ? (int)((index / (double)total) * 360) : RandomNumberGenerator.GetInt32(0, 360);

        string questionsJson = "[]";
        if (autoPickTarget)
        {
            await EnsureSeededQuestionsAsync(ct);

            var allQuestions = await db.Set<GameQuestion>()
                .Where(q => q.IsActive)
                .ToListAsync(ct);

            var shuffled = allQuestions.OrderBy(_ => RandomNumberGenerator.GetInt32(10000)).Take(1).ToList();
            var frozen = shuffled.Select(q => new FrozenQuestionDto(
                q.Id,
                q.QuestionText,
                JsonSerializer.Deserialize<string[]>(q.OptionsJson) ?? Array.Empty<string>(),
                q.Category
            )).ToList();
            questionsJson = JsonSerializer.Serialize(frozen);
        }

        var roundNumber = await db.Set<GameRound>().CountAsync(r => r.RoomId == roomId, ct) + 1;

        var round = new GameRound
        {
            Id = Guid.NewGuid(),
            RoomId = roomId,
            RoundNumber = roundNumber,
            SpinnerUserId = userId,
            TargetUserId = targetUserId,
            AngleDegrees = angle,
            State = "Spinning",
            CurrentQuestionIndex = 0,
            ConsecutiveIncompleteQuestions = 0,
            QuestionsJson = questionsJson,
            RevealedSelectionsJson = "[]",
            StartedAtUtc = now
        };
        db.Set<GameRound>().Add(round);

        room.CurrentRoundId = round.Id;
        room.CurrentTurnUserId = userId;
        room.DeadlineUtc = now.AddSeconds(4);
        room.DeadlineType = "Spinning";
        room.State = GameRoomState.Playing;
        room.StateVersion++;

        await EmitOutboxEventAsync(room, "BottleSpun", new
        {
            RoomId = roomId,
            RoundId = round.Id,
            SpinnerUserId = userId,
            TargetUserId = targetUserId,
            AngleDegrees = angle,
            SpinDurationMs = 4000,
            DeadlineUtc = room.DeadlineUtc,
            TimestampUtc = now
        }, ct);

        await db.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);

        return new SpinResult(round.Id, userId, targetUserId, angle, 4000, room.DeadlineUtc.Value);
    }

    public async Task<AnswerQuestionResult> AnswerQuestion(
        Guid roomId,
        Guid roundId,
        int questionIndex,
        Guid userId,
        AnswerQuestionRequest req,
        CancellationToken ct)
    {
        await using var tx = await db.Database.BeginTransactionAsync(ct);
        await db.Database.ExecuteSqlRawAsync("SET LOCAL lock_timeout = '5s'", ct);

        var room = await db.Set<GameRoom>()
            .FromSqlInterpolated($"SELECT * FROM \"GameRooms\" WHERE \"Id\" = {roomId} FOR UPDATE")
            .SingleOrDefaultAsync(ct);

        if (room is null) throw new AuthFailure(404, "room_not_found");

        var round = await db.Set<GameRound>()
            .FromSqlInterpolated($"SELECT * FROM \"GameRounds\" WHERE \"Id\" = {roundId} FOR UPDATE")
            .SingleOrDefaultAsync(ct);

        if (round is null || round.RoomId != roomId) throw new AuthFailure(404, "round_not_found");
        if (round.CurrentQuestionIndex != questionIndex) throw new AuthFailure(400, "invalid_question_index");
        if (round.State != "QuestionAnswering") throw new AuthFailure(400, "round_not_accepting_answers");

        if (userId != round.SpinnerUserId && userId != round.TargetUserId)
            throw new AuthFailure(403, "not_round_participant");

        var now = clock.GetUtcNow();
        var questions = JsonSerializer.Deserialize<List<FrozenQuestionDto>>(round.QuestionsJson) ?? [];
        if (questionIndex < 0 || questionIndex >= questions.Count)
            throw new AuthFailure(400, "invalid_question_index");

        var currentQ = questions[questionIndex];

        if (!req.IsSkipped)
        {
            if (req.SelectedOption == null || req.SelectedOption.Value < 0 || req.SelectedOption.Value >= currentQ.Options.Length)
                throw new AuthFailure(400, "invalid_option_index");
        }

        var existingAnswer = await db.Set<GameRoundAnswer>()
            .SingleOrDefaultAsync(a => a.RoundId == roundId && a.QuestionIndex == questionIndex && a.UserId == userId, ct);

        if (existingAnswer == null)
        {
            var answer = new GameRoundAnswer
            {
                Id = Guid.NewGuid(),
                RoundId = roundId,
                QuestionIndex = questionIndex,
                UserId = userId,
                SelectedOption = req.IsSkipped ? null : req.SelectedOption,
                IsSkipped = req.IsSkipped,
                IdempotencyKey = req.IdempotencyKey,
                SubmittedAtUtc = now
            };
            db.Set<GameRoundAnswer>().Add(answer);
            await db.SaveChangesAsync(ct);
        }

        var allAnswers = await db.Set<GameRoundAnswer>()
            .Where(a => a.RoundId == roundId && a.QuestionIndex == questionIndex)
            .ToListAsync(ct);

        var isSkipped = req.IsSkipped || allAnswers.Any(a => a.IsSkipped);

        if (!isSkipped && allAnswers.Count < 2)
        {
            await tx.CommitAsync(ct);
            return new AnswerQuestionResult(roundId, questionIndex, Submitted: true, WaitingForPartner: true, Revealed: false, RevealedSelection: null);
        }

        var spinnerAnswer = allAnswers.SingleOrDefault(a => a.UserId == round.SpinnerUserId);
        var targetAnswer = allAnswers.SingleOrDefault(a => a.UserId == round.TargetUserId);

        var isSuppressed = isSkipped || (spinnerAnswer?.IsSkipped == true) || (targetAnswer?.IsSkipped == true);
        var isMatch = !isSuppressed && spinnerAnswer != null && targetAnswer != null && (spinnerAnswer.SelectedOption == targetAnswer.SelectedOption);

        string commentary;
        if (isSuppressed)
        {
            commentary = "კითხვა გამოტოვებულია.";
            round.ConsecutiveIncompleteQuestions++;
        }
        else
        {
            round.ConsecutiveIncompleteQuestions = 0;

            var qText = currentQ.QuestionText;
            var opts = currentQ.Options;
            var spinnerOptText = (spinnerAnswer?.SelectedOption >= 0 && spinnerAnswer?.SelectedOption < opts.Length) ? opts[spinnerAnswer.SelectedOption.Value] : "არჩევანი 1";
            var targetOptText = (targetAnswer?.SelectedOption >= 0 && targetAnswer?.SelectedOption < opts.Length) ? opts[targetAnswer.SelectedOption.Value] : "არჩევანი 2";

            var currentRevealedSoFar = JsonSerializer.Deserialize<List<RevealedSelectionDto>>(round.RevealedSelectionsJson) ?? [];
            var recentCommentaries = currentRevealedSoFar.Select(r => r.FallbackCommentary).Where(c => !string.IsNullOrWhiteSpace(c)).TakeLast(3).ToList();

            var qContext = new QuestionCommentaryContext(
                QuestionText: qText,
                Options: opts,
                SpinnerOptionIndex: spinnerAnswer!.SelectedOption!.Value,
                SpinnerOptionText: spinnerOptText,
                TargetOptionIndex: targetAnswer!.SelectedOption!.Value,
                TargetOptionText: targetOptText,
                IsMatch: isMatch,
                Language: "ka",
                RecentCommentaries: recentCommentaries
            );

            var bothConsent = await HasAiConsentAsync(round.SpinnerUserId, round.TargetUserId, ct);
            AiCommentaryResult commResult;
            if (bothConsent)
            {
                commResult = await _aiCommentaryProvider.GenerateQuestionCommentaryAsync(qContext, ct);
            }
            else
            {
                commResult = await _deterministicProvider.GenerateQuestionCommentaryAsync(qContext, ct);
            }
            commentary = commResult.Commentary;
        }

        var revealed = new RevealedSelectionDto(
            questionIndex,
            isSuppressed ? null : spinnerAnswer?.SelectedOption,
            isSuppressed ? null : targetAnswer?.SelectedOption,
            isSuppressed,
            isMatch,
            commentary
        );

        var currentRevealed = JsonSerializer.Deserialize<List<RevealedSelectionDto>>(round.RevealedSelectionsJson) ?? [];
        if (!currentRevealed.Any(r => r.QuestionIndex == questionIndex))
        {
            currentRevealed.Add(revealed);
            round.RevealedSelectionsJson = JsonSerializer.Serialize(currentRevealed);
        }

        if (round.ConsecutiveIncompleteQuestions >= 2)
        {
            round.State = "EndedEarly";
            round.CompletedAtUtc = now;
            round.SummaryCommentary = await GenerateRoundSummaryCommentaryAsync(round, ct);
            var nextTurn = await SelectNextTurnUserIdAsync(roomId, round.SpinnerUserId, ct);
            room.CurrentTurnUserId = nextTurn;
            room.DeadlineUtc = now.AddSeconds(15);
            room.DeadlineType = "TurnPending";
        }
        else
        {
            round.State = "QuestionRevealing";
            room.DeadlineUtc = now.AddSeconds(4);
            room.DeadlineType = "QuestionRevealing";
        }

        room.StateVersion++;

        await EmitOutboxEventAsync(room, "QuestionRevealed", new
        {
            RoomId = roomId,
            RoundId = roundId,
            QuestionIndex = questionIndex,
            IsSuppressed = isSuppressed,
            IsMatch = isMatch,
            Commentary = commentary,
            TimestampUtc = now
        }, ct);

        await db.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);

        return new AnswerQuestionResult(roundId, questionIndex, Submitted: true, WaitingForPartner: false, Revealed: true, RevealedSelection: revealed);
    }

    public Task<AnswerQuestionResult> SkipQuestion(Guid roomId, Guid roundId, int questionIndex, Guid userId, string idempotencyKey, CancellationToken ct)
    {
        return AnswerQuestion(roomId, roundId, questionIndex, userId, new AnswerQuestionRequest(
            QuestionId: Guid.Empty,
            SelectedOption: null,
            IsSkipped: true,
            IdempotencyKey: idempotencyKey,
            StateVersion: 0
        ), ct);
    }

    public async Task<SendKissResult> SendKiss(Guid roomId, Guid roundId, Guid userId, SendKissRequest req, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(req.IdempotencyKey))
            throw new AuthFailure(400, "invalid_idempotency_key");
        if (req.RecipientUserId == Guid.Empty || req.RecipientUserId == userId)
            throw new AuthFailure(400, "invalid_recipient");

        await using var tx = await db.Database.BeginTransactionAsync(ct);
        await db.Database.ExecuteSqlRawAsync("SET LOCAL lock_timeout = '5s'", ct);

        var room = await db.Set<GameRoom>()
            .FromSqlInterpolated($"SELECT * FROM \"GameRooms\" WHERE \"Id\" = {roomId} FOR UPDATE")
            .SingleOrDefaultAsync(ct);

        if (room is null) throw new AuthFailure(404, "room_not_found");
        if (room.State != GameRoomState.Playing) throw new AuthFailure(400, "room_not_playing");
        if (room.CurrentRoundId != roundId) throw new AuthFailure(400, "round_not_active");

        var round = await db.Set<GameRound>()
            .SingleOrDefaultAsync(r => r.Id == roundId && r.RoomId == roomId, ct);

        if (round is null) throw new AuthFailure(404, "round_not_found");

        if (round.SpinnerUserId != userId && round.TargetUserId != userId)
            throw new AuthFailure(403, "not_round_participant");

        var expectedRecipient = (userId == round.SpinnerUserId) ? round.TargetUserId : round.SpinnerUserId;
        if (req.RecipientUserId != expectedRecipient)
            throw new AuthFailure(400, "invalid_recipient");

        if (round.State != "KissChoice" && room.DeadlineType != "KissChoice")
            throw new AuthFailure(400, "not_kiss_phase");

        var existingKiss = await db.Set<GameKiss>()
            .SingleOrDefaultAsync(k => k.RoundId == roundId && k.SenderUserId == userId, ct);

        if (existingKiss != null)
        {
            if (existingKiss.IdempotencyKey == req.IdempotencyKey && existingKiss.RecipientUserId == req.RecipientUserId)
            {
                var isMatched = existingKiss.Status == "Matched";
                Guid? matchId = null;
                Guid? convId = null;
                if (isMatched)
                {
                    var matchRow = await db.Set<DatingMatch>()
                        .Where(m => (m.FirstId == userId && m.SecondId == req.RecipientUserId) ||
                                    (m.FirstId == req.RecipientUserId && m.SecondId == userId))
                        .Select(m => new { m.Id })
                        .FirstOrDefaultAsync(ct);
                    if (matchRow != null)
                    {
                        matchId = matchRow.Id;
                        convId = await db.Set<Conversation>()
                            .Where(c => c.MatchId == matchRow.Id)
                            .Select(c => (Guid?)c.Id)
                            .FirstOrDefaultAsync(ct);
                    }
                }
                return new SendKissResult(existingKiss.Id, existingKiss.SenderUserId, existingKiss.RecipientUserId, existingKiss.Status, matchId, convId);
            }
            throw new AuthFailure(409, "kiss_already_decided");
        }

        if (round.KissSkipped)
            throw new AuthFailure(409, "kiss_already_skipped");

        var now = clock.GetUtcNow();

        var senderMembership = await db.Set<GameMembership>()
            .SingleOrDefaultAsync(m => m.RoomId == roomId && m.UserId == userId && m.Status == GameMembershipStatus.Active, ct);
        if (senderMembership is null) throw new AuthFailure(403, "not_active_member");

        var recipientMembership = await db.Set<GameMembership>()
            .SingleOrDefaultAsync(m => m.RoomId == roomId && m.UserId == req.RecipientUserId && m.Status == GameMembershipStatus.Active, ct);
        if (recipientMembership is null) throw new AuthFailure(400, "recipient_not_active");

        if (senderMembership.Gender == recipientMembership.Gender)
            throw new AuthFailure(400, "ineligible_recipient_gender");

        var incompatible = await CheckIncompatible(userId, [req.RecipientUserId], ct);
        if (incompatible) throw new AuthFailure(400, "ineligible_recipient");

        var reciprocalKiss = await db.Set<GameKiss>()
            .Where(k => k.RoomId == roomId &&
                        k.SenderUserId == req.RecipientUserId &&
                        k.RecipientUserId == userId &&
                        k.SenderGeneration == recipientMembership.Generation &&
                        k.RecipientGeneration == senderMembership.Generation &&
                        k.Status == "Pending")
            .SingleOrDefaultAsync(ct);

        var isMutualMatch = reciprocalKiss != null;
        Guid? createdMatchId = null;
        Guid? createdConvId = null;

        var kiss = new GameKiss
        {
            Id = Guid.NewGuid(),
            RoomId = roomId,
            RoundId = roundId,
            SenderUserId = userId,
            RecipientUserId = req.RecipientUserId,
            SenderGeneration = senderMembership.Generation,
            RecipientGeneration = recipientMembership.Generation,
            Status = isMutualMatch ? "Matched" : "Pending",
            IdempotencyKey = req.IdempotencyKey,
            CreatedAtUtc = now,
            MatchedAtUtc = isMutualMatch ? now : null
        };

        db.Set<GameKiss>().Add(kiss);

        if (userId == round.SpinnerUserId)
        {
            round.KissRecipientUserId = req.RecipientUserId;
            round.KissSkipped = false;
        }

        if (isMutualMatch && matchService != null)
        {
            reciprocalKiss!.Status = "Matched";
            reciprocalKiss.MatchedAtUtc = now;

            var (match, conversation, _) = await matchService.CreateOrUnlockGameMatchAsync(userId, req.RecipientUserId, ct);
            createdMatchId = match.Id;
            createdConvId = conversation.Id;

            var existingDecisionA = await db.Set<DiscoveryDecision>().SingleOrDefaultAsync(d => d.UserId == userId && d.TargetId == req.RecipientUserId, ct);
            if (existingDecisionA == null)
            {
                db.Set<DiscoveryDecision>().Add(new DiscoveryDecision { UserId = userId, TargetId = req.RecipientUserId, Kind = "like" });
            }
            else
            {
                existingDecisionA.Kind = "like";
            }
            var existingDecisionB = await db.Set<DiscoveryDecision>().SingleOrDefaultAsync(d => d.UserId == req.RecipientUserId && d.TargetId == userId, ct);
            if (existingDecisionB == null)
            {
                db.Set<DiscoveryDecision>().Add(new DiscoveryDecision { UserId = req.RecipientUserId, TargetId = userId, Kind = "like" });
            }
            else
            {
                existingDecisionB.Kind = "like";
            }

            await EmitOutboxEventAsync(room, "GameMatchCreated", new
            {
                RoomId = roomId,
                MatchId = match.Id,
                UserA = userId,
                UserB = req.RecipientUserId,
                Origin = "GameArena",
                HasChatEntitlement = false,
                TimestampUtc = now
            }, ct);
        }
        else if (await db.Set<DiscoveryDecision>().AnyAsync(d => d.UserId == req.RecipientUserId && d.TargetId == userId && d.Kind == "like", ct) && matchService != null)
        {
            // Partner had already liked in discovery; completing mutual match
            kiss.Status = "Matched";
            kiss.MatchedAtUtc = now;

            var (match, conversation, _) = await matchService.CreateOrUnlockGameMatchAsync(userId, req.RecipientUserId, ct);
            createdMatchId = match.Id;
            createdConvId = conversation.Id;

            var existingDecision = await db.Set<DiscoveryDecision>().SingleOrDefaultAsync(d => d.UserId == userId && d.TargetId == req.RecipientUserId, ct);
            if (existingDecision == null)
            {
                db.Set<DiscoveryDecision>().Add(new DiscoveryDecision { UserId = userId, TargetId = req.RecipientUserId, Kind = "like" });
            }
            else
            {
                existingDecision.Kind = "like";
            }

            await EmitOutboxEventAsync(room, "GameMatchCreated", new
            {
                RoomId = roomId,
                MatchId = match.Id,
                UserA = userId,
                UserB = req.RecipientUserId,
                Origin = "GameArena",
                HasChatEntitlement = false,
                TimestampUtc = now
            }, ct);
        }
        else
        {
            // Non-reciprocal kiss: Ensure DiscoveryDecision exists so it appears in Recipient's Requests tab
            var existingDecision = await db.Set<DiscoveryDecision>().SingleOrDefaultAsync(d => d.UserId == userId && d.TargetId == req.RecipientUserId, ct);
            if (existingDecision == null)
            {
                db.Set<DiscoveryDecision>().Add(new DiscoveryDecision
                {
                    UserId = userId,
                    TargetId = req.RecipientUserId,
                    Kind = "like"
                });
            }
            else
            {
                existingDecision.Kind = "like";
            }
        }

        // Check if partner in active pair has also decided (kiss or skip)
        var partnerDecided = await db.Set<GameKiss>()
            .AnyAsync(k => k.RoundId == roundId && k.SenderUserId == req.RecipientUserId, ct);

        if (partnerDecided)
        {
            round.State = "Completed";
            round.CompletedAtUtc = now;

            var totalRounds = await db.Set<GameRound>().CountAsync(r => r.RoomId == roomId, ct);
            if (totalRounds >= 18)
            {
                await EndGameAsync(room, totalRounds, now, ct);
            }
            else
            {
                var nextTurn = await SelectNextTurnUserIdAsync(roomId, round.SpinnerUserId, ct);
                room.CurrentTurnUserId = nextTurn;
                room.DeadlineUtc = now.AddSeconds(15);
                room.DeadlineType = "TurnPending";
                room.StateVersion++;
            }

            await EmitOutboxEventAsync(room, "RoundCompleted", new
            {
                RoomId = roomId,
                RoundId = roundId,
                NextTurnUserId = room.CurrentTurnUserId,
                DeadlineUtc = room.DeadlineUtc,
                TimestampUtc = now
            }, ct);
        }
        else
        {
            room.StateVersion++;
        }

        await db.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);

        return new SendKissResult(kiss.Id, kiss.SenderUserId, kiss.RecipientUserId, kiss.Status, createdMatchId, createdConvId);
    }

    public async Task<bool> SkipKiss(Guid roomId, Guid roundId, Guid userId, string idempotencyKey, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(idempotencyKey))
            throw new AuthFailure(400, "invalid_idempotency_key");

        await using var tx = await db.Database.BeginTransactionAsync(ct);
        await db.Database.ExecuteSqlRawAsync("SET LOCAL lock_timeout = '5s'", ct);

        var room = await db.Set<GameRoom>()
            .FromSqlInterpolated($"SELECT * FROM \"GameRooms\" WHERE \"Id\" = {roomId} FOR UPDATE")
            .SingleOrDefaultAsync(ct);

        if (room is null) throw new AuthFailure(404, "room_not_found");
        if (room.State != GameRoomState.Playing) throw new AuthFailure(400, "room_not_playing");
        if (room.CurrentRoundId != roundId) throw new AuthFailure(400, "round_not_active");

        var round = await db.Set<GameRound>()
            .SingleOrDefaultAsync(r => r.Id == roundId && r.RoomId == roomId, ct);

        if (round is null) throw new AuthFailure(404, "round_not_found");

        if (round.SpinnerUserId != userId && round.TargetUserId != userId)
            throw new AuthFailure(403, "not_round_participant");

        if (round.State != "KissChoice" && room.DeadlineType != "KissChoice")
            throw new AuthFailure(400, "not_kiss_phase");

        var existingKiss = await db.Set<GameKiss>()
            .SingleOrDefaultAsync(k => k.RoundId == roundId && k.SenderUserId == userId, ct);
        if (existingKiss != null)
        {
            if (existingKiss.Status == "Skipped") return true;
            throw new AuthFailure(409, "kiss_already_sent");
        }

        var partnerId = (userId == round.SpinnerUserId) ? round.TargetUserId : round.SpinnerUserId;
        var senderMembership = await db.Set<GameMembership>()
            .SingleOrDefaultAsync(m => m.RoomId == roomId && m.UserId == userId && m.Status == GameMembershipStatus.Active, ct);
        var partnerMembership = await db.Set<GameMembership>()
            .SingleOrDefaultAsync(m => m.RoomId == roomId && m.UserId == partnerId && m.Status == GameMembershipStatus.Active, ct);

        var now = clock.GetUtcNow();

        var skipRecord = new GameKiss
        {
            Id = Guid.NewGuid(),
            RoomId = roomId,
            RoundId = roundId,
            SenderUserId = userId,
            RecipientUserId = partnerId,
            SenderGeneration = senderMembership?.Generation ?? 1,
            RecipientGeneration = partnerMembership?.Generation ?? 1,
            Status = "Skipped",
            IdempotencyKey = idempotencyKey,
            CreatedAtUtc = now
        };
        db.Set<GameKiss>().Add(skipRecord);

        if (userId == round.SpinnerUserId)
        {
            round.KissSkipped = true;
        }

        var partnerDecided = partnerId != Guid.Empty && await db.Set<GameKiss>()
            .AnyAsync(k => k.RoundId == roundId && k.SenderUserId == partnerId, ct);

        if (partnerDecided)
        {
            round.State = "Completed";
            round.CompletedAtUtc = now;

            var totalRounds = await db.Set<GameRound>().CountAsync(r => r.RoomId == roomId, ct);
            if (totalRounds >= 18)
            {
                await EndGameAsync(room, totalRounds, now, ct);
            }
            else
            {
                var nextTurn = await SelectNextTurnUserIdAsync(roomId, round.SpinnerUserId, ct);
                room.CurrentTurnUserId = nextTurn;
                room.DeadlineUtc = now.AddSeconds(15);
                room.DeadlineType = "TurnPending";
                room.StateVersion++;
            }

            await EmitOutboxEventAsync(room, "RoundCompleted", new
            {
                RoomId = roomId,
                RoundId = roundId,
                NextTurnUserId = room.CurrentTurnUserId,
                DeadlineUtc = room.DeadlineUtc,
                TimestampUtc = now
            }, ct);
        }
        else
        {
            room.StateVersion++;
        }

        await db.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);

        return true;
    }


    public async Task<int> SeedDevFixtures(Guid roomId, DevFixtureSeedRequest req, CancellationToken ct)
    {
        if (!env.IsDevelopment() && !env.IsEnvironment("Testing"))
            throw new AuthFailure(403, "development_only");

        await using var tx = await db.Database.BeginTransactionAsync(ct);
        await db.Database.ExecuteSqlRawAsync("SET LOCAL lock_timeout = '5s'", ct);

        var room = await db.Set<GameRoom>()
            .FromSqlInterpolated($"SELECT * FROM \"GameRooms\" WHERE \"Id\" = {roomId} FOR UPDATE")
            .SingleOrDefaultAsync(ct);

        if (room is null || room.State != GameRoomState.Lobby)
            throw new AuthFailure(400, "room_not_in_lobby");

        var activeMembers = await db.Set<GameMembership>()
            .Where(m => m.RoomId == roomId && m.Status == GameMembershipStatus.Active)
            .ToListAsync(ct);

        var currentFemales = activeMembers.Count(m => m.Gender == "woman");
        var currentMales = activeMembers.Count(m => m.Gender == "man");

        var now = clock.GetUtcNow();
        var added = 0;

        // Add females
        for (var i = 0; i < req.FemaleCount && (currentFemales + i) < room.FemaleQuota; i++)
        {
            var user = new AppUser
            {
                Id = Guid.NewGuid(),
                UserName = $"fixture_female_{Guid.NewGuid():N}@test.local",
                Email = $"fixture_female_{Guid.NewGuid():N}@test.local",
                EmailConfirmed = true,
                DateOfBirth = new DateOnly(1998, 5, 15),
                IsActive = true
            };
            db.Users.Add(user);

            var profile = new DatingProfile
            {
                UserId = user.Id,
                DisplayName = $"[DEV FIXTURE] Ana {currentFemales + i + 1}",
                Bio = "Development test fixture profile for room quota validation.",
                Gender = "woman",
                DesiredGenders = ["man"],
                City = "Tbilisi",
                CityKey = "tbilisi",
                Interests = ["music", "art"],
                RelationshipGoal = "long_term",
                Visible = true
            };
            db.Set<DatingProfile>().Add(profile);

            var photo = new ProfilePhoto
            {
                Id = Guid.NewGuid(),
                UserId = user.Id,
                RequestId = Guid.NewGuid(),
                ObjectKey = "fixtures/dev_photo.jpg",
                ThumbnailKey = "fixtures/dev_thumb.jpg",
                State = "approved",
                Position = 0,
                Width = 400,
                Height = 400,
                CreatedAt = now
            };
            db.Set<ProfilePhoto>().Add(photo);

            var membership = new GameMembership
            {
                Id = Guid.NewGuid(),
                RoomId = roomId,
                UserId = user.Id,
                Gender = "woman",
                Status = GameMembershipStatus.Active,
                Generation = 1,
                JoinedAtUtc = now
            };
            db.Set<GameMembership>().Add(membership);
            added++;
        }

        // Add males
        for (var i = 0; i < req.MaleCount && (currentMales + i) < room.MaleQuota; i++)
        {
            var user = new AppUser
            {
                Id = Guid.NewGuid(),
                UserName = $"fixture_male_{Guid.NewGuid():N}@test.local",
                Email = $"fixture_male_{Guid.NewGuid():N}@test.local",
                EmailConfirmed = true,
                DateOfBirth = new DateOnly(1996, 3, 20),
                IsActive = true
            };
            db.Users.Add(user);

            var profile = new DatingProfile
            {
                UserId = user.Id,
                DisplayName = $"[DEV FIXTURE] Giorgi {currentMales + i + 1}",
                Bio = "Development test fixture profile for room quota validation.",
                Gender = "man",
                DesiredGenders = ["woman"],
                City = "Tbilisi",
                CityKey = "tbilisi",
                Interests = ["music", "gaming"],
                RelationshipGoal = "long_term",
                Visible = true
            };
            db.Set<DatingProfile>().Add(profile);

            var photo = new ProfilePhoto
            {
                Id = Guid.NewGuid(),
                UserId = user.Id,
                RequestId = Guid.NewGuid(),
                ObjectKey = "fixtures/dev_photo.jpg",
                ThumbnailKey = "fixtures/dev_thumb.jpg",
                State = "approved",
                Position = 0,
                Width = 400,
                Height = 400,
                CreatedAt = now
            };
            db.Set<ProfilePhoto>().Add(photo);

            var membership = new GameMembership
            {
                Id = Guid.NewGuid(),
                RoomId = roomId,
                UserId = user.Id,
                Gender = "man",
                Status = GameMembershipStatus.Active,
                Generation = 1,
                JoinedAtUtc = now
            };
            db.Set<GameMembership>().Add(membership);
            added++;
        }

        room.Version++;
        await db.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);

        return added;
    }

    private static readonly System.Collections.Concurrent.ConcurrentDictionary<Guid, List<GameRoomMessageDto>> _roomMessages = new();

    public async Task<GameRoomMessageDto> SendRoomChatMessage(Guid roomId, Guid userId, string text, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(text))
        {
            throw new BadHttpRequestException("message_required");
        }

        var trimmedText = text.Trim();
        if (trimmedText.Length > 500)
        {
            throw new BadHttpRequestException("message_too_long");
        }

        var room = await db.Set<GameRoom>()
            .AsNoTracking()
            .SingleOrDefaultAsync(r => r.Id == roomId, ct)
            ?? throw new BadHttpRequestException("room_not_found");

        var membership = await db.Set<GameMembership>()
            .AsNoTracking()
            .SingleOrDefaultAsync(m => m.RoomId == roomId && m.UserId == userId && m.Status == GameMembershipStatus.Active, ct)
            ?? throw new BadHttpRequestException("not_in_room");

        var profile = await db.Set<DatingProfile>()
            .AsNoTracking()
            .SingleOrDefaultAsync(p => p.UserId == userId, ct);

        var primaryPhoto = await db.Set<ProfilePhoto>()
            .AsNoTracking()
            .Where(p => p.UserId == userId && !p.Deleted && p.State != "rejected" && p.State != "uploading")
            .OrderBy(p => p.State == "approved" ? 0 : 1)
            .ThenBy(p => p.Position)
            .FirstOrDefaultAsync(ct);

        var now = clock.GetUtcNow();
        var displayName = profile?.DisplayName ?? "Player";
        var msg = new GameRoomMessageDto(
            Guid.NewGuid(),
            roomId,
            userId,
            displayName,
            primaryPhoto?.Id.ToString(),
            trimmedText,
            now
        );

        _roomMessages.AddOrUpdate(
            roomId,
            _ => [msg],
            (_, list) =>
            {
                lock (list)
                {
                    list.Add(msg);
                    if (list.Count > 100)
                    {
                        list.RemoveAt(0);
                    }
                }
                return list;
            });

        if (hub != null)
        {
            try
            {
                await hub.Clients.Group(GameHub.RoomGroup(roomId)).SendAsync("RoomChatMessage", msg, ct);
            }
            catch (Exception)
            {
                // Non-blocking
            }
        }

        return msg;
    }

    public async Task<GameRoomMessageDto[]> GetRoomChatMessages(Guid roomId, Guid userId, CancellationToken ct)
    {
        var membership = await db.Set<GameMembership>()
            .AsNoTracking()
            .AnyAsync(m => m.RoomId == roomId && m.UserId == userId && m.Status == GameMembershipStatus.Active, ct);

        if (!membership)
        {
            throw new BadHttpRequestException("not_in_room");
        }

        if (_roomMessages.TryGetValue(roomId, out var list))
        {
            lock (list)
            {
                return list.ToArray();
            }
        }

        return [];
    }

    public async Task<SendDirectMatchRequestResult> SendDirectMatchRequest(
        Guid senderUserId,
        SendDirectMatchRequestInput req,
        CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(req.IdempotencyKey))
            throw new AuthFailure(400, "invalid_idempotency_key");

        if (string.IsNullOrWhiteSpace(req.Message))
            throw new AuthFailure(400, "message_required");

        if (senderUserId == req.TargetUserId)
            throw new AuthFailure(400, "cannot_request_self");

        var (first, second) = PairSynchronization.Order(senderUserId, req.TargetUserId);

        var isBlocked = await db.Set<UserBlock>().AnyAsync(b =>
            (b.BlockerId == first && b.BlockedId == second) ||
            (b.BlockerId == second && b.BlockedId == first), ct);
        if (isBlocked) throw new AuthFailure(403, "pair_blocked");

        var isUnmatched = await db.Set<UnmatchedPair>().AnyAsync(p =>
            (p.FirstId == first && p.SecondId == second) ||
            (p.FirstId == second && p.SecondId == first), ct);
        if (isUnmatched) throw new AuthFailure(403, "pair_unmatched");

        var alreadyMatched = await db.Set<DatingMatch>()
            .AsNoTracking()
            .AnyAsync(m => m.Active && m.FirstId == first && m.SecondId == second, ct);
        if (alreadyMatched) throw new AuthFailure(409, "already_matched");

        // Single message/request per pair check
        var existingReq = await db.Set<GameDirectMatchRequest>()
            .SingleOrDefaultAsync(r => r.SenderUserId == senderUserId && r.TargetUserId == req.TargetUserId, ct);

        if (existingReq != null)
        {
            if (existingReq.IdempotencyKey == req.IdempotencyKey)
            {
                var userBal = await db.Set<UserWallet>().AsNoTracking()
                    .Where(w => w.UserId == senderUserId)
                    .Select(w => w.Balance)
                    .SingleOrDefaultAsync(ct);
                return new SendDirectMatchRequestResult(existingReq.Id, existingReq.TargetUserId, existingReq.Status, existingReq.CrystalsPaid, userBal, existingReq.CreatedAtUtc);
            }
            throw new AuthFailure(409, "direct_request_already_sent");
        }

        await using var tx = await db.Database.BeginTransactionAsync(ct);

        // Lock wallet and deduct 125 crystals
        var wallet = await db.Set<UserWallet>()
            .FromSqlInterpolated($"""SELECT "UserId", "Balance", "OutstandingDebt", "UpdatedAtUtc", xmin FROM "UserWallets" WHERE "UserId" = {senderUserId} FOR UPDATE""")
            .SingleOrDefaultAsync(ct);

        if (wallet == null || wallet.Balance < 125)
        {
            throw new AuthFailure(400, "insufficient_crystals");
        }

        var now = clock.GetUtcNow();
        wallet.Balance -= 125;
        wallet.UpdatedAtUtc = now;

        var crystalTx = new CrystalTransaction
        {
            Id = Guid.NewGuid(),
            UserId = senderUserId,
            Amount = -125,
            BalanceAfter = wallet.Balance,
            Type = "MatchRequest",
            ReferenceId = req.TargetUserId.ToString(),
            IdempotencyKey = req.IdempotencyKey,
            Description = "პირდაპირი მეჩის რექუესტი (125 კრისტალი)",
            CreatedAtUtc = now
        };
        db.Add(crystalTx);

        var directRequest = new GameDirectMatchRequest
        {
            Id = Guid.NewGuid(),
            RoomId = req.RoomId ?? Guid.Empty,
            SenderUserId = senderUserId,
            TargetUserId = req.TargetUserId,
            Message = req.Message.Trim(),
            CrystalsPaid = 125,
            Status = "Pending",
            IdempotencyKey = req.IdempotencyKey,
            CreatedAtUtc = now
        };
        db.Set<GameDirectMatchRequest>().Add(directRequest);

        // Record discovery like
        var dec = await db.Set<DiscoveryDecision>().SingleOrDefaultAsync(d => d.UserId == senderUserId && d.TargetId == req.TargetUserId, ct);
        if (dec is null) db.Set<DiscoveryDecision>().Add(new DiscoveryDecision { UserId = senderUserId, TargetId = req.TargetUserId, Kind = "like" });
        else dec.Kind = "like";

        await db.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);

        // Notify via SignalR if room is active
        if (req.RoomId.HasValue && req.RoomId.Value != Guid.Empty && hub != null)
        {
            await hub.Clients.Group(GameHub.RoomGroup(req.RoomId.Value)).SendAsync("DirectMatchRequestReceived", new
            {
                RequestId = directRequest.Id,
                SenderUserId = senderUserId,
                TargetUserId = req.TargetUserId,
                Message = directRequest.Message,
                CreatedAtUtc = now
            }, ct);
        }

        if (telegramNotifications != null)
        {
            try
            {
                var senderProfile = await db.Set<DatingProfile>().AsNoTracking().FirstOrDefaultAsync(p => p.UserId == senderUserId, ct);
                var senderName = senderProfile?.DisplayName ?? "მოთამაშე";
                var noteSnippet = !string.IsNullOrWhiteSpace(directRequest.Message) ? $"\nშეტყობინება: \"{directRequest.Message}\"" : "";

                _ = telegramNotifications.SendToUserAsync(
                    req.TargetUserId,
                    $"💫 <b>გაცნობის მოთხოვნა Arena-ში!</b>\n\n<b>{senderName}</b>-მ გამოგიგზავნათ გაცნობის მოთხოვნა!{noteSnippet}\nშედით ARENA-ში და უპასუხეთ 🔥",
                    buttonText: "👀 მოთხოვნის ნახვა",
                    webAppPath: "/arena",
                    ct: CancellationToken.None
                );
            }
            catch
            {
            }
        }

        return new SendDirectMatchRequestResult(directRequest.Id, directRequest.TargetUserId, directRequest.Status, directRequest.CrystalsPaid, wallet.Balance, directRequest.CreatedAtUtc);
    }

    public async Task<RespondDirectMatchRequestResult> RespondDirectMatchRequest(
        Guid targetUserId,
        Guid requestId,
        RespondDirectMatchRequestInput req,
        CancellationToken ct)
    {
        var directRequest = await db.Set<GameDirectMatchRequest>()
            .SingleOrDefaultAsync(r => r.Id == requestId, ct);

        if (directRequest == null)
            throw new AuthFailure(404, "request_not_found");

        if (directRequest.TargetUserId != targetUserId)
            throw new AuthFailure(403, "forbidden");

        if (directRequest.Status != "Pending")
            throw new AuthFailure(409, "already_responded");

        var isAccept = string.Equals(req.Action, "accept", StringComparison.OrdinalIgnoreCase) ||
                       string.Equals(req.Action, "accepted", StringComparison.OrdinalIgnoreCase);

        var now = clock.GetUtcNow();
        directRequest.RespondedAtUtc = now;

        if (!isAccept)
        {
            directRequest.Status = "Declined";
            await db.SaveChangesAsync(ct);

            if (directRequest.RoomId != Guid.Empty && hub != null)
            {
                await hub.Clients.Group(GameHub.RoomGroup(directRequest.RoomId)).SendAsync("DirectMatchRequestResponded", new
                {
                    RequestId = directRequest.Id,
                    SenderUserId = directRequest.SenderUserId,
                    TargetUserId = targetUserId,
                    Status = "Declined"
                }, ct);
            }

            return new RespondDirectMatchRequestResult(directRequest.Id, "Declined");
        }

        // Accept: Create mutual match and deliver introductory message
        directRequest.Status = "Accepted";

        Guid? matchId = null;
        Guid? convId = null;

        if (matchService != null)
        {
            var (match, conversation, _) = await matchService.CreateOrUnlockGameMatchAsync(directRequest.SenderUserId, targetUserId, ct);
            matchId = match.Id;
            convId = conversation.Id;
            directRequest.MatchId = match.Id;

            // Grant chat entitlement since 125 crystals were paid
            match.HasChatEntitlement = true;

            // Reciprocal like decisions
            var decA = await db.Set<DiscoveryDecision>().SingleOrDefaultAsync(d => d.UserId == directRequest.SenderUserId && d.TargetId == targetUserId, ct);
            if (decA == null) db.Set<DiscoveryDecision>().Add(new DiscoveryDecision { UserId = directRequest.SenderUserId, TargetId = targetUserId, Kind = "like" });
            else decA.Kind = "like";

            var decB = await db.Set<DiscoveryDecision>().SingleOrDefaultAsync(d => d.UserId == targetUserId && d.TargetId == directRequest.SenderUserId, ct);
            if (decB == null) db.Set<DiscoveryDecision>().Add(new DiscoveryDecision { UserId = targetUserId, TargetId = directRequest.SenderUserId, Kind = "like" });
            else decB.Kind = "like";

            // Deliver introductory message to conversation
            if (!string.IsNullOrWhiteSpace(directRequest.Message))
            {
                var chatMsg = new ChatMessage
                {
                    Id = Guid.NewGuid(),
                    ConversationId = conversation.Id,
                    SenderId = directRequest.SenderUserId,
                    ClientMessageId = Guid.TryParse(directRequest.IdempotencyKey, out var cid) ? cid : Guid.NewGuid(),
                    Text = directRequest.Message,
                    SentAt = now
                };
                db.Set<ChatMessage>().Add(chatMsg);
            }
        }

        await db.SaveChangesAsync(ct);

        if (directRequest.RoomId != Guid.Empty && hub != null)
        {
            await hub.Clients.Group(GameHub.RoomGroup(directRequest.RoomId)).SendAsync("DirectMatchRequestResponded", new
            {
                RequestId = directRequest.Id,
                SenderUserId = directRequest.SenderUserId,
                TargetUserId = targetUserId,
                Status = "Accepted",
                MatchId = matchId,
                ConversationId = convId
            }, ct);
        }

        return new RespondDirectMatchRequestResult(directRequest.Id, "Accepted", matchId, convId);
    }
}

