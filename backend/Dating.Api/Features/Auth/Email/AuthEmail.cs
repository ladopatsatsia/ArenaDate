namespace Dating.Api.Features.Auth.Email;
public sealed class AuthEmail
{
    public Guid Id { get; set; }
    public string ProtectedPayload { get; set; } = "";
    public int Attempts { get; set; }
    public DateTimeOffset NextAttemptAt { get; set; }
    public DateTimeOffset ExpiresAt { get; set; }
}
public sealed record EmailPayload(string To, string Subject, string Body);
public sealed class EmailOptions
{
    public string Mode { get; set; } = "";
    public string Host { get; set; } = "";
    public int Port { get; set; } = 587;
    public string Sender { get; set; } = "";
    public string Username { get; set; } = "";
    public string Password { get; set; } = "";
}
public interface IAuthEmailSender
{
    Task SendAsync(EmailPayload message, CancellationToken cancellationToken);
}
