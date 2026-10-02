using System.Security.Cryptography.X509Certificates;
using System.Threading.RateLimiting;
using Dating.Api.Features.Auth.Email;
using Dating.Api.Infrastructure;
using Dating.Api.Persistence;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.DataProtection.KeyManagement;
using Microsoft.AspNetCore.DataProtection.Repositories;
using Microsoft.AspNetCore.DataProtection.XmlEncryption;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;
using MimeKit;

namespace Dating.Api.Features.Auth;
public static class AuthSetup
{
    public static IServiceCollection AddDatingAuth(this IServiceCollection services)
    {
        services.AddSingleton(TimeProvider.System);
        services.AddOptions<AuthOptions>().BindConfiguration("Auth")
            .Validate(o => !string.IsNullOrWhiteSpace(o.SigningKeyPem) && !string.IsNullOrWhiteSpace(o.KeyRingPath) &&
                !string.IsNullOrWhiteSpace(o.Issuer) && !string.IsNullOrWhiteSpace(o.Audience), "Auth signing key, issuer, audience and persisted key ring are required.")
            .ValidateOnStart();
        services.AddSingleton<IValidateOptions<AuthOptions>, ProductionAuthValidator>();
        services.AddOptions<EmailOptions>().BindConfiguration("Email").ValidateOnStart();
        services.AddSingleton<IValidateOptions<EmailOptions>, EmailValidator>();
        services.AddDataProtection().SetApplicationName("DatingMVP");
        services.AddOptions<KeyManagementOptions>().Configure<IOptions<AuthOptions>, IHostEnvironment, ILoggerFactory>((keys, auth, env, logs) =>
        {
            var settings = auth.Value;
            keys.XmlRepository = new FileSystemXmlRepository(new DirectoryInfo(settings.KeyRingPath), logs);
            if (!env.IsDevelopment() && !env.IsEnvironment("Testing"))
                keys.XmlEncryptor = new CertificateXmlEncryptor(X509CertificateLoader.LoadPkcs12FromFile(
                    settings.KeyCertificatePath, settings.KeyCertificatePassword), logs);
        });
        services.AddIdentityCore<AppUser>(options =>
        {
            options.User.RequireUniqueEmail = true;
            options.User.AllowedUserNameCharacters = "";
            options.Password.RequiredLength = 12;
            options.Password.RequireDigit = false;
            options.Password.RequireLowercase = false;
            options.Password.RequireUppercase = false;
            options.Password.RequireNonAlphanumeric = false;
            options.Lockout.MaxFailedAccessAttempts = 5;
            options.Lockout.DefaultLockoutTimeSpan = TimeSpan.FromMinutes(15);
            options.SignIn.RequireConfirmedEmail = true;
        }).AddEntityFrameworkStores<AppDbContext>().AddDefaultTokenProviders();
        services.Configure<PasswordHasherOptions>(o => o.IterationCount = 210000);
        services.Configure<DataProtectionTokenProviderOptions>(o => o.TokenLifespan = TimeSpan.FromHours(1));
        services.AddSingleton<JwtTokens>();
        services.AddScoped<AuthService>();
        services.AddScoped<AuthEmailQueue>();
        services.AddScoped<IAuthEmailSender, SmtpAuthEmailSender>();
        services.AddHostedService<AuthEmailWorker>();
        services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme).AddJwtBearer();
        services.AddOptions<JwtBearerOptions>(JwtBearerDefaults.AuthenticationScheme)
            .Configure<JwtTokens, IOptions<AuthOptions>>((options, tokens, auth) =>
            {
                options.MapInboundClaims = false;
                options.IncludeErrorDetails = false;
                options.TokenValidationParameters = new TokenValidationParameters
                {
                    ValidateIssuer = true, ValidIssuer = auth.Value.Issuer,
                    ValidateAudience = true, ValidAudience = auth.Value.Audience,
                    ValidateIssuerSigningKey = true, IssuerSigningKey = tokens.Key,
                    ValidateLifetime = true, RequireExpirationTime = true, RequireSignedTokens = true,
                    ValidAlgorithms = [SecurityAlgorithms.RsaSha256], ClockSkew = TimeSpan.FromSeconds(15)
                };
                options.Events = new JwtBearerEvents
                {
                    OnTokenValidated = async context =>
                    {
                        if (!Guid.TryParse(context.Principal?.FindFirst("sub")?.Value, out var userId) ||
                            !Guid.TryParse(context.Principal?.FindFirst("sid")?.Value, out var sessionId))
                        { context.Fail("Invalid session."); return; }
                        var db = context.HttpContext.RequestServices.GetRequiredService<AppDbContext>();
                        var now = context.HttpContext.RequestServices.GetRequiredService<TimeProvider>().GetUtcNow();
                        if (!await db.Sessions.AsNoTracking().AnyAsync(s => s.Id == sessionId && s.UserId == userId &&
                            s.RevokedAt == null && s.ExpiresAt > now && s.User.IsActive && s.User.EmailConfirmed,
                            context.HttpContext.RequestAborted))
                            context.Fail("Invalid session.");
                    }
                };
            });
        services.AddAuthorization();
        services.AddRateLimiter(options =>
        {
            foreach (var (name, limit) in new[] { ("auth", 20), ("refresh", 120), ("profile", 120) })
                options.AddPolicy(name, context => RateLimitPartition.GetFixedWindowLimiter(
                    context.Connection.RemoteIpAddress?.ToString() ?? "unknown",
                    _ => new FixedWindowRateLimiterOptions { PermitLimit = limit, Window = TimeSpan.FromMinutes(1), QueueLimit = 0 }));
            foreach (var (name, limit, window) in new[] { ("chat", 120, TimeSpan.FromMinutes(1)), ("swipe", 120, TimeSpan.FromMinutes(1)), ("discovery", 60, TimeSpan.FromMinutes(1)), ("preferences", 6, TimeSpan.FromHours(1)), ("location", 2, TimeSpan.FromHours(1)) })
                options.AddPolicy(name, context => RateLimitPartition.GetFixedWindowLimiter(
                    context.User.FindFirst("sub")?.Value ?? context.Connection.RemoteIpAddress?.ToString() ?? "unknown",
                    _ => new FixedWindowRateLimiterOptions { PermitLimit = limit, Window = window, QueueLimit = 0 }));
            options.OnRejected = async (context, ct) =>
            {
                context.HttpContext.Response.StatusCode = 429;
                context.HttpContext.Response.Headers.RetryAfter = context.Lease.TryGetMetadata(MetadataName.RetryAfter, out var retryAfter)
                    ? Math.Ceiling(retryAfter.TotalSeconds).ToString(System.Globalization.CultureInfo.InvariantCulture) : "60";
                await context.HttpContext.Response.WriteAsJsonAsync(SafeProblems.Create(context.HttpContext, 429, "Too many requests."),
                    options: (System.Text.Json.JsonSerializerOptions?)null, contentType: "application/problem+json", cancellationToken: ct);
            };
        });
        return services;
    }
}
public sealed class ProductionAuthValidator(IHostEnvironment environment) : IValidateOptions<AuthOptions>
{
    public ValidateOptionsResult Validate(string? name, AuthOptions options) =>
        environment.IsDevelopment() || environment.IsEnvironment("Testing") || File.Exists(options.KeyCertificatePath)
            ? ValidateOptionsResult.Success : ValidateOptionsResult.Fail("Production requires a certificate protecting the persisted data-protection key ring.");
}
public sealed class EmailValidator(IHostEnvironment environment) : IValidateOptions<EmailOptions>
{
    public ValidateOptionsResult Validate(string? name, EmailOptions o)
    {
        var capture = o.Mode == "Capture" && (environment.IsDevelopment() || environment.IsEnvironment("Testing")) &&
            o.Host is "localhost" or "127.0.0.1" or "mailpit";
        var smtp = o.Mode == "Smtp" && !string.IsNullOrWhiteSpace(o.Username) && !string.IsNullOrWhiteSpace(o.Password);
        return (capture || smtp) && !string.IsNullOrWhiteSpace(o.Host) && o.Port is > 0 and <= 65535 && MailboxAddress.TryParse(o.Sender, out _)
            ? ValidateOptionsResult.Success : ValidateOptionsResult.Fail("Configure a valid SMTP sender/host/port and credentials. Capture is local development only.");
    }
}
