# Status - Prompt 6

Updated 2026-10-01. Prompt 5 was completed, verified and reported BEFORE Prompt 6 began; its full results are archived in STATUS.PROMPT5.md. Prompt 6 is complete for all available local checks. Native/provider checks remain unverified as listed below. Prompt 7 has NOT been started. No publication, public deployment or purchase occurred.

## Implemented

Persisted text chat behind current conversation membership/account/block/unmatch authorization. REST is the only writer; messages, exact monotonic sequence and outbox commit together. Database uniqueness enforces sender/conversation/clientMessageId retries and per-conversation ordering. Same ID/content returns the same persisted message; conflicting text is rejected. Message size, request and database-backed new-message rate limits apply.

Authorized 50-message cursor history/catch-up, last-message previews, unread counts and monotonic per-user message-ID read cursors. Text is rendered as text. Production API/hub HTTP fails closed; no E2E encryption claim. Storage/TLS operational limitations are documented in CHAT.md.

SignalR 10 client and server use bearer-header LongPolling. Every subscription and each destination connection rechecks current membership/session/expiry. Signals contain only a conversation ID; history remains authoritative. Outbox uses database claims, persisted backoff and dead-letter state. Foreground reconnect/resume/fallback fetches fill persisted-history gaps.

Mobile includes guarded chat routes, Matches -> Chat navigation, keyboard-avoiding multiline composer, pending/sent/read/error states, Unicode-safe account/origin-bound SecureStore pending journal, same-ID retry, stable message merge, bounded history window and older/newest navigation. History high-water is advanced only by actual history pages, never by a racing send response.

Original specifications and earlier stages preserved. See CHAT.md, MATCHING.md, API.md, DECISIONS.md, VERSIONS.md and TESTING.md.

## Exact checks

| Command | Result |
|---|---|
| dotnet build backend/Dating.slnx --no-restore | PASS; 0 warnings/errors before migration generation; subsequent test/publish builds also passed |
| dotnet test backend/Dating.slnx --no-restore --logger trx | PASS; 23 unit + 50 real PostgreSQL integration tests = 73 |
| dotnet restore backend/Dating.slnx --locked-mode | PASS |
| dotnet ef database update --project backend/Dating.Api --no-build | PASS; 20261001041120_PersistedTextChat applied locally |
| dotnet ef migrations has-pending-model-changes --project backend/Dating.Api --no-build | PASS; no drift |
| dotnet ef migrations script --idempotent --project backend/Dating.Api --no-build --output artifacts/migration.sql | PASS |
| dotnet publish backend/Dating.Api -c Release --no-restore -o artifacts/api | PASS |
| npm run contract:generate / npm run contract:check | PASS; actual API and shared TypeScript agree |
| npm run smoke:api | PASS; real mobile fetch wrapper in Node -> API -> PostgreSQL |
| npm run typecheck / npm run lint | PASS; final cursor regression included |
| npm test --workspace mobile | PASS; 13 suites / 45 tests, including final cursor-race regression |
| npm test --workspace admin | PASS; 1 test |
| npm run admin:build | PASS; 283.87 kB production bundle |
| mobile/: npx expo install --check | PASS; SDK-compatible graph |
| mobile/: npx --yes expo-doctor | PASS; 21/21 |
| npm run export --workspace mobile -- --max-workers 2 | PASS on final code; iOS 1827 modules / 5.1 MB, Android 1913 / 5.3 MB; Hermes bundles only |
| docker compose --env-file infra/.env -f infra/compose.yaml --profile app build api | PASS; Linux runtime image fb0be5aaa761 |

Backend tests include real PostgreSQL concurrency, duplicate/opposite sends, exact sequence ordering with timestamp ties, rollback on failed event persistence, rates/length, cursor gaps, read cursor ownership/monotonicity, previews/unread, unmatch races and current session/block state. SignalR negotiation, JSON handshake, Subscribe and actual hint frames are exercised through ASP.NET TestServer with real PostgreSQL; this is in-process protocol evidence, not a physical-device/network deployment claim.

Mobile tests mock native APIs and exercise the real composer, pending storage, unchanged retry IDs, response/history deduplication, large sequences, Unicode storage, account/origin isolation, backoff and stale connection starts. No assertions/settings were weakened.

Initial test setup failures were corrected: the production HTTPS test attempted to change an already-used HttpClient.BaseAddress (replaced with an absolute request URI), and the composer test had to explicitly model AppState active. Final review fixed a potential history gap when a later send response advanced beyond an unseen peer message; a dedicated composer regression verifies the history cursor remains at the last fetched sequence. Non-failing Node module-type / Metro color-environment warnings remain.

## Unverified / blockers

- NOT RUN: real iPhone/Android keyboard, safe-area/accessibility behavior, network interruption/app-kill/resume, native SignalR transport and keychain failure/reinstallation behavior. Devices/native toolchains/owner IDs are unavailable; Windows has no Xcode.
- NOT RUN: signed native/EAS builds; owner/signing credentials unavailable. Expo export is Hermes bundling, NOT native compilation.
- NOT RUN: external production TLS certificate/ingress, PostgreSQL volume/backup encryption, retention/deletion operations. Production HTTP rejection is tested, but no deployed TLS/storage protection is claimed. PostgreSQL text remains readable to authorized server/database operators; chat is not E2E encrypted.
- NOT RUN: inherited external S3 private-bucket and production SMTP/domain/key-rotation checks; credentials unavailable.
- NOT RUN: hosted CI; no configured remote/hosted run evidence.
- Single API instance is the supported deployment model; connection registry and generic request limits are process-local. Multi-instance SignalR/outbox routing requires further verified infrastructure.
- npm installation still reports 13 moderate transitive advisories, no high/critical. No incompatible framework downgrade.
- Chat outbox dead letters are operator-visible via ChatOutboxDeadLetters SQL view; no public operator/safety API was added.

## Run / next step

1. docker compose --env-file infra/.env -f infra/compose.yaml up -d database mailpit
2. ./scripts/dev.ps1 migrate
3. ./scripts/dev.ps1 api
4. npm.cmd run mobile:start

Use two real verified/eligible accounts, create a mutual like, open Matches -> Open chat. Optional explicit local photo approval: ./scripts/dev.ps1 api -AutoApprovePhotos.

Next: execute the native/device and provider checks in TESTING.md when tools/accounts are available. Stop after Prompt 6. Do NOT start Prompt 7 without a new user instruction.
