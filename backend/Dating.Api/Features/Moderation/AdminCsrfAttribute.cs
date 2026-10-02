using Dating.Api.Infrastructure;
using Microsoft.AspNetCore.Antiforgery;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;
namespace Dating.Api.Features.Moderation;
[AttributeUsage(AttributeTargets.Class)]
public sealed class AdminCsrfAttribute:Attribute,IAsyncAuthorizationFilter {
 public async Task OnAuthorizationAsync(AuthorizationFilterContext context) {
  var request=context.HttpContext.Request;
  if(HttpMethods.IsGet(request.Method)||HttpMethods.IsHead(request.Method)||HttpMethods.IsOptions(request.Method))return;
  try {await context.HttpContext.RequestServices.GetRequiredService<IAntiforgery>().ValidateRequestAsync(context.HttpContext);}
  catch(AntiforgeryValidationException){context.Result=new BadRequestObjectResult(SafeProblems.Create(context.HttpContext,400,"Security token required."));}
 }
}
