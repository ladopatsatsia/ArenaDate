using Dating.Api.Features.Chat;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
namespace Dating.Api.Features.Notifications;
[ApiController,Authorize,Route("api/notifications"),EnableRateLimiting("chat")]
[ResponseCache(NoStore=true,Location=ResponseCacheLocation.None)]
public sealed class PushController(PushService service,ChatService chat):ControllerBase {
 private Guid UserId=>Guid.Parse(User.FindFirst("sub")!.Value);
 private Guid Session=>Guid.Parse(User.FindFirst("sid")!.Value);
 [HttpGet("configuration")]public PushConfiguration Configuration()=>service.Configuration();
 [HttpPost("device"),RequestSizeLimit(4096)]public async Task<IActionResult> Device(DeviceRequest input,CancellationToken ct){await service.Register(UserId,Session,input,ct);return NoContent();}
 [HttpGet("preferences")]public Task<PushPreferences> Preferences(CancellationToken ct)=>service.Preferences(UserId,ct);
 [HttpPost("preferences"),RequestSizeLimit(1024)]public async Task<IActionResult> Preferences(PushPreferences input,CancellationToken ct){await service.SetPreferences(UserId,input,ct);return NoContent();}
 [HttpPost("resolve"),RequestSizeLimit(1024)]public Task<NotificationTarget> Resolve(ResolveNotification input,CancellationToken ct)=>service.Resolve(UserId,input.NotificationId,chat,ct);
}
