using System.Net;
using System.Net.Http.Json;
using Dating.Api.Features.Auth;
using Dating.Api.Features.Discovery;
using Dating.Api.Features.Profiles;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using NetTopologySuite.Geometries;
using Xunit;
namespace Dating.IntegrationTests;
public class DiscoveryTests
{
    private static Task<HttpResponseMessage> Send(AuthHarness h, TokenResponse user, HttpMethod method, string path, object? body = null) => ProfileTests.Send(h, user, method, path, body);
    private static async Task<TokenResponse> Viewer(AuthHarness h)
    {
        var user = await h.Account("viewer@example.test");
        await Send(h, user, HttpMethod.Post, "/api/profile", ProfileTests.Input());
        await h.Db(async db => { db.Add(Photo(user.Account.Id)); await db.SaveChangesAsync(); });
        return user;
    }
    private static ProfilePhoto Photo(Guid owner) => new() { Id = Guid.NewGuid(), UserId = owner, RequestId = Guid.NewGuid(),
        ObjectKey = Guid.NewGuid().ToString("N") + ".jpg", ThumbnailKey = Guid.NewGuid().ToString("N") + ".jpg",
        State = "approved", Width = 600, Height = 400, Position = 0, CreatedAt = DateTimeOffset.UtcNow };
    private static async Task<Guid[]> Seed(AuthHarness h, int count, Action<DatingProfile,int>? customize = null)
    {
        var ids = new List<Guid>();
        await h.Db(async db => {
            for (var i = 0; i < count; i++)
            {
                var id = Guid.NewGuid(); ids.Add(id);
                // Explicit DB-only discovery fixtures; these users are never seeded into the application database.
                var p = new DatingProfile { UserId = id, User = new AppUser { Id = id, IsActive = true, EmailConfirmed = true,
                    DateOfBirth = new DateOnly(1990,1,1), UserName = id.ToString(), NormalizedUserName = id.ToString() },
                    DisplayName = "Candidate " + i, Bio = "A complete profile description.", Gender = "woman", DesiredGenders = ["nonbinary"],
                    City = "tbilisi", CityKey = "TBILISI", Interests = ["books"], RelationshipGoal = "long_term", Visible = true };
                customize?.Invoke(p,i); db.Add(p); db.Add(Photo(id));
            }
            await db.SaveChangesAsync();
        });
        return ids.ToArray();
    }
    private static async Task<DiscoveryPage> Page(AuthHarness h, TokenResponse user, string? cursor = null)
    {
        var response = await Send(h, user, HttpMethod.Get, "/api/discovery" + (cursor is null ? "" : "?cursor=" + Uri.EscapeDataString(cursor)));
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        return (await response.Content.ReadFromJsonAsync<DiscoveryPage>())!;
    }
    [Fact]
    public async Task Reciprocal_filters_and_all_exclusions_are_server_enforced_without_private_fields()
    {
        await using var h = await AuthHarness.Create(); var viewer = await Viewer(h);
        var ids = await Seed(h, 15, (p,i) => {
            if (i==1) p.DesiredGenders = ["man"];
            if (i==2) p.Gender = "man";
            if (i==3) p.MinAge = 40;
            if (i==4) p.User.DateOfBirth = new DateOnly(1980,1,1);
            if (i==5) p.Visible = false;
            if (i==6) p.User.IsActive = false;
            if (i==7) p.Bio = "";
        });
        await h.Db(async db => {
            var p = await db.Set<DatingProfile>().SingleAsync(p => p.UserId == viewer.Account.Id);
            p.MinAge = 30; p.MaxAge = 40; p.DesiredGenders = ["woman"];
            (await db.Set<ProfilePhoto>().SingleAsync(p => p.UserId == ids[8])).State = "pending";
            db.Add(new UserBlock { BlockerId = viewer.Account.Id, BlockedId = ids[9] });
            db.Add(new UserBlock { BlockerId = ids[10], BlockedId = viewer.Account.Id });
            db.Add(new DiscoveryDecision { UserId = viewer.Account.Id, TargetId = ids[11], Kind = "pass" });
            db.Add(new UnmatchedPair { FirstId = viewer.Account.Id, SecondId = ids[12] });
            db.Add(new UnmatchedPair { FirstId = ids[13], SecondId = viewer.Account.Id });
            db.Add(new DiscoveryDecision { UserId = ids[14], TargetId = viewer.Account.Id, Kind = "like" });
            await db.SaveChangesAsync();
        });
        var page = await Page(h, viewer);
        Assert.Equivalent(new[] { ids[0], ids[14] }, page.Items.Select(p => p.Id).ToArray()); // An incoming like must not prevent a future mutual decision.
        var raw = System.Text.Json.JsonSerializer.Serialize(page).ToLowerInvariant();
        foreach (var secret in new[] { "dateofbirth", "latitude", "longitude", "objectkey", "email", "password", "isactive", "moderator" }) Assert.DoesNotContain(secret, raw);
        Assert.All(page.Items.SelectMany(c => c.Photos), p => Assert.Equal("approved", p.State));
        await h.Db(async db => { db.Users.Remove(await db.Users.SingleAsync(u => u.Id == ids[0])); await db.SaveChangesAsync(); });
        Assert.Single((await Page(h, viewer)).Items);
    }
    [Fact]
    public async Task Inclusive_age_boundaries_and_manual_city_fallback_are_consistent()
    {
        await using var h = await AuthHarness.Create(); var viewer = await Viewer(h);
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var ids = await Seed(h, 5, (p,i) => {
            p.User.DateOfBirth = i switch { 0 => today.AddYears(-18), 1 => today.AddYears(-18).AddDays(1),
                2 => today.AddYears(-41).AddDays(1), 3 => today.AddYears(-41), _ => today.AddYears(-30) };
            if (i==4) { p.City = "Batumi"; p.CityKey = "BATUMI"; }
        });
        var settings = (await (await Send(h, viewer, HttpMethod.Get, "/api/discovery/settings")).Content.ReadFromJsonAsync<DiscoverySettings>())!;
        var update = new SettingsRequest(settings.Revision,18,40,["woman"],25,"city","  tBiLiSi  ");
        Assert.Equal(HttpStatusCode.OK, (await Send(h, viewer, HttpMethod.Post, "/api/discovery/settings", update)).StatusCode);
        Assert.Equivalent(new[] { ids[0], ids[2] }, (await Page(h, viewer)).Items.Select(p => p.Id).ToArray());
        Assert.Null((await Page(h, viewer)).Items[0].DistanceBucket);
        Assert.Equal(HttpStatusCode.BadRequest, (await Send(h, viewer, HttpMethod.Post, "/api/discovery/settings", update with { Revision = settings.Revision+1, Mode = "distance" })).StatusCode);
    }
    [Fact]
    public async Task Geography_uses_meter_radius_in_both_directions_and_a_GiST_index()
    {
        await using var h = await AuthHarness.Create(); var viewer = await Viewer(h);
        var ids = await Seed(h, 3, (p,_) => { p.LocationMode = "distance"; p.RadiusKm = 25; p.Location = new Point(0,0) { SRID = 4326 }; });
        await h.Db(async db => {
            var p = await db.Set<DatingProfile>().SingleAsync(p => p.UserId == viewer.Account.Id);
            p.LocationMode = "distance"; p.Location = new Point(0,0) { SRID = 4326 }; p.RadiusKm = 25;
            await db.SaveChangesAsync();
            for (var i=0; i<ids.Length; i++) {
                var distance = i==0 ? 24999.0 : i==1 ? 25001.0 : 15000.0;
                await db.Database.ExecuteSqlInterpolatedAsync($"UPDATE \"DatingProfile\" SET \"Location\" = ST_Project(ST_SetSRID(ST_MakePoint(0,0),4326)::geography, {distance}, radians(90)) WHERE \"UserId\" = {ids[i]}");
            }
            // Candidate's own distance preference must also allow the viewer.
            await db.Database.ExecuteSqlInterpolatedAsync($"UPDATE \"DatingProfile\" SET \"RadiusKm\" = 10 WHERE \"UserId\" = {ids[2]}");
            var index = await db.Database.SqlQueryRaw<string>("SELECT indexdef AS \"Value\" FROM pg_indexes WHERE indexname = 'IX_DatingProfile_Location'").SingleAsync();
            Assert.Contains("USING gist", index);
        });
        var page = await Page(h, viewer); Assert.Single(page.Items); Assert.Equal(ids[0], page.Items[0].Id); Assert.Equal("10_25", page.Items[0].DistanceBucket);
    }
    [Fact]
    public async Task Cursor_is_bounded_stable_viewer_bound_and_invalidated_by_preference_changes_with_no_N_plus_one()
    {
        await using var h = await AuthHarness.Create(); var viewer = await Viewer(h); var ids = await Seed(h,25);
        h.ReadCounter.Reset(); var first = await Page(h,viewer);
        Assert.Equal(20,first.Items.Length); Assert.NotNull(first.NextCursor); Assert.InRange(h.ReadCounter.Count,1,5);
        h.ReadCounter.Reset(); var second = await Page(h,viewer,first.NextCursor);
        Assert.Equal(5,second.Items.Length); Assert.Null(second.NextCursor); Assert.InRange(h.ReadCounter.Count,1,5);
        await h.Db(async db => { var ordered = await db.Set<DatingProfile>().Where(p => ids.Contains(p.UserId)).OrderBy(p => p.DiscoverySequence).Select(p => p.UserId).ToArrayAsync(); Assert.Equal(ordered,first.Items.Concat(second.Items).Select(p=>p.Id)); });
        Assert.Equal(HttpStatusCode.BadRequest,(await Send(h,viewer,HttpMethod.Get,"/api/discovery?limit=500")).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest,(await Send(h,viewer,HttpMethod.Get,"/api/discovery?latitude=0")).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest,(await Send(h,viewer,HttpMethod.Get,"/api/discovery?cursor=invalid")).StatusCode);
        var other=await h.Account("other@example.test"); await Send(h,other,HttpMethod.Post,"/api/profile",ProfileTests.Input());
        Assert.Equal(HttpStatusCode.Conflict,(await Send(h,other,HttpMethod.Get,"/api/discovery?cursor="+Uri.EscapeDataString(first.NextCursor!))).StatusCode);
        await h.Db(async db=> { var p=await db.Set<DatingProfile>().SingleAsync(p=>p.UserId==viewer.Account.Id);p.Revision++;await db.SaveChangesAsync();});
        Assert.Equal(HttpStatusCode.Conflict,(await Send(h,viewer,HttpMethod.Get,"/api/discovery?cursor="+Uri.EscapeDataString(first.NextCursor!))).StatusCode);
    }
    [Fact]
    public async Task Stale_cards_and_media_tickets_cannot_bypass_new_blocks_or_hidden_profiles()
    {
        await using var h=await AuthHarness.Create();var viewer=await Viewer(h);var target=await h.Account("target@example.test");
        await Send(h,target,HttpMethod.Post,"/api/profile",ProfileTests.Input() with { Gender="woman" });
        var photo=await ProfileTests.Upload(h,target);
        await h.Db(async db=> { (await db.Set<ProfilePhoto>().SingleAsync(p=>p.Id==photo.Id)).State="approved";await db.SaveChangesAsync();});
        Assert.Single((await Page(h,viewer)).Items);
        var grantResponse=await Send(h,viewer,HttpMethod.Post,$"/api/profile/photos/{photo.Id}/access",new {});
        Assert.Equal(HttpStatusCode.OK,grantResponse.StatusCode);
        var grant=(await grantResponse.Content.ReadFromJsonAsync<MediaGrant>())!;
        await h.Db(async db=> {db.Add(new UserBlock{BlockerId=target.Account.Id,BlockedId=viewer.Account.Id});await db.SaveChangesAsync();});
        Assert.Empty((await Page(h,viewer)).Items);
        Assert.Equal(HttpStatusCode.NotFound,(await Send(h,viewer,HttpMethod.Get,$"/api/discovery/{target.Account.Id}")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound,(await Send(h,viewer,HttpMethod.Get,$"/api/profile/photos/{photo.Id}/content?ticket={Uri.EscapeDataString(grant.Ticket)}")).StatusCode);
        await h.Db(async db=>{await db.Set<UserBlock>().ExecuteDeleteAsync();(await db.Set<DatingProfile>().SingleAsync(p=>p.UserId==target.Account.Id)).Visible=false;await db.SaveChangesAsync();});
        Assert.Equal(HttpStatusCode.NotFound,(await Send(h,viewer,HttpMethod.Post,$"/api/profile/photos/{photo.Id}/access",new {})).StatusCode);
    }
    [Fact]
    public async Task Upgrade_preserves_existing_profiles_and_backfills_safe_city_preferences()
    {
        await using var h = await AuthHarness.Create(); var viewer = await Viewer(h);
        await Seed(h, 2);
        await h.Db(async db => {
            var migrator = db.GetService<IMigrator>();
            await migrator.MigrateAsync("20260930132321_ProfilesAndPrivatePhotos");
            await migrator.MigrateAsync();
            db.ChangeTracker.Clear();
            var profiles = await db.Set<DatingProfile>().ToListAsync();
            Assert.Equal(3, profiles.Count); Assert.Equal(3, profiles.Select(p => p.DiscoverySequence).Distinct().Count());
            Assert.All(profiles, p => { Assert.Equal(18,p.MinAge);Assert.Equal(99,p.MaxAge);Assert.Equal(25,p.RadiusKm);Assert.Equal("city",p.LocationMode);Assert.Equal("TBILISI",p.CityKey);Assert.Null(p.Location); });
            Assert.Equal("Test Person", profiles.Single(p => p.UserId == viewer.Account.Id).DisplayName);
        });
    }
    [Fact]
    public async Task Location_needs_consent_stores_only_coarse_point_and_can_be_removed()
    {
        await using var h=await AuthHarness.Create();var viewer=await Viewer(h);
        Assert.Equal(HttpStatusCode.BadRequest,(await Send(h,viewer,HttpMethod.Post,"/api/discovery/location",new LocationRequest(41.715137,44.827096,false))).StatusCode);
        var saved=await Send(h,viewer,HttpMethod.Post,"/api/discovery/location",new LocationRequest(41.715137,44.827096,true));
        Assert.Equal(HttpStatusCode.OK,saved.StatusCode);
        var json=(await saved.Content.ReadAsStringAsync()).ToLowerInvariant();
        Assert.DoesNotContain("latitude",json);Assert.DoesNotContain("longitude",json);
        await h.Db(async db=>{var p=await db.Set<DatingProfile>().SingleAsync(p=>p.UserId==viewer.Account.Id);Assert.NotNull(p.Location);Assert.NotEqual(41.715137,p.Location.Y);Assert.NotEqual(44.827096,p.Location.X);});
        Assert.Equal(HttpStatusCode.TooManyRequests,(await Send(h,viewer,HttpMethod.Post,"/api/discovery/location",new LocationRequest(0,0,true))).StatusCode);
        Assert.Equal(HttpStatusCode.OK,(await Send(h,viewer,HttpMethod.Delete,"/api/discovery/location")).StatusCode);
        await h.Db(async db=>{var p=await db.Set<DatingProfile>().SingleAsync(p=>p.UserId==viewer.Account.Id);Assert.Null(p.Location);Assert.Equal("city",p.LocationMode);});
    }
}
