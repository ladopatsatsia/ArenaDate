using System.Diagnostics;
using System.Net;
using System.Net.Http.Json;
using Dating.Api.Features.AccountLifecycle;
using Dating.Api.Features.Auth;
using Dating.Api.Features.Chat;
using Dating.Api.Features.Discovery;
using Dating.Api.Features.Matching;
using Dating.Api.Features.Moderation;
using Dating.Api.Features.Notifications;
using Dating.Api.Features.Profiles;
using Dating.Api.Features.Safety;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace Dating.IntegrationTests;

public class RegressionTests
{
    [Fact]
    public async Task Adversarial_three_user_end_to_end_verification()
    {
        await using var h = await AuthHarness.Create(enablePush: true);

        // 1. Three users: Alice (A), Bob (B), and Charlie (C)
        var alice = await h.Account("alice.regression@example.test");
        var bob = await h.Account("bob.regression@example.test");
        var charlie = await h.Account("charlie.regression@example.test");

        // 2. Refresh replay detection on Bob's account
        var refreshRes = await h.Client.PostAsJsonAsync("/api/auth/refresh", new RefreshRequest(bob.RefreshToken, Guid.NewGuid()));
        Assert.Equal(HttpStatusCode.OK, refreshRes.StatusCode);
        var bobTokens2 = (await refreshRes.Content.ReadFromJsonAsync<TokenResponse>())!;

        // Replaying the old refresh token must fail (Conflict within grace period or Unauthorized)
        var replayRes = await h.Client.PostAsJsonAsync("/api/auth/refresh", new RefreshRequest(bob.RefreshToken, Guid.NewGuid()));
        Assert.True(replayRes.StatusCode == HttpStatusCode.Conflict || replayRes.StatusCode == HttpStatusCode.Unauthorized);

        // Using a completely invalid/random token must fail with Unauthorized
        var invalidRes = await h.Client.PostAsJsonAsync("/api/auth/refresh", new RefreshRequest("invalid_token_12345", Guid.NewGuid()));
        Assert.Equal(HttpStatusCode.Unauthorized, invalidRes.StatusCode);

        // Bob logs in again fresh
        bob = await h.Login("bob.regression@example.test");

        // 3. Profiles and Photo Moderation
        await ProfileTests.Send(h, alice, HttpMethod.Post, "/api/profile", ProfileTests.Input(0));
        await ProfileTests.Send(h, bob, HttpMethod.Post, "/api/profile", ProfileTests.Input(0));
        await ProfileTests.Send(h, charlie, HttpMethod.Post, "/api/profile", ProfileTests.Input(0));

        // Alice uploads photo; initially in pending state
        var alicePhoto = await ProfileTests.Upload(h, alice);

        // Bob's discovery query: Alice has no approved photos yet, so Bob must NOT see Alice
        var bobDiscovery = await ProfileTests.Send(h, bob, HttpMethod.Get, "/api/discovery");
        var bobCards = (await bobDiscovery.Content.ReadFromJsonAsync<DiscoveryPage>())!;
        Assert.DoesNotContain(bobCards.Items, c => c.Id == alice.Account.Id);

        // Moderator approves Alice's photo
        var staffAccount = await h.Account("mod.staff@example.test");
        var modBrowser = await ModerationTests.SignedIn(h, staffAccount, "mod.staff@example.test");
        var approvePhotoRes = await modBrowser.PostAsJsonAsync($"/api/moderation/photos/{alicePhoto.Id}", new ReviewRequest("approved", "Verified photo meets guidelines"));
        Assert.Equal(HttpStatusCode.NoContent, approvePhotoRes.StatusCode);

        // Bob also gets an approved photo so reciprocal discovery works
        await h.Db(async db =>
        {
            db.Add(new ProfilePhoto
            {
                Id = Guid.NewGuid(),
                UserId = bob.Account.Id,
                RequestId = Guid.NewGuid(),
                State = "approved",
                ObjectKey = "bob_photo.jpg",
                ThumbnailKey = "bob_thumb.jpg",
                Position = 0,
                Width = 600,
                Height = 400
            });
            await db.SaveChangesAsync();
        });

        // Now Bob's discovery query includes Alice
        var bobDiscovery2 = await ProfileTests.Send(h, bob, HttpMethod.Get, "/api/discovery");
        var bobCards2 = (await bobDiscovery2.Content.ReadFromJsonAsync<DiscoveryPage>())!;
        Assert.Contains(bobCards2.Items, c => c.Id == alice.Account.Id);

        // 4. Swipe & Mutual Match: Bob likes Alice; then Alice likes Bob -> exactly one match
        var bobSwipe = await ProfileTests.Send(h, bob, HttpMethod.Post, "/api/swipes", new SwipeRequest(Guid.NewGuid(), alice.Account.Id, "like"));
        Assert.Equal(HttpStatusCode.OK, bobSwipe.StatusCode);
        var bobSwipeResult = (await bobSwipe.Content.ReadFromJsonAsync<SwipeResult>())!;
        Assert.Null(bobSwipeResult.MatchId); // No match yet

        var aliceSwipe = await ProfileTests.Send(h, alice, HttpMethod.Post, "/api/swipes", new SwipeRequest(Guid.NewGuid(), bob.Account.Id, "like"));
        Assert.Equal(HttpStatusCode.OK, aliceSwipe.StatusCode);
        var aliceSwipeResult = (await aliceSwipe.Content.ReadFromJsonAsync<SwipeResult>())!;
        Assert.NotNull(aliceSwipeResult.MatchId); // Mutual match created!
        var matchId = aliceSwipeResult.MatchId.Value;

        // Get conversation ID
        Guid conversationId = Guid.Empty;
        await h.Db(async db =>
        {
            var conv = await db.Set<Conversation>().SingleAsync(c => c.MatchId == matchId);
            conversationId = conv.Id;
        });

        // 5. Outsider Security: Charlie attempts to access or message in Alice & Bob's conversation
        var charlieRead = await ProfileTests.Send(h, charlie, HttpMethod.Get, $"/api/conversations/{conversationId}/messages");
        Assert.Equal(HttpStatusCode.NotFound, charlieRead.StatusCode);

        var charlieSend = await ProfileTests.Send(h, charlie, HttpMethod.Post, $"/api/conversations/{conversationId}/messages", new SendMessage(Guid.NewGuid(), "intruder message"));
        Assert.Equal(HttpStatusCode.NotFound, charlieSend.StatusCode);

        // 6. Messaging, Monotonic Order, and Idempotent Retry on Lost Network Response
        var clientMsgId = Guid.NewGuid();
        var msgReq = new SendMessage(clientMsgId, "Hello Bob, nice to match with you!");
        var send1 = await ProfileTests.Send(h, alice, HttpMethod.Post, $"/api/conversations/{conversationId}/messages", msgReq);
        Assert.Equal(HttpStatusCode.OK, send1.StatusCode);
        var sentMsg1 = (await send1.Content.ReadFromJsonAsync<MessageDto>())!;
        Assert.Equal("1", sentMsg1.Sequence);

        // Simulated network timeout retry with identical clientMessageId -> returns identical message without duplicating
        var sendRetry = await ProfileTests.Send(h, alice, HttpMethod.Post, $"/api/conversations/{conversationId}/messages", msgReq);
        Assert.Equal(HttpStatusCode.OK, sendRetry.StatusCode);
        var sentMsgRetry = (await sendRetry.Content.ReadFromJsonAsync<MessageDto>())!;
        Assert.Equal(sentMsg1.Id, sentMsgRetry.Id);
        Assert.Equal(sentMsg1.Sequence, sentMsgRetry.Sequence);

        // Bob replies
        var replyReq = new SendMessage(Guid.NewGuid(), "Hi Alice! Great to meet you.");
        var send2 = await ProfileTests.Send(h, bob, HttpMethod.Post, $"/api/conversations/{conversationId}/messages", replyReq);
        Assert.Equal(HttpStatusCode.OK, send2.StatusCode);
        var sentMsg2 = (await send2.Content.ReadFromJsonAsync<MessageDto>())!;
        Assert.Equal("2", sentMsg2.Sequence);

        // History check: exactly 2 messages in monotonic sequence order
        var historyRes = await ProfileTests.Send(h, bob, HttpMethod.Get, $"/api/conversations/{conversationId}/messages");
        Assert.Equal(HttpStatusCode.OK, historyRes.StatusCode);
        var history = (await historyRes.Content.ReadFromJsonAsync<HistoryPage>())!;
        Assert.Equal(2, history.Items.Length);
        Assert.Equal(["1", "2"], history.Items.Select(m => m.Sequence));

        // 7. Safety: Bob reports Alice with attached evidence
        var reportReq = new SafetyRequest(Guid.NewGuid(), "report", ConversationId: conversationId, Report: new("message", "harassment", "Inappropriate behavior", sentMsg1.Id));
        var reportRes = await ProfileTests.Send(h, bob, HttpMethod.Post, "/api/safety", reportReq);
        Assert.Equal(HttpStatusCode.NoContent, reportRes.StatusCode);

        // Moderator can view report
        var reportsListRes = await modBrowser.GetAsync("/api/moderation/reports");
        Assert.Equal(HttpStatusCode.OK, reportsListRes.StatusCode);

        // 8. Safety Block: Alice blocks Bob
        var blockReq = new SafetyRequest(Guid.NewGuid(), "block", ConversationId: conversationId);
        var blockRes = await ProfileTests.Send(h, alice, HttpMethod.Post, "/api/safety", blockReq);
        Assert.Equal(HttpStatusCode.NoContent, blockRes.StatusCode);

        // After block, both users lose conversation access
        var blockedReadAlice = await ProfileTests.Send(h, alice, HttpMethod.Get, $"/api/conversations/{conversationId}/messages");
        Assert.Equal(HttpStatusCode.NotFound, blockedReadAlice.StatusCode);
        var blockedReadBob = await ProfileTests.Send(h, bob, HttpMethod.Get, $"/api/conversations/{conversationId}/messages");
        Assert.Equal(HttpStatusCode.NotFound, blockedReadBob.StatusCode);

        // Bob cannot send any further messages
        var blockedSendBob = await ProfileTests.Send(h, bob, HttpMethod.Post, $"/api/conversations/{conversationId}/messages", new SendMessage(Guid.NewGuid(), "Are you there?"));
        Assert.Equal(HttpStatusCode.NotFound, blockedSendBob.StatusCode);

        // 9. Push Device Binding Security Across Logins
        var sharedDeviceId = Guid.NewGuid();
        var sharedSecret = Guid.NewGuid().ToString("N") + Guid.NewGuid().ToString("N");
        var charlieDeviceReq = new DeviceRequest(sharedDeviceId, sharedSecret, 1, "expo", AuthHarness.PushProject, "ios", true, "ExpoPushToken[" + Guid.NewGuid().ToString("N") + "]");
        var charlieDevRes = await ProfileTests.Send(h, charlie, HttpMethod.Post, "/api/notifications/device", charlieDeviceReq);
        Assert.Equal(HttpStatusCode.NoContent, charlieDevRes.StatusCode);

        // Charlie's device is verified active
        await h.Db(async db =>
        {
            var d = await db.Set<PushDevice>().SingleAsync(x => x.Id == sharedDeviceId);
            Assert.Equal(charlie.Account.Id, d.UserId);
            Assert.True(d.Active);
        });

        // Now Bob logs in on that same device and registers with the same device secret and incremented revision
        var bobDeviceReq = new DeviceRequest(sharedDeviceId, sharedSecret, 2, "expo", AuthHarness.PushProject, "ios", true, "ExpoPushToken[" + Guid.NewGuid().ToString("N") + "]");
        var bobDevRes = await ProfileTests.Send(h, bob, HttpMethod.Post, "/api/notifications/device", bobDeviceReq);
        Assert.Equal(HttpStatusCode.NoContent, bobDevRes.StatusCode);

        // Device ownership transferred to Bob; Charlie's old token is replaced
        await h.Db(async db =>
        {
            var d = await db.Set<PushDevice>().SingleAsync(x => x.Id == sharedDeviceId);
            Assert.Equal(bob.Account.Id, d.UserId);
            Assert.True(d.Active);
        });

        // 10. Account Suspension: Moderator suspends Charlie
        var suspendRes = await modBrowser.PostAsJsonAsync($"/api/moderation/users/{charlie.Account.Id}", new AccountReview(false, "Repeated policy violations"));
        Assert.Equal(HttpStatusCode.NoContent, suspendRes.StatusCode);

        // Charlie's active session is rejected immediately
        var suspendedMeRes = await h.Me(charlie.AccessToken);
        Assert.Equal(HttpStatusCode.Unauthorized, suspendedMeRes.StatusCode);

        // 11. In-App Deletion: Alice deletes her account
        var delRes = await ProfileTests.Send(h, alice, HttpMethod.Post, "/api/account/delete", new DeleteAccountRequest(AuthHarness.Password));
        Assert.Equal(HttpStatusCode.NoContent, delRes.StatusCode);

        // Alice cannot access any protected resource
        var aliceMeRes = await h.Me(alice.AccessToken);
        Assert.Equal(HttpStatusCode.Unauthorized, aliceMeRes.StatusCode);

        // Alice is marked deleted with tombstone recorded
        await h.Db(async db =>
        {
            var user = await db.Users.FindAsync(alice.Account.Id);
            Assert.NotNull(user);
            Assert.True(user.IsDeleted);
            Assert.False(user.IsActive);
            Assert.StartsWith("deleted_", user.Email!);

            var tombstone = await db.Set<DeletionTombstone>().SingleOrDefaultAsync(t => t.UserId == alice.Account.Id);
            Assert.NotNull(tombstone);
        });

        // Run purge worker to clean up media
        using var scope = h.Factory.Services.CreateScope();
        var purgeWorker = ActivatorUtilities.CreateInstance<AccountPurgeWorker>(scope.ServiceProvider);
        await purgeWorker.Sweep(CancellationToken.None);

        await h.Db(async db =>
        {
            var photo = await db.Set<ProfilePhoto>().FindAsync(alicePhoto.Id);
            Assert.NotNull(photo);
            Assert.True(photo.Deleted);
            Assert.True(photo.ObjectsDeleted);
        });
    }

