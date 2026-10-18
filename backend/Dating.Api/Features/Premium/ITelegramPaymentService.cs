namespace Dating.Api.Features.Premium;

public interface ITelegramPaymentService
{
    Task<TelegramStarsInvoiceResponse> CreateInvoiceLinkAsync(Guid userId, TelegramStarsInvoiceRequest request, CancellationToken ct);
    Task<TelegramWebhookResult> HandleWebhookAsync(TelegramUpdate update, CancellationToken ct);
    Task<TelegramStarsVerifyResponse> VerifyPaymentAsync(Guid userId, TelegramStarsVerifyRequest request, CancellationToken ct);
}
