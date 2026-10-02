using Dating.Api.Infrastructure;
using Dating.Api.Features.Auth;
using Dating.Api.Features.Profiles;
using Dating.Api.Persistence;
using Dating.Api.Features.Moderation;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

var builder = WebApplication.CreateBuilder(args);
builder.Logging.ClearProviders();
builder.Logging.AddJsonConsole();
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
builder.Services.AddOpenApi();
builder.Services.AddOptions<DatabaseSettings>().BindConfiguration("ConnectionStrings")
    .Validate(settings => !string.IsNullOrWhiteSpace(settings.Database), "ConnectionStrings__Database is required.")
    .ValidateOnStart();
builder.Services.AddDbContext<AppDbContext>((services, options) =>
{
    var connection = services.GetRequiredService<IConfiguration>().GetConnectionString("Database")
        ?? throw new InvalidOperationException("Configure ConnectionStrings__Database.");
    options.UseNpgsql(connection, npgsql => npgsql.UseNetTopologySuite());
});
builder.Services.AddDatingAuth();
builder.Services.AddModeration();
builder.Services.AddProfileMedia();
builder.Services.AddScoped<Dating.Api.Features.Discovery.DiscoveryEligibility>();
builder.Services.AddScoped<Dating.Api.Features.Discovery.DiscoveryService>();
builder.Services.AddScoped<Dating.Api.Features.Matching.PairSynchronization>();
builder.Services.AddScoped<Dating.Api.Features.Matching.MatchService>();
builder.Services.AddScoped<Dating.Api.Features.Matching.PairLifecycle>();
builder.Services.AddScoped<Dating.Api.Features.Matching.MatchOutbox>();
builder.Services.AddHostedService<Dating.Api.Features.Matching.MatchOutboxWorker>();
builder.Services.AddScoped<Dating.Api.Features.Chat.ChatService>();
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
var app = builder.Build();
if (args.Length > 0 && args[0] == "staff") { await StaffCommand.Run(app.Services,args); return; }
app.UseMiddleware<SafeRequestMiddleware>();
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
app.Run();

public partial class Program;
