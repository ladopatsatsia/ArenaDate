using System.ComponentModel.DataAnnotations;

namespace Dating.Api.Features.AccountLifecycle;

public sealed class AccountDeletionJob
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public string State { get; set; } = "pending";
    public int Attempts { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset NextAttemptAt { get; set; }
    public DateTimeOffset? CompletedAt { get; set; }
    public string? LastError { get; set; }
}

public sealed class DeletionTombstone
{
    public Guid UserId { get; set; }
    public string EmailHash { get; set; } = "";
    public DateTimeOffset DeletedAt { get; set; }
}

public sealed record DeleteAccountRequest(
    [MaxLength(128)] string? Password = null);

public sealed record DeletionStatusResponse(
    Guid UserId,
    string Status,
    DateTimeOffset RequestedAt,
    DateTimeOffset? CompletedAt);

public sealed record PublicDeletionRequest(
    [Required, EmailAddress, MaxLength(254)] string Email);

public sealed record ConfirmPublicDeletionRequest(
    [Required, EmailAddress, MaxLength(254)] string Email,
    [Required, MaxLength(2048)] string Token);

public sealed record DiscoverabilityPauseRequest(bool Paused);
