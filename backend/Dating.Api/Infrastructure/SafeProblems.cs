using Microsoft.AspNetCore.Mvc;

namespace Dating.Api.Infrastructure;

public static class SafeProblems
{
    public static ProblemDetails Create(HttpContext context, int status, string title) => new()
    {
        Status = status,
        Title = title,
        Type = "about:blank",
        Extensions = { ["correlationId"] = context.TraceIdentifier }
    };
}
