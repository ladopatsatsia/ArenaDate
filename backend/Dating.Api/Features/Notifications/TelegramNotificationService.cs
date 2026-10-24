using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using Dating.Api.Features.Auth;
using Dating.Api.Features.Profiles;
using Dating.Api.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

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

    Task<bool> NotifyMatchAsync(
        Guid userA,
        Guid userB,
        CancellationToken ct = default);

    Task<bool> NotifyLikeReceivedAsync(
        Guid senderId,
        Guid recipientId,
        CancellationToken ct = default);

    Task<bool> NotifyChatMessageAsync(
        Guid senderId,
        Guid recipientId,
        string messageText,
        Guid? conversationId = null,
        CancellationToken ct = default);

    Task<bool> NotifySuperLikeAsync(
        Guid senderId,
        Guid recipientId,
        string? note = null,
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

    Task<TelegramNotificationConfigDto> GetConfigDtoAsync(CancellationToken ct = default);

    Task<TelegramNotificationConfigDto> UpdateConfigAsync(
        UpdateTelegramNotificationConfigRequest request,
        CancellationToken ct = default);

    Task<TelegramNotificationConfigDto> ResetConfigAsync(CancellationToken ct = default);

    Task<bool> SendAdminTestNotificationAsync(
        AdminTelegramTestNotificationRequest request,
        CancellationToken ct = default);
}

public sealed class TelegramNotificationService : ITelegramNotificationService
{
    private readonly IServiceScopeFactory? _scopeFactory;
    private readonly AppDbContext? _directDb;
    private readonly IConfiguration _config;
    private readonly HttpClient _httpClient;
    private readonly ILogger<TelegramNotificationService> _logger;

    [ActivatorUtilitiesConstructor]
    public TelegramNotificationService(
        IServiceScopeFactory scopeFactory,
        IConfiguration config,
        HttpClient httpClient,
        ILogger<TelegramNotificationService> logger)
    {
        _scopeFactory = scopeFactory;
        _config = config;
        _httpClient = httpClient;
        _logger = logger;
    }

    public TelegramNotificationService(
        AppDbContext db,
        IConfiguration config,
        HttpClient httpClient,
        ILogger<TelegramNotificationService> logger)
    {
        _directDb = db;
        _config = config;
        _httpClient = httpClient;
        _logger = logger;
    }

    private sealed class DbContextScope : IDisposable
    {
        private readonly IServiceScope? _scope;
        public AppDbContext Db { get; }

        public DbContextScope(AppDbContext db, IServiceScope? scope = null)
        {
            Db = db;
            _scope = scope;
        }

        public void Dispose()
        {
            _scope?.Dispose();
        }
    }

    private DbContextScope CreateDbContextScope()
    {
        if (_scopeFactory != null)
        {
            var scope = _scopeFactory.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            return new DbContextScope(db, scope);
        }
        if (_directDb != null)
        {
            return new DbContextScope(_directDb);
        }
        throw new InvalidOperationException("No DbContext or IServiceScopeFactory available.");
    }

    private string? BotToken
    {
        get
        {
            var token = _config["Telegram:BotToken"]
                ?? Environment.GetEnvironmentVariable("Telegram__BotToken")
                ?? Environment.GetEnvironmentVariable("TELEGRAM_BOT_TOKEN");
            if (!string.IsNullOrWhiteSpace(token)) return token;

            try
            {
                var envPath = Path.Combine(Directory.GetCurrentDirectory(), "infra", ".env");
                if (File.Exists(envPath))
                {
                    var match = File.ReadAllLines(envPath).FirstOrDefault(l => l.StartsWith("TELEGRAM_BOT_TOKEN="));
                    if (match != null) return match["TELEGRAM_BOT_TOKEN=".Length..].Trim().Trim('"', '\'');
                }
            }
            catch { }

            return "8909547232:AAEx5dJSZjYY_D1UH9ifmlyCDgaI1csUseg";
        }
    }

    private bool IsMockMode => string.IsNullOrWhiteSpace(BotToken) || BotToken == "dev_bot_token";

