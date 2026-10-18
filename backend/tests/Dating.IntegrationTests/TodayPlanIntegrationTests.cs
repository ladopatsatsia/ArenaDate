using System.Net;
using System.Net.Http.Json;
using Dating.Api.Features.Auth;
using Dating.Api.Features.Chat;
using Dating.Api.Features.Profiles;
using Dating.Api.Features.TodayPlans;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace Dating.IntegrationTests;

public class TodayPlanIntegrationTests
{
    private static async Task<HttpResponseMessage> Send(
        AuthHarness h,
        TokenResponse user,
        HttpMethod method,
        string path,
        object? value = null)
    {
        using var request = new HttpRequestMessage(method, path);
        request.Headers.Authorization = new("Bearer", user.AccessToken);
        if (value is not null) request.Content = JsonContent.Create(value);
        return await h.Client.SendAsync(request);
    }

    private static async Task SetupProfile(AuthHarness h, TokenResponse user, string name, string city, string gender = "woman")
    {
        var update = new ProfileUpdate(
            Revision: 0,
            DisplayName: name,
            Bio: "ეს არის ტესტ ბიოგრაფია",
            Gender: gender,
            DesiredGenders: ["man", "woman"],
            City: city,
            Interests: ["music", "books"],
            RelationshipGoal: "long_term",
            Visible: true
        );
        var res = await Send(h, user, HttpMethod.Post, "/api/profile", update);
        Assert.Equal(HttpStatusCode.OK, res.StatusCode);
    }

    [Fact]
    public async Task Create_and_get_plan_succeeds_with_valid_parameters()
    {
        await using var h = await AuthHarness.Create();
        var author = await h.Account("plan_author1@example.com");
        await SetupProfile(h, author, "ნინო", "ქუთაისი", "woman");

        var now = DateTimeOffset.UtcNow;
        var planReq = new CreateTodayPlanRequest(
            City: "kutaisi",
            District: "ცენტრი",
            Activity: "coffee",
            Title: "დღეს საღამოს ყავა ქუთაისში",
            Description: "მყუდრო კაფეში საუბარი და ყავა",
            StartsAtUtc: now.AddHours(2),
            ExpiresAtUtc: now.AddHours(5),
            BudgetAmount: 25.00m
        );

        var res = await Send(h, author, HttpMethod.Post, "/api/today-plans", planReq);
        Assert.Equal(HttpStatusCode.OK, res.StatusCode);

        var created = (await res.Content.ReadFromJsonAsync<TodayPlanDetailDto>())!;
        Assert.Equal("დღეს საღამოს ყავა ქუთაისში", created.Title);
        Assert.Equal("kutaisi", created.City);
        Assert.Equal("coffee", created.Activity);
        Assert.Equal("Open", created.State);
        Assert.Equal(25.00m, created.BudgetAmount);
        Assert.True(created.IsAuthor);
        Assert.False(created.HasApplied);

        // Check public feed
        var feedRes = await Send(h, author, HttpMethod.Get, "/api/today-plans?city=kutaisi");
        Assert.Equal(HttpStatusCode.OK, feedRes.StatusCode);

        var feed = (await feedRes.Content.ReadFromJsonAsync<TodayPlanFeedPageDto>())!;
        Assert.Contains(feed.Items, p => p.Id == created.Id);
    }

    [Fact]
    public async Task Validation_rules_enforce_planning_horizon_and_times()
    {
        await using var h = await AuthHarness.Create();
        var author = await h.Account("plan_val@example.com");
        await SetupProfile(h, author, "გიორგი", "თბილისი", "man");

        var now = DateTimeOffset.UtcNow;

        // Start in the past (> 15 mins)
        var pastReq = new CreateTodayPlanRequest(
            City: "tbilisi",
            District: null,
            Activity: "coffee",
            Title: "წარსულის გეგმა",
            Description: null,
            StartsAtUtc: now.AddHours(-1),
            ExpiresAtUtc: now.AddHours(1),
            BudgetAmount: null
        );
        var pastRes = await Send(h, author, HttpMethod.Post, "/api/today-plans", pastReq);
        Assert.Equal(HttpStatusCode.BadRequest, pastRes.StatusCode);

        // Expires before starts
        var invalidRangeReq = new CreateTodayPlanRequest(
            City: "tbilisi",
            District: null,
            Activity: "coffee",
            Title: "არასწორი დრო",
            Description: null,
            StartsAtUtc: now.AddHours(3),
            ExpiresAtUtc: now.AddHours(2),
            BudgetAmount: null
        );
        var rangeRes = await Send(h, author, HttpMethod.Post, "/api/today-plans", invalidRangeReq);
        Assert.Equal(HttpStatusCode.BadRequest, rangeRes.StatusCode);

        // Planning horizon > 48 hours
        var horizonReq = new CreateTodayPlanRequest(
            City: "tbilisi",
            District: null,
            Activity: "cinema",
            Title: "3 დღის მერე",
            Description: null,
            StartsAtUtc: now.AddHours(50),
            ExpiresAtUtc: now.AddHours(53),
            BudgetAmount: null
        );
        var horizonRes = await Send(h, author, HttpMethod.Post, "/api/today-plans", horizonReq);
        Assert.Equal(HttpStatusCode.BadRequest, horizonRes.StatusCode);

        // Invalid budget (< 0 or > 5000)
        var budgetReq = new CreateTodayPlanRequest(
            City: "tbilisi",
            District: null,
            Activity: "food",
            Title: "ძვირი ვახშამი",
            Description: null,
            StartsAtUtc: now.AddHours(2),
            ExpiresAtUtc: now.AddHours(4),
            BudgetAmount: 6000m
        );
        var budgetRes = await Send(h, author, HttpMethod.Post, "/api/today-plans", budgetReq);
        Assert.Equal(HttpStatusCode.BadRequest, budgetRes.StatusCode);
    }

    [Fact]
    public async Task Author_cannot_apply_to_own_plan()
    {
        await using var h = await AuthHarness.Create();
        var author = await h.Account("plan_own@example.com");
        await SetupProfile(h, author, "თამარი", "ბათუმი", "woman");

        var now = DateTimeOffset.UtcNow;
        var planReq = new CreateTodayPlanRequest(
            City: "batumi",
            District: "ბულვარი",
            Activity: "walk",
            Title: "სეირნობა ზღვის პირას",
            Description: "საღამოს გასეირნება",
            StartsAtUtc: now.AddHours(1),
            ExpiresAtUtc: now.AddHours(3),
            BudgetAmount: null
        );
        var planRes = await Send(h, author, HttpMethod.Post, "/api/today-plans", planReq);
        var plan = (await planRes.Content.ReadFromJsonAsync<TodayPlanDetailDto>())!;

        var applyRes = await Send(h, author, HttpMethod.Post, $"/api/today-plans/{plan.Id}/responses", new CreateTodayPlanResponseRequest("მე თვითონ"));
        Assert.Equal(HttpStatusCode.BadRequest, applyRes.StatusCode);
    }

