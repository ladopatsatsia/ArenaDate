# Angular moderation (Prompt 9)

One Angular 21/Material panel at `/admin/`, using same-origin `/api/moderation`. The API is the authorization boundary. No mobile JWT, legacy Identity role, client role field, or Angular state grants staff access. There is no public staff provisioning endpoint and no unrestricted conversation browser.

## Operator setup

Create a dedicated adult account through the existing registration/email verification flow. Keep this separate from a personal dating account. Obtain its UUID from its authenticated `/api/auth/me` response. Staff membership is a separate `StaffAccount` record, not the consumer's public role claims. Both Admin and Moderator have this bounded review permission set; changing staff membership remains operator-only.

Migrate first. In a private interactive terminal with the normal server configuration loaded:

```powershell
dotnet run --project backend/Dating.Api --no-launch-profile -- staff grant <verified-account-uuid> Admin
# Local config helper:
./scripts/dev.ps1 staff -StaffArguments grant,<verified-account-uuid>,Admin
# Explicit recovery or removal:
./scripts/dev.ps1 staff -StaffArguments reset-mfa,<verified-account-uuid>,Admin
./scripts/dev.ps1 staff -StaffArguments revoke,<verified-account-uuid>,Admin
```

The process branch does not start an HTTP server or workers. It row-locks the verified active identity and records the privileged local operator as the system UUID. Grant refuses an already enabled member. It prints an authenticator secret **only to the private operator terminal**, refusing redirected provisioning output. Transfer it privately to the staff owner and manually enter it in an authenticator (SHA1, six digits, 30 seconds). Never paste it into tickets, logs, source, shell arguments or browser storage. First login verifies possession; MFA is required in development, tests and production. Reset/revoke invalidates existing admin sessions. There is no public recovery bypass; recovery needs the authorized database/server operator.

The existing Identity password hasher, authenticator provider and lockout are reused. Five failed password/MFA attempts lock the identity for 15 minutes. Login is also IP-rate-limited. Persisted hashes reject reused successful authenticator codes for four minutes under the user-row lock. No MFA/password success is simulated in production.

## Local run

```powershell
docker compose --env-file infra/.env -f infra/compose.yaml up -d database mailpit
./scripts/dev.ps1 migrate
# Have a trusted local ASP.NET development HTTPS certificate available:
dotnet dev-certs https --trust
./scripts/dev.ps1 admin-api
# Separate terminal:
npm.cmd start --workspace admin
```

Open the Angular HTTPS dev URL at `/admin/` (normally `https://localhost:4200/admin/`). Angular proxies to Kestrel `https://localhost:5181`; its dev-only proxy accepts the local self-signed certificate. The plain mobile API remains port 5180. Admin endpoints require HTTPS even in Development. Local certificate trust is an operator action, not silently installed by the agent.

Production: serve Angular's `dist/admin/browser` under `/admin/`, route `/api` and `/hubs` to Kestrel over HTTPS on the same public origin. Do not fall back API errors to index.html. Restrict backend ingress. If terminating TLS before Kestrel instead, explicitly configure trusted proxy networks/forwarded headers in a reviewed deployment; this stage does not trust arbitrary forwarded headers. Use protected persistent Data Protection keys and database/disk/backup protection. No deployment occurred.

## Sessions and CSRF

Separate `AdminCookie` scheme, `__Host-DatingAdmin`, Secure/HttpOnly/SameSite Strict, path `/`, host-only. Fixed 30-minute non-sliding session, no persistent browser login or client storage. Each request checks the database session, current staff membership, active verified identity and Identity security stamp. Password reset/security-stamp change invalidates the cookie. Cookie authentication cannot authorize mobile endpoints; mobile JWT cannot authorize staff endpoints.

