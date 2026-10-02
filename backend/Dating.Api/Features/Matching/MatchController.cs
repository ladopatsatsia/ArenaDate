using Dating.Api.Features.Auth;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
namespace Dating.Api.Features.Matching;
[ApiController,Authorize,Route("api"),EnableRateLimiting("swipe")]
[ResponseCache(NoStore=true,Location=ResponseCacheLocation.None)]
public sealed class MatchController(MatchService service):ControllerBase {
 private Guid Id=>Guid.Parse(User.FindFirst("sub")!.Value);
 [HttpPost("swipes"),RequestSizeLimit(1024)]
 public Task<SwipeResult> Decide(SwipeRequest request,CancellationToken ct)=>service.Decide(Id,request,ct);
 [HttpGet("swipes/{request:guid}")]
 public async Task<SwipeResult> Receipt(Guid request,CancellationToken ct)=>
  await service.Receipt(Id,request,ct) ?? throw new AuthFailure(404,"request_unknown");
 [HttpGet("matches")]
 public Task<MatchPage> List([FromQuery] Guid? cursor,CancellationToken ct) {
  if(Request.Query.Keys.Any(k=>k!="cursor")) throw new AuthFailure(400,"invalid_query");
  return service.List(Id,cursor,ct);
 }
 [HttpGet("matches/notices")]
 public Task<MatchNotification[]> Notices(CancellationToken ct)=>service.Notices(Id,ct);
 [HttpPost("matches/{match:guid}/acknowledge"),RequestSizeLimit(1024)]
 public async Task<IActionResult> Ack(Guid match,CancellationToken ct) { await service.Acknowledge(Id,match,ct); return NoContent(); }
}
