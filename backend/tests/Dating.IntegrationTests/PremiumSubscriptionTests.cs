using System.Net;
using System.Net.Http.Json;
using Dating.Api.Features.Auth;
using Dating.Api.Features.Matching;
using Dating.Api.Features.Premium;
using Dating.Api.Features.Profiles;
using Dating.Api.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace Dating.IntegrationTests;

public class PremiumSubscriptionTests
{
    private static async Task<HttpResponseMessage> Send(AuthHarness h, TokenResponse user, HttpMethod method, string path, object? value = null)
    {
        using var request = new HttpRequestMessage(method, path);
        request.Headers.Authorization = new("Bearer", user.AccessToken);
        if (value is not null) request.Content = JsonContent.Create(value);
        return await h.Client.SendAsync(request);
    }

    [Fact]
    public async Task Premium_packages_have_exact_pricing_and_catalog()
    {
        await using var h = await AuthHarness.Create();
        var user = await h.Account("prem_cat@example.com");

        var res = await Send(h, user, HttpMethod.Get, "/api/premium/packages");
        Assert.Equal(HttpStatusCode.OK, res.StatusCode);

        var pkgs = (await res.Content.ReadFromJsonAsync<PremiumPackageDto[]>())!;
        Assert.Equal(4, pkgs.Length);

        var twoWeeks = pkgs.Single(p => p.Id == "two_weeks");
        Assert.Equal("2 კვირა", twoWeeks.Name);
        Assert.Equal(2.90m, twoWeeks.PriceAmount);
        Assert.Equal(14, twoWeeks.DurationDays);

        var oneMonth = pkgs.Single(p => p.Id == "one_month");
        Assert.Equal("1 თვე", oneMonth.Name);
        Assert.Equal(4.90m, oneMonth.PriceAmount);
        Assert.Equal(30, oneMonth.DurationDays);
        Assert.True(oneMonth.IsPopular);

        var threeMonths = pkgs.Single(p => p.Id == "three_months");
        Assert.Equal("3 თვე", threeMonths.Name);
        Assert.Equal(10.00m, threeMonths.PriceAmount);
        Assert.Equal(90, threeMonths.DurationDays);

        var lifetime = pkgs.Single(p => p.Id == "lifetime");
        Assert.Equal("ულიმიტო", lifetime.Name);
        Assert.Equal(40.00m, lifetime.PriceAmount);
        Assert.Null(lifetime.DurationDays);
    }

    [Fact]
    public async Task Requests_are_blurred_without_premium_and_revealed_after_subscription()
    {
        await using var h = await AuthHarness.Create();
        var suitor = await MatchingTests.Person(h, "suitor");
        var receiver = await MatchingTests.Person(h, "receiver");

        // Suitor likes Receiver in Discovery
        var swipeRes = await Send(h, suitor, HttpMethod.Post, "/api/swipes",
            new SwipeRequest(Guid.NewGuid(), receiver.Account.Id, "like"));
        Assert.Equal(HttpStatusCode.OK, swipeRes.StatusCode);

        // Receiver checks initial premium status: hasPremium == false
        var statusRes1 = await Send(h, receiver, HttpMethod.Get, "/api/premium/status");
        Assert.Equal(HttpStatusCode.OK, statusRes1.StatusCode);
        var status1 = (await statusRes1.Content.ReadFromJsonAsync<PremiumStatusDto>())!;
        Assert.False(status1.HasPremium);

        // 1. Without Premium: Receiver calls /api/matches/requests
        // Result must be masked server-side: no photos, masked name, IsBlurred = true
        var reqRes1 = await Send(h, receiver, HttpMethod.Get, "/api/matches/requests");
        Assert.Equal(HttpStatusCode.OK, reqRes1.StatusCode);
        var requests1 = (await reqRes1.Content.ReadFromJsonAsync<LikeRequestSummary[]>())!;
        Assert.Single(requests1);
        var blurredReq = requests1[0];
        Assert.True(blurredReq.IsBlurred);
        Assert.Equal("Test Person", blurredReq.DisplayName);
        Assert.Equal(36, blurredReq.Age);
        Assert.NotNull(blurredReq.Photo);
        Assert.Equal(suitor.Account.Id, blurredReq.UserId);

        // 2. Receiver subscribes to 1 month package (4.90 GEL)
        var subRes = await Send(h, receiver, HttpMethod.Post, "/api/premium/subscribe",
            new SubscribePackageRequest("one_month", "Mobile", "tx_12345"));
        Assert.Equal(HttpStatusCode.OK, subRes.StatusCode);
        var subResult = (await subRes.Content.ReadFromJsonAsync<SubscribeResultDto>())!;
        Assert.True(subResult.Success);
        Assert.True(subResult.Status.HasPremium);
        Assert.Equal("one_month", subResult.Status.ActivePackageId);
        Assert.NotNull(subResult.Status.ExpiresAtUtc);
        Assert.False(subResult.Status.IsLifetime);

        // 3. With Premium: Receiver calls /api/matches/requests again
        // Suitor profile is now completely revealed!
        var reqRes2 = await Send(h, receiver, HttpMethod.Get, "/api/matches/requests");
        Assert.Equal(HttpStatusCode.OK, reqRes2.StatusCode);
        var requests2 = (await reqRes2.Content.ReadFromJsonAsync<LikeRequestSummary[]>())!;
        Assert.Single(requests2);
        var revealedReq = requests2[0];
        Assert.False(revealedReq.IsBlurred);
        Assert.Equal(suitor.Account.Id, revealedReq.UserId);
        Assert.Equal("Test Person", revealedReq.DisplayName);
        Assert.Equal("Tbilisi", revealedReq.City);
        Assert.NotNull(revealedReq.Photo);
        Assert.NotNull(revealedReq.Photos);

        // 4. Upgrade to Lifetime package (40 GEL)
        var lifetimeRes = await Send(h, receiver, HttpMethod.Post, "/api/premium/subscribe",
            new SubscribePackageRequest("lifetime", "Mobile", "tx_lifetime"));
        Assert.Equal(HttpStatusCode.OK, lifetimeRes.StatusCode);
        var lifetimeResult = (await lifetimeRes.Content.ReadFromJsonAsync<SubscribeResultDto>())!;
        Assert.True(lifetimeResult.Status.HasPremium);
        Assert.True(lifetimeResult.Status.IsLifetime);
        Assert.Null(lifetimeResult.Status.ExpiresAtUtc);
    }

    [Fact]
    public async Task Invalid_package_fails_with_400()
    {
        await using var h = await AuthHarness.Create();
        var user = await h.Account("invalid_pkg@example.com");

        var res = await Send(h, user, HttpMethod.Post, "/api/premium/subscribe",
            new SubscribePackageRequest("non_existent_package"));
        Assert.Equal(HttpStatusCode.BadRequest, res.StatusCode);
    }
}
