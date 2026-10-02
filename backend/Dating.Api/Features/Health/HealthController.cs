using Dating.Api.Infrastructure;
using Dating.Api.Persistence;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Dating.Api.Features.Health;

public sealed record HealthResponse(string Status);

[ApiController]
[Route("api/health")]
public sealed class HealthController(AppDbContext database) : ControllerBase
{
    [HttpGet("live", Name = "GetLiveness")]
    [ProducesResponseType<HealthResponse>(StatusCodes.Status200OK)]
    public ActionResult<HealthResponse> Live() => Ok(new HealthResponse("ok"));

    [HttpGet("ready", Name = "GetReadiness")]
    [ProducesResponseType<HealthResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status503ServiceUnavailable)]
    public async Task<ActionResult<HealthResponse>> Ready(CancellationToken cancellationToken)
    {
        using var timeout = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
        timeout.CancelAfter(TimeSpan.FromSeconds(3));
        try
        {
            if (!await database.Database.CanConnectAsync(timeout.Token) ||
                (await database.Database.GetPendingMigrationsAsync(timeout.Token)).Any())
                return Unavailable();
            await database.Database.ExecuteSqlRawAsync("SELECT PostGIS_Version()", timeout.Token);
            return Ok(new HealthResponse("ready"));
        }
        catch (Exception) when (!cancellationToken.IsCancellationRequested)
        {
            return Unavailable();
        }
    }

    private ObjectResult Unavailable() => new(SafeProblems.Create(HttpContext, 503, "Service is not ready."))
    { StatusCode = 503, ContentTypes = { "application/problem+json" } };
}
