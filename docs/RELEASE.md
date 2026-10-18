# Release Readiness and Packaging Guide (Prompt 13)

Date: 2026-10-02  
Product: DatingMVP (iOS, Android, ASP.NET Core Backend, Angular Moderator Panel)  
Repository: `AppDate`  
Current Status: **NO-GO FOR PUBLIC PRODUCTION LAUNCH** (Packaging and local artifacts verified; external owner credentials, signing, physical device checks, and store reviews remain pending).

---

## 1. Go / No-Go Checklist

Per `AGENTS.md` and Prompt 13 rules, release readiness must be marked **NO-GO** whenever required external accounts, physical device tests, legal approvals, or store reviews are pending. Compilation passing does not equal production readiness.

| Requirement / Check | Status | Verification Evidence / Blocker |
|---|:---:|---|
| **C# / .NET 10 Solution Build** | **GO** | `dotnet build backend/Dating.slnx` -> 0 warnings, 0 errors |
| **Backend Automated Tests** | **GO** | 32 unit tests + 91 real PostgreSQL integration tests = 123 tests passed |
| **Dependency Vulnerability Audit** | **GO** | `check-packages` -> 0 vulnerable NuGet packages across all projects |
| **Database Migrations** | **GO** | `check-migrations` -> no pending model changes; idempotent `artifacts/migration.sql` generated |
| **API Contract Synchronization** | **GO** | `npm run contract:check` -> TypeScript types match running OpenAPI contract |
| **Angular Admin Production Bundle** | **GO** | `npm run admin:build` -> clean bundle in `admin/dist/admin/browser` (441 kB initial) |
| **Angular Admin Tests** | **GO** | `npm test --workspace admin` -> 2 files / 6 unit tests passed |
| **Mobile TypeScript & Lint** | **GO** | `npm run typecheck` & `npm run lint` -> 0 errors, 0 warnings |
| **Mobile Automated Tests** | **GO** | `npm test --workspace mobile` -> 23 test suites / 78 tests passed |
| **Mobile Hermes Bytecode Export** | **GO** | `expo export --platform all` -> iOS (5.2 MB) and Android (5.4 MB) `.hbc` bundles created in `mobile/dist/` |
| **Production Docker Container** | **GO** | `docker build -t dating-api:production` -> Linux non-root image built successfully |
| **Production Reverse Proxy Config** | **GO** | `infra/nginx/nginx.conf` -> TLS 1.2/1.3, WSS proxying for SignalR, `/admin` static routing |
| **Database Backup & Restore Scripts** | **GO** | `infra/scripts/backup.ps1` and `infra/scripts/restore.ps1` prepared |
| **Store Account Deletion URL** | **GO** | Real web page `GET /account/delete` and API `POST /api/account/public-deletion-request` verified |
| **EAS Cloud Build & Store Signing** | **NO-GO** | **BLOCKED**: Requires owner Apple Developer ($99/yr) & Google Play ($25) credentials |
| **Physical iPhone & Android Verification**| **NO-GO** | **BLOCKED**: Physical device verification pending owner test flight execution |
| **Production Push Credentials (APNs/FCM)** | **NO-GO** | **BLOCKED**: Requires owner Apple Push Key (`.p8`) and Firebase `google-services.json` |
| **Legal Counsel Privacy Policy Approval** | **NO-GO** | **BLOCKED**: `docs/PRIVACY.md` is currently marked as DRAFT for owner review |

---

## 2. Reviewable Artifacts Actually Built

The following staging and release artifacts have been built, inspected, and validated in this workspace:

1. **Production Backend Container (`dating-api:production`):**
   - Base image: `mcr.microsoft.com/dotnet/aspnet:10.0.12`
   - Build image: `mcr.microsoft.com/dotnet/sdk:10.0.401`
   - Runtime security: Runs as non-root user `1654:1654` (`$APP_UID`).
   - Volumes: `/app/auth-keyring` (Data Protection keys) and `/app/private-media` (local fallback or ephemeral scratch).
   - Health endpoints: `/api/health/live` and `/api/health/ready` (checking PostgreSQL and PostGIS).

2. **Mobile Compiled Hermes Bytecode Bundles (`mobile/dist/`):**
   - Built with: `npx expo export --platform all`
   - Android bundle: `mobile/dist/_expo/static/js/android/entry-c264dfaf3fc784263a6b8d6c334b65fe.hbc` (5.4 MB bytecode).
   - iOS bundle: `mobile/dist/_expo/static/js/ios/entry-3fa7765753d6ae170bf232eff42b401d.hbc` (5.2 MB bytecode).
   - Bundled assets: 34 images and font files (including `MaterialSymbols_400Regular.ttf`, app icons, splash).

