# Status - Prompt 2

Updated 2026-09-30. Prompt 2 authentication is implemented. Available local automated checks are complete; native/device and external-provider acceptance remains unverified as listed below. Prompt 3 has NOT started. No publication, public deployment, paid service or EAS cloud build was performed. Previous foundation evidence is preserved in STATUS.PROMPT1.md.

## Implemented

- ASP.NET Core Identity with PostgreSQL migrations, framework password validation/hashing, unique normalized email, verified-email login and UTC 18+ DOB eligibility.
- Five-minute validated RS256 JWTs, opaque hashed rotating refresh families, absolute 30-day expiry, per-user database locks, 30-second encrypted idempotent retry and tested replay/race handling.
- Logout, logout-all, immediate server-side session/account checks, password recovery/reset with single-use codes and atomic revocation of prior sessions.
- Generic registration/recovery responses, request-size limits, documented IP rate limits and account lockout; safe DTOs/errors/logging with no private DOB or hashes.
- Encrypted durable email queue, bounded retry/expiry, email-provider interface and real MailKit SMTP transport. Explicit local-only Mailpit; production requires SMTP credentials and certificate-protected persistent keys.
- Expo iOS/Android login/register/verify/forgot/reset forms with English/Georgian text, loading/error handling, real session-protected tabs and account/logout controls.
- SecureStore refresh storage, memory-only access, shared refresh among requests, serialized secure writes and session-generation guards. Account-specific query/mutation caches clear on logout, switch and invalid refresh; stale A responses cannot enter B's state.
- Generated API contract, dependency locks, development key/config helper, backend migration, Docker auth mounts and CI Mailpit service. README, AUTH/API/DECISIONS/TESTING/VERSIONS updated.
- Profiles/photos/discovery/chat/moderation actions are not implemented in this stage; Angular remains the agreed moderator shell. Account deletion will call the existing clear path when its lifecycle stage is implemented.

## Environment and commands

Windows; Node 22.22.3, npm 11.6.2, workspace-local .NET SDK 10.0.401. npm.cmd/npx.cmd avoid the machine PowerShell script policy. For .NET checks DOTNET_ROOT/PATH/DOTNET_CLI_HOME/NUGET_PACKAGES selected .tools/dotnet and .tools caches. ConnectionStrings__Database and TEST_DATABASE_CONNECTION were read from ignored infra/.env (127.0.0.1:55432) without printing secrets.

For a new checkout follow README. With dependencies/services ready, PowerShell shortcuts are `./scripts/dev.ps1 migrate`, `./scripts/dev.ps1 api`, and in another terminal `npm.cmd run mobile:start`. Copy mobile/.env.example and set a reachable API URL first. Mailpit is http://localhost:8025; copy verification/reset codes into the app. Production settings and concurrency policies are in AUTH.md.

## Exact verification results

| Command/check | Result |
|---|---|
| npm exec --yes --package npm@11.6.2 -- npm ci | PASS; 1463 packages installed, 1467 audited |
| dotnet restore backend/Dating.slnx --locked-mode | PASS; all three projects |
| dotnet build backend/Dating.slnx --no-restore | PASS; 0 warnings, 0 errors |
| dotnet test backend/Dating.slnx --no-build --logger trx | PASS; 10 unit + 13 integration tests, 0 failed/skipped |
| Real PostgreSQL auth integration | PASS; unique disposable databases, races/replay/reset/revocation/JWT/lockout/throttle |
| Actual SMTP -> local Mailpit | PASS; delivered message observed through Mailpit HTTP API, no external recipient |
| dotnet ef database update --project backend/Dating.Api --no-build | PASS; IdentityAndSessions migration applied to local dev database |
| dotnet ef migrations has-pending-model-changes --project backend/Dating.Api --no-build | PASS; no model drift |
| dotnet ef migrations script --idempotent --project backend/Dating.Api --no-build --output artifacts/migration.sql | PASS |
| dotnet publish backend/Dating.Api -c Release --no-restore -o artifacts/api | PASS; local output only |
| npm run contract:generate | PASS; generated auth OpenAPI/types from real API |
| npm run contract:check | PASS after clean install; no contract drift |
| npm run smoke:api | PASS on unchanged rerun; actual mobile health client in Node -> API -> PostgreSQL |
| npm run lint | PASS; zero warnings |
| npm run typecheck | PASS; shared contract, mobile and Angular |
| npm test | PASS; mobile 4 suites/16 tests, Angular 1 file/1 test |
| npm run admin:build | PASS; production bundle 283.87 kB raw |
| mobile/: npx expo install --check | PASS; compatible/up to date |
| mobile/: npx --yes expo-doctor | PASS; 21/21 checks |
| npm run export --workspace mobile -- --max-workers 2 | PASS; iOS 1302 modules / 3.6 MB, Android 1437 modules / 3.9 MB; JavaScript/Hermes only |
| docker compose --env-file infra/.env -f infra/compose.yaml --profile app build api | PASS; Linux image restores locked NuGet packages and publishes |
| docker compose ... --profile app up -d api + HTTP checks | PASS; ready=200, anonymous /api/auth/me=401; API container stopped afterward |

