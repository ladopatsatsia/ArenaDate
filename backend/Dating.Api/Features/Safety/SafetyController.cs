using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
namespace Dating.Api.Features.Safety;
[ApiController,Authorize,Route("api/safety"),EnableRateLimiting("chat")]
[ResponseCache(NoStore=true,Location=ResponseCacheLocation.None)]
public sealed class SafetyController(SafetyService service):ControllerBase {
 private Guid Id=>Guid.Parse(User.FindFirst("sub")!.Value);
 [HttpPost,RequestSizeLimit(16384)]
 public async Task<IActionResult> Execute(SafetyRequest input,CancellationToken ct){await service.Execute(Id,input,ct);return NoContent();}
 [HttpGet("blocks")] public Task<SafetyPage> Blocks([FromQuery] Guid? cursor,CancellationToken ct)=>service.List(Id,true,cursor,ct);
 [HttpGet("prior-conversations")] public Task<SafetyPage> Prior([FromQuery] Guid? cursor,CancellationToken ct)=>service.List(Id,false,cursor,ct);
}