3. **Angular 21 Admin Interface (`admin/dist/admin/browser/`):**
   - Built with: `ng build` (production optimizations enabled).
   - Initial total size: 441.5 kB (102.6 kB gzip transfer).
   - Static chunks: `main-JRCYGDFW.js`, `styles-CKMYOZ7V.css`, and localized assets.

4. **Idempotent Database Migration Script (`artifacts/migration.sql`):**
   - Generated with: `dotnet ef migrations script --idempotent --project backend/Dating.Api`
   - Size: 42.8 kB (1,148 SQL lines).
   - Safe execution: Employs `IF NOT EXISTS` checks against `__EFMigrationsHistory` for all migrations from `20260930072409_InitialFoundation` to `AccountLifecycleAndDeletion`.
   - PostGIS extension initialization included.

5. **Production Docker Compose & Nginx Templates (`infra/`):**
   - `infra/compose.prod.yaml`: 1 API instance, 1 PostgreSQL/PostGIS container, 1 Nginx reverse proxy.
   - `infra/nginx/nginx.conf`: TLS termination, WebSocket upgrade for SignalR, `/admin` Angular SPA routing, `/api` proxying.
   - `infra/.env.production.example`: Sanitized production environment template.
   - `infra/scripts/backup.ps1` and `infra/scripts/restore.ps1`: Backup automation and restore validation.

---

## 3. Required Owner Accounts & Credentials

To progress from **NO-GO** to **GO** for public submission, the product owner must procure and configure the following external credentials:

### A. Apple Developer Account
- **Cost:** $99 / year.
- **Account Type:** Apple Developer Program (Organization recommended for dating applications).
- **Required IDs:**
  - `IOS_BUNDLE_IDENTIFIER`: e.g. `com.datingmvp.app`
  - `Apple Team ID`: 10-character alphanumeric ID from Apple Developer account.
  - `App Store Connect App ID`: Numeric app ID generated when creating the app record.
  - `APNs Key (.p8)`: Apple Push Notification service authentication key (Key ID + Team ID).

### B. Google Play Console Account
- **Cost:** $25 one-time fee.
- **Required IDs & Files:**
  - `ANDROID_APPLICATION_ID`: e.g. `com.datingmvp.app`
  - `google-services.json`: Downloaded from Firebase Console -> Project Settings -> Your Apps -> Android.
  - Google Cloud Service Account: JSON key with "Service Account User" and "Release Manager" roles for automated submission via EAS.

### C. Expo Application Services (EAS)
- **Account:** Free or paid account at `https://expo.dev`.
- **Configuration:** Run `eas login` and `eas project:init` to link `EAS_PROJECT_ID`.
- `EAS_PROJECT_ID`: UUID assigned to the project.

### D. Production Server & Storage
- **Domain:** Dedicated domain (e.g. `api.datingmvp.example.com`).
- **TLS Certificate:** Let's Encrypt / Certbot or corporate SSL/TLS certificate.
- **Private S3-Compatible Storage:** AWS S3, Cloudflare R2, or Wasabi with private bucket permissions.
- **Transactional SMTP:** SendGrid, Postmark, or Amazon SES with verified sending domain.

---

## 4. TestFlight & Google Play Internal Testing Runbook

Execute these steps only when authorized owner accounts and credentials are available.

### Step 1: Install EAS CLI and Authenticate
```bash
npm install -g eas-cli
eas login
```

### Step 2: Configure Environment & Credentials
In `mobile/.env`:
```ini
EXPO_PUBLIC_API_URL=https://api.datingmvp.example.com
EAS_BUILD_PROFILE=production
IOS_BUNDLE_IDENTIFIER=com.datingmvp.app
ANDROID_APPLICATION_ID=com.datingmvp.app
EAS_PROJECT_ID=<YOUR-EAS-PROJECT-ID>
IOS_BUILD_NUMBER=1
ANDROID_VERSION_CODE=1
APP_ASSOCIATED_DOMAIN=api.datingmvp.example.com
GOOGLE_SERVICES_JSON=./google-services.json
```

### Step 3: Trigger Cloud Builds
For Android Internal Testing (AAB):
```bash
cd mobile
eas build --platform android --profile production
```
For iOS TestFlight:
```bash
cd mobile
eas build --platform ios --profile production
```

### Step 4: Submit Binaries to Internal Testing Tracks
```bash
eas submit --platform android --profile production
eas submit --platform ios --profile production
```