    private string? WebAppUrl
    {
        get
        {
            var url = Environment.GetEnvironmentVariable("Telegram__WebAppUrl")
                ?? Environment.GetEnvironmentVariable("TELEGRAM_WEB_APP_URL")
                ?? _config["Telegram:WebAppUrl"];
            if (!string.IsNullOrWhiteSpace(url)) return url;

            try
            {
                var envPath = Path.Combine(Directory.GetCurrentDirectory(), "infra", ".env");
                if (File.Exists(envPath))
                {
                    var match = File.ReadAllLines(envPath).FirstOrDefault(l => l.StartsWith("TELEGRAM_WEB_APP_URL="));
                    if (match != null) return match["TELEGRAM_WEB_APP_URL=".Length..].Trim().Trim('"', '\'');
                }
            }
            catch { }

            return "https://arenadate-production.up.railway.app";
        }
    }

    private string BotUsername
    {
        get
        {
            var username = _config["Telegram:BotUsername"]
                ?? Environment.GetEnvironmentVariable("Telegram__BotUsername")
                ?? Environment.GetEnvironmentVariable("TELEGRAM_BOT_USERNAME");
            return !string.IsNullOrWhiteSpace(username) ? username : "ArenaDatingBot";
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
            using var dbScope = CreateDbContextScope();
            var db = dbScope.Db;
            var now = DateTimeOffset.UtcNow;

            if (userId.HasValue)
            {
                var userExists = await db.Users.AnyAsync(u => u.Id == userId.Value && u.IsActive && !u.IsDeleted, ct);
                if (!userExists)
                {
                    userId = null;
                }
            }

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
                if (userId.HasValue) sub.UserId = userId.Value;
            }

            if (userId.HasValue)
            {
                var others = await db.Set<TelegramSubscriber>()
                    .Where(s => s.UserId == userId.Value && s.ChatId != chatId)
                    .ToListAsync(ct);
                foreach (var other in others)
                {
                    other.UserId = null;
                }
            }

            await db.SaveChangesAsync(ct);
            _logger.LogInformation("Telegram subscriber registered/updated for ChatId={ChatId}, TelegramUserId={TgUserId}, UserId={UserId}",
                chatId, telegramUserId, userId);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to register or update Telegram subscriber for ChatId={ChatId}", chatId);
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
            using var dbScope = CreateDbContextScope();
            var db = dbScope.Db;

            var sub = await db.Set<TelegramSubscriber>().AsNoTracking()
                .FirstOrDefaultAsync(s => s.UserId == userId && s.IsActive, ct);

            if (sub is null)
            {
                _logger.LogDebug("No active Telegram subscriber found for UserId={UserId}", userId);
                return false;
            }

            return await SendToChatAsync(sub.ChatId, messageText, buttonText, webAppPath, ct);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to send Telegram notification to UserId={UserId}", userId);
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
            _logger.LogInformation("[DEV MOCK TELEGRAM] Sending to ChatId={ChatId}: {Text} (Button: {ButtonText}, Path: {Path})",
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

            using var res = await _httpClient.PostAsJsonAsync(url, body, ct);
            if (res.IsSuccessStatusCode)
            {
                return true;
            }

            if (res.StatusCode == HttpStatusCode.Forbidden)
            {
                _logger.LogWarning("Telegram bot blocked by ChatId={ChatId}. Marking subscriber inactive.", chatId);
                try
                {
                    using var dbScope = CreateDbContextScope();
                    var db = dbScope.Db;
                    var sub = await db.Set<TelegramSubscriber>().SingleOrDefaultAsync(s => s.ChatId == chatId, ct);
                    if (sub is not null)
                    {
                        sub.IsActive = false;
                        await db.SaveChangesAsync(ct);
                    }
                }
                catch { }
                return false;
            }

            var errorBody = await res.Content.ReadAsStringAsync(ct);
            _logger.LogWarning("Telegram sendMessage returned status {StatusCode} for ChatId={ChatId}: {Body}",
                res.StatusCode, chatId, errorBody);
            return false;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Exception while sending Telegram message to ChatId={ChatId}", chatId);
            return false;
        }
    }

