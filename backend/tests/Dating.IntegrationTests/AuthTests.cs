using System.IdentityModel.Tokens.Jwt;
using System.Net;
using System.Net.Http.Json;
using System.Security.Claims;
using System.Security.Cryptography;
using Dating.Api.Features.Auth;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Xunit;

namespace Dating.IntegrationTests;
public class AuthTests
{
    [Fact]
    public async Task Registration_verification_normalization_and_private_contract()
    {
        await using var h = await AuthHarness.Create();
        Assert.Equal(HttpStatusCode.Unauthorized, (await h.Client.GetAsync("/api/auth/me")).StatusCode);
        var request = new RegisterRequest("a@example.test", AuthHarness.Password, new(1990, 1, 1));
        var first = await h.Client.PostAsJsonAsync("/api/auth/register", request);
        var duplicate = await h.Client.PostAsJsonAsync("/api/auth/register", request with { Email = "A@example.test" });
        Assert.Equal(HttpStatusCode.Accepted, first.StatusCode);
        Assert.Equal(await first.Content.ReadAsStringAsync(), await duplicate.Content.ReadAsStringAsync());
        Assert.Equal(HttpStatusCode.Unauthorized, (await h.Client.PostAsJsonAsync("/api/auth/login", new LoginRequest(request.Email, request.Password))).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await h.Client.PostAsJsonAsync("/api/auth/verify", new VerifyRequest(request.Email, "wrong"))).StatusCode);
        Assert.Equal(HttpStatusCode.NoContent, (await h.Client.PostAsJsonAsync("/api/auth/verify", new VerifyRequest(request.Email, await h.Code(request.Email, "verify")))).StatusCode);
        var pair = await h.Login("A@example.test");
        var me = await h.Me(pair.AccessToken);
        Assert.Equal(HttpStatusCode.OK, me.StatusCode);
        var json = await me.Content.ReadAsStringAsync();
        Assert.DoesNotContain("birth", json, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("email", json, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("hash", json, StringComparison.OrdinalIgnoreCase);
        await h.Db(async db =>
        {
            var user = await db.Users.SingleAsync();
            Assert.NotEqual(request.Password, user.PasswordHash);
            Assert.True(user.EmailConfirmed);
            var token = await db.RefreshCredentials.SingleAsync();
            Assert.Equal(JwtTokens.Hash(pair.RefreshToken), token.Hash);
            Assert.NotEqual(pair.RefreshToken, token.Hash);
        });
        var known = await h.Client.PostAsJsonAsync("/api/auth/forgot-password", new EmailRequest(request.Email));
        var unknown = await h.Client.PostAsJsonAsync("/api/auth/forgot-password", new EmailRequest("missing@example.test"));
        Assert.Equal(known.StatusCode, unknown.StatusCode);
        Assert.Equal(await known.Content.ReadAsStringAsync(), await unknown.Content.ReadAsStringAsync());
        Assert.Equal(HttpStatusCode.BadRequest, (await h.Client.PostAsJsonAsync("/api/auth/register",
            request with { Email = "minor@example.test", DateOfBirth = DateOnly.FromDateTime(DateTime.UtcNow).AddYears(-18).AddDays(1) })).StatusCode);
    }

    [Fact]
    public async Task Parallel_registration_has_one_account_and_one_verification_email()
    {
        await using var h = await AuthHarness.Create();
        var results = await Task.WhenAll(Enumerable.Range(0, 4).Select(_ => h.Client.PostAsJsonAsync("/api/auth/register",
            new RegisterRequest("race@example.test", AuthHarness.Password, new(1990, 1, 1)))));
        Assert.All(results, r => Assert.Equal(HttpStatusCode.Accepted, r.StatusCode));
        await h.Db(async db => { Assert.Equal(1, await db.Users.CountAsync()); Assert.Equal(1, await db.AuthEmails.CountAsync()); });
    }

    [Fact]
    public async Task Refresh_is_single_rotation_for_retries_and_later_replay_revokes_family()
    {
        await using var h = await AuthHarness.Create();
        var original = await h.Account("refresh@example.test");
        var request = new RefreshRequest(original.RefreshToken, Guid.NewGuid());
        var responses = await Task.WhenAll(Enumerable.Range(0, 4).Select(_ => h.Client.PostAsJsonAsync("/api/auth/refresh", request)));
        Assert.All(responses, r => Assert.Equal(HttpStatusCode.OK, r.StatusCode));
        var bodies = await Task.WhenAll(responses.Select(r => r.Content.ReadFromJsonAsync<TokenResponse>()));
        Assert.All(bodies, b => Assert.Equal(bodies[0], b));
        var rotated = bodies[0]!;
        Assert.NotEqual(original.RefreshToken, rotated.RefreshToken);
        await h.Db(async db => { Assert.Equal(1, await db.Sessions.CountAsync()); Assert.Equal(2, await db.RefreshCredentials.CountAsync()); });
        Assert.Equal(HttpStatusCode.Conflict, (await h.Client.PostAsJsonAsync("/api/auth/refresh", request with { RequestId = Guid.NewGuid() })).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await h.Me(rotated.AccessToken)).StatusCode);
        await h.Db(async db => await db.RefreshCredentials.Where(r => r.Hash == JwtTokens.Hash(original.RefreshToken))
            .ExecuteUpdateAsync(s => s.SetProperty(r => r.UsedAt, DateTimeOffset.UtcNow.AddMinutes(-1))));
        Assert.Equal(HttpStatusCode.Unauthorized, (await h.Client.PostAsJsonAsync("/api/auth/refresh", request)).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await h.Me(rotated.AccessToken)).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await h.Client.PostAsJsonAsync("/api/auth/refresh", new RefreshRequest(rotated.RefreshToken, Guid.NewGuid()))).StatusCode);
    }

    [Fact]
    public async Task Different_concurrent_refresh_requests_do_not_revoke_winner_and_logout_revokes_access()
    {
        await using var h = await AuthHarness.Create();
        var original = await h.Account("concurrent@example.test");
        var responses = await Task.WhenAll(Enumerable.Range(0, 2).Select(_ => h.Client.PostAsJsonAsync("/api/auth/refresh", new RefreshRequest(original.RefreshToken, Guid.NewGuid()))));
        Assert.Single(responses, r => r.StatusCode == HttpStatusCode.OK);
        Assert.Single(responses, r => r.StatusCode == HttpStatusCode.Conflict);
        var winner = (await responses.Single(r => r.IsSuccessStatusCode).Content.ReadFromJsonAsync<TokenResponse>())!;
        Assert.Equal(HttpStatusCode.OK, (await h.Me(winner.AccessToken)).StatusCode);
        Assert.Equal(HttpStatusCode.NoContent, (await h.Client.PostAsJsonAsync("/api/auth/logout", new LogoutRequest(original.RefreshToken))).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await h.Me(winner.AccessToken)).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await h.Client.PostAsJsonAsync("/api/auth/refresh", new RefreshRequest(winner.RefreshToken, Guid.NewGuid()))).StatusCode);
    }

    [Fact]
    public async Task Reset_token_is_single_use_under_race_and_revokes_all_existing_sessions()
    {
        await using var h = await AuthHarness.Create();
        var first = await h.Account("reset@example.test");
        var second = await h.Login("reset@example.test");
        await h.Client.PostAsJsonAsync("/api/auth/forgot-password", new EmailRequest("reset@example.test"));
        var code = await h.Code("reset@example.test", "reset");
        var request = new ResetRequest("reset@example.test", code, "New secret password 2026!");
        var responses = await Task.WhenAll(Enumerable.Range(0, 2).Select(_ => h.Client.PostAsJsonAsync("/api/auth/reset-password", request)));
        Assert.Single(responses, r => r.StatusCode == HttpStatusCode.NoContent);
        Assert.Single(responses, r => r.StatusCode == HttpStatusCode.BadRequest);
        Assert.Equal(HttpStatusCode.Unauthorized, (await h.Me(first.AccessToken)).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await h.Me(second.AccessToken)).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await h.Client.PostAsJsonAsync("/api/auth/login", new LoginRequest(request.Email, AuthHarness.Password))).StatusCode);
        var fresh = await h.Login(request.Email, request.Password);
        Assert.Equal(HttpStatusCode.OK, (await h.Me(fresh.AccessToken)).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await h.Client.PostAsJsonAsync("/api/auth/reset-password", request)).StatusCode);
    }

    [Fact]
    public async Task Invalid_JWT_claims_expiry_signature_and_disabled_sessions_are_rejected()
    {
        await using var h = await AuthHarness.Create();
        var pair = await h.Account("jwt@example.test");
        var parsed = new JwtSecurityTokenHandler().ReadJwtToken(pair.AccessToken);
        using var key = RSA.Create();
        key.ImportFromPem(TestAuthSettings.Key);
        string Make(string issuer, string audience, DateTime expires, RSA signing, Guid? user = null) =>
            new JwtSecurityTokenHandler().WriteToken(new JwtSecurityToken(issuer, audience,
                [new Claim("sub", (user ?? pair.Account.Id).ToString()), new Claim("sid", parsed.Claims.Single(c => c.Type == "sid").Value)],
                DateTime.UtcNow.AddHours(-1), expires, new SigningCredentials(new RsaSecurityKey(signing), SecurityAlgorithms.RsaSha256)));
        using var wrong = RSA.Create(2048);
        foreach (var invalid in new[] { Make("wrong", "DatingMVP.Mobile", DateTime.UtcNow.AddMinutes(1), key),
            Make("DatingMVP", "wrong", DateTime.UtcNow.AddMinutes(1), key),
            Make("DatingMVP", "DatingMVP.Mobile", DateTime.UtcNow.AddMinutes(-1), key),
            Make("DatingMVP", "DatingMVP.Mobile", DateTime.UtcNow.AddMinutes(1), wrong),
            Make("DatingMVP", "DatingMVP.Mobile", DateTime.UtcNow.AddMinutes(1), key, Guid.NewGuid()), "malformed" })
            Assert.Equal(HttpStatusCode.Unauthorized, (await h.Me(invalid)).StatusCode);
        await h.Db(async db => await db.Users.ExecuteUpdateAsync(s => s.SetProperty(u => u.IsActive, false)));
        Assert.Equal(HttpStatusCode.Unauthorized, (await h.Me(pair.AccessToken)).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await h.Client.PostAsJsonAsync("/api/auth/refresh", new RefreshRequest(pair.RefreshToken, Guid.NewGuid()))).StatusCode);
    }

    [Fact]
    public async Task Lockout_expired_refresh_and_logout_all_are_enforced()
    {
        await using var h = await AuthHarness.Create();
        var pair = await h.Account("lock@example.test");
        for (var i = 0; i < 5; i++) Assert.Equal(HttpStatusCode.Unauthorized,
            (await h.Client.PostAsJsonAsync("/api/auth/login", new LoginRequest("lock@example.test", "wrong"))).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await h.Client.PostAsJsonAsync("/api/auth/login", new LoginRequest("lock@example.test", AuthHarness.Password))).StatusCode);
        await h.Db(async db => { Assert.True((await db.Users.SingleAsync()).LockoutEnd > DateTimeOffset.UtcNow);
            await db.Sessions.ExecuteUpdateAsync(s => s.SetProperty(x => x.ExpiresAt, DateTimeOffset.UtcNow.AddSeconds(-1))); });
        Assert.Equal(HttpStatusCode.Unauthorized, (await h.Client.PostAsJsonAsync("/api/auth/refresh", new RefreshRequest(pair.RefreshToken, Guid.NewGuid()))).StatusCode);
        var other = await h.Account("other@example.test");
        var other2 = await h.Login("other@example.test");
        using var logout = new HttpRequestMessage(HttpMethod.Post, "/api/auth/logout-all");
        logout.Headers.Authorization = new("Bearer", other.AccessToken);
        Assert.Equal(HttpStatusCode.NoContent, (await h.Client.SendAsync(logout)).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await h.Me(other2.AccessToken)).StatusCode);
    }

    [Fact]
    public async Task Anonymous_auth_rate_limit_returns_safe_429()
    {
        await using var h = await AuthHarness.Create();
        for (var i = 0; i < 20; i++)
            Assert.Equal(HttpStatusCode.Accepted, (await h.Client.PostAsJsonAsync("/api/auth/forgot-password", new EmailRequest("missing@example.test"))).StatusCode);
        var rejected = await h.Client.PostAsJsonAsync("/api/auth/forgot-password", new EmailRequest("missing@example.test"));
        Assert.Equal(HttpStatusCode.TooManyRequests, rejected.StatusCode);
        Assert.NotNull(rejected.Headers.RetryAfter);
        Assert.DoesNotContain("missing@example", await rejected.Content.ReadAsStringAsync());
    }
}
