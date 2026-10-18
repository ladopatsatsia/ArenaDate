using System.Net;
using System.Net.Http.Json;
using System.Text;
using Dating.Api.Features.Auth;
using Dating.Api.Features.Profiles;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using SkiaSharp;
using Xunit;
namespace Dating.IntegrationTests;
public class ProfileTests
{
    internal static ProfileUpdate Input(long revision = 0) => new(revision, "Test Person", "A genuine profile description.", "nonbinary",
        ["woman", "man", "nonbinary"], "Tbilisi", ["music", "books"], "long_term", true);
    internal static async Task<HttpResponseMessage> Send(AuthHarness h, TokenResponse user, HttpMethod method, string path, object? value = null)
    {
        using var request = new HttpRequestMessage(method, path.StartsWith("/api/moderation/",StringComparison.Ordinal) ? "https://localhost"+path : path);
        request.Headers.Authorization = new("Bearer", user.AccessToken);
        if (value is byte[] bytes) { request.Content = new ByteArrayContent(bytes); request.Content.Headers.ContentType = new("application/octet-stream"); }
        else if (value is not null) request.Content = JsonContent.Create(value);
        return await h.Client.SendAsync(request);
    }
    internal static byte[] Jpeg()
    {
        using var image = new SKBitmap(600, 400); image.Erase(SKColors.Teal);
        using var bitmap = SKImage.FromBitmap(image); using var data = bitmap.Encode(SKEncodedImageFormat.Jpeg, 85); return data.ToArray();
    }
    internal static async Task<PhotoDto> Upload(AuthHarness h, TokenResponse user, Guid? requestId = null)
    {
        var begin = await Send(h, user, HttpMethod.Post, "/api/profile/photos/uploads", new UploadRequest(requestId ?? Guid.NewGuid()));
        Assert.Equal(HttpStatusCode.OK, begin.StatusCode);
        var slot = (await begin.Content.ReadFromJsonAsync<PhotoDto>())!;
        var finalized = await Send(h, user, HttpMethod.Post, $"/api/profile/photos/{slot.Id}/finalize", Jpeg());
        Assert.Equal(HttpStatusCode.OK, finalized.StatusCode);
        return (await finalized.Content.ReadFromJsonAsync<PhotoDto>())!;
    }
    [Fact]
    public async Task Profile_roundtrip_validation_private_contract_and_concurrent_edits()
    {
        await using var h = await AuthHarness.Create(); var user = await h.Account("profile@example.test");
        Assert.Equal(HttpStatusCode.Unauthorized, (await h.Client.GetAsync("/api/profile")).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await Send(h, user, HttpMethod.Post, "/api/profile", Input() with { Gender = "anything" })).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await Send(h, user, HttpMethod.Post, "/api/profile", Input() with { DesiredGenders = ["unknown"] })).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await Send(h, user, HttpMethod.Post, "/api/profile", Input() with { Bio = new string('x', 501) })).StatusCode);
        var saved = await Send(h, user, HttpMethod.Post, "/api/profile", Input());
        Assert.Equal(HttpStatusCode.OK, saved.StatusCode);
        var json = await saved.Content.ReadAsStringAsync();
        Assert.DoesNotContain("dateOfBirth", json); Assert.DoesNotContain("email", json); Assert.DoesNotContain("objectKey", json);
        var profile = (await saved.Content.ReadFromJsonAsync<OwnProfileDto>())!;
        Assert.Equal("Test Person", profile.DisplayName); Assert.Equal(DateTime.UtcNow.Year - 1990, profile.Age); Assert.True(profile.Complete);
        var races = await Task.WhenAll(Enumerable.Range(0, 2).Select(_ => Send(h, user, HttpMethod.Post, "/api/profile", Input(profile.Revision))));
        Assert.Single(races, r => r.StatusCode == HttpStatusCode.OK); Assert.Single(races, r => r.StatusCode == HttpStatusCode.Conflict);
    }
    [Fact]
    public async Task Upload_is_idempotent_owner_only_pending_until_moderation_and_media_is_bounded()
    {
        await using var h = await AuthHarness.Create(); var owner = await h.Account("owner@example.test"); var stranger = await h.Account("stranger@example.test");
        await Send(h, owner, HttpMethod.Post, "/api/profile", Input());
        var requestId = Guid.NewGuid(); var photo = await Upload(h, owner, requestId); Assert.Equal("pending", photo.State);
        Assert.Equal(photo.Id, (await Upload(h, owner, requestId)).Id);
        Assert.Equal(HttpStatusCode.NotFound, (await Send(h, stranger, HttpMethod.Post, $"/api/profile/photos/{photo.Id}/finalize", Jpeg())).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await Send(h, stranger, HttpMethod.Delete, $"/api/profile/photos/{photo.Id}")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await Send(h, stranger, HttpMethod.Post, $"/api/profile/photos/{photo.Id}/access", new {})).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await Send(h, owner, HttpMethod.Post, $"/api/moderation/photos/{photo.Id}", new ModerateRequest("approved"))).StatusCode);
        var pending = (await (await Send(h, owner, HttpMethod.Get, "/api/profile")).Content.ReadFromJsonAsync<OwnProfileDto>())!;
        Assert.True(pending.Complete);
        await h.Db(async db => { var role = new IdentityRole<Guid>("Moderator") { Id = Guid.NewGuid(), NormalizedName = "MODERATOR" }; db.Roles.Add(role);
            db.UserRoles.Add(new IdentityUserRole<Guid> { UserId = stranger.Account.Id, RoleId = role.Id }); await db.SaveChangesAsync(); });
        Assert.Equal(HttpStatusCode.Unauthorized, (await Send(h, stranger, HttpMethod.Post, $"/api/moderation/photos/{photo.Id}", new ModerateRequest("approved"))).StatusCode);
        using var admin = await ModerationTests.SignedIn(h, stranger, "stranger@example.test");
        Assert.Equal(HttpStatusCode.NoContent, (await admin.PostAsJsonAsync($"/api/moderation/photos/{photo.Id}", new Dating.Api.Features.Moderation.ReviewRequest("approved", "Suitable profile photo"))).StatusCode);
        var profile = (await (await Send(h, owner, HttpMethod.Get, "/api/profile")).Content.ReadFromJsonAsync<OwnProfileDto>())!; Assert.True(profile.Complete);
        var grant = (await (await Send(h, owner, HttpMethod.Post, $"/api/profile/photos/{photo.Id}/access", new {})).Content.ReadFromJsonAsync<MediaGrant>())!;
        Assert.InRange((grant.ExpiresAt - DateTimeOffset.UtcNow).TotalSeconds, 0, 120);
        var path = $"/api/profile/photos/{photo.Id}/content?ticket={Uri.EscapeDataString(grant.Ticket)}&thumbnail=true";
        var image = await Send(h, owner, HttpMethod.Get, path); Assert.Equal(HttpStatusCode.OK, image.StatusCode);
        Assert.Equal("image/jpeg", image.Content.Headers.ContentType!.MediaType); Assert.True(image.Headers.CacheControl!.NoStore);
        Assert.Equal(HttpStatusCode.NotFound, (await Send(h, stranger, HttpMethod.Get, path)).StatusCode); // Viewer-bound, even for moderator.
        Assert.Equal(HttpStatusCode.NotFound, (await Send(h, owner, HttpMethod.Get, path.Replace(grant.Ticket, "tampered"))).StatusCode);
        await Send(h, owner, HttpMethod.Delete, $"/api/profile/photos/{photo.Id}");
        Assert.Equal(HttpStatusCode.NotFound, (await Send(h, owner, HttpMethod.Get, path)).StatusCode);
    }
    [Fact]
    public async Task Reorder_races_primary_deletion_and_orphan_cleanup_keep_consistent_order()
    {
        await using var h = await AuthHarness.Create(); var owner = await h.Account("order@example.test");
        var first = await Upload(h, owner); var second = await Upload(h, owner); var third = await Upload(h, owner);
        var profile = (await (await Send(h, owner, HttpMethod.Get, "/api/profile")).Content.ReadFromJsonAsync<OwnProfileDto>())!;
        var request = new ReorderRequest(profile.Revision, [third.Id, first.Id, second.Id]);
        var races = await Task.WhenAll(Enumerable.Range(0, 2).Select(_ => Send(h, owner, HttpMethod.Post, "/api/profile/photos/reorder", request)));
        Assert.Single(races, r => r.StatusCode == HttpStatusCode.OK); Assert.Single(races, r => r.StatusCode == HttpStatusCode.Conflict);
        await Send(h, owner, HttpMethod.Delete, $"/api/profile/photos/{third.Id}");
        profile = (await (await Send(h, owner, HttpMethod.Get, "/api/profile")).Content.ReadFromJsonAsync<OwnProfileDto>())!;
        Assert.Equal(new[] { first.Id, second.Id }, profile.Photos.Select(p => p.Id)); Assert.Equal(new[] { 0, 1 }, profile.Photos.Select(p => p.Position));
        var invalid = new ReorderRequest(profile.Revision, [first.Id, first.Id]);
        Assert.Equal(HttpStatusCode.BadRequest, (await Send(h, owner, HttpMethod.Post, "/api/profile/photos/reorder", invalid)).StatusCode);
        var expiredResponse = await Send(h, owner, HttpMethod.Post, "/api/profile/photos/uploads", new UploadRequest(Guid.NewGuid()));
        var expired = (await expiredResponse.Content.ReadFromJsonAsync<PhotoDto>())!;
        await h.Db(async db => { var p = await db.Set<ProfilePhoto>().SingleAsync(p => p.Id == expired.Id); p.CreatedAt = DateTimeOffset.UtcNow.AddHours(-2); await db.SaveChangesAsync(); });
        var worker = new MediaCleanup(h.Factory.Services.GetRequiredService<IServiceScopeFactory>(), TimeProvider.System, NullLogger<MediaCleanup>.Instance);
        await worker.Sweep(CancellationToken.None);
        await h.Db(async db => { var removed = await db.Set<ProfilePhoto>().Where(p => p.Id == third.Id || p.Id == expired.Id).ToListAsync(); Assert.All(removed, p => Assert.True(p.Deleted && p.ObjectsDeleted)); });
        Assert.Equal(HttpStatusCode.NotFound, (await Send(h, owner, HttpMethod.Post, $"/api/profile/photos/{expired.Id}/finalize", Jpeg())).StatusCode);
    }
    [Fact]
    public async Task Malformed_remote_URL_and_oversized_uploads_fail_and_slots_are_bounded()
    {
        await using var h = await AuthHarness.Create(); var user = await h.Account("invalidphoto@example.test");
        var slotResponse = await Send(h, user, HttpMethod.Post, "/api/profile/photos/uploads", new UploadRequest(Guid.NewGuid()));
        var slot = (await slotResponse.Content.ReadFromJsonAsync<PhotoDto>())!;
        foreach (var bytes in new[] { Encoding.UTF8.GetBytes("https://internal.invalid/private"), new byte[PhotoProcessor.MaxBytes + 1], new byte[] { 0xff, 0xd8, 0xff } })
            Assert.Equal(HttpStatusCode.BadRequest, (await Send(h, user, HttpMethod.Post, $"/api/profile/photos/{slot.Id}/finalize", bytes)).StatusCode);
        for (var i = 0; i < 5; i++) Assert.Equal(HttpStatusCode.OK, (await Send(h, user, HttpMethod.Post, "/api/profile/photos/uploads", new UploadRequest(Guid.NewGuid()))).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await Send(h, user, HttpMethod.Post, "/api/profile/photos/uploads", new UploadRequest(Guid.NewGuid()))).StatusCode);
    }

    [Fact]
    public async Task Game_room_active_members_and_unlocks_authorize_photo_access()
    {
        await using var h = await AuthHarness.Create();
        var owner = await h.Account("owner_game@example.test");
        var stranger = await h.Account("stranger_game@example.test");
        var nonMember = await h.Account("nonmember_game@example.test");

        await Send(h, owner, HttpMethod.Post, "/api/profile", Input());
        await Send(h, stranger, HttpMethod.Post, "/api/profile", Input());
        await Send(h, nonMember, HttpMethod.Post, "/api/profile", Input());

        var photo = await Upload(h, owner);
        await h.Db(async db =>
        {
            var p = await db.Set<ProfilePhoto>().SingleAsync(p => p.Id == photo.Id);
            p.State = "approved";
            await db.SaveChangesAsync();
        });

        // Initially stranger is not authorized (404)
        var unauth = await Send(h, stranger, HttpMethod.Post, $"/api/profile/photos/{photo.Id}/access", new { });
        Assert.Equal(HttpStatusCode.NotFound, unauth.StatusCode);

        // Put owner and stranger into same GameRoom as Active members
        var roomId = Guid.NewGuid();
        await h.Db(async db =>
        {
            var room = new Dating.Api.Features.Game.GameRoom
            {
                Id = roomId,
                Title = "Test Room",
                CreatedByUserId = owner.Account.Id,
                State = Dating.Api.Features.Game.GameRoomState.Playing,
                Capacity = 6,
                MaleQuota = 3,
                FemaleQuota = 3,
                MinActivePlayers = 2,
                MinMaleStart = 1,
                MinFemaleStart = 1,
                DisconnectPauseBudgetMs = 60000,
                LobbyTimeoutSeconds = 60,
                CreatedAtUtc = DateTime.UtcNow
            };
            db.Add(room);

            db.Add(new Dating.Api.Features.Game.GameMembership
            {
                Id = Guid.NewGuid(),
                RoomId = roomId,
                UserId = owner.Account.Id,
                Gender = "woman",
                Status = Dating.Api.Features.Game.GameMembershipStatus.Active,
                JoinedAtUtc = DateTime.UtcNow,
                LastHeartbeatUtc = DateTime.UtcNow
            });

            db.Add(new Dating.Api.Features.Game.GameMembership
            {
                Id = Guid.NewGuid(),
                RoomId = roomId,
                UserId = stranger.Account.Id,
                Gender = "man",
                Status = Dating.Api.Features.Game.GameMembershipStatus.Active,
                JoinedAtUtc = DateTime.UtcNow,
                LastHeartbeatUtc = DateTime.UtcNow
            });

            await db.SaveChangesAsync();
        });

        // Now stranger CAN access photo
        var authRes = await Send(h, stranger, HttpMethod.Post, $"/api/profile/photos/{photo.Id}/access", new { });
        Assert.Equal(HttpStatusCode.OK, authRes.StatusCode);
        var grant = await authRes.Content.ReadFromJsonAsync<MediaGrant>();
        Assert.NotNull(grant?.Ticket);

        // Non-member still CANNOT access photo (404)
        var nonMemberRes = await Send(h, nonMember, HttpMethod.Post, $"/api/profile/photos/{photo.Id}/access", new { });
        Assert.Equal(HttpStatusCode.NotFound, nonMemberRes.StatusCode);
    }
}