    public async Task<bool> NotifyMatchAsync(Guid userA, Guid userB, CancellationToken ct = default)
    {
        try
        {
            using var dbScope = CreateDbContextScope();
            var db = dbScope.Db;

            var config = await GetOrCreateConfigAsync(db, ct);
            if (!config.MasterEnabled || !config.MatchEnabled)
            {
                _logger.LogDebug("Telegram match notifications disabled in config.");
                return true;
            }

            var profileA = await db.Set<DatingProfile>().AsNoTracking().FirstOrDefaultAsync(p => p.UserId == userA, ct);
            var profileB = await db.Set<DatingProfile>().AsNoTracking().FirstOrDefaultAsync(p => p.UserId == userB, ct);

            var nameA = WebUtility.HtmlEncode(profileA?.DisplayName ?? "მომხმარებელი");
            var nameB = WebUtility.HtmlEncode(profileB?.DisplayName ?? "მომხმარებელი");

            var textForB = config.MatchTemplate
                .Replace("{partner}", nameA)
                .Replace("{app}", "ARENA");

            var textForA = config.MatchTemplate
                .Replace("{partner}", nameB)
                .Replace("{app}", "ARENA");

            var taskB = SendToUserAsync(
                userB,
                textForB,
                buttonText: config.MatchButtonText,
                webAppPath: "/messages",
                ct: ct
            );

            var taskA = SendToUserAsync(
                userA,
                textForA,
                buttonText: config.MatchButtonText,
                webAppPath: "/messages",
                ct: ct
            );

            var results = await Task.WhenAll(taskA, taskB);
            return results[0] || results[1];
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to send match Telegram notification for users {UserA} and {UserB}", userA, userB);
            return false;
        }
    }

    public async Task<bool> NotifyLikeReceivedAsync(Guid senderId, Guid recipientId, CancellationToken ct = default)
    {
        try
        {
            using var dbScope = CreateDbContextScope();
            var db = dbScope.Db;

            var config = await GetOrCreateConfigAsync(db, ct);
            if (!config.MasterEnabled || !config.MatchRequestEnabled)
            {
                _logger.LogDebug("Telegram like notifications disabled in config.");
                return true;
            }

            var senderProfile = await db.Set<DatingProfile>().AsNoTracking().FirstOrDefaultAsync(p => p.UserId == senderId, ct);
            var senderName = WebUtility.HtmlEncode(senderProfile?.DisplayName ?? "ვიღაც");

            var text = config.MatchRequestTemplate
                .Replace("{sender}", senderName)
                .Replace("{app}", "ARENA");

            return await SendToUserAsync(
                recipientId,
                text,
                buttonText: config.MatchRequestButtonText,
                webAppPath: "/requests",
                ct: ct
            );
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to send like received Telegram notification from {Sender} to {Recipient}", senderId, recipientId);
            return false;
        }
    }

    public async Task<bool> NotifyChatMessageAsync(Guid senderId, Guid recipientId, string messageText, Guid? conversationId = null, CancellationToken ct = default)
    {
        try
        {
            using var dbScope = CreateDbContextScope();
            var db = dbScope.Db;

            var config = await GetOrCreateConfigAsync(db, ct);
            if (!config.MasterEnabled || !config.ChatMessageEnabled)
            {
                _logger.LogDebug("Telegram chat message notifications disabled in config.");
                return true;
            }

            var senderProfile = await db.Set<DatingProfile>().AsNoTracking().FirstOrDefaultAsync(p => p.UserId == senderId, ct);
            var senderName = WebUtility.HtmlEncode(senderProfile?.DisplayName ?? "მეწყვილე");

            var snippet = messageText.StartsWith("[photo:") ? "📷 ფოტო"
                        : messageText.StartsWith("[voice:") ? "🎤 ხმოვანი შეტყობინება"
                        : messageText.Length > 80 ? messageText[..80] + "..." : messageText;

            snippet = WebUtility.HtmlEncode(snippet);

            var text = config.ChatMessageTemplate
                .Replace("{sender}", senderName)
                .Replace("{message}", snippet)
                .Replace("{app}", "ARENA");

            var path = conversationId.HasValue ? $"/chat/{conversationId.Value}" : "/messages";

            return await SendToUserAsync(
                recipientId,
                text,
                buttonText: config.ChatMessageButtonText,
                webAppPath: path,
                ct: ct
            );
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to send chat message Telegram notification from {Sender} to {Recipient}", senderId, recipientId);
            return false;
        }
    }

