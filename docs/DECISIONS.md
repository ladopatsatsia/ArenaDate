# Decisions

## Prompt 9 current decision

User authorized Prompt 9 and subsequently Prompt 10 only after completing 9. Angular/Material is the sole moderator frontend. Separate persisted MFA cookie sessions and operator-only staff membership replace legacy bearer photo moderation. Built-in Identity authenticator/lockout and ASP.NET antiforgery are reused; no auth framework dependency was added. Secure cookies remain mandatory locally, with explicit HTTPS development setup. Bounded report snapshots are the only private-message review surface. User row locks serialize suspension and photo changes with existing pair/account writers. Exact semantics and operator commands: MODERATION.md. Prompt 8 external provider/native blockers remain open.

2026-09-30 ? Scope: Prompt 0 permanent rules + Prompt 1 foundation only. The initial directory contained only the two specification Markdown files, no Git metadata, code, AGENTS.md or status document. Both specifications are preserved. Root AGENTS.md contains Prompt 0 verbatim plus the concrete stack clarification.

- Modular monolith: one .NET 10 controller API and one EF Core context; feature folders grow when their stage is implemented. No CQRS framework, repository layer, Redis or speculative projects.
- PostgreSQL/PostGIS is the only primary database. Initial migration enables PostGIS; no premature domain tables or fake seed users. Migrations are explicit operator/CI actions.
- Angular 21 supported LTS with Material is the only planned admin UI. Shell only now; server-side cookie sessions, roles, MFA and CSRF belong to stage 9. No public consumer web app.
- Expo SDK 57 owns React/React Native/native module versions. Router requires its compatible animation peers. Only foundation dependencies are included.
- npm workspaces and one root lockfile provide shared API types to both frontends without a build orchestrator. Backend OpenAPI is authoritative; generation starts the actual API and checks exact drift.
- Tabs are a development-only navigation preview, not a simulated authenticated session. Release deep links cannot open them or the health screen. Prompt 2 must replace the preview guard with real session state.
- Logs contain only server-generated correlation ID, status and duration; framework/DB request logging is disabled to avoid URLs, exception payloads and private data. Logs intentionally do not expose raw exception messages.
- API connectivity is genuine; readiness checks DB connectivity, pending migrations and PostGIS. Liveness is independent of DB. No auto migration on process startup.
- Local DB port 55432 avoids an existing service on 5432. Local Compose credentials are isolated in ignored infra/.env. Test databases use unique generated names and are dropped after each test; no application database is reset.
- CI workflow is prepared for GitHub, but no Git repository/remote existed and no hosted run is claimed.

## Domain invariants

Auth, adult eligibility and cache-isolation constraints are implemented in Prompt 2; dating/lifecycle constraints remain reserved for later stages.

- Adults 18+, server-side DOB boundaries; email verification does not claim verified identity/age.
- Identity, roles, resource ownership and conversation membership are always server-authorized.
- One immutable directed decision per pair; canonical unique match pair; one conversation per match.
- Reciprocal like creation and block/unmatch/send synchronize in PostgreSQL with documented lock order, not in-memory locks.
- Messages have unique (sender, conversation, clientMessageId); REST persists before outbox-driven SignalR delivery. No E2E encryption claim.
- Both block directions, suspension and deletion exclude discovery/chat/push; unblocking never recreates matches.
- Private DOB, coordinates, email, tokens and conversations never leak into public DTOs/logs.
- Account-scoped caches clear on logout/account changes; refresh tokens use SecureStore, access tokens stay in memory.
- Private S3-compatible media, foreground-only location with city fallback, persisted outbox and retryable deletion jobs.
- First deployment is one API instance; scaling requires verified synchronization and hub fan-out.

## Planned stages

0 rules (done); 1 foundation (done); 2 auth (implemented); 3 profiles/photos (implemented); 4 discovery (implemented); 5 swipe/match (implemented); 6 chat (implemented); 7 safety; 8 push; 9 Angular moderation; 10 mobile quality; 11 lifecycle/privacy; 12 regression; 13 release preparation. Prompt 3 completion was reported before starting Prompt 4, as requested. Both are implemented. Current authorization includes Prompt 6 after Prompt 5; Prompt 7+ is not authorized.

- API default is port 5180 because an unrelated local service occupied 5080. PostgreSQL connections explicitly use 127.0.0.1 to match Compose binding.

