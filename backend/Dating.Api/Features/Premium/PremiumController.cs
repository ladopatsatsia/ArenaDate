using Dating.Api.Features.Auth;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Dating.Api.Features.Premium;

[ApiController]
[Authorize]
[Route("api/premium")]
[ResponseCache(NoStore = true, Location = ResponseCacheLocation.None)]
public sealed class PremiumController(IPremiumService premiumService) : ControllerBase
{
    private Guid CurrentUserId => Guid.Parse(User.FindFirst("sub")!.Value);

    [HttpGet("status")]
    public Task<PremiumStatusDto> GetStatus(CancellationToken ct)
        => premiumService.GetStatusAsync(CurrentUserId, ct);

    [HttpGet("packages")]
    public ActionResult<PremiumPackageDto[]> GetPackages()
        => premiumService.GetPackages();

    [HttpPost("subscribe")]
    [RequestSizeLimit(2048)]
    public Task<SubscribeResultDto> Subscribe([FromBody] SubscribePackageRequest request, CancellationToken ct)
        => premiumService.SubscribeAsync(CurrentUserId, request, ct);
}
