using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace Dating.Api.Features.Auth;
[Authorize, RequestSizeLimit(16384)]
[ApiController, Route("api/auth"), EnableRateLimiting("auth")]
[ResponseCache(NoStore = true, Location = ResponseCacheLocation.None)]
public sealed class AuthController(AuthService auth) : ControllerBase
{
    [HttpPost("register"), AllowAnonymous]
    [ProducesResponseType<AcceptedResponse>(202)]
    public async Task<IActionResult> Register(RegisterRequest request, CancellationToken ct)
    { await auth.Register(request, ct); return Accepted(new AcceptedResponse()); }
    [HttpPost("verification-email"), AllowAnonymous]
    [ProducesResponseType<AcceptedResponse>(202)]
    public async Task<IActionResult> VerificationEmail(EmailRequest request, CancellationToken ct)
    { await auth.SendCode(request.Email, false, ct); return Accepted(new AcceptedResponse()); }
    [HttpPost("verify"), AllowAnonymous]
    [ProducesResponseType(204)]
    public async Task<IActionResult> Verify(VerifyRequest request, CancellationToken ct)
    { await auth.Verify(request, ct); return NoContent(); }
    [HttpPost("login"), AllowAnonymous]
    [ProducesResponseType<TokenResponse>(200)]
    public async Task<ActionResult<TokenResponse>> Login(LoginRequest request, CancellationToken ct) => Ok(await auth.Login(request, ct));
    [HttpPost("refresh"), AllowAnonymous, EnableRateLimiting("refresh")]
    [ProducesResponseType<TokenResponse>(200)]
    public async Task<ActionResult<TokenResponse>> Refresh(RefreshRequest request, CancellationToken ct) => Ok(await auth.Refresh(request, ct));
    [HttpPost("logout"), AllowAnonymous, EnableRateLimiting("refresh")]
    [ProducesResponseType(204)]
    public async Task<IActionResult> Logout(LogoutRequest request, CancellationToken ct)
    { await auth.Logout(request.RefreshToken, ct); return NoContent(); }
    [HttpPost("logout-all"), Authorize]
    [ProducesResponseType(204)]
    public async Task<IActionResult> LogoutAll(CancellationToken ct)
    { await auth.LogoutAll(Guid.Parse(User.FindFirst("sub")!.Value), ct); return NoContent(); }
    [HttpPost("forgot-password"), AllowAnonymous]
    [ProducesResponseType<AcceptedResponse>(202)]
    public async Task<IActionResult> Forgot(EmailRequest request, CancellationToken ct)
    { await auth.SendCode(request.Email, true, ct); return Accepted(new AcceptedResponse()); }
    [HttpPost("reset-password"), AllowAnonymous]
    [ProducesResponseType(204)]
    public async Task<IActionResult> Reset(ResetRequest request, CancellationToken ct)
    { await auth.Reset(request, ct); return NoContent(); }
    [HttpGet("me"), Authorize, EnableRateLimiting("refresh")]
    [ProducesResponseType<AccountResponse>(200)]
    public ActionResult<AccountResponse> Me() => Ok(new AccountResponse(Guid.Parse(User.FindFirst("sub")!.Value)));
}