## Prompt 2 decisions (supersede foundation placeholders)

- User explicitly authorized Prompt 2 only. Angular remains the agreed moderator frontend; its security is not conflated with consumer bearer auth.
- ASP.NET Core Identity with PostgreSQL, RS256 access JWTs, hashed opaque refresh families and per-user row locking. No third-party auth service or hand-written password hashing.
- 30-second encrypted retry window resolves ambiguous refresh responses; conflicting concurrent calls do not revoke a healthy family. Old-token replay outside the window does revoke it. Full protocol and tradeoffs are in AUTH.md.
- Durable encrypted email queue separates generic registration/recovery responses from SMTP latency. Local capture is explicit; production requires protected keys and mandatory StartTLS SMTP credentials. Manual code entry avoids tokens in links/logs.
- Every tab now requires a real server-validated session in all builds. SecureStore persists only refresh credentials; access stays in memory. Session generations and serialized writes prevent stale account data from crossing account switches.
- React Hook Form + Zod handle forms; TanStack Query owns account-scoped caches. No private query persistence. Clearing sessions is the single integration point for later deletion.
- UTC adult validation is an eligibility rule, not verified identity. No profile/media/discovery work began.

## Prompt 3 decisions

User authorized Prompt 3, then a completion report, then Prompt 4. Profile and private-photo work precedes discovery. SkiaSharp MIT with matching Linux native assets handles bounded JPEG/PNG/WebP decoding, orientation, metadata removal and thumbnails; mobile native conversion handles supported HEIC inputs. Private local storage and real S3 SDK storage share server-generated keys and persisted orphan cleanup. Ownership, explicit moderation and optimistic revisions are backed by PostgreSQL locks/constraints. Detailed choices and deferred provider/device verification are in PROFILES.md.

## Prompt 4 decisions

- PostGIS geography(Point,4326) with GiST and server-side ST_DWithin in meters; each participant's radius/city and age/gender rules apply. No application-memory geographic filtering or per-card photo queries.
- Optional explicit one-shot foreground location, coarsened before persistence; fixed radii and broad public buckets. Manual normalized city fallback requires no device permission or external provider.
- Stable sequence/keyset cursors bind the authenticated user, settings revision and UTC date; 20-card pages with one batched photo read. This is a live feed, not a persistent snapshot.
- Block, prior-decision and unmatched-pair records are exclusion inputs only. Swipe/match and safety mutation workflows were not implemented ahead of their stages. Current-card and media reads recheck the shared eligibility policy.
- Async picker/location clients capture their originating account, preventing an old A callback from beginning a new B mutation. Existing session-generation guards continue to reject stale in-flight responses.
- Detailed defaults, limits, privacy tradeoffs and deferred native checks are in DISCOVERY.md. Stage 5 remains unstarted.

## Prompt 5 decisions (current scope)

User explicitly authorized Prompt 5 and prohibited starting Prompt 6, superseding the preceding stage-boundary notes.

- Immutable directed decision and idempotent receipt; canonical unique match, unique conversation and event, committed together.
- Ordered PostgreSQL user-row locks serialize reciprocal likes and internal block/unmatch operations; they also synchronize with existing single-user profile/auth writes. READ COMMITTED after the lock sees the preceding commit. No distributed cache or memory-only backend lock.
- Transactional match outbox with SKIP LOCKED claiming, idempotent per-user inbox, persisted backoff and dead-letter view. No SignalR/chat/push delivery starts ahead of its stage.
- Small durable account-bound mobile intent before any network write; ambiguous outcomes remain pending with the same request ID across restart. Separate tiny SecureStore keys deduplicate actual server match IDs, plus server-side acknowledgement.
- Real match list uses bounded UUID keyset pagination. Existing matches survive changed discovery preferences; active-account/block/unmatch authorization still applies.
- Native gesture dependency follows Expo SDK 57's bundled 2.32.0. Root/workspace pinning must prevent Router's broad optional peer from choosing a second native major. No React/RN/Expo/Angular upgrade.
- Detailed policy, throughput/privacy tradeoffs, outbox operations and deferred device verification: MATCHING.md.

## Prompt 6 decisions (current)

User authorized Prompt 6 only AFTER Prompt 5 completion; Prompt 5 checks/report are archived in STATUS.PROMPT5.md. Prompt 7 is not started.

