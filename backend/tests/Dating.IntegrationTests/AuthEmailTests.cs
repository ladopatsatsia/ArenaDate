using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Dating.Api.Features.Auth;
using Dating.Api.Features.Auth.Email;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.FileProviders;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using Xunit;

namespace Dating.IntegrationTests;
public class AuthEmailTests
{
    [Fact]
    public async Task Email_queue_retries_failure_and_removes_delivered_secret_payload()
    {
        await using var h = await AuthHarness.Create();
        await h.Client.PostAsJsonAsync("/api/auth/register", new RegisterRequest("queue@example.test", AuthHarness.Password, new(1990, 1, 1)));
        var worker = new AuthEmailWorker(h.Factory.Services.GetRequiredService<IServiceScopeFactory>(), TimeProvider.System, NullLogger<AuthEmailWorker>.Instance);
        h.Sender.Fail = true;
        await worker.DeliverOne(CancellationToken.None);
        await h.Db(async db =>
        {
            var row = await db.AuthEmails.SingleAsync();
            Assert.Equal(1, row.Attempts);
            Assert.True(row.NextAttemptAt > DateTimeOffset.UtcNow);
            Assert.DoesNotContain("queue@example", row.ProtectedPayload);
            row.NextAttemptAt = DateTimeOffset.UtcNow.AddSeconds(-1);
            await db.SaveChangesAsync();
        });
        h.Sender.Fail = false;
        await worker.DeliverOne(CancellationToken.None);
        Assert.Single(h.Sender.Messages);
        await h.Db(async db => Assert.Empty(await db.AuthEmails.ToListAsync()));
    }
    [Fact]
    public async Task Expired_confirmation_and_reset_codes_are_rejected()
    {
        await using var h = await AuthHarness.Create();
        const string address = "expiry@example.test";
        await h.Client.PostAsJsonAsync("/api/auth/register", new RegisterRequest(address, AuthHarness.Password, new(1990, 1, 1)));
        var code = await h.Code(address, "verify");
        var options = h.Factory.Services.GetRequiredService<IOptions<DataProtectionTokenProviderOptions>>().Value;
        options.TokenLifespan = TimeSpan.FromSeconds(-1);
        Assert.Equal(HttpStatusCode.BadRequest, (await h.Client.PostAsJsonAsync("/api/auth/verify", new VerifyRequest(address, code))).StatusCode);
        options.TokenLifespan = TimeSpan.FromHours(1);
        Assert.Equal(HttpStatusCode.NoContent, (await h.Client.PostAsJsonAsync("/api/auth/verify", new VerifyRequest(address, code))).StatusCode);
        await h.Client.PostAsJsonAsync("/api/auth/forgot-password", new EmailRequest(address));
        var reset = await h.Code(address, "reset");
        options.TokenLifespan = TimeSpan.FromSeconds(-1);
        Assert.Equal(HttpStatusCode.BadRequest, (await h.Client.PostAsJsonAsync("/api/auth/reset-password", new ResetRequest(address, reset, "Another password 2026!"))).StatusCode);
    }
    [Fact]
    public async Task Actual_SMTP_delivers_to_local_Mailpit()
    {
        // Required local capture service, not a mock or an external recipient.
        var sender = new SmtpAuthEmailSender(Options.Create(new EmailOptions
        { Mode = "Capture", Host = "127.0.0.1", Port = 1025, Sender = "tests@dating.local" }), new LocalEnvironment());
        var subject = "DatingMVP auth test " + Guid.NewGuid().ToString("N");
        await sender.SendAsync(new EmailPayload("capture@example.test", subject, "Local SMTP integration check."), CancellationToken.None);
        using var client = new HttpClient { BaseAddress = new Uri("http://127.0.0.1:8025") };
        var json = await client.GetFromJsonAsync<JsonElement>("/api/v1/messages");
        Assert.Contains(json.GetProperty("messages").EnumerateArray(), m => m.GetProperty("Subject").GetString() == subject);
    }
    private sealed class LocalEnvironment : IHostEnvironment
    {
        public string EnvironmentName { get; set; } = Environments.Development;
        public string ApplicationName { get; set; } = "DatingTests";
        public string ContentRootPath { get; set; } = AppContext.BaseDirectory;
        public IFileProvider ContentRootFileProvider { get; set; } = new NullFileProvider();
    }
}
