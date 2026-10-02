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
| POST /api/account/confirm-deletion | `{email: string, token: string}`; validates protected token within 24h lifetime and executes deletion; 204 |
| GET /account/delete | Store-compliant public web page serving self-service deletion request form |