    [Fact]
    public async Task Applicant_can_apply_view_and_withdraw_response()
    {
        await using var h = await AuthHarness.Create();
        var author = await h.Account("plan_author2@example.com");
        var applicant = await h.Account("plan_app1@example.com");

        await SetupProfile(h, author, "ანი", "თბილისი", "woman");
        await SetupProfile(h, applicant, "ლუკა", "თბილისი", "man");

        var now = DateTimeOffset.UtcNow;
        var planReq = new CreateTodayPlanRequest(
            City: "tbilisi",
            District: "ვაკე",
            Activity: "coffee",
            Title: "ყავა ვაკეში",
            Description: "საინტერესო საუბარი",
            StartsAtUtc: now.AddHours(2),
            ExpiresAtUtc: now.AddHours(4),
            BudgetAmount: 20m
        );
        var planRes = await Send(h, author, HttpMethod.Post, "/api/today-plans", planReq);
        var plan = (await planRes.Content.ReadFromJsonAsync<TodayPlanDetailDto>())!;

        // Applicant applies
        var applyRes = await Send(h, applicant, HttpMethod.Post, $"/api/today-plans/{plan.Id}/responses",
            new CreateTodayPlanResponseRequest("შემოგიერთდებოდი სიამოვნებით!"));
        Assert.Equal(HttpStatusCode.OK, applyRes.StatusCode);

        var myResp = (await applyRes.Content.ReadFromJsonAsync<TodayPlanMyResponseDto>())!;
        Assert.Equal("Pending", myResp.State);
        Assert.Equal("შემოგიერთდებოდი სიამოვნებით!", myResp.Message);

        // Author checks applicants list
        var appListRes = await Send(h, author, HttpMethod.Get, $"/api/today-plans/{plan.Id}/applicants");
        Assert.Equal(HttpStatusCode.OK, appListRes.StatusCode);
        var applicants = (await appListRes.Content.ReadFromJsonAsync<TodayPlanApplicantDto[]>())!;
        Assert.Single(applicants);
        Assert.Equal("ლუკა", applicants[0].DisplayName);
        Assert.Equal("Pending", applicants[0].State);

        // Applicant withdraws
        var withdrawRes = await Send(h, applicant, HttpMethod.Post, $"/api/today-plans/{plan.Id}/responses/{myResp.ResponseId}/withdraw");
        Assert.Equal(HttpStatusCode.NoContent, withdrawRes.StatusCode);

        // Re-applying is forbidden even after withdraw
        var reapplyRes = await Send(h, applicant, HttpMethod.Post, $"/api/today-plans/{plan.Id}/responses",
            new CreateTodayPlanResponseRequest("ხელახლა მინდა"));
        Assert.Equal(HttpStatusCode.Conflict, reapplyRes.StatusCode);
    }

    [Fact]
    public async Task Accepting_one_applicant_transitions_plan_to_matched_and_closes_other_applicants()
    {
        await using var h = await AuthHarness.Create();
        var author = await h.Account("plan_author3@example.com");
        var app1 = await h.Account("plan_app_candidate1@example.com");
        var app2 = await h.Account("plan_app_candidate2@example.com");

        await SetupProfile(h, author, "სალომე", "თბილისი", "woman");
        await SetupProfile(h, app1, "დათო", "თბილისი", "man");
        await SetupProfile(h, app2, "სანდრო", "თბილისი", "man");

        var now = DateTimeOffset.UtcNow;
        var planReq = new CreateTodayPlanRequest(
            City: "tbilisi",
            District: "საბურთალო",
            Activity: "food",
            Title: "პიცა და საუბარი",
            Description: null,
            StartsAtUtc: now.AddHours(2),
            ExpiresAtUtc: now.AddHours(4),
            BudgetAmount: 40m
        );
        var planRes = await Send(h, author, HttpMethod.Post, "/api/today-plans", planReq);
        var plan = (await planRes.Content.ReadFromJsonAsync<TodayPlanDetailDto>())!;

        // Both candidates apply
        var resp1Msg = await Send(h, app1, HttpMethod.Post, $"/api/today-plans/{plan.Id}/responses", new CreateTodayPlanResponseRequest("მე დათო ვარ"));
        var resp1 = (await resp1Msg.Content.ReadFromJsonAsync<TodayPlanMyResponseDto>())!;

        var resp2Msg = await Send(h, app2, HttpMethod.Post, $"/api/today-plans/{plan.Id}/responses", new CreateTodayPlanResponseRequest("მე სანდრო ვარ"));
        var resp2 = (await resp2Msg.Content.ReadFromJsonAsync<TodayPlanMyResponseDto>())!;

        // Author accepts candidate 1 (Dato)
        var acceptRes = await Send(h, author, HttpMethod.Post, $"/api/today-plans/{plan.Id}/responses/{resp1.ResponseId}/accept");
        Assert.Equal(HttpStatusCode.OK, acceptRes.StatusCode);

        var acceptResult = (await acceptRes.Content.ReadFromJsonAsync<AcceptPlanResponseResult>())!;
        Assert.Equal("Matched", acceptResult.State);
        Assert.NotNull(acceptResult.ConversationId);

        // Verify Plan is now Matched
        var updatedPlan = await (await Send(h, author, HttpMethod.Get, $"/api/today-plans/{plan.Id}")).Content.ReadFromJsonAsync<TodayPlanDetailDto>();
        Assert.Equal("Matched", updatedPlan!.State);
        Assert.NotNull(updatedPlan.SelectedCompanionUserId);

        // Verify Candidate 2 (Sandro) was automatically Closed
        var sandroResponses = await (await Send(h, app2, HttpMethod.Get, "/api/today-plans/my-responses")).Content.ReadFromJsonAsync<TodayPlanMyResponseDto[]>();
        var sandroResp = sandroResponses!.Single(r => r.PlanId == plan.Id);
        Assert.Equal("Closed", sandroResp.State);

        // Attempting to accept candidate 2 fails with 409 Conflict
        var secondAcceptRes = await Send(h, author, HttpMethod.Post, $"/api/today-plans/{plan.Id}/responses/{resp2.ResponseId}/accept");
        Assert.Equal(HttpStatusCode.Conflict, secondAcceptRes.StatusCode);
    }

