using Dating.Api.Features.Auth;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace Dating.Api.Features.AccountLifecycle;

[ApiController]
[ResponseCache(NoStore = true, Location = ResponseCacheLocation.None)]
public sealed class AccountLifecycleController(AccountLifecycleService service) : ControllerBase
{
    private Guid UserId => Guid.Parse(User.FindFirst("sub")!.Value);

    [HttpPost("api/account/delete"), Authorize, EnableRateLimiting("auth")]
    [ProducesResponseType(204)]
    public async Task<IActionResult> DeleteAccountPost([FromBody] DeleteAccountRequest? request, CancellationToken ct)
    {
        await service.DeleteAccountInApp(UserId, request?.Password, ct);
        return NoContent();
    }

    [HttpDelete("api/account"), Authorize, EnableRateLimiting("auth")]
    [ProducesResponseType(204)]
    public async Task<IActionResult> DeleteAccountDelete([FromBody] DeleteAccountRequest? request, CancellationToken ct)
    {
        await service.DeleteAccountInApp(UserId, request?.Password, ct);
        return NoContent();
    }

    [HttpGet("api/account/deletion-status"), Authorize, EnableRateLimiting("auth")]
    [ProducesResponseType<DeletionStatusResponse>(200)]
    public async Task<ActionResult<DeletionStatusResponse>> GetDeletionStatus(CancellationToken ct)
    {
        return Ok(await service.GetStatus(UserId, ct));
    }

    [HttpPost("api/account/discoverability-pause"), Authorize, EnableRateLimiting("profile")]
    [ProducesResponseType(204)]
    public async Task<IActionResult> SetPause(DiscoverabilityPauseRequest request, CancellationToken ct)
    {
        await service.SetDiscoverabilityPause(UserId, request.Paused, ct);
        return NoContent();
    }

    [HttpPost("api/account/public-deletion-request"), AllowAnonymous, EnableRateLimiting("auth")]
    [ProducesResponseType<AcceptedResponse>(202)]
    public async Task<IActionResult> PublicDeletionRequest(PublicDeletionRequest request, CancellationToken ct)
    {
        await service.RequestPublicDeletion(request.Email, ct);
        return Accepted(new AcceptedResponse("If an account with that email exists, deletion instructions and a confirmation link will be sent."));
    }

    [HttpPost("api/account/confirm-deletion"), AllowAnonymous, EnableRateLimiting("auth")]
    [ProducesResponseType(204)]
    public async Task<IActionResult> ConfirmDeletion(ConfirmPublicDeletionRequest request, CancellationToken ct)
    {
        await service.ConfirmPublicDeletion(request.Email, request.Token, ct);
        return NoContent();
    }

    [HttpGet("account/delete"), AllowAnonymous]
    [Produces("text/html")]
    public ContentResult DeletionPage()
    {
        const string html = """
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <title>DatingMVP - Account Deletion Request</title>
            <style>
                body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #faf7f5; color: #2e2629; margin: 0; padding: 2rem; display: flex; justify-content: center; }
                .card { background: #ffffff; border: 1px solid #e0d6d8; border-radius: 12px; padding: 2rem; max-width: 480px; width: 100%; box-shadow: 0 4px 12px rgba(0,0,0,0.05); }
                h1 { font-size: 1.5rem; margin-top: 0; color: #432d37; }
                p { line-height: 1.5; font-size: 0.95rem; color: #5a4b51; }
                label { display: block; font-weight: 600; margin-bottom: 0.5rem; font-size: 0.9rem; }
                input[type="email"] { width: 100%; padding: 0.75rem; border: 1px solid #bba8b0; border-radius: 6px; box-sizing: border-box; font-size: 1rem; margin-bottom: 1.25rem; }
                button { background-color: #8a3b5a; color: #ffffff; border: none; border-radius: 6px; padding: 0.75rem 1.5rem; font-size: 1rem; font-weight: 600; cursor: pointer; width: 100%; }
                button:hover { background-color: #72314a; }
                .notice { font-size: 0.85rem; color: #76656c; margin-top: 1rem; }
                #status { margin-top: 1rem; font-weight: 500; display: none; }
            </style>
        </head>
        <body>
            <div class="card">
                <h1>Request Account Deletion</h1>
                <p>If you have an active DatingMVP account and wish to permanently delete your account and associated personal data, submit your registered email address below.</p>
                <form id="delForm" onsubmit="submitForm(event)">
                    <label for="email">Registered Email Address</label>
                    <input type="email" id="email" required placeholder="your.email@example.com" />
                    <button type="submit" id="subBtn">Send Deletion Request</button>
                    <div id="status"></div>
                </form>
                <p class="notice">For your security, we will send a verification link to confirm the deletion request. We never disclose whether an email address is registered.</p>
            </div>
            <script>
                async function submitForm(e) {
                    e.preventDefault();
                    const email = document.getElementById('email').value;
                    const btn = document.getElementById('subBtn');
                    const status = document.getElementById('status');
                    btn.disabled = true;
                    status.style.display = 'block';
                    status.style.color = '#5a4b51';
                    status.textContent = 'Processing request...';
                    try {
                        const res = await fetch('/api/account/public-deletion-request', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ email })
                        });
                        status.style.color = '#2d6a4f';
                        status.textContent = 'If an account with that email exists, deletion instructions and a confirmation link have been sent.';
                    } catch {
                        status.style.color = '#b00020';
                        status.textContent = 'Unable to complete request. Please try again later.';
                    } finally {
                        btn.disabled = false;
                    }
                }
            </script>
        </body>
        </html>
        """;
        return Content(html, "text/html");
    }
}
