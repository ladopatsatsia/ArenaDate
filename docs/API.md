# API contract

## Prompt 9 moderation additions

All `/api/moderation` routes require HTTPS. `GET csrf` and `POST login` are the only anonymous routes; login still requires ASP.NET antiforgery. Every other route requires the separate current MFA admin cookie session. Every mutation requires `X-XSRF-TOKEN`; no bearer privilege fallback exists. GET `me`, POST `logout`, GET `photos?after=UUID`, GET `photos/{id}/content` (pending only), POST `photos/{id}` `{state:approved/rejected,reason}`, GET `reports?after=UUID&closed=false`, GET `reports/{id}/evidence`, POST `reports/{id}` `{state:closed,reason}`, GET/POST `users/{id}` (write `{active,reason}`), GET `audit?before=sequence`. Lists are bounded to 50. Unknown/expired evidence 404, conflicting reviews 409, invalid CSRF/input 400, invalid session 401, prohibited staff lifecycle 403. Generated DTOs are shared with Angular. See [MODERATION.md](MODERATION.md).

Development base URL: http://localhost:5180. OpenAPI is generated from the actual controller API in packages/api-contract/openapi.json; matching TypeScript types are in src/schema.d.ts.

| Method/path | Response / access |
|---|---|
| GET /api/health/live | Public 200; independent of database |
| GET /api/health/ready | Public 200 with migrations/PostGIS ready, otherwise 503 |
| GET /openapi/v1.json | Development only; 404 in Production |
| POST /api/auth/register | Public email, password, dateOfBirth (YYYY-MM-DD); generic 202 |
| POST /api/auth/otp/send | Public email; generic 200 with { success, message, expiresAtUtc, devCode? } (fixed to "1111" in development) |
| POST /api/auth/otp/verify | Public email, code (4 digits, "1111"); 200 with { isNewUser, isProfileComplete, tokens: { accessToken, ... } } |
| POST /api/auth/telegram | Public initData; 200 with { isNewUser, isProfileComplete, tokens: { accessToken, ... } } |
| POST /api/auth/verification-email | Public email; generic 202 |
| POST /api/auth/verify | Public email, code; 204 or 400 |
| POST /api/auth/login | Public email, password; token response or generic 401 |
| POST /api/auth/refresh | Opaque refreshToken and UUID requestId; rotated token response, 401 or 409 |
| POST /api/auth/logout | Opaque refreshToken; idempotent 204 |
| POST /api/auth/forgot-password | Public email; generic 202 |
| POST /api/auth/reset-password | Public email, code, password; 204 or 400 |
| POST /api/auth/logout-all | Bearer-authenticated; 204 |
| GET /api/auth/me | Bearer-authenticated; only own { id } |

TokenResponse: accessToken, accessExpiresAt, refreshToken, sessionExpiresAt, account: { id }. Codes/tokens are sent only in JSON bodies or Authorization: Bearer headers. Auth responses use Cache-Control: no-store. Requests are bounded to 16 KiB and validated server-side. There is no public role assignment. Profile DTOs and routes are described below.

Errors use safe application/problem+json with status, title, about:blank type and correlationId; known auth failures add a bounded code. Each response includes a server-generated X-Correlation-ID. Request URL/body, submitted values, credentials, internal exceptions and database entities are never echoed. JWT failures are generic 401; auth throttling is 429 with Retry-After. See [auth policies](AUTH.md) for limits and refresh concurrency.

## Contract workflow

Build backend first: `dotnet build backend/Dating.slnx`. Run `npm run contract:generate`, review OpenAPI and TypeScript changes. The generator launches a real Development API on a temporary loopback port with local-only auth keys, without a required database. It normalizes JSON ordering and environment servers. `npm run contract:check` compares both outputs without writing. CI rejects drift.

Mobile src/auth/api.ts uses generated request/response types, runtime token validation, a 15-second abort timeout and explicit HTTP failures. SessionManager supplies memory-only access tokens and shared refresh. The foundation health client retains its five-second timeout. Angular uses the shared health contract and a same-origin development proxy; consumer mobile bearer tokens are not admin credentials.

## Environment

See backend/.env.example (sanitized names, not automatically loaded), mobile/.env.example and [AUTH.md](AUTH.md). ConnectionStrings__Database is required for API/EF; TEST_DATABASE_CONNECTION must permit creating isolated test databases. ASPNETCORE_ENVIRONMENT=Development enables OpenAPI/local mail capture. Auth/Email secrets belong only to the server environment.