- REST is the sole message writer; sequence and outbox commit with the text. Pair locks from Prompt 5 serialize send/read and safety transitions. Database uniqueness owns idempotency.
- SignalR LongPolling uses bearer headers and hints without message content. Fresh database/session checks authorize every subscription and destination; cached membership never grants access.
- Exact sequence strings, 50-row keyset history, monotonic message-ID read cursors and SQL preview/unread projection.
- Foreground-only mobile connection with bounded reconnect backoff, persisted-history gap recovery and fallback polling. Unicode-safe SecureStore chunks retain one ambiguous outgoing intent per conversation.
- Production API/hub HTTPS fails closed. PostgreSQL message content is not E2E-encrypted; actual disk/backup protection remains an operator responsibility, explicitly documented in CHAT.md.

## Prompt 7 decisions (current)

Prompt 6 was completed before the user authorized Prompt 7. Prompt 8 remains unstarted.

- One transactional safety command supports report, block, unblock and unmatch, including atomic report-and-block/unmatch. Shared ordered user row locks serialize safety with likes/messages.
- Own-only directional blocks; no match resurrection on unblock; unmatch permanent for the pair. Narrow prior-conversation reporting avoids normal history access.
- Persisted generic revocation events reuse the existing chat outbox. Registry eviction is immediate after commit, hub registration is inside pair locking and every hint reauthorizes. Retained connection addresses grant no access.
- Server-resolved report evidence is purpose-protected under the persistent key ring. Live evidence/report retention is 180 days; non-content idempotency receipts 365 days. Bounded expiry cleanup and a five-new-reports/day actor limit. No public evidence reader or reporter identity disclosure.
- Mobile confirmations, report-and-block option, account-scoped cache clearing and late-response guards. No new framework/dependency versions. Precise limitations and operational policy: SAFETY.md.

## Prompt 8 decisions (current)

User authorized Prompt 8 after Prompt 7 completion; Prompt 9 remains unstarted.

- Expo Push Service over a fixed HTTPS endpoint, with APNs/FCM owner credentials and enhanced Expo push security. No new backend SDK; built-in HttpClient with sensitive logging disabled.
- Separate configurable AES-256-GCM key ring for token delivery, SHA-256 lookup and installation-proof hashes. Device binding is actor/session-owned; ordered user locks and persisted revisions guard transfer and delayed requests. Ordinary refresh preserves binding identity.
- Match/message writers enqueue per current device in the same transaction. PostgreSQL claims, persisted backoff/receipts and safe dead-letter view; reauthorization under pair locks before bounded provider I/O. External delivery remains at-least-once.
- Both preferences default off. Generic bodies only. Strict payload validation followed by authenticated server target resolution and normal chat authorization. Foreground/background/cold-start handling and serialized mobile registration/preferences.
- Default-disabled provider is honest missing-configuration behavior, not a fake push service. Test providers exist only in tests. Physical delivery, owner credentials and native signing remain external verification requirements.
- Detailed operation, proof-loss limitation, rotation and iPhone/Android checklists: PUSH.md.

## Prompt 11 decisions (current)

- Immediate deletion: Profile hidden, user anonymized (DisplayName = "Deleted Account", email randomized to `deleted_<guid>@deleted.local`), sessions revoked, matches deactivated (`Active = false`), push outbox deadlettered, push devices cleared, SignalR hub evicted.
- Asynchronous purge worker: `AccountPurgeWorker` physically purges photo objects from storage with exponential backoff and idempotency; sets `ObjectsDeleted = true` and `Deleted = true`.
- Data retention reconciliation: Surviving match partner keeps message history (author displayed as "Deleted Account"); reports/evidence retained for 180 days for safety; audit logs retained.
- Backup safeguard: Automated backups expire at 30 days. `DeletionTombstones` table records SHA-256 hashes of deleted emails to prevent silent resurrection on backup restore.
- Store compliance: `GET /account/delete` public web page; `POST /api/account/public-deletion-request` returns 202 without leaking account existence; token confirmed via `POST /api/account/confirm-deletion`.
- Complete draft privacy policy in `docs/PRIVACY.md` marked for owner review, without claiming non-existent E2EE or governmental verification.

## Prompt 13 decisions (current)

User explicitly authorized Prompt 13 to verify release readiness, package reviewable staging artifacts, and finalize MVP deployment runbooks per AGENTS.md.

