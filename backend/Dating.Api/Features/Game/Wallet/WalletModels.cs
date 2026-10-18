using System.ComponentModel.DataAnnotations;
using Dating.Api.Features.Auth;
using Dating.Api.Features.Profiles;

namespace Dating.Api.Features.Game.Wallet;

public sealed class UserWallet
{
    public Guid UserId { get; set; }
    public AppUser? User { get; set; }
    public int Balance { get; set; }
    public int OutstandingDebt { get; set; } = 0;
    public DateTimeOffset UpdatedAtUtc { get; set; }
    public uint Version { get; set; }
}

public sealed class CrystalTransaction
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public AppUser? User { get; set; }
    public int Amount { get; set; }
    public int BalanceAfter { get; set; }
    public string Type { get; set; } = "";
    public string? ReferenceId { get; set; }
    public string IdempotencyKey { get; set; } = "";
    public string? Description { get; set; }
    public DateTimeOffset CreatedAtUtc { get; set; }
}

public sealed class GameProfileUnlock
{
    public Guid Id { get; set; }
    public Guid ViewerUserId { get; set; }
    public AppUser? ViewerUser { get; set; }
    public Guid TargetUserId { get; set; }
    public AppUser? TargetUser { get; set; }
    public int Cost { get; set; } = 25;
    public Guid TransactionId { get; set; }
    public CrystalTransaction? Transaction { get; set; }
    public DateTimeOffset CreatedAtUtc { get; set; }
}

public sealed class GameProfileViewNotice
{
    public Guid Id { get; set; }
    public Guid TargetUserId { get; set; }
    public AppUser? TargetUser { get; set; }
    public Guid ViewerUserId { get; set; }
    public string ViewerDisplayName { get; set; } = "";
    public DateTimeOffset CreatedAtUtc { get; set; }
    public bool Seen { get; set; } = false;
}

public sealed class GameGift
{
    public Guid Id { get; set; }
    public Guid SenderUserId { get; set; }
    public AppUser? SenderUser { get; set; }
    public Guid RecipientUserId { get; set; }
    public AppUser? RecipientUser { get; set; }
    public string GiftId { get; set; } = "";
    public string GiftName { get; set; } = "";
    public string GiftIcon { get; set; } = "";
    public int CrystalCost { get; set; }
    public Guid? RoomId { get; set; }
    public Guid TransactionId { get; set; }
    public CrystalTransaction? Transaction { get; set; }
    public DateTimeOffset CreatedAtUtc { get; set; }
}

public sealed class StorePurchase
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public AppUser? User { get; set; }
    public string Platform { get; set; } = "";
    public string ProductId { get; set; } = "";
    public string TransactionId { get; set; } = "";
    public string PurchaseToken { get; set; } = "";
    public string Status { get; set; } = "Credited";
    public int Amount { get; set; }
    public string? PriceCurrency { get; set; }
    public decimal? PriceAmount { get; set; }
    public string Environment { get; set; } = "Production";
    public DateTimeOffset CreatedAtUtc { get; set; }
    public DateTimeOffset? RefundedAtUtc { get; set; }
    public string? RefundReason { get; set; }
}

public sealed record WalletBalanceDto(
    int Balance,
    int OutstandingDebt,
    CrystalTransactionDto[] RecentTransactions
);

public sealed record CrystalTransactionDto(
    Guid Id,
    int Amount,
    int BalanceAfter,
    string Type,
    string? ReferenceId,
    string? Description,
    DateTimeOffset CreatedAtUtc
);

public sealed record DevGrantRequest(
    [Range(1, 10000)] int Amount,
    [Required, StringLength(64, MinimumLength = 1)] string IdempotencyKey
);

public sealed record UnlockProfileRequest(
    [Required, StringLength(64, MinimumLength = 1)] string IdempotencyKey
);

public sealed record UnlockProfileResult(
    bool Unlocked,
    int Debited,
    int Balance,
    bool AlreadyUnlocked,
    string Message,
    GameProfileDto? Profile
);

public sealed record UnlockMatchConversationRequest(
    [Required, StringLength(64, MinimumLength = 1)] string IdempotencyKey
);

public sealed record UnlockMatchConversationResult(
    bool Unlocked,
    int Debited,
    int Balance,
    bool AlreadyOpen,
    Guid MatchId,
    Guid ConversationId,
    string Message
);

public sealed record GameProfileDto(
    Guid UserId,
    string DisplayName,
    int Age,
    string City,
    string Bio,
    string Gender,
    string RelationshipGoal,
    string[] Interests,
    PhotoDto[] Photos,
    bool IsFullAccess,
    int UnlockPrice = 25,
    int? KissesReceivedCount = null,
    int? GiftsReceivedCount = null
);

public sealed record GiftCatalogItemDto(
    string Id,
    string Name,
    string Icon,
    int Price
);

public sealed record SendGiftRequest(
    Guid RecipientUserId,
    [Required, StringLength(50)] string GiftId,
    Guid? RoomId,
    [Required, StringLength(64, MinimumLength = 1)] string IdempotencyKey
);

public sealed record SendGiftResult(
    bool Success,
    Guid GiftRecordId,
    string GiftId,
    string GiftName,
    string GiftIcon,
    int CrystalCost,
    int Balance,
    string RecipientDisplayName,
    string Message
);

public sealed record GiftItemDto(
    Guid Id,
    Guid OtherUserId,
    string OtherDisplayName,
    PhotoDto? OtherPhoto,
    string GiftId,
    string GiftName,
    string GiftIcon,
    int CrystalCost,
    DateTimeOffset CreatedAtUtc
);

public sealed record UserGiftsDto(
    GiftItemDto[] ReceivedGifts,
    GiftItemDto[] SentGifts,
    int TotalReceivedCount,
    int TotalSentCount,
    int TotalReceivedCrystalsValue
);

public sealed record GameProfileViewNoticeDto(
    Guid Id,
    Guid ViewerUserId,
    string ViewerDisplayName,
    DateTimeOffset CreatedAtUtc,
    bool Seen
);

public sealed record StoreProductDto(
    string ProductId,
    int CrystalAmount,
    string Title,
    string Description,
    string TierApproximateGEL
);

public sealed record StorePurchaseRequest(
    [Required, StringLength(20)] string Platform,
    [Required, StringLength(64)] string ProductId,
    [Required, StringLength(128)] string TransactionId,
    [Required, StringLength(4096)] string PurchaseToken,
    [StringLength(10)] string? Currency = null,
    decimal? Price = null
);

public sealed record StorePurchaseResult(
    bool Success,
    int Balance,
    int OutstandingDebt,
    int CrystalsCredited,
    int DebtRepaid,
    bool AlreadyProcessed,
    string Message
);

public sealed record StoreRefundRequest(
    [Required, StringLength(20)] string Platform,
    [Required, StringLength(128)] string TransactionId,
    [Required, StringLength(128)] string RefundId,
    [StringLength(200)] string? Reason = null
);

public sealed record StoreRefundResult(
    bool Success,
    int Balance,
    int OutstandingDebt,
    int CrystalsRevoked,
    bool AlreadyProcessed,
    string Message
);

