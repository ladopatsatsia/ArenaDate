using System.Net;
using System.Net.Http.Json;
using Dating.Api.Features.Auth;
using Dating.Api.Features.Discovery;
using Dating.Api.Features.Game;
using Dating.Api.Features.Game.Wallet;
using Dating.Api.Features.Matching;
using Dating.Api.Features.Profiles;
using Dating.Api.Features.Safety;
using Dating.Api.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace Dating.IntegrationTests;

public class CrystalLedgerTests
{
    private static async Task<HttpResponseMessage> Send(AuthHarness h, TokenResponse user, HttpMethod method, string path, object? value = null)
    {
        using var request = new HttpRequestMessage(method, path);
        request.Headers.Authorization = new("Bearer", user.AccessToken);
        if (value is not null) request.Content = JsonContent.Create(value);
        return await h.Client.SendAsync(request);
    }

    private static ProfilePhoto ApprovedPhoto(Guid owner, int position = 0) => new()
    {
        Id = Guid.NewGuid(),
        UserId = owner,
        RequestId = Guid.NewGuid(),
        ObjectKey = Guid.NewGuid().ToString("N") + ".jpg",
        ThumbnailKey = Guid.NewGuid().ToString("N") + ".jpg",
        State = "approved",
        Width = 600,
        Height = 400,
        Position = position,
        CreatedAt = DateTimeOffset.UtcNow
    };

    private static async Task<TokenResponse> CreateDirectUser(AuthHarness h, string email, string gender = "woman", string[]? desired = null)
    {
        var id = Guid.NewGuid();
        desired ??= gender == "woman" ? ["man"] : ["woman"];
        var now = DateTimeOffset.UtcNow;
        var user = new AppUser
        {
            Id = id,
            UserName = email,
            NormalizedUserName = email.ToUpperInvariant(),
            Email = email,
            NormalizedEmail = email.ToUpperInvariant(),
            EmailConfirmed = true,
            IsActive = true,
            DateOfBirth = new DateOnly(1995, 1, 1),
            SecurityStamp = Guid.NewGuid().ToString("N")
        };
        var session = new AuthSession
        {
            Id = Guid.NewGuid(),
            UserId = id,
            ExpiresAt = now.AddDays(30)
        };
        var profile = new DatingProfile
        {
            UserId = id,
            DisplayName = $"User {gender}",
            Bio = "Detailed bio for testing full vs preview profile gating.",
            Gender = gender,
            DesiredGenders = desired,
            City = "Tbilisi",
            CityKey = "tbilisi",
            Interests = ["music", "gaming", "travel"],
            RelationshipGoal = "long_term",
            Visible = true
        };
        var photo1 = ApprovedPhoto(id, 0);
        var photo2 = ApprovedPhoto(id, 1);

        await h.Db(async db =>
        {
            db.Users.Add(user);
            db.Sessions.Add(session);
            db.Set<DatingProfile>().Add(profile);
            db.Set<ProfilePhoto>().AddRange(photo1, photo2);
            await db.SaveChangesAsync();
        });

        using var scope = h.Factory.Services.CreateScope();
        var jwt = scope.ServiceProvider.GetRequiredService<JwtTokens>();
        return jwt.Issue(user, session, JwtTokens.NewRefresh(), now);
    }

    private static async Task<(DatingMatch Match, Conversation Conv)> CreateMatch(AuthHarness h, Guid userA, Guid userB, bool hasChatEntitlement, string origin = "Game")
    {
        var (first, second) = PairSynchronization.Order(userA, userB);
        var match = new DatingMatch
        {
            Id = Guid.NewGuid(),
            FirstId = first,
            SecondId = second,
            Active = true,
            CreatedAt = DateTimeOffset.UtcNow,
            Origin = origin,
            HasChatEntitlement = hasChatEntitlement
        };
        var conv = new Conversation
        {
            Id = Guid.NewGuid(),
            MatchId = match.Id,
            LastSequence = 0
        };

        await h.Db(async db =>
        {
            db.Set<DatingMatch>().Add(match);
            db.Set<Conversation>().Add(conv);
            await db.SaveChangesAsync();
        });

        return (match, conv);
    }