EXPO_PUBLIC_API_URL is a public base URL, HTTPS for preview/production, never a secret. IOS_BUNDLE_IDENTIFIER, ANDROID_APPLICATION_ID and EAS_PROJECT_ID belong to the owner. DOTNET_COMMAND may point contract/smoke scripts to a local SDK. Cross-origin credential CORS and query-string bearer token extraction are not enabled.

## Prompt 3 additions

Authenticated profile GET/POST, choices GET, upload reservation/finalization, ordered photos, delete, viewer-bound media tickets and role-checked moderation routes are implemented. See [PROFILES.md](PROFILES.md) for payload/limits/concurrency details and the generated OpenAPI for exact DTOs. Photo finalization is a raw binary body; it never accepts a remote URL.

## Prompt 4 additions

| Method/path | Behavior |
|---|---|
| GET /api/discovery?cursor=... | At most 20 currently eligible public cards; encrypted next cursor or null |
| GET /api/discovery/{id} | Current authorization/eligibility recheck and public card, otherwise 404 |
| GET /api/discovery/settings | Own age/gender/radius/mode/city/revision and hasLocation; no coordinates |
| POST /api/discovery/settings | Validated settings and expected profile revision; 409 if stale |
| POST /api/discovery/location | Consent + one device fix; store only coarse private point |
| DELETE /api/discovery/location | Remove point and switch to city mode |

All require bearer auth and no-store responses. Unknown discovery query parameters are 400; pagination context changes are 409; rate limits are 429. Full reciprocal rules, location precision and paging behavior: [DISCOVERY.md](DISCOVERY.md). GET card/media checks do not create a swipe/match; Prompt 5 must call the same eligibility service inside its locking transaction.

## Prompt 5 additions

| Method/path | Behavior |
|---|---|
| POST /api/swipes | Authenticated { requestId, targetId, kind: like/pass }; transactional immutable decision, optional actual matchId |
| GET /api/swipes/{requestId} | Own committed receipt; 404 unknown; safe same-ID reconciliation |
| GET /api/matches?cursor=UUID | Current member's active matches, 20-item UUID keyset page, nextCursor |
| GET /api/matches/notices | At most 20 available unseen durable match events |
| POST /api/matches/{matchId}/acknowledge | Member-only idempotent acknowledgement, 204 |

All require bearer auth and no-store; swipe/read policy is 120 requests/minute per account (process-local). Invalid actions are 400; unavailable candidate 404; reused ID with conflicting valid pair payload or a new decision after a final one 409. Network/5xx results are ambiguous and must retain the original ID. Receipt replay suppresses a now-closed match ID. Generated OpenAPI remains authoritative. [Matching protocol](MATCHING.md) describes pair locks, constraints, outbox and native verification boundaries. No message/chat endpoints exist.

## Prompt 6 additions

| Method/path | Behavior |
|---|---|
| GET /api/conversations/{id}/messages?before=N OR after=N | Current member-only 50-message page; exact string sequences, nextBefore/nextAfter and own/peer reads |
| POST /api/conversations/{id}/messages | { clientMessageId, text }; the sole authoritative writer; stable MessageDto on identical retry |
| POST /api/conversations/{id}/read | { messageId }; verify conversation and monotonically advance own read cursor |
| /hubs/chat | Authorized SignalR LongPolling; Subscribe/Unsubscribe(conversationId); ConversationChanged(id) hints only |

MatchSummary now includes conversationId, lastMessage (120-character maximum preview) and unreadCount. Message text maximum is 2,000 UTF-16 units; server new-message rate 30/minute per sender, plus 120/minute request policy. No client-supplied sender/participant is trusted. Invalid input/cursor 400, inaccessible conversation 404, changed content under reused ID 409, rate 429. Every retry/read/hub invocation/delivery reauthorizes current state. Production API/hub HTTP fails closed. [Chat protocol/security/storage details](CHAT.md).

## Prompt 7 additions

| Method/path | Behavior |
|---|---|
| POST /api/safety | {requestId, action: block/unblock/unmatch/report, targetId?, conversationId?, report?}; atomic command, 204 |
| GET /api/safety/blocks?cursor=UUID | Own directional blocks only; 20-item page of account IDs |
| GET /api/safety/prior-conversations?cursor=UUID | Own inactive conversation IDs and match creation dates; no history/evidence |

