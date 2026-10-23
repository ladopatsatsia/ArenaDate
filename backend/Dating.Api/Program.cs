using Dating.Api.Infrastructure;
using Dating.Api.Features.Auth;
using Dating.Api.Features.Profiles;
using Dating.Api.Persistence;
using Dating.Api.Features.Moderation;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

var builder = WebApplication.CreateBuilder(args);
var portEnv = Environment.GetEnvironmentVariable("PORT");
if (!string.IsNullOrWhiteSpace(portEnv))
{
    builder.WebHost.UseUrls($"http://0.0.0.0:{portEnv}");
}
if (string.IsNullOrWhiteSpace(builder.Configuration["Auth:SigningKeyPem"]))
{
    using var rsa = System.Security.Cryptography.RSA.Create(2048);
    builder.Configuration["Auth:SigningKeyPem"] = rsa.ExportPkcs8PrivateKeyPem();
}
if (string.IsNullOrWhiteSpace(builder.Configuration["Auth:KeyRingPath"]))
{
    var keyring = Path.Combine(AppContext.BaseDirectory, "auth-keyring");
    Directory.CreateDirectory(keyring);
    builder.Configuration["Auth:KeyRingPath"] = keyring;
}
if (string.IsNullOrWhiteSpace(builder.Configuration["Auth:Issuer"]))
{
    builder.Configuration["Auth:Issuer"] = "dating-api";
}
if (string.IsNullOrWhiteSpace(builder.Configuration["Auth:Audience"]))
{
    builder.Configuration["Auth:Audience"] = "dating-clients";
}
if (string.IsNullOrWhiteSpace(builder.Configuration["Email:Mode"]))
{
    if (builder.Environment.IsDevelopment() || builder.Environment.IsEnvironment("Testing"))
    {
        builder.Configuration["Email:Mode"] = "Capture";
        builder.Configuration["Email:Host"] = "127.0.0.1";
        builder.Configuration["Email:Port"] = "1025";
        builder.Configuration["Email:Sender"] = "no-reply@dating.local";
    }
}
if (string.IsNullOrWhiteSpace(builder.Configuration["Media:Mode"]))
{
    builder.Configuration["Media:Mode"] = "Local";
    var mediaDir = Path.Combine(AppContext.BaseDirectory, "private-media");
    Directory.CreateDirectory(mediaDir);
    builder.Configuration["Media:LocalPath"] = mediaDir;
}
builder.Logging.ClearProviders();
builder.Logging.AddJsonConsole();
builder.Services.AddOpenApi();
builder.Services.AddControllers().ConfigureApiBehaviorOptions(options =>
    options.InvalidModelStateResponseFactory = context => new BadRequestObjectResult(
        SafeProblems.Create(context.HttpContext, 400, "Invalid request.")));
builder.Services.AddProblemDetails(options => options.CustomizeProblemDetails = context =>
{
    context.ProblemDetails.Detail = null;
    context.ProblemDetails.Instance = null;
    context.ProblemDetails.Extensions.Clear();
    context.ProblemDetails.Extensions["correlationId"] = context.HttpContext.TraceIdentifier;
});
builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
    {
        policy.SetIsOriginAllowed(_ => true)
              .AllowAnyHeader()
              .AllowAnyMethod()
              .AllowCredentials();
    });
});
var databaseUrl = Environment.GetEnvironmentVariable("DATABASE_URL");
if (!string.IsNullOrWhiteSpace(databaseUrl) && string.IsNullOrWhiteSpace(builder.Configuration.GetConnectionString("Database")))
{
    var formattedConnection = databaseUrl;
    if (databaseUrl.StartsWith("postgresql://", StringComparison.OrdinalIgnoreCase) ||
        databaseUrl.StartsWith("postgres://", StringComparison.OrdinalIgnoreCase))
    {
        var uri = new Uri(databaseUrl);
        var userInfo = uri.UserInfo.Split(':');
        var username = userInfo.Length > 0 ? Uri.UnescapeDataString(userInfo[0]) : "";
        var password = userInfo.Length > 1 ? Uri.UnescapeDataString(userInfo[1]) : "";
        var port = uri.Port > 0 ? uri.Port : 5432;
        var database = uri.AbsolutePath.TrimStart('/');
        formattedConnection = $"Host={uri.Host};Port={port};Database={database};Username={username};Password={password};Include Error Detail=true";
    }
    builder.Configuration["ConnectionStrings:Database"] = formattedConnection;
}

builder.Services.Configure<ForwardedHeadersOptions>(options =>
{
    options.ForwardedHeaders = Microsoft.AspNetCore.HttpOverrides.ForwardedHeaders.XForwardedFor | Microsoft.AspNetCore.HttpOverrides.ForwardedHeaders.XForwardedProto;
    options.KnownIPNetworks.Clear();
    options.KnownProxies.Clear();
});

