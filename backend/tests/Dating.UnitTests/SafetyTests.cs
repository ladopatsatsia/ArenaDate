using Dating.Api.Infrastructure;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace Dating.UnitTests;

public class SafetyTests
{
    [Fact]
    public async Task Unhandled_errors_never_return_sensitive_exception_or_request_data()
    {
        var context = new DefaultHttpContext();
        context.Response.Body = new MemoryStream();
        context.Request.QueryString = new QueryString("?token=private-token");
        context.Request.Headers["X-Correlation-ID"] = "private-email@example.com";
        var middleware = new SafeRequestMiddleware(_ => throw new InvalidOperationException("private-token"),
            NullLogger<SafeRequestMiddleware>.Instance);
        await middleware.InvokeAsync(context);
        context.Response.Body.Position = 0;
        var body = await new StreamReader(context.Response.Body).ReadToEndAsync();
        Assert.Equal(500, context.Response.StatusCode);
        Assert.Contains(context.TraceIdentifier, body);
        Assert.DoesNotContain("private", body);
        Assert.True(Guid.TryParseExact(context.Response.Headers["X-Correlation-ID"], "N", out _));
    }
}