Report: {kind: profile/message, category: harassment/spam/impersonation/underage/sexual_content/other, description: max 1000 (empty allowed), messageId?}. Message reports require a member conversation; omission of messageId attaches up to five latest incoming messages. Optional report on block/unmatch is atomic. Caller identity and subject/evidence resolve server-side. 400 invalid, 404 inaccessible/evidence unavailable, 409 reused ID conflict, 429 new-report rate exceeded. Same request ID/payload replays as 204 without repeating effects. All routes require bearer authorization and no-store. SignalR adds ConversationUnavailable(conversationId), without actor/reason. [Full safety, retention and revocation semantics](SAFETY.md).

## Prompt 8 additions

| Method/path | Behavior |
|---|---|
| GET /api/notifications/configuration | enabled and public projectId only; no credentials |
| POST /api/notifications/device | {installationId, secret, revision, provider: expo, projectId, platform: ios/android, enabled, token?}; bind current actor/session, 204 |
| GET /api/notifications/preferences | own {matches, messages}; both default false |
| POST /api/notifications/preferences | persist own match/message preferences, 204 |
| POST /api/notifications/resolve | {notificationId}; verifies recipient/current conversation, returns {conversationId} |

Bearer auth, no-store and inherited per-account request policy apply. Device payload maximum 4 KiB; other writes 1 KiB. Invalid metadata 400; installation proof/revision/token-owner conflicts 409; more than ten active devices 429; unconfigured provider registration 503; inaccessible notification target 404. No token/hash/proof/ciphertext/ticket is returned. Payload is only {notificationId, version: 1}, with generic lock-screen text. [Push protocol, provider setup and physical checks](PUSH.md).

## Prompt 11 additions — Account lifecycle & data controls

| Method/path | Behavior |
|---|---|
| POST /api/account/delete | In-app deletion with recent password check; immediately hides profile, revokes tokens/sessions/hub, deactivates matches, cancels push outbox, writes tombstone, queues purge worker; 204 |
| DELETE /api/account | In-app deletion alias with password check; 204 |
| GET /api/account/deletion-status | Own deletion status `{userId, state, requestedAt, completedAt}`; 200 |
| POST /api/account/discoverability-pause | `{paused: boolean}`; toggles profile visibility and bumps revision without losing matches or chat; 204 |
| POST /api/account/public-deletion-request | `{email: string}`; returns 202 Accepted without leaking whether account exists; enqueues verification token to registered address |
| GET /account/delete | Store-compliant public web page serving self-service deletion request form |

## Prompt 14 additions — Arena Bottle Game foundation & room model

| Method/path | Behavior |
|---|---|
| GET /api/game/current | Returns active game room for current authenticated user or 204 No Content |
| POST /api/game/queue | `{ capacity: 6 \| 8 \| 10 }`; enters matchmaking queue; finds or creates compatible room with exact 50/50 gender quotas, transitions room to `Starting` when quota full |
| GET /api/game/rooms | Lists open lobby rooms with quota progress; starting and playing rooms are strictly omitted |
| POST /api/game/rooms | `{ title?: string, capacity?: 6 \| 8 \| 10 }`; creates a new room with format quotas, creator joins atomically |
| GET /api/game/rooms/{id} | Returns room details; returns 404 `room_unavailable` for outsiders if room is in `Starting` or `Playing` state, or if viewer is incompatible with any active member |
| POST /api/game/rooms/{id}/join | Atomically verifies 18+ eligibility, profile completion, photo approval, reciprocal preference, single active room constraint, incompatibility exclusion (blocks, unmatches, active matches), and gender quota; returns 404 `room_unavailable` for non-lobby rooms or incompatible users |
| POST /api/game/rooms/{id}/leave | Leaves current room membership; room dissolves if empty; 200 OK |
| POST /api/game/rooms/{id}/dev-fixtures | Development only: seeds test fixtures (up to 3♀ + 3♂) to test lobby fallback quorum |

All game routes require bearer authorization and `Cache-Control: no-store`. See [GAME.md](GAME.md) for data model, concurrency, state machine transitions, and safety invariants.

## Prompt 15-17 additions — Arena Bottle Game real-time play, turns, questions, kisses & matches

