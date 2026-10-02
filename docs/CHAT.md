# Persisted text chat (Prompt 6)

## Run and scope

Apply migrations with `./scripts/dev.ps1 migrate`, run `./scripts/dev.ps1 api` and `npm.cmd run mobile:start`. Create a real mutual match using two verified eligible accounts. Open Matches, then Open chat. The match list includes an authorized last-message preview and unread count.

Only text chat is implemented. No attachments, push, public block/report UI or Prompt 7 work. Prompt 5 was completed and reported first; its exact checks are archived in STATUS.PROMPT5.md.

## Source of truth and authorization

POST /api/conversations/{id}/messages is the ONLY message-write path. The hub cannot write messages. Every REST history/send/read operation locks the same ordered user pair as match/block/unmatch, then checks actual active conversation membership, both current accounts, blocks and unmatched exclusions. Repeat sends reauthorize before returning their old message.

ChatHub.Subscribe/Unsubscribe accepts only a conversation ID, never a user ID. Each invocation validates its cached token's session/expiration against PostgreSQL under the pair locks and checks current membership. Delivery never trusts subscription/group membership alone: each destination connection gets a fresh pair/account/block and session/expiration check. The registry contains connection metadata only; it is not the authority for access.

Production API/hub requests require HTTPS (health endpoints are excluded). HTTP is permitted only for explicit Development/Testing. Release mobile URL configuration also requires HTTPS. Deploy with Kestrel TLS or configure a separately reviewed, trusted proxy forwarding setup; the app does not trust arbitrary X-Forwarded-Proto headers. Actual certificate/ingress verification is NOT RUN here.

## Persistence, retries and ordering

A message has a server UUID, authenticated sender, conversation, clientMessageId, exact text, server UTC timestamp and monotonically increasing per-conversation sequence. Unique indexes enforce (SenderId,ConversationId,ClientMessageId) and (ConversationId,Sequence). Pair locking serializes allocation, including reciprocal sends and safety mutations. Timestamp ties do not determine order.

Identical retries return the SAME persisted DTO. Reusing an ID with different text is 409. Blank/NUL text, empty client IDs or text over 2,000 UTF-16 code units is rejected. HTTP bodies are bounded. New messages are limited to 30/minute per sender in PostgreSQL under the sender lock, across conversations; retries do not consume that new-message allowance. A process-local 120/minute account request policy also protects history/hub traffic.

The message, conversation sequence increment and ChatEvent are committed atomically. A failed outbox insert rolls all of them back. Mobile creates and persists the intent before sending, keeps the same ID/text after timeout or ambiguous error, and retries it explicitly. The composer allows one pending message per conversation. A storage failure prevents sending. Failed/uncertain text remains visible; it is not silently replaced with a new action.

## History, previews and reads

GET /api/conversations/{id}/messages returns the latest 50 in ascending sequence order, nextBefore and current own/peer read sequences. before fetches earlier rows; after fetches ascending catch-up rows with nextAfter. At most 50 plus one lookahead are queried. before and after cannot be combined; negative/unknown query inputs are rejected. Sequence DTOs are decimal strings, avoiding JavaScript integer precision loss.

Read requests accept a MESSAGE UUID, not a trusted raw sequence. The server verifies that message belongs to the authorized conversation, then advances the caller's cursor only if larger. Concurrent/stale receipts never move it backward. Unread counts include only peer messages after the caller's cursor. Match-list preview/unread projection is a bounded SQL query, not one query per match.

The mobile list renders plain Text, uses stable server IDs, merges HTTP/history results by ID and orders by BigInt sequence. It has older pagination, a newest button and an in-memory 500-message window; older/newest navigation can reload other persisted ranges. No plaintext query cache is persisted. Visible message callbacks advance reads; merely receiving a socket hint does not mark text read. A pending bubble is deduplicated by sender/client ID when history wins the HTTP-response race.

## SignalR as a hint

