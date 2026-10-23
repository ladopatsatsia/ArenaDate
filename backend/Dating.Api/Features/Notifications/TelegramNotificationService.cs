using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using Dating.Api.Features.Auth;
using Dating.Api.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Dating.Api.Features.Notifications;

public interface ITelegramNotificationService
{
    Task RegisterOrUpdateSubscriberAsync(
        long chatId,
        long telegramUserId,
        string? username = null,
        string? firstName = null,
        string? lastName = null,
        Guid? userId = null,
        CancellationToken ct = default);

    Task<bool> SendToUserAsync(
        Guid userId,
        string messageText,
        string? buttonText = null,
        string? webAppPath = null,
        CancellationToken ct = default);

    Task<bool> SendToChatAsync(
        long chatId,
        string messageText,
        string? buttonText = null,
        string? webAppPath = null,
        CancellationToken ct = default);

    Task<TelegramBroadcastResult> BroadcastAsync(
        TelegramBroadcastRequest request,
        CancellationToken ct = default);

    Task<TelegramStatsDto> GetStatsAsync(CancellationToken ct = default);

    Task<TelegramSubscriberStatusDto> GetUserStatusAsync(Guid userId, CancellationToken ct = default);

    Task<bool> SetUserActiveAsync(Guid userId, bool isActive, CancellationToken ct = default);

    Task<bool> SendTestNotificationAsync(Guid userId, CancellationToken ct = default);

    Task<bool> LinkUserAsync(
        Guid userId,
        long telegramUserId,
        long? chatId = null,
        string? username = null,
        string? firstName = null,
        string? lastName = null,
        CancellationToken ct = default);
}