| Method/path | Behavior |
|---|---|
| GET /api/game/rooms/{id}/snapshot | Full authorized room snapshot with recipient-specific redactions (hidden personal answers, hidden pending kisses, only spinner sees kiss target); 200 OK |
| POST /api/game/rooms/{id}/reconnect | Reconnects disconnected session within 60-second reservation grace period; 200 OK |
| POST /api/game/rooms/{id}/heartbeat | Refreshes active heartbeat timestamp; 200 OK |
| POST /api/game/rooms/{id}/spin | Current turn owner only; server-side RNG picks eligible candidate; persists round and angle; 200 OK |
| POST /api/game/rooms/{id}/rounds/{roundId}/questions/{qIndex}/answer | Pair members only; dual independent answer; locks answer and reveals only when both submit; 200 OK |
| POST /api/game/rooms/{id}/rounds/{roundId}/questions/{qIndex}/skip | Pair members only; suppresses answers from both players for this question; 200 OK |
| POST /api/game/rooms/{id}/rounds/{roundId}/kiss | Current turn owner only within 15s KissChoice deadline; sends private kiss to eligible opposite-gender member; 200 OK with SendKissResult |
| POST /api/game/rooms/{id}/rounds/{roundId}/kiss/skip | Current turn owner only; skips kiss within 15s window; 200 OK |
| GET /api/game/ai-consent | Returns current user's AI commentary consent status (`aiConsent`, `consentGivenAtUtc`, `disclosureText`); 200 OK |
| POST /api/game/ai-consent | `{ aiConsent: boolean }`; grants or revokes opt-in consent for AI commentary; 200 OK |
| GET /api/moderation/game-questions | Admin cookie + CSRF; lists curated Georgian questions |
| POST /api/moderation/game-questions | Admin cookie + CSRF; creates curated question with 3-4 options |
| PUT /api/moderation/game-questions/{id} | Admin cookie + CSRF; updates curated question text and options |
| DELETE /api/moderation/game-questions/{id} | Admin cookie + CSRF; deactivates curated question |

## Prompt 19 additions — Crystal Ledger & 25-Crystal Unlocks

| Method/path | Behavior |
|---|---|
| GET /api/game/wallet | Bearer auth; returns current user's crystal balance and last 20 transactions (`WalletBalanceDto`) |
| POST /api/game/wallet/dev-grant | Development/Testing only; `{ amount: number, idempotencyKey: string }`; atomically credits test crystals |
| GET /api/game/profiles/{targetUserId} | Bearer auth; returns `GameProfileDto`. If viewer has full entitlement (self, unlocked, or mutual match), returns complete dating profile; if unentitled, returns redacted preview (primary photo only, snippet bio, empty interests, empty goals, `UnlockPrice = 25`, `IsFullAccess = false`) |
| POST /api/game/profiles/{targetUserId}/unlock | Bearer auth; `{ idempotencyKey: string }`; atomically debits 25 crystals, creates `GameProfileUnlock`, creates `GameProfileViewNotice` for target. Revalidates blocks/unmatches. Replays debit 0 |
| GET /api/game/profiles/views | Bearer auth; returns array of view notices (`GameProfileViewNoticeDto[]`) for current user |
| POST /api/game/profiles/views/acknowledge | Bearer auth; marks unseen view notices as seen; 204 No Content |
| POST /api/matches/{matchId}/unlock | Bearer auth; `{ idempotencyKey: string }`; atomically debits 25 crystals, sets `HasChatEntitlement = true` on `DatingMatch`, unlocks chat for both participants. Concurrent calls debit once, second receives `already_open` with 0 debit. Discovery free match returns `already_open` with 0 debit |

## Prompt 20 additions — iOS/Android Consumable Crystal Store Purchases & Refunds

| Method/path | Behavior |
|---|---|
| GET /api/game/store/products | Returns available crystal packages including starter offer (`dating.crystals.100`, 100 crystals, ₾0.99 / $0.99 tier) |
| POST /api/game/store/purchase | Bearer auth; `{ platform: "apple" \| "google" \| "mock", productId: string, transactionId: string, purchaseToken: string }`; validates receipt, binds to user, idempotent replay returns existing balance (0 duplicate credit), prevents cross-account claim (409 Conflict), repays any `outstandingDebt` first, credits remainder to `balance`, records immutable ledger transaction; 200 OK with `StorePurchaseResult` |
| POST /api/game/store/refund | Webhook/Operator endpoint; `{ platform: string, transactionId: string, refundReason?: string }`; verifies original purchase, revokes crystals; if credits were already spent, sets `balance = 0` and increments `outstandingDebt` to preserve non-negative DB constraints; 200 OK with `StoreRefundResult` |