    [Fact]
    public async Task DevGrant_IncreasesBalance_AndIsIdempotent()
    {
        await using var h = await AuthHarness.Create();
        var user = await CreateDirectUser(h, "grant_test@example.com");

        // 1. Initial wallet check
        var res1 = await Send(h, user, HttpMethod.Get, "/api/game/wallet");
        Assert.Equal(HttpStatusCode.OK, res1.StatusCode);
        var wallet1 = await res1.Content.ReadFromJsonAsync<WalletBalanceDto>();
        Assert.NotNull(wallet1);
        Assert.Equal(0, wallet1.Balance);
        Assert.Empty(wallet1.RecentTransactions);

        // 2. Grant 100 crystals
        var k1 = Guid.NewGuid().ToString("N");
        var res2 = await Send(h, user, HttpMethod.Post, "/api/game/wallet/dev-grant", new DevGrantRequest(100, k1));
        Assert.Equal(HttpStatusCode.OK, res2.StatusCode);
        var wallet2 = await res2.Content.ReadFromJsonAsync<WalletBalanceDto>();
        Assert.NotNull(wallet2);
        Assert.Equal(100, wallet2.Balance);
        Assert.Single(wallet2.RecentTransactions);
        Assert.Equal(100, wallet2.RecentTransactions[0].Amount);

        // 3. Replay exact same request with same idempotency key
        var res3 = await Send(h, user, HttpMethod.Post, "/api/game/wallet/dev-grant", new DevGrantRequest(100, k1));
        Assert.Equal(HttpStatusCode.OK, res3.StatusCode);
        var wallet3 = await res3.Content.ReadFromJsonAsync<WalletBalanceDto>();
        Assert.NotNull(wallet3);
        Assert.Equal(100, wallet3.Balance); // still 100, not 200!
        Assert.Single(wallet3.RecentTransactions);

        // 4. Grant 50 crystals with new idempotency key
        var k2 = Guid.NewGuid().ToString("N");
        var res4 = await Send(h, user, HttpMethod.Post, "/api/game/wallet/dev-grant", new DevGrantRequest(50, k2));
        Assert.Equal(HttpStatusCode.OK, res4.StatusCode);
        var wallet4 = await res4.Content.ReadFromJsonAsync<WalletBalanceDto>();
        Assert.NotNull(wallet4);
        Assert.Equal(150, wallet4.Balance);
        Assert.Equal(2, wallet4.RecentTransactions.Length);
    }

    [Fact]
    public async Task InsufficientBalance_Returns400_AndDoesNotDebit()
    {
        await using var h = await AuthHarness.Create();
        var viewer = await CreateDirectUser(h, "insufficient_viewer@example.com");
        var target = await CreateDirectUser(h, "insufficient_target@example.com");

        // Grant only 10 crystals (unlock costs 25)
        var k1 = Guid.NewGuid().ToString("N");
        await Send(h, viewer, HttpMethod.Post, "/api/game/wallet/dev-grant", new DevGrantRequest(10, k1));

        // Attempt profile unlock
        var k2 = Guid.NewGuid().ToString("N");
        var unlockRes = await Send(h, viewer, HttpMethod.Post, $"/api/game/profiles/{target.Account.Id}/unlock", new UnlockProfileRequest(k2));
        Assert.Equal(HttpStatusCode.BadRequest, unlockRes.StatusCode);

        // Verify balance remains 10
        var walletRes = await Send(h, viewer, HttpMethod.Get, "/api/game/wallet");
        var wallet = await walletRes.Content.ReadFromJsonAsync<WalletBalanceDto>();
        Assert.NotNull(wallet);
        Assert.Equal(10, wallet.Balance);

        // Verify no unlock in DB
        await h.Db(async db =>
        {
            var unlock = await db.Set<GameProfileUnlock>().SingleOrDefaultAsync(u => u.ViewerUserId == viewer.Account.Id);
            Assert.Null(unlock);
        });
    }

