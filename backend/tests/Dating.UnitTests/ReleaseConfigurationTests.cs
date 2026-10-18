
using Dating.Api.Features.Auth;
using Dating.Api.Features.Auth.Email;
using Dating.Api.Features.Notifications;
using Dating.Api.Features.Profiles;
using Dating.Api.Infrastructure;
using Microsoft.Extensions.FileProviders;
using Microsoft.Extensions.Hosting;
using Xunit;

namespace Dating.UnitTests;

public class ReleaseConfigurationTests
{
    private sealed class ProductionEnvironment : IHostEnvironment
    {
        public string EnvironmentName { get; set; } = Environments.Production;
        public string ApplicationName { get; set; } = "Dating.Api";
        public string ContentRootPath { get; set; } = AppContext.BaseDirectory;
        public IFileProvider ContentRootFileProvider { get; set; } = new NullFileProvider();
    }

    [Fact]
    public void Push_options_validates_required_keys_when_enabled()
    {
        var disabled = new PushOptions { Enabled = false };
        Assert.True(disabled.Valid());

        var validProjectId = Guid.NewGuid().ToString();
        var validKeyBase64 = Convert.ToBase64String(new byte[32]);

        var enabledMissingProject = new PushOptions
        {
            Enabled = true,
            AccessToken = "expo-access-token",
            CurrentKeyId = "v1",
            Keys = new Dictionary<string, string> { ["v1"] = validKeyBase64 }
        };
        Assert.False(enabledMissingProject.Valid());

        var enabledInvalidKeyLength = new PushOptions
        {
            Enabled = true,
            ProjectId = validProjectId,
            AccessToken = "expo-access-token",
            CurrentKeyId = "v1",
            Keys = new Dictionary<string, string> { ["v1"] = Convert.ToBase64String(new byte[16]) }
        };
        Assert.False(enabledInvalidKeyLength.Valid());

        var valid = new PushOptions
        {
            Enabled = true,
            ProjectId = validProjectId,
            AccessToken = "expo-access-token",
            CurrentKeyId = "v1",
            Keys = new Dictionary<string, string> { ["v1"] = validKeyBase64 }
        };
        Assert.True(valid.Valid());
    }

    [Fact]
    public void Production_validator_enforces_safe_media_and_email()
    {
        var env = new ProductionEnvironment();
        var emailValidator = new EmailValidator(env);
        Assert.True(emailValidator.Validate(null, new EmailOptions { Mode = "Capture", Host = "127.0.0.1", Port = 1025, Sender = "no-reply@dating.local" }).Failed);

        var mediaValidator = new MediaValidator(env);
        Assert.True(mediaValidator.Validate(null, new MediaOptions { Mode = "Local", LocalPath = "/tmp/media" }).Failed);
        Assert.True(mediaValidator.Validate(null, new MediaOptions { Mode = "S3", Endpoint = "https://s3.example.com", Bucket = "photos", Region = "us-east-1", AccessKey = "k", SecretKey = "s", AutoApprove = true }).Failed);
    }

    [Fact]
    public void Database_settings_requires_non_empty_connection_string()
    {
        var empty = new DatabaseSettings { Database = "" };
        Assert.True(string.IsNullOrWhiteSpace(empty.Database));

        var valid = new DatabaseSettings { Database = "Host=127.0.0.1;Port=5432;Database=dating;" };
        Assert.False(string.IsNullOrWhiteSpace(valid.Database));
    }

    [Fact]
    public void Idempotent_migration_script_artifact_exists_and_contains_schema()
    {
        var dir = new DirectoryInfo(AppContext.BaseDirectory);
        while (dir != null && !File.Exists(Path.Combine(dir.FullName, "package.json")))
        {
            dir = dir.Parent;
        }
        Assert.NotNull(dir);
        var migrationFile = Path.Combine(dir.FullName, "artifacts", "migration.sql");
        Assert.True(File.Exists(migrationFile), $"Migration script must exist at {migrationFile}");

        var content = File.ReadAllText(migrationFile);
        Assert.True(content.Length > 1000, "Migration script must contain complete database schema.");
        Assert.Contains("CREATE EXTENSION IF NOT EXISTS postgis;", content);
        Assert.Contains("CREATE TABLE IF NOT EXISTS \"__EFMigrationsHistory\"", content);
    }
}
