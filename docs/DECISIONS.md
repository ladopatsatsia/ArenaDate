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