    [Fact]
    public async Task ProfileUnlock_Debits25Crystals_CreatesNotice_AndSecondCallIsFree()
    {
        await using var h = await AuthHarness.Create();
        var viewer = await CreateDirectUser(h, "unlock_viewer@example.com");
        var target = await CreateDirectUser(h, "unlock_target@example.com");

        // Grant 100 crystals to viewer
        await Send(h, viewer, HttpMethod.Post, "/api/game/wallet/dev-grant", new DevGrantRequest(100, Guid.NewGuid().ToString("N")));

        // 1. Initial Unlock
        var kUnlock = Guid.NewGuid().ToString("N");
        var res1 = await Send(h, viewer, HttpMethod.Post, $"/api/game/profiles/{target.Account.Id}/unlock", new UnlockProfileRequest(kUnlock));
        Assert.Equal(HttpStatusCode.OK, res1.StatusCode);
        var result1 = await res1.Content.ReadFromJsonAsync<UnlockProfileResult>();
        Assert.NotNull(result1);
        Assert.True(result1.Unlocked);
        Assert.Equal(25, result1.Debited);
        Assert.Equal(75, result1.Balance);
        Assert.False(result1.AlreadyUnlocked);
        Assert.NotNull(result1.Profile);
        Assert.True(result1.Profile.IsFullAccess);

        // 2. Check view notice for target
        var noticeRes = await Send(h, target, HttpMethod.Get, "/api/game/profiles/views");
        Assert.Equal(HttpStatusCode.OK, noticeRes.StatusCode);
        var notices = await noticeRes.Content.ReadFromJsonAsync<GameProfileViewNoticeDto[]>();
        Assert.NotNull(notices);
        Assert.Single(notices);
        Assert.Equal(viewer.Account.Id, notices[0].ViewerUserId);
        Assert.False(notices[0].Seen);

        // 3. Acknowledge view notices
        var ackRes = await Send(h, target, HttpMethod.Post, "/api/game/profiles/views/acknowledge");
        Assert.Equal(HttpStatusCode.NoContent, ackRes.StatusCode);

        // Verify notices are now seen
        var noticeRes2 = await Send(h, target, HttpMethod.Get, "/api/game/profiles/views");
        var notices2 = await noticeRes2.Content.ReadFromJsonAsync<GameProfileViewNoticeDto[]>();
        Assert.NotNull(notices2);
        Assert.Single(notices2);
        Assert.True(notices2[0].Seen);

        // 4. Second call to unlock from viewer: should debit 0 crystals
        var res2 = await Send(h, viewer, HttpMethod.Post, $"/api/game/profiles/{target.Account.Id}/unlock", new UnlockProfileRequest(Guid.NewGuid().ToString("N")));
        Assert.Equal(HttpStatusCode.OK, res2.StatusCode);
        var result2 = await res2.Content.ReadFromJsonAsync<UnlockProfileResult>();
        Assert.NotNull(result2);
        Assert.True(result2.Unlocked);
        Assert.Equal(0, result2.Debited);
        Assert.Equal(75, result2.Balance);
        Assert.True(result2.AlreadyUnlocked);
    }

