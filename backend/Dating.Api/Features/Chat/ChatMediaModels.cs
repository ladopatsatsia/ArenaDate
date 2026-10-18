using System.ComponentModel.DataAnnotations;

namespace Dating.Api.Features.Chat;

public sealed record ChatMediaUploadResult(
    Guid Id,
    string MediaType,
    string Url,
    double? Duration
);

public sealed record ChatMediaMetadata(
    Guid Id,
    Guid UserId,
    string MediaType,
    string ContentType,
    double? Duration,
    DateTimeOffset CreatedAtUtc
);
