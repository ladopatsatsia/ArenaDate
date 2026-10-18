using System.ComponentModel.DataAnnotations;
using Dating.Api.Features.Profiles;

namespace Dating.Api.Features.TodayPlans;

public static class TodayPlanState
{
    public const string Open = "Open";
    public const string Matched = "Matched";
    public const string Cancelled = "Cancelled";
    public const string Expired = "Expired";

    public static bool IsTerminal(string state) => state is Matched or Cancelled or Expired;
}

public static class TodayPlanResponseState
{
    public const string Pending = "Pending";
    public const string Accepted = "Accepted";
    public const string Rejected = "Rejected";
    public const string Withdrawn = "Withdrawn";
    public const string Closed = "Closed";
}

public static class TodayPlanActivity
{
    public const string Coffee = "coffee";
    public const string Walk = "walk";
    public const string Cinema = "cinema";
    public const string Food = "food";
    public const string Other = "other";

    public static readonly string[] All = [Coffee, Walk, Cinema, Food, Other];

    public static bool IsValid(string? activity) =>
        !string.IsNullOrWhiteSpace(activity) && All.Contains(activity.Trim().ToLowerInvariant());
}

public sealed class TodayPlan
{
    public Guid Id { get; set; }
    public Guid AuthorUserId { get; set; }
    public string City { get; set; } = "";
    public string? District { get; set; }
    public string Activity { get; set; } = TodayPlanActivity.Coffee;
    public string Title { get; set; } = "";
    public string Description { get; set; } = "";
    public DateTimeOffset StartsAtUtc { get; set; }
    public DateTimeOffset ExpiresAtUtc { get; set; }
    public decimal? BudgetAmount { get; set; }
    public string Currency { get; set; } = "GEL";
    public string State { get; set; } = TodayPlanState.Open;
    public int TargetParticipantsCount { get; set; } = 1;
    public Guid? SelectedCompanionUserId { get; set; }
    public DateTimeOffset? MatchedAtUtc { get; set; }
    public DateTimeOffset CreatedAtUtc { get; set; }
    public DateTimeOffset UpdatedAtUtc { get; set; }
    public DateTimeOffset? CancelledAtUtc { get; set; }
    public uint Version { get; set; }

    public ICollection<TodayPlanResponse> Responses { get; set; } = new List<TodayPlanResponse>();
}

public sealed class TodayPlanResponse
{
    public Guid Id { get; set; }
    public Guid PlanId { get; set; }
    public Guid ApplicantUserId { get; set; }
    public string? Message { get; set; }
    public string State { get; set; } = TodayPlanResponseState.Pending;
    public DateTimeOffset CreatedAtUtc { get; set; }
    public DateTimeOffset? RespondedAtUtc { get; set; }
    public DateTimeOffset? WithdrawnAtUtc { get; set; }

    public TodayPlan? Plan { get; set; }
}

public sealed record CreateTodayPlanRequest(
    [Required, MaxLength(60)] string City,
    [MaxLength(100)] string? District,
    [Required, MaxLength(30)] string Activity,
    [Required, MinLength(2), MaxLength(100)] string Title,
    [MaxLength(500)] string? Description,
    DateTimeOffset StartsAtUtc,
    DateTimeOffset ExpiresAtUtc,
    decimal? BudgetAmount,
    int TargetParticipantsCount = 1
);

public sealed record TodayPlanSummaryDto(
    Guid Id,
    Guid AuthorUserId,
    string AuthorDisplayName,
    int AuthorAge,
    string AuthorCity,
    PhotoDto? AuthorPhoto,
    string City,
    string? District,
    string Activity,
    string Title,
    string Description,
    DateTimeOffset StartsAtUtc,
    DateTimeOffset ExpiresAtUtc,
    decimal? BudgetAmount,
    string Currency,
    string State,
    int ResponsesCount,
    bool IsAuthor,
    bool HasApplied,
    string? MyResponseState,
    Guid? MyResponseId,
    DateTimeOffset CreatedAtUtc,
    int TargetParticipantsCount = 1
);

public sealed record TodayPlanDetailDto(
    Guid Id,
    Guid AuthorUserId,
    string AuthorDisplayName,
    int AuthorAge,
    string AuthorCity,
    PhotoDto? AuthorPhoto,
    PhotoDto[]? AuthorPhotos,
    string AuthorBio,
    string City,
    string? District,
    string Activity,
    string Title,
    string Description,
    DateTimeOffset StartsAtUtc,
    DateTimeOffset ExpiresAtUtc,
    decimal? BudgetAmount,
    string Currency,
    string State,
    int ResponsesCount,
    bool IsAuthor,
    bool HasApplied,
    string? MyResponseState,
    Guid? MyResponseId,
    Guid? SelectedCompanionUserId,
    DateTimeOffset? MatchedAtUtc,
    DateTimeOffset CreatedAtUtc,
    Guid? ConversationId = null,
    int TargetParticipantsCount = 1
);

public sealed record TodayPlanFeedPageDto(
    TodayPlanSummaryDto[] Items,
    string? NextCursor,
    int TotalCount
);

public sealed record CreateTodayPlanResponseRequest(
    [MaxLength(300)] string? Message
);

public sealed record TodayPlanApplicantDto(
    Guid Id,
    Guid ApplicantUserId,
    string DisplayName,
    int Age,
    string City,
    PhotoDto? Photo,
    PhotoDto[]? Photos,
    string Bio,
    string? Message,
    string State,
    DateTimeOffset CreatedAtUtc
);

public sealed record TodayPlanMyResponseDto(
    Guid ResponseId,
    Guid PlanId,
    string PlanTitle,
    string PlanActivity,
    string PlanCity,
    string? PlanDistrict,
    DateTimeOffset PlanStartsAtUtc,
    DateTimeOffset PlanExpiresAtUtc,
    string PlanState,
    Guid AuthorUserId,
    string AuthorDisplayName,
    PhotoDto? AuthorPhoto,
    string? Message,
    string State,
    DateTimeOffset CreatedAtUtc,
    Guid? ConversationId = null
);

public sealed record AcceptPlanResponseResult(
    Guid PlanId,
    Guid ResponseId,
    Guid CompanionUserId,
    string State,
    Guid? ConversationId,
    DateTimeOffset MatchedAtUtc
);

public sealed record TodayPlanLimitsDto(
    bool HasPremium,
    int ActivePlansCount,
    int ActivePlansLimit,
    bool CanCreatePlan,
    int DailyResponsesUsed,
    int DailyResponsesLimit,
    int DailyResponsesRemaining,
    bool CanApply,
    DateTimeOffset ResetsAtUtc,
    string TimeZone
);
