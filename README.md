# DatingMVP

Prompts 0-9: foundation, authentication, profiles/private photos, discovery, matching, text chat, safety, configurable push and the Angular moderator panel. Original specification files are preserved. See [status](docs/STATUS.md), [versions](docs/VERSIONS.md), and [testing](docs/TESTING.md).

## Prerequisites

.NET SDK from global.json, Node from .nvmrc, npm 11.6.2, Docker with Linux containers. Windows users can invoke npm.cmd/npx.cmd if PowerShell blocks npm.ps1. Run commands at repository root unless stated otherwise. If needed, install the pinned npm with `npm install --global npm@11.6.2` (or invoke `npx --package npm@11.6.2 npm ci` without a global change).

## Local setup

1. Copy infra/.env.example to infra/.env and replace the example password with a local random value.
2. Run `docker compose --env-file infra/.env -f infra/compose.yaml up -d database mailpit`.
3. Run `npm ci`, `dotnet tool restore`, `dotnet restore backend/Dating.slnx --locked-mode`.
4. Set `ConnectionStrings__Database` to `Host=127.0.0.1;Port=55432;Database=dating;Username=dating;Password=<your-local-password>` in your shell. Never commit it.
5. On PowerShell run `./scripts/dev.ps1 migrate` to prepare local auth keys and apply migrations. Other shells: follow [auth configuration](docs/AUTH.md), then `dotnet ef database update --project backend/Dating.Api`.
6. Run `./scripts/dev.ps1 api` (development API at http://localhost:5180), or `dotnet run --project backend/Dating.Api` after exporting auth settings.
7. Copy mobile/.env.example to mobile/.env, set EXPO_PUBLIC_API_URL, then `npm run mobile:start`.
8. For moderation use `./scripts/dev.ps1 admin-api` with a local HTTPS certificate, then `npm start --workspace admin` and open `https://localhost:4200/admin/`. The proxy forwards /api to HTTPS port 5181. Provision staff through the private operator command in [MODERATION.md](docs/MODERATION.md); no default admin credentials exist.

PowerShell shortcut after steps 1-3: `./scripts/dev.ps1 migrate`, then `./scripts/dev.ps1 api`. The script also supports build/test and uses the optional workspace-local .NET SDK if present. Shell execution policies may require using an approved PowerShell session.

The API does not automatically migrate databases. Readiness returns 503 until migrations are applied. Local mail capture is at http://localhost:8025 (real verification/reset mail, no external delivery).

Optional API container: after step 5 run `node scripts/auth-env.mjs --write`, then `docker compose --env-file infra/.env -f infra/compose.yaml --profile app up -d --build api`. This is local development configuration, not a public deployment. The ignored auth configuration is mounted read-only, with a separate persisted container key ring. On Linux grant only the container app UID (1654) read access to that file. Host and container key rings are separate, so outstanding email codes cannot move between them. Stop the host API before binding the container to port 5180.

## Phones and native builds

On a physical phone, localhost is the **phone**, not the PC. Use the PC's private LAN address (for example http://192.168.1.20:5180), the same Wi-Fi, and allow the API port only on a trusted private network. Start the host API with `dotnet run --project backend/Dating.Api --no-launch-profile -- --urls http://0.0.0.0:5180` with ASPNETCORE_ENVIRONMENT=Development. Android emulator uses http://10.0.2.2:5180; iOS simulator can use localhost on its Mac.

Development native builds may need platform-specific local HTTP allowances; prefer a trusted HTTPS development endpoint for physical devices. Do not relax transport security for preview/production. No tunnel/provider is purchased or configured.

Set owner-provided IOS_BUNDLE_IDENTIFIER, ANDROID_APPLICATION_ID and EAS_PROJECT_ID before signing/building. No IDs were invented. In mobile/, run `npx expo run:android` with Android SDK/device, or `npx expo run:ios` on macOS/Xcode. For authorized EAS accounts, use `eas build --profile development --platform android` and the corresponding ios command; preview/production profiles also require an HTTPS EXPO_PUBLIC_API_URL. No cloud builds or publication have been performed.

Open the development API health screen and tap Check connection. It requests the actual database readiness endpoint. Tabs now require a real verified account in every build. Register, copy the verification code from Mailpit into Verify, then sign in. Forgot password and Reset use the same manual-code flow. Profile contains the real account ID, logout and logout-all; profile editing and private photo upload are implemented. See [profile/photo setup](docs/PROFILES.md); optional local auto-approval is explicit and off by default. See [authentication behavior](docs/AUTH.md).

## Layout

- backend/Dating.Api: controller API, feature folders, infrastructure, EF persistence/migrations
- backend/tests: unit and real PostgreSQL integration tests
- mobile: Expo Router iOS/Android app
- admin: standalone Angular/Material moderator shell
- packages/api-contract: generated OpenAPI and shared TypeScript package
- infra: local PostgreSQL/PostGIS, Mailpit and API container
- scripts: local runner and contract generation/drift check
- docs: decisions, API, testing, versions and status

Stop only this project's local services with `docker compose --env-file infra/.env -f infra/compose.yaml stop`. Its database volume is retained.

Discovery setup: complete a visible profile with an approved photo, then open Discover. Set age/gender preferences and enter a city, or explicitly consent to one foreground location fix and choose distance mode. No demonstration profiles are seeded; a single eligible account correctly sees an empty feed. See [discovery behavior](docs/DISCOVERY.md).

Swipe/match run and concurrency/retry policy: [MATCHING.md](docs/MATCHING.md). Use two eligible verified accounts; swipe or press Like/Pass in Discover. Mutual server likes create one match, listed in Matches.

Open a real match to send text, load history and see unread/read state. Chat operation and security: [CHAT.md](docs/CHAT.md).

Safety actions are available in Discover, Matches and Chat; Profile -> Safety opens own blocks and narrow prior-conversation reporting. See [safety semantics and retention](docs/SAFETY.md).

Push: Profile -> Notifications controls opt-in match/message alerts. Provider delivery is disabled until owner Expo/APNs/FCM credentials and a separate server encryption key ring are configured. See [PUSH.md](docs/PUSH.md); real device delivery remains unverified.