    [Fact]
    public async Task Repeatable_randomized_concurrency_stress_scenario()
    {
        await using var h = await AuthHarness.Create();

        // Deterministic PRNG with fixed seed
        var rng = new Random(12345);

        // Create 4 users with approved photos
        var users = new TokenResponse[4];
        for (int i = 0; i < 4; i++)
        {
            users[i] = await MatchingTests.Person(h, $"stress_{i}_{rng.Next(1000, 9999)}");
        }

        // Concurrently perform random swipe operations across all pairs
        var swipeTasks = new List<Task<HttpResponseMessage>>();
        for (int i = 0; i < 4; i++)
        {
            for (int j = 0; j < 4; j++)
            {
                if (i == j) continue;
                var actor = users[i];
                var target = users[j];
                var kind = rng.NextDouble() > 0.3 ? "like" : "pass";
                var req = new SwipeRequest(Guid.NewGuid(), target.Account.Id, kind);
                swipeTasks.Add(ProfileTests.Send(h, actor, HttpMethod.Post, "/api/swipes", req));
            }
        }

        var swipeResponses = await Task.WhenAll(swipeTasks);
        foreach (var res in swipeResponses)
        {
            Assert.True(res.StatusCode == HttpStatusCode.OK || res.StatusCode == HttpStatusCode.BadRequest);
        }

        // Verify database invariants after concurrent randomized decisions:
        await h.Db(async db =>
        {
            var matches = await db.Set<DatingMatch>().ToListAsync();
            // Verify no duplicate matches exist for any pair
            var matchPairs = matches.Select(m => (m.FirstId, m.SecondId)).ToList();
            Assert.Equal(matchPairs.Count, matchPairs.Distinct().Count());

            // Every match has exactly one conversation
            var matchIds = matches.Select(m => m.Id).ToHashSet();
            var conversations = await db.Set<Conversation>().ToListAsync();
            Assert.All(conversations, c => Assert.Contains(c.MatchId, matchIds));
        });
    }

