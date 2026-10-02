# Privacy Policy and Data Inventory (DatingMVP)

> [!IMPORTANT]
> **DRAFT — MARKED FOR OWNER AND LEGAL REVIEW PRIOR TO PUBLIC OR STORE RELEASE**  
> This document accurately reflects the current technical implementation of data collection, storage, retention, and deletion within the DatingMVP application. It is not legal advice and must be reviewed and approved by product ownership and legal counsel before publication in store listings or web properties.

---

## 1. Transparency and Realistic Security Commitments

- **No End-to-End Encryption (E2EE):** All communication between client applications (iOS, Android, Admin Web) and the backend API is encrypted in transit using industry-standard TLS (HTTPS/WSS). Data at rest in PostgreSQL and private object storage is encrypted. However, **chat messages and profile data are not end-to-end encrypted**. The server terminates encryption, routes messages, processes safety reports, and enforces content moderation.
- **Age Validation vs. Identity Verification:** The application enforces an **adults-only policy (18+)** by validating the user's self-reported date of birth server-side against UTC boundaries. This is an eligibility assertion rule, **not government identity verification or biometric age verification**.
- **Location Privacy:** Exact GPS coordinates are never sent or exposed to other users. Location is optional; users may use city-only mode. When coordinates are provided, only coarse distance buckets (e.g., `< 10 km`, `10–25 km`) or city names are returned to other participants.

---

## 2. Data Inventory

| Category | Specific Data Elements | Storage Location | Purpose |
| :--- | :--- | :--- | :--- |
| **Account & Authentication** | Email address, hashed password (ASP.NET Core Identity password hasher), security stamp, verification codes, refresh token family hashes, session expiration timestamps. | PostgreSQL (`AspNetUsers`, `Sessions`, `RefreshCredentials`) | Authentication, account recovery, session security, lockout defense. |
| **Profile Data** | Display name, private date of birth, public age, bio, gender, explicitly selected desired genders, city, interests, relationship goal, discovery visibility flag. | PostgreSQL (`DatingProfiles`) | Profile presentation, reciprocal discovery matching. |
| **Media & Photos** | Uploaded photos, generated thumbnails, moderation state (`pending`, `approved`, `rejected`). EXIF metadata is stripped during re-encoding. | Object storage (Private files) + PostgreSQL (`ProfilePhotos`) | Visual profile display in discovery and chat previews. |
| **Swipes & Matches** | Like and pass decisions, match pairings, active/inactive state, unmatch records. | PostgreSQL (`Swipes`, `Matches`) | Mutual matching and communication authorization. |
| **Chat Communications** | Plaintext message text (max 2,000 chars), monotonic sequence numbers, sender ID, client message ID, send timestamp, read cursor. | PostgreSQL (`ChatMessages`, `ChatReads`) | Synchronous and asynchronous communication between matched users. |
| **Push Notifications** | Installation ID, platform (iOS/Android), encrypted push token (AES-GCM), device revision, notification preferences (matches, messages). | PostgreSQL (`PushDevices`, `PushPreferences`, `PushDeliveries`) | Background alerting via Expo push infrastructure without exposing chat content on lock screen. |
| **Safety & Moderation** | Category, description, reporter/reported IDs, snapshot of up to 5 recent incoming messages at time of report, photo snapshots, moderator decisions. | PostgreSQL (`Reports`, `ReportEvidence`, `ModeratorDecisions`) | Investigation of abuse, harassment, underage accounts, and policy violations. |
| **Audit Logs** | Staff admin actions, photo moderation, user suspension, IP address, timestamp. | PostgreSQL (`AuditLogs`) | System security, operator accountability, operational debugging. |

---

## 3. Account Lifecycle and Deletion

Users may delete their account at any time either:
1. **In-App:** Via the Profile screen, requiring current password re-authentication.
2. **Public Deletion Web Request:** Via the public `/account/delete` web page or API (`POST /api/account/public-deletion-request`), which sends a single-use verification token to the registered email address without enumerating whether the address exists.

### Immediate Deletion Actions
Upon valid deletion request:
- The user's profile is hidden immediately (`Visible = false`).
- Personal profile data is anonymized (`DisplayName = 'Deleted Account'`, bio cleared, city cleared, location cleared).
- Email is scrubbed and randomized (`deleted_<guid>@deleted.local`) to release the original address and prevent account lookup.
- Password hashes and security stamps are cleared; the user is permanently locked out (`LockoutEnd = DateTimeOffset.MaxValue`, `IsActive = false`, `IsDeleted = true`).
- All active sessions and refresh tokens are revoked; active SignalR WebSocket connections are terminated.
- All matches involving the user are deactivated (`Active = false`).
- Pending push notifications in the outbox are cancelled/deadlettered; push device credentials are deactivated and ciphertexts erased.
- A cryptographic `DeletionTombstone` is written containing a SHA-256 hash of the normalized email.
- An asynchronous `AccountDeletionJob` is queued.

### Asynchronous Data Purge (`AccountPurgeWorker`)
The background worker executes with exponential backoff retry:
- Physically deletes all stored photo files and thumbnails from private object storage.
- Updates database photo records to `Deleted = true` and `ObjectsDeleted = true`, clearing object keys.
- Marks the deletion job `completed`.

---

## 4. Reconciled Data Retention Rules

To balance user privacy with fraud prevention and user safety:

1. **Surviving Match Partner's Conversation History:**
   - When user A deletes their account, user B (the other match participant) retains access to the message history prior to deletion.
   - User A's messages remain in the conversation thread, but User A's identity is anonymized and displayed as "Deleted Account". User A's photos are purged.
2. **Safety Reports and Abuse Evidence:**
   - Reports and attached evidence (recent message snapshots, reported photo snapshots) are retained for a rolling window of **180 days** from report creation.
   - This narrow retention is strictly limited to authorized safety investigations and preventing banned or predatory users from cycling accounts. Access is restricted to staff with multi-factor authentication (MFA).
3. **Audit Records:**
   - Administrative audit log entries are retained for security auditing. Audit logs do not contain raw passwords, message bodies, or media files.

---

## 5. Backups and Backup Restoration Safeguards

- **Backup Expiration:** Automated relational database backups and object storage snapshots are retained for a maximum of **30 days**, after which they are permanently overwritten or purged.
- **Tombstone Restoration Safeguard:** To ensure that a database disaster recovery operation does not silently resurrect deleted accounts or restore purged personal data:
  - The `DeletionTombstones` table records deleted user IDs and email hashes.
  - Restoration runbooks require running a tombstone reconciliation check immediately after restoring any backup older than 1 hour to re-enforce deactivations and prevent resurrected sessions.

---

## 6. User Controls

- **Discoverability Pause:** Users can temporarily pause discovery (`POST /api/account/discoverability-pause` or Profile settings) to hide from new card decks while keeping existing matches and active chats.
- **Notification Preferences:** Users can toggle match and message push alerts independently (`POST /api/notifications/preferences`).
- **Logout All Devices:** Users can revoke all active sessions across all devices simultaneously (`POST /api/auth/logout-all`).
- **Block and Unmatch:** Users can end mutual matches or block accounts at any time from the Safety Center.
