using System.Net.Http.Json;
using System.Text.Json;
using Dating.Api.Features.Auth;
using Dating.Api.Features.Game.Wallet;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace Dating.Api.Features.Premium;

public sealed class TelegramPaymentService(
    HttpClient httpClient,
    IConfiguration config,
    IPremiumService premiumService,
    WalletService walletService,
    Dating.Api.Features.Notifications.ITelegramNotificationService telegramNotifications,
    ILogger<TelegramPaymentService> logger
) : ITelegramPaymentService
{
    public static readonly Dictionary<string, (string Title, string Description, int Stars)> SubscriptionPackages = new(StringComparer.OrdinalIgnoreCase)
    {
        ["two_weeks"] = ("Arena Black (2 კვირა)", "სწრაფი წვდომა 14 დღით: ნახე ვინ დაგამეჩა", 50),
        ["one_month"] = ("Arena Black (1 თვე)", "ყველაზე პოპულარული არჩევანი: შეუზღუდავი მოწონებები", 90),
        ["three_months"] = ("Arena Black (3 თვე)", "ეკონომიური პაკეტი: 90 დღიანი წვდომა", 180),
        ["lifetime"] = ("Arena Black (სამუდამო)", "ერთხელ გადახდა, სამუდამო შეუზღუდავი წვდომა", 750)
    };

    public static readonly Dictionary<string, (string Title, string Description, int Stars, int CrystalAmount)> CrystalPackages = new(StringComparer.OrdinalIgnoreCase)
    {
        ["dating.crystals.100"] = ("100 💎 კრისტალი", "სტარტერ პაკეტი არენის თამაშისთვის", 25, 100),
        ["dating.crystals.500"] = ("500 💎 კრისტალი", "პოპულარული პაკეტი: კოცნები და საჩუქრები", 100, 500),
        ["dating.crystals.1200"] = ("1200 💎 კრისტალი", "საუკეთესო შეთავაზება: პრემიუმ საჩუქრები", 200, 1200)
    };

    public async Task<TelegramStarsInvoiceResponse> CreateInvoiceLinkAsync(Guid userId, TelegramStarsInvoiceRequest request, CancellationToken ct)
    {
        var itemType = (request.ItemType ?? "").Trim().ToLowerInvariant();
        var itemId = (request.ItemId ?? "").Trim();

        string title;
        string description;
        int stars;

        if (itemType == "subscription")
        {
            if (!SubscriptionPackages.TryGetValue(itemId, out var sub))
                throw new AuthFailure(400, "invalid_package");
            title = sub.Title;
            description = sub.Description;
            stars = sub.Stars;
        }
        else if (itemType == "crystals")
        {
            if (!CrystalPackages.TryGetValue(itemId, out var cry))
                throw new AuthFailure(400, "invalid_product_id");
            title = cry.Title;
            description = cry.Description;
            stars = cry.Stars;
        }
        else
        {
            throw new AuthFailure(400, "invalid_item_type");
        }

        var nonce = Guid.NewGuid().ToString("N");
        var payload = $"{itemType}:{itemId}:{userId:N}:{nonce}";

        var botToken = config["Telegram:BotToken"];
        if (string.IsNullOrWhiteSpace(botToken) || botToken == "dev_bot_token")
        {
            logger.LogInformation("Generating dev mock Telegram Stars invoice link for user {UserId}, payload {Payload}", userId, payload);
            return new TelegramStarsInvoiceResponse(
                InvoiceLink: $"https://t.me/$dev_invoice_{itemType}_{itemId}_{nonce}",
                StarsAmount: stars,
                ItemType: itemType,
                ItemId: itemId,
                Payload: payload
            );
        }

        var url = $"https://api.telegram.org/bot{botToken}/createInvoiceLink";
        var body = new
        {
            title,
            description,
            payload,
            currency = "XTR",
            prices = new[]
            {
                new { label = title, amount = stars }
            }
        };

        using var response = await httpClient.PostAsJsonAsync(url, body, ct);
        var responseContent = await response.Content.ReadAsStringAsync(ct);

        if (!response.IsSuccessStatusCode)
        {
            logger.LogError("Telegram createInvoiceLink failed ({Status}): {Body}", response.StatusCode, responseContent);
            throw new AuthFailure(502, "telegram_invoice_failed");
        }

        using var doc = JsonDocument.Parse(responseContent);
        if (!doc.RootElement.TryGetProperty("ok", out var okProp) || !okProp.GetBoolean())
        {
            var desc = doc.RootElement.TryGetProperty("description", out var descProp) ? descProp.GetString() : "unknown";
            logger.LogError("Telegram createInvoiceLink returned ok=false: {Desc}", desc);
            throw new AuthFailure(502, "telegram_invoice_failed");
        }

        var invoiceLink = doc.RootElement.GetProperty("result").GetString()!;
        return new TelegramStarsInvoiceResponse(
            InvoiceLink: invoiceLink,
            StarsAmount: stars,
            ItemType: itemType,
            ItemId: itemId,
            Payload: payload
        );
    }

    public async Task<TelegramWebhookResult> HandleWebhookAsync(TelegramUpdate update, CancellationToken ct)
    {
        logger.LogInformation(
            "Telegram Webhook received: UpdateId={UpdateId}, HasPreCheckout={HasPreCheckout}, PreCheckoutId={PreCheckoutId}, HasMessage={HasMessage}, HasPayment={HasPayment}",
            update.UpdateId,
            update.PreCheckoutQuery is not null,
            update.PreCheckoutQuery?.Id,
            update.Message is not null,
            update.Message?.SuccessfulPayment is not null
        );

        if (update.PreCheckoutQuery is not null)
        {
            var query = update.PreCheckoutQuery;
            var botToken = config["Telegram:BotToken"];
            bool isValid = query.Currency == "XTR" && !string.IsNullOrWhiteSpace(query.InvoicePayload);

            if (!string.IsNullOrWhiteSpace(botToken) && botToken != "dev_bot_token")
            {
                var answerUrl = $"https://api.telegram.org/bot{botToken}/answerPreCheckoutQuery";
                var answerBody = new
                {
                    pre_checkout_query_id = query.Id,
                    ok = isValid,
                    error_message = isValid ? null : "მოთხოვნა ვერ შესრულდა."
                };
                try
                {
                    using var answerRes = await httpClient.PostAsJsonAsync(answerUrl, answerBody, ct);
                    var answerContent = await answerRes.Content.ReadAsStringAsync(ct);
                    logger.LogInformation("Telegram answerPreCheckoutQuery response ({StatusCode}): {Body}", answerRes.StatusCode, answerContent);
                }
                catch (Exception ex)
                {
                    logger.LogError(ex, "Failed to send answerPreCheckoutQuery to Telegram");
                }
            }

            return new TelegramWebhookResult(true, "pre_checkout_answered");
        }

        if (update.Message?.SuccessfulPayment is not null)
        {
            var payment = update.Message.SuccessfulPayment;
            var chargeId = payment.TelegramPaymentChargeId;
            logger.LogInformation("Telegram SuccessfulPayment received: ChargeId={ChargeId}, Payload={Payload}", chargeId, payment.InvoicePayload);
            return await FulfillPayloadAsync(payment.InvoicePayload, chargeId, ct);
        }

        if (update.Message?.Chat is not null)
        {
            var chatId = update.Message.Chat.Id;
            var from = update.Message.From;
            await telegramNotifications.RegisterOrUpdateSubscriberAsync(
                chatId: chatId,
                telegramUserId: from?.Id ?? chatId,
                username: from?.Username,
                firstName: from?.FirstName,
                lastName: null,
                userId: null,
                ct: ct
            );

            var botToken = config["Telegram:BotToken"] ?? Environment.GetEnvironmentVariable("Telegram__BotToken");
            var webAppUrl = Environment.GetEnvironmentVariable("Telegram__WebAppUrl") ?? config["Telegram:WebAppUrl"];
            if (string.IsNullOrWhiteSpace(webAppUrl) || webAppUrl.Contains("decided-configure-forecasts"))
            {
                try
                {
                    var envPath = Path.Combine(Directory.GetCurrentDirectory(), "infra", ".env");
                    if (File.Exists(envPath))
                    {
                        var match = File.ReadAllLines(envPath).FirstOrDefault(l => l.StartsWith("TELEGRAM_WEB_APP_URL="));
                        if (match != null) webAppUrl = match["TELEGRAM_WEB_APP_URL=".Length..].Trim();
                    }
                }
                catch { }
            }

            if (!string.IsNullOrWhiteSpace(botToken) && botToken != "dev_bot_token" && !string.IsNullOrWhiteSpace(webAppUrl))
            {
                var sendMsgUrl = $"https://api.telegram.org/bot{botToken}/sendMessage";
                var sendMsgBody = new
                {
                    chat_id = chatId,
                    text = "🔥 კეთილი იყოს თქვენი მობრძანება ARENA-ში!\n\nგახსენით აპლიკაცია ქვედა ღილაკით:",
                    reply_markup = new
                    {
                        inline_keyboard = new[]
                        {
                            new[]
                            {
                                new
                                {
                                    text = "🚀 ARENA-ს გახსნა",
                                    web_app = new { url = webAppUrl }
                                }
                            }
                        }
                    }
                };

                var menuUrl = $"https://api.telegram.org/bot{botToken}/setChatMenuButton";
                var menuBody = new
                {
                    chat_id = chatId,
                    menu_button = new
                    {
                        type = "web_app",
                        text = "ARENA",
                        web_app = new { url = webAppUrl }
                    }
                };

                try
                {
                    using var msgRes = await httpClient.PostAsJsonAsync(sendMsgUrl, sendMsgBody, ct);
                    using var menuRes = await httpClient.PostAsJsonAsync(menuUrl, menuBody, ct);
                    logger.LogInformation("Replied to user message for ChatId={ChatId} with WebAppUrl={Url}", chatId, webAppUrl);
                }
                catch (Exception ex)
                {
                    logger.LogError(ex, "Failed to send welcome message or update menu button for ChatId={ChatId}", chatId);
                }
            }

            return new TelegramWebhookResult(true, "message_handled");
        }

        return new TelegramWebhookResult(true, "ignored");
    }

    public async Task<TelegramStarsVerifyResponse> VerifyPaymentAsync(Guid userId, TelegramStarsVerifyRequest request, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(request.Payload))
            throw new AuthFailure(400, "invalid_payload");

        var parts = request.Payload.Split(':');
        if (parts.Length < 4)
            throw new AuthFailure(400, "invalid_payload_format");

        if (!Guid.TryParse(parts[2], out var payloadUserId) && !Guid.TryParseExact(parts[2], "N", out payloadUserId))
            throw new AuthFailure(400, "invalid_user_id");

        if (payloadUserId != userId)
            throw new AuthFailure(403, "unauthorized_payload_user");

        var chargeId = string.IsNullOrWhiteSpace(request.TelegramPaymentChargeId)
            ? $"dev_verify_{Guid.NewGuid():N}"
            : request.TelegramPaymentChargeId.Trim();

        var result = await FulfillPayloadAsync(request.Payload, chargeId, ct);
        if (!result.Success)
            throw new AuthFailure(400, result.Status);

        var itemType = parts[0].ToLowerInvariant();
        PremiumStatusDto? premiumStatus = null;
        int? walletBalance = null;

        if (itemType == "subscription")
        {
            premiumStatus = await premiumService.GetStatusAsync(userId, ct);
        }
        else if (itemType == "crystals")
        {
            var wallet = await walletService.GetWalletBalanceAsync(userId, ct);
            walletBalance = wallet.Balance;
        }

        return new TelegramStarsVerifyResponse(
            Success: true,
            Message: "გადახდა წარმატებით დადასტურდა!",
            PremiumStatus: premiumStatus,
            WalletBalance: walletBalance
        );
    }

    private async Task<TelegramWebhookResult> FulfillPayloadAsync(string payload, string chargeId, CancellationToken ct)
    {
        var parts = payload.Split(':');
        if (parts.Length < 4)
        {
            logger.LogWarning("Invalid invoice payload structure: {Payload}", payload);
            return new TelegramWebhookResult(false, "invalid_payload_format");
        }

        var itemType = parts[0].ToLowerInvariant();
        var itemId = parts[1];
        if (!Guid.TryParse(parts[2], out var userId) && !Guid.TryParseExact(parts[2], "N", out userId))
        {
            logger.LogWarning("Invalid userId in invoice payload: {Payload}", payload);
            return new TelegramWebhookResult(false, "invalid_user_id");
        }

        if (itemType == "subscription")
        {
            try
            {
                await premiumService.SubscribeAsync(userId, new SubscribePackageRequest(
                    PackageId: itemId,
                    Platform: "telegram_stars",
                    TransactionId: chargeId
                ), ct);
                logger.LogInformation("Fulfillment: Activated Telegram Stars subscription {PackageId} for user {UserId}", itemId, userId);
                return new TelegramWebhookResult(true, "subscription_activated");
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Failed to activate subscription from Telegram Stars payment");
                return new TelegramWebhookResult(false, "subscription_activation_failed");
            }
        }
        else if (itemType == "crystals")
        {
            try
            {
                if (!CrystalPackages.TryGetValue(itemId, out var crystalPkg))
                {
                    logger.LogWarning("Unknown crystal product in payload: {ItemId}", itemId);
                    return new TelegramWebhookResult(false, "unknown_crystal_product");
                }

                await walletService.ProcessStorePurchaseAsync(userId, new StorePurchaseRequest(
                    Platform: "telegram_stars",
                    ProductId: itemId,
                    TransactionId: chargeId,
                    PurchaseToken: chargeId,
                    Currency: "XTR",
                    Price: crystalPkg.Stars
                ), ct);
                logger.LogInformation("Fulfillment: Credited {Crystals} crystals via Telegram Stars for user {UserId}", crystalPkg.CrystalAmount, userId);
                return new TelegramWebhookResult(true, "crystals_credited");
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Failed to credit crystals from Telegram Stars payment");
                return new TelegramWebhookResult(false, "crystals_credit_failed");
            }
        }

        return new TelegramWebhookResult(false, "unsupported_item_type");
    }
}