### Step 5: Physical Device Verification Checklist
Run on at least one physical iPhone and one physical Android device:
1. **Photo Permissions:** Test photo selection; verify permission prompt shows "Choose photos for your dating profile." Deny permission and verify graceful error message.
2. **Location Denial:** Open discovery; verify prompt asks "Use your approximate area to find nearby people." Deny location permission; verify city fallback works without crashing.
3. **Notification Prompt:** Verify notification permission request on first login.
4. **Push Notifications:**
   - Background push: Send message from User B; verify notification appears on User A's device with privacy-friendly generic text.
   - Tap notification while app is killed (cold start): Verify app opens directly to the authenticated conversation.
   - Foreground event: Verify SignalR live update appends message without displaying a redundant banner.
5. **App Lifecycle:** Send app to background for 5 minutes, resume; verify chat reconnects without lost messages.
6. **Token Expiry:** Wait for access token expiry (15m); verify transparent refresh without kickout.
7. **Unmatch & Block:** Unmatch user; verify conversation is removed from both devices. Block user; verify mutual discovery exclusion.
8. **Account Deletion:** Delete account in app; verify immediate logout, cache clearing, and profile disappearance on other devices.

---

## 5. Production Backend Deployment & Operator Runbook

### Topology Constraint: Single Instance
> [!IMPORTANT]
> The MVP deployment must operate as **EXACTLY ONE API INSTANCE**.
> User-row locks, reciprocal like serialization, and SignalR hub connection tracking are designed and tested for single-instance relational synchronization. Do NOT scale the API container horizontally until a distributed SignalR backplane (Redis) and cross-instance synchronization are implemented and load-tested.

### Deployment Procedure

1. **Provision Host Server:**
   - Ubuntu 22.04/24.04 LTS VPS (minimum 2 vCPU, 4 GB RAM, 40 GB SSD).
   - Install Docker and Docker Compose v2.

2. **Clone & Configure:**
   ```bash
   git clone <repo-url> /opt/datingmvp
   cd /opt/datingmvp
   cp infra/.env.production.example infra/.env.production
   nano infra/.env.production
   ```
   Generate RSA private key for JWT signing:
   ```bash
   openssl genrsa 2048 | awk '{printf "%s\\n", $0}'
   ```
   Generate AES-256-GCM encryption key for push token encryption:
   ```bash
   openssl rand -base64 32
   ```

3. **Execute Database Migration (Explicit Release Step):**
   Do not run migrations automatically on startup. Apply the idempotent script:
   ```bash
   docker compose -f infra/compose.prod.yaml up -d database
   docker compose -f infra/compose.prod.yaml exec -T database psql -U dating_prod -d dating < artifacts/migration.sql
   ```

4. **Bootstrap Administrator:**
   Use the operator CLI to create the initial moderator/administrator:
   ```bash
   docker compose -f infra/compose.prod.yaml run --rm api dotnet Dating.Api.dll staff create-admin --email admin@datingmvp.example.com --password "SecureInitialPassword123!"
   ```

5. **Start Services:**
   ```bash
   docker compose -f infra/compose.prod.yaml up -d
   ```

6. **Verify Health:**
   ```bash
   curl -f http://localhost:8080/api/health/live
   curl -f http://localhost:8080/api/health/ready
   ```

### Backup & Disaster Recovery Runbook
- **Daily Automated Backup:**
  Run `infra/scripts/backup.ps1` (or cron job executing `pg_dump -U dating_prod -d dating | gzip > /backups/dating_$(date +%F).sql.gz`).
- **Retention:** Keep backups for 30 days (per `PRIVACY.md` backup expiry policy).
- **Restore Verification:**
  ```bash
  powershell -File infra/scripts/restore.ps1 -BackupFile /backups/dating_2026-10-02.sql.gz
  ```
- **Tombstone Protection:**
  When restoring older backups, `DeletionTombstones` table preserves SHA-256 hashes of deleted accounts, preventing accidental resurrection of deleted profiles.

---

## 6. Store Compliance & Submission Package

### App Store Connect (Apple)
- **App Name:** DatingMVP
- **Primary Category:** Social Networking
- **Secondary Category:** Lifestyle
- **Age Rating:** 17+ (Unrestricted Web Access: No; Gambling: No; Mature/Suggestive Themes: Frequent/Intense; User-Generated Content: Yes).
- **Guideline 1.2 (User Generated Content):**
  - All users must agree to Terms of Service prohibiting harassment or abusive content.
  - Photo moderation: Uploaded photos require moderator approval before appearing in public discovery.
  - In-app reporting: Every profile and chat screen features a "Report" button with reason codes.
  - In-app blocking: Every profile and chat screen features an immediate "Block" option.
  - 24-hour SLA: Moderation panel (`/admin`) allows staff to review reports and immediately suspend abusive accounts.
