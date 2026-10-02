# Status - Prompt 7

Updated 2026-10-01. Prompt 7 is complete for all available local checks. Native/device and external provider checks remain unverified as listed below. Prompt 6 results remain archived in STATUS.PROMPT6.md. Prompt 8 has NOT been started. No publication, deployment, service purchase or native cloud build occurred.

## Implemented

Unmatch, private directional block and unblock across discovery, matching, REST chat, SignalR and private media authorization. Unmatch prevents future rematching; unblock never recreates a closed match. Shared PostgreSQL pair locks serialize safety transitions with likes and sends. A profile already swiped by the caller remains blockable, including when a like commits first.

Transactional report, report-and-block and report-at-unmatch. The server resolves subject and evidence; descriptions/evidence are purpose-protected with the persistent key ring. Own/nonmember message evidence is rejected. A narrow paginated prior-conversation route permits later reports without normal history/send access. No user-facing report/evidence reader or reporter identity disclosure.

Database idempotency receipts, five-new-reports/day actor limit, 180-day report retention and 365-day receipt retention with bounded cleanup. Explicit backup/key/source-content retention limitations in SAFETY.md. Moderator review is a later stage; no review UI or automatic moderation result was invented.

Durable generic conversation-revocation events reuse the existing outbox retry/dead-letter policy. Subscription registration is inside pair locking and committed close immediately evicts active subscriptions. Delivery reauthorizes every destination/session. Already transmitted bytes cannot be revoked.

Mobile confirmation flows, optional combined reports, selected-message reports, protected Safety center, own-block management and prior-conversation reporting. Revocation clears visible history/draft/pending intent and active query previews; late REST/socket/storage callbacks cannot reintroduce revoked content. English and Georgian labels. Shared safety DTOs generated from the real API. Original specifications and earlier work preserved.

Migration: 20261001091552_SafetyAndRevocation. No new dependency or framework upgrade. Angular remains the sole moderator/admin frontend shell.

## Exact checks

| Command | Result |
|---|---|
| dotnet build backend/Dating.slnx --no-restore | PASS; 0 warnings/errors; subsequent full tests compile final source |
| dotnet test backend/Dating.slnx --no-restore --logger trx | PASS; 23 unit + 59 real PostgreSQL integration = 82 tests, 0 skipped |
| dotnet restore backend/Dating.slnx --locked-mode | PASS |
| dotnet ef database update --project backend/Dating.Api --no-build | PASS; safety migration applied to local PostgreSQL |
| dotnet ef migrations has-pending-model-changes --project backend/Dating.Api --no-build | PASS; no model drift |
| dotnet ef migrations script --idempotent --project backend/Dating.Api --no-build --output artifacts/migration.sql | PASS |
| dotnet publish backend/Dating.Api -c Release --no-restore -o artifacts/api | PASS; regenerated after final authorization fix |
| npm.cmd run contract:generate / npm.cmd run contract:check | PASS; final API/shared contract match |
| npm.cmd run smoke:api | PASS; real mobile fetch wrapper -> local API -> PostgreSQL |
| npm.cmd run typecheck / npm.cmd run lint | PASS |
| npm.cmd test --workspace mobile -- --runInBand | PASS; 14 suites / 52 tests |
| npm.cmd test --workspace admin | PASS; 1 Angular test |
| npm.cmd run admin:build | PASS; 283.87 kB production bundle |
| mobile/: npx.cmd expo install --check | PASS; dependencies compatible |
| mobile/: npx.cmd --yes expo-doctor | PASS; 21/21 |
| mobile/: npx.cmd expo export --platform all --max-workers 2 | PASS; final iOS 1,830 modules / 5.1 MB and Android 1,924 modules / 5.3 MB |
| docker compose --env-file infra/.env -f infra/compose.yaml --profile app build api | PASS; final Linux image sha256:873df7afe78c58df54ebcbf2a1cd39d87309350e19897c3cd602184270533f04 |

Final backend TRX: backend/tests/Dating.IntegrationTests/TestResults/ladop_LADOPC_2026-10-01_13_35_40_net10.0.trx and backend/tests/Dating.UnitTests/TestResults/ladop_LADOPC_2026-10-01_13_35_23_net10.0.trx.

Nine new real PostgreSQL safety cases cover reciprocal blocks, unblock and idempotent replay, report ownership/after-unmatch/encrypted evidence, report atomicity/rate/purge, send/block and like/block races, real existing sockets and subscribe/block race, both-direction media-ticket revocation, and blocking after one's own committed like. Earlier safety race tests remain intact. Seven added mobile tests cover combined confirmation/retry, account-scoped effects, late history/cache/draft revocation, storage-write/send races, socket reconnect cancellation and actively observed match preview removal.

Initial failures were corrected: empty report description was inadvertently rejected by Required; the paginated safety DTO projection needed a SQL-translatable ordering projection; a new test referenced the wrong button label; two test placeholder callbacks failed lint. A sandbox mobile run timed out; the unrestricted local rerun passed without changing test timeouts/assertions. Final tests are green. Non-failing Metro color and Node module-type warnings remain.

## Unverified / blockers

- NOT RUN: physical iOS/Android safety confirmations, keyboard/screen reader behavior, real native SignalR transport, background/offline/app-kill transitions and keychain failure scenarios. Devices/native tools are unavailable; Windows has no Xcode.
- NOT RUN: signed iOS/Android/EAS builds. Owner application IDs, signing credentials and authorized cloud build setup are unavailable. Hermes exports are not native compilation.
- NOT RUN: production TLS/ingress, disk/backup encryption, backup expiry/restore and deployed key-ring rotation/retention. Live report purge is tested locally; provider retention is not claimed.
- NOT RUN: inherited external S3 private-bucket and production SMTP/domain checks; no provider credentials.
- NOT RUN: hosted CI; no remote/hosted run evidence. This workspace has no .git metadata; no commit/PR was created.
- Supported deployment remains one API process. Connection registry and HTTP request limits are process-local; report quota/idempotency are database-backed. No multi-instance claim.
- Already transmitted bytes and malicious-client copies cannot be recalled. Offline clients clear when server authorization is refreshed. Native storage deletion can fail; real device behavior remains unverified.
- Photo report evidence contains approved IDs and public text, not copied image bytes. Source photo deletion can make an image unavailable for later review. No public evidence reader or moderator review workflow is implemented in this stage.
- Existing 13 moderate transitive npm advisories were recorded previously; dependencies were unchanged and no new audit result is claimed.

## Run / next step

1. docker compose --env-file infra/.env -f infra/compose.yaml up -d database mailpit
2. ./scripts/dev.ps1 migrate
3. ./scripts/dev.ps1 api
4. npm.cmd run mobile:start

Use two real verified/eligible accounts. Discover/Matches/Chat expose Report / block; incoming messages offer message-specific reports. Profile -> Safety lists own blocks and closed conversation identifiers. See README.md for configuration and SAFETY.md / TESTING.md for semantics and device scenarios.

Next: perform the unverified native/device and provider checks when the required tools/accounts are available. Stop after Prompt 7; do NOT begin Prompt 8 without a new user instruction.