    [Fact]
    public async Task ProfileAccess_GatesPreviewVsFullAccess()
    {
        await using var h = await AuthHarness.Create();
        var viewer = await CreateDirectUser(h, "preview_viewer@example.com");
        var target = await CreateDirectUser(h, "preview_target@example.com");

        await Send(h, viewer, HttpMethod.Post, "/api/game/wallet/dev-grant", new DevGrantRequest(100, Guid.NewGuid().ToString("N")));

        // 1. Unentitled GET: preview only
        var previewRes = await Send(h, viewer, HttpMethod.Get, $"/api/game/profiles/{target.Account.Id}");
        Assert.Equal(HttpStatusCode.OK, previewRes.StatusCode);
        var preview = await previewRes.Content.ReadFromJsonAsync<GameProfileDto>();
        Assert.NotNull(preview);
        Assert.False(preview.IsFullAccess);
        Assert.Equal(25, preview.UnlockPrice);
        Assert.Empty(preview.Interests);
        Assert.Empty(preview.RelationshipGoal);
        Assert.Single(preview.Photos); // only 1 primary photo previewed

        // 2. Unlock profile
        var unlockRes = await Send(h, viewer, HttpMethod.Post, $"/api/game/profiles/{target.Account.Id}/unlock", new UnlockProfileRequest(Guid.NewGuid().ToString("N")));
        Assert.Equal(HttpStatusCode.OK, unlockRes.StatusCode);

        // 3. Entitled GET: full profile
        var fullRes = await Send(h, viewer, HttpMethod.Get, $"/api/game/profiles/{target.Account.Id}");
        Assert.Equal(HttpStatusCode.OK, fullRes.StatusCode);
        var full = await fullRes.Content.ReadFromJsonAsync<GameProfileDto>();
        Assert.NotNull(full);
        Assert.True(full.IsFullAccess);
        Assert.Equal("long_term", full.RelationshipGoal);
        Assert.Contains("music", full.Interests);
        Assert.Equal(2, full.Photos.Length); // both photos
    }

    [Fact]
    public async Task ProfileUnlock_TargetOptOut_Returns403_AndDebitsZero()
    {
        await using var h = await AuthHarness.Create();
        var viewer = await CreateDirectUser(h, "optout_viewer@example.com");
        var target = await CreateDirectUser(h, "optout_target@example.com");

        await Send(h, viewer, HttpMethod.Post, "/api/game/wallet/dev-grant", new DevGrantRequest(100, Guid.NewGuid().ToString("N")));

        // Target disables arena profile unlocks
        await h.Db(async db =>
        {
            var settings = new UserGameSettings
            {
                UserId = target.Account.Id,
                AllowProfileUnlockInArena = false,
                UpdatedAtUtc = DateTimeOffset.UtcNow
            };
            db.Set<UserGameSettings>().Add(settings);
            await db.SaveChangesAsync();
        });

        // Viewer attempts unlock
        var res = await Send(h, viewer, HttpMethod.Post, $"/api/game/profiles/{target.Account.Id}/unlock", new UnlockProfileRequest(Guid.NewGuid().ToString("N")));
        Assert.Equal(HttpStatusCode.Forbidden, res.StatusCode);

        // Verify 0 debit
        var walletRes = await Send(h, viewer, HttpMethod.Get, "/api/game/wallet");
        var wallet = await walletRes.Content.ReadFromJsonAsync<WalletBalanceDto>();
        Assert.NotNull(wallet);
        Assert.Equal(100, wallet.Balance);
    }

