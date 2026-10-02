using Dating.Api.Features.Auth;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
namespace Dating.Api.Features.Discovery;
[ApiController, Authorize, Route("api/discovery"), EnableRateLimiting("discovery")]
[ResponseCache(NoStore = true, Location = ResponseCacheLocation.None)]
public sealed class DiscoveryController(DiscoveryService service, DiscoveryEligibility eligibility) : ControllerBase
{
    private Guid Id => Guid.Parse(User.FindFirst("sub")!.Value);
    [HttpGet]
    public Task<DiscoveryPage> Page([FromQuery] string? cursor, CancellationToken ct)
    {
        if (cursor?.Length > 4096 || Request.Query.Keys.Any(k => k != "cursor")) throw new AuthFailure(400, "invalid_query");
        return service.Page(Id, cursor, ct);
    }
    [HttpGet("{target:guid}")]
    public async Task<DiscoveryCard> Current(Guid target, CancellationToken ct)
    {
        await eligibility.RequireCurrent(Id, target, ct);
        var page = await service.Page(Id, null, ct, target);
        return page.Items.FirstOrDefault() ?? throw new AuthFailure(404, "profile_unavailable");
    }
    [HttpGet("settings")] public Task<DiscoverySettings> Settings(CancellationToken ct) => service.Settings(Id, ct);
    [HttpPost("settings"), EnableRateLimiting("preferences"), RequestSizeLimit(2048)]
    public Task<DiscoverySettings> Save(SettingsRequest request, CancellationToken ct) => service.Save(Id, request, ct);
    [HttpPost("location"), EnableRateLimiting("location"), RequestSizeLimit(1024)]
    public Task<DiscoverySettings> Location(LocationRequest request, CancellationToken ct) => service.Location(Id, request, ct);
    [HttpDelete("location")] public Task<DiscoverySettings> Clear(CancellationToken ct) => service.ClearLocation(Id, ct);
}