builder.Services.AddOptions<DatabaseSettings>().BindConfiguration("ConnectionStrings")
    .Validate(settings => !string.IsNullOrWhiteSpace(settings.Database), "ConnectionStrings__Database is required.")
    .ValidateOnStart();
builder.Services.AddDbContext<AppDbContext>((services, options) =>
{
    var connection = services.GetRequiredService<IConfiguration>().GetConnectionString("Database")
        ?? throw new InvalidOperationException("Configure ConnectionStrings__Database.");

    if (connection.StartsWith("postgresql://", StringComparison.OrdinalIgnoreCase) ||
        connection.StartsWith("postgres://", StringComparison.OrdinalIgnoreCase))
    {
        var uri = new Uri(connection);
        var userInfo = uri.UserInfo.Split(':');
        var username = userInfo.Length > 0 ? Uri.UnescapeDataString(userInfo[0]) : "";
        var password = userInfo.Length > 1 ? Uri.UnescapeDataString(userInfo[1]) : "";
        var port = uri.Port > 0 ? uri.Port : 5432;
        var database = uri.AbsolutePath.TrimStart('/');
        connection = $"Host={uri.Host};Port={port};Database={database};Username={username};Password={password};Include Error Detail=true";
    }

    options.UseNpgsql(connection, npgsql => npgsql.UseNetTopologySuite());
});
builder.Services.AddDatingAuth();
builder.Services.AddModeration();
builder.Services.AddScoped<Dating.Api.Features.Premium.IPremiumService, Dating.Api.Features.Premium.PremiumService>();
builder.Services.AddHttpClient<Dating.Api.Features.Premium.ITelegramPaymentService, Dating.Api.Features.Premium.TelegramPaymentService>(c =>
{
    c.Timeout = TimeSpan.FromSeconds(10);
});
builder.Services.AddHttpClient<Dating.Api.Features.Notifications.ITelegramNotificationService, Dating.Api.Features.Notifications.TelegramNotificationService>(c =>
{
    c.Timeout = TimeSpan.FromSeconds(10);
});
builder.Services.AddProfileMedia();
builder.Services.AddScoped<Dating.Api.Features.Discovery.DiscoveryEligibility>();
builder.Services.AddScoped<Dating.Api.Features.Discovery.DiscoveryService>();
builder.Services.AddScoped<Dating.Api.Features.Matching.PairSynchronization>();
builder.Services.AddScoped<Dating.Api.Features.Matching.MatchService>();
builder.Services.AddScoped<Dating.Api.Features.Matching.PairLifecycle>();
builder.Services.AddScoped<Dating.Api.Features.Matching.MatchOutbox>();
builder.Services.AddHostedService<Dating.Api.Features.Matching.MatchOutboxWorker>();
builder.Services.AddScoped<Dating.Api.Features.Chat.ChatService>();
builder.Services.AddScoped<Dating.Api.Features.Chat.ChatMediaService>();
builder.Services.AddScoped<Dating.Api.Features.Chat.ChatOutbox>();
builder.Services.AddSingleton<Dating.Api.Features.Chat.ChatConnections>();
builder.Services.AddHostedService<Dating.Api.Features.Chat.ChatOutboxWorker>();
builder.Services.AddScoped<Dating.Api.Features.Safety.SafetyService>();
builder.Services.AddHostedService<Dating.Api.Features.Safety.SafetyCleanup>();
builder.Services.AddSignalR(o => { o.EnableDetailedErrors=false; o.MaximumReceiveMessageSize=4096; o.MaximumParallelInvocationsPerClient=1; });
builder.Services.AddOptions<Dating.Api.Features.Notifications.PushOptions>().BindConfiguration("Push").Validate(o=>o.Valid(),"Enabled push requires project ID, Expo access token and a separate 32-byte encryption key ring.").ValidateOnStart();
builder.Services.AddSingleton<Dating.Api.Features.Notifications.PushCrypto>();
builder.Services.AddScoped<Dating.Api.Features.Notifications.PushService>();
builder.Services.AddScoped<Dating.Api.Features.Notifications.PushQueue>();
builder.Services.AddScoped<Dating.Api.Features.Notifications.PushOutbox>();
builder.Services.AddHttpClient<Dating.Api.Features.Notifications.IPushProvider,Dating.Api.Features.Notifications.ExpoPushProvider>(c=>{c.Timeout=TimeSpan.FromSeconds(3);c.MaxResponseContentBufferSize=65536;}).RemoveAllLoggers();
builder.Services.AddHostedService<Dating.Api.Features.Notifications.PushWorker>();
builder.Services.AddScoped<Dating.Api.Features.AccountLifecycle.AccountLifecycleService>();
builder.Services.AddHostedService<Dating.Api.Features.AccountLifecycle.AccountPurgeWorker>();
builder.Services.AddOptions<Dating.Api.Features.Game.GameOptions>().BindConfiguration("Game")
    .Validate(o => o.Valid(), "Game options invalid: capacity must equal quotas, start thresholds must be valid.")
    .ValidateOnStart();