## Prompt 22 additions — Arena Bottle Game 18-Round Turn Quota, Automatic Spin, Target Selection & Post-Game Kisses

| Method/path | Behavior |
|---|---|
| POST /api/game/rooms/{id}/rounds/{roundId}/target | Spinner only during `SelectingTarget` phase within 15-second deadline; `{ targetUserId: UUID }`; server verifies candidate is active room member, opposite gender, and compatible; transitions round to `QuestionAnswering` with 15s deadline; 200 OK with `SelectTargetResult` |
| POST /api/game/rooms/{id}/rounds/{roundId}/target/skip | Spinner only during `SelectingTarget` phase; `{ idempotencyKey?: string }`; spinner skips choosing a partner/question round; server marks round `EndedEarly` (reason: `target_skipped`), rotates turn to next member or completes game if 18 rounds reached; 200 OK with `SkipTargetResult` |
| POST /api/game/rooms/{id}/post-game-kiss | Active member only after room ends (`room.State == Ended`); `{ recipientUserId: UUID, idempotencyKey: string }`; sends post-game kiss; if reciprocal, creates `DatingMatch` with `Origin = GameArena` and `HasChatEntitlement = false`; if non-reciprocal, records pending `GameKiss` and synchronizes `DiscoveryDecision` ("like") with note "დავიმეჩე ბოთლის თამაშში"; 200 OK with `PostGameKissResult` |

## Prompt 23 additions — Profile Views History & Match/Message Navigation Split

| Method/path | Behavior |
|---|---|
| POST /api/matches/views/{targetId} | Bearer auth; records a profile view idempotently. If viewer previously viewed target, updates `ViewedAt` to current timestamp; otherwise inserts new `UserProfileView`. Self-views are ignored (200 OK). Blocks/unmatches are verified server-side. |
| GET /api/matches/views/viewed-you | Bearer auth; returns list of `ProfileViewSummary` (`userId`, `displayName`, `age`, `city`, `bio`, `gender`, `relationshipGoal`, `interests`, `photo`, `photos`, `viewedAt`) for users who viewed the current user's profile, ordered by `viewedAt` descending. Excludes blocked or unmatching accounts. Authorized photos are attached. |
## Prompt 24 additions — Arena Table Gifts (1 to 500 Crystals) & Profile Table Statistics

| Method/path | Behavior |
|---|---|
| GET /api/game/gifts/catalog | Returns available gift catalog items starting from 1 crystal up to 500 crystals (`GiftCatalogItemDto[]`: Rose 1 💎, Coffee 5 💎, Chocolate 15 💎, Cocktail 30 💎, Bouquet 50 💎, Teddy Bear 100 💎, Diamond 250 💎, Royal Crown 500 💎). |
| POST /api/game/gifts/send | Bearer auth; `{ recipientUserId: UUID, giftId: string, roomId?: UUID, idempotencyKey: string }`; validates safety blocks/unmatches, disallows self-gifting (400), atomically checks and debits crystal wallet balance, records `GameGift` entity and `CrystalTransaction` (`GiftSent`), logs audit; returns `SendGiftResult`. |
| GET /api/game/gifts/history | Bearer auth; returns `UserGiftsDto` containing up to 50 received gifts and 50 sent gifts with sender/recipient details, primary photo, counts, and crystal totals. |
| GET /api/game/profiles/{targetUserId} / POST /api/game/profiles/{targetUserId}/unlock | When full profile access is unlocked (`isFullAccess == true`), `GameProfileDto` exclusively populates `kissesReceivedCount` and `giftsReceivedCount`. This small report is not exposed on any discovery, chat, match, or general profile view endpoints. |
| GET /api/game/rooms/{id}/snapshot | `GameRoomSnapshot` returns `recentGifts` array (`GameGiftEventDto[]`) for gifts sent at the table in the last 25 seconds, driving real-time table flying gift animations for all members. |
| SignalR `/hubs/game` | Broadcasts `GameGiftSent` to group `game_room_{roomId}` when a gift is sent with `roomId` present, allowing instant real-time flying gift animations. |

