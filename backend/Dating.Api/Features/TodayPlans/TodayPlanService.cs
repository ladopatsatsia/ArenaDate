using Dating.Api.Features.Auth;
using Dating.Api.Features.Chat;
using Dating.Api.Features.Discovery;
using Dating.Api.Features.Matching;
using Dating.Api.Features.Notifications;
using Dating.Api.Features.Premium;
using Dating.Api.Features.Profiles;
using Dating.Api.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Dating.Api.Features.TodayPlans;

public sealed class TodayPlanService(
    AppDbContext db,
    IConfiguration config,
    TimeProvider clock,
    IPremiumService premiumService,
    ILogger<TodayPlanService> logger,
    ITelegramNotificationService? telegramNotifications = null,
    PushQueue? push = null
)
{
    private static readonly TimeZoneInfo TbilisiTz = GetTbilisiTimeZone();

    private static TimeZoneInfo GetTbilisiTimeZone()
    {
        try
        {
            return TimeZoneInfo.FindSystemTimeZoneById("Asia/Tbilisi");
        }
        catch
        {
            try
            {
                return TimeZoneInfo.FindSystemTimeZoneById("Georgian Standard Time");
            }
            catch
            {
                return TimeZoneInfo.CreateCustomTimeZone("Asia/Tbilisi", TimeSpan.FromHours(4), "Tbilisi", "Tbilisi");
            }
        }
    }

    private int MaxPlanningHorizonHours
    {
        get
        {
            var val = config["TodayPlans:MaxPlanningHorizonHours"];
            return int.TryParse(val, out var hours) && hours > 0 ? hours : 24 * 30; // 30 days planning horizon
        }
    }

    public int FreeActivePlansLimit
    {
        get
        {
            var val = config["TodayPlans:FreeActivePlansLimit"];
            return int.TryParse(val, out var lim) && lim > 0 ? lim : 1;
        }
    }

    public int PremiumActivePlansLimit
    {
        get
        {
            var val = config["TodayPlans:PremiumActivePlansLimit"];
            return int.TryParse(val, out var lim) && lim > 0 ? lim : 3;
        }
    }

    public int FreeDailyResponsesLimit
    {
        get
        {
            var val = config["TodayPlans:FreeDailyResponsesLimit"];
            return int.TryParse(val, out var lim) && lim > 0 ? lim : 3;
        }
    }

    public int PremiumDailyResponsesLimit
    {
        get
        {
            var val = config["TodayPlans:PremiumDailyResponsesLimit"];
            return int.TryParse(val, out var lim) && lim > 0 ? lim : 10;
        }
    }

    public async Task<TodayPlanLimitsDto> GetLimitsAsync(Guid callerUserId, CancellationToken ct = default)
    {
        var now = clock.GetUtcNow();
        var isPremium = await premiumService.HasActivePremiumAsync(callerUserId, ct);

        var activeLimit = isPremium ? PremiumActivePlansLimit : FreeActivePlansLimit;
        var dailyLimit = isPremium ? PremiumDailyResponsesLimit : FreeDailyResponsesLimit;

        var activeCount = await db.Set<TodayPlan>().AsNoTracking()
            .CountAsync(p => p.AuthorUserId == callerUserId
                && (p.State == TodayPlanState.Open || p.State == TodayPlanState.Matched)
                && p.ExpiresAtUtc > now, ct);

        var localNow = TimeZoneInfo.ConvertTime(now, TbilisiTz);
        var localTodayStart = TimeZoneInfo.ConvertTimeToUtc(localNow.Date, TbilisiTz);
        var localTodayEnd = TimeZoneInfo.ConvertTimeToUtc(localNow.Date.AddDays(1), TbilisiTz);

        var dailyUsed = await db.Set<TodayPlanResponse>().AsNoTracking()
            .CountAsync(r => r.ApplicantUserId == callerUserId
                && r.CreatedAtUtc >= localTodayStart
                && r.CreatedAtUtc < localTodayEnd, ct);

        var dailyRemaining = Math.Max(0, dailyLimit - dailyUsed);

        return new TodayPlanLimitsDto(
            HasPremium: isPremium,
            ActivePlansCount: activeCount,
            ActivePlansLimit: activeLimit,
            CanCreatePlan: activeCount < activeLimit,
            DailyResponsesUsed: dailyUsed,
            DailyResponsesLimit: dailyLimit,
            DailyResponsesRemaining: dailyRemaining,
            CanApply: dailyUsed < dailyLimit,
            ResetsAtUtc: localTodayEnd,
            TimeZone: "Asia/Tbilisi"
        );
    }

    public async Task<TodayPlanDetailDto> CreatePlanAsync(
        Guid callerUserId,
        CreateTodayPlanRequest request,
        CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(request.City))
            throw new AuthFailure(400, "city_required");

        if (!TodayPlanActivity.IsValid(request.Activity))
            throw new AuthFailure(400, "invalid_activity");

        var title = request.Title?.Trim() ?? "";
        if (title.Length < 2 || title.Length > 100)
            throw new AuthFailure(400, "invalid_title");

        var description = request.Description?.Trim() ?? "";
        if (description.Length > 500)
            throw new AuthFailure(400, "description_too_long");

        if (request.BudgetAmount.HasValue)
        {
            if (request.BudgetAmount.Value < 0 || request.BudgetAmount.Value > 5000)
                throw new AuthFailure(400, "invalid_budget");
        }

        var now = clock.GetUtcNow();

        if (request.StartsAtUtc < now.AddMinutes(-15))
            throw new AuthFailure(400, "start_time_in_past");

        if (request.ExpiresAtUtc <= request.StartsAtUtc)
            throw new AuthFailure(400, "invalid_time_range");

        if (request.ExpiresAtUtc < request.StartsAtUtc.AddMinutes(15))
            throw new AuthFailure(400, "duration_too_short");

        if (request.ExpiresAtUtc > now.AddHours(MaxPlanningHorizonHours))
            throw new AuthFailure(400, "planning_horizon_exceeded");

        await using var tx = await db.Database.BeginTransactionAsync(ct);

        // Serialize user's plan creations atomically using AspNetUsers row lock
        await db.Database.ExecuteSqlRawAsync(
            "SELECT \"Id\" FROM \"AspNetUsers\" WHERE \"Id\" = {0} FOR UPDATE",
            new object[] { callerUserId }, ct);

        // Limit check
        var isPremium = await premiumService.HasActivePremiumAsync(callerUserId, ct);
        var maxActivePlans = isPremium ? PremiumActivePlansLimit : FreeActivePlansLimit;

        var activePlansCount = await db.Set<TodayPlan>()
            .CountAsync(p => p.AuthorUserId == callerUserId
                && (p.State == TodayPlanState.Open || p.State == TodayPlanState.Matched)
                && p.ExpiresAtUtc > now, ct);

        if (activePlansCount >= maxActivePlans)
            throw new AuthFailure(403, "active_plans_limit_reached");

        var plan = new TodayPlan
        {
            Id = Guid.NewGuid(),
            AuthorUserId = callerUserId,
            City = request.City.Trim().ToLowerInvariant(),
            District = string.IsNullOrWhiteSpace(request.District) ? null : request.District.Trim(),
            Activity = request.Activity.Trim().ToLowerInvariant(),
            Title = title,
            Description = description,
            StartsAtUtc = request.StartsAtUtc,
            ExpiresAtUtc = request.ExpiresAtUtc,
            BudgetAmount = request.BudgetAmount,
            Currency = "GEL",
            State = TodayPlanState.Open,
            TargetParticipantsCount = Math.Clamp(request.TargetParticipantsCount, 1, 50),
            CreatedAtUtc = now,
            UpdatedAtUtc = now
        };

        db.Set<TodayPlan>().Add(plan);
        await db.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);

        logger.LogInformation("Created TodayPlan {PlanId} by user {UserId} in {City}", plan.Id, callerUserId, plan.City);

        return await GetPlanByIdAsync(callerUserId, plan.Id, ct);
    }

    public async Task<TodayPlanFeedPageDto> GetPublicPlansAsync(
        Guid callerUserId,
        string? city = null,
        string? activity = null,
        string? day = null,
        string? cursor = null,
        int limit = 20,
        CancellationToken ct = default)
    {
        var now = clock.GetUtcNow();
        var boundedLimit = Math.Clamp(limit, 1, 20);

        // Exclude blocked users bidirectionally
        var blockedUserIds = await GetBlockedUserIdsAsync(callerUserId, ct);

        var query = db.Set<TodayPlan>().AsNoTracking()
            .Where(p => p.State == TodayPlanState.Open && p.ExpiresAtUtc > now);

        if (blockedUserIds.Count > 0)
        {
            query = query.Where(p => !blockedUserIds.Contains(p.AuthorUserId));
        }

        // City filter
        if (!string.IsNullOrWhiteSpace(city) && !city.Equals("all", StringComparison.OrdinalIgnoreCase))
        {
            var cleanCity = city.Trim().ToLowerInvariant();
            query = query.Where(p => p.City.ToLower() == cleanCity);
        }

        // Activity filter
        if (!string.IsNullOrWhiteSpace(activity) && !activity.Equals("all", StringComparison.OrdinalIgnoreCase))
        {
            var cleanActivity = activity.Trim().ToLowerInvariant();
            query = query.Where(p => p.Activity.ToLower() == cleanActivity);
        }

        // Day filter in Tbilisi local time
        if (!string.IsNullOrWhiteSpace(day) && !day.Equals("all", StringComparison.OrdinalIgnoreCase))
        {
            var localNow = TimeZoneInfo.ConvertTime(now, TbilisiTz);
            var localTodayDate = localNow.Date;

            if (day.Equals("today", StringComparison.OrdinalIgnoreCase))
            {
                var todayStartUtc = TimeZoneInfo.ConvertTimeToUtc(localTodayDate, TbilisiTz);
                var todayEndUtc = TimeZoneInfo.ConvertTimeToUtc(localTodayDate.AddDays(1), TbilisiTz);
                query = query.Where(p => p.StartsAtUtc >= todayStartUtc && p.StartsAtUtc < todayEndUtc);
            }
            else if (day.Equals("tomorrow", StringComparison.OrdinalIgnoreCase))
            {
                var tomorrowStartUtc = TimeZoneInfo.ConvertTimeToUtc(localTodayDate.AddDays(1), TbilisiTz);
                var tomorrowEndUtc = TimeZoneInfo.ConvertTimeToUtc(localTodayDate.AddDays(2), TbilisiTz);
                query = query.Where(p => p.StartsAtUtc >= tomorrowStartUtc && p.StartsAtUtc < tomorrowEndUtc);
            }
            else if (day.Equals("after_tomorrow", StringComparison.OrdinalIgnoreCase))
            {
                var afterTomorrowStartUtc = TimeZoneInfo.ConvertTimeToUtc(localTodayDate.AddDays(2), TbilisiTz);
                var afterTomorrowEndUtc = TimeZoneInfo.ConvertTimeToUtc(localTodayDate.AddDays(3), TbilisiTz);
                query = query.Where(p => p.StartsAtUtc >= afterTomorrowStartUtc && p.StartsAtUtc < afterTomorrowEndUtc);
            }
            else if (DateTime.TryParseExact(day.Trim(), "yyyy-MM-dd", System.Globalization.CultureInfo.InvariantCulture, System.Globalization.DateTimeStyles.None, out var specificDate))
            {
                var specificStartUtc = TimeZoneInfo.ConvertTimeToUtc(specificDate.Date, TbilisiTz);
                var specificEndUtc = TimeZoneInfo.ConvertTimeToUtc(specificDate.Date.AddDays(1), TbilisiTz);
                query = query.Where(p => p.StartsAtUtc >= specificStartUtc && p.StartsAtUtc < specificEndUtc);
            }
        }

        var totalCount = await query.CountAsync(ct);

        // Order soonest plans first: StartsAtUtc ascending, then Id
        if (!string.IsNullOrWhiteSpace(cursor) && DateTimeOffset.TryParse(cursor, out var cursorDate))
        {
            query = query.Where(p => p.StartsAtUtc > cursorDate);
        }

        var plans = await query
            .OrderBy(p => p.StartsAtUtc)
            .ThenBy(p => p.Id)
            .Take(boundedLimit + 1)
            .ToListAsync(ct);

        var hasMore = plans.Count > boundedLimit;
        if (hasMore) plans.RemoveAt(plans.Count - 1);

        string? nextCursor = hasMore && plans.Count > 0 ? plans[^1].StartsAtUtc.ToString("O") : null;

        var authorIds = plans.Select(p => p.AuthorUserId).Distinct().ToList();
        var planIds = plans.Select(p => p.Id).ToList();

        var profiles = await GetProfileMapAsync(authorIds, ct);

        // Load responses count per plan
        var responseCounts = await db.Set<TodayPlanResponse>()
            .Where(r => planIds.Contains(r.PlanId) && r.State != TodayPlanResponseState.Withdrawn)
            .GroupBy(r => r.PlanId)
            .Select(g => new { PlanId = g.Key, Count = g.Count() })
            .ToDictionaryAsync(g => g.PlanId, g => g.Count, ct);

        // Load caller's responses for these plans
        var myResponses = await db.Set<TodayPlanResponse>()
            .Where(r => planIds.Contains(r.PlanId) && r.ApplicantUserId == callerUserId)
            .ToDictionaryAsync(r => r.PlanId, r => r, ct);

        var items = plans.Select(p =>
        {
            var prof = profiles.GetValueOrDefault(p.AuthorUserId);
            var isAuthor = p.AuthorUserId == callerUserId;
            var hasApplied = myResponses.TryGetValue(p.Id, out var myResp);

            return new TodayPlanSummaryDto(
                Id: p.Id,
                AuthorUserId: p.AuthorUserId,
                AuthorDisplayName: prof?.DisplayName ?? "მომხმარებელი",
                AuthorAge: prof?.Age ?? 25,
                AuthorCity: prof?.City ?? p.City,
                AuthorPhoto: prof?.Photo,
                City: p.City,
                District: p.District,
                Activity: p.Activity,
                Title: p.Title,
                Description: p.Description,
                StartsAtUtc: p.StartsAtUtc,
                ExpiresAtUtc: p.ExpiresAtUtc,
                BudgetAmount: p.BudgetAmount,
                Currency: p.Currency,
                State: p.State,
                ResponsesCount: responseCounts.GetValueOrDefault(p.Id, 0),
                IsAuthor: isAuthor,
                HasApplied: hasApplied,
                MyResponseState: myResp?.State,
                MyResponseId: myResp?.Id,
                CreatedAtUtc: p.CreatedAtUtc,
                TargetParticipantsCount: p.TargetParticipantsCount
            );
        }).ToArray();

        return new TodayPlanFeedPageDto(items, nextCursor, totalCount);
    }

    public async Task<TodayPlanDetailDto> GetPlanByIdAsync(Guid callerUserId, Guid planId, CancellationToken ct = default)
    {
        var plan = await db.Set<TodayPlan>().AsNoTracking()
            .SingleOrDefaultAsync(p => p.Id == planId, ct)
            ?? throw new AuthFailure(404, "plan_unavailable");

        var blockedUserIds = await GetBlockedUserIdsAsync(callerUserId, ct);
        if (blockedUserIds.Contains(plan.AuthorUserId))
            throw new AuthFailure(404, "plan_unavailable");

        var authorProfile = (await GetProfileMapAsync([plan.AuthorUserId], ct)).GetValueOrDefault(plan.AuthorUserId);

        var isAuthor = plan.AuthorUserId == callerUserId;
        var myResp = await db.Set<TodayPlanResponse>()
            .AsNoTracking()
            .FirstOrDefaultAsync(r => r.PlanId == planId && r.ApplicantUserId == callerUserId, ct);

        var responsesCount = await db.Set<TodayPlanResponse>()
            .CountAsync(r => r.PlanId == planId && r.State != TodayPlanResponseState.Withdrawn, ct);

        var now = clock.GetUtcNow();
        var isExpired = (plan.State == TodayPlanState.Open || plan.State == TodayPlanState.Matched) && plan.ExpiresAtUtc <= now;
        var effectivePlanState = isExpired ? TodayPlanState.Expired : plan.State;
        var effectiveMyResponseState = (isExpired && myResp?.State == TodayPlanResponseState.Pending)
            ? TodayPlanResponseState.Closed
            : myResp?.State;

        Guid? conversationId = null;
        var companionId = isAuthor ? plan.SelectedCompanionUserId : (myResp?.State == TodayPlanResponseState.Accepted ? plan.AuthorUserId : null);
        if (companionId.HasValue)
        {
            var (fId, sId) = PairSynchronization.Order(callerUserId, companionId.Value);
            var m = await db.Set<DatingMatch>().AsNoTracking().FirstOrDefaultAsync(x => x.FirstId == fId && x.SecondId == sId, ct);
            if (m != null)
            {
                var conv = await db.Set<Conversation>().AsNoTracking().FirstOrDefaultAsync(c => c.MatchId == m.Id, ct);
                conversationId = conv?.Id;
            }
        }

        return new TodayPlanDetailDto(
            Id: plan.Id,
            AuthorUserId: plan.AuthorUserId,
            AuthorDisplayName: authorProfile?.DisplayName ?? "მომხმარებელი",
            AuthorAge: authorProfile?.Age ?? 25,
            AuthorCity: authorProfile?.City ?? plan.City,
            AuthorPhoto: authorProfile?.Photo,
            AuthorPhotos: authorProfile?.Photos,
            AuthorBio: authorProfile?.Bio ?? "",
            City: plan.City,
            District: plan.District,
            Activity: plan.Activity,
            Title: plan.Title,
            Description: plan.Description,
            StartsAtUtc: plan.StartsAtUtc,
            ExpiresAtUtc: plan.ExpiresAtUtc,
            BudgetAmount: plan.BudgetAmount,
            Currency: plan.Currency,
            State: effectivePlanState,
            ResponsesCount: responsesCount,
            IsAuthor: isAuthor,
            HasApplied: myResp != null,
            MyResponseState: effectiveMyResponseState,
            MyResponseId: myResp?.Id,
            SelectedCompanionUserId: isAuthor || myResp?.State == TodayPlanResponseState.Accepted ? plan.SelectedCompanionUserId : null,
            MatchedAtUtc: isAuthor || myResp?.State == TodayPlanResponseState.Accepted ? plan.MatchedAtUtc : null,
            CreatedAtUtc: plan.CreatedAtUtc,
            ConversationId: conversationId,
            TargetParticipantsCount: plan.TargetParticipantsCount
        );
    }

    public async Task<TodayPlanDetailDto> CancelPlanAsync(Guid callerUserId, Guid planId, CancellationToken ct = default)
    {
        await using var tx = await db.Database.BeginTransactionAsync(ct);

        var plan = await db.Set<TodayPlan>().SingleOrDefaultAsync(p => p.Id == planId, ct)
            ?? throw new AuthFailure(404, "plan_unavailable");

        if (plan.AuthorUserId != callerUserId)
            throw new AuthFailure(403, "not_plan_author");

        if (plan.State == TodayPlanState.Cancelled)
        {
            await tx.CommitAsync(ct);
            return await GetPlanByIdAsync(callerUserId, planId, ct);
        }

        var now = clock.GetUtcNow();
        if (plan.State == TodayPlanState.Expired || plan.ExpiresAtUtc <= now)
        {
            if (plan.State != TodayPlanState.Expired)
            {
                plan.State = TodayPlanState.Expired;
                plan.UpdatedAtUtc = now;
                var pending = await db.Set<TodayPlanResponse>()
                    .Where(r => r.PlanId == planId && r.State == TodayPlanResponseState.Pending)
                    .ToListAsync(ct);
                foreach (var r in pending) r.State = TodayPlanResponseState.Closed;
                await db.SaveChangesAsync(ct);
                await tx.CommitAsync(ct);
            }
            throw new AuthFailure(400, "plan_already_expired");
        }

        var previousState = plan.State;
        var companionUserId = plan.SelectedCompanionUserId;

        plan.State = TodayPlanState.Cancelled;
        plan.CancelledAtUtc = now;
        plan.UpdatedAtUtc = now;

        // Close any pending responses
        var pendingResponses = await db.Set<TodayPlanResponse>()
            .Where(r => r.PlanId == planId && r.State == TodayPlanResponseState.Pending)
            .ToListAsync(ct);

        foreach (var r in pendingResponses)
        {
            r.State = TodayPlanResponseState.Closed;
        }

        await db.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);

        logger.LogInformation("TodayPlan {PlanId} cancelled by author {UserId}", planId, callerUserId);

        if (previousState == TodayPlanState.Matched && companionUserId.HasValue)
        {
            var authorProf = (await GetProfileMapAsync([callerUserId], ct)).GetValueOrDefault(callerUserId);
            var authorName = authorProf?.DisplayName ?? "ავტორი";
            await NotifyPlanCancelledAsync(companionUserId.Value, authorName, plan.Title);
        }

        return await GetPlanByIdAsync(callerUserId, planId, ct);
    }

    public async Task<TodayPlanSummaryDto[]> GetMyPlansAsync(Guid callerUserId, CancellationToken ct = default)
    {
        var plans = await db.Set<TodayPlan>().AsNoTracking()
            .Where(p => p.AuthorUserId == callerUserId)
            .OrderByDescending(p => p.CreatedAtUtc)
            .ToListAsync(ct);

        if (plans.Count == 0) return [];

        var planIds = plans.Select(p => p.Id).ToList();
        var prof = (await GetProfileMapAsync([callerUserId], ct)).GetValueOrDefault(callerUserId);

        var responseCounts = await db.Set<TodayPlanResponse>()
            .Where(r => planIds.Contains(r.PlanId) && r.State != TodayPlanResponseState.Withdrawn)
            .GroupBy(r => r.PlanId)
            .Select(g => new { PlanId = g.Key, Count = g.Count() })
            .ToDictionaryAsync(g => g.PlanId, g => g.Count, ct);

        var now = clock.GetUtcNow();
        return plans.Select(p =>
        {
            var isExpired = (p.State == TodayPlanState.Open || p.State == TodayPlanState.Matched) && p.ExpiresAtUtc <= now;
            var effectiveState = isExpired ? TodayPlanState.Expired : p.State;

            return new TodayPlanSummaryDto(
                Id: p.Id,
                AuthorUserId: p.AuthorUserId,
                AuthorDisplayName: prof?.DisplayName ?? "თქვენ",
                AuthorAge: prof?.Age ?? 25,
                AuthorCity: prof?.City ?? p.City,
                AuthorPhoto: prof?.Photo,
                City: p.City,
                District: p.District,
                Activity: p.Activity,
                Title: p.Title,
                Description: p.Description,
                StartsAtUtc: p.StartsAtUtc,
                ExpiresAtUtc: p.ExpiresAtUtc,
                BudgetAmount: p.BudgetAmount,
                Currency: p.Currency,
                State: effectiveState,
                ResponsesCount: responseCounts.GetValueOrDefault(p.Id, 0),
                IsAuthor: true,
                HasApplied: false,
                MyResponseState: null,
                MyResponseId: null,
                CreatedAtUtc: p.CreatedAtUtc,
                TargetParticipantsCount: p.TargetParticipantsCount
            );
        }).ToArray();
    }

    public async Task<TodayPlanMyResponseDto[]> GetMyResponsesAsync(Guid callerUserId, CancellationToken ct = default)
    {
        var responses = await db.Set<TodayPlanResponse>().AsNoTracking()
            .Include(r => r.Plan)
            .Where(r => r.ApplicantUserId == callerUserId)
            .OrderByDescending(r => r.CreatedAtUtc)
            .ToListAsync(ct);

        if (responses.Count == 0) return [];

        var authorIds = responses.Where(r => r.Plan != null).Select(r => r.Plan!.AuthorUserId).Distinct().ToList();
        var profiles = await GetProfileMapAsync(authorIds, ct);

        var acceptedAuthorIds = responses.Where(r => r.State == TodayPlanResponseState.Accepted && r.Plan != null)
            .Select(r => r.Plan!.AuthorUserId).Distinct().ToList();
        var convMap = new Dictionary<Guid, Guid>();
        foreach (var authorId in acceptedAuthorIds)
        {
            var (fId, sId) = PairSynchronization.Order(callerUserId, authorId);
            var m = await db.Set<DatingMatch>().AsNoTracking().FirstOrDefaultAsync(x => x.FirstId == fId && x.SecondId == sId, ct);
            if (m != null)
            {
                var c = await db.Set<Conversation>().AsNoTracking().FirstOrDefaultAsync(x => x.MatchId == m.Id, ct);
                if (c != null) convMap[authorId] = c.Id;
            }
        }

        var now = clock.GetUtcNow();
        return responses.Where(r => r.Plan != null).Select(r =>
        {
            var p = r.Plan!;
            var prof = profiles.GetValueOrDefault(p.AuthorUserId);
            var isPlanExpired = (p.State == TodayPlanState.Open || p.State == TodayPlanState.Matched) && p.ExpiresAtUtc <= now;
            var effectivePlanState = isPlanExpired ? TodayPlanState.Expired : p.State;
            var effectiveResponseState = (isPlanExpired && r.State == TodayPlanResponseState.Pending)
                ? TodayPlanResponseState.Closed
                : r.State;

            return new TodayPlanMyResponseDto(
                ResponseId: r.Id,
                PlanId: p.Id,
                PlanTitle: p.Title,
                PlanActivity: p.Activity,
                PlanCity: p.City,
                PlanDistrict: p.District,
                PlanStartsAtUtc: p.StartsAtUtc,
                PlanExpiresAtUtc: p.ExpiresAtUtc,
                PlanState: effectivePlanState,
                AuthorUserId: p.AuthorUserId,
                AuthorDisplayName: prof?.DisplayName ?? "ავტორი",
                AuthorPhoto: prof?.Photo,
                Message: r.Message,
                State: effectiveResponseState,
                CreatedAtUtc: r.CreatedAtUtc,
                ConversationId: r.State == TodayPlanResponseState.Accepted ? convMap.GetValueOrDefault(p.AuthorUserId) : null
            );
        }).ToArray();
    }

    public async Task<TodayPlanMyResponseDto> CreateResponseAsync(
        Guid callerUserId,
        Guid planId,
        CreateTodayPlanResponseRequest request,
        CancellationToken ct = default)
    {
        var now = clock.GetUtcNow();

        var plan = await db.Set<TodayPlan>().AsNoTracking().SingleOrDefaultAsync(p => p.Id == planId, ct)
            ?? throw new AuthFailure(404, "plan_unavailable");

        if (plan.AuthorUserId == callerUserId)
            throw new AuthFailure(400, "cannot_apply_to_own_plan");

        var blockedUserIds = await GetBlockedUserIdsAsync(callerUserId, ct);
        if (blockedUserIds.Contains(plan.AuthorUserId))
            throw new AuthFailure(404, "plan_unavailable");

        if (plan.State != TodayPlanState.Open || plan.ExpiresAtUtc <= now)
        {
            if (plan.State == TodayPlanState.Open && plan.ExpiresAtUtc <= now)
            {
                plan.State = TodayPlanState.Expired;
                plan.UpdatedAtUtc = now;
                var pending = await db.Set<TodayPlanResponse>()
                    .Where(r => r.PlanId == planId && r.State == TodayPlanResponseState.Pending)
                    .ToListAsync(ct);
                foreach (var r in pending) r.State = TodayPlanResponseState.Closed;
                await db.SaveChangesAsync(ct);
            }
            throw new AuthFailure(400, "plan_not_open");
        }

        await using var tx = await db.Database.BeginTransactionAsync(ct);

        // Serialize applicant's responses atomically using AspNetUsers row lock
        await db.Database.ExecuteSqlRawAsync(
            "SELECT \"Id\" FROM \"AspNetUsers\" WHERE \"Id\" = {0} FOR UPDATE",
            new object[] { callerUserId }, ct);

        // Check if already applied (even if withdrawn)
        var existing = await db.Set<TodayPlanResponse>()
            .FirstOrDefaultAsync(r => r.PlanId == planId && r.ApplicantUserId == callerUserId, ct);

        if (existing != null)
            throw new AuthFailure(409, "already_applied");

        // Check daily responses quota in Asia/Tbilisi timezone
        var localNow = TimeZoneInfo.ConvertTime(now, TbilisiTz);
        var localTodayStart = TimeZoneInfo.ConvertTimeToUtc(localNow.Date, TbilisiTz);
        var localTodayEnd = TimeZoneInfo.ConvertTimeToUtc(localNow.Date.AddDays(1), TbilisiTz);

        var isPremium = await premiumService.HasActivePremiumAsync(callerUserId, ct);
        var dailyLimit = isPremium ? PremiumDailyResponsesLimit : FreeDailyResponsesLimit;

        var todayResponsesCount = await db.Set<TodayPlanResponse>()
            .CountAsync(r => r.ApplicantUserId == callerUserId
                && r.CreatedAtUtc >= localTodayStart
                && r.CreatedAtUtc < localTodayEnd, ct);

        if (todayResponsesCount >= dailyLimit)
            throw new AuthFailure(429, "daily_response_limit_reached");

        var cleanMessage = request.Message?.Trim();
        if (cleanMessage != null && cleanMessage.Length > 300)
            throw new AuthFailure(400, "message_too_long");

        var response = new TodayPlanResponse
        {
            Id = Guid.NewGuid(),
            PlanId = planId,
            ApplicantUserId = callerUserId,
            Message = string.IsNullOrWhiteSpace(cleanMessage) ? null : cleanMessage,
            State = TodayPlanResponseState.Pending,
            CreatedAtUtc = now
        };

        db.Set<TodayPlanResponse>().Add(response);
        await db.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);

        logger.LogInformation("User {UserId} applied to TodayPlan {PlanId}", callerUserId, planId);

        var profMap = await GetProfileMapAsync([plan.AuthorUserId, callerUserId], ct);
        var authorProf = profMap.GetValueOrDefault(plan.AuthorUserId);
        var applicantProf = profMap.GetValueOrDefault(callerUserId);
        var applicantName = applicantProf?.DisplayName ?? "მომხმარებელი";

        await NotifyResponseCreatedAsync(plan.AuthorUserId, applicantName, plan.Title, cleanMessage);

        return new TodayPlanMyResponseDto(
            ResponseId: response.Id,
            PlanId: plan.Id,
            PlanTitle: plan.Title,
            PlanActivity: plan.Activity,
            PlanCity: plan.City,
            PlanDistrict: plan.District,
            PlanStartsAtUtc: plan.StartsAtUtc,
            PlanExpiresAtUtc: plan.ExpiresAtUtc,
            PlanState: plan.State,
            AuthorUserId: plan.AuthorUserId,
            AuthorDisplayName: authorProf?.DisplayName ?? "ავტორი",
            AuthorPhoto: authorProf?.Photo,
            Message: response.Message,
            State: response.State,
            CreatedAtUtc: response.CreatedAtUtc,
            ConversationId: null
        );
    }

    public async Task<bool> WithdrawResponseAsync(
        Guid callerUserId,
        Guid planId,
        Guid responseId,
        CancellationToken ct = default)
    {
        var response = await db.Set<TodayPlanResponse>()
            .Include(r => r.Plan)
            .SingleOrDefaultAsync(r => r.Id == responseId && r.PlanId == planId, ct)
            ?? throw new AuthFailure(404, "response_not_found");

        if (response.ApplicantUserId != callerUserId)
            throw new AuthFailure(403, "not_applicant");

        var now = clock.GetUtcNow();
        if (response.State != TodayPlanResponseState.Pending || (response.Plan != null && response.Plan.ExpiresAtUtc <= now))
            throw new AuthFailure(400, "cannot_withdraw");

        response.State = TodayPlanResponseState.Withdrawn;
        response.WithdrawnAtUtc = clock.GetUtcNow();

        await db.SaveChangesAsync(ct);
        logger.LogInformation("User {UserId} withdrew response {ResponseId} from plan {PlanId}", callerUserId, responseId, planId);

        return true;
    }

    public async Task<TodayPlanApplicantDto[]> GetApplicantsAsync(
        Guid callerUserId,
        Guid planId,
        CancellationToken ct = default)
    {
        var plan = await db.Set<TodayPlan>().AsNoTracking()
            .SingleOrDefaultAsync(p => p.Id == planId, ct)
            ?? throw new AuthFailure(404, "plan_unavailable");

        if (plan.AuthorUserId != callerUserId)
            throw new AuthFailure(403, "not_plan_author");

        var responses = await db.Set<TodayPlanResponse>().AsNoTracking()
            .Where(r => r.PlanId == planId)
            .OrderBy(r => r.CreatedAtUtc)
            .ToListAsync(ct);

        if (responses.Count == 0) return [];

        var blockedUserIds = await GetBlockedUserIdsAsync(callerUserId, ct);
        var validResponses = responses.Where(r => !blockedUserIds.Contains(r.ApplicantUserId)).ToList();

        var applicantIds = validResponses.Select(r => r.ApplicantUserId).Distinct().ToList();
        var profiles = await GetProfileMapAsync(applicantIds, ct);

        return validResponses.Select(r =>
        {
            var prof = profiles.GetValueOrDefault(r.ApplicantUserId);
            return new TodayPlanApplicantDto(
                Id: r.Id,
                ApplicantUserId: r.ApplicantUserId,
                DisplayName: prof?.DisplayName ?? "მომხმარებელი",
                Age: prof?.Age ?? 25,
                City: prof?.City ?? "",
                Photo: prof?.Photo,
                Photos: prof?.Photos,
                Bio: prof?.Bio ?? "",
                Message: r.Message,
                State: r.State,
                CreatedAtUtc: r.CreatedAtUtc
            );
        }).ToArray();
    }

    public async Task<AcceptPlanResponseResult> AcceptResponseAsync(
        Guid callerUserId,
        Guid planId,
        Guid responseId,
        CancellationToken ct = default)
    {
        await using var tx = await db.Database.BeginTransactionAsync(ct);

        // Lock plan row to prevent double-accept race conditions
        await db.Database.ExecuteSqlRawAsync(
            "SELECT \"Id\" FROM \"TodayPlans\" WHERE \"Id\" = {0} FOR UPDATE",
            new object[] { planId }, ct);

        var plan = await db.Set<TodayPlan>().SingleOrDefaultAsync(p => p.Id == planId, ct)
            ?? throw new AuthFailure(404, "plan_unavailable");

        if (plan.AuthorUserId != callerUserId)
            throw new AuthFailure(403, "not_plan_author");

        var now = clock.GetUtcNow();

        if (plan.ExpiresAtUtc <= now || plan.State == TodayPlanState.Expired)
        {
            if (plan.State == TodayPlanState.Open || plan.State == TodayPlanState.Matched)
            {
                plan.State = TodayPlanState.Expired;
                plan.UpdatedAtUtc = now;
                var pending = await db.Set<TodayPlanResponse>()
                    .Where(r => r.PlanId == planId && r.State == TodayPlanResponseState.Pending)
                    .ToListAsync(ct);
                foreach (var r in pending) r.State = TodayPlanResponseState.Closed;
                await db.SaveChangesAsync(ct);
                await tx.CommitAsync(ct);
            }
            throw new AuthFailure(400, "plan_expired");
        }

        if (plan.State != TodayPlanState.Open)
            throw new AuthFailure(409, "plan_already_matched");

        var targetResponse = await db.Set<TodayPlanResponse>()
            .SingleOrDefaultAsync(r => r.Id == responseId && r.PlanId == planId, ct)
            ?? throw new AuthFailure(404, "response_not_found");

        if (targetResponse.State != TodayPlanResponseState.Pending)
            throw new AuthFailure(400, "response_not_pending");

        // Atomically accept
        targetResponse.State = TodayPlanResponseState.Accepted;
        targetResponse.RespondedAtUtc = now;

        plan.State = TodayPlanState.Matched;
        plan.SelectedCompanionUserId = targetResponse.ApplicantUserId;
        plan.MatchedAtUtc = now;
        plan.UpdatedAtUtc = now;

        // Close all other pending responses for this plan
        var otherPending = await db.Set<TodayPlanResponse>()
            .Where(r => r.PlanId == planId && r.Id != responseId && r.State == TodayPlanResponseState.Pending)
            .ToListAsync(ct);

        foreach (var other in otherPending)
        {
            other.State = TodayPlanResponseState.Closed;
        }

        // Establish or ensure free DatingMatch & Conversation
        var (firstId, secondId) = PairSynchronization.Order(callerUserId, targetResponse.ApplicantUserId);

        var match = await db.Set<DatingMatch>()
            .SingleOrDefaultAsync(m => m.FirstId == firstId && m.SecondId == secondId, ct);

        Conversation conversation;

        if (match == null)
        {
            match = new DatingMatch
            {
                Id = Guid.NewGuid(),
                FirstId = firstId,
                SecondId = secondId,
                Active = true,
                CreatedAt = now,
                Origin = "TodayPlan",
                HasChatEntitlement = true
            };
            db.Set<DatingMatch>().Add(match);

            var conv = new Conversation
            {
                Id = Guid.NewGuid(),
                MatchId = match.Id,
                LastSequence = 0
            };
            db.Set<Conversation>().Add(conv);
            conversation = conv;
        }
        else
        {
            match.Active = true;
            match.HasChatEntitlement = true;

            var existingConv = await db.Set<Conversation>()
                .SingleOrDefaultAsync(c => c.MatchId == match.Id, ct);

            if (existingConv != null)
            {
                conversation = existingConv;
            }
            else
            {
                var newConv = new Conversation
                {
                    Id = Guid.NewGuid(),
                    MatchId = match.Id,
                    LastSequence = 0
                };
                db.Set<Conversation>().Add(newConv);
                conversation = newConv;
            }
        }

        // Intro message with plan context (idempotent via ClientMessageId = targetResponse.Id)
        var introText = !string.IsNullOrWhiteSpace(targetResponse.Message)
            ? $"📍 [დღეს მინდა: {plan.Title}]\n{targetResponse.Message}"
            : $"📍 [დღეს მინდა: {plan.Title}]";

        var alreadyHasIntro = await db.Set<ChatMessage>()
            .AnyAsync(m => m.ConversationId == conversation.Id && m.ClientMessageId == targetResponse.Id, ct);

        if (!alreadyHasIntro)
        {
            conversation.LastSequence++;
            var introMessage = new ChatMessage
            {
                Id = Guid.NewGuid(),
                ConversationId = conversation.Id,
                SenderId = targetResponse.ApplicantUserId,
                ClientMessageId = targetResponse.Id,
                Sequence = conversation.LastSequence,
                Text = introText,
                SentAt = now
            };
            db.Set<ChatMessage>().Add(introMessage);
            db.Set<ChatEvent>().Add(new ChatEvent { Id = Guid.NewGuid(), ConversationId = conversation.Id, CreatedAt = now });
        }

        if (push != null)
        {
            try
            {
                var matchEvent = new MatchEvent { Id = Guid.NewGuid(), MatchId = match.Id, CreatedAt = now };
                db.Set<MatchEvent>().Add(matchEvent);
                await push.Enqueue(matchEvent.Id, conversation.Id, firstId, "match", ct);
                await push.Enqueue(matchEvent.Id, conversation.Id, secondId, "match", ct);
            }
            catch (Exception ex)
            {
                logger.LogWarning(ex, "Failed to enqueue push notification for accepted plan {PlanId}", planId);
            }
        }

        await db.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);

        logger.LogInformation("Author {Author} accepted applicant {Applicant} for TodayPlan {PlanId}",
            callerUserId, targetResponse.ApplicantUserId, planId);

        var authorProf = (await GetProfileMapAsync([callerUserId], ct)).GetValueOrDefault(callerUserId);
        var authorName = authorProf?.DisplayName ?? "ავტორი";
        await NotifyResponseAcceptedAsync(targetResponse.ApplicantUserId, authorName, plan.Title, conversation.Id);

        return new AcceptPlanResponseResult(
            PlanId: plan.Id,
            ResponseId: targetResponse.Id,
            CompanionUserId: targetResponse.ApplicantUserId,
            State: plan.State,
            ConversationId: conversation.Id,
            MatchedAtUtc: now
        );
    }

    public async Task<bool> RejectResponseAsync(
        Guid callerUserId,
        Guid planId,
        Guid responseId,
        CancellationToken ct = default)
    {
        var plan = await db.Set<TodayPlan>().AsNoTracking()
            .SingleOrDefaultAsync(p => p.Id == planId, ct)
            ?? throw new AuthFailure(404, "plan_unavailable");

        if (plan.AuthorUserId != callerUserId)
            throw new AuthFailure(403, "not_plan_author");

        var response = await db.Set<TodayPlanResponse>()
            .SingleOrDefaultAsync(r => r.Id == responseId && r.PlanId == planId, ct)
            ?? throw new AuthFailure(404, "response_not_found");

        var now = clock.GetUtcNow();
        if (plan.ExpiresAtUtc <= now || plan.State == TodayPlanState.Expired)
            throw new AuthFailure(400, "plan_expired");

        if (response.State != TodayPlanResponseState.Pending)
            throw new AuthFailure(400, "response_not_pending");

        response.State = TodayPlanResponseState.Rejected;
        response.RespondedAtUtc = now;

        await db.SaveChangesAsync(ct);
        logger.LogInformation("Author {Author} rejected response {ResponseId} on TodayPlan {PlanId}",
            callerUserId, responseId, planId);

        return true;
    }

    public async Task<int> ProcessExpiredPlansAsync(CancellationToken ct = default)
    {
        var now = clock.GetUtcNow();
        await using var tx = await db.Database.BeginTransactionAsync(ct);

        var expiredPlans = await db.Set<TodayPlan>()
            .Where(p => (p.State == TodayPlanState.Open || p.State == TodayPlanState.Matched) && p.ExpiresAtUtc <= now)
            .Take(100)
            .ToListAsync(ct);

        if (expiredPlans.Count == 0)
        {
            await tx.RollbackAsync(ct);
            return 0;
        }

        var expiredPlanIds = expiredPlans.Select(p => p.Id).ToList();

        foreach (var p in expiredPlans)
        {
            p.State = TodayPlanState.Expired;
            p.UpdatedAtUtc = now;
        }

        var pendingResponses = await db.Set<TodayPlanResponse>()
            .Where(r => expiredPlanIds.Contains(r.PlanId) && r.State == TodayPlanResponseState.Pending)
            .ToListAsync(ct);

        foreach (var r in pendingResponses)
        {
            r.State = TodayPlanResponseState.Closed;
        }

        await db.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);

        logger.LogInformation("Processed {ExpiredCount} expired TodayPlans and closed {ClosedResponses} pending responses.",
            expiredPlans.Count, pendingResponses.Count);

        return expiredPlans.Count;
    }

    private async Task<HashSet<Guid>> GetBlockedUserIdsAsync(Guid userId, CancellationToken ct)
    {
        var blocks = await db.Set<UserBlock>().AsNoTracking()
            .Where(b => b.BlockerId == userId || b.BlockedId == userId)
            .Select(b => b.BlockerId == userId ? b.BlockedId : b.BlockerId)
            .ToListAsync(ct);

        return blocks.ToHashSet();
    }

    private sealed record InternalProfileView(
        Guid UserId,
        string DisplayName,
        int Age,
        string City,
        string Bio,
        PhotoDto? Photo,
        PhotoDto[] Photos
    );

    private async Task<Dictionary<Guid, InternalProfileView>> GetProfileMapAsync(List<Guid> userIds, CancellationToken ct)
    {
        if (userIds.Count == 0) return [];

        var profiles = await db.Set<DatingProfile>().AsNoTracking()
            .Include(p => p.User)
            .Where(p => userIds.Contains(p.UserId))
            .ToListAsync(ct);

        var photos = await db.Set<ProfilePhoto>().AsNoTracking()
            .Where(f => userIds.Contains(f.UserId) && !f.Deleted && f.State == "approved")
            .OrderBy(f => f.Position)
            .Select(f => new { f.UserId, Photo = new PhotoDto(f.Id, f.State, f.Position, f.Width, f.Height) })
            .ToListAsync(ct);

        var now = clock.GetUtcNow();
        var map = new Dictionary<Guid, InternalProfileView>();

        foreach (var p in profiles)
        {
            var userPhotos = photos.Where(f => f.UserId == p.UserId)
                .Select(f => f.Photo)
                .ToArray();

            var age = p.User != null ? ProfileRules.Age(p.User.DateOfBirth, now) : 25;

            map[p.UserId] = new InternalProfileView(
                UserId: p.UserId,
                DisplayName: p.DisplayName,
                Age: age,
                City: p.City,
                Bio: p.Bio,
                Photo: userPhotos.FirstOrDefault(),
                Photos: userPhotos
            );
        }

        return map;
    }

    private async Task NotifyResponseCreatedAsync(Guid authorUserId, string applicantName, string planTitle, string? message)
    {
        if (telegramNotifications == null) return;
        try
        {
            var msgSnippet = !string.IsNullOrWhiteSpace(message) ? $"\nშეტყობინება: \"{message}\"" : "";

            await telegramNotifications.SendToUserAsync(
                authorUserId,
                $"✨ <b>ახალი გამოხმაურება თქვენს გეგმაზე!</b>\n\n<b>{applicantName}</b> გამოეხმაურა თქვენს გეგმას: \"{planTitle}\"{msgSnippet}\nშედით აპლიკაციაში და ნახეთ მსურველი! 📋",
                buttonText: "📋 მსურველების ნახვა",
                webAppPath: "/today-plans",
                ct: CancellationToken.None
            );
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Failed to send Telegram notification for response on plan to author {AuthorId}", authorUserId);
        }
    }

    private async Task NotifyResponseAcceptedAsync(Guid applicantUserId, string authorName, string planTitle, Guid conversationId)
    {
        if (telegramNotifications == null) return;
        try
        {
            await telegramNotifications.SendToUserAsync(
                applicantUserId,
                $"🎉 <b>თქვენი მოთხოვნა მიღებულია!</b>\n\n<b>{authorName}</b>-მ მიიღო თქვენი გამოხმაურება გეგმაზე: \"{planTitle}\"!\nთქვენ გაგეხსნათ უფასო პირადი ჩატი ✨",
                buttonText: "💬 ჩატის გახსნა",
                webAppPath: "/messages",
                ct: CancellationToken.None
            );
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Failed to send Telegram notification for accepted response to applicant {ApplicantId}", applicantUserId);
        }
    }

    private async Task NotifyPlanCancelledAsync(Guid companionUserId, string authorName, string planTitle)
    {
        if (telegramNotifications == null) return;
        try
        {
            await telegramNotifications.SendToUserAsync(
                companionUserId,
                $"ℹ️ <b>გეგმა გაუქმდა</b>\n\n<b>{authorName}</b>-მ გააუქმა გეგმა: \"{planTitle}\".\nთქვენი მიმოწერის ისტორია შენარჩუნებულია.",
                buttonText: "👀 სხვა გეგმების ნახვა",
                webAppPath: "/today-plans",
                ct: CancellationToken.None
            );
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Failed to send Telegram notification for cancelled plan to companion {CompanionId}", companionUserId);
        }
    }
}

