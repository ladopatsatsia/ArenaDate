# Status - Prompt 8

Updated 2026-10-01. Prompt 8 is complete for the implementation and available local checks. Real APNs/FCM delivery and native/device validation remain NOT RUN as listed below. Prompt 7 is archived in STATUS.PROMPT7.md. Prompt 9 has NOT been started. No public deployment, purchase, store publication or cloud/native signing action occurred.

## Implemented

Expo-compatible match/message push for iOS and Android. New dependencies: expo-notifications 57.0.21 and expo-device 57.0.2, selected through expo install and locked. Notifications plugin, Android activity channel, owner-supplied Firebase config path and existing separate EAS build profiles are configured. Framework/backend dependency versions remain unchanged.

Authenticated installation registration validates provider/project/platform/token metadata and binds the server actor/session. Multiple devices (maximum ten active/account), token rotation, same-token refresh, logout/logout-all/reset/replay revocation and installation-proof ownership transfer are implemented. Persistent command and binding revisions reject delayed old-owner actions without dropping ordinary same-token refresh deliveries. An opted-out new account still rebinds/deactivates the prior installation.

Tokens use separately configured AES-256-GCM keys for delivery and SHA-256 lookup. Installation proof is hashed server-side and kept in device SecureStore. No token material, proof, ciphertext, provider receipt or secret is returned in response DTOs or logs. Enhanced Expo push security uses a server-only access token. Missing configuration is explicit: delivery defaults off and registration returns 503; enabled incomplete configuration fails startup.

Transactional per-device push outbox from the real match/message write paths, unique delivery keys, PostgreSQL concurrent claims, persisted attempts/backoff/receipts and PushDeadLetters SQL view. Current match/account/block/unmatch/session/preferences/binding are checked under pair/device locks before bounded provider calls. Invalid-token receipts deactivate only the current binding. Crash-after-provider-acceptance recovery keeps the same notification identity; external display is still at-least-once.

Both preferences default off. Generic lock-screen text contains no message/profile/account content. Foreground display is suppressed. Foreground/background/cold-start response handling uses strict untrusted payload validation, authenticated target resolution, existing session refresh and normal chat reauthorization. Mobile registration/preference operations are serialized, and stale account callbacks cannot navigate another account. English/Georgian settings and error states are included.

Migration 20261001141958_PersistedPushNotifications is applied locally. Provider setup, separate encryption-key rotation, operational limitations and separate physical iPhone/Android checklists are documented in PUSH.md. Original specification files, earlier work and Angular shell are preserved.

## Exact checks

| Command | Result |
|---|---|
| dotnet build backend/Dating.slnx --no-restore | PASS; initial build 0 warnings/errors; final full test build and Release publish also compile current source |
| dotnet restore backend/Dating.slnx --locked-mode | PASS after network-enabled retry; no package change |
| dotnet test backend/Dating.slnx --no-restore --logger trx | PASS; 28 unit + 74 real PostgreSQL integration = 102 tests, 0 skipped |
| dotnet ef database update --project backend/Dating.Api --no-build | PASS; push migration applied |
| dotnet ef migrations has-pending-model-changes --project backend/Dating.Api --no-build | PASS; no drift |
| dotnet ef migrations script --idempotent --project backend/Dating.Api --no-build --output artifacts/migration.sql | PASS |
| dotnet ef migrations list --project backend/Dating.Api --no-build | PASS; all nine migrations applied |
| dotnet publish backend/Dating.Api -c Release --no-restore -o artifacts/api | PASS |
| npm.cmd run contract:generate / npm.cmd run contract:check | PASS; current shared contract matches actual API |
| npm.cmd run smoke:api | PASS on isolated final run; actual mobile fetch wrapper -> API -> PostgreSQL ready |
| npm.cmd run typecheck / npm.cmd run lint | PASS |
| npm.cmd test --workspace mobile -- --runInBand | PASS; 17 suites / 63 tests |
| npm.cmd test --workspace admin | PASS; 1 Angular test |
| npm.cmd run admin:build | PASS; 283.87 kB production bundle |
| npm.cmd ls expo-notifications expo-device | PASS; 57.0.21 / 57.0.2 respectively |
| mobile/: npx.cmd expo install --check | PASS |
| mobile/: npx.cmd --yes expo-doctor | PASS; 21/21 |
| mobile/: npx.cmd expo export --platform all --max-workers 2 | PASS; iOS 1,897 modules / 5.2 MB; Android 1,993 modules / 5.4 MB |
| docker compose --env-file infra/.env -f infra/compose.yaml --profile app build api | PASS; Linux image sha256:f0f22bf4037206bddc43b8e8a15f54ab4cb2d73344d70d71733a1738eee44469 |

