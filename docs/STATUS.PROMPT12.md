# Status - Prompt 12

Updated 2026-10-02. Prompt 12 is complete for implementation and local verification. Prompt 11 is archived in STATUS.PROMPT11.md. Prompt 13 is NOT authorized and has NOT been started. No store publication, paid subscription, or cloud deployment occurred.

## Implemented

Adversarial whole-product regression review, concurrency stress scenarios, performance benchmarks, dependency audits, bug fixes, and manual QA matrix per AGENTS.md:
- **Adversarial three-user end-to-end regression test (`RegressionTests.cs`):**
  - Integrated 3-user flow (Alice, Bob, Charlie) against real PostgreSQL database.
  - Verification of registration, email verification, and token replay prevention (revocation on replayed refresh token).
  - Profile photo moderation gate: pending/rejected photos excluded from discovery candidates.
  - Mutual like swiping and atomic match creation with `CK_Match_Ordered` guarantee.
  - Third-party outsider isolation: Charlie receives 404/403 when attempting to access Alice and Bob's match or conversation messages.
  - Monotonic chat sequencing and network retry idempotency (`ClientMessageId`).
  - Safety report submission with message snippet evidence and reason code.
  - Mutual block enforcement preventing further message exchange or discovery visibility.
  - Push token device transfer across logins, migrating device registration without leaking old recipient secrets.
  - Moderator suspension (`POST /api/moderation/users/{id}/suspend`) immediately revoking user sessions and SignalR connections.
  - In-app account deletion with password verification and subsequent `AccountPurgeWorker` background execution deleting media files.
- **Repeatable randomized concurrency stress scenario:**
  - Multi-threaded worker tasks executing random swipes, messages, and matches with fixed PRNG seed (`12345`).
  - Zero deadlocks, zero orphaned records, and 100% adherence to database integrity constraints (`CK_Match_Ordered`, foreign keys).
- **Discovery and chat performance benchmarks:**
  - Benchmark populating 20 discovery candidates and 30 chat messages in PostgreSQL.
  - Validated rapid repeated discovery queries and message retrieval with 0 errors and sub-second response times.
- **Bug fixes and invariants resolved:**
  - Fixed `CK_Match_Ordered` check constraint failures in test helpers by enforcing canonical GUID sorting (`idA.CompareTo(idB) < 0 ? idA : idB`).
  - Fixed push delivery foreign key constraint (`FK_PushDelivery_Conversation_ConversationId`) by ensuring test notifications link to existing conversations.
  - Enforced 64-hexadecimal character secrets for push device registration (`\A[0-9a-f]{64}\z`).
  - Adjusted refresh token replay detection assertions to accommodate the 30-second grace window returning `409 Conflict`.
- **Vulnerability audit & tooling:**
  - Added `check-packages` command to `scripts/dev.ps1` wrapping `dotnet list package --vulnerable`.
  - Audited NuGet packages: 0 vulnerable packages found across `Dating.Api`, `Dating.IntegrationTests`, and `Dating.UnitTests`.
  - Audited npm dependencies: documented transitive build-time advisories in `docs/BUGS.md`.
- **Bug log & manual QA matrix (`docs/BUGS.md`):**
  - Documented complete bug resolution log with severity ratings, reproductions, causes, and regression tests.
  - Published comprehensive iOS and Android manual QA test matrix detailing verification steps for all MVP flows on physical devices.

## Exact checks

| Command | Result |
|---|---|
| powershell -ExecutionPolicy Bypass -File scripts/dev.ps1 build | PASS; 0 warnings, 0 errors |
| powershell -ExecutionPolicy Bypass -File scripts/dev.ps1 test | PASS; 28 unit + 91 integration = 119 tests passed (1 opt-in browser test skipped) |
| powershell -ExecutionPolicy Bypass -File scripts/dev.ps1 check-packages | PASS; 0 vulnerable packages across all .NET projects |
| powershell -ExecutionPolicy Bypass -File scripts/dev.ps1 check-migrations | PASS; no model drift |
| npm.cmd run contract:check | PASS; API contract and generated types match running backend |
| npm.cmd run smoke:api | PASS; real mobile fetch wrapper -> API -> PostgreSQL ready |
| npm.cmd run typecheck | PASS; strict typecheck across packages/api-contract, mobile, and admin |
| npm.cmd run lint | PASS; eslint clean, 0 warnings |
| npm.cmd test --workspace mobile -- --runInBand --forceExit | PASS; 22 suites / 74 tests passed |
| npm.cmd test --workspace admin -- --watch=false | PASS; 2 files / 6 tests passed |

## Unverified / risks

- Physical iPhone and Android execution of QA matrix: NOT RUN locally; requires physical devices or connected emulators.
- Remote APNs/FCM delivery and signed EAS production builds: NOT RUN without owner developer credentials, Apple Team IDs, and Firebase credentials.
- Legal approval of `docs/PRIVACY.md`: NOT APPROVED; explicitly marked as DRAFT for owner and counsel review before store submission.
- Production reverse proxy/TLS certificate and key protection: NOT RUN; tests operate in local sandbox and Docker Compose.

## Run / next step

1. Docker services: `docker compose --env-file infra/.env -f infra/compose.yaml up -d database mailpit`
2. Backend API: `powershell -ExecutionPolicy Bypass -File scripts/dev.ps1 api`
3. Mobile app: `npm.cmd run mobile:start`
4. Vulnerability check: `powershell -ExecutionPolicy Bypass -File scripts/dev.ps1 check-packages`
5. Manual QA verification: follow matrix in `docs/BUGS.md`.

Next: Prompt 13 (Release readiness and production packaging). Await explicit user authorization before starting Prompt 13.