    public async Task<bool> NotifySuperLikeAsync(Guid senderId, Guid recipientId, string? note = null, CancellationToken ct = default)
    {
        try
        {
            using var dbScope = CreateDbContextScope();
            var db = dbScope.Db;

            var config = await GetOrCreateConfigAsync(db, ct);
            if (!config.MasterEnabled || !config.SuperLikeEnabled)
            {
                _logger.LogDebug("Telegram SuperLike notifications disabled in config.");
                return true;
            }

            var senderProfile = await db.Set<DatingProfile>().AsNoTracking().FirstOrDefaultAsync(p => p.UserId == senderId, ct);
            var senderName = WebUtility.HtmlEncode(senderProfile?.DisplayName ?? "მომხმარებელი");
            var noteSnippet = !string.IsNullOrWhiteSpace(note) ? $"\n\n💬 <i>\"{WebUtility.HtmlEncode(note)}\"</i>" : "";

            var text = config.SuperLikeTemplate
                .Replace("{sender}", senderName)
                .Replace("{note}", noteSnippet)
                .Replace("{app}", "ARENA");

            return await SendToUserAsync(
                recipientId,
                text,
                buttonText: config.SuperLikeButtonText,
                webAppPath: "/requests",
                ct: ct
            );
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to send SuperLike Telegram notification from {Sender} to {Recipient}", senderId, recipientId);
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

        using var dbScope = CreateDbContextScope();
        var db = dbScope.Db;

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
            _logger.LogInformation("[DEV MOCK TELEGRAM BROADCAST] Sending broadcast to {Count} active subscribers. Message: {Message}",
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
                    if (!sub.IsActive) blocked++;
                    else failed++;
                }
            }
            catch
            {
                failed++;
            }

            await Task.Delay(35, ct);
        }

        _logger.LogInformation("Telegram broadcast completed: Targeted={Targeted}, Success={Success}, Failed={Failed}, Blocked={Blocked}",
            targeted, success, failed, blocked);

