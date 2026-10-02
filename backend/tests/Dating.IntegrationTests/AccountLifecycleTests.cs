using System.Net;
using System.Net.Http.Json;
using Dating.Api.Features.AccountLifecycle;
using Dating.Api.Features.Auth;
using Dating.Api.Features.Matching;
using Dating.Api.Features.Moderation;
using Dating.Api.Features.Notifications;
using Dating.Api.Features.Profiles;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace Dating.IntegrationTests;

public class AccountLifecycleTests
{
    [Fact]
    public async Task In_app_deletion_hides_profile_revokes_sessions_deactivates_matches_and_cleans_media_via_worker()
    {
        await using var h = await AuthHarness.Create(enablePush: true);
        var userA = await h.Account("alice.lifecycle@example.test");
        var userB = await h.Account("bob.lifecycle@example.test");

        // Set up profile and photo for User A
        await ProfileTests.Send(h, userA, HttpMethod.Post, "/api/profile", ProfileTests.Input(0));
        var photo = await ProfileTests.Upload(h, userA);

        // Set up match between A and B
        var matchId = Guid.NewGuid();
        var now = DateTimeOffset.UtcNow;
        // Register a push device via API and add a pending delivery
        var devReq = new DeviceRequest(Guid.NewGuid(), Guid.NewGuid().ToString("N") + Guid.NewGuid().ToString("N"), 1, "expo", AuthHarness.PushProject, "ios", true, "ExpoPushToken[" + Guid.NewGuid().ToString("N") + "]");
        var regRes = await ProfileTests.Send(h, userA, HttpMethod.Post, "/api/notifications/device", devReq);
        Assert.Equal(HttpStatusCode.NoContent, regRes.StatusCode);

        var convId = Guid.NewGuid();
        await h.Db(async db =>
        {
            db.Set<DatingMatch>().Add(new DatingMatch
            {
                Id = matchId,
                FirstId = userA.Account.Id,
                SecondId = userB.Account.Id,
                Active = true,
                CreatedAt = now
            });
            db.Set<Conversation>().Add(new Conversation
            {
                Id = convId,
                MatchId = matchId,
                LastSequence = 0
            });
            db.Set<PushDelivery>().Add(new PushDelivery
            {
                Id = Guid.NewGuid(),
                UserId = userA.Account.Id,
                DeviceId = devReq.InstallationId,
                ConversationId = convId,
                Kind = "chat",
                NextAttemptAt = now,
                CreatedAt = now
            });
            await db.SaveChangesAsync();
        });

        // Request in-app deletion with valid password
        var delRes = await ProfileTests.Send(h, userA, HttpMethod.Post, "/api/account/delete", new DeleteAccountRequest(AuthHarness.Password));
        Assert.Equal(HttpStatusCode.NoContent, delRes.StatusCode);

        // Immediate verification: User A session is revoked
        var meRes = await h.Me(userA.AccessToken);
        Assert.Equal(HttpStatusCode.Unauthorized, meRes.StatusCode);

        // Verification in database: user anonymized, profile hidden, match deactivated, push delivery deadlettered
        await h.Db(async db =>
        {
            var u = await db.Users.FindAsync(userA.Account.Id);
            Assert.NotNull(u);
            Assert.False(u.IsActive);
            Assert.True(u.IsDeleted);
            Assert.NotNull(u.DeletedAt);
            Assert.StartsWith("deleted_", u.Email!);
            Assert.StartsWith("DELETED_", u.NormalizedEmail!);
            Assert.Null(u.PasswordHash);

            var p = await db.Set<DatingProfile>().SingleOrDefaultAsync(x => x.UserId == userA.Account.Id);
            Assert.NotNull(p);
            Assert.False(p.Visible);
            Assert.Equal("Deleted Account", p.DisplayName);
            Assert.Empty(p.Bio);

            var m = await db.Set<DatingMatch>().FindAsync(matchId);
            Assert.NotNull(m);
            Assert.False(m.Active);

            var dev = await db.Set<PushDevice>().SingleOrDefaultAsync(d => d.UserId == userA.Account.Id);
            Assert.NotNull(dev);
            Assert.False(dev.Active);
            Assert.Empty(dev.Ciphertext);

            var deliv = await db.Set<PushDelivery>().SingleOrDefaultAsync(d => d.UserId == userA.Account.Id);
            Assert.NotNull(deliv);
            Assert.NotNull(deliv.FinishedAt);
            Assert.NotNull(deliv.DeadLetterAt);

            var tombstone = await db.Set<DeletionTombstone>().SingleOrDefaultAsync(t => t.UserId == userA.Account.Id);
            Assert.NotNull(tombstone);

            var job = await db.Set<AccountDeletionJob>().SingleOrDefaultAsync(j => j.UserId == userA.Account.Id);
            Assert.NotNull(job);
            Assert.Equal("pending", job.State);
        });

        // Run the purge worker manually
        using var scope = h.Factory.Services.CreateScope();
        var purgeWorker = ActivatorUtilities.CreateInstance<AccountPurgeWorker>(scope.ServiceProvider);
        await purgeWorker.Sweep(CancellationToken.None);

        // Verify media objects purged and job marked completed
        await h.Db(async db =>
        {
            var job = await db.Set<AccountDeletionJob>().SingleOrDefaultAsync(j => j.UserId == userA.Account.Id);
            Assert.NotNull(job);
            Assert.Equal("completed", job.State);
            Assert.NotNull(job.CompletedAt);

            var ph = await db.Set<ProfilePhoto>().FindAsync(photo.Id);
            Assert.NotNull(ph);
            Assert.True(ph.Deleted);
            Assert.True(ph.ObjectsDeleted);
            Assert.Empty(ph.ObjectKey);
            Assert.Empty(ph.ThumbnailKey);
        });
    }