- Packaging & Build Verification:
  - Mobile: Built native Hermes Bytecode bundles for Android and iOS using `npx expo export --platform all` (5.4 MB Android HBC, 5.2 MB iOS HBC, 34 static assets).
  - Admin: Compiled production Angular 21 distribution to `admin/dist/admin/browser` (441.5 kB initial bundle).
  - Backend: Created production Docker image `dating-api:production` using official .NET 10 runtime, non-root user `1654:1654` (`$APP_UID`), and verified locked NuGet dependencies.
  - Database: Generated idempotent standalone SQL migration script `artifacts/migration.sql` (42.8 kB) covering all migrations from initial foundation through account deletion.
- Single Instance Topology:
  - Explicitly documented that production deployment must remain **strictly ONE API instance**. Horizontal scaling beyond 1 replica is prohibited until a distributed SignalR backplane (Redis) and multi-instance distributed concurrency are implemented and validated.
- Environment & Protocol Separation:
  - Strict HTTPS enforcement: `mobile/app.config.ts` dynamically fails fast if `EAS_BUILD_PROFILE` is preview/production and `EXPO_PUBLIC_API_URL` does not start with `https://`.
  - Insecure and development endpoints (such as mail capture or local photo auto-approval) fail validation in production environment.
- Disaster Recovery & Rollback:
  - Automated database backup and restore validation scripts provided in `infra/scripts/backup.ps1` and `restore.ps1`.
  - Tombstone protections (`DeletionTombstones`) ensure restored backups do not resurrect deleted accounts.
- Store Compliance Packages:
  - Prepared full App Store Connect Guideline 1.2 (UGC safety) and 5.1.1(v) (Account deletion) packages.
  - Prepared Google Play Console Data Safety disclosures and review credentials.
  - Overall release status marked **NO-GO** in `docs/RELEASE.md` pending owner developer credentials and physical device testing.
- Expo Go SDK 53+ Android Push Notifications Compatibility:
  - Expo Go removed native remote push notification capabilities on Android starting with SDK 53.
  - `mobile/src/notifications/PushProvider.tsx` was hardened to guard all native notification handler and listener registrations against `Constants.executionEnvironment === ExecutionEnvironment.StoreClient` (`isExpoGo`) and wrapped with `try/catch`. This prevents unhandled module-level exceptions when running inside the Expo Go sandbox while preserving full push capabilities for native EAS development builds and production releases.
  - `mobile/app/_layout.tsx` explicitly exports `ErrorBoundary` from `expo-router` for safe route handling.

## Prompt 14 decisions (current)

User explicitly authorized Prompt 14: Arena Bottle Game foundation and persisted room/membership data model. Prompt 15 (SignalR presence & connection recovery) and beyond remain unstarted.

- Architecture & Modular Monolith:
  - Game feature placed in `backend/Dating.Api/Features/Game` slice (`GameModels.cs`, `GameService.cs`, `GameController.cs`).
  - Mobile client integrated with `mobile/src/game/GameApi.ts`, `mobile/src/game/GameLobbyScreen.tsx`, and dedicated tab screen `(tabs)/game.tsx`.
- Data Model & Single Active Membership Invariant:
  - `GameRoom` stores room state (`Lobby`, `Starting`, `Active`, `Ended`, `Cancelled`), capacity (default 10), and gender quotas (default 5 ♀ / 5 ♂).
  - `GameMembership` tracks membership lifecycle (`Active`, `Left`, `Kicked`, `Disconnected`).
  - Single active room per user is enforced strictly at the database level using a partial unique index:
    `CREATE UNIQUE INDEX "IX_GameMemberships_UserId" ON "GameMemberships" ("UserId") WHERE "Status" = 'Active';`
- Concurrency & Atomic Quotas:
  - Joins execute inside an isolated EF Core transaction with database row locks (`FOR UPDATE` pattern) to guarantee serial execution and prevent race conditions when two or more users attempt to fill the 5th gender slot or 10th room slot simultaneously.
  - Quota evaluation checks exact gender counts (`woman` vs `man`) against the room's quotas before inserting membership.
- Server-Side Eligibility & Trust:
  - Client-supplied age, gender, role, or eligibility claims are strictly untrusted.
  - `GameService.ValidateEligibilityAsync` checks 18+ adult age calculated from persisted `BirthDate`, `EmailConfirmed == true`, active account status, profile completeness, approved photo, and reciprocal interest (`woman -> man` and `man -> woman` for default rooms).