    [Fact]
    public async Task Cancelling_plan_closes_pending_responses()
    {
        await using var h = await AuthHarness.Create();
        var author = await h.Account("plan_cancel_author@example.com");
        var applicant = await h.Account("plan_cancel_app@example.com");

        await SetupProfile(h, author, "მარიამი", "რუსთავი", "woman");
        await SetupProfile(h, applicant, "ირაკლი", "რუსთავი", "man");

        var now = DateTimeOffset.UtcNow;
        var planReq = new CreateTodayPlanRequest(
            City: "rustavi",
            District: null,
            Activity: "walk",
            Title: "სეირნობა პარკში",
            Description: null,
            StartsAtUtc: now.AddHours(1),
            ExpiresAtUtc: now.AddHours(3),
            BudgetAmount: null
        );
        var planRes = await Send(h, author, HttpMethod.Post, "/api/today-plans", planReq);
        var plan = (await planRes.Content.ReadFromJsonAsync<TodayPlanDetailDto>())!;

        var applyRes = await Send(h, applicant, HttpMethod.Post, $"/api/today-plans/{plan.Id}/responses", new CreateTodayPlanResponseRequest("მოვდივარ"));
        Assert.Equal(HttpStatusCode.OK, applyRes.StatusCode);

        // Author cancels plan
        var cancelRes = await Send(h, author, HttpMethod.Post, $"/api/today-plans/{plan.Id}/cancel");
        Assert.Equal(HttpStatusCode.OK, cancelRes.StatusCode);
        var cancelledPlan = (await cancelRes.Content.ReadFromJsonAsync<TodayPlanDetailDto>())!;
        Assert.Equal("Cancelled", cancelledPlan.State);

        // Applicant response should now be Closed
        var appResponses = await (await Send(h, applicant, HttpMethod.Get, "/api/today-plans/my-responses")).Content.ReadFromJsonAsync<TodayPlanMyResponseDto[]>();
        var resp = appResponses!.Single(r => r.PlanId == plan.Id);
        Assert.Equal("Closed", resp.State);
    }

    [Fact]
    public async Task Rejecting_an_applicant_marks_response_rejected()
    {
        await using var h = await AuthHarness.Create();
        var author = await h.Account("plan_rej_author@example.com");
        var applicant = await h.Account("plan_rej_app@example.com");

        await SetupProfile(h, author, "თეკლა", "თბილისი", "woman");
        await SetupProfile(h, applicant, "ნიკა", "თბილისი", "man");

        var now = DateTimeOffset.UtcNow;
        var planReq = new CreateTodayPlanRequest(
            City: "tbilisi",
            District: "მთაწმინდა",
            Activity: "coffee",
            Title: "ყავა მთაწმინდაზე",
            Description: null,
            StartsAtUtc: now.AddHours(2),
            ExpiresAtUtc: now.AddHours(4),
            BudgetAmount: 15m
        );
        var planRes = await Send(h, author, HttpMethod.Post, "/api/today-plans", planReq);
        var plan = (await planRes.Content.ReadFromJsonAsync<TodayPlanDetailDto>())!;

        var applyRes = await Send(h, applicant, HttpMethod.Post, $"/api/today-plans/{plan.Id}/responses", new CreateTodayPlanResponseRequest("ყავა მიყვარს"));
        var myResp = (await applyRes.Content.ReadFromJsonAsync<TodayPlanMyResponseDto>())!;

        // Author rejects applicant
        var rejectRes = await Send(h, author, HttpMethod.Post, $"/api/today-plans/{plan.Id}/responses/{myResp.ResponseId}/reject");
        Assert.Equal(HttpStatusCode.NoContent, rejectRes.StatusCode);

        // Applicant checks response
        var myResponses = await (await Send(h, applicant, HttpMethod.Get, "/api/today-plans/my-responses")).Content.ReadFromJsonAsync<TodayPlanMyResponseDto[]>();
        var rejectedResp = myResponses!.Single(r => r.PlanId == plan.Id);
        Assert.Equal("Rejected", rejectedResp.State);

        // Plan remains Open for other applicants
        var planDetail = await (await Send(h, author, HttpMethod.Get, $"/api/today-plans/{plan.Id}")).Content.ReadFromJsonAsync<TodayPlanDetailDto>();
        Assert.Equal("Open", planDetail!.State);
    }

    [Fact]
    public async Task Feed_filters_by_activity_and_day()
    {
        await using var h = await AuthHarness.Create();
        var author = await h.Account("plan_filter_author@example.com");
        await SetupProfile(h, author, "ელენე", "ბათუმი", "woman");

        var now = DateTimeOffset.UtcNow;

        // Plan 1: coffee in Batumi today
        await Send(h, author, HttpMethod.Post, "/api/today-plans", new CreateTodayPlanRequest(
            City: "batumi",
            District: null,
            Activity: "coffee",
            Title: "დღეს ყავა ბათუმში",
            Description: null,
            StartsAtUtc: now.AddHours(2),
            ExpiresAtUtc: now.AddHours(4),
            BudgetAmount: null
        ));

        // Plan 2: cinema in Batumi tomorrow
        await Send(h, author, HttpMethod.Post, "/api/today-plans", new CreateTodayPlanRequest(
            City: "batumi",
            District: null,
            Activity: "cinema",
            Title: "ხვალ კინო აპოლოში",
            Description: null,
            StartsAtUtc: now.AddHours(26),
            ExpiresAtUtc: now.AddHours(29),
            BudgetAmount: null
        ));

        // Filter by activity: cinema
        var cinemaRes = await Send(h, author, HttpMethod.Get, "/api/today-plans?city=batumi&activity=cinema");
        var cinemaFeed = (await cinemaRes.Content.ReadFromJsonAsync<TodayPlanFeedPageDto>())!;
        Assert.All(cinemaFeed.Items, p => Assert.Equal("cinema", p.Activity));

        // Filter by activity: coffee
        var coffeeRes = await Send(h, author, HttpMethod.Get, "/api/today-plans?city=batumi&activity=coffee");
        var coffeeFeed = (await coffeeRes.Content.ReadFromJsonAsync<TodayPlanFeedPageDto>())!;
        Assert.All(coffeeFeed.Items, p => Assert.Equal("coffee", p.Activity));
    }

