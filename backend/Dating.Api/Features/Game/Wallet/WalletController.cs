using Dating.Api.Features.Auth;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Dating.Api.Features.Game.Wallet;

[ApiController]
[Authorize]
[Route("api/game")]
[ResponseCache(NoStore = true, Location = ResponseCacheLocation.None)]
public sealed class WalletController(WalletService walletService) : ControllerBase
{
    private Guid CurrentUserId => Guid.Parse(User.FindFirst("sub")!.Value);

    [HttpGet("wallet")]
    public Task<WalletBalanceDto> GetWallet(CancellationToken ct)
        => walletService.GetWalletBalanceAsync(CurrentUserId, ct);

    [HttpPost("wallet/dev-grant")]
    [RequestSizeLimit(1024)]
    public Task<WalletBalanceDto> DevGrant([FromBody] DevGrantRequest request, CancellationToken ct)
        => walletService.DevGrantAsync(CurrentUserId, request, ct);

    [HttpGet("profiles/{targetUserId:guid}")]
    public Task<GameProfileDto> GetProfile(Guid targetUserId, CancellationToken ct)
        => walletService.GetGameProfileAsync(CurrentUserId, targetUserId, ct);

    [HttpPost("profiles/{targetUserId:guid}/unlock")]
    [RequestSizeLimit(1024)]
    public Task<UnlockProfileResult> UnlockProfile(Guid targetUserId, [FromBody] UnlockProfileRequest request, CancellationToken ct)
        => walletService.UnlockProfileAsync(CurrentUserId, targetUserId, request, ct);

    [HttpGet("profiles/views")]
    public Task<GameProfileViewNoticeDto[]> GetProfileViews(CancellationToken ct)
        => walletService.GetProfileViewNoticesAsync(CurrentUserId, ct);

    [HttpPost("profiles/views/acknowledge")]
    public async Task<IActionResult> AckProfileViews(CancellationToken ct)
    {
        await walletService.AcknowledgeProfileViewNoticesAsync(CurrentUserId, ct);
        return NoContent();
    }

    [HttpGet("store/products")]
    public ActionResult<StoreProductDto[]> GetStoreProducts()
        => walletService.GetStoreProducts();

    [HttpPost("store/purchase")]
    [RequestSizeLimit(8192)]
    public Task<StorePurchaseResult> Purchase([FromBody] StorePurchaseRequest request, CancellationToken ct)
        => walletService.ProcessStorePurchaseAsync(CurrentUserId, request, ct);

    [HttpPost("store/refund")]
    [RequestSizeLimit(2048)]
    public Task<StoreRefundResult> Refund([FromBody] StoreRefundRequest request, CancellationToken ct)
        => walletService.ProcessStoreRefundAsync(request, ct);

    [HttpGet("gifts/catalog")]
    public ActionResult<GiftCatalogItemDto[]> GetGiftCatalog()
        => WalletService.GiftCatalog;

    [HttpPost("gifts/send")]
    [RequestSizeLimit(1024)]
    public Task<SendGiftResult> SendGift([FromBody] SendGiftRequest request, CancellationToken ct)
        => walletService.SendGiftAsync(CurrentUserId, request, ct);

    [HttpGet("gifts/history")]
    public Task<UserGiftsDto> GetUserGifts(CancellationToken ct)
        => walletService.GetUserGiftsAsync(CurrentUserId, ct);
}