## Prompt 25 additions — Premium Subscriptions & Dating App Gating Flow

| Method/path | Behavior |
|---|---|
| GET /api/premium/packages | Returns active Premium subscription packages with exact pricing: 2 კვირა = 2.90 GEL (`two_weeks`, 14 days), 1 თვე = 4.90 GEL (`one_month`, 30 days, popular), 3 თვე = 10.00 GEL (`three_months`, 90 days, eco), ულიმიტო = 40.00 GEL (`lifetime`, permanent). |
| GET /api/premium/status | Bearer auth; returns `PremiumStatusDto` (`hasPremium`, `activePackageId`, `startedAtUtc`, `expiresAtUtc`, `isLifetime`, `packages`). |
| POST /api/premium/subscribe | Bearer auth; `{ packageId: string, platform?: string, transactionId?: string, idempotencyKey?: string }`; verifies package id, activates or extends `UserSubscription` in database, returns `SubscribeResultDto` with updated status. |
| GET /api/matches/requests | Bearer auth; enforced server-side premium gating: if caller does NOT have active premium, all incoming suitors are masked (`isBlurred: true`, `displayName: "დაფარული მოწონება"`, `photo: null`, `photos: null`, `bio: ""`, `age: 0`, obfuscated ID) preventing client identity interception. If caller has active premium, full unblurred candidate cards (`isBlurred: false`) and photos are returned. |

## Prompt 26 additions — Telegram Stars Payments & Invoicing

| Method/path | Behavior |
|---|---|
| POST /api/payments/telegram-stars/invoice | Bearer auth; `{ itemType: "subscription" | "crystals", itemId: string }`; resolves package and star amount (Subscriptions: 50, 90, 180, 750 Stars; Crystals: 25, 100, 200 Stars); calls Telegram Bot API `createInvoiceLink` (or returns dev mock link if bot token is unconfigured); returns `{ invoiceLink, starsAmount, itemType, itemId, payload }`. |
| POST /api/payments/telegram-stars/verify | Bearer auth; `{ payload: string, telegramPaymentChargeId?: string }`; verifies caller matches `userId` embedded in payload, fulfills subscription or crystal credit, returns updated `PremiumStatus` and `WalletBalance`. |
| POST /api/payments/telegram-stars/webhook | Public / Telegram Bot webhook; handles `pre_checkout_query` (replies `answerPreCheckoutQuery`) and `successful_payment` updates to fulfill orders. Also registers/updates `TelegramSubscriber` for any `/start` or user message update. |

## Prompt 56 additions — Telegram Event Notifications & Admin Panel Broadcast

| Method/path | Behavior |
|---|---|
| GET /api/moderation/telegram-stats | Admin cookie + CSRF; returns `TelegramStatsDto` (`totalSubscribers`, `activeSubscribers`, `linkedUsers`, `lastActiveAt`). Counts all users who interacted with the bot or authenticated via Mini App. |
| POST /api/moderation/broadcast-telegram | Admin cookie + CSRF; `{ message: string (1-4000 chars), buttonText?: string, webAppRelativePath?: string }`; dispatches broadcast notification with inline web_app button to all active subscribers via throttled worker (30 msgs/sec); auto-deactivates subscribers if bot is blocked (403); returns `TelegramBroadcastResult` (`totalSubscribers`, `targetedSubscribers`, `successCount`, `failedCount`, `blockedCount`, `completedAtUtc`). |

## ARENA „დღეს მინდა…“ — Prompt 2 additions