    [Fact]
    public async Task MatchUnlock_Debits25Crystals_UnlocksForBoth_SecondCallIsAlreadyOpen()
    {
        await using var h = await AuthHarness.Create();
        var userA = await CreateDirectUser(h, "match_a@example.com");
        var userB = await CreateDirectUser(h, "match_b@example.com");

        // Create locked match (HasChatEntitlement = false)
        var (match, conv) = await CreateMatch(h, userA.Account.Id, userB.Account.Id, hasChatEntitlement: false, origin: "Game");

        // Grant 50 crystals to each
        await Send(h, userA, HttpMethod.Post, "/api/game/wallet/dev-grant", new DevGrantRequest(50, Guid.NewGuid().ToString("N")));
        await Send(h, userB, HttpMethod.Post, "/api/game/wallet/dev-grant", new DevGrantRequest(50, Guid.NewGuid().ToString("N")));

        // 1. User A unlocks match
        var resA = await Send(h, userA, HttpMethod.Post, $"/api/matches/{match.Id}/unlock", new UnlockMatchConversationRequest(Guid.NewGuid().ToString("N")));
        Assert.Equal(HttpStatusCode.OK, resA.StatusCode);
        var resultA = await resA.Content.ReadFromJsonAsync<UnlockMatchConversationResult>();
        Assert.NotNull(resultA);
        Assert.True(resultA.Unlocked);
        Assert.Equal(25, resultA.Debited);
        Assert.Equal(25, resultA.Balance);
        Assert.False(resultA.AlreadyOpen);
        Assert.Equal(match.Id, resultA.MatchId);
        Assert.Equal(conv.Id, resultA.ConversationId);

        // Verify match in DB is now unlocked
        await h.Db(async db =>
        {
            var dbMatch = await db.Set<DatingMatch>().SingleAsync(m => m.Id == match.Id);
            Assert.True(dbMatch.HasChatEntitlement);
        });

        // 2. User B calls unlock on the same match: debits 0 crystals
        var resB = await Send(h, userB, HttpMethod.Post, $"/api/matches/{match.Id}/unlock", new UnlockMatchConversationRequest(Guid.NewGuid().ToString("N")));
        Assert.Equal(HttpStatusCode.OK, resB.StatusCode);
        var resultB = await resB.Content.ReadFromJsonAsync<UnlockMatchConversationResult>();
        Assert.NotNull(resultB);
        Assert.True(resultB.Unlocked);
        Assert.Equal(0, resultB.Debited);
        Assert.Equal(50, resultB.Balance); // User B balance untouched!
        Assert.True(resultB.AlreadyOpen);

        // 3. User B can now also access User A's full profile because they have match entitlement
        var profileRes = await Send(h, userB, HttpMethod.Get, $"/api/game/profiles/{userA.Account.Id}");
        Assert.Equal(HttpStatusCode.OK, profileRes.StatusCode);
        var profileDto = await profileRes.Content.ReadFromJsonAsync<GameProfileDto>();
        Assert.NotNull(profileDto);
        Assert.True(profileDto.IsFullAccess);
    }

    [Fact]
    public async Task MatchUnlock_SimultaneousRace_DebitsOnlyOnce()
    {
        await using var h = await AuthHarness.Create();
        var userA = await CreateDirectUser(h, "race_a@example.com");
        var userB = await CreateDirectUser(h, "race_b@example.com");

        var (match, _) = await CreateMatch(h, userA.Account.Id, userB.Account.Id, hasChatEntitlement: false, origin: "Game");

        // Grant 50 crystals to each
        await Send(h, userA, HttpMethod.Post, "/api/game/wallet/dev-grant", new DevGrantRequest(50, Guid.NewGuid().ToString("N")));
        await Send(h, userB, HttpMethod.Post, "/api/game/wallet/dev-grant", new DevGrantRequest(50, Guid.NewGuid().ToString("N")));

        // Execute concurrent unlock requests
        var taskA = Send(h, userA, HttpMethod.Post, $"/api/matches/{match.Id}/unlock", new UnlockMatchConversationRequest(Guid.NewGuid().ToString("N")));
        var taskB = Send(h, userB, HttpMethod.Post, $"/api/matches/{match.Id}/unlock", new UnlockMatchConversationRequest(Guid.NewGuid().ToString("N")));

        var responses = await Task.WhenAll(taskA, taskB);
        Assert.Equal(HttpStatusCode.OK, responses[0].StatusCode);
        Assert.Equal(HttpStatusCode.OK, responses[1].StatusCode);

        var rA = await responses[0].Content.ReadFromJsonAsync<UnlockMatchConversationResult>();
        var rB = await responses[1].Content.ReadFromJsonAsync<UnlockMatchConversationResult>();
        Assert.NotNull(rA);
        Assert.NotNull(rB);

        // Exactly one debited 25, the other debited 0
        var totalDebited = rA.Debited + rB.Debited;
        Assert.Equal(25, totalDebited);

        var winnerCount = (rA.Debited == 25 ? 1 : 0) + (rB.Debited == 25 ? 1 : 0);
        Assert.Equal(1, winnerCount);

        var alreadyOpenCount = (rA.AlreadyOpen ? 1 : 0) + (rB.AlreadyOpen ? 1 : 0);
        Assert.Equal(1, alreadyOpenCount);

        // Total remaining crystals across both is 75 (100 - 25)
        var balA = (await (await Send(h, userA, HttpMethod.Get, "/api/game/wallet")).Content.ReadFromJsonAsync<WalletBalanceDto>())!.Balance;
        var balB = (await (await Send(h, userB, HttpMethod.Get, "/api/game/wallet")).Content.ReadFromJsonAsync<WalletBalanceDto>())!.Balance;
        Assert.Equal(75, balA + balB);
    }

