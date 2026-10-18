using Dating.Api.Features.Auth;

namespace Dating.Api.Features.Premium;

public sealed class UserSubscription
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public AppUser? User { get; set; }
    public string PackageId { get; set; } = "";
    public decimal PriceAmount { get; set; }
    public string Currency { get; set; } = "GEL";
    public DateTimeOffset StartedAtUtc { get; set; }
    public DateTimeOffset? ExpiresAtUtc { get; set; }
    public bool IsActive { get; set; } = true;
    public string Platform { get; set; } = "Mobile";
    public string? TransactionId { get; set; }
    public DateTimeOffset CreatedAtUtc { get; set; }
}

public sealed record PremiumPackageDto(
    string Id,
    string Name,
    string Description,
    int? DurationDays,
    decimal PriceAmount,
    string Currency,
    string PriceDisplay,
    string? Badge = null,
    bool IsPopular = false
);

public sealed record PremiumStatusDto(
    bool HasPremium,
    string? ActivePackageId,
    DateTimeOffset? ExpiresAtUtc,
    bool IsLifetime,
    PremiumPackageDto[] Packages
);

public sealed record SubscribePackageRequest(
    string PackageId,
    string? Platform = "mobile",
    string? TransactionId = null,
    string? IdempotencyKey = null
);

public sealed record SubscribeResultDto(
    bool Success,
    string Message,
    PremiumStatusDto Status
);