    [Fact]
    public async Task Free_and_premium_active_plan_limits_enforced()
    {
        await using var h = await AuthHarness.Create();
        var author = await h.Account("plan_limits_author@example.com");
        await SetupProfile(h, author, "დავითი", "თბილისი", "man");

        var now = DateTimeOffset.UtcNow;

        // Free tier: 1st plan succeeds
        var plan1Res = await Send(h, author, HttpMethod.Post, "/api/today-plans", new CreateTodayPlanRequest(
            City: "tbilisi", District: null, Activity: "coffee", Title: "პირველი გეგმა", Description: null,
            StartsAtUtc: now.AddHours(2), ExpiresAtUtc: now.AddHours(5), BudgetAmount: null));
        Assert.Equal(HttpStatusCode.OK, plan1Res.StatusCode);

        // Free tier: 2nd active plan fails (limit = 1)
        var plan2Res = await Send(h, author, HttpMethod.Post, "/api/today-plans", new CreateTodayPlanRequest(
            City: "tbilisi", District: null, Activity: "walk", Title: "მეორე გეგმა", Description: null,
            StartsAtUtc: now.AddHours(3), ExpiresAtUtc: now.AddHours(6), BudgetAmount: null));
        Assert.Equal(HttpStatusCode.Forbidden, plan2Res.StatusCode);

        // Check limits endpoint before premium
        var limitsRes1 = await Send(h, author, HttpMethod.Get, "/api/today-plans/limits");
        Assert.Equal(HttpStatusCode.OK, limitsRes1.StatusCode);
        var limits1 = (await limitsRes1.Content.ReadFromJsonAsync<TodayPlanLimitsDto>())!;
        Assert.False(limits1.HasPremium);
        Assert.Equal(1, limits1.ActivePlansCount);
        Assert.Equal(1, limits1.ActivePlansLimit);
        Assert.False(limits1.CanCreatePlan);

        // Subscribe to Premium
        var subRes = await Send(h, author, HttpMethod.Post, "/api/premium/subscribe",
            new Dating.Api.Features.Premium.SubscribePackageRequest("one_month", "test"));
        Assert.Equal(HttpStatusCode.OK, subRes.StatusCode);

        // Premium tier: 2nd plan now succeeds
        var plan2PremRes = await Send(h, author, HttpMethod.Post, "/api/today-plans", new CreateTodayPlanRequest(
            City: "tbilisi", District: null, Activity: "walk", Title: "მეორე გეგმა", Description: null,
            StartsAtUtc: now.AddHours(3), ExpiresAtUtc: now.AddHours(6), BudgetAmount: null));
        Assert.Equal(HttpStatusCode.OK, plan2PremRes.StatusCode);

        // Premium tier: 3rd plan succeeds (limit = 3)
        var plan3PremRes = await Send(h, author, HttpMethod.Post, "/api/today-plans", new CreateTodayPlanRequest(
            City: "tbilisi", District: null, Activity: "cinema", Title: "მესამე გეგმა", Description: null,
            StartsAtUtc: now.AddHours(4), ExpiresAtUtc: now.AddHours(7), BudgetAmount: null));
        Assert.Equal(HttpStatusCode.OK, plan3PremRes.StatusCode);

        // Premium tier: 4th plan fails (limit = 3)
        var plan4PremRes = await Send(h, author, HttpMethod.Post, "/api/today-plans", new CreateTodayPlanRequest(
            City: "tbilisi", District: null, Activity: "food", Title: "მეოთხე გეგმა", Description: null,
            StartsAtUtc: now.AddHours(5), ExpiresAtUtc: now.AddHours(8), BudgetAmount: null));
        Assert.Equal(HttpStatusCode.Forbidden, plan4PremRes.StatusCode);

        // Check limits endpoint after premium
        var limitsRes2 = await Send(h, author, HttpMethod.Get, "/api/today-plans/limits");
        var limits2 = (await limitsRes2.Content.ReadFromJsonAsync<TodayPlanLimitsDto>())!;
        Assert.True(limits2.HasPremium);
        Assert.Equal(3, limits2.ActivePlansCount);
        Assert.Equal(3, limits2.ActivePlansLimit);
        Assert.False(limits2.CanCreatePlan);
    }

    [Fact]
    public async Task Free_daily_responses_limit_and_withdrawal_non_refund_enforced()
    {
        await using var h = await AuthHarness.Create();
        var author1 = await h.Account("plan_authors_multi1@example.com");
        var author2 = await h.Account("plan_authors_multi2@example.com");
        var applicant = await h.Account("plan_applicant_quota@example.com");

        await SetupProfile(h, author1, "ნატა", "თბილისი", "woman");
        await SetupProfile(h, author2, "მარიამი", "თბილისი", "woman");
        await SetupProfile(h, applicant, "გიორგი", "თბილისი", "man");

        // Author 1 subscribes to premium to post 3 plans
        await Send(h, author1, HttpMethod.Post, "/api/premium/subscribe",
            new Dating.Api.Features.Premium.SubscribePackageRequest("one_month", "test"));

        var now = DateTimeOffset.UtcNow;
        var planIds = new List<Guid>();

        for (int i = 1; i <= 3; i++)
        {
            var pRes = await Send(h, author1, HttpMethod.Post, "/api/today-plans", new CreateTodayPlanRequest(
                City: "tbilisi", District: null, Activity: "coffee", Title: $"გეგმა {i}", Description: null,
                StartsAtUtc: now.AddHours(i), ExpiresAtUtc: now.AddHours(i + 3), BudgetAmount: null));
            Assert.Equal(HttpStatusCode.OK, pRes.StatusCode);
            var plan = (await pRes.Content.ReadFromJsonAsync<TodayPlanDetailDto>())!;
            planIds.Add(plan.Id);
        }

        // Author 2 creates the 4th plan
        var p4Res = await Send(h, author2, HttpMethod.Post, "/api/today-plans", new CreateTodayPlanRequest(
            City: "tbilisi", District: null, Activity: "walk", Title: "გეგმა 4", Description: null,
            StartsAtUtc: now.AddHours(4), ExpiresAtUtc: now.AddHours(7), BudgetAmount: null));
        Assert.Equal(HttpStatusCode.OK, p4Res.StatusCode);
        var plan4 = (await p4Res.Content.ReadFromJsonAsync<TodayPlanDetailDto>())!;
        planIds.Add(plan4.Id);

        // Free applicant sends 3 responses (allowed limit = 3)
        var r1 = await Send(h, applicant, HttpMethod.Post, $"/api/today-plans/{planIds[0]}/responses", new CreateTodayPlanResponseRequest("პასუხი 1"));
        Assert.Equal(HttpStatusCode.OK, r1.StatusCode);
        var r1Dto = (await r1.Content.ReadFromJsonAsync<TodayPlanMyResponseDto>())!;

        var r2 = await Send(h, applicant, HttpMethod.Post, $"/api/today-plans/{planIds[1]}/responses", new CreateTodayPlanResponseRequest("პასუხი 2"));
        Assert.Equal(HttpStatusCode.OK, r2.StatusCode);

        var r3 = await Send(h, applicant, HttpMethod.Post, $"/api/today-plans/{planIds[2]}/responses", new CreateTodayPlanResponseRequest("პასუხი 3"));
        Assert.Equal(HttpStatusCode.OK, r3.StatusCode);

        // Check applicant limits: 3 used out of 3, 0 remaining
        var limitsRes = await Send(h, applicant, HttpMethod.Get, "/api/today-plans/limits");
        var limits = (await limitsRes.Content.ReadFromJsonAsync<TodayPlanLimitsDto>())!;
        Assert.Equal(3, limits.DailyResponsesUsed);
        Assert.Equal(3, limits.DailyResponsesLimit);
        Assert.Equal(0, limits.DailyResponsesRemaining);
        Assert.False(limits.CanApply);

        // 4th response is rejected with 429
        var r4 = await Send(h, applicant, HttpMethod.Post, $"/api/today-plans/{planIds[3]}/responses", new CreateTodayPlanResponseRequest("პასუხი 4"));
        Assert.Equal(HttpStatusCode.TooManyRequests, r4.StatusCode);

        // Withdrawing response 1 does NOT refund daily quota
        var withdrawRes = await Send(h, applicant, HttpMethod.Post, $"/api/today-plans/{planIds[0]}/responses/{r1Dto.ResponseId}/withdraw");
        Assert.Equal(HttpStatusCode.NoContent, withdrawRes.StatusCode);

        // 4th response still rejected with 429
        var r4AfterWithdraw = await Send(h, applicant, HttpMethod.Post, $"/api/today-plans/{planIds[3]}/responses", new CreateTodayPlanResponseRequest("პასუხი 4 ისევ"));
        Assert.Equal(HttpStatusCode.TooManyRequests, r4AfterWithdraw.StatusCode);

        // Upgrading to premium instantly expands daily responses limit to 10
        await Send(h, applicant, HttpMethod.Post, "/api/premium/subscribe",
            new Dating.Api.Features.Premium.SubscribePackageRequest("one_month", "test"));

        var r4AfterPremium = await Send(h, applicant, HttpMethod.Post, $"/api/today-plans/{planIds[3]}/responses", new CreateTodayPlanResponseRequest("ახლა პრემიუმით"));
        Assert.Equal(HttpStatusCode.OK, r4AfterPremium.StatusCode);
    }

