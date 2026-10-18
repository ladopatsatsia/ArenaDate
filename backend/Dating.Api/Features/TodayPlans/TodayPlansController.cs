using Dating.Api.Features.Auth;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Dating.Api.Features.TodayPlans;

[ApiController]
[Authorize]
[Route("api/today-plans")]
[ResponseCache(NoStore = true, Location = ResponseCacheLocation.None)]
public sealed class TodayPlansController(TodayPlanService service) : ControllerBase
{
    private Guid UserId => Guid.Parse(User.FindFirst("sub")!.Value);

    [HttpGet]
    public Task<TodayPlanFeedPageDto> ListPublicPlans(
        [FromQuery] string? city,
        [FromQuery] string? activity,
        [FromQuery] string? day,
        [FromQuery] string? cursor,
        [FromQuery] int limit = 20,
        CancellationToken ct = default)
        => service.GetPublicPlansAsync(UserId, city, activity, day, cursor, limit, ct);

    [HttpGet("my")]
    public Task<TodayPlanSummaryDto[]> GetMyPlans(CancellationToken ct = default)
        => service.GetMyPlansAsync(UserId, ct);

    [HttpGet("my-responses")]
    public Task<TodayPlanMyResponseDto[]> GetMyResponses(CancellationToken ct = default)
        => service.GetMyResponsesAsync(UserId, ct);

    [HttpGet("limits")]
    public Task<TodayPlanLimitsDto> GetLimits(CancellationToken ct = default)
        => service.GetLimitsAsync(UserId, ct);

    [HttpGet("{id:guid}")]
    public Task<TodayPlanDetailDto> GetPlanById(Guid id, CancellationToken ct = default)
        => service.GetPlanByIdAsync(UserId, id, ct);

    [HttpPost]
    [RequestSizeLimit(4096)]
    public Task<TodayPlanDetailDto> CreatePlan(
        [FromBody] CreateTodayPlanRequest request,
        CancellationToken ct = default)
        => service.CreatePlanAsync(UserId, request, ct);

    [HttpPost("{id:guid}/cancel")]
    [RequestSizeLimit(1024)]
    public Task<TodayPlanDetailDto> CancelPlan(Guid id, CancellationToken ct = default)
        => service.CancelPlanAsync(UserId, id, ct);

    [HttpGet("{id:guid}/applicants")]
    public Task<TodayPlanApplicantDto[]> GetApplicants(Guid id, CancellationToken ct = default)
        => service.GetApplicantsAsync(UserId, id, ct);

    [HttpPost("{id:guid}/responses")]
    [RequestSizeLimit(2048)]
    public Task<TodayPlanMyResponseDto> CreateResponse(
        Guid id,
        [FromBody] CreateTodayPlanResponseRequest request,
        CancellationToken ct = default)
        => service.CreateResponseAsync(UserId, id, request, ct);

    [HttpPost("{id:guid}/responses/{responseId:guid}/withdraw")]
    [RequestSizeLimit(1024)]
    public async Task<IActionResult> WithdrawResponse(
        Guid id,
        Guid responseId,
        CancellationToken ct = default)
    {
        await service.WithdrawResponseAsync(UserId, id, responseId, ct);
        return NoContent();
    }

    [HttpPost("{id:guid}/responses/{responseId:guid}/accept")]
    [RequestSizeLimit(1024)]
    public Task<AcceptPlanResponseResult> AcceptResponse(
        Guid id,
        Guid responseId,
        CancellationToken ct = default)
        => service.AcceptResponseAsync(UserId, id, responseId, ct);

    [HttpPost("{id:guid}/responses/{responseId:guid}/reject")]
    [RequestSizeLimit(1024)]
    public async Task<IActionResult> RejectResponse(
        Guid id,
        Guid responseId,
        CancellationToken ct = default)
    {
        await service.RejectResponseAsync(UserId, id, responseId, ct);
        return NoContent();
    }
}
