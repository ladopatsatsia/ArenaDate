using System.ComponentModel.DataAnnotations;
using Microsoft.AspNetCore.Identity;

namespace Dating.Api.Features.Auth;

public sealed class AppUser : IdentityUser<Guid>
{
    public DateOnly DateOfBirth { get; set; }
    public bool IsActive { get; set; } = true;
}
public sealed class AuthSession
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public AppUser User { get; set; } = null!;
    public DateTimeOffset ExpiresAt { get; set; }
    public DateTimeOffset? RevokedAt { get; set; }
}
public sealed class RefreshCredential
{
    public string Hash { get; set; } = "";
    public Guid SessionId { get; set; }
    public AuthSession Session { get; set; } = null!;
    public DateTimeOffset? UsedAt { get; set; }
    public Guid? RequestId { get; set; }
    public string? ProtectedRetry { get; set; }
}
public sealed record RegisterRequest(
    [Required, EmailAddress, MaxLength(254)] string Email,
    [Required, MinLength(12), MaxLength(128)] string Password,
    DateOnly DateOfBirth);
public sealed record LoginRequest([Required, EmailAddress, MaxLength(254)] string Email, [Required, MaxLength(128)] string Password);
public sealed record EmailRequest([Required, EmailAddress, MaxLength(254)] string Email);
public sealed record VerifyRequest([Required, EmailAddress, MaxLength(254)] string Email, [Required, MaxLength(2048)] string Code);
public sealed record ResetRequest([Required, EmailAddress, MaxLength(254)] string Email,
    [Required, MaxLength(2048)] string Code, [Required, MinLength(12), MaxLength(128)] string Password);
public sealed record RefreshRequest([Required, MaxLength(128)] string RefreshToken, Guid RequestId);
public sealed record LogoutRequest([Required, MaxLength(128)] string RefreshToken);
public sealed record AccountResponse(Guid Id);
public sealed record TokenResponse(string AccessToken, DateTimeOffset AccessExpiresAt, string RefreshToken, DateTimeOffset SessionExpiresAt, AccountResponse Account);
public sealed record AcceptedResponse(string Message = "If the request is eligible, an email will be sent.");
public sealed class AuthFailure(int status, string code) : Exception
{
    public int Status { get; } = status;
    public string Code { get; } = code;
}
public static class AdultPolicy
{
    public static bool IsAdult(DateOnly dateOfBirth, DateTimeOffset now) =>
        dateOfBirth <= DateOnly.FromDateTime(now.UtcDateTime).AddYears(-18) &&
        dateOfBirth >= DateOnly.FromDateTime(now.UtcDateTime).AddYears(-120);
}