Official @microsoft/signalr 10.0.11 connects to /hubs/chat using LongPolling and bearer HEADERS. This is an intentional SignalR transport choice: no access token in URL/query strings and no browser/native WebSocket header ambiguity. Negotiation is authenticated. Receive size is 4 KiB, invocation concurrency is one and connections close at authentication expiration. Detailed hub errors and client logging are disabled.

A hint contains only the conversation ID, not message text, sender, timestamp or sequence. On Subscribe, reconnect and app resume, the client fetches persisted history and follows after cursors to fill gaps. Duplicate/out-of-order hints therefore cannot duplicate messages. The catch-up watermark is advanced ONLY by fetched history, so a racing HTTP response with a higher sequence cannot skip unseen peer messages. Token acquisition goes through the existing account-bound SessionManager with refresh single-flight and stale-generation protection.

Connections run only while the chat screen is focused AND the app is active. Background/navigation cleanup stops them. Initial/reconnect failure backs off from 1 second to a 30-second cap; each attempt uses a new connection so an old pending start cannot close the current one. A foreground 30-second history fallback also recovers lost hints. No background socket continuity is assumed.

## Outbox and operations

ChatEvent is claimed with FOR UPDATE SKIP LOCKED, one event per transaction and at most 20 per worker tick. Pair locks remain held through the bounded hint send; no user data is sent to an invalid connection. Process death releases the DB claim. A send can succeed before a crash/rollback, so consumers tolerate repeated hints.

Delivery failures use persisted exponential backoff capped at 300 seconds and dead-letter after 8 attempts. Infrastructure failures back off separately without discarding events. Operators inspect the read-only ChatOutboxDeadLetters SQL view and, after correcting a cause, reset only a reviewed event's Attempts, DeadLetterAt and NextAttemptAt. No public operator endpoint exists. No exception payload/message content is logged.

When no valid connections exist the event can be marked processed: history remains authoritative and reconnect catches up. This MVP is one API instance. Multi-instance deployments require a reviewed connection-routing/backplane design before rollout; a worker on another instance cannot see this process's subscription registry.

## Actual storage protection

This is NOT end-to-end encrypted chat. Authorized API/database operators can read PostgreSQL message text. At-rest server protection requires operator-controlled disk/volume and backup encryption, least-privilege database access and verified retention/deletion procedures; external encryption/backups have NOT been verified here. TLS protects configured transport, not database contents.

Unconfirmed outgoing text is stored in account/conversation-specific SecureStore chunks (up to 400 Unicode code points per chunk), with an origin-bound manifest written only after all chunks. This avoids oversized native keychain values and preserves surrogate pairs. Confirmed text chunks are removed. A crash before the manifest cannot have sent a message; small orphan chunks may remain until the same journal is reused/cleared. Device uninstall/keychain behavior and comprehensive account deletion belong to their device/lifecycle verification stages.

## Verification

Real PostgreSQL tests exercise concurrent duplicate/distinct sends, exact sequence ordering with equal timestamps, conflict reuse, lost response retry, history/catch-up gaps, read-cursor ownership/monotonicity, previews/unread, size/rate limits, transactional rollback, unmatch racing send, current session/block state and actual SignalR negotiation/JSON handshake/invocation/hint delivery. Stale subscription tests explicitly cover block, revocation, inactivity and expiry.

Mobile tests exercise persisted retries, bounded deduplicated history, large exact sequence values, reconnect/backoff/background races, Unicode journal chunks/account/origin isolation and the real composer lost-response/retry flow. Native socket/keyboard/keychain APIs are mocked in these tests. Device, signed native, external TLS and backup checks are listed separately in STATUS.md.

Official references: [SignalR authentication and cached principal behavior](https://learn.microsoft.com/en-us/aspnet/core/signalr/authn-and-authz?view=aspnetcore-10.0), [JavaScript client and reconnect](https://learn.microsoft.com/en-us/aspnet/core/signalr/javascript-client?view=aspnetcore-10.0).