Final backend TRX: backend/tests/Dating.UnitTests/TestResults/ladop_LADOPC_2026-10-01_18_36_11_net10.0.trx and backend/tests/Dating.IntegrationTests/TestResults/ladop_LADOPC_2026-10-01_18_36_39_net10.0.trx.

Twenty added backend cases (5 unit, 15 real DB) cover encryption/metadata, several-device fanout and replay, concurrent claims, crash recovery, persisted retries/dead letters, invalid/late receipts, rotation, ownership transfer, logout/preferences/account/block/unmatch exclusion and target authorization. Eleven added mobile tests cover strict payload rejection, account isolation, installation journaling/storage failure, permission/project/Expo Go checks, opted-out account rebinding, cold-start/deduplication and serialized registration/preferences.

Initial issues were corrected without weakening checks: sandbox NuGet vulnerability metadata access failed; network-enabled locked restore succeeded after an automatic approval-review quota interruption and user resumption. A mobile fixture needed an explicit partial-native-response cast; nullable state handling was fixed; the outbox-claim test used the analyzer-required Assert.Single predicate overload. One readiness smoke failed during concurrent checks; migration state was verified and the unchanged smoke passed in isolation. Root cause of that initial readiness failure was not independently proven. Existing non-failing Node module-type, Metro color and Docker pipe-preface warnings remain.

## Unverified / blockers

- NOT RUN: real Expo -> APNs/FCM provider send/receipts, actual lock-screen delivery and token invalidation. Owner EAS project configuration, Expo access token, Apple/APNs and Firebase/FCM credentials are unavailable. Tests use an explicitly test-only provider/HTTP handler; no real delivery is claimed.
- NOT RUN: physical iPhone and Android foreground/background/cold-start behavior, native permissions/channels, offline/logout transitions, reinstall/backup/keychain behavior and token rotation. Devices/development binaries are unavailable. Separate checklists are in PUSH.md.
- NOT RUN: signed native/EAS builds. Owner bundle/package IDs, signing/provisioning and cloud build credentials are missing; Windows has no Xcode. Hermes export is not native compilation; Expo Go is rejected for remote-push registration.
- NOT RUN: deployed encryption key rotation, secret-manager integration, production TLS/ingress, disk/backup protection or restored-device proof recovery. Required separate keys and safe rotation steps are documented, not fabricated.
- NOT RUN: inherited external S3/SMTP provider checks and hosted CI; no credentials or remote run evidence. Workspace has no .git metadata; no commit/PR was created.
- Known delivery limits: already accepted provider bytes cannot be recalled; external display can duplicate; offline local logout cannot immediately revoke the server session. Untrusted payloads never bypass target authorization.
- Lost installation proof with an identical reused provider token fails closed instead of allowing takeover. Recovery requires retained proof or an owner-reviewed reset; actual reinstall behavior remains unverified.
- Operational delivery/proof/hash records have no automatic retention purge in this stage. Broader account-deletion/retention orchestration is deferred to its requested stage.
- Supported deployment is one API instance. PostgreSQL claims are concurrency-tested; multi-instance infrastructure/provider load is not verified.
- Dependency installation reported 13 moderate transitive npm advisories, unchanged from the prior graph. No incompatible upgrade or audit suppression was applied.

## Run / next step

1. docker compose --env-file infra/.env -f infra/compose.yaml up -d database mailpit
2. ./scripts/dev.ps1 migrate
3. ./scripts/dev.ps1 api
4. npm.cmd run mobile:start

Local app/chat work with push disabled. For real push, configure owner EAS/APNs/FCM credentials and the separate server encryption key ring exactly as described in PUSH.md, then install development builds on real devices and opt in through Profile -> Notifications.

Next: execute the physical iPhone/Android and provider checklists when owner credentials/tools are available. Stop after Prompt 8; do NOT start Prompt 9 without a new user instruction.
