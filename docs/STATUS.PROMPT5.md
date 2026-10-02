# Status - Prompt 5

Updated 2026-10-01. Prompt 5 is complete for all available local checks; native/provider verification remains unrun as listed below. Prompt 6 is authorized ONLY after this stage is verified/reported; Prompt 7 is not authorized. Historical evidence is preserved in STATUS.PROMPT1.md through STATUS.PROMPT4.md.

## Implemented

Transactional immutable like/pass, owner-scoped request receipts, ordered PostgreSQL user-row locking, canonical unique mutual match, exactly one conversation and match event in the same commit. Current reciprocal eligibility is checked inside the transaction. Internal block/unmatch primitives share locks and close matches; public safety UI/routes remain later work.

Durable match outbox/inbox with SKIP LOCKED, idempotent consumption, atomic acknowledgement, persisted exponential retry and eight-attempt dead-letter view. Native gesture card, accessible buttons, small SecureStore pending intent, same-ID ambiguous retry across restart, actual-match modal deduplication and a real paginated Matches list. No chat/message/SignalR implementation in this stage.

Policy, API semantics, operational recovery and tradeoffs: MATCHING.md. Original specifications and earlier work preserved.

## Exact checks

| Command | Result |
|---|---|
| dotnet build backend/Dating.slnx --no-restore | PASS; 0 warnings/errors |
| dotnet test backend/Dating.slnx --no-restore --logger trx | PASS; 23 unit + 39 real PostgreSQL integration tests = 62 |
| dotnet restore backend/Dating.slnx --locked-mode | PASS |
| dotnet ef database update --project backend/Dating.Api --no-build | PASS; TransactionalMatching and MatchOutboxRetryPolicy applied |
| dotnet ef migrations has-pending-model-changes --project backend/Dating.Api --no-build | PASS; no drift |
| dotnet ef migrations script --idempotent --project backend/Dating.Api --no-build --output artifacts/migration.sql | PASS |
| dotnet publish backend/Dating.Api -c Release --no-restore -o artifacts/api | PASS |
| npm run contract:generate / npm run contract:check | PASS |
| npm run smoke:api | PASS on independent rerun; real mobile fetch wrapper in Node -> API -> PostgreSQL |
| docker compose --env-file infra/.env -f infra/compose.yaml --profile app build api | PASS; Linux image 31062f0f83c5 |
| npm ls react-native-gesture-handler | PASS; one deduplicated 2.32.0 across mobile/Router/drawer |
| mobile/: npx expo install --check | PASS after dependency correction |
| mobile/: npx --yes expo-doctor | PASS; 21/21 |
| npm run typecheck / npm run lint | PASS on final dependency graph |
| npm test --workspace mobile | PASS; final graph: 9 suites / 35 tests |
| npm test --workspace admin | PASS; 1 test |
| npm run admin:build | PASS; production bundle 283.87 kB |
| npm run export --workspace mobile -- --max-workers 2 | PASS; iOS 1792 modules / 4.9 MB, Android 1888 modules / 5.1 MB; Hermes export only |

Failures found and fixed: xUnit analyzer assertion style; missing Worklets native test mock; cancelled gesture erroneously submitting a like (regression test now verifies cancellation). Expo detected Router's optional 3.3.0 native peer beside SDK-compatible 2.32.0; explicit root dependency/override resolves one version. An intervening typecheck against the mixed graph failed; final graph rerun is recorded above. One smoke readiness attempt returned 503 under concurrent build load; unchanged independent rerun returned ready. Node emitted a non-failing module-type warning.

An earlier automatic approval review failed because of usage quota, not a safety determination; the requested rerun was later authorized and Expo checks completed.

Tests cover concurrent reciprocal/repeated/opposite decisions, immutable/unique constraints, forced write rollback, fresh eligibility, block/unmatch races, exact match/conversation/event identities, owner-only reads/ack, outbox replay/competing consumers/backoff/dead-letter recovery. Mobile tests cover storage/network ambiguity, repeated actions, response mismatch, account isolation, durable modal claims, accessible buttons and gesture callback behavior. Native APIs are mocked in Jest.

## Unverified / blockers

- NOT RUN: physical iPhone/Android gesture feel, keyboard/accessibility/OS lifecycle, kill/restart under real lost responses and native SecureStore behavior. Devices and native toolchains/owner IDs unavailable; Windows has no Xcode.
- NOT RUN: signed native/EAS builds, external S3 and production SMTP/domain/key-rotation checks; owner/provider credentials unavailable.
- NOT RUN: hosted CI; no configured repository remote/hosted execution evidence.
- Expo export is Hermes bundling, not native compilation. Existing 13 moderate transitive npm advisories remain (no high/critical reported).
- Process-local rate limits, single-instance deployment and storage/backup protection require production verification. SecureStore claims favor deduplication: a crash after claiming but before rendering can suppress that modal; the match remains in the real Matches list.

## Run / next step

Local services: docker compose --env-file infra/.env -f infra/compose.yaml up -d database mailpit.
Migrations: ./scripts/dev.ps1 migrate.
API: ./scripts/dev.ps1 api (optional explicit local -AutoApprovePhotos).
Mobile: npm.cmd run mobile:start.

Use two verified, visible, complete adult profiles with approved photos and reciprocal filters. Swipe or press Like/Pass in Discover; mutual likes appear in Matches.

After final checks and the Prompt 5 completion report, proceed ONLY to the newly authorized Prompt 6. Never start Prompt 7.