`GET /csrf` issues the ASP.NET antiforgery cookie and Angular-readable `XSRF-TOKEN`. Angular sends `X-XSRF-TOKEN` for relative same-origin mutations. Login itself requires CSRF. After sign-in, Angular obtains a fresh identity-bound token before further operations. All staff mutations, including logout, validate antiforgery. No credentialed cross-origin CORS is enabled. Expired/revoked sessions return 401, not HTML redirects; the panel clears private view state. Responses are no-store. Logout requires a successful server response; failures are visible.

## Review behavior

- Pending photos: bounded 50-item UUID keyset pages, cookie-authorized pending-only image endpoint, access audit. Approve/reject requires a 3–500 character reason. User row locking synchronizes upload/delete/moderation; a concurrent second decision returns 409. State, profile revision and audit commit together. Mobile profile refetches when focused and has an explicit refresh button. Discovery/media authorization sees current status on subsequent reads. Already downloaded bytes cannot be recalled.
- Reports: open/closed queues, 50-item UUID keyset pages. Evidence is only the encrypted snapshot resolved during the original user report (one requested message or at most five incoming messages, or narrow profile snapshot), not arbitrary chat history. Reporter identity is absent from the review DTO/evidence. Viewing evidence records an audit entry. Closing needs a reason and is conflict-checked. Expired evidence is unavailable; existing 180-day cleanup still applies to open and closed reports.
- Account status: exact UUID lookup from report/photo, display name and active state only. Suspend/reactivate requires a reason. Staff accounts cannot be suspended here; operator command owns staff lifecycle.
- Suspension locks the affected user row, shared with pair operations, auth and profile writes. It hides discovery via `IsActive`, revokes all refresh sessions, deactivates/clears encrypted push registrations and creates transactional chat revocation hints. After commit, the local connection registry is evicted. Every REST/hub/outbox delivery reauthorizes current state. No new messages or pushes can be authorized after the suspension commit. Provider-accepted or already downloaded bytes cannot be recalled.
- Reactivation restores account eligibility, not old sessions or push registrations. The owner must log in and register again. Existing active matches can resume; previously blocked/unmatched pairs remain closed.
- Audit: newest-first 50-item keyset pages; actor/target IDs, controlled action, bounded reason and UTC timestamp. No passwords, codes, tokens, reporter identity or automatic message copies. Audit has no HTTP edit/delete route. Database administrators can still alter records: this is not tamper-proof storage. Reviewers must keep unnecessary personal details out of reasons. Audit/session housekeeping beyond current report expiry is a later operational retention decision, not a legal compliance claim.

## Verification

Real PostgreSQL integration tests cover mobile/legacy-role denial at every route, role assignment denial, login MFA/replay/lockout dependencies, HTTPS, CSRF at every mutation category, Secure cookie, persisted session/staff/stamp checks, logout, photo races/revisions, bounded evidence/expiry, suspension vs sends, live SignalR subscription denial and queued push cancellation. Angular tests exercise the identity-bound CSRF refresh order, decision validation/duplicate clicks and clearing stale private views.

The opt-in browser test builds a real Kestrel HTTPS host and isolated PostgreSQL database, serves the compiled Angular app through a test-only TLS origin and drives Edge headlessly. All fixture accounts/keys exist only in test scope; no real administrator is provisioned. It exercises MFA login, cookie flags, missing-CSRF rejection, photo approval/rejection, report evidence/close, suspension/reactivation, audit and logout. Run after `npm.cmd run admin:build`:

```powershell
$env:RUN_ADMIN_BROWSER='1'
./scripts/dev.ps1 test
# Or dotnet test with --filter FullyQualifiedName~AdminBrowserTests
```

Playwright uses installed Edge by default; `ADMIN_BROWSER_CHANNEL=chrome` selects installed Chrome. Normal backend runs explicitly skip the opt-in browser test. Browser automation is not iPhone/Android verification. Production TLS, owner authenticator enrollment/recovery and physical mobile behavior remain separately unverified unless STATUS records evidence.