    [Fact]
    public async Task Deletion_requires_correct_password_and_rejects_staff_in_app()
    {
        await using var h = await AuthHarness.Create();
        var user = await h.Account("user.wrongpw@example.test");

        // Wrong password returns 401
        var wrongRes = await ProfileTests.Send(h, user, HttpMethod.Post, "/api/account/delete", new DeleteAccountRequest("IncorrectPassword!"));
        Assert.Equal(HttpStatusCode.Unauthorized, wrongRes.StatusCode);

        // Staff user cannot delete in-app (requires operator workflow)
        await h.Db(async db =>
        {
            db.Add(new StaffAccount { UserId = user.Account.Id, Role = "Moderator" });
            await db.SaveChangesAsync();
        });

        var staffRes = await ProfileTests.Send(h, user, HttpMethod.Post, "/api/account/delete", new DeleteAccountRequest(AuthHarness.Password));
        Assert.Equal(HttpStatusCode.Forbidden, staffRes.StatusCode);
    }

    [Fact]
    public async Task Discoverability_pause_toggles_visibility_and_increments_revision()
    {
        await using var h = await AuthHarness.Create();
        var user = await h.Account("pause.test@example.test");
        await ProfileTests.Send(h, user, HttpMethod.Post, "/api/profile", ProfileTests.Input(0));

        // Pause discoverability
        var pauseRes = await ProfileTests.Send(h, user, HttpMethod.Post, "/api/account/discoverability-pause", new DiscoverabilityPauseRequest(true));
        Assert.Equal(HttpStatusCode.NoContent, pauseRes.StatusCode);

        long revisionAfterPause = 0;
        await h.Db(async db =>
        {
            var p = await db.Set<DatingProfile>().SingleAsync(x => x.UserId == user.Account.Id);
            Assert.False(p.Visible);
            revisionAfterPause = p.Revision;
        });

        // Resume discoverability
        var resumeRes = await ProfileTests.Send(h, user, HttpMethod.Post, "/api/account/discoverability-pause", new DiscoverabilityPauseRequest(false));
        Assert.Equal(HttpStatusCode.NoContent, resumeRes.StatusCode);

        await h.Db(async db =>
        {
            var p = await db.Set<DatingProfile>().SingleAsync(x => x.UserId == user.Account.Id);
            Assert.True(p.Visible);
            Assert.True(p.Revision > revisionAfterPause);
        });
    }

    [Fact]
    public async Task Public_deletion_flow_does_not_enumerate_and_confirms_valid_token()
    {
        await using var h = await AuthHarness.Create();
        var user = await h.Account("public.deletion@example.test");

        // Non-existent email returns 202 Accepted without leakage
        var anonRes = await h.Client.PostAsJsonAsync("/api/account/public-deletion-request", new PublicDeletionRequest("nonexistent@example.test"));
        Assert.Equal(HttpStatusCode.Accepted, anonRes.StatusCode);

        // Existing user email returns 202 Accepted
        var existRes = await h.Client.PostAsJsonAsync("/api/account/public-deletion-request", new PublicDeletionRequest("public.deletion@example.test"));
        Assert.Equal(HttpStatusCode.Accepted, existRes.StatusCode);

        // Retrieve deletion token from email queue
        var token = await h.Code("public.deletion@example.test", "deletion");
        Assert.NotEmpty(token);

        // Confirm with bad token returns 400
        var badRes = await h.Client.PostAsJsonAsync("/api/account/confirm-deletion", new ConfirmPublicDeletionRequest("public.deletion@example.test", "invalid_token"));
        Assert.Equal(HttpStatusCode.BadRequest, badRes.StatusCode);

        // Confirm with valid token returns 204
        var goodRes = await h.Client.PostAsJsonAsync("/api/account/confirm-deletion", new ConfirmPublicDeletionRequest("public.deletion@example.test", token));
        Assert.Equal(HttpStatusCode.NoContent, goodRes.StatusCode);

        // Verify account is deleted in database
        await h.Db(async db =>
        {
            var u = await db.Users.FindAsync(user.Account.Id);
            Assert.NotNull(u);
            Assert.True(u.IsDeleted);
            Assert.False(u.IsActive);

            var tombstone = await db.Set<DeletionTombstone>().SingleOrDefaultAsync(t => t.UserId == user.Account.Id);
            Assert.NotNull(tombstone);
        });
    }

    [Fact]
    public async Task Public_deletion_landing_page_serves_html()
    {
        await using var h = await AuthHarness.Create();
        var pageRes = await h.Client.GetAsync("/account/delete");
        Assert.Equal(HttpStatusCode.OK, pageRes.StatusCode);
        Assert.Equal("text/html", pageRes.Content.Headers.ContentType?.MediaType);

        var html = await pageRes.Content.ReadAsStringAsync();
        Assert.Contains("Request Account Deletion", html);
        Assert.Contains("delForm", html);
    }
}