    [Fact]
    public async Task DiscoveryMatch_FreeEntitlement_CrystalUnlockReturnsAlreadyOpen()
    {
        await using var h = await AuthHarness.Create();
        var userA = await CreateDirectUser(h, "free_a@example.com");
        var userB = await CreateDirectUser(h, "free_b@example.com");

        // Discovery match already has HasChatEntitlement = true
        var (match, conv) = await CreateMatch(h, userA.Account.Id, userB.Account.Id, hasChatEntitlement: true, origin: "Discovery");

        await Send(h, userA, HttpMethod.Post, "/api/game/wallet/dev-grant", new DevGrantRequest(100, Guid.NewGuid().ToString("N")));

        var res = await Send(h, userA, HttpMethod.Post, $"/api/matches/{match.Id}/unlock", new UnlockMatchConversationRequest(Guid.NewGuid().ToString("N")));
        Assert.Equal(HttpStatusCode.OK, res.StatusCode);
        var result = await res.Content.ReadFromJsonAsync<UnlockMatchConversationResult>();
        Assert.NotNull(result);
        Assert.True(result.Unlocked);
        Assert.Equal(0, result.Debited);
        Assert.True(result.AlreadyOpen);
        Assert.Equal(100, result.Balance);
    }

    [Fact]
    public async Task SafetyChecks_BlockedOrUnmatched_CannotUnlock_ZeroDebit()
    {
        await using var h = await AuthHarness.Create();
        var userA = await CreateDirectUser(h, "safety_a@example.com");
        var userB = await CreateDirectUser(h, "safety_b@example.com");

        await Send(h, userA, HttpMethod.Post, "/api/game/wallet/dev-grant", new DevGrantRequest(100, Guid.NewGuid().ToString("N")));

        // 1. Cannot unlock own profile
        var selfRes = await Send(h, userA, HttpMethod.Post, $"/api/game/profiles/{userA.Account.Id}/unlock", new UnlockProfileRequest(Guid.NewGuid().ToString("N")));
        Assert.Equal(HttpStatusCode.BadRequest, selfRes.StatusCode);

        // 2. Block pair
        await h.Db(async db =>
        {
            db.Set<UserBlock>().Add(new UserBlock
            {
                BlockerId = userB.Account.Id,
                BlockedId = userA.Account.Id
            });
            await db.SaveChangesAsync();
        });

        // Attempt profile unlock while blocked
        var blockUnlockRes = await Send(h, userA, HttpMethod.Post, $"/api/game/profiles/{userB.Account.Id}/unlock", new UnlockProfileRequest(Guid.NewGuid().ToString("N")));
        Assert.Equal(HttpStatusCode.Forbidden, blockUnlockRes.StatusCode);

        // Balance remains 100
        var walletRes = await Send(h, userA, HttpMethod.Get, "/api/game/wallet");
        var wallet = await walletRes.Content.ReadFromJsonAsync<WalletBalanceDto>();
        Assert.NotNull(wallet);
        Assert.Equal(100, wallet.Balance);
    }

