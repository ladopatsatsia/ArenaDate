using Dating.Api.Features.Auth;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Dating.Api.Features.Premium;

[ApiController]
[Route("api/payments/telegram-stars")]
[ResponseCache(NoStore = true, Location = ResponseCacheLocation.None)]
public sealed class TelegramPaymentController(ITelegramPaymentService paymentService) : ControllerBase
{
    private Guid CurrentUserId => Guid.Parse(User.FindFirst("sub")!.Value);

    [Authorize]
    [HttpPost("invoice")]
    [RequestSizeLimit(2048)]
    public Task<TelegramStarsInvoiceResponse> CreateInvoice(
        [FromBody] TelegramStarsInvoiceRequest request,
        CancellationToken ct
    ) => paymentService.CreateInvoiceLinkAsync(CurrentUserId, request, ct);

    [Authorize]
    [HttpPost("verify")]
    [RequestSizeLimit(2048)]
    public Task<TelegramStarsVerifyResponse> VerifyPayment(
        [FromBody] TelegramStarsVerifyRequest request,
        CancellationToken ct
    ) => paymentService.VerifyPaymentAsync(CurrentUserId, request, ct);

    [AllowAnonymous]
    [HttpPost("webhook")]
    [RequestSizeLimit(16384)]
    public Task<TelegramWebhookResult> HandleWebhook(
        [FromBody] TelegramUpdate update,
        CancellationToken ct
    ) => paymentService.HandleWebhookAsync(update, ct);
}