public sealed class TelegramNotificationService(
    AppDbContext db,
    IConfiguration config,
    HttpClient httpClient,
    ILogger<TelegramNotificationService> logger
) : ITelegramNotificationService
{
    private string? BotToken => config["Telegram:BotToken"];
    private bool IsMockMode => string.IsNullOrWhiteSpace(BotToken) || BotToken == "dev_bot_token";
    private string? WebAppUrl
    {
        get
        {
            try
            {
                var envPath = Path.Combine(Directory.GetCurrentDirectory(), "infra", ".env");
                if (File.Exists(envPath))
                {
                    var match = File.ReadAllLines(envPath).FirstOrDefault(l => l.StartsWith("TELEGRAM_WEB_APP_URL="));
                    if (match != null) return match["TELEGRAM_WEB_APP_URL=".Length..].Trim();
                }
            }
            catch { }
            return Environment.GetEnvironmentVariable("Telegram__WebAppUrl") ?? config["Telegram:WebAppUrl"];
        }
    }

    public async Task RegisterOrUpdateSubscriberAsync(
        long chatId,
        long telegramUserId,
        string? username = null,
        string? firstName = null,
        string? lastName = null,
        Guid? userId = null,
        CancellationToken ct = default)
    {
        try
        {
            var now = DateTimeOffset.UtcNow;
            var sub = await db.Set<TelegramSubscriber>().SingleOrDefaultAsync(s => s.ChatId == chatId, ct);
            if (sub is null)
            {
                sub = new TelegramSubscriber
                {
                    ChatId = chatId,
                    TelegramUserId = telegramUserId,
                    Username = username,
                    FirstName = firstName,
                    LastName = lastName,
                    UserId = userId,
                    IsActive = true,
                    FirstSeenAt = now,
                    LastActiveAt = now
                };
                db.Set<TelegramSubscriber>().Add(sub);
            }
            else
            {
                sub.IsActive = true;
                sub.LastActiveAt = now;
                if (telegramUserId != 0) sub.TelegramUserId = telegramUserId;
                if (!string.IsNullOrWhiteSpace(username)) sub.Username = username;
                if (!string.IsNullOrWhiteSpace(firstName)) sub.FirstName = firstName;
                if (!string.IsNullOrWhiteSpace(lastName)) sub.LastName = lastName;
                if (userId.HasValue && sub.UserId == null) sub.UserId = userId;
            }

            await db.SaveChangesAsync(ct);
            logger.LogInformation("Telegram subscriber registered/updated for ChatId={ChatId}, TelegramUserId={TgUserId}, UserId={UserId}",
                chatId, telegramUserId, userId);
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Failed to register or update Telegram subscriber for ChatId={ChatId}", chatId);
        }
    }

    public async Task<bool> SendToUserAsync(
        Guid userId,
        string messageText,
        string? buttonText = null,
        string? webAppPath = null,
        CancellationToken ct = default)
    {
        try
        {
            var sub = await db.Set<TelegramSubscriber>().AsNoTracking()
                .FirstOrDefaultAsync(s => s.UserId == userId && s.IsActive, ct);

            if (sub is null)
            {
                logger.LogDebug("No active Telegram subscriber found for UserId={UserId}", userId);
                return false;
            }

            return await SendToChatAsync(sub.ChatId, messageText, buttonText, webAppPath, ct);
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Failed to send Telegram notification to UserId={UserId}", userId);
            return false;
        }
    }

    public async Task<bool> SendToChatAsync(
        long chatId,
        string messageText,
        string? buttonText = null,
        string? webAppPath = null,
        CancellationToken ct = default)
    {
        if (IsMockMode)
        {
            logger.LogInformation("[DEV MOCK TELEGRAM] Sending to ChatId={ChatId}: {Text} (Button: {ButtonText}, Path: {Path})",
                chatId, messageText, buttonText, webAppPath);
            return true;
        }

        try
        {
            var url = $"https://api.telegram.org/bot{BotToken}/sendMessage";
            object? replyMarkup = null;

            if (!string.IsNullOrWhiteSpace(buttonText) && !string.IsNullOrWhiteSpace(WebAppUrl))
            {
                var targetUrl = WebAppUrl;
                if (!string.IsNullOrWhiteSpace(webAppPath))
                {
                    var cleanPath = webAppPath.StartsWith('/') ? webAppPath : "/" + webAppPath;
                    targetUrl = WebAppUrl.TrimEnd('/') + cleanPath;
                }

                replyMarkup = new
                {
                    inline_keyboard = new[]
                    {
                        new[]
                        {
                            new
                            {
                                text = buttonText,
                                web_app = new { url = targetUrl }
                            }
                        }
                    }
                };
            }

            var body = new
            {
                chat_id = chatId,
                text = messageText,
                parse_mode = "HTML",
                reply_markup = replyMarkup
            };

            using var res = await httpClient.PostAsJsonAsync(url, body, ct);
            if (res.IsSuccessStatusCode)
            {
                return true;
            }

            if (res.StatusCode == HttpStatusCode.Forbidden)
            {
                // Bot was blocked by the user or user is deactivated
                logger.LogWarning("Telegram bot blocked by ChatId={ChatId}. Marking subscriber inactive.", chatId);
                var sub = await db.Set<TelegramSubscriber>().SingleOrDefaultAsync(s => s.ChatId == chatId, ct);
                if (sub is not null)
                {
                    sub.IsActive = false;
                    await db.SaveChangesAsync(ct);
                }
                return false;
            }

            var errorBody = await res.Content.ReadAsStringAsync(ct);
            logger.LogWarning("Telegram sendMessage returned status {StatusCode} for ChatId={ChatId}: {Body}",
                res.StatusCode, chatId, errorBody);
            return false;
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Exception while sending Telegram message to ChatId={ChatId}", chatId);
            return false;
        }
    }

    public async Task<TelegramBroadcastResult> BroadcastAsync(
        TelegramBroadcastRequest request,
        CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(request.Message))
        {
            throw new AuthFailure(400, "message_empty");
        }

        if (request.Message.Length > 4000)
        {
            throw new AuthFailure(400, "message_too_long");
        }

        var total = await db.Set<TelegramSubscriber>().CountAsync(ct);
        var activeSubscribers = await db.Set<TelegramSubscriber>().Where(s => s.IsActive).ToListAsync(ct);
        var targeted = activeSubscribers.Count;

        int success = 0;
        int failed = 0;
        int blocked = 0;

        var buttonText = string.IsNullOrWhiteSpace(request.ButtonText) ? "🚀 ARENA-ს გახსნა" : request.ButtonText.Trim();
        var webAppPath = string.IsNullOrWhiteSpace(request.WebAppRelativePath) ? null : request.WebAppRelativePath.Trim();

        if (IsMockMode)
        {
            logger.LogInformation("[DEV MOCK TELEGRAM BROADCAST] Sending broadcast to {Count} active subscribers. Message: {Message}",
                targeted, request.Message);
            return new TelegramBroadcastResult(total, targeted, targeted, 0, 0, DateTimeOffset.UtcNow);
        }

        foreach (var sub in activeSubscribers)
        {
            if (ct.IsCancellationRequested) break;

            try
            {
                var ok = await SendToChatAsync(sub.ChatId, request.Message, buttonText, webAppPath, ct);
                if (ok)
                {
                    success++;
                }
                else
                {
                    // If marked inactive in SendToChatAsync, it was blocked
                    if (!sub.IsActive) blocked++;
                    else failed++;
                }
            }
            catch
            {
                failed++;
            }

            // Telegram rate limit throttle: 30 msgs/second
            await Task.Delay(35, ct);
        }

        logger.LogInformation("Telegram broadcast completed: Targeted={Targeted}, Success={Success}, Failed={Failed}, Blocked={Blocked}",
            targeted, success, failed, blocked);

        return new TelegramBroadcastResult(total, targeted, success, failed, blocked, DateTimeOffset.UtcNow);
    }

    public async Task<TelegramStatsDto> GetStatsAsync(CancellationToken ct = default)
    {
        var total = await db.Set<TelegramSubscriber>().CountAsync(ct);
        var active = await db.Set<TelegramSubscriber>().CountAsync(s => s.IsActive, ct);
        var linked = await db.Set<TelegramSubscriber>().CountAsync(s => s.UserId != null, ct);
        var latest = await db.Set<TelegramSubscriber>().MaxAsync(s => (DateTimeOffset?)s.LastActiveAt, ct);

        return new TelegramStatsDto(total, active, linked, latest);
    }

    public async Task<TelegramSubscriberStatusDto> GetUserStatusAsync(Guid userId, CancellationToken ct = default)
    {
        var sub = await db.Set<TelegramSubscriber>().AsNoTracking()
            .FirstOrDefaultAsync(s => s.UserId == userId, ct);

        var botUsername = config["Telegram:BotUsername"] ?? "ArenaDatingBot";
        if (sub is null)
        {
            return new TelegramSubscriberStatusDto(
                IsLinked: false,
                IsActive: false,
                Username: null,
                FirstName: null,
                TelegramUserId: null,
                BotUsername: botUsername
            );
        }

        return new TelegramSubscriberStatusDto(
            IsLinked: true,
            IsActive: sub.IsActive,
            Username: sub.Username,
            FirstName: sub.FirstName,
            TelegramUserId: sub.TelegramUserId,
            BotUsername: botUsername
        );
    }

    public async Task<bool> SetUserActiveAsync(Guid userId, bool isActive, CancellationToken ct = default)
    {
        var sub = await db.Set<TelegramSubscriber>()
            .FirstOrDefaultAsync(s => s.UserId == userId, ct);

        if (sub is null) return false;

        sub.IsActive = isActive;
        sub.LastActiveAt = DateTimeOffset.UtcNow;
        await db.SaveChangesAsync(ct);
        return true;
    }

    public async Task<bool> SendTestNotificationAsync(Guid userId, CancellationToken ct = default)
    {
        var testMessage = "🔔 <b>ARENA ტესტი!</b>\n\nთქვენი Telegram შეტყობინებები წარმატებით ჩართულია! აქ მიიღებთ შეტყობინებებს ახალ წყვილებზე, ჩატის წერილებსა და დღევანდელ გეგმებზე ✨";
        return await SendToUserAsync(
            userId,
            testMessage,
            buttonText: "💖 ARENA-ს გახსნა",
            webAppPath: "/discover",
            ct: ct
        );
    }

    public async Task<bool> LinkUserAsync(
        Guid userId,
        long telegramUserId,
        long? chatId = null,
        string? username = null,
        string? firstName = null,
        string? lastName = null,
        CancellationToken ct = default)
    {
        var targetChatId = chatId ?? telegramUserId;
        await RegisterOrUpdateSubscriberAsync(
            chatId: targetChatId,
            telegramUserId: telegramUserId,
            username: username,
            firstName: firstName,
            lastName: lastName,
            userId: userId,
            ct: ct
        );
        return true;
    }
}