    [Fact]
    public async Task GameGifts_CatalogAndSend_DeductsCrystals_AndPersistsHistory()
    {
        await using var h = await AuthHarness.Create();
        var userA = await CreateDirectUser(h, "gift_sender@example.com");
        var userB = await CreateDirectUser(h, "gift_recipient@example.com");

        // 1. Fetch catalog
        var catRes = await Send(h, userA, HttpMethod.Get, "/api/game/gifts/catalog");
        Assert.Equal(HttpStatusCode.OK, catRes.StatusCode);
        var catalog = await catRes.Content.ReadFromJsonAsync<GiftCatalogItemDto[]>();
        Assert.NotNull(catalog);
        Assert.True(catalog.Length >= 8);
        Assert.Contains(catalog, g => g.Price == 1 && g.Id == "rose");
        Assert.Contains(catalog, g => g.Price == 500 && g.Id == "crown");

        // 2. Grant crystals to User A
        await Send(h, userA, HttpMethod.Post, "/api/game/wallet/dev-grant", new DevGrantRequest(100, Guid.NewGuid().ToString("N")));

        // 3. Prevent self-gifting
        var selfGift = await Send(h, userA, HttpMethod.Post, "/api/game/gifts/send", new SendGiftRequest(userA.Account.Id, "rose", null, Guid.NewGuid().ToString("N")));
        Assert.Equal(HttpStatusCode.BadRequest, selfGift.StatusCode);

        // 4. Prevent sending expensive gift with insufficient balance
        var overspendGift = await Send(h, userA, HttpMethod.Post, "/api/game/gifts/send", new SendGiftRequest(userB.Account.Id, "crown", null, Guid.NewGuid().ToString("N")));
        Assert.Equal(HttpStatusCode.BadRequest, overspendGift.StatusCode);

        // 5. Successfully send Cocktail (30 crystals)
        var sendRes = await Send(h, userA, HttpMethod.Post, "/api/game/gifts/send", new SendGiftRequest(userB.Account.Id, "cocktail", null, Guid.NewGuid().ToString("N")));
        Assert.Equal(HttpStatusCode.OK, sendRes.StatusCode);
        var sendResult = await sendRes.Content.ReadFromJsonAsync<SendGiftResult>();
        Assert.NotNull(sendResult);
        Assert.Equal("cocktail", sendResult.GiftId);
        Assert.Equal(30, sendResult.CrystalCost);
        Assert.Equal(70, sendResult.Balance);

        // 6. Check Sender history
        var senderHistoryRes = await Send(h, userA, HttpMethod.Get, "/api/game/gifts/history");
        Assert.Equal(HttpStatusCode.OK, senderHistoryRes.StatusCode);
        var senderHistory = await senderHistoryRes.Content.ReadFromJsonAsync<UserGiftsDto>();
        Assert.NotNull(senderHistory);
        Assert.Equal(1, senderHistory.TotalSentCount);
        Assert.Single(senderHistory.SentGifts);
        Assert.Equal("cocktail", senderHistory.SentGifts[0].GiftId);

        // 7. Check Recipient history
        var recipientHistoryRes = await Send(h, userB, HttpMethod.Get, "/api/game/gifts/history");
        Assert.Equal(HttpStatusCode.OK, recipientHistoryRes.StatusCode);
        var recipientHistory = await recipientHistoryRes.Content.ReadFromJsonAsync<UserGiftsDto>();
        Assert.NotNull(recipientHistory);
        Assert.Equal(1, recipientHistory.TotalReceivedCount);
        Assert.Equal(30, recipientHistory.TotalReceivedCrystalsValue);
        Assert.Single(recipientHistory.ReceivedGifts);
        Assert.Equal("cocktail", recipientHistory.ReceivedGifts[0].GiftId);
    }