- Safety & Blocked Pairs Exclusion:
  - Blocked users cannot join or share a room with each other. If any active room member has blocked the joining user or is blocked by them, the room returns `404 Not Found` (`room_unavailable`), preventing either party from detecting the other's room presence.
- Privacy & Information Sanitization:
  - Room summaries and detail DTOs expose only safe public profile data: `displayName`, `gender`, `age` (derived from birth date), `bio`, and approved avatar photo ID. Location coordinates, email addresses, discovery preferences, and private settings are strictly excluded.
- Account Invalidation Hooks:
  - Account deletion (`AccountLifecycleService.ExecuteDeletionCore`) and suspension (`ModerationService.UpdateUserActiveAsync`) automatically invoke `GameService.InvalidateUserMembershipsAsync` to terminate active memberships immediately.
- Test Fixtures:
  - Development-only endpoint `/api/game/rooms/{id}/dev-fixtures` enables seeding up to 3♀ + 3♂ test players with valid data to verify 30-second lobby fallback quorums without exposing fixture methods in production.
- Matchmaking Queue & 6/8/10 Table Formats:
  - Added selectable table formats: 6-player (3♀ / 3♂), 8-player (4♀ / 4♂), and 10-player (5♀ / 5♂).
  - Users enter the queue via `POST /api/game/queue` `{ capacity: 6 | 8 | 10 }`.
  - Atomically finds existing open compatible `Lobby` rooms or creates a new one using row locks (`FOR UPDATE`). When full (e.g. 3♀ + 3♂ for 6-player), the room automatically transitions to `Starting`.
- Absolute Invisibility of Starting / Playing Tables:
  - Rooms in `Starting` or `Playing` state are completely removed from public listings (`GET /api/game/rooms`).
  - Outsiders querying `GET /api/game/rooms/{id}` or `POST /api/game/rooms/{id}/join` for non-lobby rooms receive a non-revealing `404 Not Found` (`room_unavailable`).
  - Only active joined members can view and interact with their room via `GET /api/game/current` or `GET /api/game/rooms/{id}`.
- Comprehensive Incompatibility Filtering (Safety & Privacy):
  - Users who have blocked each other (`UserBlock`, one-way or mutual), unmatched (`UnmatchedPair`), or are already actively matched (`DatingMatch.Active == true`) are strictly prohibited from sharing a table.
  - The matchmaking queue checks the incompatible set before placing any user into an existing room. If any active member in a room is incompatible, a separate room is allocated.
- Single Active Table & Queue Rule:
  - While actively queued or seated at a table, joining another queue or table is blocked server-side with 409 `active_membership_exists` and backed by the database partial unique index.

## Prompt 22 decisions — 18-Round Automatic Bottle Game, Target Selection & Post-Game Kisses

User explicitly requested real-time Arena Bottle Game turn automation and end-of-game flows:
- **18 Rounds & Exact 3-Spin Quota**:
  - In a 6-player table (3♀, 3♂), active members are interleaved cyclically (`[w0, m0, w1, m1, w2, m2]`).
  - At the completion of each round, `SelectNextTurnUserIdAsync` advances cyclically to the next player. Over exactly 18 rounds, each of the 6 players receives exactly 3 turns as the spinner (6 × 3 = 18).
  - When the 18th round completes, `EndGameAsync` transitions the room to `State = Ended`, clears active turns, and dispatches the `GameEnded` event.
- **Automatic Bottle Spin**:
  - Rounds start automatically without requiring a manual spin button press. The bottle animates for 4 seconds pointing directly to the designated turn spinner.
- **Target Selection & 15-Second Timer with Automatic Fallback**:
  - Once the bottle points to the spinner, the spinner chooses an opposite-gender candidate within a 15-second deadline.
  - Endpoint `POST /api/game/rooms/{id}/rounds/{roundId}/target` validates that the caller is the current turn spinner, that the chosen target is an active member of the opposite gender, and that the pair is compatible.
  - If the spinner does not select within 15 seconds, `ProcessDeadlinesAndOutboxAsync` invokes `PickFallbackTargetUserIdAsync` to automatically assign an active opposite-gender candidate, guaranteeing the room never deadlocks or stalls.
- **Standardized 15-Second Phase Deadlines**:
  - All interactive phases are synchronized to 15 seconds (`TargetSelection: 15s`, `QuestionAnswering: 15s`, `KissChoice: 15s`, `TurnPending: 15s`). Reveal phase remains 4 seconds for immediate feedback.
