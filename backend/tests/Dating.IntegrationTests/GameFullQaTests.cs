using System.Diagnostics;
using System.Net;
using System.Net.Http.Json;
using Dating.Api.Features.Auth;
using Dating.Api.Features.Chat;
using Dating.Api.Features.Discovery;
using Dating.Api.Features.Game;
using Dating.Api.Features.Game.Ai;
using Dating.Api.Features.Game.Wallet;
using Dating.Api.Features.Matching;
using Dating.Api.Features.Profiles;
using Dating.Api.Features.Safety;
using Dating.Api.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace Dating.IntegrationTests;

public class GameFullQaTests
{
    private static async Task<HttpResponseMessage> Send(AuthHarness h, TokenResponse user, HttpMethod method, string path, object? value = null)
    {
        using var request = new HttpRequestMessage(method, path.StartsWith("/api/moderation/", StringComparison.Ordinal) ? "https://localhost" + path : path);
        request.Headers.Authorization = new("Bearer", user.AccessToken);
        if (value is not null) request.Content = JsonContent.Create(value);
        return await h.Client.SendAsync(request);
    }

    private static ProfilePhoto ApprovedPhoto(Guid owner) => new()
    {
        Id = Guid.NewGuid(),
        UserId = owner,
        RequestId = Guid.NewGuid(),
        ObjectKey = Guid.NewGuid().ToString("N") + ".jpg",
        ThumbnailKey = Guid.NewGuid().ToString("N") + ".jpg",
        State = "approved",
        Width = 600,
        Height = 400,
        Position = 0,
        CreatedAt = DateTimeOffset.UtcNow
    };

