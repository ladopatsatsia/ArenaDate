using Dating.Api.Features.Auth;
using Dating.Api.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
namespace Dating.Api.Features.Profiles;
[ApiController, Authorize, Route("api/profile"), EnableRateLimiting("profile")]
[ResponseCache(NoStore = true, Location = ResponseCacheLocation.None)]
public sealed class ProfileController(ProfileService profiles, MediaAccess media, IPrivateStorage storage) : ControllerBase
{
    private Guid UserId => Guid.Parse(User.FindFirst("sub")!.Value);
    [HttpGet] public Task<OwnProfileDto> Get(CancellationToken ct) => profiles.Get(UserId, ct);
    [HttpGet("choices")] public ProfileChoices Choices() => new(ProfileRules.Genders, ProfileRules.Interests, ProfileRules.Goals, ProfileRules.Languages);
    [HttpPost, RequestSizeLimit(8192)] public Task<OwnProfileDto> Save(ProfileUpdate request, CancellationToken ct) => profiles.Save(UserId, request, ct);
    [HttpPost("language"), HttpPut("language"), RequestSizeLimit(512)]
    public async Task<IActionResult> SetLanguage(UpdateLanguageRequest request, CancellationToken ct)
    {
        await profiles.SetAppLanguage(UserId, request.Language, ct);
        return NoContent();
    }
    [HttpPost("photos/uploads"), RequestSizeLimit(1024)]
    public Task<PhotoDto> Begin(UploadRequest request, CancellationToken ct) => profiles.Begin(UserId, request.RequestId, ct);
    [HttpPost("photos/{photoId:guid}/finalize"), RequestSizeLimit(PhotoProcessor.MaxBytes)]
    [Consumes("application/octet-stream"), ProducesResponseType<PhotoDto>(200)]
    public async Task<PhotoDto> Finalize(Guid photoId, CancellationToken ct)
    {
        if (Request.ContentLength > PhotoProcessor.MaxBytes) throw new AuthFailure(400, "invalid_photo");
        using var output = new MemoryStream();
        var buffer = new byte[81920];
        int read;
        while ((read = await Request.Body.ReadAsync(buffer, ct)) > 0)
        { if (output.Length + read > PhotoProcessor.MaxBytes) throw new AuthFailure(400, "invalid_photo"); await output.WriteAsync(buffer.AsMemory(0, read), ct); }
        return await profiles.Finalize(UserId, photoId, output.ToArray(), ct);
    }
    [HttpPost("photos/reorder"), RequestSizeLimit(2048)] public Task<OwnProfileDto> Reorder(ReorderRequest request, CancellationToken ct) => profiles.Reorder(UserId, request, ct);
    [HttpDelete("photos/{photoId:guid}")] public async Task<IActionResult> Remove(Guid photoId, CancellationToken ct) { await profiles.Remove(UserId, photoId, ct); return NoContent(); }
    [HttpPost("photos/{photoId:guid}/access")] public Task<MediaGrant> Access(Guid photoId, CancellationToken ct) => media.Grant(UserId, photoId, ct);
    [HttpGet("photos/{photoId:guid}/content")]
    public async Task<IActionResult> Content(Guid photoId, [FromQuery, RequiredTicket] string ticket, [FromQuery] bool thumbnail, CancellationToken ct)
    {
        var photo = await media.Redeem(UserId, photoId, ticket, ct);
        var bytes = await storage.Get(thumbnail ? photo.ThumbnailKey : photo.ObjectKey, ct);
        Response.Headers["X-Content-Type-Options"] = "nosniff";
        return File(bytes, "image/jpeg");
    }
}
public sealed class RequiredTicketAttribute : System.ComponentModel.DataAnnotations.ValidationAttribute
{
    public override bool IsValid(object? value) => value is string s && s.Length is > 0 and <= 4096;
}
