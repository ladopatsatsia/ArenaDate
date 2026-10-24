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

public sealed class TelegramNotificationConfig
{
    public string Id { get; set; } = "default";
    public bool MasterEnabled { get; set; } = true;

    // Chat Message
    public bool ChatMessageEnabled { get; set; } = true;
    public string ChatMessageTemplate { get; set; } = "💌 <b>ახალი შეტყობინება!</b>\n\n<b>{sender}</b>: <i>\"{message}\"</i>\n\nუპასუხეთ სანამ საუბარი ცხელია 🔥";
    public string ChatMessageButtonText { get; set; } = "💬 ჩატში გადასვლა";

    // Match Request / Like
    public bool MatchRequestEnabled { get; set; } = true;
    public string MatchRequestTemplate { get; set; } = "💖 <b>ახალი მოწონება (Match Request)!</b>\n\n<b>{sender}</b>-მ მოგაწონათ თავი ARENA-ში! 👀\nშედით აპლიკაციაში, ნახეთ ვინ არის და დაუსვაითეთ უკან ✨";
    public string MatchRequestButtonText { get; set; } = "👀 მოწონების ნახვა";

    // Match
    public bool MatchEnabled { get; set; } = true;
    public string MatchTemplate { get; set; } = "🎉 <b>გილოცავთ! ახალი მეჩი ARENA-ში!</b>\n\nთქვენ და <b>{partner}</b> ერთმანეთს მოეწონეთ! 💕\nშედით აპლიკაციაში და დაიწყეთ მიმოწერა ✨";
    public string MatchButtonText { get; set; } = "💬 ჩატის გახსნა";

    // Super Like
    public bool SuperLikeEnabled { get; set; } = true;
    public string SuperLikeTemplate { get; set; } = "⭐ <b>ახალი Super Like!</b>\n\n<b>{sender}</b>-მ გამოგიგზავნათ Super Like! 🔥{note}\nშედით ARENA-ში და ნახეთ მისი პროფილი ✨";
    public string SuperLikeButtonText { get; set; } = "👀 ნახვა";

    // Welcome / Link
    public string WelcomeTemplate { get; set; } = "✅ <b>თქვენი ARENA პროფილი წარმატებით დაუკავშირდა Telegram-ს!</b>\n\nამიერიდან შეტყობინებებს (ახალი მეჩი, მოწონება, ჩატის წერილები) მიიღებთ პირდაპირ აქ ✨\n\nგახსენით აპლიკაცია ქვედა ღილაკით:";
    public string WelcomeButtonText { get; set; } = "🚀 ARENA-ს გახსნა";

    public DateTimeOffset UpdatedAtUtc { get; set; } = DateTimeOffset.UtcNow;
}

public sealed record TelegramNotificationConfigDto(
    bool MasterEnabled,
    bool ChatMessageEnabled,
    string ChatMessageTemplate,
    string ChatMessageButtonText,
    bool MatchRequestEnabled,
    string MatchRequestTemplate,
    string MatchRequestButtonText,
    bool MatchEnabled,
    string MatchTemplate,
    string MatchButtonText,
    bool SuperLikeEnabled,
    string SuperLikeTemplate,
    string SuperLikeButtonText,
    string WelcomeTemplate,
    string WelcomeButtonText,
    DateTimeOffset UpdatedAtUtc
);

public sealed record UpdateTelegramNotificationConfigRequest(
    bool MasterEnabled,
    bool ChatMessageEnabled,
    string ChatMessageTemplate,
    string ChatMessageButtonText,
    bool MatchRequestEnabled,
    string MatchRequestTemplate,
    string MatchRequestButtonText,
    bool MatchEnabled,
    string MatchTemplate,
    string MatchButtonText,
    bool SuperLikeEnabled,
    string SuperLikeTemplate,
    string SuperLikeButtonText,
    string WelcomeTemplate,
    string WelcomeButtonText
);

public sealed record AdminTelegramTestNotificationRequest(
    string NotificationType,
    long? TargetChatId = null
);

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