| Method/path | Behavior |
|---|---|
| GET /api/today-plans | Bearer auth; returns `TodayPlanFeedPageDto` with active open plans (`State == Open`, `ExpiresAtUtc > now`). Supports filters: `city`, `activity`, `day` (`today`/`tomorrow`), `cursor`, `limit` (max 20). Excludes blocked users and own responses. |
| GET /api/today-plans/{id} | Bearer auth; returns `TodayPlanDetailDto`. Re-verifies expiration and safety block exclusions. |
| POST /api/today-plans | Bearer auth; `{ city, district?, activity, title, description?, startsAtUtc, expiresAtUtc, budgetAmount? }`; enforces valid activity, max 48-hour planning horizon, min 15-min duration, and budget (0-5000 GEL); returns created `TodayPlanDetailDto`. |
| POST /api/today-plans/{id}/cancel | Bearer auth; author only; transitions plan to `Cancelled` and closes all `Pending` responses atomically. |
| GET /api/today-plans/my | Bearer auth; returns all plans created by the caller ordered by creation date descending. |
| GET /api/today-plans/my-responses | Bearer auth; returns all responses sent by the caller with plan preview and current state (`Pending`, `Accepted`, `Rejected`, `Withdrawn`, `Closed`). |
| POST /api/today-plans/{id}/responses | Bearer auth; applicant only; `{ message? }`; enforces 1 response per plan, excludes author self-apply, checks daily response quota in `Asia/Tbilisi`, returns `TodayPlanMyResponseDto`. |
| POST /api/today-plans/{id}/responses/{responseId}/withdraw | Bearer auth; applicant only; transitions response from `Pending` to `Withdrawn`. Re-applying is disallowed. |
| GET /api/today-plans/{id}/applicants | Bearer auth; author only; returns list of `TodayPlanApplicantDto` with profile details, bio, photo, message, and state. |
| POST /api/today-plans/{id}/responses/{responseId}/accept | Bearer auth; author only; atomic companion selection; transitions plan to `Matched`, selected response to `Accepted`, closes all other `Pending` responses, links or creates free `DatingMatch` and `Conversation` (`HasChatEntitlement = true`); returns `AcceptPlanResponseResult`. |
| POST /api/today-plans/{id}/responses/{responseId}/reject | Bearer auth; author only; marks response `Rejected`. Plan remains Open for other applicants. |

## ARENA „დღეს მინდა…“ — Prompt 3 additions (Limits & Premium)

| Method/path | Behavior |
|---|---|
| GET /api/today-plans/limits | Bearer auth; returns `TodayPlanLimitsDto` (`hasPremium`, `activePlansCount`, `activePlansLimit`, `canCreatePlan`, `dailyResponsesUsed`, `dailyResponsesLimit`, `dailyResponsesRemaining`, `canApply`, `resetsAtUtc`, `timeZone: "Asia/Tbilisi"`). Evaluates user limits against existing `IPremiumService`: Free tier allows 1 active plan and 3 responses/day; Premium tier allows 3 active plans and 10 responses/day. Quota resets daily at midnight (00:00) in `Asia/Tbilisi`. |
| POST /api/today-plans (limits enforced) | Atomic user row lock (`SELECT "Id" FROM "AspNetUsers" WHERE "Id" = @id FOR UPDATE`) serializes concurrent requests and blocks creation with `403 active_plans_limit_reached` when active plans (`State == Open || State == Matched && ExpiresAtUtc > now`) reach the user's tier limit (1 Free / 3 Premium). When Premium expires, existing plans are preserved, but new creations are blocked until active count < 1. |
## ARENA „დღეს მინდა…“ — Prompt 4 additions (Free Chat & Notifications)

| Method/path | Behavior |
|---|---|
| POST /api/today-plans/{id}/responses/{responseId}/accept (chat & notifications) | Transitions plan to `Matched`, sets `SelectedCompanionUserId`, and closes all other pending responses. Finds or creates `DatingMatch` with `HasChatEntitlement = true` and `Origin = "TodayPlan"` (free messaging for both users without crystals/paywalls). Idempotently appends initial context message (`📍 [დღეს მინდა: {title}]` + applicant message, `ClientMessageId = responseId`). Enqueues `match` push notifications for mobile devices. Dispatches Telegram notification to applicant with inline button linking to chat (`/messages`). Failures in notifications do not rollback or block transaction. |
| POST /api/today-plans/{id}/responses (author notification) | After recording response and updating daily quota, dispatches Telegram notification to plan author with applicant name, response note preview, and inline button linking to `/today-plans` applicants view. |
| POST /api/today-plans/{id}/cancel (companion notification & chat history preservation) | When a `Matched` plan is cancelled, dispatches Telegram cancellation notice to the selected companion. Chat history (`DatingMatch`, `Conversation`, `ChatMessage`) is permanently preserved and remains fully accessible to both participants. |
| GET /api/today-plans/{id} & GET /api/today-plans/my-responses (chat links) | Returns `conversationId` for accepted companion and author, allowing direct navigation from plan or response card directly to the active conversation. |
