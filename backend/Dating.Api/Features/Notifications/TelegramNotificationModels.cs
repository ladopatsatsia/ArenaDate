namespace Dating.Api.Features.Notifications;

public sealed class TelegramSubscriber
{
    public long ChatId { get; set; }
    public long TelegramUserId { get; set; }
    public string? Username { get; set; }
    public string? FirstName { get; set; }
    public string? LastName { get; set; }
    public Guid? UserId { get; set; }
    public bool IsActive { get; set; } = true;
    public DateTimeOffset FirstSeenAt { get; set; }
    public DateTimeOffset LastActiveAt { get; set; }
}

public sealed record TelegramBroadcastRequest(
    string Message,
    string? ButtonText = null,
    string? WebAppRelativePath = null
);

public sealed record TelegramBroadcastResult(
    int TotalSubscribers,
    int Targeted,
    int SuccessCount,
    int FailedCount,
    int BlockedCount,
    DateTimeOffset CompletedAtUtc
);

public sealed record TelegramStatsDto(
    int TotalSubscribers,
    int ActiveSubscribers,
    int LinkedUsersCount,
    DateTimeOffset? LatestActivityUtc
);

public sealed record TelegramSubscriberStatusDto(
    bool IsLinked,
    bool IsActive,
    string? Username,
    string? FirstName,
    long? TelegramUserId,
    string BotUsername
);

public sealed record TelegramToggleRequest(bool IsActive);

public sealed record TelegramLinkRequest(
    long TelegramUserId,
    long? ChatId,
    string? Username,
    string? FirstName,
    string? LastName
);
