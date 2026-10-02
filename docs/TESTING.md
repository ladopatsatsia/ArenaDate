# Verification

Prompt 9 adds nine PostgreSQL moderation cases and five Angular cases. The opt-in `AdminBrowserTests` runs compiled Angular, Edge, HTTPS Kestrel and an isolated PostgreSQL database; set `RUN_ADMIN_BROWSER=1` after building Angular. See MODERATION.md. The test creates no administrator in the local app database. `artifacts/admin-browser/audit.png` contains only test fixture data; it is not native mobile evidence.

Run from root after README setup; commands and actual outcomes are recorded in STATUS.md.

```text
npm ci
dotnet tool restore
dotnet restore backend/Dating.slnx --locked-mode
dotnet build backend/Dating.slnx --no-restore
dotnet test backend/Dating.slnx --no-build --logger trx
dotnet ef migrations has-pending-model-changes --project backend/Dating.Api
dotnet ef database update --project backend/Dating.Api
dotnet ef migrations script --idempotent --project backend/Dating.Api --output artifacts/migration.sql
npm run contract:check
npm run smoke:api
npm run lint
npm run typecheck
npm test
npm run admin:build
npm run export --workspace mobile -- --max-workers 2
```

Use npm 11.6.2. On this Windows host use npm.cmd/npx.cmd; the optional workspace SDK/cache is selected by scripts/dev.ps1. Set TEST_DATABASE_CONNECTION before dotnet test (same local connection as README is suitable, with CREATE DATABASE privilege). Start both Compose PostgreSQL/PostGIS and Mailpit: auth integration includes actual local SMTP and HTTP capture on ports 1025/8025. No external email is sent.

Backend tests fail clearly when PostgreSQL is unavailable; they create unique disposable databases and drop only those databases. They exercise migrations, safe errors, database outage, production OpenAPI hiding, JWT issuer/audience/signature/expiry, unverified/duplicate/parallel registration, lockout/rate limits, refresh rotation/replay/races/idempotent retry, logout/revocation/expiry, password reset and concurrent reuse, email expiry and retry. No EF InMemory or SQLite fallback. Unit tests cover UTC adult boundaries and production configuration requirements.

Jest/RNTL tests use mocked native storage/transport and real session/query-cache logic: single refresh across 401s, persisted retry IDs, account switching, stale requests/writes, concurrent sign-in, invalid/corrupt credentials, offline logout and real form error handling. They do not prove OS-backed storage or native navigation. Angular HttpTestingController covers the health shell.

In mobile/: `npx expo install --check` and `npx expo-doctor`. Run Metro exports separately from Jest/Vitest on this host to avoid resource contention. JavaScript/Hermes export is not native compilation.

## Manual matrix: run separately on physical iPhone and Android

Record model, OS, build ID, date and evidence for each platform.

1. Build/install a development client with owner IDs, toolchain and signing. Verify Georgian/English glyphs, safe areas, keyboard, large text, screen reader field labels and back navigation.
2. Connect to the actual API over LAN/trusted HTTPS (phone localhost is not the PC). Exercise readiness success, database failure, offline state and retry.
3. Register an adult, reject an under-18 date, inspect local Mailpit, copy the full code into Verify. Unverified sign-in must fail; verified sign-in must show only that account's ID. Duplicate registration must not reveal account existence.
4. Kill/relaunch the app: restore through a real refresh, never a cached account. Let the access token expire and make concurrent authorized requests. Turn the network off during refresh and retry; an ambiguous response delayed beyond the documented 30-second window must require sign-in.
5. Logout, cold-start and follow private tab deep links: no private screen. Sign in as A, then logout/sign in as B; no A account ID, cache or credentials. Repeat while A's request is in flight. Offline logout must explicitly say remote revocation is unconfirmed.
6. On two devices sign in to the same account; logout-all on one must deny the other's next request/refresh. Request password recovery, reset once, reject reuse, reject old password and all prior sessions.
7. Inspect secure-storage behavior across process restart, device lock and platform backup/restore. iOS Keychain may survive reinstall; the app must still revalidate with the server. Android SecureStore backup exclusion must be present in the native build.
8. Preview/release builds: HTTPS required, health screen unavailable, private tab deep links guarded by real auth.

