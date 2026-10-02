using MailKit.Net.Smtp;
using MailKit.Security;
using Microsoft.Extensions.Options;
using MimeKit;

namespace Dating.Api.Features.Auth.Email;
public sealed class SmtpAuthEmailSender(IOptions<EmailOptions> settings, IHostEnvironment environment) : IAuthEmailSender
{
    public async Task SendAsync(EmailPayload payload, CancellationToken cancellationToken)
    {
        var options = settings.Value;
        var capture = options.Mode == "Capture";
        if (capture && !environment.IsDevelopment() && !environment.IsEnvironment("Testing"))
            throw new InvalidOperationException("Mail capture is development-only.");
        using var message = new MimeMessage();
        message.From.Add(MailboxAddress.Parse(options.Sender));
        message.To.Add(MailboxAddress.Parse(payload.To));
        message.Subject = payload.Subject;
        message.Body = new TextPart("plain") { Text = payload.Body };
        using var client = new SmtpClient();
        await client.ConnectAsync(options.Host, options.Port, capture ? SecureSocketOptions.None : SecureSocketOptions.StartTls, cancellationToken);
        if (!capture) await client.AuthenticateAsync(options.Username, options.Password, cancellationToken);
        await client.SendAsync(message, cancellationToken);
        await client.DisconnectAsync(true, cancellationToken);
    }
}
