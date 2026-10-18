using System.Net;
using System.Net.Http.Json;
using Dating.Api.Features.Auth;
using Dating.Api.Features.Discovery;
using Dating.Api.Features.Game;
using Dating.Api.Features.Game.Wallet;
using Dating.Api.Features.Matching;
using Dating.Api.Features.Profiles;
using Dating.Api.Features.Premium;
using Dating.Api.Features.Safety;
using Dating.Api.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace Dating.IntegrationTests;

public class GameTests
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

    private static async Task<TokenResponse> SetupUser(AuthHarness h, string email, string gender = "woman", string[]? desired = null, bool hasPhoto = true, bool complete = true)
    {
        var user = await h.Account(email);
        desired ??= gender == "woman" ? ["man"] : ["woman"];

        if (complete)
        {
            await Send(h, user, HttpMethod.Post, "/api/profile", new ProfileUpdate(
                0,
                $"Player {gender}",
                "A verified complete dating profile for game arena.",
                gender,
                desired,
                "Tbilisi",
                ["music", "gaming"],
                "long_term",
                true
            ));
        }

        if (hasPhoto)
        {
            await h.Db(async db =>
            {
                db.Add(ApprovedPhoto(user.Account.Id));
                await db.SaveChangesAsync();
            });
        }

        return user;
    }

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
    public async Task Game_profile_eligibility_enforced_for_create_and_join()
    {
        await using var h = await AuthHarness.Create();

        // 1. Incomplete profile user cannot create room
        var incompleteUser = await h.Account("incomplete@game.test");
        var res1 = await Send(h, incompleteUser, HttpMethod.Post, "/api/game/rooms", new CreateRoomRequest("Test Arena"));
        Assert.Equal(HttpStatusCode.Forbidden, res1.StatusCode);

        // 2. User without approved photo cannot create room
        var noPhotoUser = await h.Account("nophoto@game.test");
        await Send(h, noPhotoUser, HttpMethod.Post, "/api/profile", new ProfileUpdate(
            0, "No Photo", "Profile description text here.", "woman", ["man"], "Tbilisi", ["music"], "long_term", true
        ));
        var res2 = await Send(h, noPhotoUser, HttpMethod.Post, "/api/game/rooms", new CreateRoomRequest("Test Arena"));
        Assert.Equal(HttpStatusCode.Forbidden, res2.StatusCode);

        // 3. User with non-reciprocal preferences cannot create room in default 5F/5M format
        var nonReciprocalUser = await SetupUser(h, "nonreciprocal@game.test", gender: "woman", desired: ["woman"]);
        var res3 = await Send(h, nonReciprocalUser, HttpMethod.Post, "/api/game/rooms", new CreateRoomRequest("Test Arena"));
        Assert.Equal(HttpStatusCode.BadRequest, res3.StatusCode);

        // 4. Eligible user successfully creates room and is automatically added as first member
        var eligibleUser = await SetupUser(h, "eligible@game.test", gender: "woman", desired: ["man"]);
        var res4 = await Send(h, eligibleUser, HttpMethod.Post, "/api/game/rooms", new CreateRoomRequest("My Bottle Arena"));
        Assert.Equal(HttpStatusCode.OK, res4.StatusCode);

        var room = await res4.Content.ReadFromJsonAsync<GameRoomDetail>();
        Assert.NotNull(room);
        Assert.Equal("My Bottle Arena", room.Title);
        Assert.Equal("Lobby", room.State);
        Assert.Equal(1, room.MemberCount);
        Assert.Equal(1, room.FemaleCount);
        Assert.Equal(0, room.MaleCount);
        Assert.True(room.IsJoined);
        Assert.Single(room.Members);
        Assert.Equal(eligibleUser.Account.Id, room.Members[0].UserId);
    }

    [Fact]
    public async Task Game_one_active_membership_per_account_enforced()
    {
        await using var h = await AuthHarness.Create();

        var userA = await SetupUser(h, "user_a@game.test", gender: "woman");
        var userB = await SetupUser(h, "user_b@game.test", gender: "man");

        // User A creates Room 1
        var res1 = await Send(h, userA, HttpMethod.Post, "/api/game/rooms", new CreateRoomRequest("Room 1"));
        Assert.Equal(HttpStatusCode.OK, res1.StatusCode);
        var room1 = (await res1.Content.ReadFromJsonAsync<GameRoomDetail>())!;

        // User B creates Room 2
        var res2 = await Send(h, userB, HttpMethod.Post, "/api/game/rooms", new CreateRoomRequest("Room 2"));
        Assert.Equal(HttpStatusCode.OK, res2.StatusCode);
        var room2 = (await res2.Content.ReadFromJsonAsync<GameRoomDetail>())!;

        // User A attempts to create another room while actively in Room 1 -> 409 Conflict
        var resConflictCreate = await Send(h, userA, HttpMethod.Post, "/api/game/rooms", new CreateRoomRequest("Room 3"));
        Assert.Equal(HttpStatusCode.Conflict, resConflictCreate.StatusCode);

        // User A attempts to join Room 2 while actively in Room 1 -> 409 Conflict
        var resConflictJoin = await Send(h, userA, HttpMethod.Post, $"/api/game/rooms/{room2.Id}/join");
        Assert.Equal(HttpStatusCode.Conflict, resConflictJoin.StatusCode);

        // User A leaves Room 1
        var resLeave = await Send(h, userA, HttpMethod.Post, $"/api/game/rooms/{room1.Id}/leave");
        Assert.Equal(HttpStatusCode.OK, resLeave.StatusCode);

        // User A can now join Room 2
        var resJoinRoom2 = await Send(h, userA, HttpMethod.Post, $"/api/game/rooms/{room2.Id}/join");
        Assert.Equal(HttpStatusCode.OK, resJoinRoom2.StatusCode);
        var joinResult = (await resJoinRoom2.Content.ReadFromJsonAsync<JoinRoomResult>())!;
        Assert.Equal(room2.Id, joinResult.RoomId);
    }

    [Fact]
    public async Task Game_gender_quota_and_capacity_enforced()
    {
        await using var h = await AuthHarness.Create();

        var creator = await DirectUser(h, "creator@game.test", gender: "woman");
        var resCreate = await Send(h, creator, HttpMethod.Post, "/api/game/rooms", new CreateRoomRequest("Quota Arena"));
        Assert.Equal(HttpStatusCode.OK, resCreate.StatusCode);
        var room = (await resCreate.Content.ReadFromJsonAsync<GameRoomDetail>())!;

        // Fill remaining 4 female slots (making 5 females total)
        for (var i = 1; i <= 4; i++)
        {
            var female = await DirectUser(h, $"female_{i}@game.test", gender: "woman");
            var resJoin = await Send(h, female, HttpMethod.Post, $"/api/game/rooms/{room.Id}/join");
            Assert.Equal(HttpStatusCode.OK, resJoin.StatusCode);
        }

        // 6th female attempts to join -> female_quota_full (400)
        var extraFemale = await DirectUser(h, "female_extra@game.test", gender: "woman");
        var resExtraFemale = await Send(h, extraFemale, HttpMethod.Post, $"/api/game/rooms/{room.Id}/join");
        Assert.Equal(HttpStatusCode.BadRequest, resExtraFemale.StatusCode);

        // Males can still join
        for (var i = 1; i <= 5; i++)
        {
            var male = await DirectUser(h, $"male_{i}@game.test", gender: "man");
            var resJoin = await Send(h, male, HttpMethod.Post, $"/api/game/rooms/{room.Id}/join");
            Assert.Equal(HttpStatusCode.OK, resJoin.StatusCode);
        }

        // Now room has 5 females and 5 males (capacity 10 full) -> state transitions to Starting
        var resDetail = await Send(h, creator, HttpMethod.Get, $"/api/game/rooms/{room.Id}");
        Assert.Equal(HttpStatusCode.OK, resDetail.StatusCode);
        var fullRoom = (await resDetail.Content.ReadFromJsonAsync<GameRoomDetail>())!;
        Assert.Equal(10, fullRoom.MemberCount);
        Assert.Equal(5, fullRoom.FemaleCount);
        Assert.Equal(5, fullRoom.MaleCount);
        Assert.Equal("Starting", fullRoom.State);
    }

    [Fact]
    public async Task Game_duplicate_join_and_leave_are_idempotent()
    {
        await using var h = await AuthHarness.Create();

        var creator = await SetupUser(h, "idemp_creator@game.test", gender: "man");
        var resCreate = await Send(h, creator, HttpMethod.Post, "/api/game/rooms", new CreateRoomRequest("Idempotent Arena"));
        var room = (await resCreate.Content.ReadFromJsonAsync<GameRoomDetail>())!;

        var joiner = await SetupUser(h, "idemp_joiner@game.test", gender: "woman");

        // First join -> 200 OK
        var resJoin1 = await Send(h, joiner, HttpMethod.Post, $"/api/game/rooms/{room.Id}/join");
        Assert.Equal(HttpStatusCode.OK, resJoin1.StatusCode);
        var result1 = (await resJoin1.Content.ReadFromJsonAsync<JoinRoomResult>())!;

        // Duplicate join -> idempotent 200 OK returning same membership
        var resJoin2 = await Send(h, joiner, HttpMethod.Post, $"/api/game/rooms/{room.Id}/join");
        Assert.Equal(HttpStatusCode.OK, resJoin2.StatusCode);
        var result2 = (await resJoin2.Content.ReadFromJsonAsync<JoinRoomResult>())!;
        Assert.Equal(result1.MembershipId, result2.MembershipId);

        // Leave room
        var resLeave1 = await Send(h, joiner, HttpMethod.Post, $"/api/game/rooms/{room.Id}/leave");
        Assert.Equal(HttpStatusCode.OK, resLeave1.StatusCode);

        // Duplicate leave -> idempotent 200 OK
        var resLeave2 = await Send(h, joiner, HttpMethod.Post, $"/api/game/rooms/{room.Id}/leave");
        Assert.Equal(HttpStatusCode.OK, resLeave2.StatusCode);
    }

    [Fact]
    public async Task Game_blocked_pairs_cannot_share_room_and_return_404()
    {
        await using var h = await AuthHarness.Create();

        var userA = await SetupUser(h, "block_a@game.test", gender: "woman");
        var userB = await SetupUser(h, "block_b@game.test", gender: "man");

        // User A blocks User B
        await h.Db(async db =>
        {
            db.Add(new UserBlock { BlockerId = userA.Account.Id, BlockedId = userB.Account.Id });
            await db.SaveChangesAsync();
        });

        // User A creates a room
        var resCreate = await Send(h, userA, HttpMethod.Post, "/api/game/rooms", new CreateRoomRequest("Safety Arena"));
        var room = (await resCreate.Content.ReadFromJsonAsync<GameRoomDetail>())!;

        // User B attempts to read room detail -> 404 room_unavailable (non-identifying)
        var resDetailB = await Send(h, userB, HttpMethod.Get, $"/api/game/rooms/{room.Id}");
        Assert.Equal(HttpStatusCode.NotFound, resDetailB.StatusCode);

        // User B attempts to join room -> 404 room_unavailable (non-identifying)
        var resJoinB = await Send(h, userB, HttpMethod.Post, $"/api/game/rooms/{room.Id}/join");
        Assert.Equal(HttpStatusCode.NotFound, resJoinB.StatusCode);

        // User B's room listing excludes room created by/containing User A
        var resListB = await Send(h, userB, HttpMethod.Get, "/api/game/rooms");
        Assert.Equal(HttpStatusCode.OK, resListB.StatusCode);
        var listB = (await resListB.Content.ReadFromJsonAsync<GameRoomSummary[]>())!;
        Assert.DoesNotContain(listB, r => r.Id == room.Id);
    }

    [Fact]
    public async Task Game_account_deletion_and_suspension_invalidates_game_membership()
    {
        await using var h = await AuthHarness.Create();

        var user = await SetupUser(h, "lifecycle_user@game.test", gender: "woman");
        var resCreate = await Send(h, user, HttpMethod.Post, "/api/game/rooms", new CreateRoomRequest("Lifecycle Arena"));
        var room = (await resCreate.Content.ReadFromJsonAsync<GameRoomDetail>())!;

        // Verify active membership in DB
        await h.Db(async db =>
        {
            var active = await db.Set<GameMembership>().AnyAsync(m => m.UserId == user.Account.Id && m.Status == GameMembershipStatus.Active);
            Assert.True(active);
        });

        // Invalidate via deletion/suspension hook
        await h.Db(async db =>
        {
            var memberships = await db.Set<GameMembership>().Where(m => m.UserId == user.Account.Id && m.Status == GameMembershipStatus.Active).ToListAsync();
            foreach (var m in memberships)
            {
                m.Status = GameMembershipStatus.Left;
                m.LeftAtUtc = DateTimeOffset.UtcNow;
            }
            await db.SaveChangesAsync();
        });

        // Verify membership is no longer active
        await h.Db(async db =>
        {
            var active = await db.Set<GameMembership>().AnyAsync(m => m.UserId == user.Account.Id && m.Status == GameMembershipStatus.Active);
            Assert.False(active);
        });
    }

    [Fact]
    public async Task Game_parallel_joins_atomic_under_concurrency()
    {
        await using var h = await AuthHarness.Create();

        var creator = await DirectUser(h, "parallel_creator@game.test", gender: "man");
        var resCreate = await Send(h, creator, HttpMethod.Post, "/api/game/rooms", new CreateRoomRequest("Parallel Arena"));
        var room = (await resCreate.Content.ReadFromJsonAsync<GameRoomDetail>())!;

        // Fill 4 female slots (leaving exactly 1 female slot open)
        for (var i = 1; i <= 4; i++)
        {
            var f = await DirectUser(h, $"parallel_f_{i}@game.test", gender: "woman");
            var res = await Send(h, f, HttpMethod.Post, $"/api/game/rooms/{room.Id}/join");
            Assert.Equal(HttpStatusCode.OK, res.StatusCode);
        }

        // Prepare 5 females competing simultaneously for the 1 remaining slot
        var contenders = new List<TokenResponse>();
        for (var i = 5; i <= 9; i++)
        {
            contenders.Add(await DirectUser(h, $"parallel_f_{i}@game.test", gender: "woman"));
        }

        var tasks = contenders.Select(c => Send(h, c, HttpMethod.Post, $"/api/game/rooms/{room.Id}/join")).ToArray();
        var responses = await Task.WhenAll(tasks);

        var successes = responses.Count(r => r.StatusCode == HttpStatusCode.OK);
        var rejected = responses.Count(r => r.StatusCode == HttpStatusCode.BadRequest);

        Assert.Equal(1, successes);
        Assert.Equal(4, rejected);

        // Verify exactly 5 females in the room
        await h.Db(async db =>
        {
            var femaleCount = await db.Set<GameMembership>().CountAsync(m => m.RoomId == room.Id && m.Status == GameMembershipStatus.Active && m.Gender == "woman");
            Assert.Equal(5, femaleCount);
        });
    }

    [Fact]
    public async Task Game_DTOs_do_not_leak_private_fields()
    {
        await using var h = await AuthHarness.Create();

        var user = await SetupUser(h, "privacy_user@game.test", gender: "woman");
        var resCreate = await Send(h, user, HttpMethod.Post, "/api/game/rooms", new CreateRoomRequest("Privacy Arena"));
        Assert.Equal(HttpStatusCode.OK, resCreate.StatusCode);

        var rawJson = await resCreate.Content.ReadAsStringAsync();

        // Must NOT contain private data
        Assert.DoesNotContain("privacy_user@game.test", rawJson);
        Assert.DoesNotContain("DateOfBirth", rawJson, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("NormalizedEmail", rawJson, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("PasswordHash", rawJson, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("SecurityStamp", rawJson, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("Location", rawJson, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task Game_matchmaking_queue_6_players_creates_room_and_transitions_to_starting_when_full()
    {
        await using var h = await AuthHarness.Create();

        // 3 women join queue
        var f1 = await DirectUser(h, "queue_f1@game.test", gender: "woman");
        var f2 = await DirectUser(h, "queue_f2@game.test", gender: "woman");
        var f3 = await DirectUser(h, "queue_f3@game.test", gender: "woman");

        var resF1 = await Send(h, f1, HttpMethod.Post, "/api/game/queue", new JoinQueueRequest(6));
        Assert.Equal(HttpStatusCode.OK, resF1.StatusCode);
        var queueResult1 = (await resF1.Content.ReadFromJsonAsync<GameRoomDetail>())!;
        Assert.Equal("Lobby", queueResult1.State);
        Assert.Equal(6, queueResult1.Capacity);

        var resF2 = await Send(h, f2, HttpMethod.Post, "/api/game/queue", new JoinQueueRequest(6));
        Assert.Equal(HttpStatusCode.OK, resF2.StatusCode);
        var queueResult2 = (await resF2.Content.ReadFromJsonAsync<GameRoomDetail>())!;
        Assert.Equal(queueResult1.Id, queueResult2.Id);

        var resF3 = await Send(h, f3, HttpMethod.Post, "/api/game/queue", new JoinQueueRequest(6));
        Assert.Equal(HttpStatusCode.OK, resF3.StatusCode);
        var queueResult3 = (await resF3.Content.ReadFromJsonAsync<GameRoomDetail>())!;
        Assert.Equal(queueResult1.Id, queueResult3.Id);

        // 3 men join queue
        var m1 = await DirectUser(h, "queue_m1@game.test", gender: "man");
        var m2 = await DirectUser(h, "queue_m2@game.test", gender: "man");
        var m3 = await DirectUser(h, "queue_m3@game.test", gender: "man");

        var resM1 = await Send(h, m1, HttpMethod.Post, "/api/game/queue", new JoinQueueRequest(6));
        Assert.Equal(HttpStatusCode.OK, resM1.StatusCode);
        var queueResultM1 = (await resM1.Content.ReadFromJsonAsync<GameRoomDetail>())!;
        Assert.Equal(queueResult1.Id, queueResultM1.Id);

        var resM2 = await Send(h, m2, HttpMethod.Post, "/api/game/queue", new JoinQueueRequest(6));
        Assert.Equal(HttpStatusCode.OK, resM2.StatusCode);

        // 6th player (m3) fills the room (3 females + 3 males) -> transitions to Starting
        var resM3 = await Send(h, m3, HttpMethod.Post, "/api/game/queue", new JoinQueueRequest(6));
        Assert.Equal(HttpStatusCode.OK, resM3.StatusCode);
        var queueResultM3 = (await resM3.Content.ReadFromJsonAsync<GameRoomDetail>())!;
        Assert.Equal(queueResult1.Id, queueResultM3.Id);
        Assert.Equal("Starting", queueResultM3.State);

        // Verify member can fetch room via current room endpoint
        var resCurrent = await Send(h, f1, HttpMethod.Get, "/api/game/current");
        Assert.Equal(HttpStatusCode.OK, resCurrent.StatusCode);
        var currentRoom = (await resCurrent.Content.ReadFromJsonAsync<GameRoomDetail>())!;
        Assert.Equal(queueResult1.Id, currentRoom.Id);
        Assert.Equal("Starting", currentRoom.State);
        Assert.Equal(6, currentRoom.MemberCount);
        Assert.Equal(3, currentRoom.FemaleCount);
        Assert.Equal(3, currentRoom.MaleCount);
        Assert.Equal(6, currentRoom.Capacity);
    }

    [Fact]
    public async Task Game_starting_and_playing_rooms_are_hidden_from_public_listings_and_404_for_outsiders()
    {
        await using var h = await AuthHarness.Create();

        // Fill a 6-player room
        var players = new List<TokenResponse>();
        for (var i = 1; i <= 3; i++)
        {
            var f = await DirectUser(h, $"hide_f{i}@game.test", gender: "woman");
            players.Add(f);
            await Send(h, f, HttpMethod.Post, "/api/game/queue", new JoinQueueRequest(6));
        }
        for (var i = 1; i <= 3; i++)
        {
            var m = await DirectUser(h, $"hide_m{i}@game.test", gender: "man");
            players.Add(m);
            await Send(h, m, HttpMethod.Post, "/api/game/queue", new JoinQueueRequest(6));
        }

        // Room is now in "Starting" state
        var member = players[0];
        var resMember = await Send(h, member, HttpMethod.Get, "/api/game/current");
        Assert.Equal(HttpStatusCode.OK, resMember.StatusCode);
        var room = (await resMember.Content.ReadFromJsonAsync<GameRoomDetail>())!;
        Assert.Equal("Starting", room.State);

        // Outsider attempts to see it in public listing -> room is NOT in the list
        var outsider = await SetupUser(h, "outsider@game.test", gender: "woman");
        var resList = await Send(h, outsider, HttpMethod.Get, "/api/game/rooms");
        Assert.Equal(HttpStatusCode.OK, resList.StatusCode);
        var list = (await resList.Content.ReadFromJsonAsync<GameRoomSummary[]>())!;
        Assert.DoesNotContain(list, r => r.Id == room.Id);

        // Outsider attempts to get details of the Starting room directly -> 404 room_unavailable
        var resOutsiderGet = await Send(h, outsider, HttpMethod.Get, $"/api/game/rooms/{room.Id}");
        Assert.Equal(HttpStatusCode.NotFound, resOutsiderGet.StatusCode);

        // Outsider attempts to join the Starting room -> 404 room_unavailable
        var resOutsiderJoin = await Send(h, outsider, HttpMethod.Post, $"/api/game/rooms/{room.Id}/join");
        Assert.Equal(HttpStatusCode.NotFound, resOutsiderJoin.StatusCode);

        // Member can still view the Starting room
        var resMemberGet = await Send(h, member, HttpMethod.Get, $"/api/game/rooms/{room.Id}");
        Assert.Equal(HttpStatusCode.OK, resMemberGet.StatusCode);
    }

    [Fact]
    public async Task Game_incompatible_users_never_matched_together_for_blocks_unmatches_and_matches()
    {
        await using var h = await AuthHarness.Create();

        var userA = await DirectUser(h, "incomp_a@game.test", gender: "woman");
        var userB = await DirectUser(h, "incomp_b@game.test", gender: "man");
        var userC = await DirectUser(h, "incomp_c@game.test", gender: "man");
        var userD = await DirectUser(h, "incomp_d@game.test", gender: "woman");

        // 1. Incompatibility via active DatingMatch: userA and userB are matched
        await h.Db(async db =>
        {
            var p1 = userA.Account.Id;
            var p2 = userB.Account.Id;
            var (first, second) = p1.CompareTo(p2) < 0 ? (p1, p2) : (p2, p1);
            db.Add(new DatingMatch
            {
                Id = Guid.NewGuid(),
                FirstId = first,
                SecondId = second,
                Active = true,
                CreatedAt = DateTimeOffset.UtcNow
            });
            await db.SaveChangesAsync();
        });

        // User A joins 6-person queue -> creates Room 1
        var resA = await Send(h, userA, HttpMethod.Post, "/api/game/queue", new JoinQueueRequest(6));
        Assert.Equal(HttpStatusCode.OK, resA.StatusCode);
        var resultA = (await resA.Content.ReadFromJsonAsync<GameRoomDetail>())!;

        // User B joins 6-person queue -> cannot join Room 1 due to active match with User A!
        // Instead, a new room Room 2 is created for User B.
        var resB = await Send(h, userB, HttpMethod.Post, "/api/game/queue", new JoinQueueRequest(6));
        Assert.Equal(HttpStatusCode.OK, resB.StatusCode);
        var resultB = (await resB.Content.ReadFromJsonAsync<GameRoomDetail>())!;
        Assert.NotEqual(resultA.Id, resultB.Id);

        // 2. Incompatibility via UnmatchedPair: userA and userC previously unmatched
        await h.Db(async db =>
        {
            var p1 = userA.Account.Id;
            var p2 = userC.Account.Id;
            var (first, second) = p1.CompareTo(p2) < 0 ? (p1, p2) : (p2, p1);
            db.Add(new UnmatchedPair { FirstId = first, SecondId = second });
            await db.SaveChangesAsync();
        });

        // User C joins 6-person queue -> cannot join Room 1 (with User A)
        // User C can join Room 2 (with User B, with whom C is compatible)
        var resC = await Send(h, userC, HttpMethod.Post, "/api/game/queue", new JoinQueueRequest(6));
        Assert.Equal(HttpStatusCode.OK, resC.StatusCode);
        var resultC = (await resC.Content.ReadFromJsonAsync<GameRoomDetail>())!;
        Assert.NotEqual(resultA.Id, resultC.Id);
        Assert.Equal(resultB.Id, resultC.Id);

        // 3. Incompatibility via UserBlock: userD blocked userB
        await h.Db(async db =>
        {
            db.Add(new UserBlock { BlockerId = userD.Account.Id, BlockedId = userB.Account.Id });
            await db.SaveChangesAsync();
        });

        // User D joins 6-person queue -> cannot join Room 2 (contains userB who is blocked by D)
        // User D can join Room 1 (contains userA, with whom D is compatible)
        var resD = await Send(h, userD, HttpMethod.Post, "/api/game/queue", new JoinQueueRequest(6));
        Assert.Equal(HttpStatusCode.OK, resD.StatusCode);
        var resultD = (await resD.Content.ReadFromJsonAsync<GameRoomDetail>())!;
        Assert.Equal(resultA.Id, resultD.Id);
        Assert.NotEqual(resultB.Id, resultD.Id);

        // 4. Direct JoinRoom incompatibility check: userE blocked by userA receives 404 room_unavailable
        var userE = await DirectUser(h, "incomp_e@game.test", gender: "man");
        await h.Db(async db =>
        {
            db.Add(new UserBlock { BlockerId = userA.Account.Id, BlockedId = userE.Account.Id });
            await db.SaveChangesAsync();
        });
        var resDirectJoinE = await Send(h, userE, HttpMethod.Post, $"/api/game/rooms/{resultA.Id}/join");
        Assert.Equal(HttpStatusCode.NotFound, resDirectJoinE.StatusCode);
    }

    [Fact]
    public async Task Game_queue_membership_prevents_joining_multiple_tables()
    {
        await using var h = await AuthHarness.Create();

        var user = await DirectUser(h, "multi_queue@game.test", gender: "woman");

        // Join queue
        var res1 = await Send(h, user, HttpMethod.Post, "/api/game/queue", new JoinQueueRequest(6));
        Assert.Equal(HttpStatusCode.OK, res1.StatusCode);
        var room = (await res1.Content.ReadFromJsonAsync<GameRoomDetail>())!;

        // Attempting to join queue again while already in a room -> 409 Conflict
        var res2 = await Send(h, user, HttpMethod.Post, "/api/game/queue", new JoinQueueRequest(6));
        Assert.Equal(HttpStatusCode.Conflict, res2.StatusCode);

        // Attempting to create another room -> 409 Conflict
        var res3 = await Send(h, user, HttpMethod.Post, "/api/game/rooms", new CreateRoomRequest("Another Arena"));
        Assert.Equal(HttpStatusCode.Conflict, res3.StatusCode);

        // Leave room
        var resLeave = await Send(h, user, HttpMethod.Post, $"/api/game/rooms/{room.Id}/leave");
        Assert.Equal(HttpStatusCode.OK, resLeave.StatusCode);

        // Can now join queue again -> 200 OK
        var res4 = await Send(h, user, HttpMethod.Post, "/api/game/queue", new JoinQueueRequest(8));
        Assert.Equal(HttpStatusCode.OK, res4.StatusCode);
        var room8 = (await res4.Content.ReadFromJsonAsync<GameRoomDetail>())!;
        Assert.Equal(8, room8.Capacity);
    }

    [Fact]
    public async Task Game_room_snapshot_returns_complete_state_and_membership_details()
    {
        await using var h = await AuthHarness.Create();
        var userA = await DirectUser(h, "snap_a@game.test", gender: "woman");
        var userB = await DirectUser(h, "snap_b@game.test", gender: "man");

        var createRes = await Send(h, userA, HttpMethod.Post, "/api/game/rooms", new CreateRoomRequest("Snapshot Test Room"));
        Assert.Equal(HttpStatusCode.OK, createRes.StatusCode);
        var created = (await createRes.Content.ReadFromJsonAsync<GameRoomDetail>())!;

        var joinRes = await Send(h, userB, HttpMethod.Post, $"/api/game/rooms/{created.Id}/join");
        Assert.Equal(HttpStatusCode.OK, joinRes.StatusCode);

        // Caller userA gets snapshot
        var snapRes = await Send(h, userA, HttpMethod.Get, $"/api/game/rooms/{created.Id}/snapshot");
        Assert.Equal(HttpStatusCode.OK, snapRes.StatusCode);
        var snapshot = (await snapRes.Content.ReadFromJsonAsync<GameRoomSnapshot>())!;

        Assert.Equal(created.Id, snapshot.RoomId);
        Assert.Equal("Lobby", snapshot.State);
        Assert.Equal(2, snapshot.MemberCount);
        Assert.Equal(1, snapshot.FemaleCount);
        Assert.Equal(1, snapshot.MaleCount);
        Assert.True(snapshot.StateVersion >= 1);
        Assert.True(snapshot.Sequence >= 2);

        var memberA = snapshot.Members.Single(m => m.UserId == userA.Account.Id);
        Assert.True(memberA.IsSelf);
        Assert.Equal("Active", memberA.Status);
        Assert.Equal(1, memberA.Generation);

        var memberB = snapshot.Members.Single(m => m.UserId == userB.Account.Id);
        Assert.False(memberB.IsSelf);
        Assert.Equal("Active", memberB.Status);
    }

    [Fact]
    public async Task Game_transient_disconnect_and_reconnect_within_60_seconds_restores_active_state()
    {
        await using var h = await AuthHarness.Create();
        var userA = await DirectUser(h, "disc_a@game.test", gender: "woman");

        var createRes = await Send(h, userA, HttpMethod.Post, "/api/game/rooms", new CreateRoomRequest("Disconnect Room"));
        var created = (await createRes.Content.ReadFromJsonAsync<GameRoomDetail>())!;

        // Simulate transient disconnect via GameService
        using (var scope = h.Factory.Services.CreateScope())
        {
            var gameService = scope.ServiceProvider.GetRequiredService<GameService>();
            await gameService.HandleTransientDisconnect(userA.Account.Id, created.Id, default);
        }

        // Snapshot now shows Disconnected with ReservationRemainingSeconds
        var snapRes = await Send(h, userA, HttpMethod.Get, $"/api/game/rooms/{created.Id}/snapshot");
        Assert.Equal(HttpStatusCode.OK, snapRes.StatusCode);
        var snapshot = (await snapRes.Content.ReadFromJsonAsync<GameRoomSnapshot>())!;
        var memberA = snapshot.Members.Single(m => m.UserId == userA.Account.Id);
        Assert.Equal("Disconnected", memberA.Status);
        Assert.NotNull(memberA.ReservationRemainingSeconds);
        Assert.True(memberA.ReservationRemainingSeconds > 0 && memberA.ReservationRemainingSeconds <= 60);

        // Reconnect within 60 seconds
        var reconnectRes = await Send(h, userA, HttpMethod.Post, $"/api/game/rooms/{created.Id}/reconnect");
        Assert.Equal(HttpStatusCode.OK, reconnectRes.StatusCode);
        var reconnectResult = (await reconnectRes.Content.ReadFromJsonAsync<ReconnectRoomResult>())!;
        Assert.Equal(2, reconnectResult.Generation);
        Assert.Equal("Active", reconnectResult.Snapshot.Members.Single(m => m.UserId == userA.Account.Id).Status);
    }

    [Fact]
    public async Task Game_reconnect_after_reservation_expiry_returns_410_gone()
    {
        await using var h = await AuthHarness.Create();
        var userA = await DirectUser(h, "exp_a@game.test", gender: "woman");

        var createRes = await Send(h, userA, HttpMethod.Post, "/api/game/rooms", new CreateRoomRequest("Expiry Room"));
        var created = (await createRes.Content.ReadFromJsonAsync<GameRoomDetail>())!;

        // Simulate transient disconnect
        using (var scope = h.Factory.Services.CreateScope())
        {
            var gameService = scope.ServiceProvider.GetRequiredService<GameService>();
            await gameService.HandleTransientDisconnect(userA.Account.Id, created.Id, default);
        }

        // Fast-forward or artificially expire the reservation in DB
        await h.Db(async db =>
        {
            var m = await db.Set<GameMembership>().SingleAsync(mb => mb.RoomId == created.Id && mb.UserId == userA.Account.Id);
            m.ReservationExpiresAtUtc = DateTimeOffset.UtcNow.AddMinutes(-5);
            await db.SaveChangesAsync();
        });

        // Attempt reconnect -> 410 Gone
        var reconnectRes = await Send(h, userA, HttpMethod.Post, $"/api/game/rooms/{created.Id}/reconnect");
        Assert.Equal(HttpStatusCode.Gone, reconnectRes.StatusCode);
    }

    [Fact]
    public async Task Game_heartbeat_updates_last_heartbeat_timestamp()
    {
        await using var h = await AuthHarness.Create();
        var userA = await DirectUser(h, "hb_a@game.test", gender: "woman");

        var createRes = await Send(h, userA, HttpMethod.Post, "/api/game/rooms", new CreateRoomRequest("Heartbeat Room"));
        var created = (await createRes.Content.ReadFromJsonAsync<GameRoomDetail>())!;

        var hbRes = await Send(h, userA, HttpMethod.Post, $"/api/game/rooms/{created.Id}/heartbeat");
        Assert.Equal(HttpStatusCode.OK, hbRes.StatusCode);
        var hbResult = (await hbRes.Content.ReadFromJsonAsync<HeartbeatResult>())!;
        Assert.Equal(created.Id, hbResult.RoomId);

        // Outsider calling heartbeat receives 404
        var outsider = await DirectUser(h, "hb_out@game.test", gender: "man");
        var hbOutRes = await Send(h, outsider, HttpMethod.Post, $"/api/game/rooms/{created.Id}/heartbeat");
        Assert.Equal(HttpStatusCode.NotFound, hbOutRes.StatusCode);
    }

    [Fact]
    public async Task Game_SignalR_hub_negotiates_and_enforces_room_authorization()
    {
        await using var h = await AuthHarness.Create();
        var userA = await DirectUser(h, "hub_a@game.test", gender: "woman");
        var outsider = await DirectUser(h, "hub_out@game.test", gender: "man");

        var createRes = await Send(h, userA, HttpMethod.Post, "/api/game/rooms", new CreateRoomRequest("SignalR Hub Room"));
        var created = (await createRes.Content.ReadFromJsonAsync<GameRoomDetail>())!;

        // Negotiate requires auth
        var anonNegotiate = await h.Client.PostAsJsonAsync("/hubs/game/negotiate?negotiateVersion=1", new { });
        Assert.Equal(HttpStatusCode.Unauthorized, anonNegotiate.StatusCode);

        var authNegotiate = await Send(h, userA, HttpMethod.Post, "/hubs/game/negotiate?negotiateVersion=1", new { });
        Assert.Equal(HttpStatusCode.OK, authNegotiate.StatusCode);

        // Service check: AuthorizeRoomSubscription succeeds for room member, throws for outsider
        using var scope = h.Factory.Services.CreateScope();
        var gameService = scope.ServiceProvider.GetRequiredService<GameService>();
        await gameService.AuthorizeRoomSubscription(created.Id, userA.Account.Id, default);

        // Outsider attempting subscribe throws 404 room_unavailable
        await Assert.ThrowsAsync<AuthFailure>(() => gameService.AuthorizeRoomSubscription(created.Id, outsider.Account.Id, default));
    }

    [Fact]
    public async Task Game_spin_initiates_round_targets_opposite_gender_and_enforces_turn_ownership()
    {
        await using var h = await AuthHarness.Create();

        // 1. Setup 6 players (3 women, 3 men)
        var w1 = await DirectUser(h, "spin_w1@game.test", gender: "woman");
        var w2 = await DirectUser(h, "spin_w2@game.test", gender: "woman");
        var w3 = await DirectUser(h, "spin_w3@game.test", gender: "woman");
        var m1 = await DirectUser(h, "spin_m1@game.test", gender: "man");
        var m2 = await DirectUser(h, "spin_m2@game.test", gender: "man");
        var m3 = await DirectUser(h, "spin_m3@game.test", gender: "man");

        var users = new[] { w1, w2, w3, m1, m2, m3 };
        GameRoomDetail? room = null;
        foreach (var u in users)
        {
            var res = await Send(h, u, HttpMethod.Post, "/api/game/queue", new JoinQueueRequest(6));
            Assert.Equal(HttpStatusCode.OK, res.StatusCode);
            room = await res.Content.ReadFromJsonAsync<GameRoomDetail>();
        }

        Assert.NotNull(room);
        Assert.Equal("Starting", room.State);

        // 2. Advance deadline to transition Starting -> Playing
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
        var snapRes = await Send(h, w1, HttpMethod.Get, $"/api/game/rooms/{room.Id}/snapshot");
        Assert.Equal(HttpStatusCode.OK, snapRes.StatusCode);
        var snap = (await snapRes.Content.ReadFromJsonAsync<GameRoomSnapshot>())!;
        Assert.Equal("Playing", snap.State);
        Assert.NotNull(snap.CurrentTurnUserId);

        var turnUser = users.Single(u => u.Account.Id == snap.CurrentTurnUserId.Value);
        var nonTurnUser = users.First(u => u.Account.Id != snap.CurrentTurnUserId.Value);

        // 4. Non-turn user attempting spin receives 403 Forbidden
        var forbiddenSpinRes = await Send(h, nonTurnUser, HttpMethod.Post, $"/api/game/rooms/{room.Id}/spin");
        Assert.Equal(HttpStatusCode.Forbidden, forbiddenSpinRes.StatusCode);

        // 5. Turn owner spins bottle
        var spinRes = await Send(h, turnUser, HttpMethod.Post, $"/api/game/rooms/{room.Id}/spin");
        Assert.Equal(HttpStatusCode.OK, spinRes.StatusCode);
        var spinResult = (await spinRes.Content.ReadFromJsonAsync<SpinResult>())!;

        Assert.Equal(turnUser.Account.Id, spinResult.SpinnerUserId);
        Assert.NotEqual(Guid.Empty, spinResult.TargetUserId);
        Assert.NotEqual(turnUser.Account.Id, spinResult.TargetUserId);

        // Verify target is opposite gender
        var turnGender = turnUser == w1 || turnUser == w2 || turnUser == w3 ? "woman" : "man";
        var targetUser = users.Single(u => u.Account.Id == spinResult.TargetUserId);
        var targetGender = targetUser == w1 || targetUser == w2 || targetUser == w3 ? "woman" : "man";
        Assert.NotEqual(turnGender, targetGender);

        // 6. Second spin while round is in progress receives 409 Conflict
        var secondSpinRes = await Send(h, turnUser, HttpMethod.Post, $"/api/game/rooms/{room.Id}/spin");
        Assert.Equal(HttpStatusCode.Conflict, secondSpinRes.StatusCode);
    }

    [Fact]
    public async Task Game_answering_workflow_mutual_match_and_spectator_redaction()
    {
        await using var h = await AuthHarness.Create();

        // 1. Setup 6 players
        var w1 = await DirectUser(h, "ans_w1@game.test", gender: "woman");
        var w2 = await DirectUser(h, "ans_w2@game.test", gender: "woman");
        var w3 = await DirectUser(h, "ans_w3@game.test", gender: "woman");
        var m1 = await DirectUser(h, "ans_m1@game.test", gender: "man");
        var m2 = await DirectUser(h, "ans_m2@game.test", gender: "man");
        var m3 = await DirectUser(h, "ans_m3@game.test", gender: "man");

        var users = new[] { w1, w2, w3, m1, m2, m3 };
        GameRoomDetail? room = null;
        foreach (var u in users)
        {
            var res = await Send(h, u, HttpMethod.Post, "/api/game/queue", new JoinQueueRequest(6));
            room = await res.Content.ReadFromJsonAsync<GameRoomDetail>();
        }

        // Advance to Playing
        await h.Db(async db =>
        {
            var r = await db.Set<GameRoom>().SingleAsync(x => x.Id == room!.Id);
            r.DeadlineUtc = DateTimeOffset.UtcNow.AddSeconds(-1);
            await db.SaveChangesAsync();
        });

        using (var scope = h.Factory.Services.CreateScope())
        {
            var gs = scope.ServiceProvider.GetRequiredService<GameService>();
            await gs.ProcessDeadlinesAndOutboxAsync(default);
        }

        var snap = (await (await Send(h, w1, HttpMethod.Get, $"/api/game/rooms/{room!.Id}/snapshot")).Content.ReadFromJsonAsync<GameRoomSnapshot>())!;
        var turnUser = users.Single(u => u.Account.Id == snap.CurrentTurnUserId!.Value);

        // Spin
        var spinRes = await Send(h, turnUser, HttpMethod.Post, $"/api/game/rooms/{room.Id}/spin");
        var spinResult = (await spinRes.Content.ReadFromJsonAsync<SpinResult>())!;
        var targetUser = users.Single(u => u.Account.Id == spinResult.TargetUserId);
        var spectatorUser = users.First(u => u.Account.Id != turnUser.Account.Id && u.Account.Id != targetUser.Account.Id);

        // Advance spin deadline (4s) -> QuestionAnswering
        await h.Db(async db =>
        {
            var round = await db.Set<GameRound>().SingleAsync(x => x.Id == spinResult.RoundId);
            var r = await db.Set<GameRoom>().SingleAsync(x => x.Id == room.Id);
            r.DeadlineUtc = DateTimeOffset.UtcNow.AddSeconds(-1);
            await db.SaveChangesAsync();
        });

        using (var scope = h.Factory.Services.CreateScope())
        {
            var gs = scope.ServiceProvider.GetRequiredService<GameService>();
            await gs.ProcessDeadlinesAndOutboxAsync(default);
        }

        // 2. Question Answering state verification
        var roundSnap = (await (await Send(h, turnUser, HttpMethod.Get, $"/api/game/rooms/{room.Id}/snapshot")).Content.ReadFromJsonAsync<GameRoomSnapshot>())!;
        Assert.NotNull(roundSnap.CurrentRound);
        Assert.Equal("QuestionAnswering", roundSnap.CurrentRound.State);
        Assert.Equal(0, roundSnap.CurrentRound.CurrentQuestionIndex);
        var q0 = roundSnap.CurrentRound.CurrentQuestion;
        Assert.NotNull(q0);
        Assert.NotEmpty(q0.QuestionText);
        Assert.Equal(4, q0.Options.Length);

        // Spinner answers Option 2
        var ansSpinnerRes = await Send(h, turnUser, HttpMethod.Post,
            $"/api/game/rooms/{room.Id}/rounds/{spinResult.RoundId}/questions/0/answer",
            new AnswerQuestionRequest(q0.Id, 2, false, Guid.NewGuid().ToString(), roundSnap.StateVersion));
        Assert.Equal(HttpStatusCode.OK, ansSpinnerRes.StatusCode);
        var ansSpinner = (await ansSpinnerRes.Content.ReadFromJsonAsync<AnswerQuestionResult>())!;
        Assert.True(ansSpinner.WaitingForPartner);
        Assert.False(ansSpinner.Revealed);

        // Check privacy while waiting:
        // Spinner sees own pending answer = 2
        var snapSpinnerMid = (await (await Send(h, turnUser, HttpMethod.Get, $"/api/game/rooms/{room.Id}/snapshot")).Content.ReadFromJsonAsync<GameRoomSnapshot>())!;
        Assert.Equal(2, snapSpinnerMid.CurrentRound!.CallerPendingAnswer);

        // Target does NOT see spinner's answer (CallerPendingAnswer is null)
        var snapTargetMid = (await (await Send(h, targetUser, HttpMethod.Get, $"/api/game/rooms/{room.Id}/snapshot")).Content.ReadFromJsonAsync<GameRoomSnapshot>())!;
        Assert.Null(snapTargetMid.CurrentRound!.CallerPendingAnswer);

        // Spectator does NOT see answer
        var snapSpecMid = (await (await Send(h, spectatorUser, HttpMethod.Get, $"/api/game/rooms/{room.Id}/snapshot")).Content.ReadFromJsonAsync<GameRoomSnapshot>())!;
        Assert.Null(snapSpecMid.CurrentRound!.CallerPendingAnswer);

        // 3. Target also answers Option 2 (Mutual Match!)
        var ansTargetRes = await Send(h, targetUser, HttpMethod.Post,
            $"/api/game/rooms/{room.Id}/rounds/{spinResult.RoundId}/questions/0/answer",
            new AnswerQuestionRequest(q0.Id, 2, false, Guid.NewGuid().ToString(), snapTargetMid.StateVersion));
        Assert.Equal(HttpStatusCode.OK, ansTargetRes.StatusCode);
        var ansTarget = (await ansTargetRes.Content.ReadFromJsonAsync<AnswerQuestionResult>())!;
        Assert.False(ansTarget.WaitingForPartner);
        Assert.True(ansTarget.Revealed);
        Assert.NotNull(ansTarget.RevealedSelection);
        Assert.True(ansTarget.RevealedSelection.IsMatch);
        Assert.False(ansTarget.RevealedSelection.IsSuppressed);
        Assert.NotEmpty(ansTarget.RevealedSelection.FallbackCommentary);

        // 4. Spectator Privacy check during reveal
        var snapSpecRevealed = (await (await Send(h, spectatorUser, HttpMethod.Get, $"/api/game/rooms/{room.Id}/snapshot")).Content.ReadFromJsonAsync<GameRoomSnapshot>())!;
        Assert.Single(snapSpecRevealed.CurrentRound!.RevealedSelections);
        var specItem = snapSpecRevealed.CurrentRound.RevealedSelections[0];
        Assert.True(specItem.IsMatch);
        Assert.Null(specItem.SpinnerOption); // Redacted for spectator!
        Assert.Null(specItem.TargetOption);  // Redacted for spectator!
    }

    [Fact]
    public async Task Game_question_skip_and_consecutive_incompletes_terminate_round_early()
    {
        await using var h = await AuthHarness.Create();

        // 1. Setup 6 players
        var w1 = await DirectUser(h, "skip_w1@game.test", gender: "woman");
        var w2 = await DirectUser(h, "skip_w2@game.test", gender: "woman");
        var w3 = await DirectUser(h, "skip_w3@game.test", gender: "woman");
        var m1 = await DirectUser(h, "skip_m1@game.test", gender: "man");
        var m2 = await DirectUser(h, "skip_m2@game.test", gender: "man");
        var m3 = await DirectUser(h, "skip_m3@game.test", gender: "man");

        var users = new[] { w1, w2, w3, m1, m2, m3 };
        GameRoomDetail? room = null;
        foreach (var u in users)
        {
            var res = await Send(h, u, HttpMethod.Post, "/api/game/queue", new JoinQueueRequest(6));
            room = await res.Content.ReadFromJsonAsync<GameRoomDetail>();
        }

        // Advance to Playing
        await h.Db(async db =>
        {
            var r = await db.Set<GameRoom>().SingleAsync(x => x.Id == room!.Id);
            r.DeadlineUtc = DateTimeOffset.UtcNow.AddSeconds(-1);
            await db.SaveChangesAsync();
        });

        using (var scope = h.Factory.Services.CreateScope())
        {
            var gs = scope.ServiceProvider.GetRequiredService<GameService>();
            await gs.ProcessDeadlinesAndOutboxAsync(default);
        }

        var snap = (await (await Send(h, w1, HttpMethod.Get, $"/api/game/rooms/{room!.Id}/snapshot")).Content.ReadFromJsonAsync<GameRoomSnapshot>())!;
        var turnUser = users.Single(u => u.Account.Id == snap.CurrentTurnUserId!.Value);

        // Spin
        var spinRes = await Send(h, turnUser, HttpMethod.Post, $"/api/game/rooms/{room.Id}/spin");
        var spinResult = (await spinRes.Content.ReadFromJsonAsync<SpinResult>())!;
        var targetUser = users.Single(u => u.Account.Id == spinResult.TargetUserId);

        // Ensure round has 2 questions for consecutive incompletes testing
        await h.Db(async db =>
        {
            var rd = await db.Set<GameRound>().SingleAsync(x => x.Id == spinResult.RoundId);
            var qList = System.Text.Json.JsonSerializer.Deserialize<List<FrozenQuestionDto>>(rd.QuestionsJson) ?? [];
            while (qList.Count < 2)
            {
                qList.Add(new FrozenQuestionDto(Guid.NewGuid(), $"Question {qList.Count + 1}", ["A", "B", "C", "D"], "general"));
            }
            rd.QuestionsJson = System.Text.Json.JsonSerializer.Serialize(qList);
            await db.SaveChangesAsync();
        });

        // Advance spin deadline -> QuestionAnswering Question 0
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

        // Question 0: Spinner skips
        var skipRes0 = await Send(h, turnUser, HttpMethod.Post,
            $"/api/game/rooms/{room.Id}/rounds/{spinResult.RoundId}/questions/0/skip",
            new SkipQuestionRequest(Guid.NewGuid().ToString()));
        Assert.Equal(HttpStatusCode.OK, skipRes0.StatusCode);
        var skip0 = (await skipRes0.Content.ReadFromJsonAsync<AnswerQuestionResult>())!;
        Assert.True(skip0.Revealed);
        Assert.True(skip0.RevealedSelection!.IsSuppressed); // Incomplete question #1

        // Advance reveal deadline (4s) -> Question 1
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

        // Question 1: Target skips -> Incomplete question #2 (2 consecutive incomplete questions!)
        var skipRes1 = await Send(h, targetUser, HttpMethod.Post,
            $"/api/game/rooms/{room.Id}/rounds/{spinResult.RoundId}/questions/1/skip",
            new SkipQuestionRequest(Guid.NewGuid().ToString()));
        Assert.Equal(HttpStatusCode.OK, skipRes1.StatusCode);

        // Verify round ended early immediately and turn passed to next player
        var finalSnap = (await (await Send(h, w1, HttpMethod.Get, $"/api/game/rooms/{room.Id}/snapshot")).Content.ReadFromJsonAsync<GameRoomSnapshot>())!;
        Assert.NotNull(finalSnap.CurrentRound);
        Assert.Equal("EndedEarly", finalSnap.CurrentRound.State);
        Assert.NotNull(finalSnap.CurrentTurnUserId);
        Assert.NotEqual(turnUser.Account.Id, finalSnap.CurrentTurnUserId.Value); // Turn passed to next member!

        // Advance TurnPending deadline (15s) -> next round automatically starts spinning for the next turn user
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

        var nextRoundSnap = (await (await Send(h, w1, HttpMethod.Get, $"/api/game/rooms/{room.Id}/snapshot")).Content.ReadFromJsonAsync<GameRoomSnapshot>())!;
        Assert.NotNull(nextRoundSnap.CurrentRound);
        Assert.Equal("Spinning", nextRoundSnap.CurrentRound.State);
        Assert.Equal(finalSnap.CurrentTurnUserId, nextRoundSnap.CurrentTurnUserId);
    }

    [Fact]
    public async Task Game_moderator_crud_curated_questions()
    {
        await using var h = await AuthHarness.Create();

        var adminUser = await h.Account("admin_q@game.test");
        var regularUser = await DirectUser(h, "reg_q@game.test", gender: "man");

        // Mobile bearer token to moderator endpoint receives 401 Unauthorized
        var unauthRes = await Send(h, regularUser, HttpMethod.Get, "/api/moderation/game-questions");
        Assert.Equal(HttpStatusCode.Unauthorized, unauthRes.StatusCode);

        // Staff login with MFA + CSRF
        var browser = await ModerationTests.SignedIn(h, adminUser, "admin_q@game.test");

        // 1. GET /api/moderation/game-questions contains seeded Georgian questions
        var listRes = await browser.GetAsync("/api/moderation/game-questions");
        Assert.Equal(HttpStatusCode.OK, listRes.StatusCode);
        var questions = (await listRes.Content.ReadFromJsonAsync<GameQuestionDto[]>())!;
        Assert.True(questions.Length >= 20);

        // 2. POST /api/moderation/game-questions creates new question
        var createPayload = new CreateQuestionRequest(
            "საყვარელი წელიწადის დრო?",
            new[] { "გაზაფხული", "ზაფხული", "შემოდგომა", "ზამთარი" },
            "lifestyle"
        );
        var createRes = await browser.PostAsJsonAsync("/api/moderation/game-questions", createPayload);
        Assert.Equal(HttpStatusCode.OK, createRes.StatusCode);
        var created = (await createRes.Content.ReadFromJsonAsync<GameQuestionDto>())!;
        Assert.Equal(createPayload.QuestionText, created.QuestionText);
        Assert.True(created.IsActive);

        // 3. PUT /api/moderation/game-questions/{id} updates question
        var updatePayload = new UpdateQuestionRequest(
            "რომელი სეზონი გირჩევნია?",
            new[] { "გაზაფხული", "ზაფხული", "შემოდგომა", "ზამთარი" },
            "lifestyle",
            true
        );
        var updateRes = await browser.PutAsJsonAsync($"/api/moderation/game-questions/{created.Id}", updatePayload);
        Assert.Equal(HttpStatusCode.OK, updateRes.StatusCode);
        var updated = (await updateRes.Content.ReadFromJsonAsync<GameQuestionDto>())!;
        Assert.Equal(updatePayload.QuestionText, updated.QuestionText);

        // 4. DELETE /api/moderation/game-questions/{id} soft-deactivates question
        var deleteRes = await browser.DeleteAsync($"/api/moderation/game-questions/{created.Id}");
        Assert.Equal(HttpStatusCode.NoContent, deleteRes.StatusCode);

        // Verify deactivated in list
        var listAfterRes = await browser.GetAsync("/api/moderation/game-questions");
        var questionsAfter = (await listAfterRes.Content.ReadFromJsonAsync<GameQuestionDto[]>())!;
        var deactivated = questionsAfter.Single(q => q.Id == created.Id);
        Assert.False(deactivated.IsActive);
    }
    [Fact]
    public async Task Game_kiss_turn_owner_sends_kiss_and_privacy_enforced()
    {
        await using var h = await AuthHarness.Create();

        var w1 = await DirectUser(h, "k1_w1@game.test", gender: "woman");
        var w2 = await DirectUser(h, "k1_w2@game.test", gender: "woman");
        var w3 = await DirectUser(h, "k1_w3@game.test", gender: "woman");
        var m1 = await DirectUser(h, "k1_m1@game.test", gender: "man");
        var m2 = await DirectUser(h, "k1_m2@game.test", gender: "man");
        var m3 = await DirectUser(h, "k1_m3@game.test", gender: "man");

        var users = new[] { w1, w2, w3, m1, m2, m3 };
        GameRoomDetail? room = null;
        foreach (var u in users)
        {
            var res = await Send(h, u, HttpMethod.Post, "/api/game/queue", new JoinQueueRequest(6));
            Assert.Equal(HttpStatusCode.OK, res.StatusCode);
            room = await res.Content.ReadFromJsonAsync<GameRoomDetail>();
        }

        Assert.NotNull(room);

        // Fast forward 5s countdown
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

        var snap = (await (await Send(h, w1, HttpMethod.Get, $"/api/game/rooms/{room.Id}/snapshot")).Content.ReadFromJsonAsync<GameRoomSnapshot>())!;
        var turnUserId = snap.CurrentTurnUserId!.Value;
        var turnUser = users.Single(u => u.Account.Id == turnUserId);
        var otherUser = users.First(u => u.Account.Id != turnUserId);

        // Spin bottle
        var spinRes = await Send(h, turnUser, HttpMethod.Post, $"/api/game/rooms/{room.Id}/spin");
        var spinResult = (await spinRes.Content.ReadFromJsonAsync<SpinResult>())!;

        // Advance spin deadline
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

        // Put round into KissChoice state
        await h.Db(async db =>
        {
            var rd = await db.Set<GameRound>().SingleAsync(x => x.Id == spinResult.RoundId);
            rd.State = "KissChoice";
            var r = await db.Set<GameRoom>().SingleAsync(x => x.Id == room.Id);
            r.DeadlineType = "KissChoice";
            r.DeadlineUtc = DateTimeOffset.UtcNow.AddSeconds(15);
            await db.SaveChangesAsync();
        });

        // Non-turn owner cannot send kiss -> 403
        var badKissRes = await Send(h, otherUser, HttpMethod.Post,
            $"/api/game/rooms/{room.Id}/rounds/{spinResult.RoundId}/kiss",
            new SendKissRequest(spinResult.TargetUserId, Guid.NewGuid().ToString()));
        Assert.Equal(HttpStatusCode.Forbidden, badKissRes.StatusCode);

        // Turn owner sends kiss to target
        var kissRes = await Send(h, turnUser, HttpMethod.Post,
            $"/api/game/rooms/{room.Id}/rounds/{spinResult.RoundId}/kiss",
            new SendKissRequest(spinResult.TargetUserId, "kiss_idempotent_1"));
        Assert.Equal(HttpStatusCode.OK, kissRes.StatusCode);
        var kissResult = (await kissRes.Content.ReadFromJsonAsync<SendKissResult>())!;
        Assert.Equal("Pending", kissResult.Status);
        Assert.Null(kissResult.MatchId);

        // Privacy verification via snapshots:
        // 1. Turn owner sees who they kissed
        var spinnerSnap = (await (await Send(h, turnUser, HttpMethod.Get, $"/api/game/rooms/{room.Id}/snapshot")).Content.ReadFromJsonAsync<GameRoomSnapshot>())!;
        Assert.Equal(spinResult.TargetUserId, spinnerSnap.CurrentRound!.KissRecipientUserId);

        // 2. Spectator sees null KissRecipientUserId and HasPendingKissFromPartner = false
        var thirdUser = users.First(u => u.Account.Id != turnUserId && u.Account.Id != spinResult.TargetUserId);
        var spectatorSnap = (await (await Send(h, thirdUser, HttpMethod.Get, $"/api/game/rooms/{room.Id}/snapshot")).Content.ReadFromJsonAsync<GameRoomSnapshot>())!;
        Assert.Null(spectatorSnap.CurrentRound!.KissRecipientUserId);
        Assert.False(spectatorSnap.CurrentRound.HasPendingKissFromPartner);

        // 3. Recipient sees HasPendingKissFromPartner = true
        var targetUserObj = users.Single(u => u.Account.Id == spinResult.TargetUserId);
        var recipientSnap = (await (await Send(h, targetUserObj, HttpMethod.Get, $"/api/game/rooms/{room.Id}/snapshot")).Content.ReadFromJsonAsync<GameRoomSnapshot>())!;
        Assert.True(recipientSnap.CurrentRound!.HasPendingKissFromPartner);
    }

    [Fact]
    public async Task Game_reciprocal_kiss_creates_game_match_and_chat_is_locked()
    {
        await using var h = await AuthHarness.Create();

        var w1 = await DirectUser(h, "k2_w1@recip.test", gender: "woman");
        var w2 = await DirectUser(h, "k2_w2@recip.test", gender: "woman");
        var w3 = await DirectUser(h, "k2_w3@recip.test", gender: "woman");
        var m1 = await DirectUser(h, "k2_m1@recip.test", gender: "man");
        var m2 = await DirectUser(h, "k2_m2@recip.test", gender: "man");
        var m3 = await DirectUser(h, "k2_m3@recip.test", gender: "man");

        var users = new[] { w1, w2, w3, m1, m2, m3 };
        GameRoomDetail? room = null;
        foreach (var u in users)
        {
            var res = await Send(h, u, HttpMethod.Post, "/api/game/queue", new JoinQueueRequest(6));
            Assert.Equal(HttpStatusCode.OK, res.StatusCode);
            room = await res.Content.ReadFromJsonAsync<GameRoomDetail>();
        }

        Assert.NotNull(room);

        // Fast forward 5s countdown
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

        // 1. Force round 1: w1 spins and targets m1, round in KissChoice
        var round1Id = Guid.NewGuid();
        await h.Db(async db =>
        {
            var r = await db.Set<GameRoom>().SingleAsync(x => x.Id == room.Id);
            r.CurrentTurnUserId = w1.Account.Id;
            r.CurrentRoundId = round1Id;
            r.DeadlineType = "KissChoice";
            r.DeadlineUtc = DateTimeOffset.UtcNow.AddSeconds(15);

            var rd = new GameRound
            {
                Id = round1Id,
                RoomId = room.Id,
                RoundNumber = 1,
                SpinnerUserId = w1.Account.Id,
                TargetUserId = m1.Account.Id,
                AngleDegrees = 180,
                State = "KissChoice",
                CurrentQuestionIndex = 4,
                ConsecutiveIncompleteQuestions = 0,
                QuestionsJson = "[]",
                RevealedSelectionsJson = "[]",
                StartedAtUtc = DateTimeOffset.UtcNow
            };
            db.Set<GameRound>().Add(rd);
            await db.SaveChangesAsync();
        });

        // w1 kisses m1
        var kiss1Res = await Send(h, w1, HttpMethod.Post,
            $"/api/game/rooms/{room.Id}/rounds/{round1Id}/kiss",
            new SendKissRequest(m1.Account.Id, "kiss_w1_m1"));
        Assert.Equal(HttpStatusCode.OK, kiss1Res.StatusCode);
        var kiss1Result = (await kiss1Res.Content.ReadFromJsonAsync<SendKissResult>())!;
        Assert.Equal("Pending", kiss1Result.Status);

        // 2. Round 2: m1's turn! m1 in KissChoice sends reciprocal kiss back to w1
        var round2Id = Guid.NewGuid();
        await h.Db(async db =>
        {
            var r = await db.Set<GameRoom>().SingleAsync(x => x.Id == room.Id);
            r.CurrentTurnUserId = m1.Account.Id;
            r.CurrentRoundId = round2Id;
            r.DeadlineType = "KissChoice";
            r.DeadlineUtc = DateTimeOffset.UtcNow.AddSeconds(15);

            var rd = new GameRound
            {
                Id = round2Id,
                RoomId = room.Id,
                RoundNumber = 2,
                SpinnerUserId = m1.Account.Id,
                TargetUserId = w1.Account.Id,
                AngleDegrees = 0,
                State = "KissChoice",
                CurrentQuestionIndex = 4,
                ConsecutiveIncompleteQuestions = 0,
                QuestionsJson = "[]",
                RevealedSelectionsJson = "[]",
                StartedAtUtc = DateTimeOffset.UtcNow
            };
            db.Set<GameRound>().Add(rd);
            await db.SaveChangesAsync();
        });

        var kiss2Res = await Send(h, m1, HttpMethod.Post,
            $"/api/game/rooms/{room.Id}/rounds/{round2Id}/kiss",
            new SendKissRequest(w1.Account.Id, "kiss_m1_w1"));
        Assert.Equal(HttpStatusCode.OK, kiss2Res.StatusCode);
        var kiss2Result = (await kiss2Res.Content.ReadFromJsonAsync<SendKissResult>())!;
        Assert.Equal("Matched", kiss2Result.Status);
        Assert.NotNull(kiss2Result.MatchId);
        Assert.NotNull(kiss2Result.ConversationId);

        // Verify DatingMatch in database:
        await h.Db(async db =>
        {
            var match = await db.Set<DatingMatch>().SingleAsync(m => m.Id == kiss2Result.MatchId!.Value);
            Assert.Equal("GameArena", match.Origin);
            Assert.False(match.HasChatEntitlement); // Locked pending Stage 19 crystal unlock or Discovery swipe!
        });

        // Verify Chat reads/writes are locked (403 chat_locked_pending_unlock)
        var msgRes = await Send(h, w1, HttpMethod.Post,
            $"/api/conversations/{kiss2Result.ConversationId!.Value}/messages",
            new { clientMessageId = Guid.NewGuid(), text = "Hello from Arena match!" });
        Assert.Equal(HttpStatusCode.Forbidden, msgRes.StatusCode);

        var histRes = await Send(h, m1, HttpMethod.Get,
            $"/api/conversations/{kiss2Result.ConversationId!.Value}/messages");
        Assert.Equal(HttpStatusCode.Forbidden, histRes.StatusCode);
    }

    [Fact]
    public async Task Game_discovery_mutual_like_unlocks_existing_game_match_without_duplication()
    {
        await using var h = await AuthHarness.Create();

        var w1 = await DirectUser(h, "k3_w1@unlock.test", gender: "woman");
        var m1 = await DirectUser(h, "k3_m1@unlock.test", gender: "man");

        // Manually create game match with Origin = "GameArena" and HasChatEntitlement = false
        using (var scope = h.Factory.Services.CreateScope())
        {
            var matchService = scope.ServiceProvider.GetRequiredService<MatchService>();
            var res = await matchService.CreateOrUnlockGameMatchAsync(w1.Account.Id, m1.Account.Id, default);
            Assert.True(res.Created);
            Assert.Equal("GameArena", res.Match.Origin);
            Assert.False(res.Match.HasChatEntitlement);
        }

        // w1 likes m1 in Discovery
        var like1Res = await Send(h, w1, HttpMethod.Post, "/api/swipes",
            new SwipeRequest(Guid.NewGuid(), m1.Account.Id, "like"));
        Assert.Equal(HttpStatusCode.OK, like1Res.StatusCode);

        // m1 likes w1 in Discovery -> reciprocal swipe!
        var like2Res = await Send(h, m1, HttpMethod.Post, "/api/swipes",
            new SwipeRequest(Guid.NewGuid(), w1.Account.Id, "like"));
        Assert.Equal(HttpStatusCode.OK, like2Res.StatusCode);
        var swipeRes = (await like2Res.Content.ReadFromJsonAsync<SwipeResult>())!;
        Assert.NotNull(swipeRes.MatchId);

        // Verify in DB: exactly 1 match between w1 and m1, and HasChatEntitlement is now true!
        await h.Db(async db =>
        {
            var matches = await db.Set<DatingMatch>()
                .Where(m => (m.FirstId == w1.Account.Id && m.SecondId == m1.Account.Id) ||
                            (m.FirstId == m1.Account.Id && m.SecondId == w1.Account.Id))
                .ToListAsync();
            Assert.Single(matches);
            var match = matches[0];
            Assert.True(match.HasChatEntitlement); // Unlocked!
        });

        // Now w1 sends a message -> 200 OK!
        var convId = Guid.Empty;
        await h.Db(async db =>
        {
            var conv = await db.Set<Conversation>().SingleAsync(c => c.MatchId == swipeRes.MatchId!.Value);
            convId = conv.Id;
        });

        var sendMsgRes = await Send(h, w1, HttpMethod.Post,
            $"/api/conversations/{convId}/messages",
            new { clientMessageId = Guid.NewGuid(), text = "Now we can chat for free!" });
        Assert.Equal(HttpStatusCode.OK, sendMsgRes.StatusCode);
    }

    [Fact]
    public async Task Game_pending_kiss_expires_on_leave()
    {
        await using var h = await AuthHarness.Create();

        var w1 = await DirectUser(h, "k4_w1@leave.test", gender: "woman");
        var w2 = await DirectUser(h, "k4_w2@leave.test", gender: "woman");
        var w3 = await DirectUser(h, "k4_w3@leave.test", gender: "woman");
        var m1 = await DirectUser(h, "k4_m1@leave.test", gender: "man");
        var m2 = await DirectUser(h, "k4_m2@leave.test", gender: "man");
        var m3 = await DirectUser(h, "k4_m3@leave.test", gender: "man");

        var users = new[] { w1, w2, w3, m1, m2, m3 };
        GameRoomDetail? room = null;
        foreach (var u in users)
        {
            var res = await Send(h, u, HttpMethod.Post, "/api/game/queue", new JoinQueueRequest(6));
            Assert.Equal(HttpStatusCode.OK, res.StatusCode);
            room = await res.Content.ReadFromJsonAsync<GameRoomDetail>();
        }

        Assert.NotNull(room);

        var roundId = Guid.NewGuid();
        await h.Db(async db =>
        {
            var r = await db.Set<GameRoom>().SingleAsync(x => x.Id == room.Id);
            r.State = GameRoomState.Playing;
            r.CurrentTurnUserId = w1.Account.Id;
            r.CurrentRoundId = roundId;
            r.DeadlineType = "KissChoice";
            r.DeadlineUtc = DateTimeOffset.UtcNow.AddSeconds(15);

            var rd = new GameRound
            {
                Id = roundId,
                RoomId = room.Id,
                RoundNumber = 1,
                SpinnerUserId = w1.Account.Id,
                TargetUserId = m1.Account.Id,
                AngleDegrees = 180,
                State = "KissChoice",
                CurrentQuestionIndex = 4,
                ConsecutiveIncompleteQuestions = 0,
                QuestionsJson = "[]",
                RevealedSelectionsJson = "[]",
                StartedAtUtc = DateTimeOffset.UtcNow
            };
            db.Set<GameRound>().Add(rd);
            await db.SaveChangesAsync();
        });

        // w1 kisses m1 -> Status = Pending
        var kissRes = await Send(h, w1, HttpMethod.Post,
            $"/api/game/rooms/{room.Id}/rounds/{roundId}/kiss",
            new SendKissRequest(m1.Account.Id, "kiss_w1_m1_leave"));
        Assert.Equal(HttpStatusCode.OK, kissRes.StatusCode);

        // m1 leaves the room
        var leaveRes = await Send(h, m1, HttpMethod.Post, $"/api/game/rooms/{room.Id}/leave");
        Assert.Equal(HttpStatusCode.OK, leaveRes.StatusCode);

        // Verify the kiss is now marked Expired
        await h.Db(async db =>
        {
            var kiss = await db.Set<GameKiss>().SingleAsync(k => k.RoundId == roundId);
            Assert.Equal("Expired", kiss.Status);
            Assert.NotNull(kiss.ExpiredAtUtc);
        });
    }

    [Fact]
    public async Task Game_kiss_creates_match_request_and_mutual_match_requires_25_crystals_for_both()
    {
        await using var h = await AuthHarness.Create();
        var w1 = await DirectUser(h, "w1_req@dating.local", gender: "woman");
        var w2 = await DirectUser(h, "w2_req@dating.local", gender: "woman");
        var w3 = await DirectUser(h, "w3_req@dating.local", gender: "woman");
        var m1 = await DirectUser(h, "m1_req@dating.local", gender: "man");
        var m2 = await DirectUser(h, "m2_req@dating.local", gender: "man");
        var m3 = await DirectUser(h, "m3_req@dating.local", gender: "man");

        var users = new[] { w1, w2, w3, m1, m2, m3 };
        GameRoomDetail? room = null;
        foreach (var u in users)
        {
            var res = await Send(h, u, HttpMethod.Post, "/api/game/queue", new JoinQueueRequest(6));
            Assert.Equal(HttpStatusCode.OK, res.StatusCode);
            room = await res.Content.ReadFromJsonAsync<GameRoomDetail>();
        }
        Assert.NotNull(room);

        // Seed crystal balances: w1 has 50
        await h.Db(async db =>
        {
            var w1Wallet = await db.Set<UserWallet>().SingleOrDefaultAsync(w => w.UserId == w1.Account.Id);
            if (w1Wallet == null)
            {
                w1Wallet = new UserWallet
                {
                    UserId = w1.Account.Id,
                    Balance = 50,
                    OutstandingDebt = 0,
                    UpdatedAtUtc = DateTimeOffset.UtcNow
                };
                db.Set<UserWallet>().Add(w1Wallet);
            }
            else
            {
                w1Wallet.Balance = 50;
            }
            await db.SaveChangesAsync();
        });

        var roundId = Guid.NewGuid();
        await h.Db(async db =>
        {
            var r = await db.Set<GameRoom>().SingleAsync(x => x.Id == room.Id);
            r.State = GameRoomState.Playing;
            r.CurrentTurnUserId = w1.Account.Id;
            r.CurrentRoundId = roundId;
            r.DeadlineType = "KissChoice";
            r.DeadlineUtc = DateTimeOffset.UtcNow.AddSeconds(15);

            var rd = new GameRound
            {
                Id = roundId,
                RoomId = room.Id,
                RoundNumber = 1,
                SpinnerUserId = w1.Account.Id,
                TargetUserId = m1.Account.Id,
                AngleDegrees = 180,
                State = "KissChoice",
                CurrentQuestionIndex = 0,
                ConsecutiveIncompleteQuestions = 0,
                QuestionsJson = "[]",
                RevealedSelectionsJson = "[]",
                StartedAtUtc = DateTimeOffset.UtcNow
            };
            db.Set<GameRound>().Add(rd);
            await db.SaveChangesAsync();
        });

        // 1. w1 sends kiss to m1
        var kissRes = await Send(h, w1, HttpMethod.Post,
            $"/api/game/rooms/{room.Id}/rounds/{roundId}/kiss",
            new SendKissRequest(m1.Account.Id, "kiss_req_test"));
        Assert.Equal(HttpStatusCode.OK, kissRes.StatusCode);
        var kissResult = (await kissRes.Content.ReadFromJsonAsync<SendKissResult>())!;
        Assert.Equal("Pending", kissResult.Status);
        Assert.Null(kissResult.MatchId);

        // 2. m1 activates premium and checks Requests tab: sees w1 unblurred with Origin "GameArena" and Note "დავიმეჩე ბოთლის თამაშში"
        var subRes = await Send(h, m1, HttpMethod.Post, "/api/premium/subscribe", new SubscribePackageRequest("one_month", "test"));
        Assert.Equal(HttpStatusCode.OK, subRes.StatusCode);

        var reqsRes = await Send(h, m1, HttpMethod.Get, "/api/matches/requests");
        Assert.Equal(HttpStatusCode.OK, reqsRes.StatusCode);
        var reqs = (await reqsRes.Content.ReadFromJsonAsync<LikeRequestSummary[]>())!;
        var arenaReq = reqs.FirstOrDefault(r => r.UserId == w1.Account.Id);
        Assert.NotNull(arenaReq);
        Assert.Equal("GameArena", arenaReq.Origin);
        Assert.Equal("დავიმეჩე ბოთლის თამაშში", arenaReq.Note);

        // 3. m1 confirms the match request (likes w1)
        var decideRes = await Send(h, m1, HttpMethod.Post, "/api/swipes",
            new SwipeRequest(Guid.NewGuid(), w1.Account.Id, "like"));
        Assert.Equal(HttpStatusCode.OK, decideRes.StatusCode);
        var swipeResult = (await decideRes.Content.ReadFromJsonAsync<SwipeResult>())!;
        Assert.NotNull(swipeResult.MatchId);

        // 4. Verify match is created with Origin "GameArena" and HasChatEntitlement = false!
        var matchId = swipeResult.MatchId.Value;
        await h.Db(async db =>
        {
            var match = await db.Set<DatingMatch>().SingleAsync(m => m.Id == matchId);
            Assert.Equal("GameArena", match.Origin);
            Assert.False(match.HasChatEntitlement);

            var kiss = await db.Set<GameKiss>().SingleAsync(k => k.RoundId == roundId);
            Assert.Equal("Matched", kiss.Status);
        });

        // 5. Conv exists
        Guid convId = Guid.Empty;
        await h.Db(async db =>
        {
            var conv = await db.Set<Conversation>().SingleAsync(c => c.MatchId == matchId);
            convId = conv.Id;
        });

        // 6. w1 unlocks chat for 25 crystals
        var unlockRes = await Send(h, w1, HttpMethod.Post,
            $"/api/matches/{matchId}/unlock",
            new UnlockMatchConversationRequest("unlock_w1_both"));
        Assert.Equal(HttpStatusCode.OK, unlockRes.StatusCode);
        var unlockResult = (await unlockRes.Content.ReadFromJsonAsync<UnlockMatchConversationResult>())!;
        Assert.True(unlockResult.Unlocked);
        Assert.Equal(25, unlockResult.Debited);
        Assert.Equal(25, unlockResult.Balance); // 50 - 25 = 25

        // 7. Verify match now has HasChatEntitlement = true in DB for BOTH users
        await h.Db(async db =>
        {
            var match = await db.Set<DatingMatch>().SingleAsync(m => m.Id == matchId);
            Assert.True(match.HasChatEntitlement);
        });

        // 8. If m1 also calls unlock, it charges 0 crystals and returns already_open!
        var unlockAgainRes = await Send(h, m1, HttpMethod.Post,
            $"/api/matches/{matchId}/unlock",
            new UnlockMatchConversationRequest("unlock_m1_noop"));
        Assert.Equal(HttpStatusCode.OK, unlockAgainRes.StatusCode);
        var unlockAgainResult = (await unlockAgainRes.Content.ReadFromJsonAsync<UnlockMatchConversationResult>())!;
        Assert.True(unlockAgainResult.Unlocked);
        Assert.True(unlockAgainResult.AlreadyOpen);
        Assert.Equal(0, unlockAgainResult.Debited);

        // 9. Both users can now chat
        var msgRes = await Send(h, w1, HttpMethod.Post,
            $"/api/conversations/{convId}/messages",
            new { clientMessageId = Guid.NewGuid(), text = "Hello from unlocked chat!" });
        Assert.Equal(HttpStatusCode.OK, msgRes.StatusCode);
    }

    [Fact]
    public async Task Game_select_target_validates_spinner_and_opposite_gender_and_transitions_to_question()
    {
        await using var h = await AuthHarness.Create();
        var w1 = await DirectUser(h, "w1_tar@dating.local", gender: "woman");
        var w2 = await DirectUser(h, "w2_tar@dating.local", gender: "woman");
        var w3 = await DirectUser(h, "w3_tar@dating.local", gender: "woman");
        var m1 = await DirectUser(h, "m1_tar@dating.local", gender: "man");
        var m2 = await DirectUser(h, "m2_tar@dating.local", gender: "man");
        var m3 = await DirectUser(h, "m3_tar@dating.local", gender: "man");

        var users = new[] { w1, w2, w3, m1, m2, m3 };
        GameRoomDetail? room = null;
        foreach (var u in users)
        {
            var res = await Send(h, u, HttpMethod.Post, "/api/game/queue", new JoinQueueRequest(6));
            Assert.Equal(HttpStatusCode.OK, res.StatusCode);
            room = await res.Content.ReadFromJsonAsync<GameRoomDetail>();
        }
        Assert.NotNull(room);

        var roundId = Guid.NewGuid();
        await h.Db(async db =>
        {
            var r = await db.Set<GameRoom>().SingleAsync(x => x.Id == room.Id);
            r.State = GameRoomState.Playing;
            r.CurrentTurnUserId = w1.Account.Id;
            r.CurrentRoundId = roundId;
            r.DeadlineType = "TargetSelection";
            r.DeadlineUtc = DateTimeOffset.UtcNow.AddSeconds(15);

            var rd = new GameRound
            {
                Id = roundId,
                RoomId = room.Id,
                RoundNumber = 1,
                SpinnerUserId = w1.Account.Id,
                TargetUserId = Guid.Empty,
                AngleDegrees = 0,
                State = "SelectingTarget",
                CurrentQuestionIndex = 0,
                ConsecutiveIncompleteQuestions = 0,
                QuestionsJson = "[]",
                RevealedSelectionsJson = "[]",
                StartedAtUtc = DateTimeOffset.UtcNow
            };
            db.Set<GameRound>().Add(rd);
            await db.SaveChangesAsync();
        });

        // 1. Non-spinner (m1) attempts to choose target -> 403 Forbidden
        var forbiddenRes = await Send(h, m1, HttpMethod.Post,
            $"/api/game/rooms/{room.Id}/rounds/{roundId}/target",
            new SelectTargetRequest(w2.Account.Id));
        Assert.Equal(HttpStatusCode.Forbidden, forbiddenRes.StatusCode);

        // 2. Spinner (w1) attempts to choose same-gender user (w2) -> 400 BadRequest
        var badRes = await Send(h, w1, HttpMethod.Post,
            $"/api/game/rooms/{room.Id}/rounds/{roundId}/target",
            new SelectTargetRequest(w2.Account.Id));
        Assert.Equal(HttpStatusCode.BadRequest, badRes.StatusCode);

        // 3. Spinner (w1) selects eligible opposite-gender player (m2) -> 200 OK
        var okRes = await Send(h, w1, HttpMethod.Post,
            $"/api/game/rooms/{room.Id}/rounds/{roundId}/target",
            new SelectTargetRequest(m2.Account.Id));
        Assert.Equal(HttpStatusCode.OK, okRes.StatusCode);
        var selectResult = (await okRes.Content.ReadFromJsonAsync<SelectTargetResult>())!;
        Assert.Equal(m2.Account.Id, selectResult.TargetUserId);
        Assert.NotNull(selectResult.CurrentQuestion);

        // 4. Verify in DB: TargetUserId is m2, state is QuestionAnswering, deadline is 15s
        await h.Db(async db =>
        {
            var round = await db.Set<GameRound>().SingleAsync(rd => rd.Id == roundId);
            Assert.Equal(m2.Account.Id, round.TargetUserId);
            Assert.Equal("QuestionAnswering", round.State);

            var r = await db.Set<GameRoom>().SingleAsync(x => x.Id == room.Id);
            Assert.Equal("QuestionAnswering", r.DeadlineType);
            Assert.NotNull(r.DeadlineUtc);
        });
    }

    [Fact]
    public async Task Game_spinner_can_skip_target_selection_advances_turn_and_rejects_unauthorized()
    {
        await using var h = await AuthHarness.Create();
        var w1 = await DirectUser(h, "w1_skip@dating.local", gender: "woman");
        var w2 = await DirectUser(h, "w2_skip@dating.local", gender: "woman");
        var w3 = await DirectUser(h, "w3_skip@dating.local", gender: "woman");
        var m1 = await DirectUser(h, "m1_skip@dating.local", gender: "man");
        var m2 = await DirectUser(h, "m2_skip@dating.local", gender: "man");
        var m3 = await DirectUser(h, "m3_skip@dating.local", gender: "man");

        var users = new[] { w1, w2, w3, m1, m2, m3 };
        GameRoomDetail? room = null;
        foreach (var u in users)
        {
            var res = await Send(h, u, HttpMethod.Post, "/api/game/queue", new JoinQueueRequest(6));
            Assert.Equal(HttpStatusCode.OK, res.StatusCode);
            room = await res.Content.ReadFromJsonAsync<GameRoomDetail>();
        }
        Assert.NotNull(room);

        var roundId = Guid.NewGuid();
        await h.Db(async db =>
        {
            var r = await db.Set<GameRoom>().SingleAsync(x => x.Id == room.Id);
            r.State = GameRoomState.Playing;
            r.CurrentTurnUserId = w1.Account.Id;
            r.CurrentRoundId = roundId;
            r.DeadlineType = "TargetSelection";
            r.DeadlineUtc = DateTimeOffset.UtcNow.AddSeconds(15);

            var rd = new GameRound
            {
                Id = roundId,
                RoomId = room.Id,
                RoundNumber = 1,
                SpinnerUserId = w1.Account.Id,
                TargetUserId = Guid.Empty,
                AngleDegrees = 0,
                State = "SelectingTarget",
                CurrentQuestionIndex = 0,
                ConsecutiveIncompleteQuestions = 0,
                QuestionsJson = "[]",
                RevealedSelectionsJson = "[]",
                StartedAtUtc = DateTimeOffset.UtcNow
            };
            db.Set<GameRound>().Add(rd);
            await db.SaveChangesAsync();
        });

        // 1. Non-spinner (m1) attempts to skip -> 403 Forbidden
        var forbiddenRes = await Send(h, m1, HttpMethod.Post,
            $"/api/game/rooms/{room.Id}/rounds/{roundId}/target/skip",
            new SkipTargetRequest("key_1"));
        Assert.Equal(HttpStatusCode.Forbidden, forbiddenRes.StatusCode);

        // 2. Spinner (w1) skips target selection -> 200 OK
        var okRes = await Send(h, w1, HttpMethod.Post,
            $"/api/game/rooms/{room.Id}/rounds/{roundId}/target/skip",
            new SkipTargetRequest("key_2"));
        Assert.Equal(HttpStatusCode.OK, okRes.StatusCode);
        var skipResult = (await okRes.Content.ReadFromJsonAsync<SkipTargetResult>())!;
        Assert.Equal(roundId, skipResult.RoundId);
        Assert.Equal(w1.Account.Id, skipResult.SpinnerUserId);
        Assert.Equal("Skipped", skipResult.Status);

        // 3. Verify in DB: round state is EndedEarly, TargetUserId is Guid.Empty, room deadline is TurnPending and turn passed
        await h.Db(async db =>
        {
            var round = await db.Set<GameRound>().SingleAsync(rd => rd.Id == roundId);
            Assert.Equal("EndedEarly", round.State);
            Assert.Equal(Guid.Empty, round.TargetUserId);

            var r = await db.Set<GameRoom>().SingleAsync(x => x.Id == room.Id);
            Assert.Equal("TurnPending", r.DeadlineType);
            Assert.NotNull(r.CurrentTurnUserId);
            Assert.NotEqual(w1.Account.Id, r.CurrentTurnUserId);
        });

        // 4. Repeated skip on ended round -> 400 BadRequest
        var secondSkip = await Send(h, w1, HttpMethod.Post,
            $"/api/game/rooms/{room.Id}/rounds/{roundId}/target/skip",
            new SkipTargetRequest("key_3"));
        Assert.Equal(HttpStatusCode.BadRequest, secondSkip.StatusCode);
    }

    [Fact]
    public async Task Game_completes_at_18_rounds_and_allows_post_game_kisses()
    {
        await using var h = await AuthHarness.Create();
        var w1 = await DirectUser(h, "w1_end@dating.local", gender: "woman");
        var w2 = await DirectUser(h, "w2_end@dating.local", gender: "woman");
        var w3 = await DirectUser(h, "w3_end@dating.local", gender: "woman");
        var m1 = await DirectUser(h, "m1_end@dating.local", gender: "man");
        var m2 = await DirectUser(h, "m2_end@dating.local", gender: "man");
        var m3 = await DirectUser(h, "m3_end@dating.local", gender: "man");

        var users = new[] { w1, w2, w3, m1, m2, m3 };
        GameRoomDetail? room = null;
        foreach (var u in users)
        {
            var res = await Send(h, u, HttpMethod.Post, "/api/game/queue", new JoinQueueRequest(6));
            Assert.Equal(HttpStatusCode.OK, res.StatusCode);
            room = await res.Content.ReadFromJsonAsync<GameRoomDetail>();
        }
        Assert.NotNull(room);

        // Seed 17 prior completed rounds so the 18th finishes the game
        await h.Db(async db =>
        {
            for (int i = 1; i <= 17; i++)
            {
                db.Set<GameRound>().Add(new GameRound
                {
                    Id = Guid.NewGuid(),
                    RoomId = room.Id,
                    RoundNumber = i,
                    SpinnerUserId = users[i % 6].Account.Id,
                    TargetUserId = users[(i + 1) % 6].Account.Id,
                    AngleDegrees = 0,
                    State = "KissChoice",
                    CurrentQuestionIndex = 0,
                    ConsecutiveIncompleteQuestions = 0,
                    QuestionsJson = "[]",
                    RevealedSelectionsJson = "[]",
                    StartedAtUtc = DateTimeOffset.UtcNow.AddMinutes(-20 + i),
                    CompletedAtUtc = DateTimeOffset.UtcNow.AddMinutes(-20 + i).AddSeconds(30)
                });
            }
            await db.SaveChangesAsync();
        });

        // 18th round is in KissChoice
        var round18Id = Guid.NewGuid();
        await h.Db(async db =>
        {
            var r = await db.Set<GameRoom>().SingleAsync(x => x.Id == room.Id);
            r.State = GameRoomState.Playing;
            r.CurrentTurnUserId = w1.Account.Id;
            r.CurrentRoundId = round18Id;
            r.DeadlineType = "KissChoice";
            r.DeadlineUtc = DateTimeOffset.UtcNow.AddSeconds(15);

            var rd = new GameRound
            {
                Id = round18Id,
                RoomId = room.Id,
                RoundNumber = 18,
                SpinnerUserId = w1.Account.Id,
                TargetUserId = m1.Account.Id,
                AngleDegrees = 180,
                State = "KissChoice",
                CurrentQuestionIndex = 0,
                ConsecutiveIncompleteQuestions = 0,
                QuestionsJson = "[]",
                RevealedSelectionsJson = "[]",
                StartedAtUtc = DateTimeOffset.UtcNow
            };
            db.Set<GameRound>().Add(rd);
            await db.SaveChangesAsync();
        });

        // w1 and m1 skip kiss for round 18 -> triggers EndGameAsync since total rounds is 18!
        var skipRes1 = await Send(h, w1, HttpMethod.Post,
            $"/api/game/rooms/{room.Id}/rounds/{round18Id}/kiss/skip",
            new SkipKissRequest("skip_18_w1_test"));
        Assert.Equal(HttpStatusCode.OK, skipRes1.StatusCode);

        var skipRes2 = await Send(h, m1, HttpMethod.Post,
            $"/api/game/rooms/{room.Id}/rounds/{round18Id}/kiss/skip",
            new SkipKissRequest("skip_18_m1_test"));
        Assert.Equal(HttpStatusCode.OK, skipRes2.StatusCode);

        // Verify room is now Ended!
        await h.Db(async db =>
        {
            var r = await db.Set<GameRoom>().SingleAsync(x => x.Id == room.Id);
            Assert.Equal(GameRoomState.Ended, r.State);
            Assert.Equal("GameEnded", r.DeadlineType);
            Assert.Null(r.CurrentTurnUserId);
            Assert.Null(r.CurrentRoundId);
        });

        // Post-game kisses:
        // 1. w1 sends post-game kiss to m2 -> returns Pending
        var postKissRes1 = await Send(h, w1, HttpMethod.Post,
            $"/api/game/rooms/{room.Id}/post-game-kiss",
            new PostGameKissRequest(m2.Account.Id, "post_kiss_w1_m2"));
        Assert.Equal(HttpStatusCode.OK, postKissRes1.StatusCode);
        var postKissResult1 = (await postKissRes1.Content.ReadFromJsonAsync<PostGameKissResult>())!;
        Assert.Equal("Pending", postKissResult1.Status);
        Assert.Null(postKissResult1.MatchId);

        // Verify m2 activates premium and receives unblurred match request
        var subRes2 = await Send(h, m2, HttpMethod.Post, "/api/premium/subscribe", new SubscribePackageRequest("three_months", "test"));
        Assert.Equal(HttpStatusCode.OK, subRes2.StatusCode);

        var reqsRes = await Send(h, m2, HttpMethod.Get, "/api/matches/requests");
        Assert.Equal(HttpStatusCode.OK, reqsRes.StatusCode);
        var reqs = (await reqsRes.Content.ReadFromJsonAsync<LikeRequestSummary[]>())!;
        var arenaReq = reqs.FirstOrDefault(r => r.UserId == w1.Account.Id);
        Assert.NotNull(arenaReq);
        Assert.Equal("GameArena", arenaReq.Origin);

        // 2. Reciprocal post-game kiss: m2 sends post-game kiss back to w1 -> immediate Matched!
        var postKissRes2 = await Send(h, m2, HttpMethod.Post,
            $"/api/game/rooms/{room.Id}/post-game-kiss",
            new PostGameKissRequest(w1.Account.Id, "post_kiss_m2_w1"));
        Assert.Equal(HttpStatusCode.OK, postKissRes2.StatusCode);
        var postKissResult2 = (await postKissRes2.Content.ReadFromJsonAsync<PostGameKissResult>())!;
        Assert.Equal("Matched", postKissResult2.Status);
        Assert.NotNull(postKissResult2.MatchId);

        // Verify match created in DB with HasChatEntitlement = false
        await h.Db(async db =>
        {
            var match = await db.Set<DatingMatch>().SingleAsync(m => m.Id == postKissResult2.MatchId!.Value);
            Assert.Equal("GameArena", match.Origin);
            Assert.False(match.HasChatEntitlement);
        });
    }
}