- **Game Completion Summary Modal & Post-Game Kisses**:
  - When `snapshot.state === 'Ended'`, mobile renders the `"თამაში დასრულდა!"` modal listing all participants with avatar, display name, age, and `"💋 აკოცე"` action button.
  - Post-game kisses (`POST /api/game/rooms/{id}/post-game-kiss`) are sent directly from the summary modal. Reciprocal post-game kisses form an instant mutual match (`GameArena` origin, `HasChatEntitlement = false`). Non-reciprocal kisses record a pending kiss and create a `DiscoveryDecision` ("like") with note `"დავიმეჩე ბოთლის თამაშში"`, appearing in the recipient's Requests tab.
  - Dismissing or closing the summary modal exits the room (`onLeave`), removing membership and navigating back to the lobby.

## Prompt 56 decisions — Telegram Bot Notifications & Admin Broadcast Architecture

- **Subscriber Persistence & Chat ID Isolation**:
  - `TelegramSubscriber` entity isolates Telegram `ChatId` and Telegram metadata in PostgreSQL, separated from identity tables.
  - Subscribers are registered whenever a user messages the bot (`/start` or free text) or opens the Telegram Mini App.
  - Telegram `ChatId` is linked to `AppUser.Id` during Telegram authentication (`AuthService.LoginTelegram`), allowing server-side push notifications to target specific users without needing client-side polling.
- **Non-Blocking Notification Dispatches**:
  - All notifications inside core mutation paths (`MatchService`, `GameService`, `WalletService`, `ChatService`) are wrapped in safe try/catch or background dispatches. Any Telegram API failure or network timeout never rolls back or aborts core transactional database operations (e.g. mutual matches, crystal purchases, chat persistence).
- **Telegram Rate Limiting & Auto-Pruning**:
  - Broadcasts enforce a 35ms throttle delay between deliveries (~28 messages/second), respecting Telegram's strict limit of 30 messages/second.
  - If Telegram returns HTTP `403 Forbidden` (`bot was blocked by the user` or account deactivated), the system automatically updates `TelegramSubscriber.IsActive = false`, preventing future deliveries to that chat.
- **Admin Broadcast Security**:
  - Broadcast endpoints require valid moderator session cookie, MFA verification, and CSRF header protection (`X-XSRF-TOKEN`).
  - Messages are validated server-side (1 to 4000 characters) and HTML-escaped. Button routes default to `/arena` or `/messages` within the verified `Telegram:WebAppUrl`.

## ARENA „დღეს მინდა…“ decisions — Prompt 1 Architecture & Domain Model

- **Subsystem Integration & No Parallel Stacks**:
  - Feature lives in `backend/Dating.Api/Features/TodayPlans/`.
  - Reuses existing ASP.NET Core Identity and JWT Bearer auth (`CurrentUser`), `DatingProfile`, `IPremiumService`, `PushQueue`, and `ITelegramNotificationService`.
  - Matches generated from accepted plans create `DatingMatch` with `Origin = "TodayPlan"` and `HasChatEntitlement = true`. No custom or duplicate chat engines.
- **Data Models & State Transitions**:
  - `TodayPlan`: `State` transitions: `Open` -> `Matched` (when companion accepted), `Cancelled` (by author), or `Expired` (when `ExpiresAtUtc <= now`).
  - `TodayPlanResponse`: `State` transitions: `Pending` -> `Accepted`, `Rejected`, `Withdrawn` (by applicant), or `Closed` (when another companion accepted or plan expired).
  - Uniqueness: Single response per `(PlanId, ApplicantUserId)`.
- **Atomic Acceptance & Concurrency**:
  - Companion acceptance locks the `TodayPlan` row to prevent double-accept races. The first transaction wins; any concurrent acceptance receives 409 Conflict.
  - When an applicant is accepted, all other `Pending` responses are atomically updated to `Closed`.
- **Limits & Timezone Policy**:
  - Max planning horizon is 48 hours from current UTC time.
  - Free tier: max 1 active plan, 3 responses/day.
  - Premium tier: max 3 active plans, 10 responses/day.
  - Daily response quota evaluated in `Asia/Tbilisi` timezone resetting at 00:00.
  - Applicant list and accepted chat are 100% free with 0 crystal cost.