Test artifacts: backend/tests/*/TestResults/*.trx. Final backend run: 12:42 unit / 12:43 integration local time; integration duration 1m19s. Frontend clean-install rerun: 16 mobile tests in 51.707s; Angular 1 test passed and production build passed. Local API Docker image ID begins 12305e53bf3e. Publish/migration/export outputs and local auth keys are ignored, not source-controlled.

## Failures encountered and resolved

- npm 10 invoked by initial Expo installation violated the pinned engine/peer resolution; reran using npm 11.6.2. Clean npm ci now passes with strict peers.
- JWT signing-provider global cache reused RSA from a disposed test host, causing intermittent JWT failures. Disabled that per-key cache so each host owns its cryptographic provider; complete real database suite passes.
- Mobile lint's preserve-caught-error check identified a lost cause on a stale-session guard; preserved the cause and reran lint/tests.
- First final smoke aborted at the unchanged five-second mobile timeout during concurrent clean-install/container work. An unchanged rerun passed in 7.3 seconds total including API startup. Resource contention is suspected, not proven; no timeout or assertion was weakened.
- Optional container packaging was unverified in Prompt 1. It is now built and actually started successfully with the auth configuration/key-ring mounts.
- Earlier iterative test failures were fixed; final counts above refer to actual completed runs, not skipped checks.

## Remaining blockers / unverified

- NOT RUN: Android native compilation, emulator/install and physical Android auth/SecureStore/navigation/backup behavior. Android SDK/adb, owner application ID and configured device are unavailable.
- NOT RUN: iOS native compilation, simulator/install and physical iPhone auth/Keychain/navigation behavior. This Windows host has no macOS/Xcode; owner bundle ID/signing/device are unavailable.
- NOT RUN: EAS cloud builds, signing/distribution. Owner Expo project/account credentials are absent; no IDs invented.
- NOT RUN: real provider SMTP StartTLS/deliverability, sender-domain configuration, production key/certificate persistence/rotation and public HTTPS/proxy topology. No production secrets/provider account supplied. Production rejection of local capture/missing configuration is tested; local SMTP success is not external-delivery proof.
- NOT RUN: GitHub-hosted workflow (no repository remote). Workflow and constituent local checks are real; no hosted success claimed.
- Mocked mobile storage/transport tests and Metro bundles do not establish native-device acceptance. Follow the separate platform checklist in TESTING.md.
- npm audit retains 13 moderate transitive Expo/Router advisories, no high/critical. Incompatible downgrade suggestions were not applied. Local pinned PostgreSQL image remains 17.5/PostGIS3.5; review patches before release.
- Rate limits are process-local for the documented single API instance. Multi-instance deployment/proxy trust and operational key rotation need a separately verified rollout.

## Next step

Perform the remaining physical iPhone/Android and production-provider checks when owner tools/credentials are available. Prompt 3 (profiles/photos) is not started and requires a separate user request.
