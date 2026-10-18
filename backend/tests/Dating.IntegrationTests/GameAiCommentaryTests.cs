using System.Net;
using System.Net.Http.Json;
using Dating.Api.Features.Auth;
using Dating.Api.Features.Game;
using Dating.Api.Features.Game.Ai;
using Dating.Api.Features.Profiles;
using Dating.Api.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace Dating.IntegrationTests;

public class GameAiCommentaryTests
{
    private static async Task<HttpResponseMessage> Send(AuthHarness h, TokenResponse user, HttpMethod method, string path, object? value = null)
    {
        using var request = new HttpRequestMessage(method, path);
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
            DisplayName = $"Direct {gender}",
            Bio = "A verified complete dating profile for game arena.",
            Gender = gender,
            DesiredGenders = desired,
            City = "Tbilisi",
            CityKey = "tbilisi",
            Interests = ["music", "gaming"],
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
    public async Task AiCommentary_DeterministicFallback_ProducesValidGeorgianMessages_ForMatchesAndDifferences()
    {
        var provider = new DeterministicAiCommentaryProvider();

        var matchContext = new QuestionCommentaryContext(
            QuestionText: "იდეალური პირველი პაემანი სად წარმოგიდგენიათ?",
            Options: ["მყუდრო კაფეში", "სეირნობა პარკში", "გამოფენაზე"],
            SpinnerOptionIndex: 0,
            SpinnerOptionText: "მყუდრო კაფეში",
            TargetOptionIndex: 0,
            TargetOptionText: "მყუდრო კაფეში",
            IsMatch: true,
            Language: "ka"
        );

        var matchResult = await provider.GenerateQuestionCommentaryAsync(matchContext, CancellationToken.None);
        Assert.True(matchResult.Success);
        Assert.True(matchResult.IsFallback);
        Assert.Contains("მყუდრო კაფეში", matchResult.Commentary);

        var (isValidMatch, reasonMatch) = AiCommentaryValidator.Validate(matchResult.Commentary);
        Assert.True(isValidMatch, reasonMatch);

        var diffContext = new QuestionCommentaryContext(
            QuestionText: "რომელ სეზონს ანიჭებთ უპირატესობას?",
            Options: ["ზაფხული", "შემოდგომა", "ზამთარი"],
            SpinnerOptionIndex: 0,
            SpinnerOptionText: "ზაფხული",
            TargetOptionIndex: 1,
            TargetOptionText: "შემოდგომა",
            IsMatch: false,
            Language: "ka"
        );

        var diffResult = await provider.GenerateQuestionCommentaryAsync(diffContext, CancellationToken.None);
        Assert.True(diffResult.Success);
        Assert.True(diffResult.IsFallback);
        Assert.Contains("ზაფხული", diffResult.Commentary);
        Assert.Contains("შემოდგომა", diffResult.Commentary);

        var (isValidDiff, reasonDiff) = AiCommentaryValidator.Validate(diffResult.Commentary);
        Assert.True(isValidDiff, reasonDiff);
    }

    [Fact]
    public async Task AiCommentary_DeterministicFallback_Summary_Handles0Matches_Accurately()
    {
        var provider = new DeterministicAiCommentaryProvider();

        var summaryContext = new RoundSummaryContext(
            TotalQuestionsCount: 5,
            AnsweredQuestionsCount: 5,
            MatchesCount: 0,
            DifferencesCount: 5,
            CompletedQuestions:
            [
                new("კითხვა 1", "ა", "ბ", false),
                new("კითხვა 2", "გ", "დ", false),
                new("კითხვა 3", "ე", "ვ", false),
                new("კითხვა 4", "ზ", "თ", false),
                new("კითხვა 5", "ი", "კ", false)
            ],
            Language: "ka"
        );

        var result = await provider.GenerateRoundSummaryAsync(summaryContext, CancellationToken.None);
        Assert.True(result.Success);
        Assert.Contains("განსხვავებული ხედვები", result.Commentary);

        var (isValid, reason) = AiCommentaryValidator.Validate(result.Commentary);
        Assert.True(isValid, reason);
    }

    [Fact]
    public async Task AiCommentary_DeterministicFallback_Summary_HandlesIncompleteRounds_Accurately()
    {
        var provider = new DeterministicAiCommentaryProvider();

        var summaryContext = new RoundSummaryContext(
            TotalQuestionsCount: 5,
            AnsweredQuestionsCount: 2,
            MatchesCount: 1,
            DifferencesCount: 1,
            CompletedQuestions:
            [
                new("კითხვა 1", "ა", "ა", true),
                new("კითხვა 2", "ბ", "გ", false)
            ],
            Language: "ka"
        );

        var result = await provider.GenerateRoundSummaryAsync(summaryContext, CancellationToken.None);
        Assert.True(result.Success);
        Assert.Contains("2 დასრულებული კითხვიდან 1 თანხვედრა", result.Commentary);

        var (isValid, reason) = AiCommentaryValidator.Validate(result.Commentary);
        Assert.True(isValid, reason);
    }

    [Fact]
    public void AiCommentary_Validator_RejectsDisallowedContent_Length_AndRefusals()
    {
        // 1. Refusal
        var (val1, r1) = AiCommentaryValidator.Validate("I cannot fulfill this request as an AI.");
        Assert.False(val1);
        Assert.Contains("Refusal", r1);

        // 2. Georgian refusal
        var (val2, r2) = AiCommentaryValidator.Validate("ბოდიში, ვერ შევძლებ ამის დაწერას.");
        Assert.False(val2);
        Assert.Contains("Refusal", r2);

        // 3. Compatibility claim
        var (val3, r3) = AiCommentaryValidator.Validate("თქვენი თავსებადობაა 95%! ნამდვილი სიყვარულია.");
        Assert.False(val3);
        Assert.Contains("attraction", r3);

        // 4. Pressure for kisses or crystals
        var (val4, r4) = AiCommentaryValidator.Validate("ახლა აკოცე და კრისტალი გადაიხადე.");
        Assert.False(val4);
        Assert.Contains("monetization", r4);

        // 5. Too short
        var (val5, r5) = AiCommentaryValidator.Validate("მოკლე");
        Assert.False(val5);
        Assert.Contains("too short", r5);

        // 6. English-only (no Georgian script)
        var (val6, r6) = AiCommentaryValidator.Validate("This text has no Georgian characters at all.");
        Assert.False(val6);
        Assert.Contains("must contain Georgian", r6);
    }

    [Fact]
    public async Task AiCommentary_UserConsent_RequiresOptIn_AndRespectsRevocation()
    {
        await using var h = await AuthHarness.Create();
        var user = await DirectUser(h, "ai.consent.user@example.com", "woman");

        // 1. Initial consent check (default false)
        var res1 = await Send(h, user, HttpMethod.Get, "/api/game/ai-consent");
        Assert.Equal(HttpStatusCode.OK, res1.StatusCode);
        var consent1 = await res1.Content.ReadFromJsonAsync<UserAiConsentResponse>();
        Assert.NotNull(consent1);
        Assert.False(consent1.AiConsent);
        Assert.NotEmpty(consent1.DisclosureText);
        Assert.Null(consent1.ConsentGivenAtUtc);

        // 2. Grant consent (Opt-in)
        var res2 = await Send(h, user, HttpMethod.Post, "/api/game/ai-consent", new UpdateAiConsentRequest(true));
        Assert.Equal(HttpStatusCode.OK, res2.StatusCode);
        var consent2 = await res2.Content.ReadFromJsonAsync<UserAiConsentResponse>();
        Assert.NotNull(consent2);
        Assert.True(consent2.AiConsent);
        Assert.NotNull(consent2.ConsentGivenAtUtc);

        // Verify persisted in DB
        await h.Db(async db =>
        {
            var row = await db.Set<UserGameSettings>().SingleOrDefaultAsync(s => s.UserId == user.Account.Id);
            Assert.NotNull(row);
            Assert.True(row.AiConsent);
        });

        // 3. Revoke consent
        var res3 = await Send(h, user, HttpMethod.Post, "/api/game/ai-consent", new UpdateAiConsentRequest(false));
        Assert.Equal(HttpStatusCode.OK, res3.StatusCode);
        var consent3 = await res3.Content.ReadFromJsonAsync<UserAiConsentResponse>();
        Assert.NotNull(consent3);
        Assert.False(consent3.AiConsent);
        Assert.Null(consent3.ConsentGivenAtUtc);
    }

    [Fact]
    public async Task AiCommentary_RoundExecution_WhenConsentMissing_UsesDeterministicFallback()
    {
        await using var h = await AuthHarness.Create();
        var w1 = await DirectUser(h, "ai_noc_w1@game.test", gender: "woman");
        var w2 = await DirectUser(h, "ai_noc_w2@game.test", gender: "woman");
        var w3 = await DirectUser(h, "ai_noc_w3@game.test", gender: "woman");
        var m1 = await DirectUser(h, "ai_noc_m1@game.test", gender: "man");
        var m2 = await DirectUser(h, "ai_noc_m2@game.test", gender: "man");
        var m3 = await DirectUser(h, "ai_noc_m3@game.test", gender: "man");

        var users = new[] { w1, w2, w3, m1, m2, m3 };
        GameRoomDetail? room = null;
        foreach (var u in users)
        {
            var res = await Send(h, u, HttpMethod.Post, "/api/game/queue", new JoinQueueRequest(6));
            room = await res.Content.ReadFromJsonAsync<GameRoomDetail>();
        }

        Assert.NotNull(room);

        // Advance StartingCountdown -> Playing
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

        var startSnap = (await (await Send(h, w1, HttpMethod.Get, $"/api/game/rooms/{room.Id}/snapshot")).Content.ReadFromJsonAsync<GameRoomSnapshot>())!;
        var turnUser = users.Single(u => u.Account.Id == startSnap.CurrentTurnUserId!.Value);

        var spinRes = await Send(h, turnUser, HttpMethod.Post, $"/api/game/rooms/{room.Id}/spin");
        Assert.Equal(HttpStatusCode.OK, spinRes.StatusCode);
        var spin = (await spinRes.Content.ReadFromJsonAsync<SpinResult>())!;
        var partnerUser = users.Single(u => u.Account.Id == spin.TargetUserId);
        var spectatorUser = users.First(u => u.Account.Id != turnUser.Account.Id && u.Account.Id != partnerUser.Account.Id);

        // Advance spin deadline (4s) -> QuestionAnswering
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

        // Spinner answers
        var snapRes1 = await Send(h, turnUser, HttpMethod.Get, $"/api/game/rooms/{room.Id}/snapshot");
        var snap1 = await snapRes1.Content.ReadFromJsonAsync<GameRoomSnapshot>();
        Assert.NotNull(snap1);

        await Send(h, turnUser, HttpMethod.Post, $"/api/game/rooms/{room.Id}/rounds/{spin.RoundId}/questions/0/answer", new AnswerQuestionRequest(
            QuestionId: snap1.CurrentRound!.CurrentQuestion!.Id,
            SelectedOption: 0,
            IsSkipped: false,
            IdempotencyKey: Guid.NewGuid().ToString("N"),
            StateVersion: snap1.StateVersion
        ));

        // Partner answers same option (match)
        var snapRes2 = await Send(h, partnerUser, HttpMethod.Get, $"/api/game/rooms/{room.Id}/snapshot");
        var snap2 = await snapRes2.Content.ReadFromJsonAsync<GameRoomSnapshot>();
        Assert.NotNull(snap2);

        var targetAnsRes = await Send(h, partnerUser, HttpMethod.Post, $"/api/game/rooms/{room.Id}/rounds/{spin.RoundId}/questions/0/answer", new AnswerQuestionRequest(
            QuestionId: snap2.CurrentRound!.CurrentQuestion!.Id,
            SelectedOption: 0,
            IsSkipped: false,
            IdempotencyKey: Guid.NewGuid().ToString("N"),
            StateVersion: snap2.StateVersion
        ));

        var targetAns = await targetAnsRes.Content.ReadFromJsonAsync<AnswerQuestionResult>();
        Assert.NotNull(targetAns);
        Assert.True(targetAns.Revealed);
        Assert.NotNull(targetAns.RevealedSelection);
        Assert.True(targetAns.RevealedSelection.IsMatch);
        Assert.NotEmpty(targetAns.RevealedSelection.FallbackCommentary);

        // Spectator check: commentary must be redacted
        var specSnapRes = await Send(h, spectatorUser, HttpMethod.Get, $"/api/game/rooms/{room.Id}/snapshot");
        var specSnap = await specSnapRes.Content.ReadFromJsonAsync<GameRoomSnapshot>();
        Assert.NotNull(specSnap);
        Assert.NotNull(specSnap.CurrentRound);
        Assert.NotEmpty(specSnap.CurrentRound.RevealedSelections);
        Assert.Equal("", specSnap.CurrentRound.RevealedSelections[0].FallbackCommentary);
        Assert.Null(specSnap.CurrentRound.SummaryCommentary);
    }

    [Fact]
    public async Task AiCommentary_RoundExecution_WhenBothUsersConsent_AiCommentaryGeneratedAndPersisted()
    {
        await using var h = await AuthHarness.Create();
        var w1 = await DirectUser(h, "ai_yes_w1@game.test", gender: "woman");
        var w2 = await DirectUser(h, "ai_yes_w2@game.test", gender: "woman");
        var w3 = await DirectUser(h, "ai_yes_w3@game.test", gender: "woman");
        var m1 = await DirectUser(h, "ai_yes_m1@game.test", gender: "man");
        var m2 = await DirectUser(h, "ai_yes_m2@game.test", gender: "man");
        var m3 = await DirectUser(h, "ai_yes_m3@game.test", gender: "man");

        var users = new[] { w1, w2, w3, m1, m2, m3 };

        // All players grant consent
        foreach (var u in users)
        {
            await Send(h, u, HttpMethod.Post, "/api/game/ai-consent", new UpdateAiConsentRequest(true));
        }

        GameRoomDetail? room = null;
        foreach (var u in users)
        {
            var res = await Send(h, u, HttpMethod.Post, "/api/game/queue", new JoinQueueRequest(6));
            room = await res.Content.ReadFromJsonAsync<GameRoomDetail>();
        }

        Assert.NotNull(room);

        // Advance StartingCountdown -> Playing
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

        var startSnap = (await (await Send(h, w1, HttpMethod.Get, $"/api/game/rooms/{room.Id}/snapshot")).Content.ReadFromJsonAsync<GameRoomSnapshot>())!;
        var turnUser = users.Single(u => u.Account.Id == startSnap.CurrentTurnUserId!.Value);

        var spinRes = await Send(h, turnUser, HttpMethod.Post, $"/api/game/rooms/{room.Id}/spin");
        Assert.Equal(HttpStatusCode.OK, spinRes.StatusCode);
        var spin = (await spinRes.Content.ReadFromJsonAsync<SpinResult>())!;
        var partnerUser = users.Single(u => u.Account.Id == spin.TargetUserId);

        // Advance spin deadline -> QuestionAnswering and ensure 3 questions for Q1, Q2 skips
        await h.Db(async db =>
        {
            var r = await db.Set<GameRoom>().SingleAsync(x => x.Id == room.Id);
            r.DeadlineUtc = DateTimeOffset.UtcNow.AddSeconds(-1);
            var rd = await db.Set<GameRound>().SingleAsync(x => x.Id == spin.RoundId);
            var qList = System.Text.Json.JsonSerializer.Deserialize<List<FrozenQuestionDto>>(rd.QuestionsJson) ?? [];
            while (qList.Count < 3)
            {
                qList.Add(new FrozenQuestionDto(Guid.NewGuid(), $"Extra Question {qList.Count}", ["A", "B", "C", "D"], "general"));
            }
            rd.QuestionsJson = System.Text.Json.JsonSerializer.Serialize(qList);
            await db.SaveChangesAsync();
        });

        using (var scope = h.Factory.Services.CreateScope())
        {
            var gs = scope.ServiceProvider.GetRequiredService<GameService>();
            await gs.ProcessDeadlinesAndOutboxAsync(default);
        }

        var snap = (await (await Send(h, turnUser, HttpMethod.Get, $"/api/game/rooms/{room.Id}/snapshot")).Content.ReadFromJsonAsync<GameRoomSnapshot>())!;

        // Answer Q0
        await Send(h, turnUser, HttpMethod.Post, $"/api/game/rooms/{room.Id}/rounds/{spin.RoundId}/questions/0/answer", new AnswerQuestionRequest(
            QuestionId: snap.CurrentRound!.CurrentQuestion!.Id,
            SelectedOption: 1,
            IsSkipped: false,
            IdempotencyKey: Guid.NewGuid().ToString("N"),
            StateVersion: snap.StateVersion
        ));

        var ans1 = await Send(h, partnerUser, HttpMethod.Post, $"/api/game/rooms/{room.Id}/rounds/{spin.RoundId}/questions/0/answer", new AnswerQuestionRequest(
            QuestionId: snap.CurrentRound!.CurrentQuestion!.Id,
            SelectedOption: 1,
            IsSkipped: false,
            IdempotencyKey: Guid.NewGuid().ToString("N"),
            StateVersion: snap.StateVersion
        ));

        var ans1Result = await ans1.Content.ReadFromJsonAsync<AnswerQuestionResult>();
        Assert.NotNull(ans1Result);
        Assert.True(ans1Result.Revealed);
        Assert.NotEmpty(ans1Result.RevealedSelection!.FallbackCommentary);

        // Advance reveal deadline
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

        // Skip Q1
        await Send(h, turnUser, HttpMethod.Post, $"/api/game/rooms/{room.Id}/rounds/{spin.RoundId}/questions/1/skip", new SkipQuestionRequest(Guid.NewGuid().ToString("N")));

        // Advance reveal
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

        // Skip Q2 (triggers 2 consecutive incomplete -> EndedEarly)
        await Send(h, turnUser, HttpMethod.Post, $"/api/game/rooms/{room.Id}/rounds/{spin.RoundId}/questions/2/skip", new SkipQuestionRequest(Guid.NewGuid().ToString("N")));

        // Advance deadline to allow EndedEarly processing
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

        // Verify round has EndedEarly and SummaryCommentary is generated
        await h.Db(async db =>
        {
            var round = await db.Set<GameRound>().SingleAsync(x => x.Id == spin.RoundId);
            Assert.Equal("EndedEarly", round.State);
            Assert.NotNull(round.SummaryCommentary);
            Assert.NotEmpty(round.SummaryCommentary);
        });

        // Verify participant sees SummaryCommentary in snapshot
        var finalSnap = (await (await Send(h, turnUser, HttpMethod.Get, $"/api/game/rooms/{room.Id}/snapshot")).Content.ReadFromJsonAsync<GameRoomSnapshot>())!;
        Assert.NotNull(finalSnap.CurrentRound?.SummaryCommentary);
        Assert.NotEmpty(finalSnap.CurrentRound!.SummaryCommentary);
    }
}
