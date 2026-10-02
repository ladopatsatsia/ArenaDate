using System.Text.Json;
using Dating.Api.Persistence;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.EntityFrameworkCore;

namespace Dating.Api.Features.Auth.Email;
public sealed class AuthEmailQueue(AppDbContext db, IDataProtectionProvider protection, TimeProvider clock)
{
    public static string Purpose => "DatingMVP.AuthEmail.v1";
    public void Enqueue(string email, string kind, string code)
    {
        var payload = new EmailPayload(email, "DatingMVP: " + kind,
            "Use this code in the DatingMVP " + kind + " screen. It expires in one hour.\n\n" + code +
            "\n\nIf you did not request this, ignore this email. Never share this code.");
        db.AuthEmails.Add(new AuthEmail { Id = Guid.NewGuid(),
            ProtectedPayload = protection.CreateProtector(Purpose).Protect(JsonSerializer.Serialize(payload)),
            NextAttemptAt = clock.GetUtcNow(), ExpiresAt = clock.GetUtcNow().AddHours(1) });
    }
}
public sealed class AuthEmailWorker(IServiceScopeFactory scopes, TimeProvider clock, ILogger<AuthEmailWorker> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            try { await DeliverOne(stoppingToken); }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested) { break; }
            catch (Exception) { logger.LogWarning("Auth email worker could not process a delivery. No payload was logged."); }
            try { await Task.Delay(TimeSpan.FromSeconds(5), stoppingToken); }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested) { break; }
        }
    }
    public async Task DeliverOne(CancellationToken ct)
    {
        using var scope = scopes.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var now = clock.GetUtcNow();
        await db.AuthEmails.Where(e => e.ExpiresAt <= now).ExecuteDeleteAsync(ct);
        var retryCutoff = now.AddSeconds(-30);
        await db.RefreshCredentials.Where(r => r.ProtectedRetry != null && r.UsedAt < retryCutoff)
            .ExecuteUpdateAsync(s => s.SetProperty(r => r.ProtectedRetry, (string?)null), ct);
        await db.Sessions.Where(s => s.ExpiresAt <= now).ExecuteDeleteAsync(ct);
        await using var tx = await db.Database.BeginTransactionAsync(ct);
        var email = await db.AuthEmails.FromSqlInterpolated(
            $"""SELECT * FROM "AuthEmails" WHERE "NextAttemptAt" <= {now} AND "Attempts" < 6 ORDER BY "NextAttemptAt" FOR UPDATE SKIP LOCKED LIMIT 1""")
            .FirstOrDefaultAsync(ct);
        if (email is null) return;
        // Lease survives crashes. SMTP is at-least-once: a crash after sending may duplicate an email, not its effect.
        email.Attempts++;
        email.NextAttemptAt = now.AddMinutes(2);
        await db.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);
        try
        {
            var protector = scope.ServiceProvider.GetRequiredService<IDataProtectionProvider>().CreateProtector(AuthEmailQueue.Purpose);
            var payload = JsonSerializer.Deserialize<EmailPayload>(protector.Unprotect(email.ProtectedPayload))!;
            using var timeout = CancellationTokenSource.CreateLinkedTokenSource(ct);
            timeout.CancelAfter(TimeSpan.FromSeconds(30));
            await scope.ServiceProvider.GetRequiredService<IAuthEmailSender>().SendAsync(payload, timeout.Token);
            db.AuthEmails.Remove(email);
        }
        catch (Exception) when (!ct.IsCancellationRequested)
        {
            email.NextAttemptAt = now.AddSeconds(Math.Min(1800, Math.Pow(2, email.Attempts) * 15));
            logger.LogWarning("Auth email delivery failed. Attempt {Attempt}; payload redacted.", email.Attempts);
        }
        await db.SaveChangesAsync(ct);
    }
}
