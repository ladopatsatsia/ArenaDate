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

 [HttpGet("telegram")]
 public Task<TelegramSubscriberStatusDto> TelegramStatus([FromServices] ITelegramNotificationService telegram, CancellationToken ct)
  => telegram.GetUserStatusAsync(UserId, ct);

 [HttpPost("telegram/toggle"),RequestSizeLimit(1024)]
 public async Task<IActionResult> TelegramToggle([FromBody] TelegramToggleRequest input, [FromServices] ITelegramNotificationService telegram, CancellationToken ct){
  var ok = await telegram.SetUserActiveAsync(UserId, input.IsActive, ct);
  if (!ok) return NotFound(new { error = "telegram_not_linked" });
  return Ok(new { success = true, isActive = input.IsActive });
 }

 [HttpPost("telegram/test"),RequestSizeLimit(1024)]
 public async Task<IActionResult> TelegramTest([FromServices] ITelegramNotificationService telegram, CancellationToken ct){
  var sent = await telegram.SendTestNotificationAsync(UserId, ct);
  if (!sent) return BadRequest(new { error = "telegram_test_failed" });
  return Ok(new { success = true, message = "test_sent" });
 }

 [HttpPost("telegram/link"),RequestSizeLimit(2048)]
 public async Task<IActionResult> TelegramLink([FromBody] TelegramLinkRequest input, [FromServices] ITelegramNotificationService telegram, CancellationToken ct){
  var ok = await telegram.LinkUserAsync(UserId, input.TelegramUserId, input.ChatId, input.Username, input.FirstName, input.LastName, ct);
  return Ok(new { success = ok });
 }
}
