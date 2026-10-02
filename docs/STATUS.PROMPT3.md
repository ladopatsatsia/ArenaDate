# Status - Prompt 3

Updated 2026-09-30. Prompt 3 is complete for available local checks; native/device and provider verification remains open as listed below. User authorized a Prompt 3 completion report followed by Prompt 4. No Prompt 5+ work, publication or purchase is authorized. Previous results are preserved in STATUS.PROMPT1.md and STATUS.PROMPT2.md.

## Implemented

Profiles: explicit gender/desired genders, bounded display name/bio/city/interests/relationship goal, private registration DOB with computed age, visibility and completion requiring an approved photo. Real mobile editing/onboarding state replaces the placeholder.

Private photos: owner-only idempotent reservation/finalization, six-slot limit, byte/pixel/dimension/format validation, EXIF/GPS removal, orientation-correct JPEG re-encoding and thumbnails. Ordered photos have revision conflict detection, user-row locking and a unique active-position index. Primary deletion compacts order. Expired/interrupted uploads and deleted objects have persisted cleanup with retries.

Storage: local private directory/volume and S3-compatible AWS SDK implementation. New photos remain pending; server-role-checked moderation endpoints approve/reject. Explicit local auto-approval flag is off by default and rejected in production. Viewer-bound two-minute media tickets plus bearer/current-state checks, no public storage URLs. Other-user media access remains denied until Prompt 4 eligibility is implemented.

Mobile: photo selection, denied/limited permission messaging/settings fallback, native JPEG conversion for supported HEIC inputs, removal of temporary conversion files, same-request upload retry, real server statuses, aspect-preserving photos, account-scoped cache clearing. App restart exposes incomplete slots for removal/reselection/expiry; no private upload source is persisted.

Original specification files and prior work preserved. Detailed choices, limits and run instructions: PROFILES.md. Generated API contract, migrations, CI-compatible settings and VERSIONS/API/DECISIONS/TESTING/README updated.

## Exact checks

Environment remains Windows / Node22.22.3 / npm11.6.2 / local .NET10.0.401. Real Compose PostgreSQL/PostGIS and Mailpit; secrets loaded only from ignored configuration.

| Command | Result |
|---|---|
| Expo install via npm exec --package npm@11.6.2 -- npx expo install expo-image-picker expo-image-manipulator --npm; then expo-file-system | PASS; SDK-compatible locked dependencies |
| dotnet restore backend/Dating.slnx --locked-mode | PASS |
| dotnet build backend/Dating.slnx --no-restore | PASS; 0 warnings/errors |
| dotnet test backend/Dating.slnx --no-restore --logger trx | PASS; 12 unit + 17 real PostgreSQL integration tests |
| dotnet test backend/tests/Dating.UnitTests/Dating.UnitTests.csproj --no-restore --logger trx after production-media policy test | PASS; 13 unit tests; total current suite 13 unit + 17 integration |
| dotnet ef database update --project backend/Dating.Api --no-build | PASS; ProfilesAndPrivatePhotos applied |
| dotnet ef migrations has-pending-model-changes --project backend/Dating.Api --no-build | PASS; no drift |
| dotnet ef migrations script --idempotent --project backend/Dating.Api --no-build --output artifacts/migration.sql | PASS |
| dotnet publish backend/Dating.Api -c Release --no-restore -o artifacts/api | PASS |
| npm run contract:generate / npm run contract:check | PASS; real backend-generated profile/photo contract |
| npm run smoke:api | PASS; real mobile health client in Node -> API -> PostgreSQL |
| npm run typecheck | PASS; shared contract, mobile and Angular |
| npm run lint | PASS; zero warnings |
| npm test --workspace mobile | PASS; 5 suites, 18 tests |
| mobile/: npx expo install --check | PASS |
| mobile/: npx --yes expo-doctor | PASS; 21/21 |
| npm run export --workspace mobile -- --max-workers 2 | PASS; iOS1333 modules/3.7 MB, Android1468 modules/4 MB; Hermes export, not native compilation |
| docker build --target image-check -f backend/Dating.Api/Dockerfile -t dating-mvp-image-check . | PASS; both real image-processing tests on Linux |
| docker compose --env-file infra/.env -f infra/compose.yaml --profile app build api | PASS; Linux runtime image 1b4a75da64bc |

Meaningful coverage includes unauthorized ownership/moderation, invalid profile choices/lengths, private DTO redaction, pending-photo completion exclusion, replayed finalization, tampered/viewer-bound/deleted media, parallel profile/reorder conflicts, primary deletion, orphan expiry, malformed/remote-URL/oversized payload rejection, photo-count bounds and EXIF orientation/metadata removal. Mobile retry tests reject fake completion after a lost response.

Initial TypeScript errors from generated numeric union types and unchecked array indexing were fixed by explicit conversions and guards, without weakening compiler settings. All reported checks above were actually executed; no native/device pass is inferred.

## Unverified / blockers

- NOT RUN: physical iPhone/Android photo flows, HEIC/iCloud/Live Photo behavior, OS denied/limited permissions, native image cache/secure-store interactions, accessibility and lifecycle. Owner IDs, devices/toolchains remain unavailable; Windows has no Xcode.
- NOT RUN: signed native/EAS builds; owner credentials not supplied.
- NOT RUN: external S3 provider Put/Get/Delete, private bucket policy, backups and operational credentials. Local storage and real image processing are tested; production S3 is implemented but unverified against a configured provider.
- NOT RUN: real production SMTP/domain delivery, key rotation and hosted GitHub CI, inherited from Prompt 2.
- Angular dedicated moderator cookie/MFA/CSRF UI is intentionally reserved for Prompt 9. The minimal moderation API exists with server-side role checks; no default moderator credentials or public role assignment.
- npm audit retains 13 moderate transitive Expo/Router advisories (no high/critical); no incompatible downgrade applied. Native and provider checks are mandatory before release.

## Run / next step

With dependencies/services ready: scripts/dev.ps1 migrate, scripts/dev.ps1 api, npm.cmd run mobile:start. Edit Profile and add photos after verified login. Optional explicit local auto-approval: scripts/dev.ps1 api -AutoApprovePhotos. See PROFILES.md for normal moderation and S3 configuration.

After reporting Prompt 3 completion, proceed to the already-authorized Prompt 4 only: discovery, reciprocal preferences, private foreground location/manual city fallback and privacy-preserving pagination. Do not start Prompt 5.