NOT RUN until devices/toolchains/owner IDs are supplied. Windows cannot build/run an iOS simulator. Expo Go, Node smoke, mocked storage and Metro bundles are not evidence of native acceptance. EAS cloud builds require owner account/signing and are not run automatically.

## Production and hosted checks

Before release, provide the private RSA key, protected persistent data-protection key ring and real SMTP provider credentials per AUTH.md. Verify provider StartTLS/certificate chain, sender-domain deliverability, real inbox verification/reset, key persistence across restart and operational rotation. Local Mailpit does not establish these. If adding a proxy/multiple instances, configure trusted proxies/distributed throttling and verify row-lock/session behavior in that topology.

GitHub Actions starts real PostGIS and Mailpit and runs executable checks. No hosted CI run is claimed without a repository/remote. The Node smoke command uses the actual mobile health fetch wrapper against API/PostgreSQL; it is not native-device evidence. Optional API container can be built locally per README without public deployment.

## Prompt 3 verification

Backend integration uses real PostgreSQL and private local storage to cover owner checks, role-gated approval, pending completion exclusion, idempotent uploads, bounded/tampered/viewer-bound media tickets, profile validation, parallel edits/reorder, primary deletion, expired slots and orphan cleanup. Photo unit tests decode/re-encode real JPEG/PNG pixels, apply EXIF orientation and verify metadata removal and size rejection. Mobile tests cover lost finalize responses and retrying the same request ID without duplicate uploads.

Linux native codec check: docker build --target image-check -f backend/Dating.Api/Dockerfile -t dating-mvp-image-check . (runs PhotoProcessorTests). The normal runtime remains the final Docker stage.

For EACH physical iPhone and Android: test denied and limited library permission, settings fallback, supported HEIC/JPEG/PNG, iCloud-only assets, portrait/landscape orientation, screen reader labels, pending/rejected/approved state, offline mid-upload retry, app termination followed by incomplete-slot cleanup, first-photo deletion and two-device reorder conflict. Confirm cached private photos disappear after account switching and no image is stretched. None is inferred from Metro/Jest. Real private S3 Get/Put/Delete and bucket public-access policy require owner configuration.

## Prompt 4 platform checks

On EACH physical iPhone/Android: enter a city without location permission; verify the empty state with no eligible accounts; create two real local eligible accounts to test reciprocal preferences; explicitly request location once; test denial, approximate permission, disabled services, Settings return and offline timeout. Confirm no prompt occurs on mount/resume and no background location permission/service is declared/requested. Remove location and verify distance mode becomes unavailable. Test filtered pagination/refresh, stale cursor recovery, hidden/blocked card/media rechecks, account switch during permission/picker prompts and readable Georgian/English controls. Native/device checks are NOT RUN until owner tooling/devices are available.

Backend tests use real PostGIS, including radius boundaries and migration with existing profiles. Pagination tests count database reader commands to prevent N+1 regression. Mobile location mocks are consent/error tests only; they are not GPS/device evidence. See DISCOVERY.md for exact settings/rate/pagination behavior.

## Prompt 5 verification

Backend MatchingTests use isolated real PostgreSQL databases, concurrent separate HTTP requests/scopes, uniqueness violations, database failure injection and rollback assertions. They test mutual/replayed/opposite likes, current eligibility, block/unmatch races, one match/conversation/event, owner-only receipt/list/acknowledgement, competing outbox consumers and poison-event backoff/dead-letter recovery.

Mobile tests exercise durable intent and retry logic, storage failure, account switching, server-response mismatch, receipt/event match deduplication, disabled accessible buttons and actual Gesture Handler callback streams (short, cancelled, left/right). Worklets/animation/native APIs are mocked; these are not device tests.

