using System.Text.Json.Serialization;
using Dating.Api.Features.Premium;

namespace Dating.Api.Features.Premium;

public sealed record TelegramStarsInvoiceRequest(
    string ItemType,
    string ItemId
);

public sealed record TelegramStarsInvoiceResponse(
    string InvoiceLink,
    int StarsAmount,
    string ItemType,
    string ItemId,
    string Payload
);

public sealed record TelegramStarsVerifyRequest(
    string Payload,
    string? TelegramPaymentChargeId = null
);

public sealed record TelegramStarsVerifyResponse(
    bool Success,
    string Message,
    PremiumStatusDto? PremiumStatus = null,
    int? WalletBalance = null
);

public sealed record TelegramUpdate(
    [property: JsonPropertyName("update_id")] long UpdateId = 0,
    [property: JsonPropertyName("pre_checkout_query")] TelegramPreCheckoutQuery? PreCheckoutQuery = null,
    [property: JsonPropertyName("message")] TelegramWebhookMessage? Message = null
);

public sealed record TelegramPreCheckoutQuery(
    [property: JsonPropertyName("id")] string Id = "",
    [property: JsonPropertyName("from")] TelegramWebhookUser? From = null,
    [property: JsonPropertyName("currency")] string Currency = "XTR",
    [property: JsonPropertyName("total_amount")] int TotalAmount = 0,
    [property: JsonPropertyName("invoice_payload")] string InvoicePayload = ""
);

public sealed record TelegramWebhookMessage(
    [property: JsonPropertyName("message_id")] long MessageId = 0,
    [property: JsonPropertyName("from")] TelegramWebhookUser? From = null,
    [property: JsonPropertyName("chat")] TelegramWebhookChat? Chat = null,
    [property: JsonPropertyName("text")] string? Text = null,
    [property: JsonPropertyName("successful_payment")] TelegramSuccessfulPayment? SuccessfulPayment = null
);

public sealed record TelegramWebhookChat(
    [property: JsonPropertyName("id")] long Id = 0,
    [property: JsonPropertyName("type")] string? Type = null
);

public sealed record TelegramSuccessfulPayment(
    [property: JsonPropertyName("currency")] string Currency = "XTR",
    [property: JsonPropertyName("total_amount")] int TotalAmount = 0,
    [property: JsonPropertyName("invoice_payload")] string InvoicePayload = "",
    [property: JsonPropertyName("telegram_payment_charge_id")] string TelegramPaymentChargeId = "",
    [property: JsonPropertyName("provider_payment_charge_id")] string? ProviderPaymentChargeId = null
);

public sealed record TelegramWebhookUser(
    [property: JsonPropertyName("id")] long Id = 0,
    [property: JsonPropertyName("first_name")] string? FirstName = null,
    [property: JsonPropertyName("username")] string? Username = null
);

public sealed record TelegramWebhookResult(
    bool Success,
    string Status
);
