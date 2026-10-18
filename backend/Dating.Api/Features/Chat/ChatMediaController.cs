using Dating.Api.Features.Auth;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace Dating.Api.Features.Chat;

[ApiController]
[Route("api/chat/media")]
[EnableRateLimiting("chat")]
[ResponseCache(NoStore = true, Location = ResponseCacheLocation.None)]
public sealed class ChatMediaController(ChatMediaService mediaService) : ControllerBase
{
    private Guid? CurrentUserId => Guid.TryParse(User.FindFirst("sub")?.Value, out var id) ? id : null;

    [HttpPost("upload")]
    [Authorize]
    [RequestSizeLimit(12 * 1024 * 1024)] // 12 MB max
    public async Task<ActionResult<ChatMediaUploadResult>> Upload(
        [FromForm] IFormFile? file,
        [FromQuery] string? type,
        [FromQuery] double? duration,
        CancellationToken ct)
    {
        if (file is not null && file.Length > 0)
        {
            using var memoryStream = new MemoryStream();
            await file.CopyToAsync(memoryStream, ct);
            var bytes = memoryStream.ToArray();
            var mType = !string.IsNullOrWhiteSpace(type) ? type : (file.ContentType.StartsWith("audio") ? "voice" : "photo");

            var result = await mediaService.SaveMediaAsync(CurrentUserId ?? Guid.Empty, mType, bytes, file.ContentType, duration, ct);
            return Ok(result);
        }

        // Support direct body upload (octet-stream or raw binary)
        if (Request.Body.CanRead && Request.ContentLength is > 0)
        {
            using var ms = new MemoryStream();
            await Request.Body.CopyToAsync(ms, ct);
            var rawBytes = ms.ToArray();
            var mediaType = Request.Headers["X-Media-Type"].ToString();
            if (string.IsNullOrWhiteSpace(mediaType)) mediaType = type ?? "photo";
            var durHeader = Request.Headers["X-Duration"].ToString();
            double? dur = double.TryParse(durHeader, out var d) ? d : duration;
            var cType = Request.ContentType ?? "application/octet-stream";

            var result = await mediaService.SaveMediaAsync(CurrentUserId ?? Guid.Empty, mediaType, rawBytes, cType, dur, ct);
            return Ok(result);
        }

        throw new AuthFailure(400, "file_required");
    }

    [HttpGet("{id:guid}")]
    [Authorize]
    public async Task<IActionResult> GetMedia(Guid id, CancellationToken ct)
    {
        var media = await mediaService.GetMediaAsync(id, ct);
        if (media is null)
        {
            return NotFound();
        }

        Response.Headers["X-Content-Type-Options"] = "nosniff";
        return File(media.Value.Bytes, media.Value.ContentType, enableRangeProcessing: true);
    }
}