    [Fact]
    public async Task GameTable_UnlockedProfile_ReturnsKissesAndGiftsStatistics()
    {
        await using var h = await AuthHarness.Create();
        var userA = await CreateDirectUser(h, "table_viewer@example.com");
        var userB = await CreateDirectUser(h, "table_target@example.com");

        // Add 2 kisses to User B
        await h.Db(async db =>
        {
            var room = new GameRoom
            {
                Id = Guid.NewGuid(),
                Title = "Table Room",
                CreatedByUserId = userA.Account.Id,
                CreatedAtUtc = DateTimeOffset.UtcNow,
                LobbyDeadlineUtc = DateTimeOffset.UtcNow.AddMinutes(10)
            };
            var round = new GameRound
            {
                Id = Guid.NewGuid(),
                RoomId = room.Id,
                SpinnerUserId = userA.Account.Id,
                TargetUserId = userB.Account.Id,
                StartedAtUtc = DateTimeOffset.UtcNow
            };
            db.Set<GameRoom>().Add(room);
            db.Set<GameRound>().Add(round);

            var kiss1 = new GameKiss
            {
                Id = Guid.NewGuid(),
                RoomId = room.Id,
                RoundId = round.Id,
                SenderUserId = userA.Account.Id,
                RecipientUserId = userB.Account.Id,
                IdempotencyKey = Guid.NewGuid().ToString("N"),
                CreatedAtUtc = DateTimeOffset.UtcNow.AddMinutes(-10)
            };
            var kiss2 = new GameKiss
            {
                Id = Guid.NewGuid(),
                RoomId = room.Id,
                RoundId = round.Id,
                SenderUserId = userA.Account.Id,
                RecipientUserId = userB.Account.Id,
                IdempotencyKey = Guid.NewGuid().ToString("N"),
                CreatedAtUtc = DateTimeOffset.UtcNow.AddMinutes(-5)
            };
            db.Set<GameKiss>().AddRange(kiss1, kiss2);
            await db.SaveChangesAsync();
        });

        // Grant crystals and send a gift to user B
        await Send(h, userA, HttpMethod.Post, "/api/game/wallet/dev-grant", new DevGrantRequest(100, Guid.NewGuid().ToString("N")));
        await Send(h, userA, HttpMethod.Post, "/api/game/gifts/send", new SendGiftRequest(userB.Account.Id, "rose", null, Guid.NewGuid().ToString("N")));

        // Before unlocking full profile for 25 crystals: preview profile has IsFullAccess == false, no kisses/gifts report
        var previewRes = await Send(h, userA, HttpMethod.Get, $"/api/game/profiles/{userB.Account.Id}");
        Assert.Equal(HttpStatusCode.OK, previewRes.StatusCode);
        var preview = await previewRes.Content.ReadFromJsonAsync<GameProfileDto>();
        Assert.NotNull(preview);
        Assert.False(preview.IsFullAccess);
        Assert.Null(preview.KissesReceivedCount);
        Assert.Null(preview.GiftsReceivedCount);

        // Unlock full profile for 25 crystals
        var unlockRes = await Send(h, userA, HttpMethod.Post, $"/api/game/profiles/{userB.Account.Id}/unlock", new UnlockProfileRequest(Guid.NewGuid().ToString("N")));
        Assert.Equal(HttpStatusCode.OK, unlockRes.StatusCode);
        var unlockResult = await unlockRes.Content.ReadFromJsonAsync<UnlockProfileResult>();
        Assert.NotNull(unlockResult);
        Assert.NotNull(unlockResult.Profile);
        Assert.True(unlockResult.Profile.IsFullAccess);
        Assert.Equal(2, unlockResult.Profile.KissesReceivedCount);
        Assert.Equal(1, unlockResult.Profile.GiftsReceivedCount);

        // Subsequent fetch shows unlocked state and statistics
        var fullRes = await Send(h, userA, HttpMethod.Get, $"/api/game/profiles/{userB.Account.Id}");
        Assert.Equal(HttpStatusCode.OK, fullRes.StatusCode);
        var fullProfile = await fullRes.Content.ReadFromJsonAsync<GameProfileDto>();
        Assert.NotNull(fullProfile);
        Assert.True(fullProfile.IsFullAccess);
        Assert.Equal(2, fullProfile.KissesReceivedCount);
        Assert.Equal(1, fullProfile.GiftsReceivedCount);
    }
}
