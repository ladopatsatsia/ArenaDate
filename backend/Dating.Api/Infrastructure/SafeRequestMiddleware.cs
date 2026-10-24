using System.Diagnostics;

namespace Dating.Api.Infrastructure;

public sealed class SafeRequestMiddleware(RequestDelegate next, ILogger<SafeRequestMiddleware> logger)
{
    public async Task InvokeAsync(HttpContext context)
    {
        // Server-owned IDs avoid logging attacker-controlled header values or personal data.
        context.TraceIdentifier = Guid.NewGuid().ToString("N");
        context.Response.Headers["X-Correlation-ID"] = context.TraceIdentifier;
        var started = Stopwatch.GetTimestamp();
        try
        {
            await next(context);
        }
        catch (OperationCanceledException) when (context.RequestAborted.IsCancellationRequested)
        {
            context.Response.StatusCode = 499;
        }
        catch (Dating.Api.Features.Auth.AuthFailure error)
        {
            context.Response.StatusCode = error.Status;
            if (error.Status == 401) context.Response.Headers.WWWAuthenticate = "Bearer";
            var problem = SafeProblems.Create(context, error.Status, "Authentication request could not be completed.");
            problem.Extensions["code"] = error.Code;
            await context.Response.WriteAsJsonAsync(problem, options: (System.Text.Json.JsonSerializerOptions?)null, contentType: "application/problem+json", cancellationToken: context.RequestAborted);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Unhandled request failure. CorrelationId {CorrelationId}: {Message}", context.TraceIdentifier, ex.Message);
            if (context.Response.HasStarted) throw;
            context.Response.Clear();
            context.Response.Headers["X-Correlation-ID"] = context.TraceIdentifier;
            context.Response.StatusCode = 500;
            var problem = SafeProblems.Create(context, 500, "An unexpected error occurred.");
            await context.Response.WriteAsJsonAsync(
                problem,
                options: (System.Text.Json.JsonSerializerOptions?)null, contentType: "application/problem+json", cancellationToken: context.RequestAborted);
        }
        finally
        {
            logger.LogInformation("Request completed. CorrelationId {CorrelationId} StatusCode {StatusCode} ElapsedMs {ElapsedMs}",
                context.TraceIdentifier, context.Response.StatusCode, Stopwatch.GetElapsedTime(started).TotalMilliseconds);
        }
    }
}
