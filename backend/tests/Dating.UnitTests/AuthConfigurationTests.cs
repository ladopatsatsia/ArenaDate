using Dating.Api.Features.Auth;
using Dating.Api.Features.Profiles;
using Dating.Api.Features.Auth.Email;
using Microsoft.Extensions.FileProviders;
using Microsoft.Extensions.Hosting;
using Xunit;
namespace Dating.UnitTests;
public class AuthConfigurationTests
{
    private sealed class Production : IHostEnvironment
    {
        public string EnvironmentName { get; set; } = Environments.Production;
        public string ApplicationName { get; set; } = "Tests";
        public string ContentRootPath { get; set; } = AppContext.BaseDirectory;
        public IFileProvider ContentRootFileProvider { get; set; } = new NullFileProvider();
    }
    [Fact]
    public void Production_cannot_use_mail_capture_or_missing_email_credentials()
    {
        var validator = new EmailValidator(new Production());
        Assert.True(validator.Validate(null, new EmailOptions { Mode = "Capture", Host = "127.0.0.1", Port = 1025, Sender = "a@example.test" }).Failed);
        Assert.True(validator.Validate(null, new EmailOptions { Mode = "Smtp", Host = "smtp.example.test", Sender = "a@example.test" }).Failed);
    }
    [Fact]
    public void Production_rejects_local_media_and_auto_approval()
    {
        var validator = new MediaValidator(new Production());
        Assert.True(validator.Validate(null, new MediaOptions { Mode = "Local", LocalPath = Path.GetTempPath() }).Failed);
        var remote = new MediaOptions { Mode = "S3", Endpoint = "https://storage.example.test", Region = "test", Bucket = "private", AccessKey = "test", SecretKey = "test", AutoApprove = true };
        Assert.True(validator.Validate(null, remote).Failed);
        remote.AutoApprove = false; Assert.True(validator.Validate(null, remote).Succeeded);
    }
    [Fact]
    public void Production_requires_protection_for_persisted_token_keys() =>
        Assert.True(new ProductionAuthValidator(new Production()).Validate(null, new AuthOptions()).Failed);
}