    [Fact]
    public async Task Concurrent_requests_cannot_exceed_limits()
    {
        await using var h = await AuthHarness.Create();
        var author = await h.Account("concurrent_author@example.com");
        await SetupProfile(h, author, "თამარი", "თბილისი", "woman");

        var now = DateTimeOffset.UtcNow;

        // On Free tier, max active plans = 1.
        // Send 2 concurrent plan creations simultaneously.
        var task1 = Send(h, author, HttpMethod.Post, "/api/today-plans", new CreateTodayPlanRequest(
            City: "tbilisi", District: null, Activity: "coffee", Title: "კონკურენტული გეგმა 1", Description: null,
            StartsAtUtc: now.AddHours(2), ExpiresAtUtc: now.AddHours(5), BudgetAmount: null));

        var task2 = Send(h, author, HttpMethod.Post, "/api/today-plans", new CreateTodayPlanRequest(
            City: "tbilisi", District: null, Activity: "walk", Title: "კონკურენტული გეგმა 2", Description: null,
            StartsAtUtc: now.AddHours(3), ExpiresAtUtc: now.AddHours(6), BudgetAmount: null));

        var responses = await Task.WhenAll(task1, task2);
        var successCount = responses.Count(r => r.StatusCode == HttpStatusCode.OK);
        var forbiddenCount = responses.Count(r => r.StatusCode == HttpStatusCode.Forbidden);

        Assert.Equal(1, successCount);
        Assert.Equal(1, forbiddenCount);
    }

    [Fact]
    public async Task Accepting_plan_response_creates_free_chat_with_plan_context_intro_and_enables_messaging()
    {
        await using var h = await AuthHarness.Create();
        var author = await h.Account("plan_chat_author@example.com");
        var applicant = await h.Account("plan_chat_applicant@example.com");

        await SetupProfile(h, author, "თინათინი", "თბილისი", "woman");
        await SetupProfile(h, applicant, "ავთანდილი", "თბილისი", "man");

        var now = DateTimeOffset.UtcNow;

        // Author creates plan
        var planRes = await Send(h, author, HttpMethod.Post, "/api/today-plans", new CreateTodayPlanRequest(
            City: "tbilisi",
            District: "ვაკე",
            Activity: "coffee",
            Title: "ყავა სტამბაში",
            Description: "მყუდრო გარემოში საუბარი",
            StartsAtUtc: now.AddHours(2),
            ExpiresAtUtc: now.AddHours(5),
            BudgetAmount: null
        ));
        Assert.Equal(HttpStatusCode.OK, planRes.StatusCode);
        var plan = (await planRes.Content.ReadFromJsonAsync<TodayPlanDetailDto>())!;

        // Applicant applies with note
        var applyRes = await Send(h, applicant, HttpMethod.Post, $"/api/today-plans/{plan.Id}/responses",
            new CreateTodayPlanResponseRequest("შემოგიერთდები სიამოვნებით!"));
        Assert.Equal(HttpStatusCode.OK, applyRes.StatusCode);
        var myResp = (await applyRes.Content.ReadFromJsonAsync<TodayPlanMyResponseDto>())!;

        // Author accepts applicant
        var acceptRes = await Send(h, author, HttpMethod.Post, $"/api/today-plans/{plan.Id}/responses/{myResp.ResponseId}/accept");
        Assert.Equal(HttpStatusCode.OK, acceptRes.StatusCode);
        var acceptResult = (await acceptRes.Content.ReadFromJsonAsync<AcceptPlanResponseResult>())!;
        Assert.NotNull(acceptResult.ConversationId);
        Assert.Equal(TodayPlanState.Matched, acceptResult.State);
        Assert.Equal(applicant.Account.Id, acceptResult.CompanionUserId);

        var convId = acceptResult.ConversationId.Value;

        // Check plan detail: ConversationId and SelectedCompanionUserId populated
        var detailRes = await Send(h, author, HttpMethod.Get, $"/api/today-plans/{plan.Id}");
        var detail = (await detailRes.Content.ReadFromJsonAsync<TodayPlanDetailDto>())!;
        Assert.Equal(TodayPlanState.Matched, detail.State);
        Assert.Equal(applicant.Account.Id, detail.SelectedCompanionUserId);
        Assert.Equal(convId, detail.ConversationId);

        // Check applicant's my-responses: ConversationId populated
        var myRespsRes = await Send(h, applicant, HttpMethod.Get, "/api/today-plans/my-responses");
        var myResps = (await myRespsRes.Content.ReadFromJsonAsync<TodayPlanMyResponseDto[]>())!;
        var acceptedMyResp = myResps.Single(r => r.ResponseId == myResp.ResponseId);
        Assert.Equal(TodayPlanResponseState.Accepted, acceptedMyResp.State);
        Assert.Equal(convId, acceptedMyResp.ConversationId);

        // Check chat history has intro message with plan context
        var historyRes = await Send(h, applicant, HttpMethod.Get, $"/api/conversations/{convId}/messages");
        Assert.Equal(HttpStatusCode.OK, historyRes.StatusCode);
        var history = (await historyRes.Content.ReadFromJsonAsync<HistoryPage>())!;
        Assert.Single(history.Items);
        var introMsg = history.Items[0];
        Assert.Contains("📍 [დღეს მინდა: ყავა სტამბაში]", introMsg.Text);
        Assert.Contains("შემოგიერთდები სიამოვნებით!", introMsg.Text);
        Assert.Equal(applicant.Account.Id, introMsg.SenderId);

        // Free messaging without crystal paywall: applicant sends message
        var appMsgRes = await Send(h, applicant, HttpMethod.Post, $"/api/conversations/{convId}/messages",
            new SendMessage(Guid.NewGuid(), "რომელ საათზე შევხვდეთ?"));
        Assert.Equal(HttpStatusCode.OK, appMsgRes.StatusCode);

        // Free messaging without crystal paywall: author sends message
        var authorMsgRes = await Send(h, author, HttpMethod.Post, $"/api/conversations/{convId}/messages",
            new SendMessage(Guid.NewGuid(), "7 საათზე შევხვდეთ!"));
        Assert.Equal(HttpStatusCode.OK, authorMsgRes.StatusCode);

        // Verify total 3 messages in history
        var updatedHistoryRes = await Send(h, author, HttpMethod.Get, $"/api/conversations/{convId}/messages");
        var updatedHistory = (await updatedHistoryRes.Content.ReadFromJsonAsync<HistoryPage>())!;
        Assert.Equal(3, updatedHistory.Items.Length);

        // Repeated accept is rejected with 409
        var repeatAcceptRes = await Send(h, author, HttpMethod.Post, $"/api/today-plans/{plan.Id}/responses/{myResp.ResponseId}/accept");
        Assert.Equal(HttpStatusCode.Conflict, repeatAcceptRes.StatusCode);
    }

