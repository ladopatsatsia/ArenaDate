# Status ? Prompt 0 / Prompt 1

Updated 2026-09-30. Foundation implementation and local automated checks complete; native/device acceptance remains unverified as listed below. Prompt 2 has not started. No publication, public deployment, paid service or EAS cloud build was performed.

## Implemented

- Read both original specifications, searched applicable AGENTS.md/structure/status; original files preserved. Added permanent Prompt 0 rules verbatim in AGENTS.md plus .NET 10/PostGIS/Angular clarification.
- .NET 10 controller-based modular-monolith foundation, PostgreSQL/PostGIS EF context and generated initial migration; no premature authentication/domain implementation.
- Real liveness/readiness, pending-migration/PostGIS checks, safe centralized ProblemDetails, server-owned correlation IDs and JSON logs without request URLs/bodies/tokens.
- Shared OpenAPI document and generated TypeScript package; repeatable actual-API generation and drift checks, used by mobile and Angular.
- Expo iOS/Android shell: onboarding/auth placeholders, clearly labeled development-only tab previews, dev-only actual API health screen, safe areas, Georgian/English infrastructure, failure/retry handling.
- EAS development/preview/production profiles. Owner project/package/bundle IDs are absent by design; preview/production reject missing identity settings or insecure API URLs.
- Angular standalone/Material moderator foundation with Router/HttpClient and real readiness UI. Authentication, roles, MFA and CSRF actions remain in their later stages.
- Docker Compose database/mail capture, API Dockerfile, SDK/runtime/package locks, workspace scripts, README, DECISIONS/API/TESTING/VERSIONS, executable GitHub Actions workflow using real PostGIS.
- Unit, real PostgreSQL integration, Jest/RNTL mobile and Angular tests. Real mobile fetch-wrapper-to-API-to-PostgreSQL smoke command.

## Environment

Windows, Node 22.22.3, npm 11.6.2 (invoked using npm exec), workspace-local official .NET SDK 10.0.401 with verified archive SHA-512. Shell commands used npm.cmd/npx.cmd because npm.ps1 is blocked by the machine execution policy. Local caches live in ignored .tools. Elevated tool execution was required for Docker/network restores and esbuild's parent-directory traversal.

PostGIS and Mailpit are running locally and healthy. DB is bound to 127.0.0.1:55432; API default is localhost:5180, avoiding existing services on 5432/5080. No existing service or user code was replaced. API smoke/contract processes terminate after checks. infra/.env contains a generated local-only password and is ignored.

## Exact verification results

All commands run from root unless a directory is specified. DOTNET_ROOT/PATH/DOTNET_CLI_HOME/NUGET_PACKAGES selected the workspace SDK/cache; database secrets were loaded from ignored infra/.env and never committed.

| Command / check | Result |
|---|---|
| npm exec --yes --package npm@11.6.2 -- npm ci | PASS; clean lockfile install, 1452 packages installed, 1456 audited |
| dotnet tool restore | PASS; EF tool 10.0.12 |
| dotnet restore backend/Dating.slnx --locked-mode | PASS; all 3 projects |
| dotnet build backend/Dating.slnx --no-restore | PASS; final clean build 0 warnings, 0 errors |
| dotnet publish backend/Dating.Api -c Release --no-restore -o artifacts/api | PASS; local release output, not deployment |
| dotnet test backend/Dating.slnx --no-restore --logger trx | PASS; 1 unit + 2 real PostgreSQL integration tests, 0 failed/skipped |
| dotnet ef database update --project backend/Dating.Api --no-build | PASS; local foundation migration applied |
| dotnet ef migrations has-pending-model-changes --project backend/Dating.Api --no-build | PASS; no pending model changes |
| dotnet ef migrations script --idempotent --project backend/Dating.Api --no-build --output artifacts/migration.sql | PASS; SQL generated |
| npm run contract:generate | PASS; generated from running backend |
| npm run contract:check | PASS; OpenAPI and TypeScript match backend |
| npm run smoke:api | PASS; actual mobile fetch wrapper -> API -> PostgreSQL returns ready; Node execution, not native-device evidence |
| npm run lint | PASS; ESLint 10, zero warnings |
| npm run typecheck | PASS; shared contract, mobile TS 6.0.3, Angular TS 5.9.3, including mobile tests |
| npm test --workspace mobile | PASS; 2 suites / 5 tests, 0 failures |
| npm run admin:build | PASS; production bundle 283.87 kB raw |
| npm test --workspace admin | PASS; 1 test file / 1 test (Vitest 4.1.11) |
| mobile/: npx expo install --check | PASS; dependencies up to date |
| mobile/: npx --yes expo-doctor | PASS; 21/21 checks |
| npm run export --workspace mobile -- --max-workers 2 | PASS; iOS 1140 modules / 2.5 MB Hermes bundle, Android 1275 modules / 2.8 MB; not native compilation |
| docker compose --env-file infra/.env -f infra/compose.yaml ps | PASS; PostgreSQL and Mailpit healthy |

