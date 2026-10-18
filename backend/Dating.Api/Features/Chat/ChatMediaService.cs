using System.Text.Json;
using Dating.Api.Features.Auth;
using Dating.Api.Features.Profiles;
using Microsoft.Extensions.Options;

namespace Dating.Api.Features.Chat;

public sealed class ChatMediaService(IOptions<MediaOptions> mediaOptions, PhotoProcessor photoProcessor)
{
    private string GetStorageDir()
    {
        var basePath = !string.IsNullOrWhiteSpace(mediaOptions.Value?.LocalPath)
            ? Path.GetFullPath(mediaOptions.Value.LocalPath)
            : Path.Combine(AppContext.BaseDirectory, ".media");
        var chatMediaDir = Path.Combine(basePath, "chat");
        Directory.CreateDirectory(chatMediaDir);
        return chatMediaDir;
    }

    public async Task<ChatMediaUploadResult> SaveMediaAsync(
        Guid userId,
        string mediaType,
        byte[] data,
        string contentType,
        double? duration,
        CancellationToken ct)
    {
        var cleanType = (mediaType ?? "photo").Trim().ToLowerInvariant();
        if (cleanType is not ("photo" or "voice"))
            throw new AuthFailure(400, "invalid_media_type");

        if (data is null || data.Length == 0)
            throw new AuthFailure(400, "media_data_empty");

        var mediaId = Guid.NewGuid();
        var dir = GetStorageDir();
        byte[] finalBytes;
        string finalContentType;
        string extension;

        if (cleanType == "photo")
        {
            if (data.Length > 10 * 1024 * 1024)
                throw new AuthFailure(400, "photo_too_large");

            try
            {
                var processed = await photoProcessor.Process(data, ct);
                finalBytes = processed.Image;
                finalContentType = "image/jpeg";
                extension = ".jpg";
            }
            catch (AuthFailure)
            {
                throw;
            }
            catch
            {
                // Fallback for valid image formats that PhotoProcessor couldn't decode
                finalBytes = data;
                finalContentType = !string.IsNullOrWhiteSpace(contentType) && contentType.StartsWith("image/")
                    ? contentType
                    : "image/jpeg";
                extension = ".jpg";
            }
        }
        else // voice
        {
            if (data.Length > 10 * 1024 * 1024)
                throw new AuthFailure(400, "voice_too_large");

            finalBytes = data;
            finalContentType = !string.IsNullOrWhiteSpace(contentType) && contentType.StartsWith("audio/")
                ? contentType
                : "audio/webm";

            extension = finalContentType.Contains("mp4") || finalContentType.Contains("m4a") ? ".m4a"
                      : finalContentType.Contains("wav") ? ".wav"
                      : finalContentType.Contains("mpeg") || finalContentType.Contains("mp3") ? ".mp3"
                      : ".webm";
        }

        var filePath = Path.Combine(dir, $"{mediaId:N}{extension}");
        await File.WriteAllBytesAsync(filePath, finalBytes, ct);

        var meta = new ChatMediaMetadata(
            mediaId,
            userId,
            cleanType,
            finalContentType,
            duration,
            DateTimeOffset.UtcNow
        );
        var metaPath = Path.Combine(dir, $"{mediaId:N}.meta");
        await File.WriteAllTextAsync(metaPath, JsonSerializer.Serialize(meta), ct);

        return new ChatMediaUploadResult(
            mediaId,
            cleanType,
            $"/api/chat/media/{mediaId}",
            duration
        );
    }

    public async Task<(byte[] Bytes, string ContentType)?> GetMediaAsync(Guid mediaId, CancellationToken ct)
    {
        var dir = GetStorageDir();
        var metaPath = Path.Combine(dir, $"{mediaId:N}.meta");
        if (!File.Exists(metaPath))
            return null;

        var metaJson = await File.ReadAllTextAsync(metaPath, ct);
        var meta = JsonSerializer.Deserialize<ChatMediaMetadata>(metaJson);
        if (meta is null)
            return null;

        var extension = meta.MediaType == "photo" ? ".jpg"
            : meta.ContentType.Contains("mp4") || meta.ContentType.Contains("m4a") ? ".m4a"
            : meta.ContentType.Contains("wav") ? ".wav"
            : meta.ContentType.Contains("mpeg") || meta.ContentType.Contains("mp3") ? ".mp3"
            : ".webm";

        var filePath = Path.Combine(dir, $"{mediaId:N}{extension}");
        if (!File.Exists(filePath))
            return null;

        var bytes = await File.ReadAllBytesAsync(filePath, ct);
        return (bytes, meta.ContentType);
    }
}