- **Guideline 5.1.1(v) (Account Deletion):**
  - In-app deletion: Located in Settings -> Account -> Delete Account (requires re-authentication).
  - Public deletion URL: `https://api.datingmvp.example.com/account/delete`
- **Support URL:** `https://datingmvp.example.com/support`
- **Privacy Policy URL:** `https://datingmvp.example.com/privacy` (Draft in `docs/PRIVACY.md`).

### Google Play Console (Android)
- **Target Audience & Content:** 18 and older.
- **Data Safety Section Responses:**
  - **Personal Info:** Name, Email, Date of Birth collected for Account Management.
  - **Location:** Approximate location collected for App Functionality (proximity matching). Ephemeral; not tracked in background.
  - **Photos/Videos:** Photos collected for Profile customization. Stored in private object storage; reviewed by moderation.
  - **Messages:** In-app chat messages collected for communication. Stored in relational database; not end-to-end encrypted.
  - **Device or other IDs:** Device installation ID collected for Push Notification delivery.
  - **Data Transfer & Encryption:** All data transferred over encrypted HTTPS/TLS.
  - **Data Deletion Request:** Users can request deletion in-app or via `https://api.datingmvp.example.com/account/delete`.

### App Reviewer Demo Accounts
Provide these credentials in App Review Notes:
- **Account 1:** `reviewer1@datingmvp.test` / `ReviewerPass123!` (Active profile with approved photos in Tbilisi).
- **Account 2:** `reviewer2@datingmvp.test` / `ReviewerPass123!` (Active profile with approved photos in Tbilisi, matched with Reviewer 1 for chat testing).
- **Review Notes:**
  > "DatingMVP is an 18+ dating service. Test accounts Reviewer 1 and Reviewer 2 are pre-matched so you can test real-time chat, unmatching, and reporting immediately without waiting for discovery swipes. To test account deletion, use Settings -> Delete Account or visit https://api.datingmvp.example.com/account/delete."

---

## 7. Virtual Currency & Store Operator Reconciliation

### Virtual Currency Rules
- **Consumable Crystals:** Crystals are virtual consumable in-game items used exclusively for directed profile unlocks (25 crystals) and game match chat unlocks (25 crystals).
- **No Cash-Out / Transfer:** Crystals cannot be exchanged for fiat currency, transferred between players, wagered, or used for random loot.
- **No Expiry:** Purchased crystals never expire while the account is active.
- **Account Deletion:** Deleted accounts forfeit remaining virtual crystal balances per user agreement.

### Operator Financial Reconciliation Runbook
1. **Daily Platform Settlement Matching:**
   Operators compare daily transaction exports from App Store Connect (Financial Reports) and Google Play Console (Order Reports) against the PostgreSQL `StorePurchases` table:
   ```sql
   SELECT "Platform", "ProductId", COUNT(*) AS PurchaseCount, SUM("Amount") AS TotalCrystals, SUM("PriceAmount") AS GrossVolume, "PriceCurrency"
   FROM "StorePurchases"
   WHERE "Status" = 'completed' AND "CreatedAtUtc" >= NOW() - INTERVAL '24 hours'
   GROUP BY "Platform", "ProductId", "PriceCurrency";
   ```
2. **Refund Reconciliations:**
   Apple and Google Server-to-Server notifications (or operator refund calls) invoke `POST /api/game/store/refund`:
   ```sql
   SELECT "Id", "UserId", "Platform", "TransactionId", "Amount", "Status", "RefundedAtUtc", "RefundReason"
   FROM "StorePurchases"
   WHERE "Status" = 'refunded' AND "RefundedAtUtc" >= NOW() - INTERVAL '7 days';
   ```
3. **Outstanding Debt Monitoring:**
   When a user obtains a platform refund after spending crystals, their balance is capped at 0 and the deficit is tracked in `OutstandingDebt`:
   ```sql
   SELECT "UserId", "Balance", "OutstandingDebt", "UpdatedAtUtc"
   FROM "UserWallets"
   WHERE "OutstandingDebt" > 0;
   ```
   Users with outstanding debt may continue using free features (dating discovery, messaging existing free matches), but future crystal purchases/grants automatically repay outstanding debt before increasing disposable balance.