Test artifacts are local ignored backend/tests/*/TestResults/*.trx; API publish and migration SQL are in ignored artifacts/. Angular output is admin/dist/admin.

## Failures encountered and resolved

- Missing stable .NET 10 SDK: installed a verified local SDK, preserving existing system SDKs.
- NuGet sandbox network errors: restored in authorized execution context. .NET compiler overload and EF transitive version conflicts fixed; build/tests now pass.
- Docker stopped during integration runs: timeouts were failures, not passes. Restarted engine and only project services; reran real PostgreSQL tests successfully. Reapplied local migration after restart before successful real-client smoke.
- Test configuration resolution and connection-string comparison corrected. Tests compare isolated database identity, not Npgsql's redacted password-bearing connection string.
- npm 10 Arborist peer-resolution crash: pinned npm 11.6.2; kept strict peer validation. React/ReactDOM aligned with Expo 57, renderer aligned, separate mobile/Angular TypeScript versions; fresh npm ci succeeds.
- Initial lint/typecheck/mobile test/Expo Doctor failures fixed through dependency/config corrections, not weakened assertions.
- Angular esbuild sandbox traversal failed; authorized rerun built successfully. One Vitest worker startup timeout during package replacement; after installation finished, rerun passed.
- One mobile UI test exceeded its default 5-second timeout during concurrent Metro bundling. Reran unchanged tests after bundling completed: all 5 passed in 3.54 seconds; no timeout/assertion was weakened.
- A build while the local API executable was running hit Windows file locks; stopped that owned process and final build passed with zero warnings.

## Remaining blockers / unverified checks

- NOT RUN: Android native compilation/install/emulator/physical phone. Android SDK/adb and configured device were unavailable; owner application ID absent. Follow README and TESTING.md.
- NOT RUN: iOS native compilation/simulator/physical iPhone. Windows has no Xcode/macOS; owner bundle ID/signing/device absent.
- NOT RUN: EAS development/preview/production cloud builds, signing or distribution. Owner Expo project/account/credentials have not been supplied. No IDs or credentials invented.
- NOT RUN: physical-device LAN/HTTPS connectivity, Georgian glyph rendering, safe areas, accessibility, navigation/back behavior and release deep-link guards. JavaScript bundles and mocked component tests do not establish these.
- NOT RUN: GitHub-hosted workflow. There was no Git repository/remote; the workflow is prepared and its constituent checks were run locally.
- NOT RUN: optional API Docker image build. Host .NET build/publish and actual Compose database were checked; container packaging still needs a separate build verification.
- npm audit retains 13 moderate transitive Expo/Router advisories; zero high/critical after Vitest fix. Incompatible suggested Expo downgrades were not applied. See VERSIONS.md. Pinned local PostgreSQL image reports 17.5/3.5; refresh/review patches and images before release.
- Real auth, dating behavior, moderator permissions and push are intentionally not implemented in Prompt 1 and are not represented as working.

## Next step

Complete the native iOS/Android setup and manual foundation matrix when owner IDs/toolchains/devices are available. Keep those checks open until executed. Start Prompt 2 only when the user requests it; this task does not authorize it.
