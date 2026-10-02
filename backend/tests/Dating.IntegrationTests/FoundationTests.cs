using System.Net;
using Dating.Api.Persistence;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Npgsql;
using Xunit;

namespace Dating.IntegrationTests;

public class FoundationTests
{
    private static string Connection => Environment.GetEnvironmentVariable("TEST_DATABASE_CONNECTION")
        ?? throw new InvalidOperationException("TEST_DATABASE_CONNECTION must target a disposable real PostgreSQL/PostGIS database.");

    private sealed class ApiFactory(string connection, string environment = "Development") : WebApplicationFactory<Program>
    {
        protected override void ConfigureWebHost(IWebHostBuilder builder)
        {
            builder.UseEnvironment(environment);
            builder.ConfigureAppConfiguration((_, config) => config.AddInMemoryCollection(
                TestAuthSettings.Configuration(connection, environment == "Production")));
        }
    }

    [Fact]
    public async Task Migrations_readiness_openapi_and_safe_errors_work_on_real_postgres()
    {
        // Create a separate database; never reset the supplied database.
        var databaseName = "foundation_" + Guid.NewGuid().ToString("N");
        await using var admin = new NpgsqlConnection(Connection);
        await admin.OpenAsync();
        await using (var create = new NpgsqlCommand($"CREATE DATABASE {databaseName}", admin)) await create.ExecuteNonQueryAsync();
        var connection = new NpgsqlConnectionStringBuilder(Connection) { Database = databaseName, Pooling = false }.ConnectionString;
        try
        {
            await using var factory = new ApiFactory(connection);
            using var client = factory.CreateClient();
            Assert.Equal(HttpStatusCode.OK, (await client.GetAsync("/api/health/live")).StatusCode);
            Assert.Equal(HttpStatusCode.ServiceUnavailable, (await client.GetAsync("/api/health/ready")).StatusCode);
            var options = new DbContextOptionsBuilder<AppDbContext>().UseNpgsql(connection, o => o.UseNetTopologySuite()).Options;
            await using var db = new AppDbContext(options);
            await db.Database.MigrateAsync();
            await db.Database.MigrateAsync(); // Repeat must be safe.
            Assert.Empty(await db.Database.GetPendingMigrationsAsync());
            using var scope = factory.Services.CreateScope();
            var actual = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            Assert.Equal(databaseName, actual.Database.GetDbConnection().Database);
            Assert.Empty(await actual.Database.GetPendingMigrationsAsync());
            await actual.Database.ExecuteSqlRawAsync("SELECT PostGIS_Version()");
            Assert.False(db.Database.HasPendingModelChanges());
            Assert.Equal(HttpStatusCode.OK, (await client.GetAsync("/api/health/ready")).StatusCode);
            Assert.Contains("/api/health/ready", await client.GetStringAsync("/openapi/v1.json"));
            var missing = await client.GetAsync("/does-not-exist?token=private-token");
            Assert.Equal(HttpStatusCode.NotFound, missing.StatusCode);
            Assert.Equal("application/problem+json", missing.Content.Headers.ContentType?.MediaType);
            var body = await missing.Content.ReadAsStringAsync();
            Assert.Contains(missing.Headers.GetValues("X-Correlation-ID").Single(), body);
            Assert.DoesNotContain("private-token", body);
            await using var production = new ApiFactory(connection, "Production");
            using var productionClient = production.CreateClient();
            Assert.Equal(HttpStatusCode.NotFound, (await productionClient.GetAsync("/openapi/v1.json")).StatusCode);
            Assert.Equal(HttpStatusCode.BadRequest, (await productionClient.GetAsync("/api/matches")).StatusCode);
            Assert.Equal(HttpStatusCode.Unauthorized, (await productionClient.GetAsync("https://localhost/api/matches")).StatusCode);
        }
        finally
        {
            await using var drop = new NpgsqlCommand($"DROP DATABASE {databaseName} WITH (FORCE)", admin);
            await drop.ExecuteNonQueryAsync();
        }
    }

    [Fact]
    public async Task Database_outage_is_503_while_liveness_remains_200()
    {
        await using var factory = new ApiFactory("Host=127.0.0.1;Port=1;Database=unavailable;Username=unused;Password=unused;Timeout=1");
        using var client = factory.CreateClient();
        Assert.Equal(HttpStatusCode.OK, (await client.GetAsync("/api/health/live")).StatusCode);
        var response = await client.GetAsync("/api/health/ready");
        Assert.Equal(HttpStatusCode.ServiceUnavailable, response.StatusCode);
        var body = await response.Content.ReadAsStringAsync();
        Assert.DoesNotContain("Password", body);
        Assert.DoesNotContain("127.0.0.1", body);
    }
}
