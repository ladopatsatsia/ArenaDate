using Dating.Api.Features.Auth;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
namespace Dating.Api.Features.Chat;
[ApiController,Authorize,Route("api/conversations/{conversation:guid}"),EnableRateLimiting("chat")]
[ResponseCache(NoStore=true,Location=ResponseCacheLocation.None)]
public sealed class ChatController(ChatService service):ControllerBase {
 private Guid Id=>Guid.Parse(User.FindFirst("sub")!.Value);
 [HttpGet("messages")]
 public Task<HistoryPage> History(Guid conversation,[FromQuery] long? before,[FromQuery] long? after,CancellationToken ct) {
  if(Request.Query.Keys.Any(k=>k is not ("before" or "after"))) throw new AuthFailure(400,"invalid_query");
  return service.History(Id,conversation,before,after,ct);
 }
 [HttpPost("messages"),RequestSizeLimit(16384)]
 public Task<MessageDto> Send(Guid conversation,SendMessage input,CancellationToken ct)=>service.Send(Id,conversation,input,ct);
 [HttpPost("read"),RequestSizeLimit(1024)]
 public Task<ReadDto> Read(Guid conversation,ReadMessage input,CancellationToken ct)=>service.Read(Id,conversation,input,ct);
}