NOT RUN device matrix:
1. On iPhone and Android development builds, verify horizontal swipe follows the finger while vertical scrolling remains usable; cancelled gesture must not submit. Verify VoiceOver/TalkBack buttons and target sizes.
2. Like each other simultaneously on two devices; inspect one active match/conversation/event in PostgreSQL, one modal per account and the persisted Matches list.
3. Drop connectivity AFTER server commit but BEFORE response, kill/reopen the app, and confirm the pending UUID/kind is reused and no second action appears.
4. Switch accounts during pending network/storage work; no previous-account card, modal or action may cross into the new session. Returning to the original account reconciles its own intent.
5. Restart the API during outbox delivery and verify the same notice identities; test operator recovery of one reviewed dead-letter ID without duplicate modals.
6. Verify signed native builds/secure storage lifecycle with owner credentials and devices. Expo Hermes export alone is insufficient.

## Prompt 6 checks and device follow-up

ChatTests run against isolated PostgreSQL and exercise the real SignalR LongPolling JSON handshake/invocations (not mocked hub success). They verify unauthorized subscription, authorized hint delivery, stale session/block rejection, atomic persistence, duplicate sends, ordering, pagination gaps, read cursors, rate/length limits and unmatch racing send.

Mobile tests use mocked native transport/lifecycle/keychain boundaries and real composer rendering. They cover lost-response retries, stable IDs, Unicode-safe storage, account switching, HTTP/history merge, reconnect backoff and stale connection starts.

NOT RUN: iPhone/Android keyboard safe areas, hardware/back behavior, screen-reader scrolling, actual network transitions/keychain failures, OS background/resume and signed builds. With devices: send on two matched accounts, lose the response after persistence, restart/retry with the same ID, go offline across more than 50 messages, resume and check no gaps/duplicates. Scroll older messages while new ones arrive; verify newest button and read markers. Revoke session/block/unmatch while connected and confirm history/send/hints stop.

NOT RUN: real production TLS certificate/ingress and disk/backup encryption verification. Production HTTP rejection is integration-tested, which is not proof of a deployed TLS configuration.

## Prompt 7 safety verification

Run dotnet test backend/Dating.slnx --no-restore --logger trx with TEST_DATABASE_CONNECTION set to local PostgreSQL, then npm test --workspace mobile. SafetyTests covers real DB transactions, socket revocation and private media grants; mobile tests mock native APIs. Exact final counts are recorded in STATUS.md.

Device checks NOT RUN: on two eligible verified accounts, open a match on both phones, type an unsent draft, then block from either phone while the other sends. Confirm generic closure, cleared text/draft/pending retry, absent match/preview and no next message. Repeat with unmatch and report-and-unmatch. Reconnect/resume after offline revocation and ensure old content is cleared upon authorization refresh. From Profile -> Safety, report the closed conversation's recent incoming messages without seeing history; unblock and verify no old match/chat returns. Try report-and-block from a discovery profile and a selected incoming message. Check English/Georgian labels, screen reader focus, long descriptions, keyboard and confirmation layout. Verify SecureStore failure is visible and no phantom success is shown. Native signing/device/network/keychain/provider verification remains separate from Jest and Hermes exports.

## Prompt 8 push verification

Run dotnet test backend/Dating.slnx --no-restore --logger trx with a real TEST_DATABASE_CONNECTION, and npm.cmd test --workspace mobile -- --runInBand. PushTests uses real PostgreSQL and a test-only recording provider: encrypted registration/rotation, multiple-device match/message fanout, replay deduplication, invalid receipts, late receipt after rotation, persisted retries/dead letters, recovery after provider acceptance/DB rollback, concurrent claims, preferences, account/logout/block/unmatch exclusion, ownership proof/transfer and malicious target authorization. PushProviderTests exercises the real HTTP adapter through a mocked handler; it does not contact Expo.

Mobile tests mock native notifications/keychain/router and cover payload rejection, account-bound API/navigation, persistent installation revisions, permission denial, opted-out account transfer, Expo Go/project rejection, cold-start authentication, response deduplication and serialized preference changes. These do not prove native delivery.

Separate physical iPhone and Android verification checklists, owner APNs/FCM setup and expected privacy behavior are in PUSH.md. Real provider/device tests remain NOT RUN until owner credentials and native devices/builds are available.