    [Fact]
    public async Task Cancelling_matched_plan_preserves_chat_history()
    {
        await using var h = await AuthHarness.Create();
        var author = await h.Account("plan_cancel_author@example.com");
        var applicant = await h.Account("plan_cancel_applicant@example.com");

        await SetupProfile(h, author, "ლელა", "თბილისი", "woman");
        await SetupProfile(h, applicant, "ტარიელი", "თბილისი", "man");

        var now = DateTimeOffset.UtcNow;

        var planRes = await Send(h, author, HttpMethod.Post, "/api/today-plans", new CreateTodayPlanRequest(
            City: "tbilisi", District: null, Activity: "cinema", Title: "კინოში წასვლა", Description: null,
            StartsAtUtc: now.AddHours(2), ExpiresAtUtc: now.AddHours(5), BudgetAmount: null));
        var plan = (await planRes.Content.ReadFromJsonAsync<TodayPlanDetailDto>())!;

        var applyRes = await Send(h, applicant, HttpMethod.Post, $"/api/today-plans/{plan.Id}/responses",
            new CreateTodayPlanResponseRequest("კინო მიყვარს"));
        var myResp = (await applyRes.Content.ReadFromJsonAsync<TodayPlanMyResponseDto>())!;

        var acceptRes = await Send(h, author, HttpMethod.Post, $"/api/today-plans/{plan.Id}/responses/{myResp.ResponseId}/accept");
        var acceptResult = (await acceptRes.Content.ReadFromJsonAsync<AcceptPlanResponseResult>())!;
        var convId = acceptResult.ConversationId!.Value;

        // Author cancels the plan
        var cancelRes = await Send(h, author, HttpMethod.Post, $"/api/today-plans/{plan.Id}/cancel");
        Assert.Equal(HttpStatusCode.OK, cancelRes.StatusCode);
        var cancelledDetail = (await cancelRes.Content.ReadFromJsonAsync<TodayPlanDetailDto>())!;
        Assert.Equal(TodayPlanState.Cancelled, cancelledDetail.State);

        // Chat history is preserved
        var historyRes = await Send(h, applicant, HttpMethod.Get, $"/api/conversations/{convId}/messages");
        Assert.Equal(HttpStatusCode.OK, historyRes.StatusCode);
        var history = (await historyRes.Content.ReadFromJsonAsync<HistoryPage>())!;
        Assert.Single(history.Items);
    }

    [Fact]
    public async Task Expired_plans_and_pending_responses_are_processed_by_expiration_job()
    {
        await using var h = await AuthHarness.Create();
        var author = await h.Account("exp_author@example.com");
        var applicant1 = await h.Account("exp_app1@example.com");
        var applicant2 = await h.Account("exp_app2@example.com");

        await SetupProfile(h, author, "ელენე", "თბილისი", "woman");
        await SetupProfile(h, applicant1, "გიორგი", "თბილისი", "man");
        await SetupProfile(h, applicant2, "დავითი", "თბილისი", "man");

        // Subscribe author to Premium so they can have multiple active plans
        await Send(h, author, HttpMethod.Post, "/api/premium/subscribe",
            new Dating.Api.Features.Premium.SubscribePackageRequest("one_month", "test"));

        var now = DateTimeOffset.UtcNow;

        // Plan 1: will remain Open with a Pending response
        var p1Res = await Send(h, author, HttpMethod.Post, "/api/today-plans", new CreateTodayPlanRequest(
            City: "tbilisi", District: null, Activity: "coffee", Title: "ყავა დილით", Description: null,
            StartsAtUtc: now.AddHours(2), ExpiresAtUtc: now.AddHours(4), BudgetAmount: null));
        var plan1 = (await p1Res.Content.ReadFromJsonAsync<TodayPlanDetailDto>())!;

        var app1Res = await Send(h, applicant1, HttpMethod.Post, $"/api/today-plans/{plan1.Id}/responses",
            new CreateTodayPlanResponseRequest("მოვალ"));
        Assert.Equal(HttpStatusCode.OK, app1Res.StatusCode);

        // Plan 2: will be Matched with applicant2
        var p2Res = await Send(h, author, HttpMethod.Post, "/api/today-plans", new CreateTodayPlanRequest(
            City: "tbilisi", District: null, Activity: "walk", Title: "გასეირნება პარკში", Description: null,
            StartsAtUtc: now.AddHours(2), ExpiresAtUtc: now.AddHours(5), BudgetAmount: null));
        var plan2 = (await p2Res.Content.ReadFromJsonAsync<TodayPlanDetailDto>())!;

        var app2Res = await Send(h, applicant2, HttpMethod.Post, $"/api/today-plans/{plan2.Id}/responses",
            new CreateTodayPlanResponseRequest("ვისეირნოთ"));
        var app2Dto = (await app2Res.Content.ReadFromJsonAsync<TodayPlanMyResponseDto>())!;

        var acceptRes = await Send(h, author, HttpMethod.Post, $"/api/today-plans/{plan2.Id}/responses/{app2Dto.ResponseId}/accept");
        Assert.Equal(HttpStatusCode.OK, acceptRes.StatusCode);
        var acceptDto = (await acceptRes.Content.ReadFromJsonAsync<AcceptPlanResponseResult>())!;
        var convId = acceptDto.ConversationId!.Value;

        // Manually adjust ExpiresAtUtc to 10 minutes ago
        await h.Db(async db =>
        {
            var plans = await db.Set<TodayPlan>().Where(p => p.Id == plan1.Id || p.Id == plan2.Id).ToListAsync();
            foreach (var p in plans) p.ExpiresAtUtc = now.AddMinutes(-10);
            await db.SaveChangesAsync();
        });

        // Run background expiration job
        using (var scope = h.Factory.Services.CreateScope())
        {
            var service = scope.ServiceProvider.GetRequiredService<TodayPlanService>();
            var processed = await service.ProcessExpiredPlansAsync();
            Assert.Equal(2, processed);
        }

        // Plan 1 detail: Expired
        var d1Res = await Send(h, author, HttpMethod.Get, $"/api/today-plans/{plan1.Id}");
        var d1 = (await d1Res.Content.ReadFromJsonAsync<TodayPlanDetailDto>())!;
        Assert.Equal(TodayPlanState.Expired, d1.State);

        // Applicant 1 responses: Closed
        var r1Res = await Send(h, applicant1, HttpMethod.Get, "/api/today-plans/my-responses");
        var r1List = (await r1Res.Content.ReadFromJsonAsync<TodayPlanMyResponseDto[]>())!;
        var r1 = r1List.Single(r => r.PlanId == plan1.Id);
        Assert.Equal(TodayPlanResponseState.Closed, r1.State);
        Assert.Equal(TodayPlanState.Expired, r1.PlanState);

        // Plan 2 detail: Expired, but SelectedCompanionUserId and ConversationId intact
        var d2Res = await Send(h, author, HttpMethod.Get, $"/api/today-plans/{plan2.Id}");
        var d2 = (await d2Res.Content.ReadFromJsonAsync<TodayPlanDetailDto>())!;
        Assert.Equal(TodayPlanState.Expired, d2.State);
        Assert.Equal(applicant2.Account.Id, d2.SelectedCompanionUserId);
        Assert.Equal(convId, d2.ConversationId);

        // Messaging in conversation still works freely
        var msgRes = await Send(h, applicant2, HttpMethod.Post, $"/api/conversations/{convId}/messages",
            new SendMessage(Guid.NewGuid(), "გეგმა დასრულდა, მაგრამ საუბარი გრძელდება!"));
        Assert.Equal(HttpStatusCode.OK, msgRes.StatusCode);
    }

