# Status - Prompt 4

Updated 2026-09-30. Prompts 3 and 4 are implemented. Prompt 3 completion was reported before starting Prompt 4; its evidence is preserved in STATUS.PROMPT3.md. Prompt 5 has NOT been started. No publication, purchase or public deployment occurred.

## Implemented

Prompt 3: real profile editing, private birth date/computed age, explicit preferences, completion/visibility, private validated photos, metadata removal, thumbnails, moderation, upload retry, ordering/concurrency and persisted cleanup. See PROFILES.md and STATUS.PROMPT3.md.

Prompt 4: real mobile discovery and editable reciprocal age/gender/city/radius preferences. Server-side eligibility excludes self, unavailable/incomplete/unapproved profiles, both block directions, previous outgoing decisions and unmatched pairs. Incoming likes alone do not hide candidates. Current card and private media access recheck eligibility. Future swipe mutations must use the shared policy; swipe/matching endpoints are reserved for Prompt 5.

Optional explicit foreground location consent with manual city fallback; coordinates are coarsened before PostgreSQL geography storage and never returned. Fixed radius choices, broad distance buckets, account-based rate limits and protected revision-bound keyset cursors constrain precision probing. PostGIS GiST indexing, bounded pages and batched photo retrieval avoid N+1 queries. Existing profiles are preserved by the migration backfill.

Mobile includes real loading/empty/error/retry states, profile-completion gating, filters, location deletion and account-scoped caches. Delayed profile/location callbacks cannot write into a different signed-in account. No fake production profiles or placeholder success responses were added.

Original specs and previous work preserved. Angular remains the sole admin frontend. Detailed policies and limitations: DISCOVERY.md; contracts: API.md; versions: VERSIONS.md.

## Checks actually run

Environment: Windows, Node 22.22.3, npm 11.6.2, local .NET SDK 10.0.401; real local PostgreSQL/PostGIS and Mailpit. Commands use npm.cmd/npx.cmd on PowerShell.

| Command | Result |
|---|---|
| dotnet restore backend/Dating.slnx --locked-mode | PASS |
| dotnet test backend/Dating.slnx --no-restore --logger trx | PASS; 23 unit + 24 real PostgreSQL integration tests (47 total), including build |
| dotnet ef database update --project backend/Dating.Api --no-build | PASS; DiscoveryPreferencesAndGeography applied |
| dotnet ef migrations has-pending-model-changes --project backend/Dating.Api --no-build | PASS; no model drift |
| dotnet ef migrations script --idempotent --project backend/Dating.Api --no-build --output artifacts/migration.sql | PASS |
| dotnet publish backend/Dating.Api -c Release --no-restore -o artifacts/api | PASS |
| npm run contract:generate / npm run contract:check | PASS; generated types match actual API |
| npm run smoke:api | PASS; actual mobile fetch wrapper in Node -> API -> PostgreSQL |
| npm run typecheck | PASS; shared, mobile, Angular |
| npm run lint | PASS; zero warnings |
| npm test --workspace mobile | PASS on unchanged isolated rerun; 7 suites / 22 tests |
| npm test --workspace admin | PASS; 1 suite / 1 test |
| npm run admin:build | PASS; production bundle 283.87 kB |
| mobile/: npx expo install --check | PASS; dependencies up to date |
| mobile/: npx --yes expo-doctor | PASS; 21/21 checks |
| npm run export --workspace mobile -- --max-workers 2 | PASS; iOS 1344 modules / 3.7 MB and Android 1479 modules / 4 MB; Hermes export, NOT native compilation |
| docker compose --env-file infra/.env -f infra/compose.yaml --profile app build api | PASS; Linux runtime image 20b1c321d2aa |

Coverage includes reciprocal filters, exact inclusive birth-date boundaries, exclusion directions, real geography meter/radius boundaries, index presence, bounded SQL query counts, cursor tampering/account/revision changes, stale-card/media denial, consent, coarse-location storage, rate limiting, deletion and migration backfill preserving existing profiles. Mobile tests cover denied/absent consent and delayed cross-account actions; OS APIs are mocked in these tests.

An initial TypeScript form-mode inference error was fixed with explicit schema typing. One initial mobile run had an existing auth-form test exceed its 5-second timeout during concurrent builds (21 passed, 1 timeout). The unchanged isolated rerun passed all 22; no timeout, assertion or compiler setting was weakened. Smoke emitted a non-failing Node module-type warning; Expo emitted non-failing color-environment warnings.

Prompt 3's separate Linux image-processing target passed both decoder tests; these are part of the unit coverage, not additional unique tests.

## Unverified / limitations

- NOT RUN: physical iOS/Android permission, GPS accuracy, lifecycle, HEIC/iCloud/Live Photo, photo/secure-store cache and accessibility checks. Devices/native toolchains and owner identifiers are unavailable; Windows has no Xcode.
- NOT RUN: signed native/EAS builds; owner/signing credentials unavailable. Expo export does not prove native compilation or device behavior.
- NOT RUN: external S3 private-bucket Put/Get/Delete, backup and operational policy verification; no provider credentials. Local private storage is tested.
- NOT RUN: production SMTP/domain delivery, key rotation and hosted CI; required external configuration is absent.
- Existing npm audit reports 13 moderate transitive Expo advisories, no high/critical; incompatible downgrades were not applied.
- Rate limits are process-local; distributed production deployment needs shared enforcement. Pinned PostgreSQL/PostGIS patch versions require release-time review.
- Dedicated Angular moderator cookie/MFA/CSRF UI remains Prompt 9; current moderation API enforces server-side roles. No default moderator or public role assignment exists.

## Run / next step

Start local services: docker compose --env-file infra/.env -f infra/compose.yaml up -d database mailpit.
Apply migrations: ./scripts/dev.ps1 migrate.
Run API: ./scripts/dev.ps1 api.
Run mobile: npm.cmd run mobile:start.
Optional explicit LOCAL development approval of new photos: ./scripts/dev.ps1 api -AutoApprovePhotos.

After verified login, complete a visible profile and add approved photos, then use Discover. Each candidate must independently satisfy reciprocal preferences; an empty real database correctly shows an empty state. See README.md for initial configuration and TESTING.md for native/provider checks.

Next: complete native/device and external-provider verification when tools/accounts are available. Start Prompt 5 only on a new explicit user request.
