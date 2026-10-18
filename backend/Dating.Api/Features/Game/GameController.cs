using Dating.Api.Features.Auth;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.ModelBinding;
using Microsoft.AspNetCore.RateLimiting;

namespace Dating.Api.Features.Game;

[ApiController]
[Authorize]
[Route("api/game")]
[EnableRateLimiting("swipe")]
[ResponseCache(NoStore = true, Location = ResponseCacheLocation.None)]
public sealed class GameController(GameService service) : ControllerBase
{
    private Guid UserId => Guid.Parse(User.FindFirst("sub")?.Value ?? User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)!.Value);

    [HttpGet("rooms")]
    public Task<GameRoomSummary[]> ListRooms(CancellationToken ct) =>
        service.ListRooms(UserId, ct);

    [HttpGet("current")]
    public async Task<ActionResult<GameRoomDetail>> GetCurrent(CancellationToken ct)
    {
        var room = await service.GetCurrentRoom(UserId, ct);
        if (room is null) return NoContent();
        return Ok(room);
    }

    [HttpPost("queue")]
    [RequestSizeLimit(1024)]
    public Task<GameRoomDetail> JoinQueue([FromBody] JoinQueueRequest request, CancellationToken ct) =>
        service.JoinQueue(UserId, request, ct);

    [HttpPost("rooms")]
    [RequestSizeLimit(1024)]
    public Task<GameRoomDetail> CreateRoom([FromBody] CreateRoomRequest request, CancellationToken ct) =>
        service.CreateRoom(UserId, request, ct);

    [HttpGet("rooms/{id:guid}")]
    public Task<GameRoomDetail> GetRoom(Guid id, CancellationToken ct) =>
        service.GetRoom(id, UserId, ct);

    [HttpPost("rooms/{id:guid}/join")]
    [RequestSizeLimit(1024)]
    public Task<JoinRoomResult> JoinRoom(Guid id, [FromBody] JoinRoomRequest? req, CancellationToken ct) =>
        service.JoinRoom(id, UserId, req, ct);

    [HttpPost("rooms/{id:guid}/leave")]
    [RequestSizeLimit(1024)]
    public Task<LeaveRoomResult> LeaveRoom(Guid id, CancellationToken ct) =>
        service.LeaveRoom(id, UserId, ct);

    [HttpGet("rooms/{id:guid}/snapshot")]
    public Task<GameRoomSnapshot> GetSnapshot(Guid id, CancellationToken ct) =>
        service.GetRoomSnapshot(id, UserId, ct);

    [HttpPost("rooms/{id:guid}/reconnect")]
    [RequestSizeLimit(1024)]
    public Task<ReconnectRoomResult> Reconnect(Guid id, CancellationToken ct) =>
        service.ReconnectRoom(id, UserId, ct);

    [HttpPost("rooms/{id:guid}/heartbeat")]
    [RequestSizeLimit(1024)]
    public Task<HeartbeatResult> Heartbeat(Guid id, CancellationToken ct) =>
        service.Heartbeat(id, UserId, ct);

    [HttpPost("rooms/{id:guid}/spin")]
    [RequestSizeLimit(1024)]
    public Task<SpinResult> Spin(
        Guid id,
        [FromBody(EmptyBodyBehavior = EmptyBodyBehavior.Allow)] SpinRequest? request,
        [FromQuery] bool? autoPickTarget,
        CancellationToken ct) =>
        service.SpinBottle(id, UserId, request?.AutoPickTarget ?? autoPickTarget ?? true, ct);

    [HttpPost("rooms/{id:guid}/rounds/{roundId:guid}/questions/{questionIndex:int}/answer")]
    [RequestSizeLimit(2048)]
    public Task<AnswerQuestionResult> AnswerQuestion(
        Guid id,
        Guid roundId,
        int questionIndex,
        [FromBody] AnswerQuestionRequest request,
        CancellationToken ct) =>
        service.AnswerQuestion(id, roundId, questionIndex, UserId, request, ct);

    [HttpPost("rooms/{id:guid}/rounds/{roundId:guid}/questions/{questionIndex:int}/skip")]
    [RequestSizeLimit(1024)]
    public Task<AnswerQuestionResult> SkipQuestion(
        Guid id,
        Guid roundId,
        int questionIndex,
        [FromBody] SkipQuestionRequest request,
        CancellationToken ct) =>
        service.SkipQuestion(id, roundId, questionIndex, UserId, request.IdempotencyKey, ct);

    [HttpPost("rooms/{id:guid}/rounds/{roundId:guid}/kiss")]
    [RequestSizeLimit(1024)]
    public Task<SendKissResult> SendKiss(
        Guid id,
        Guid roundId,
        [FromBody] SendKissRequest request,
        CancellationToken ct) =>
        service.SendKiss(id, roundId, UserId, request, ct);

    [HttpPost("rooms/{id:guid}/rounds/{roundId:guid}/target")]
    [RequestSizeLimit(1024)]
    public Task<SelectTargetResult> SelectTarget(
        Guid id,
        Guid roundId,
        [FromBody] SelectTargetRequest request,
        CancellationToken ct) =>
        service.SelectTarget(id, roundId, UserId, request.TargetUserId, ct);

    [HttpPost("rooms/{id:guid}/rounds/{roundId:guid}/target/skip")]
    [RequestSizeLimit(1024)]
    public async Task<IActionResult> SkipTarget(
        Guid id,
        Guid roundId,
        [FromBody(EmptyBodyBehavior = EmptyBodyBehavior.Allow)] SkipTargetRequest? request,
        CancellationToken ct)
    {
        var result = await service.SkipTarget(id, roundId, UserId, request?.IdempotencyKey, ct);
        return Ok(result);
    }

    [HttpPost("rooms/{id:guid}/rounds/{roundId:guid}/kiss/skip")]
    [RequestSizeLimit(1024)]
    public async Task<IActionResult> SkipKiss(
        Guid id,
        Guid roundId,
        [FromBody] SkipKissRequest request,
        CancellationToken ct)
    {
        await service.SkipKiss(id, roundId, UserId, request.IdempotencyKey, ct);
        return Ok(new { skipped = true });
    }

    [HttpPost("rooms/{id:guid}/post-game-kiss")]
    [RequestSizeLimit(1024)]
    public Task<PostGameKissResult> PostGameKiss(
        Guid id,
        [FromBody] PostGameKissRequest request,
        CancellationToken ct) =>
        service.PostGameKiss(id, UserId, request, ct);

    [HttpGet("rooms/{id:guid}/messages")]
    public Task<GameRoomMessageDto[]> GetRoomMessages(Guid id, CancellationToken ct) =>
        service.GetRoomChatMessages(id, UserId, ct);

    [HttpPost("rooms/{id:guid}/messages")]
    [RequestSizeLimit(2048)]
    public Task<GameRoomMessageDto> SendRoomMessage(
        Guid id,
        [FromBody] SendRoomMessageRequest request,
        CancellationToken ct) =>
        service.SendRoomChatMessage(id, UserId, request.Text, ct);

    [HttpPost("direct-request")]
    [RequestSizeLimit(2048)]
    public Task<SendDirectMatchRequestResult> SendDirectRequest(
        [FromBody] SendDirectMatchRequestInput request,
        CancellationToken ct) =>
        service.SendDirectMatchRequest(UserId, request, ct);

    [HttpPost("direct-request/{requestId:guid}/respond")]
    [RequestSizeLimit(1024)]
    public Task<RespondDirectMatchRequestResult> RespondDirectRequest(
        Guid requestId,
        [FromBody] RespondDirectMatchRequestInput request,
        CancellationToken ct) =>
        service.RespondDirectMatchRequest(UserId, requestId, request, ct);



    [HttpGet("ai-consent")]
    public async Task<ActionResult<UserAiConsentResponse>> GetAiConsent(CancellationToken ct)
    {
        var result = await service.GetUserAiConsentAsync(UserId, ct);
        return Ok(result);
    }

    [HttpPost("ai-consent")]
    [RequestSizeLimit(1024)]
    public async Task<ActionResult<UserAiConsentResponse>> UpdateAiConsent([FromBody] UpdateAiConsentRequest request, CancellationToken ct)
    {
        var result = await service.SetUserAiConsentAsync(UserId, request.AiConsent, ct);
        return Ok(result);
    }

    [HttpPost("rooms/{id:guid}/dev-fixtures")]
    [RequestSizeLimit(1024)]
    public async Task<IActionResult> SeedDevFixtures(Guid id, [FromBody] DevFixtureSeedRequest request, CancellationToken ct)
    {
        var count = await service.SeedDevFixtures(id, request, ct);
        return Ok(new { added = count });
    }
}