    [Fact]
    public async Task Realtime_api_guard_prevents_actions_and_returns_expired_state_before_background_job_runs()
    {
        await using var h = await AuthHarness.Create();
        var author = await h.Account("rt_author@example.com");
        var applicant = await h.Account("rt_app@example.com");
        var lateApplicant = await h.Account("rt_late@example.com");

        await SetupProfile(h, author, "მარიამი", "თბილისი", "woman");
        await SetupProfile(h, applicant, "ნიკა", "თბილისი", "man");
        await SetupProfile(h, lateApplicant, "სანდრო", "თბილისი", "man");

        var now = DateTimeOffset.UtcNow;
        var pRes = await Send(h, author, HttpMethod.Post, "/api/today-plans", new CreateTodayPlanRequest(
            City: "tbilisi", District: null, Activity: "cinema", Title: "ფილმი რუსთაველზე", Description: null,
            StartsAtUtc: now.AddHours(2), ExpiresAtUtc: now.AddHours(4), BudgetAmount: null));
        var plan = (await pRes.Content.ReadFromJsonAsync<TodayPlanDetailDto>())!;

        var applyRes = await Send(h, applicant, HttpMethod.Post, $"/api/today-plans/{plan.Id}/responses",
            new CreateTodayPlanResponseRequest("კინო მიყვარს"));
        var appResp = (await applyRes.Content.ReadFromJsonAsync<TodayPlanMyResponseDto>())!;

        // Artificially expire plan in DB, but DO NOT run background worker
        await h.Db(async db =>
        {
            var p = await db.Set<TodayPlan>().SingleAsync(x => x.Id == plan.Id);
            p.ExpiresAtUtc = now.AddMinutes(-5);
            await db.SaveChangesAsync();
        });

        // 1. Late applicant tries to apply -> 400 BadRequest (plan_not_open)
        var lateRes = await Send(h, lateApplicant, HttpMethod.Post, $"/api/today-plans/{plan.Id}/responses",
            new CreateTodayPlanResponseRequest("დამაგვიანდა"));
        Assert.Equal(HttpStatusCode.BadRequest, lateRes.StatusCode);

        // 2. Author tries to accept applicant -> 400 BadRequest (plan_expired)
        var acceptRes = await Send(h, author, HttpMethod.Post, $"/api/today-plans/{plan.Id}/responses/{appResp.ResponseId}/accept");
        Assert.Equal(HttpStatusCode.BadRequest, acceptRes.StatusCode);

        // 3. Author tries to cancel plan -> 400 BadRequest (plan_already_expired)
        var cancelRes = await Send(h, author, HttpMethod.Post, $"/api/today-plans/{plan.Id}/cancel");
        Assert.Equal(HttpStatusCode.BadRequest, cancelRes.StatusCode);

        // 4. Applicant tries to withdraw -> 400 BadRequest (cannot_withdraw)
        var withdrawRes = await Send(h, applicant, HttpMethod.Post, $"/api/today-plans/{plan.Id}/responses/{appResp.ResponseId}/withdraw");
        Assert.Equal(HttpStatusCode.BadRequest, withdrawRes.StatusCode);

        // 5. Read endpoints reflect Expired and Closed in real time
        var detailRes = await Send(h, author, HttpMethod.Get, $"/api/today-plans/{plan.Id}");
        var detail = (await detailRes.Content.ReadFromJsonAsync<TodayPlanDetailDto>())!;
        Assert.Equal(TodayPlanState.Expired, detail.State);

        var myPlansRes = await Send(h, author, HttpMethod.Get, "/api/today-plans/my");
        var myPlans = (await myPlansRes.Content.ReadFromJsonAsync<TodayPlanSummaryDto[]>())!;
        Assert.Equal(TodayPlanState.Expired, myPlans.Single(p => p.Id == plan.Id).State);

        var myRespsRes = await Send(h, applicant, HttpMethod.Get, "/api/today-plans/my-responses");
        var myResps = (await myRespsRes.Content.ReadFromJsonAsync<TodayPlanMyResponseDto[]>())!;
        var r = myResps.Single(x => x.PlanId == plan.Id);
        Assert.Equal(TodayPlanState.Expired, r.PlanState);
        Assert.Equal(TodayPlanResponseState.Closed, r.State);
    }

    [Fact]
    public async Task Concurrent_accept_attempts_only_one_succeeds_other_fails()
    {
        await using var h = await AuthHarness.Create();
        var author = await h.Account("concur_accept_author@example.com");
        var applicant1 = await h.Account("concur_accept_app1@example.com");
        var applicant2 = await h.Account("concur_accept_app2@example.com");

        await SetupProfile(h, author, "სალომე", "თბილისი", "woman");
        await SetupProfile(h, applicant1, "ოთარი", "თბილისი", "man");
        await SetupProfile(h, applicant2, "ბექა", "თბილისი", "man");

        var now = DateTimeOffset.UtcNow;
        var pRes = await Send(h, author, HttpMethod.Post, "/api/today-plans", new CreateTodayPlanRequest(
            City: "tbilisi", District: null, Activity: "food", Title: "სადილი ერთად", Description: null,
            StartsAtUtc: now.AddHours(2), ExpiresAtUtc: now.AddHours(5), BudgetAmount: null));
        var plan = (await pRes.Content.ReadFromJsonAsync<TodayPlanDetailDto>())!;

        var app1Res = await Send(h, applicant1, HttpMethod.Post, $"/api/today-plans/{plan.Id}/responses", new CreateTodayPlanResponseRequest("ოთარი"));
        var app1Dto = (await app1Res.Content.ReadFromJsonAsync<TodayPlanMyResponseDto>())!;

        var app2Res = await Send(h, applicant2, HttpMethod.Post, $"/api/today-plans/{plan.Id}/responses", new CreateTodayPlanResponseRequest("ბექა"));
        var app2Dto = (await app2Res.Content.ReadFromJsonAsync<TodayPlanMyResponseDto>())!;

        // Two simultaneous accept calls from author
        var task1 = Send(h, author, HttpMethod.Post, $"/api/today-plans/{plan.Id}/responses/{app1Dto.ResponseId}/accept");
        var task2 = Send(h, author, HttpMethod.Post, $"/api/today-plans/{plan.Id}/responses/{app2Dto.ResponseId}/accept");

        var responses = await Task.WhenAll(task1, task2);
        var successCount = responses.Count(r => r.StatusCode == HttpStatusCode.OK);
        var conflictCount = responses.Count(r => r.StatusCode == HttpStatusCode.Conflict);

        Assert.Equal(1, successCount);
        Assert.Equal(1, conflictCount);

        // Exactly one companion is selected, the other response is Closed
        var applicantsRes = await Send(h, author, HttpMethod.Get, $"/api/today-plans/{plan.Id}/applicants");
        var applicants = (await applicantsRes.Content.ReadFromJsonAsync<TodayPlanApplicantDto[]>())!;
        Assert.Equal(1, applicants.Count(a => a.State == TodayPlanResponseState.Accepted));
        Assert.Equal(1, applicants.Count(a => a.State == TodayPlanResponseState.Closed));
    }