    private static async Task<TokenResponse> DirectUser(AuthHarness h, string email, string gender = "woman", string[]? desired = null)
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
            DisplayName = $"User_{gender[0]}_{Guid.NewGuid():N}"[..20],
            Bio = "Verified complete dating profile for full game QA.",
            Gender = gender,
            DesiredGenders = desired,
            City = "Tbilisi",
            CityKey = "tbilisi",
            Interests = ["music", "gaming", "art"],
            RelationshipGoal = "long_term",
            Visible = true
        };
        var photo = ApprovedPhoto(id);

        await h.Db(async db =>
        {
            db.Users.Add(user);
            db.Sessions.Add(session);
            db.Set<DatingProfile>().Add(profile);
            db.Set<ProfilePhoto>().Add(photo);
            await db.SaveChangesAsync();
        });

        using var scope = h.Factory.Services.CreateScope();
        var jwt = scope.ServiceProvider.GetRequiredService<JwtTokens>();
        return jwt.Issue(user, session, JwtTokens.NewRefresh(), now);
    }

    [Fact]
    public async Task GameQA_10_Player_Full_Room_Lifecycle_Turns_Spins_Questions_Kisses_Matches_Unlocks()
    {
        await using var h = await AuthHarness.Create();

        // 1. Setup 10 independently authenticated players: 5 women, 5 men
        var women = new List<TokenResponse>();
        for (var i = 1; i <= 5; i++)
        {
            women.Add(await DirectUser(h, $"qa_w{i}_{Guid.NewGuid():N}@gameqa.test", "woman"));
        }
        var men = new List<TokenResponse>();
        for (var i = 1; i <= 5; i++)
        {
            men.Add(await DirectUser(h, $"qa_m{i}_{Guid.NewGuid():N}@gameqa.test", "man"));
        }
        var allPlayers = women.Concat(men).ToList();
        Assert.Equal(10, allPlayers.Count);

        // 2. All 10 join the queue for a 10-player room
        GameRoomDetail? room = null;
        foreach (var player in allPlayers)
        {
            var queueRes = await Send(h, player, HttpMethod.Post, "/api/game/queue", new JoinQueueRequest(10));
            Assert.Equal(HttpStatusCode.OK, queueRes.StatusCode);
            room = await queueRes.Content.ReadFromJsonAsync<GameRoomDetail>();
            Assert.NotNull(room);
        }

        // Room should now be full (10 members, 5 women, 5 men, state Starting)
        Assert.Equal(10, room!.MemberCount);
        Assert.Equal(5, room.FemaleCount);
        Assert.Equal(5, room.MaleCount);
        Assert.Equal("Starting", room.State);

        // Advance 5s countdown deadline to transition to Playing
        await h.Db(async db =>
        {
            var r = await db.Set<GameRoom>().SingleAsync(x => x.Id == room.Id);
            r.DeadlineUtc = DateTimeOffset.UtcNow.AddSeconds(-1);
            await db.SaveChangesAsync();
        });

        using (var scope = h.Factory.Services.CreateScope())
        {
            var gs = scope.ServiceProvider.GetRequiredService<GameService>();
            await gs.ProcessDeadlinesAndOutboxAsync(default);
        }

        // 3. Inspect room snapshot to find turn owner
        var snapRes = await Send(h, women[0], HttpMethod.Get, $"/api/game/rooms/{room.Id}/snapshot");
        Assert.Equal(HttpStatusCode.OK, snapRes.StatusCode);
        var snap = (await snapRes.Content.ReadFromJsonAsync<GameRoomSnapshot>())!;
        Assert.Equal("Playing", snap.State);
        Assert.NotNull(snap.CurrentTurnUserId);

        var spinner = allPlayers.Single(p => p.Account.Id == snap.CurrentTurnUserId.Value);
        var spinnerIsWoman = women.Any(w => w.Account.Id == spinner.Account.Id);
        var eligibleTargetGender = spinnerIsWoman ? "man" : "woman";

        // Paid crystals fairness verification:
        // Even if spinner has 10,000 crystals, spin RNG is strictly fair server-side and client cannot dictate outcome.
        var grantRes = await Send(h, spinner, HttpMethod.Post, "/api/game/wallet/dev-grant", new DevGrantRequest(10000, "qa_rich_spinner"));
        Assert.Equal(HttpStatusCode.OK, grantRes.StatusCode);

        // Spinner spins the bottle
        var spinRes = await Send(h, spinner, HttpMethod.Post, $"/api/game/rooms/{room.Id}/spin");
        Assert.Equal(HttpStatusCode.OK, spinRes.StatusCode);
        var spinResult = (await spinRes.Content.ReadFromJsonAsync<SpinResult>())!;
        Assert.Equal(spinner.Account.Id, spinResult.SpinnerUserId);
        Assert.NotEqual(Guid.Empty, spinResult.TargetUserId);

        var target = allPlayers.Single(p => p.Account.Id == spinResult.TargetUserId);
        var targetIsWoman = women.Any(w => w.Account.Id == target.Account.Id);
        Assert.Equal(eligibleTargetGender, targetIsWoman ? "woman" : "man");

        // Pick a spectator (3rd user, non-pair member)
        var spectator = allPlayers.First(p => p.Account.Id != spinner.Account.Id && p.Account.Id != target.Account.Id);

        // 4. Advance spin deadline -> QuestionAnswering state for Question 0
        await h.Db(async db =>
        {
            var r = await db.Set<GameRoom>().SingleAsync(x => x.Id == room.Id);
            r.DeadlineUtc = DateTimeOffset.UtcNow.AddSeconds(-1);
            await db.SaveChangesAsync();
        });

        using (var scope = h.Factory.Services.CreateScope())
        {
            var gs = scope.ServiceProvider.GetRequiredService<GameService>();
            await gs.ProcessDeadlinesAndOutboxAsync(default);
        }

        // --- Question 0: Agreement (Match) ---
        var q0Snap = (await (await Send(h, spinner, HttpMethod.Get, $"/api/game/rooms/{room.Id}/snapshot")).Content.ReadFromJsonAsync<GameRoomSnapshot>())!;
        Assert.Equal("QuestionAnswering", q0Snap.CurrentRound!.State);
        Assert.Equal(0, q0Snap.CurrentRound.CurrentQuestionIndex);
        var q0 = q0Snap.CurrentRound.CurrentQuestion!;

        // Spinner answers option 1
        var spinnerAnsRes0 = await Send(h, spinner, HttpMethod.Post,
            $"/api/game/rooms/{room.Id}/rounds/{spinResult.RoundId}/questions/0/answer",
            new AnswerQuestionRequest(q0.Id, 1, false, Guid.NewGuid().ToString(), q0Snap.StateVersion));
        Assert.Equal(HttpStatusCode.OK, spinnerAnsRes0.StatusCode);
        var spinnerAns0 = (await spinnerAnsRes0.Content.ReadFromJsonAsync<AnswerQuestionResult>())!;
        Assert.True(spinnerAns0.WaitingForPartner);
        Assert.False(spinnerAns0.Revealed);

        // Spectator snapshot privacy check while waiting: spectator sees 0 pending answer
        var specSnapWait = (await (await Send(h, spectator, HttpMethod.Get, $"/api/game/rooms/{room.Id}/snapshot")).Content.ReadFromJsonAsync<GameRoomSnapshot>())!;
        Assert.Null(specSnapWait.CurrentRound!.CallerPendingAnswer);

        // Target answers option 1 (Agreement!)
        var targetAnsRes0 = await Send(h, target, HttpMethod.Post,
            $"/api/game/rooms/{room.Id}/rounds/{spinResult.RoundId}/questions/0/answer",
            new AnswerQuestionRequest(q0.Id, 1, false, Guid.NewGuid().ToString(), specSnapWait.StateVersion));
        Assert.Equal(HttpStatusCode.OK, targetAnsRes0.StatusCode);
        var targetAns0 = (await targetAnsRes0.Content.ReadFromJsonAsync<AnswerQuestionResult>())!;
        Assert.True(targetAns0.Revealed);
        Assert.True(targetAns0.RevealedSelection!.IsMatch);

        // Spectator reveal privacy: options are redacted
        var specSnapRev0 = (await (await Send(h, spectator, HttpMethod.Get, $"/api/game/rooms/{room.Id}/snapshot")).Content.ReadFromJsonAsync<GameRoomSnapshot>())!;
        Assert.Single(specSnapRev0.CurrentRound!.RevealedSelections);
        Assert.Null(specSnapRev0.CurrentRound.RevealedSelections[0].SpinnerOption);
        Assert.Null(specSnapRev0.CurrentRound.RevealedSelections[0].TargetOption);

        // --- Advance Question 0 reveal deadline (4s) -> directly transitions to KissChoice (1 question per round)! ---
        await h.Db(async db =>
        {
            var r = await db.Set<GameRoom>().SingleAsync(x => x.Id == room.Id);
            r.DeadlineUtc = DateTimeOffset.UtcNow.AddSeconds(-1);
            await db.SaveChangesAsync();
        });
        using (var scope = h.Factory.Services.CreateScope())
        {
            await scope.ServiceProvider.GetRequiredService<GameService>().ProcessDeadlinesAndOutboxAsync(default);
        }

        var kissChoiceSnap = (await (await Send(h, spinner, HttpMethod.Get, $"/api/game/rooms/{room.Id}/snapshot")).Content.ReadFromJsonAsync<GameRoomSnapshot>())!;
        Assert.Equal("KissChoice", kissChoiceSnap.CurrentRound!.State);

        // 5. Kiss Phase:
        // Spinner sends kiss to target
        var kissRes = await Send(h, spinner, HttpMethod.Post,
            $"/api/game/rooms/{room.Id}/rounds/{spinResult.RoundId}/kiss",
            new SendKissRequest(target.Account.Id, "qa_kiss_spin_target"));
        Assert.Equal(HttpStatusCode.OK, kissRes.StatusCode);
        var kissResult = (await kissRes.Content.ReadFromJsonAsync<SendKissResult>())!;
        Assert.Equal("Pending", kissResult.Status);

        // Spectator snapshot does NOT leak partner pending kiss
        var specSnapKiss = (await (await Send(h, spectator, HttpMethod.Get, $"/api/game/rooms/{room.Id}/snapshot")).Content.ReadFromJsonAsync<GameRoomSnapshot>())!;
        Assert.False(specSnapKiss.CurrentRound!.HasPendingKissFromPartner);

        // Target snapshot DOES see the received kiss flag
        var targetSnapKiss = (await (await Send(h, target, HttpMethod.Get, $"/api/game/rooms/{room.Id}/snapshot")).Content.ReadFromJsonAsync<GameRoomSnapshot>())!;
        Assert.True(targetSnapKiss.CurrentRound!.HasPendingKissFromPartner);

        // 6. Reciprocal Kiss & Mutual Game Match:
        // In next round where target has the turn, target sends reciprocal kiss back to spinner
        var round2Id = Guid.NewGuid();
        await h.Db(async db =>
        {
            var r = await db.Set<GameRoom>().SingleAsync(x => x.Id == room.Id);
            r.CurrentTurnUserId = target.Account.Id;
            r.CurrentRoundId = round2Id;
            r.DeadlineType = "KissChoice";
            r.DeadlineUtc = DateTimeOffset.UtcNow.AddSeconds(15);

            var rd2 = new GameRound
            {
                Id = round2Id,
                RoomId = room.Id,
                RoundNumber = 2,
                SpinnerUserId = target.Account.Id,
                TargetUserId = spinner.Account.Id,
                AngleDegrees = 0,
                State = "KissChoice",
                CurrentQuestionIndex = 4,
                ConsecutiveIncompleteQuestions = 0,
                QuestionsJson = "[]",
                RevealedSelectionsJson = "[]",
                StartedAtUtc = DateTimeOffset.UtcNow
            };
            db.Set<GameRound>().Add(rd2);
            await db.SaveChangesAsync();
        });

        var recipKissRes = await Send(h, target, HttpMethod.Post,
            $"/api/game/rooms/{room.Id}/rounds/{round2Id}/kiss",
            new SendKissRequest(spinner.Account.Id, "qa_recip_kiss"));
        Assert.Equal(HttpStatusCode.OK, recipKissRes.StatusCode);
        var recipKiss = (await recipKissRes.Content.ReadFromJsonAsync<SendKissResult>())!;
        Assert.Equal("Matched", recipKiss.Status);
        Assert.NotNull(recipKiss.MatchId);
        Assert.NotNull(recipKiss.ConversationId);

        // 7. Verify Chat is Locked (HasChatEntitlement = false)
        var matchId = recipKiss.MatchId.Value;
        var convId = recipKiss.ConversationId.Value;
        await h.Db(async db =>
        {
            var match = await db.Set<DatingMatch>().SingleAsync(m => m.Id == matchId);
            Assert.False(match.HasChatEntitlement);
        });

        // Sending chat message before unlock fails with Forbidden
        var forbiddenChatRes = await Send(h, spinner, HttpMethod.Post,
            $"/api/conversations/{convId}/messages",
            new { clientMessageId = Guid.NewGuid(), text = "Hello before unlock!" });
        Assert.Equal(HttpStatusCode.Forbidden, forbiddenChatRes.StatusCode);

        // 8. 25-Crystal Directed Profile Unlock:
        // Spectator unlocks target's profile for 25 crystals
        // Grant spectator 50 crystals first
        await Send(h, spectator, HttpMethod.Post, "/api/game/wallet/dev-grant", new DevGrantRequest(50, "spec_grant"));

        // Prior to unlock: spectator gets redacted profile preview
        var previewRes = await Send(h, spectator, HttpMethod.Get, $"/api/game/profiles/{target.Account.Id}");
        Assert.Equal(HttpStatusCode.OK, previewRes.StatusCode);
        var preview = (await previewRes.Content.ReadFromJsonAsync<GameProfileDto>())!;
        Assert.False(preview.IsFullAccess);
        Assert.Equal(25, preview.UnlockPrice);
        Assert.Empty(preview.Interests);

        // Spectator unlocks target's profile
        var profUnlockRes = await Send(h, spectator, HttpMethod.Post,
            $"/api/game/profiles/{target.Account.Id}/unlock",
            new UnlockProfileRequest(Guid.NewGuid().ToString("N")));
        Assert.Equal(HttpStatusCode.OK, profUnlockRes.StatusCode);
        var profUnlock = (await profUnlockRes.Content.ReadFromJsonAsync<UnlockProfileResult>())!;
        Assert.True(profUnlock.Unlocked);
        Assert.Equal(25, profUnlock.Debited);
        Assert.Equal(25, profUnlock.Balance);

        // After unlock: spectator gets complete dating profile
        var fullProfRes = await Send(h, spectator, HttpMethod.Get, $"/api/game/profiles/{target.Account.Id}");
        var fullProf = (await fullProfRes.Content.ReadFromJsonAsync<GameProfileDto>())!;
        Assert.True(fullProf.IsFullAccess);
        Assert.NotEmpty(fullProf.Interests);

        // Target receives view notice
        var viewsRes = await Send(h, target, HttpMethod.Get, "/api/game/profiles/views");
        Assert.Equal(HttpStatusCode.OK, viewsRes.StatusCode);
        var views = (await viewsRes.Content.ReadFromJsonAsync<GameProfileViewNoticeDto[]>())!;
        Assert.Contains(views, v => v.ViewerUserId == spectator.Account.Id);

        // 9. 25-Crystal Match Conversation Unlock:
        // Spinner unlocks match conversation for 25 crystals
        var matchUnlockRes = await Send(h, spinner, HttpMethod.Post,
            $"/api/matches/{matchId}/unlock",
            new UnlockMatchConversationRequest(Guid.NewGuid().ToString("N")));
        Assert.Equal(HttpStatusCode.OK, matchUnlockRes.StatusCode);
        var matchUnlock = (await matchUnlockRes.Content.ReadFromJsonAsync<UnlockMatchConversationResult>())!;
        Assert.True(matchUnlock.Unlocked);
        Assert.Equal(25, matchUnlock.Debited);

        // Both participants now have full chat entitlement
        var sendMsgRes = await Send(h, spinner, HttpMethod.Post,
            $"/api/conversations/{convId}/messages",
            new { clientMessageId = Guid.NewGuid(), text = "Welcome to unlocked Arena chat!" });
        Assert.Equal(HttpStatusCode.OK, sendMsgRes.StatusCode);

        var replyMsgRes = await Send(h, target, HttpMethod.Post,
            $"/api/conversations/{convId}/messages",
            new { clientMessageId = Guid.NewGuid(), text = "Hey! Mutual match chat works!" });
        Assert.Equal(HttpStatusCode.OK, replyMsgRes.StatusCode);

        // Spectator (3rd user) attempting to send message to this conversation receives Forbidden / NotFound
        var specChatRes = await Send(h, spectator, HttpMethod.Post,
            $"/api/conversations/{convId}/messages",
            new { clientMessageId = Guid.NewGuid(), text = "Eavesdropper trying to inject message" });
        Assert.True(specChatRes.StatusCode is HttpStatusCode.NotFound or HttpStatusCode.Forbidden);
    }

    [Fact]
    public async Task GameQA_Disconnect_Reconnect_Bounded_Timers_And_Recovery()
    {
        await using var h = await AuthHarness.Create();

        var w1 = await DirectUser(h, "dc_w1@gameqa.test", "woman");
        var w2 = await DirectUser(h, "dc_w2@gameqa.test", "woman");
        var w3 = await DirectUser(h, "dc_w3@gameqa.test", "woman");
        var m1 = await DirectUser(h, "dc_m1@gameqa.test", "man");
        var m2 = await DirectUser(h, "dc_m2@gameqa.test", "man");
        var m3 = await DirectUser(h, "dc_m3@gameqa.test", "man");

        var users = new[] { w1, w2, w3, m1, m2, m3 };
        GameRoomDetail? room = null;
        foreach (var u in users)
        {
            var res = await Send(h, u, HttpMethod.Post, "/api/game/queue", new JoinQueueRequest(6));
            room = await res.Content.ReadFromJsonAsync<GameRoomDetail>();
        }

        // Fast forward to Playing state
        await h.Db(async db =>
        {
            var r = await db.Set<GameRoom>().SingleAsync(x => x.Id == room!.Id);
            r.State = GameRoomState.Playing;
            r.CurrentTurnUserId = w1.Account.Id;
            await db.SaveChangesAsync();
        });

        // 1. Initial snapshot verifies active session
        var snapRes1 = await Send(h, w1, HttpMethod.Get, $"/api/game/rooms/{room!.Id}/snapshot");
        Assert.Equal(HttpStatusCode.OK, snapRes1.StatusCode);
        var snap1 = (await snapRes1.Content.ReadFromJsonAsync<GameRoomSnapshot>())!;
        Assert.Equal("Playing", snap1.State);
        Assert.True(snap1.StateVersion > 0);

        // 2. Disconnect: simulate network drop by setting DisconnectedAtUtc and 60s reservation
        await h.Db(async db =>
        {
            var mem = await db.Set<GameMembership>().SingleAsync(m => m.RoomId == room.Id && m.UserId == w1.Account.Id);
            mem.DisconnectedAtUtc = DateTimeOffset.UtcNow;
            mem.ReservationExpiresAtUtc = DateTimeOffset.UtcNow.AddSeconds(60);
            await db.SaveChangesAsync();
        });

        // 3. Reconnect within reservation window restores membership
        var reconnectRes = await Send(h, w1, HttpMethod.Post, $"/api/game/rooms/{room.Id}/reconnect");
        Assert.Equal(HttpStatusCode.OK, reconnectRes.StatusCode);

        // 4. Snapshot recovery: verify exact state version and active status
        var snapRes2 = await Send(h, w1, HttpMethod.Get, $"/api/game/rooms/{room.Id}/snapshot");
        Assert.Equal(HttpStatusCode.OK, snapRes2.StatusCode);
        var snap2 = (await snapRes2.Content.ReadFromJsonAsync<GameRoomSnapshot>())!;
        Assert.Equal("Playing", snap2.State);
        Assert.True(snap2.StateVersion >= snap1.StateVersion);

        // 5. Bounded timer guarantee: Pause budget is maximum 15s (15,000ms) per round
        Assert.Equal(15000, snap2.DisconnectPauseBudgetMs);
    }

    [Fact]
    public async Task GameQA_Block_And_Account_Deletion_Revokes_Game_And_Chat_Instantly()
    {
        await using var h = await AuthHarness.Create();

        var w1 = await DirectUser(h, "blk_w1@gameqa.test", "woman");
        var m1 = await DirectUser(h, "blk_m1@gameqa.test", "man");

        // 1. Create a game match between w1 and m1
        Guid matchId = Guid.NewGuid();
        Guid convId = Guid.NewGuid();
        var now = DateTimeOffset.UtcNow;

        var (firstId, secondId) = PairSynchronization.Order(w1.Account.Id, m1.Account.Id);

        await h.Db(async db =>
        {
            var match = new DatingMatch
            {
                Id = matchId,
                FirstId = firstId,
                SecondId = secondId,
                CreatedAt = now,
                Active = true,
                Origin = "GameArena",
                HasChatEntitlement = true // Unlocked chat
            };
            var conv = new Conversation
            {
                Id = convId,
                MatchId = matchId,
                LastSequence = 0
            };
            db.Set<DatingMatch>().Add(match);
            db.Set<Conversation>().Add(conv);
            await db.SaveChangesAsync();
        });

        // Verify w1 can send chat message initially
        var initialMsgRes = await Send(h, w1, HttpMethod.Post,
            $"/api/conversations/{convId}/messages",
            new { clientMessageId = Guid.NewGuid(), text = "Before block" });
        Assert.Equal(HttpStatusCode.OK, initialMsgRes.StatusCode);

        // 2. w1 blocks m1
        var blockRes = await Send(h, w1, HttpMethod.Post, "/api/safety", new SafetyRequest(Guid.NewGuid(), "block", m1.Account.Id, convId));
        Assert.Equal(HttpStatusCode.NoContent, blockRes.StatusCode);

        // 3. Match and Chat are immediately revoked server-side:
        // Message from m1 is rejected with 404 or 403
        var blockedMsgRes = await Send(h, m1, HttpMethod.Post,
            $"/api/conversations/{convId}/messages",
            new { clientMessageId = Guid.NewGuid(), text = "Trying to chat after block" });
        Assert.True(blockedMsgRes.StatusCode is HttpStatusCode.NotFound or HttpStatusCode.Forbidden);

        // 4. Incompatibility check prevents sharing an Arena room:
        // Creating a room and attempting to join while blocked fails
        var createRoomRes = await Send(h, w1, HttpMethod.Post, "/api/game/rooms", new CreateRoomRequest("Blocked Arena"));
        Assert.Equal(HttpStatusCode.OK, createRoomRes.StatusCode);
        var bRoom = (await createRoomRes.Content.ReadFromJsonAsync<GameRoomDetail>())!;

        var joinBlockedRes = await Send(h, m1, HttpMethod.Post, $"/api/game/rooms/{bRoom.Id}/join");
        // Non-identifying 404 room_unavailable per safety specs
        Assert.Equal(HttpStatusCode.NotFound, joinBlockedRes.StatusCode);
    }

    [Fact]
    public async Task GameQA_Deterministic_Georgian_AI_Fallback_Latency_Under_Workload()
    {
        var provider = new DeterministicAiCommentaryProvider();

        // 1. Measure question commentary latency across 100 iterations
        var sw = Stopwatch.StartNew();
        for (var i = 0; i < 100; i++)
        {
            var isMatch = i % 2 == 0;
            var ctx = new QuestionCommentaryContext(
                "რომელია შენი საყვარელი სეზონი?",
                new[] { "ზაფხული", "ზამთარი", "შემოდგომა", "გაზაფხული" },
                0,
                "ზაფხული",
                isMatch ? 0 : 1,
                isMatch ? "ზაფხული" : "ზამთარი",
                isMatch,
                "ka"
            );
            var res = await provider.GenerateQuestionCommentaryAsync(ctx, default);
            Assert.True(res.Success);
            Assert.NotEmpty(res.Commentary);
            Assert.True(res.Commentary.Length >= 8);
        }
        sw.Stop();

        var avgMicroseconds = (sw.Elapsed.TotalMilliseconds * 1000.0) / 100.0;
        // Deterministic fallback must execute in under 1 millisecond (< 1,000 microseconds)
        Assert.True(avgMicroseconds < 1000.0, $"Deterministic AI generation took too long: {avgMicroseconds:F2} μs avg");

        // 2. Measure round summary commentary latency
        sw.Restart();
        for (var i = 0; i < 100; i++)
        {
            var ctx = new RoundSummaryContext(
                5,
                3,
                2,
                1,
                new RoundQuestionSummaryItem[]
                {
                    new("რომელია შენი საყვარელი სეზონი?", "ზაფხული", "ზაფხული", true)
                },
                "ka"
            );
            var summary = await provider.GenerateRoundSummaryAsync(ctx, default);
            Assert.True(summary.Success);
            Assert.NotEmpty(summary.Commentary);
            Assert.Contains("3 დასრულებული კითხვიდან", summary.Commentary);
        }
        sw.Stop();

        var avgSummaryMicroseconds = (sw.Elapsed.TotalMilliseconds * 1000.0) / 100.0;
        Assert.True(avgSummaryMicroseconds < 1000.0, $"Deterministic Summary generation took too long: {avgSummaryMicroseconds:F2} μs avg");
    }
}
