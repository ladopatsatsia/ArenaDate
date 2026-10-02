# Verified dependency matrix

## Prompt 9 verification (2026-10-01)

Existing .NET 10/Identity/EF and Angular 21/Material versions remain pinned. Cookie validation, antiforgery and TOTP use the built-in ASP.NET/Identity providers: [cookie authentication](https://learn.microsoft.com/aspnet/core/security/authentication/cookie?view=aspnetcore-10.0), [antiforgery](https://learn.microsoft.com/aspnet/core/security/anti-request-forgery?view=aspnetcore-10.0), [authenticator provider](https://learn.microsoft.com/dotnet/api/microsoft.aspnetcore.identity.authenticatortokenprovider-1?view=aspnetcore-10.0), [Angular XSRF](https://angular.dev/best-practices/security).

Playwright test 1.58.2 is pinned as an admin dev dependency; publisher manifest supports Node >=18, compatible with this repository's Node 22.22.3. [Official setup](https://playwright.dev/docs/intro), [publisher manifest](https://registry.npmjs.org/@playwright/test/1.58.2). No browser emulation is treated as native mobile evidence.

Dependency installation surfaced GHSA-67c8-pqhq-4rmx in Angular's pinned Piscina 5.2.0. An exact build-tool pin and override select maintainer-patched 5.3.2 within the same major; Angular itself is not upgraded. npm initially retained a stale nested copy; its generated metadata was refreshed and `npm ls piscina` confirms Angular uses 5.3.2. [Maintainer advisory](https://github.com/piscinajs/piscina/security/advisories/GHSA-67c8-pqhq-4rmx). No audit suppression or force upgrade was applied.

The 2026-10-02 npm audit reports 0 critical, 4 high and 11 moderate dependency nodes. The high chain is Expo CLI/code-signing tooling -> node-forge, GHSA-86w9-cpqp-85rv (no patched version listed). This app's backend authentication and moderator MFA do not use node-forge; native/cloud code-signing workflows remain unverified and must recheck this advisory before release. The tool's suggested Expo major downgrade is incompatible and was not applied. [Advisory](https://github.com/advisories/GHSA-86w9-cpqp-85rv). This is an open tooling risk, not a clean audit claim.

Verified 2026-09-30 against official documentation and publisher registries. Exact direct JavaScript dependencies are listed below; transitive resolutions are recorded in the root npm lockfile and each .NET project's packages.lock.json.

| Component | Selection | Official compatibility source |
|---|---|---|
| .NET SDK | 10.0.401, exact global.json | [release metadata](https://dotnetcli.blob.core.windows.net/dotnet/release-metadata/10.0/releases.json) |
| .NET / ASP.NET runtime | 10.0.12 LTS | [support policy](https://dotnet.microsoft.com/en-us/platform/support/policy) |
| ASP.NET OpenAPI / EF Core / EF tools | 10.0.12 | [EF releases](https://learn.microsoft.com/ef/core/what-is-new/) |
| Npgsql EF provider + NetTopologySuite plugin | 10.0.3 | [Npgsql 10 release notes](https://www.npgsql.org/efcore/release-notes/10.0.html), [spatial mapping](https://www.npgsql.org/efcore/mapping/nts.html) |
| Node | 22.22.3 LTS line | [Node releases](https://nodejs.org/en/about/previous-releases) |
| npm | 11.6.2, supports Node >=22.9 | [publisher manifest](https://registry.npmjs.org/npm/11.6.2) |
| Expo | 57.0.26 stable | [SDK matrix](https://docs.expo.dev/versions/latest/) |
| React / React Native | 19.2.3 / 0.86.3, SDK 57 selections | [Expo compatibility](https://docs.expo.dev/versions/latest/) |
| Angular core/CLI/build/compiler | 21.2.24 supported line | [compatibility](https://angular.dev/reference/versions), [support](https://angular.dev/reference/releases) |
| Angular Material/CDK | 21.2.14 | [official package](https://www.npmjs.com/package/@angular/material) |
| TypeScript | Mobile 6.0.3 (Expo 57); Angular/shared tooling 5.9.3 | [Angular compatibility](https://angular.dev/reference/versions) |
| Jest / jest-expo / RNTL | 29.7.0 / SDK 57 / 13.3.3 | [Expo testing](https://docs.expo.dev/develop/unit-testing/) |
| xUnit / VS adapter / test SDK | 2.9.3 / 3.1.5 / 18.10.1 | [xUnit](https://xunit.net/docs/getting-started/v2/getting-started), publisher NuGet manifests |
| OpenAPI TypeScript | 7.13.0 | [official generator docs](https://openapi-ts.dev/introduction) |
| PostgreSQL/PostGIS container | 17-3.5, digest pinned; runtime PostgreSQL 17.5, PostGIS 3.5 | [PostGIS image](https://github.com/postgis/docker-postgis), [PostgreSQL supported majors](https://www.postgresql.org/support/versioning/) |
| Mailpit | v1.27.8, digest pinned | [official releases](https://github.com/axllent/mailpit/releases/tag/v1.27.8) |

The .NET 10 SDK was missing on the machine. Downloaded the official Windows SDK archive into ignored .tools and verified its SHA-512 against Microsoft's release metadata; no system SDK replacement. Dockerfile pins sdk:10.0.401 and aspnet:10.0.12.

PostGIS image digest: sha256:01a6a70e41e6c4467c8f55f6063555ed72db2d6662cd0d571040d42eadaeb6f6.
Mailpit digest: sha256:6abc8e633df15eaf785cfcf38bae48e66f64beecdc03121e249d0f9ec15f0707.
These are local development images. PostgreSQL major 17 is supported; the image's 17.5 patch is not claimed to be the latest. Refresh/review image patches and vulnerabilities before any release (Prompt 13).

Expo native packages were selected by expo install, including Router's animation peers. React Native was not independently upgraded. react-test-renderer is exactly aligned with React. Angular uses its own CLI test runner (Vitest). npm 10.9.8 repeatedly crashed in Arborist peer resolution; npm 11.6.2 is pinned for reproducible installation without disabling peer validation.

Version updates must refresh locks, run Expo dependency checks, backend migrations/tests and API drift checks. Do not replace native packages with independent latest versions.

## Lint tooling

ESLint 10.11.0 with typescript-eslint 8.71.0 uses supported stable versions ([ESLint support](https://eslint.org/version-support/), [typescript-eslint compatibility](https://typescript-eslint.io/users/dependency-versions/)). Expo's shared lint preset still pulls React lint plugins that restrict ESLint to the now-EOL 9.x; the project therefore uses the official ESLint and typescript-eslint recommended rules directly, with zero-warning CI. TypeScript checks include test files.

React and ReactDOM are both pinned to 19.2.3 at the workspace root to keep Expo Router's optional web peers from hoisting React 19.3. No consumer website is added.

## Exact direct package inventory

### dating-mvp

| Package | Version |
|---|---|
| openapi-typescript | 7.13.0 |
| react | 19.2.3 |
| react-dom | 19.2.3 |
| typescript | 5.9.3 |

### @dating/mobile

| Package | Version |
|---|---|
| @dating/api-contract | 0.1.0 |
| @eslint/js | 10.0.1 |
| @testing-library/react-native | 13.3.3 |
| @types/jest | 29.5.14 |
| @types/react | 19.2.4 |
| eslint | 10.11.0 |
| expo | 57.0.26 |
| expo-constants | 57.0.20 |
| expo-dev-client | 57.0.19 |
| expo-linking | 57.0.11 |
| expo-localization | 57.0.2 |
| expo-router | 57.0.24 |
| expo-status-bar | 57.0.1 |
| i18next | 26.4.2 |
| jest | 29.7.0 |
| jest-expo | 57.0.5 |
| react | 19.2.3 |
| react-i18next | 17.0.15 |
| react-native | 0.86.3 |
| react-native-reanimated | 4.5.1 |
| react-native-safe-area-context | 5.7.0 |
| react-native-screens | 4.26.2 |
| react-native-worklets | 0.10.1 |
| react-test-renderer | 19.2.3 |
| typescript | 6.0.3 |
| typescript-eslint | 8.71.0 |

### @dating/admin

| Package | Version |
|---|---|
| @angular/build | 21.2.24 |
| @angular/cdk | 21.2.14 |
| @angular/cli | 21.2.24 |
| @angular/common | 21.2.24 |
| @angular/compiler | 21.2.24 |
| @angular/compiler-cli | 21.2.24 |
| @angular/core | 21.2.24 |
| @angular/forms | 21.2.24 |
| @angular/material | 21.2.14 |
| @angular/platform-browser | 21.2.24 |
| @angular/router | 21.2.24 |
| @dating/api-contract | 0.1.0 |
| jsdom | 28.0.0 |
| prettier | 3.9.9 |
| rxjs | 7.8.2 |
| tslib | 2.8.1 |
| typescript | 5.9.3 |
| vitest | 4.1.11 |


## Dependency audit limitations

The final npm install reports 13 moderate advisories, zero high and zero critical after upgrading Vitest to 4.1.11. Remaining paths are Expo tooling/transitive uuid and Expo Router/query-string/decode-uri-component. npm proposes incompatible Expo/Router downgrades; these were not applied and peer checks were not bypassed. Reassess upstream compatible patches before release. Deprecated transitive packages (including an ESLint 9 peer in the Expo tool tree) remain in the lockfile; the project lint command itself uses ESLint 10.11.0. This is not a clean security-audit claim.

## Prompt 2 additions (verified 2026-09-30)

| Component | Locked version | Official compatibility reference |
|---|---|---|
| ASP.NET Core Identity EF / JwtBearer | 10.0.12 | [Identity](https://learn.microsoft.com/en-us/aspnet/core/security/authentication/identity?view=aspnetcore-10.0), [JWT validation](https://learn.microsoft.com/en-us/aspnet/core/security/authentication/configure-jwt-bearer-authentication?view=aspnetcore-10.0); same .NET 10 train |
| MailKit | 4.18.1 | [MailKit documentation](https://mimekit.net/docs/html/T_MailKit_Security_SecureSocketOptions.htm); mandatory StartTLS mode, no certificate bypass |
| expo-secure-store | 57.0.4 | [Expo SecureStore](https://docs.expo.dev/versions/latest/sdk/securestore/); SDK 57 recommends ~57.0.4 |
| expo-crypto | 57.0.3 | [Expo Crypto](https://docs.expo.dev/versions/latest/sdk/crypto/); selected by expo install for SDK 57 |
| @tanstack/react-query | 5.104.0 | [Official installation](https://tanstack.com/query/latest/docs/framework/react/installation); React 18+ compatible |
| react-hook-form | 7.89.0 | [Official repository / React Native support](https://github.com/react-hook-form/react-hook-form) |
| @hookform/resolvers | 5.9.1 | [Official Zod resolver integration](https://github.com/react-hook-form/resolvers) |
| zod (mobile direct dependency) | 4.6.5 | [Zod 4 documentation](https://zod.dev/); strict TypeScript 5.5+ |

Native libraries were selected through Expo's compatibility resolver, not arbitrary latest versions. npm 11.6.2 resolves and locks these with React 19.2.3, RN 0.86.3 and mobile TypeScript 6.0.3. Root transitive Zod 4.3.6 belongs to other tooling; the mobile direct module is 4.6.5. NuGet packages.lock.json and package-lock.json record exact graphs. The clean updated install audited 1467 packages and still reports 13 moderate vulnerabilities (no high/critical); see the preceding audit limitations.

## Prompt 3 additions (2026-09-30)

- SkiaSharp and SkiaSharp.NativeAssets.Linux.NoDependencies 4.153.1: [official stable packages](https://www.nuget.org/packages/SkiaSharp), [native assets](https://www.nuget.org/packages/SkiaSharp.NativeAssets.Linux.NoDependencies), [MIT license](https://github.com/mono/SkiaSharp/blob/main/LICENSE.md). Matching managed/native versions; Windows and Linux image-processing tests distinguish platform evidence.
- AWSSDK.S3 4.0.103.4: [official package](https://www.nuget.org/packages/AWSSDK.S3), [V4 credentials documentation](https://docs.aws.amazon.com/sdk-for-net/v4/developer-guide/creds-assign.html). Compatible .NET 8+ assets run on .NET 10.
- Expo-compatible expo-image-picker 57.0.20, expo-image-manipulator 57.0.20 and expo-file-system 57.0.7, selected through expo install: [ImagePicker](https://docs.expo.dev/versions/latest/sdk/imagepicker/), [ImageManipulator](https://docs.expo.dev/versions/latest/sdk/imagemanipulator/), [FileSystem](https://docs.expo.dev/versions/latest/sdk/filesystem/). Exact graphs are locked; unchanged React/RN/Angular framework versions. Native permission/HEIC behavior requires device checks.

## Prompt 4 additions (2026-09-30)

Expo Location 57.0.20 was selected through expo install for SDK 57 and pinned in package-lock.json. [Official foreground location API](https://docs.expo.dev/versions/latest/sdk/location/). Existing Npgsql 10.0.3 spatial plugin is retained; no new geometry library was independently upgraded. [Npgsql geography mapping/translation](https://www.npgsql.org/efcore/mapping/nts.html) and [PostGIS ST_DWithin](https://postgis.net/docs/ST_DWithin.html) document geography meter semantics and index-aware distance predicates.

## Prompt 5 additions (2026-10-01)

react-native-gesture-handler **2.32.0**, selected by Expo SDK 57 bundledNativeModules through expo install. [Expo compatibility](https://docs.expo.dev/versions/latest/sdk/gesture-handler/), [gesture API/testing](https://docs.swmansion.com/react-native-gesture-handler/docs/guides/testing/). Router and drawer accept this peer version. npm initially kept an optional 3.3.0 peer at the root; an explicit root dev dependency plus override now makes all paths resolve one 2.32.0 native module. npm ls confirms one version. Reanimated 4.5.1 / Worklets 0.10.1 and all framework versions are unchanged. Lockfiles record the complete graph.

No new backend package. PostgreSQL synchronization follows [version 17 row-lock documentation](https://www.postgresql.org/docs/17/explicit-locking.html) and [SKIP LOCKED](https://www.postgresql.org/docs/17/sql-select.html). Existing 13 moderate npm advisories remain; no high/critical were reported by installation.

## Prompt 6 additions (2026-10-01)

@microsoft/signalr **10.0.11** is the official JavaScript client on the .NET 10 line, verified through the package registry and [Microsoft client documentation](https://learn.microsoft.com/en-us/aspnet/core/signalr/javascript-client?view=aspnetcore-10.0). [Authentication/lifetime/transport documentation](https://learn.microsoft.com/en-us/aspnet/core/signalr/authn-and-authz?view=aspnetcore-10.0) informs explicit LongPolling bearer headers and expiration closure. Server SignalR is supplied by the existing ASP.NET Core 10.0.12 shared framework; no additional backend package. Framework/native versions are unchanged; the root lock contains the client graph.

## Prompt 7 verification (2026-10-01)

No dependency was added or upgraded. Existing .NET/ASP.NET Core 10, EF/Npgsql 10, PostgreSQL 17/PostGIS, Expo 57/React Native and Angular pins remain in their lockfiles. Safety uses the built-in ASP.NET Core Data Protection and existing SignalR client. Official references checked: [SignalR groups and explicit revocation](https://learn.microsoft.com/en-us/aspnet/core/signalr/groups?view=aspnetcore-10.0), [Data Protection and key management](https://learn.microsoft.com/en-us/aspnet/core/security/data-protection/introduction?view=aspnetcore-10.0). Connection/group membership is not authorization. Bounded evidence retention requires preserving the existing key ring, rather than assuming encrypted payloads survive key deletion. See STATUS.md for locked restore, Expo compatibility and actual build results.

## Prompt 8 additions (2026-10-01)

Installed via expo install using the pinned npm 11.6.2 workflow: expo-notifications **57.0.21** and expo-device **57.0.2**, as selected by Expo SDK 57 bundledNativeModules. package-lock.json locks the graph; npm ls confirms these exact versions. [Official Notifications API](https://docs.expo.dev/versions/latest/sdk/notifications/) and [Expo native push setup](https://docs.expo.dev/push-notifications/push-notifications-setup/) were checked. Existing React/React Native, Angular, .NET/EF/Npgsql versions remain unchanged. The server uses built-in HttpClient/AesGcm, with no new NuGet package. Installation reported the same 13 moderate transitive npm advisories. Actual compatibility/build results are in STATUS.md.
