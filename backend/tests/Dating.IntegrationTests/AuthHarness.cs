using Dating.Api.Features.Notifications;
using System.Net.Http.Json;
using System.Text.Json;
using Dating.Api.Features.Auth;
using Dating.Api.Features.Auth.Email;
using Dating.Api.Persistence;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Npgsql;
using System.Security.Cryptography;
using System.Security.Cryptography.X509Certificates;
using Microsoft.AspNetCore.Server.Kestrel.Core;
using Xunit;

namespace Dating.IntegrationTests;
internal sealed class AuthHarness : IAsyncDisposable
{
    public const string Password = "Correct horse battery 2026!";
    public string Connection { get; private init; } = "";
    private string adminConnection = "";
    private string database = "";
    public WebApplicationFactory<Program> Factory { get; private init; } = null!;
    public HttpClient Client { get; private init; } = null!;
    public sealed class RecordingSender : IAuthEmailSender
    {
        public bool Fail { get; set; }
        public List<EmailPayload> Messages { get; } = [];
        public Task SendAsync(EmailPayload message, CancellationToken ct)
        { if (Fail) throw new IOException("Simulated delivery failure"); Messages.Add(message); return Task.CompletedTask; }
    }
    public RecordingSender Sender { get; private init; } = null!;
    public DbReadCounter ReadCounter { get; private init; } = null!;
    public sealed class RecordingPush : IPushProvider {
        public List<(string Token,Guid Notification,string Kind)> Sent {get;}=[];
        public Queue<PushResult> Sends {get;}=new();public Queue<PushResult> Receipts {get;}=new();public bool Fail {get;set;}
        public Task<PushResult> Send(string token,Guid notification,string kind,CancellationToken ct){
            Sent.Add((token,notification,kind));if(Fail)throw new IOException("test failure");
            return Task.FromResult(Sends.Count>0?Sends.Dequeue():new PushResult("ticket","queued",Guid.NewGuid().ToString()));
        }
        public Task<PushResult> Receipt(string ticket,CancellationToken ct)=>Task.FromResult(Receipts.Count>0?Receipts.Dequeue():new PushResult("ok","accepted"));
    }
    public RecordingPush Push {get;private init;}=null!;
    public const string PushProject="59d15e99-f1f5-469e-8122-0637b56ead44";
    private sealed class FactoryImpl(string connection, RecordingSender sender, DbReadCounter counter,RecordingPush push,bool enablePush) : WebApplicationFactory<Program>
    {
        protected override void ConfigureWebHost(IWebHostBuilder builder)
        {
            builder.UseEnvironment("Testing");
            builder.ConfigureAppConfiguration((_, c) => c.AddInMemoryCollection(TestAuthSettings.Configuration(connection)));
            builder.ConfigureTestServices(services =>
            {
                services.AddSingleton<IAuthEmailSender>(sender);
                if(enablePush){
                    services.Configure<PushOptions>(o=>{o.Enabled=true;o.ProjectId=PushProject;o.AccessToken="test-only";o.CurrentKeyId="test";o.Keys["test"]=Convert.ToBase64String(System.Security.Cryptography.RandomNumberGenerator.GetBytes(32));});
                    services.AddSingleton<IPushProvider>(push);
                }
                services.ConfigureDbContext<AppDbContext>(options => options.AddInterceptors(counter));
                foreach (var item in services.Where(d => d.ImplementationType == typeof(Dating.Api.Features.Notifications.PushWorker) || d.ImplementationType == typeof(Dating.Api.Features.Safety.SafetyCleanup) || d.ImplementationType == typeof(Dating.Api.Features.Chat.ChatOutboxWorker) || d.ImplementationType == typeof(Dating.Api.Features.Matching.MatchOutboxWorker) || d.ImplementationType == typeof(AuthEmailWorker) || d.ImplementationType == typeof(Dating.Api.Features.Profiles.MediaCleanup)).ToArray()) services.Remove(item);
            });
        }
    }
    public static async Task<AuthHarness> Create(bool enablePush=false, X509Certificate2? browserCertificate=null)
    {
        var adminConnection = Environment.GetEnvironmentVariable("TEST_DATABASE_CONNECTION") ?? throw new InvalidOperationException("Real Postgres required.");
        var name = "auth_" + Guid.NewGuid().ToString("N");
        await using var admin = new NpgsqlConnection(adminConnection);
        await admin.OpenAsync();
        await using (var command = new NpgsqlCommand($"CREATE DATABASE {name}", admin)) await command.ExecuteNonQueryAsync();
        var connection = new NpgsqlConnectionStringBuilder(adminConnection) { Database = name, Pooling = false }.ConnectionString;
        var sender = new RecordingSender();
        var counter = new DbReadCounter();
        var push=new RecordingPush();
        var factory = new FactoryImpl(connection, sender, counter,push,enablePush);
        if(browserCertificate is not null)factory.UseKestrel(o=>o.Listen(System.Net.IPAddress.Loopback,0,l=>l.UseHttps(browserCertificate)));
        var client = factory.CreateClient();
        if(browserCertificate is not null){var address=client.BaseAddress;client.Dispose();client=new HttpClient(new HttpClientHandler{ServerCertificateCustomValidationCallback=HttpClientHandler.DangerousAcceptAnyServerCertificateValidator}){BaseAddress=address};}
        var harness = new AuthHarness { adminConnection = adminConnection, database = name, Connection = connection, Sender = sender, Push=push, ReadCounter = counter, Factory = factory, Client = client };
        await harness.Db(async db => { await db.Database.MigrateAsync(); });
        return harness;
    }
    public async Task Db(Func<AppDbContext, Task> action)
    {
        using var scope = Factory.Services.CreateScope();
        await action(scope.ServiceProvider.GetRequiredService<AppDbContext>());
    }
    public async Task<string> Code(string address, string kind)
    {
        using var scope = Factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var protector = scope.ServiceProvider.GetRequiredService<IDataProtectionProvider>().CreateProtector(AuthEmailQueue.Purpose);
        var records = await db.AuthEmails.OrderByDescending(e => e.ExpiresAt).ToListAsync();
        var mail = records.Select(e => JsonSerializer.Deserialize<EmailPayload>(protector.Unprotect(e.ProtectedPayload))!)
            .First(e => e.To == address && e.Subject.EndsWith(kind, StringComparison.Ordinal));
        return mail.Body.Split("\n\n")[1];
    }
    public async Task<TokenResponse> Account(string address)
    {
        var register = await Client.PostAsJsonAsync("/api/auth/register", new RegisterRequest(address, Password, new DateOnly(1990, 1, 1)));
        Assert.Equal(System.Net.HttpStatusCode.Accepted, register.StatusCode);
        var verify = await Client.PostAsJsonAsync("/api/auth/verify", new VerifyRequest(address, await Code(address, "verify")));
        Assert.Equal(System.Net.HttpStatusCode.NoContent, verify.StatusCode);
        return await Login(address);
    }
    public async Task<TokenResponse> Login(string address, string password = Password)
    {
        var response = await Client.PostAsJsonAsync("/api/auth/login", new LoginRequest(address, password));
        Assert.Equal(System.Net.HttpStatusCode.OK, response.StatusCode);
        return (await response.Content.ReadFromJsonAsync<TokenResponse>())!;
    }
    public Task<HttpResponseMessage> Me(string token)
    {
        var request = new HttpRequestMessage(HttpMethod.Get, "/api/auth/me");
        request.Headers.Authorization = new("Bearer", token);
        return Client.SendAsync(request);
    }
    public async ValueTask DisposeAsync()
    {
        Client.Dispose();
        await Factory.DisposeAsync();
        await using var admin = new NpgsqlConnection(adminConnection);
        await admin.OpenAsync();
        await using var command = new NpgsqlCommand($"DROP DATABASE {database} WITH (FORCE)", admin);
        await command.ExecuteNonQueryAsync();
    }
}