        return new TelegramBroadcastResult(total, targeted, success, failed, blocked, DateTimeOffset.UtcNow);
    }

    public async Task<TelegramStatsDto> GetStatsAsync(CancellationToken ct = default)
    {
        using var dbScope = CreateDbContextScope();
        var db = dbScope.Db;

        var total = await db.Set<TelegramSubscriber>().CountAsync(ct);
        var active = await db.Set<TelegramSubscriber>().CountAsync(s => s.IsActive, ct);
        var linked = await db.Set<TelegramSubscriber>().CountAsync(s => s.UserId != null, ct);
        var latest = await db.Set<TelegramSubscriber>().MaxAsync(s => (DateTimeOffset?)s.LastActiveAt, ct);

        return new TelegramStatsDto(total, active, linked, latest);
    }

    public async Task<TelegramSubscriberStatusDto> GetUserStatusAsync(Guid userId, CancellationToken ct = default)
    {
        using var dbScope = CreateDbContextScope();
        var db = dbScope.Db;

        var sub = await db.Set<TelegramSubscriber>().AsNoTracking()
            .FirstOrDefaultAsync(s => s.UserId == userId, ct);

        if (sub is null)
        {
            return new TelegramSubscriberStatusDto(
                IsLinked: false,
                IsActive: false,
                Username: null,
                FirstName: null,
                TelegramUserId: null,
                BotUsername: BotUsername
            );
        }

        return new TelegramSubscriberStatusDto(
            IsLinked: true,
            IsActive: sub.IsActive,
            Username: sub.Username,
            FirstName: sub.FirstName,
            TelegramUserId: sub.TelegramUserId,
            BotUsername: BotUsername
        );
    }

    public async Task<bool> SetUserActiveAsync(Guid userId, bool isActive, CancellationToken ct = default)
    {
        using var dbScope = CreateDbContextScope();
        var db = dbScope.Db;

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
        var testMessage = "🔔 <b>ARENA ტესტი!</b>\n\nთქვენი Telegram შეტყობინებები წარმატებით ჩართულია! აქ მიიღებთ შეტყობინებებს ახალ წყვილებზე, ჩატის წერილებსა და მეჩ რექუესტებზე ✨";
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

    private async Task EnsureConfigTableAsync(AppDbContext db, CancellationToken ct)
    {
        try
        {
            await db.Database.ExecuteSqlRawAsync(@"
CREATE TABLE IF NOT EXISTS ""TelegramNotificationConfigs"" (
    ""Id"" character varying(32) NOT NULL,
    ""MasterEnabled"" boolean NOT NULL,
    ""ChatMessageEnabled"" boolean NOT NULL,
    ""ChatMessageTemplate"" character varying(2000) NOT NULL,
    ""ChatMessageButtonText"" character varying(100) NOT NULL,
    ""MatchRequestEnabled"" boolean NOT NULL,
    ""MatchRequestTemplate"" character varying(2000) NOT NULL,
    ""MatchRequestButtonText"" character varying(100) NOT NULL,
    ""MatchEnabled"" boolean NOT NULL,
    ""MatchTemplate"" character varying(2000) NOT NULL,
    ""MatchButtonText"" character varying(100) NOT NULL,
    ""SuperLikeEnabled"" boolean NOT NULL,
    ""SuperLikeTemplate"" character varying(2000) NOT NULL,
    ""SuperLikeButtonText"" character varying(100) NOT NULL,
    ""WelcomeTemplate"" character varying(2000) NOT NULL,
    ""WelcomeButtonText"" character varying(100) NOT NULL,
    ""UpdatedAtUtc"" timestamp with time zone NOT NULL,
    CONSTRAINT ""PK_TelegramNotificationConfigs"" PRIMARY KEY (""Id"")
);", ct);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to ensure TelegramNotificationConfigs table exists.");
        }
    }

    private async Task<TelegramNotificationConfig> GetOrCreateConfigAsync(AppDbContext db, CancellationToken ct)
    {
        try
        {
            var config = await db.Set<TelegramNotificationConfig>().SingleOrDefaultAsync(c => c.Id == "default", ct);
            if (config != null) return config;
        }
        catch
        {
            await EnsureConfigTableAsync(db, ct);
        }

        var existing = await db.Set<TelegramNotificationConfig>().SingleOrDefaultAsync(c => c.Id == "default", ct);
        if (existing != null) return existing;

        var defaultConfig = new TelegramNotificationConfig
        {
            Id = "default",
            MasterEnabled = true,
            ChatMessageEnabled = true,
            ChatMessageTemplate = "💌 <b>ახალი შეტყობინება!</b>\n\n<b>{sender}</b>: <i>\"{message}\"</i>\n\nუპასუხეთ სანამ საუბარი ცხელია 🔥",
            ChatMessageButtonText = "💬 ჩატში გადასვლა",
            MatchRequestEnabled = true,
            MatchRequestTemplate = "💖 <b>ახალი მოწონება (Match Request)!</b>\n\n<b>{sender}</b>-მ მოგაწონათ თავი ARENA-ში! 👀\nშედით აპლიკაციაში, ნახეთ ვინ არის და დაუსვაითეთ უკან ✨",
            MatchRequestButtonText = "👀 მოწონების ნახვა",
            MatchEnabled = true,
            MatchTemplate = "🎉 <b>გილოცავთ! ახალი მეჩი ARENA-ში!</b>\n\nთქვენ და <b>{partner}</b> ერთმანეთს მოეწონეთ! 💕\nშედით აპლიკაციაში და დაიწყეთ მიმოწერა ✨",
            MatchButtonText = "💬 ჩატის გახსნა",
            SuperLikeEnabled = true,
            SuperLikeTemplate = "⭐ <b>ახალი Super Like!</b>\n\n<b>{sender}</b>-მ გამოგიგზავნათ Super Like! 🔥{note}\nშედით ARENA-ში და ნახეთ მისი პროფილი ✨",
            SuperLikeButtonText = "👀 ნახვა",
            WelcomeTemplate = "✅ <b>თქვენი ARENA პროფილი წარმატებით დაუკავშირდა Telegram-ს!</b>\n\nამიერიდან შეტყობინებებს (ახალი მეჩი, მოწონება, ჩატის წერილები) მიიღებთ პირდაპირ აქ ✨\n\nგახსენით აპლიკაცია ქვედა ღილაკით:",
            WelcomeButtonText = "🚀 ARENA-ს გახსნა",
            UpdatedAtUtc = DateTimeOffset.UtcNow
        };

        db.Set<TelegramNotificationConfig>().Add(defaultConfig);
        await db.SaveChangesAsync(ct);
        return defaultConfig;
    }

    public async Task<TelegramNotificationConfigDto> GetConfigDtoAsync(CancellationToken ct = default)
    {
        using var dbScope = CreateDbContextScope();
        var config = await GetOrCreateConfigAsync(dbScope.Db, ct);
        return ToDto(config);
    }

    public async Task<TelegramNotificationConfigDto> UpdateConfigAsync(UpdateTelegramNotificationConfigRequest request, CancellationToken ct = default)
    {
        if (request.ChatMessageTemplate.Length > 2000 || request.MatchRequestTemplate.Length > 2000 ||
            request.MatchTemplate.Length > 2000 || request.SuperLikeTemplate.Length > 2000 ||
            request.WelcomeTemplate.Length > 2000)
        {
            throw new AuthFailure(400, "template_too_long");
        }

        if (string.IsNullOrWhiteSpace(request.ChatMessageTemplate) || string.IsNullOrWhiteSpace(request.MatchRequestTemplate) ||
            string.IsNullOrWhiteSpace(request.MatchTemplate) || string.IsNullOrWhiteSpace(request.SuperLikeTemplate) ||
            string.IsNullOrWhiteSpace(request.WelcomeTemplate))
        {
            throw new AuthFailure(400, "template_empty");
        }

        using var dbScope = CreateDbContextScope();
        var config = await GetOrCreateConfigAsync(dbScope.Db, ct);

        config.MasterEnabled = request.MasterEnabled;
        config.ChatMessageEnabled = request.ChatMessageEnabled;
        config.ChatMessageTemplate = request.ChatMessageTemplate.Trim();
        config.ChatMessageButtonText = string.IsNullOrWhiteSpace(request.ChatMessageButtonText) ? "💬 ჩატში გადასვლა" : request.ChatMessageButtonText.Trim();

        config.MatchRequestEnabled = request.MatchRequestEnabled;
        config.MatchRequestTemplate = request.MatchRequestTemplate.Trim();
        config.MatchRequestButtonText = string.IsNullOrWhiteSpace(request.MatchRequestButtonText) ? "👀 მოწონების ნახვა" : request.MatchRequestButtonText.Trim();

        config.MatchEnabled = request.MatchEnabled;
        config.MatchTemplate = request.MatchTemplate.Trim();
        config.MatchButtonText = string.IsNullOrWhiteSpace(request.MatchButtonText) ? "💬 ჩატის გახსნა" : request.MatchButtonText.Trim();

        config.SuperLikeEnabled = request.SuperLikeEnabled;
        config.SuperLikeTemplate = request.SuperLikeTemplate.Trim();
        config.SuperLikeButtonText = string.IsNullOrWhiteSpace(request.SuperLikeButtonText) ? "👀 ნახვა" : request.SuperLikeButtonText.Trim();

        config.WelcomeTemplate = request.WelcomeTemplate.Trim();
        config.WelcomeButtonText = string.IsNullOrWhiteSpace(request.WelcomeButtonText) ? "🚀 ARENA-ს გახსნა" : request.WelcomeButtonText.Trim();

        config.UpdatedAtUtc = DateTimeOffset.UtcNow;
        await dbScope.Db.SaveChangesAsync(ct);

        _logger.LogInformation("Telegram notification config updated by admin. MasterEnabled={MasterEnabled}", config.MasterEnabled);
        return ToDto(config);
    }

    public async Task<TelegramNotificationConfigDto> ResetConfigAsync(CancellationToken ct = default)
    {
        using var dbScope = CreateDbContextScope();
        var config = await GetOrCreateConfigAsync(dbScope.Db, ct);

        config.MasterEnabled = true;
        config.ChatMessageEnabled = true;
        config.ChatMessageTemplate = "💌 <b>ახალი შეტყობინება!</b>\n\n<b>{sender}</b>: <i>\"{message}\"</i>\n\nუპასუხეთ სანამ საუბარი ცხელია 🔥";
        config.ChatMessageButtonText = "💬 ჩატში გადასვლა";
        config.MatchRequestEnabled = true;
        config.MatchRequestTemplate = "💖 <b>ახალი მოწონება (Match Request)!</b>\n\n<b>{sender}</b>-მ მოგაწონათ თავი ARENA-ში! 👀\nშედით აპლიკაციაში, ნახეთ ვინ არის და დაუსვაითეთ უკან ✨";
        config.MatchRequestButtonText = "👀 მოწონების ნახვა";
        config.MatchEnabled = true;
        config.MatchTemplate = "🎉 <b>გილოცავთ! ახალი მეჩი ARENA-ში!</b>\n\nთქვენ და <b>{partner}</b> ერთმანეთს მოეწონეთ! 💕\nშედით აპლიკაციაში და დაიწყეთ მიმოწერა ✨";
        config.MatchButtonText = "💬 ჩატის გახსნა";
        config.SuperLikeEnabled = true;
        config.SuperLikeTemplate = "⭐ <b>ახალი Super Like!</b>\n\n<b>{sender}</b>-მ გამოგიგზავნათ Super Like! 🔥{note}\nშედით ARENA-ში და ნახეთ მისი პროფილი ✨";
        config.SuperLikeButtonText = "👀 ნახვა";
        config.WelcomeTemplate = "✅ <b>თქვენი ARENA პროფილი წარმატებით დაუკავშირდა Telegram-ს!</b>\n\nამიერიდან შეტყობინებებს (ახალი მეჩი, მოწონება, ჩატის წერილები) მიიღებთ პირდაპირ აქ ✨\n\nგახსენით აპლიკაცია ქვედა ღილაკით:";
        config.WelcomeButtonText = "🚀 ARENA-ს გახსნა";
        config.UpdatedAtUtc = DateTimeOffset.UtcNow;

        await dbScope.Db.SaveChangesAsync(ct);
        _logger.LogInformation("Telegram notification config reset to defaults by admin.");
        return ToDto(config);
    }

    public async Task<bool> SendAdminTestNotificationAsync(AdminTelegramTestNotificationRequest request, CancellationToken ct = default)
    {
        using var dbScope = CreateDbContextScope();
        var db = dbScope.Db;

        long targetChatId = 0;
        if (request.TargetChatId.HasValue && request.TargetChatId.Value != 0)
        {
            targetChatId = request.TargetChatId.Value;
        }
        else
        {
            var targetSub = await db.Set<TelegramSubscriber>()
                .Where(s => s.IsActive && s.UserId != null)
                .OrderByDescending(s => s.LastActiveAt)
                .FirstOrDefaultAsync(ct)
                ?? await db.Set<TelegramSubscriber>()
                .Where(s => s.IsActive)
                .OrderByDescending(s => s.LastActiveAt)
                .FirstOrDefaultAsync(ct);

            if (targetSub == null)
            {
                _logger.LogWarning("Admin test Telegram notification requested but no active subscribers found.");
                return false;
            }
            targetChatId = targetSub.ChatId;
        }

        var config = await GetOrCreateConfigAsync(db, ct);

        string messageText;
        string buttonText;
        string webAppPath;

        switch (request.NotificationType?.ToLowerInvariant())
        {
            case "chat":
                messageText = config.ChatMessageTemplate
                    .Replace("{sender}", "ანა (24)")
                    .Replace("{message}", WebUtility.HtmlEncode("გამარჯობა! როგორ ხარ? 😊"))
                    .Replace("{app}", "ARENA");
                buttonText = config.ChatMessageButtonText;
                webAppPath = "/messages";
                break;

            case "like":
                messageText = config.MatchRequestTemplate
                    .Replace("{sender}", "გიორგი (26)")
                    .Replace("{app}", "ARENA");
                buttonText = config.MatchRequestButtonText;
                webAppPath = "/requests";
                break;

            case "match":
                messageText = config.MatchTemplate
                    .Replace("{partner}", "ნინო (23)")
                    .Replace("{app}", "ARENA");
                buttonText = config.MatchButtonText;
                webAppPath = "/messages";
                break;

            case "superlike":
                messageText = config.SuperLikeTemplate
                    .Replace("{sender}", "დავითი (27)")
                    .Replace("{note}", "\n\n💬 <i>\"ძალიან მომეწონა შენი პროფილი! ✨\"</i>")
                    .Replace("{app}", "ARENA");
                buttonText = config.SuperLikeButtonText;
                webAppPath = "/requests";
                break;

            case "welcome":
            default:
                messageText = config.WelcomeTemplate.Replace("{app}", "ARENA");
                buttonText = config.WelcomeButtonText;
                webAppPath = "/discover";
                break;
        }

        messageText = "🧪 <b>[ADMIN TEST]</b>\n\n" + messageText;
        return await SendToChatAsync(targetChatId, messageText, buttonText, webAppPath, ct);
    }

    private static TelegramNotificationConfigDto ToDto(TelegramNotificationConfig c) => new(
        c.MasterEnabled,
        c.ChatMessageEnabled,
        c.ChatMessageTemplate,
        c.ChatMessageButtonText,
        c.MatchRequestEnabled,
        c.MatchRequestTemplate,
        c.MatchRequestButtonText,
        c.MatchEnabled,
        c.MatchTemplate,
        c.MatchButtonText,
        c.SuperLikeEnabled,
        c.SuperLikeTemplate,
        c.SuperLikeButtonText,
        c.WelcomeTemplate,
        c.WelcomeButtonText,
        c.UpdatedAtUtc
    );
}
