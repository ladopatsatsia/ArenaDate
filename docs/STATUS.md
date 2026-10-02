# Status - Prompt 11

Updated 2026-10-02. Prompt 11 is complete for implementation and local verification. Prompt 10 is archived in STATUS.PROMPT10.md. Prompt 12 is NOT authorized and has NOT been started. No store publication, paid subscription, or cloud deployment occurred.

## Implemented

Account lifecycle, data privacy controls, and asynchronous purge worker end to end adhering to AGENTS.md:
- **Immediate account deletion:**
  - Authenticated in-app endpoint `POST /api/account/delete` and alias `DELETE /api/account` requiring current password verification (`invalid_credentials` on failure; `staff_requires_operator` for staff accounts).
  - Immediate effects within a transaction: user marked `IsActive = false`, `IsDeleted = true`, email randomized (`deleted_<guid>@deleted.local`), password hash and security stamp cleared, lockout enforced (`LockoutEnd = DateTimeOffset.MaxValue`).
  - Profile immediately hidden (`Visible = false`), display name anonymized to "Deleted Account", bio, city, and location cleared.
  - All active auth sessions revoked immediately; active SignalR WebSocket connections severed and evicted via `connections.Revoke`.
  - All matches involving the user deactivated (`Active = false`).
  - In-flight push deliveries cancelled and deadlettered; push device credentials deactivated and ciphertexts erased.
  - SHA-256 hash of normalized email written to `DeletionTombstones` table to prevent silent account resurrection from database backup restores.
  - Asynchronous `AccountDeletionJob` queued in state `pending`.
- **Asynchronous retryable purge (`AccountPurgeWorker`):**
  - Hosted background service picking pending/failed jobs with PostgreSQL `FOR UPDATE SKIP LOCKED`.
  - Idempotent deletion of all stored media files (original and thumbnail) via `IPrivateStorage`.
  - Profile photo database records updated to `Deleted = true`, `ObjectsDeleted = true`, and object keys erased.
  - Exponential backoff retry on transient storage errors up to 10 attempts; job recorded as `completed`.
- **Store-compliant public deletion request & verification:**
  - Public route `GET /account/delete` serving accessible self-service HTML form for App Store and Google Play compliance.
  - Endpoint `POST /api/account/public-deletion-request` accepting email and returning HTTP 202 Accepted without account enumeration.
  - Single-use encrypted token sent to registered email; confirmed via `POST /api/account/confirm-deletion`.
- **User controls:**
  - Discoverability pause via `POST /api/account/discoverability-pause` and mobile toggle; hides profile from new discovery without closing matches or active chats.
  - Logout all devices via `POST /api/auth/logout-all`.
  - Independent push preferences for matches and messages via `POST /api/notifications/preferences`.
- **Mobile experience & tests:**
  - Integrated account deletion confirmation modal/form with password input in `mobile/src/profile/ProfileScreen.tsx`.
  - English and Georgian translations in `mobile/src/qualityStrings.ts`.
  - Mobile component and integration tests in `mobile/tests/account-lifecycle.test.tsx` verifying pause, password prompt, deletion API call, and session cache eviction.
- **Privacy policy & data inventory:**
  - Drafted comprehensive `docs/PRIVACY.md` marked for owner and legal review, detailing data inventory, 180-day safety report retention, surviving partner conversation retention, 30-day backup expiry, and explicitly avoiding false claims of E2E encryption or governmental age verification.

## Exact checks

| Command | Result |
|---|---|
| powershell -ExecutionPolicy Bypass -File scripts/dev.ps1 build | PASS; 0 warnings, 0 errors |
| powershell -ExecutionPolicy Bypass -File scripts/dev.ps1 test | PASS; 28 unit + 88 integration = 116 tests passed (1 opt-in browser test skipped) |
| powershell -ExecutionPolicy Bypass -File scripts/dev.ps1 check-migrations | PASS; no model drift |
| npm.cmd run contract:check | PASS; API contract and generated types match running backend |
| npm.cmd run smoke:api | PASS; real mobile fetch wrapper -> API -> PostgreSQL ready |
| npm.cmd run typecheck | PASS; strict typecheck across packages/api-contract, mobile, and admin |
| npm.cmd run lint | PASS; eslint clean, 0 warnings |
| npm.cmd test --workspace mobile -- --runInBand --forceExit | PASS; 22 suites / 74 tests passed |
| npm.cmd test --workspace admin -- --watch=false | PASS; 2 files / 6 tests passed |
| npm.cmd run admin:build | PASS; 441.52 kB production bundle |
| mobile/: npx.cmd --yes expo-doctor | PASS; 21/21 checks passed |

## Unverified / risks

- Physical iPhone and Android execution of deletion and push cleanup: NOT RUN locally; requires physical devices or connected emulators.
- Real remote APNs/FCM delivery and signed EAS production builds: NOT RUN without owner developer credentials, Apple Team IDs, and Firebase credentials.
- Legal approval of `docs/PRIVACY.md`: NOT APPROVED; explicitly marked as DRAFT for owner and counsel review before store submission.
- Production reverse proxy/TLS certificate and key protection: NOT RUN; tests operate in local sandbox and Docker Compose.

## Run / next step

1. Docker services: `docker compose --env-file infra/.env -f infra/compose.yaml up -d database mailpit`
2. Backend API: `powershell -ExecutionPolicy Bypass -File scripts/dev.ps1 api`
3. Mobile app: `npm.cmd run mobile:start`
4. Public deletion page: open `http://localhost:5000/account/delete` (or configured API port) in a browser.

Next: Prompt 12 (Adversarial whole-product regression review and bug fixing). Await explicit user authorization before starting Prompt 12.