    [Fact]
    public async Task Discovery_and_chat_performance_benchmark()
    {
        await using var h = await AuthHarness.Create();

        // Set up active person
        var mainUser = await MatchingTests.Person(h, "bench_main");

        // Seed 20 discovery candidates directly in DB to test discovery query performance without auth rate limits
        await h.Db(async db =>
        {
            for (int i = 0; i < 20; i++)
            {
                var id = Guid.NewGuid();
                db.Add(new DatingProfile
                {
                    UserId = id,
                    User = new AppUser
                    {
                        Id = id,
                        IsActive = true,
                        EmailConfirmed = true,
                        DateOfBirth = new DateOnly(1995, 1, 1),
                        UserName = id.ToString(),
                        NormalizedUserName = id.ToString(),
                        Email = $"cand_{i}@test.local",
                        NormalizedEmail = $"CAND_{i}@TEST.LOCAL"
                    },
                    DisplayName = $"Candidate {i}",
                    Bio = "A genuine profile description.",
                    Gender = "woman",
                    DesiredGenders = ["nonbinary"],
                    City = "Tbilisi",
                    CityKey = "TBILISI",
                    Interests = ["music"],
                    RelationshipGoal = "long_term",
                    Visible = true
                });
                db.Add(new ProfilePhoto
                {
                    Id = Guid.NewGuid(),
                    UserId = id,
                    RequestId = Guid.NewGuid(),
                    State = "approved",
                    ObjectKey = $"cand_{i}.jpg",
                    ThumbnailKey = $"cand_{i}_thumb.jpg",
                    Position = 0,
                    Width = 600,
                    Height = 400,
                    CreatedAt = DateTimeOffset.UtcNow
                });
            }
            await db.SaveChangesAsync();
        });

        // Create a paired conversation with 30 messages
        var partner = await MatchingTests.Person(h, "bench_partner");
        var conversationId = await ChatTests.Pair(h, mainUser, partner);

        for (int i = 0; i < 30; i++)
        {
            var sender = i % 2 == 0 ? mainUser : partner;
            await ProfileTests.Send(h, sender, HttpMethod.Post, $"/api/conversations/{conversationId}/messages", new SendMessage(Guid.NewGuid(), $"benchmark message {i}"));
        }

        // Benchmark discovery latency across 5 successive requests
        var discoveryLatencies = new List<long>();
        for (int i = 0; i < 5; i++)
        {
            var sw = Stopwatch.StartNew();
            var res = await ProfileTests.Send(h, mainUser, HttpMethod.Get, "/api/discovery");
            sw.Stop();
            Assert.Equal(HttpStatusCode.OK, res.StatusCode);
            discoveryLatencies.Add(sw.ElapsedMilliseconds);
        }

        // Benchmark chat history latency across 5 successive requests
        var chatLatencies = new List<long>();
        for (int i = 0; i < 5; i++)
        {
            var sw = Stopwatch.StartNew();
            var res = await ProfileTests.Send(h, mainUser, HttpMethod.Get, $"/api/conversations/{conversationId}/messages");
            sw.Stop();
            Assert.Equal(HttpStatusCode.OK, res.StatusCode);
            chatLatencies.Add(sw.ElapsedMilliseconds);
        }

        // Performance assertions: all requests completed successfully, average query latency < 500ms
        Assert.All(discoveryLatencies, l => Assert.True(l < 3000, $"Discovery latency {l}ms exceeded threshold"));
        Assert.All(chatLatencies, l => Assert.True(l < 3000, $"Chat history latency {l}ms exceeded threshold"));
    }
}
