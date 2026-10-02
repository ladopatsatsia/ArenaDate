# Status - Prompt 9

Updated 2026-10-02. Prompt 9 is complete for implementation and available local checks. Prompt 8 is archived in STATUS.PROMPT8.md. User authorized Prompt 10 after finishing 9; Prompt 11 is not authorized. No publication, purchase, public deployment or real administrator provisioning occurred.

## Implemented
Angular/Material moderator workspace at /admin/: MFA sign-in, pending-photo approval/rejection, open/closed reports, restricted audited evidence, account suspension/reactivation and paginated audit history. Shared generated API types and loading/error/empty states.

Separate persisted AdminCookie sessions, Identity TOTP and replay protection, HTTPS-only Secure/HttpOnly/SameSite Strict cookies, identity-bound antiforgery on every mutation including login/logout. Every request rechecks staff membership, session, active identity and security stamp. Mobile JWT and legacy consumer roles grant no staff privileges.

Private interactive staff grant/revoke/reset-mfa operator command; no default credentials/public role assignment. Suspension synchronizes on the existing user-row locks, revokes sessions and push registrations, hides discovery, prevents chat/push, evicts live membership and commits revocation hints. Reactivation requires a new login; block/unmatch remains effective.

Photo decision/profile revision/audit commit atomically. Mobile refetches profile on focus and explicit refresh. Report evidence is limited to original server-resolved snapshots, never arbitrary private conversations. Migration 20261001150728_SecureModeration applied. Full operator/security/retention instructions: MODERATION.md.

Playwright 1.58.2 drives compiled Angular/Edge against real HTTPS Kestrel and isolated PostgreSQL. Piscina 5.3.2 pin/override fixes the critical build dependency advisory without upgrading Angular.

## Exact checks
| Command | Result |
|---|---|
| dotnet build backend/Dating.slnx --no-restore | PASS, 0 warnings/errors |
| RUN_ADMIN_BROWSER=1; dotnet test backend/Dating.slnx --no-restore --logger trx | PASS: 28 unit + 84 integration/browser = 112, 0 skipped |
| dotnet ef database update --project backend/Dating.Api --no-build | PASS |
| dotnet ef migrations has-pending-model-changes --project backend/Dating.Api --no-build | PASS, no drift |
| dotnet ef migrations list --project backend/Dating.Api --no-build | PASS, all ten applied |
| dotnet ef migrations script --idempotent --project backend/Dating.Api --no-build --output artifacts/migration.sql | PASS |
| dotnet publish backend/Dating.Api -c Release --no-restore -o artifacts/api | PASS |
| npm.cmd run contract:generate / contract:check | PASS |
| npm.cmd run typecheck | PASS, including final post-contract rerun |
| npm.cmd run lint | PASS |
| npm.cmd test --workspace mobile -- --runInBand | PASS, 17 suites / 63 tests |
| npm.cmd test --workspace admin | PASS, 2 files / 6 tests, including after Piscina fix |
| npm.cmd run admin:build | PASS, 441.52 kB, including after Piscina fix |
| npm.cmd ls piscina | PASS, Angular uses 5.3.2 |
| npm.cmd run smoke:api | PASS, real mobile fetch wrapper -> API -> PostgreSQL ready |
| npm.cmd audit --json | NOT CLEAN: 0 critical, 4 high, 11 moderate |

Final TRX: unit ladop_LADOPC_2026-10-02_18_23_59_net10.0.trx and integration/browser ladop_LADOPC_2026-10-02_18_24_43_net10.0.trx in respective TestResults directories. Screenshot artifacts/admin-browser/audit.png contains synthetic fixtures only. Browser verifies MFA/cookie/CSRF, photo approve/reject, report evidence/close, suspension/reactivation, audit/logout. Normal runs explicitly skip the opt-in browser case; the final run enabled it.

Fixed initial CSRF filter registration, test BaseAddress mutation, temporary Windows TLS key handling and stale npm nested override resolution. An interrupted overnight test run failed DB timeouts/expired MFA and is not counted as success; the subsequent full run passed. Smoke previously checked readiness immediately after liveness; it now requires actual readiness within a bounded 45-second startup window, preserving mobile timeouts and the unchanged server three-second health check.

## Unverified / risks
- Production reverse proxy/TLS, deployed key protection and owner authenticator provisioning/recovery: NOT RUN; browser identities are isolated test fixtures.
- Physical iPhone/Android, signed native/EAS builds and real APNs/FCM delivery: NOT RUN; owner credentials/devices unavailable. External S3/SMTP and hosted CI also remain unverified.
- npm audit has four high nodes through Expo CLI/code-signing -> node-forge GHSA-86w9-cpqp-85rv (no patched version listed), plus eleven moderate inherited nodes. No incompatible Expo downgrade or audit suppression. Backend/moderator crypto does not use node-forge. Reassess before signing/release; details in VERSIONS.md.
- Native exports/Docker were not repeated for Prompt 9; previous Prompt 8 evidence is archived.
- Already transmitted bytes cannot be recalled. Audit has no HTTP edit route but is not database-admin tamper-proof. Reports retain existing 180-day expiry; broader lifecycle is deferred.
- Workspace has no Git metadata. No commit/PR/deployment was created.

## Run / next
See MODERATION.md. Local: ./scripts/dev.ps1 migrate; ./scripts/dev.ps1 admin-api with a local HTTPS certificate; npm.cmd start --workspace admin; open https://localhost:4200/admin/. Operator provisioning requires a verified account UUID and private interactive terminal. Mobile: npm.cmd run mobile:start.

Next: authorized Prompt 10 mobile quality. Preserve all provider/device blockers. Do not start Prompt 11.