    [Fact]
    public async Task Unauthorized_users_cannot_access_applicants_or_manipulate_others_plans()
    {
        await using var h = await AuthHarness.Create();
        var author = await h.Account("sec_author@example.com");
        var applicant = await h.Account("sec_app@example.com");
        var intruder = await h.Account("sec_intruder@example.com");

        await SetupProfile(h, author, "ნატა", "თბილისი", "woman");
        await SetupProfile(h, applicant, "ირაკლი", "თბილისი", "man");
        await SetupProfile(h, intruder, "უცხო", "თბილისი", "man");

        var now = DateTimeOffset.UtcNow;
        var pRes = await Send(h, author, HttpMethod.Post, "/api/today-plans", new CreateTodayPlanRequest(
            City: "tbilisi", District: null, Activity: "coffee", Title: "ყავა", Description: null,
            StartsAtUtc: now.AddHours(2), ExpiresAtUtc: now.AddHours(5), BudgetAmount: null));
        var plan = (await pRes.Content.ReadFromJsonAsync<TodayPlanDetailDto>())!;

        var appRes = await Send(h, applicant, HttpMethod.Post, $"/api/today-plans/{plan.Id}/responses", new CreateTodayPlanResponseRequest("მსურს"));
        var appDto = (await appRes.Content.ReadFromJsonAsync<TodayPlanMyResponseDto>())!;

        // 1. Intruder cannot view applicants
        var intrudeApplicants = await Send(h, intruder, HttpMethod.Get, $"/api/today-plans/{plan.Id}/applicants");
        Assert.Equal(HttpStatusCode.Forbidden, intrudeApplicants.StatusCode);

        // 2. Intruder cannot accept applicant
        var intrudeAccept = await Send(h, intruder, HttpMethod.Post, $"/api/today-plans/{plan.Id}/responses/{appDto.ResponseId}/accept");
        Assert.Equal(HttpStatusCode.Forbidden, intrudeAccept.StatusCode);

        // 3. Intruder cannot reject applicant
        var intrudeReject = await Send(h, intruder, HttpMethod.Post, $"/api/today-plans/{plan.Id}/responses/{appDto.ResponseId}/reject");
        Assert.Equal(HttpStatusCode.Forbidden, intrudeReject.StatusCode);

        // 4. Intruder cannot withdraw applicant's response
        var intrudeWithdraw = await Send(h, intruder, HttpMethod.Post, $"/api/today-plans/{plan.Id}/responses/{appDto.ResponseId}/withdraw");
        Assert.Equal(HttpStatusCode.Forbidden, intrudeWithdraw.StatusCode);

        // 5. Intruder cannot cancel author's plan
        var intrudeCancel = await Send(h, intruder, HttpMethod.Post, $"/api/today-plans/{plan.Id}/cancel");
        Assert.Equal(HttpStatusCode.Forbidden, intrudeCancel.StatusCode);
    }

    [Fact]
    public async Task Premium_expiration_preserves_active_plans_but_blocks_new_creation()
    {
        await using var h = await AuthHarness.Create();
        var user = await h.Account("prem_exp_user@example.com");
        await SetupProfile(h, user, "ქეთევანი", "თბილისი", "woman");

        // Subscribe to Premium
        await Send(h, user, HttpMethod.Post, "/api/premium/subscribe",
            new Dating.Api.Features.Premium.SubscribePackageRequest("one_month", "test"));

        var now = DateTimeOffset.UtcNow;

        // Create 2 active plans (allowed under Premium limit of 3)
        var p1Res = await Send(h, user, HttpMethod.Post, "/api/today-plans", new CreateTodayPlanRequest(
            City: "tbilisi", District: null, Activity: "coffee", Title: "გეგმა 1", Description: null,
            StartsAtUtc: now.AddHours(2), ExpiresAtUtc: now.AddHours(5), BudgetAmount: null));
        Assert.Equal(HttpStatusCode.OK, p1Res.StatusCode);

        var p2Res = await Send(h, user, HttpMethod.Post, "/api/today-plans", new CreateTodayPlanRequest(
            City: "tbilisi", District: null, Activity: "walk", Title: "გეგმა 2", Description: null,
            StartsAtUtc: now.AddHours(3), ExpiresAtUtc: now.AddHours(6), BudgetAmount: null));
        Assert.Equal(HttpStatusCode.OK, p2Res.StatusCode);

        // Premium expires in DB
        await h.Db(async db =>
        {
            var sub = await db.Set<Dating.Api.Features.Premium.UserSubscription>()
                .FirstOrDefaultAsync(s => s.UserId == user.Account.Id);
            if (sub != null)
            {
                sub.ExpiresAtUtc = DateTimeOffset.UtcNow.AddMinutes(-5);
                await db.SaveChangesAsync();
            }
        });

        // Check limits: user is now Free, has 2 active plans (> Free limit of 1), cannot create new plan
        var limitsRes = await Send(h, user, HttpMethod.Get, "/api/today-plans/limits");
        var limits = (await limitsRes.Content.ReadFromJsonAsync<TodayPlanLimitsDto>())!;
        Assert.False(limits.HasPremium);
        Assert.Equal(2, limits.ActivePlansCount);
        Assert.Equal(1, limits.ActivePlansLimit);
        Assert.False(limits.CanCreatePlan);

        // Existing 2 plans are still active and visible
        var myPlansRes = await Send(h, user, HttpMethod.Get, "/api/today-plans/my");
        var myPlans = (await myPlansRes.Content.ReadFromJsonAsync<TodayPlanSummaryDto[]>())!;
        Assert.Equal(2, myPlans.Length);

        // Creating a 3rd plan is rejected
        var p3Res = await Send(h, user, HttpMethod.Post, "/api/today-plans", new CreateTodayPlanRequest(
            City: "tbilisi", District: null, Activity: "cinema", Title: "გეგმა 3", Description: null,
            StartsAtUtc: now.AddHours(4), ExpiresAtUtc: now.AddHours(7), BudgetAmount: null));
        Assert.Equal(HttpStatusCode.Forbidden, p3Res.StatusCode);
    }
}