builder.Services.Configure<Dating.Api.Features.Game.Ai.OpenAiOptions>(builder.Configuration.GetSection(Dating.Api.Features.Game.Ai.OpenAiOptions.SectionName));
builder.Services.AddSingleton<Dating.Api.Features.Game.Ai.DeterministicAiCommentaryProvider>();
builder.Services.AddHttpClient<Dating.Api.Features.Game.Ai.IAiCommentaryProvider, Dating.Api.Features.Game.Ai.OpenAiCommentaryProvider>(c =>
{
    c.Timeout = TimeSpan.FromSeconds(5);
}).RemoveAllLoggers();
builder.Services.AddSingleton<Dating.Api.Features.Game.GameConnections>();
builder.Services.AddScoped<Dating.Api.Features.Game.GameService>();
builder.Services.AddSingleton<Dating.Api.Features.Game.Wallet.IPlatformStoreValidator, Dating.Api.Features.Game.Wallet.PlatformStoreValidator>();
builder.Services.AddScoped<Dating.Api.Features.Game.Wallet.WalletService>();
builder.Services.AddHostedService<Dating.Api.Features.Game.GameDeadlineWorker>();
builder.Services.AddScoped<Dating.Api.Features.TodayPlans.TodayPlanService>();
builder.Services.AddHostedService<Dating.Api.Features.TodayPlans.TodayPlanExpirationWorker>();
var app = builder.Build();
if (args.Length > 0 && args[0] == "staff") { await StaffCommand.Run(app.Services,args); return; }
app.UseForwardedHeaders();
app.UseMiddleware<SafeRequestMiddleware>();
app.UseCors();
// Production API/hub traffic fails closed unless Kestrel (or explicitly trusted proxy middleware) establishes HTTPS.
app.Use(async (context,next) => {
 if(context.Request.Path.StartsWithSegments("/api/moderation")) {
  context.Response.Headers.CacheControl="no-store";
  context.Response.Headers["X-Content-Type-Options"]="nosniff";
  if(!context.Request.IsHttps){context.Response.StatusCode=400;await context.Response.WriteAsJsonAsync(SafeProblems.Create(context,400,"HTTPS required."),cancellationToken:context.RequestAborted);return;}
 }
 if (!app.Environment.IsDevelopment() && !app.Environment.IsEnvironment("Testing") && !context.Request.IsHttps &&
     ((context.Request.Path.StartsWithSegments("/api") && !context.Request.Path.StartsWithSegments("/api/health")) || context.Request.Path.StartsWithSegments("/hubs"))) {
  context.Response.StatusCode=400;
  await context.Response.WriteAsJsonAsync(SafeProblems.Create(context,400,"HTTPS required."),cancellationToken:context.RequestAborted);
  return;
 }
 await next(context);
});
app.UseStatusCodePages(async context =>
{
    var response = context.HttpContext.Response;
    await response.WriteAsJsonAsync(SafeProblems.Create(context.HttpContext, response.StatusCode,
        "Request could not be completed."), options: (System.Text.Json.JsonSerializerOptions?)null, contentType: "application/problem+json", cancellationToken: context.HttpContext.RequestAborted);
});
app.UseRouting();
app.UseAuthentication();
app.UseRateLimiter();
app.UseAuthorization();
if (app.Environment.IsDevelopment()) app.MapOpenApi();
app.MapControllers();
app.MapHub<Dating.Api.Features.Chat.ChatHub>("/hubs/chat", options => {
 options.Transports=Microsoft.AspNetCore.Http.Connections.HttpTransportType.LongPolling;
 options.CloseOnAuthenticationExpiration=true;
 options.LongPolling.PollTimeout=TimeSpan.FromSeconds(25);
}).RequireRateLimiting("chat");
app.MapHub<Dating.Api.Features.Game.GameHub>("/hubs/game", options => {
 options.Transports=Microsoft.AspNetCore.Http.Connections.HttpTransportType.LongPolling;
 options.CloseOnAuthenticationExpiration=true;
 options.LongPolling.PollTimeout=TimeSpan.FromSeconds(25);
}).RequireRateLimiting("chat");

if (!app.Environment.IsEnvironment("Testing") && builder.Configuration["DisableStartupMigration"] != "true")
{
    using var scope = app.Services.CreateScope();
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    try
    {
        await db.Database.MigrateAsync();
    }
    catch (Exception ex)
    {
        var logger = scope.ServiceProvider.GetRequiredService<ILogger<Program>>();
        logger.LogError(ex, "Database migration on startup failed.");
    }
}

app.Run();

public partial class Program;
