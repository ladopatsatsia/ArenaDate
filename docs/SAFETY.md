# Safety protocol (Prompt 7)

## Pair semantics

Unmatch permanently deactivates the existing match, adds the canonical UnmatchedPair exclusion, hides normal conversation history/read/send and prevents rematching in this MVP. Both members see only a generic unavailable conversation. Either member can subsequently block or report.

Block is directional and private: only its author can list/remove it. Either direction excludes both parties from discovery, prevents private media access and closes an existing match. Block does not tell the other account who acted or why. Unblock removes only the caller's block; the other direction remains effective. It never reactivates a closed match/conversation, removes an unmatch marker or resets final swipe decisions. A never-matched pair without a final swipe may become discoverable again after all blocks are removed and all current eligibility rules pass.

Report alone does not close a match or change discovery. Optional report plus block/unmatch is one database transaction; invalid evidence or report rate failure rolls back the whole action. Clients must not show success on an ambiguous network result.

## Authorization and ordering

Safety commands resolve the other participant from the server's conversation membership. A supplied target must agree. Without a conversation, block/report requires a current discovery candidate, a prior match, a profile the caller already swiped, or the caller's own existing block. Own message evidence and nonmember/foreign conversation evidence are rejected. An unavailable target returns a generic error.

Every safety write takes the same ordered PostgreSQL user row locks used by likes, sends and profile mutations. The locks remain held through commit. A send/like racing revocation can commit first; a write acquiring the locks after revocation commits cannot create a message or reactivate the pair. Closing the match and enqueueing its revocation event commit atomically.

SignalR uses a one-conversation subscription registry rather than SignalR groups. Registration now occurs inside the authorized pair-lock transaction, closing the subscribe-versus-block race. A committed close immediately evicts both participants' affected subscriptions. A separate connection-address registry, removed on disconnect, is retained only to deliver the generic ConversationUnavailable(conversationId) notification with the persisted chat outbox's claims, backoff and dead-letter handling. It grants no access. Every hint destination checks current pair and session authorization; stale queued change events also become generic unavailable hints. Each hub invocation reauthorizes. One API process is supported.

Private media grants and redemption already recheck both block directions, unmatch and current discovery eligibility. Owner/moderator access remains explicitly authorized for their respective purposes. Blocked users cannot redeem previously issued viewer-bound tickets.

Already transmitted bytes, screenshots and a malicious client's copies cannot be recalled. In-flight reads authorized before commit may finish afterwards. Offline clients cannot receive immediate eviction notifications; REST revalidation on resume/reconnect discovers revocation. Push and background notifications are NOT implemented in Prompt 7.

## Reports and retention

Allowed categories: harassment, spam, impersonation, underage, sexual_content, other. Description is optional text up to 1,000 UTF-16 units; empty is accepted, null/NUL rejected. Request body is bounded at 16 KiB. Profile evidence snapshots public name/bio/city/gender/interests/goal and approved photo IDs from the database; it never copies email, birth date, precise/coarse coordinates, storage keys or client-supplied evidence. Photo bytes are not copied into a report, so a later photo deletion can leave only its ID and the profile text snapshot.

Message evidence copies the specified incoming message's ID, text, timestamp and sequence. Without a message ID, a conversation-scoped message report snapshots at most five latest incoming messages, as stated in the UI. This permits a meaningful report after unmatch without restoring history. No messages means evidence_unavailable, not fabricated evidence.

The caller's prior-conversations route exposes only conversation ID and original match creation date, in 20-row UUID cursor pages. The mobile safety center shows a short stable identifier/date. The blocked list exposes only accounts blocked by the caller. Neither route returns message text, current profile content, evidence, reporter identity or the reason for closure.

Description and evidence are protected with the existing ASP.NET Data Protection key ring under a distinct purpose, Dating.Safety.Evidence.v1. Report IDs, reporter/subject IDs, category and timestamps are private server metadata. No public evidence/report-read endpoint exists. Moderator review belongs to the later Angular moderation stage; Prompt 7 does not implement it or claim reports are already reviewed. Protect the persistent key ring and database/backups with operator access controls; preserve keys needed for all retained ciphertext.

Live report rows (including description/evidence and identities) expire 180 days after creation. SafetyCleanup deletes up to 500 expired reports per 10-minute pass, starting on service startup, with generic failure logging and retry. Thus expiry is eligibility for deletion, with bounded scheduling/backlog delay. Non-content command receipts expire after 365 days. Reports deliberately have no cascading user/profile/message foreign key deletion: deleting source content must not silently erase evidence before its policy expiry. Account-deletion orchestration is a later stage, not implemented here.

Backups, if enabled by an operator, must have at most 30-day retention and restricted access; after a restore, run expiry cleanup before serving requests. No backup service is configured or tested here. These are engineering defaults, not a legal compliance claim. Purging reports does not purge the original chat database; broader chat/account retention must be resolved with account deletion. No indefinite evidence retention or legal-hold workflow exists in this stage.

## Retries and abuse limits

POST /api/safety requires a caller-generated UUID requestId. Database uniqueness on actor/requestId and a hash of the normalized bound payload make a same-payload retry a no-op, even after a subsequent unblock. Reusing the ID for a different payload returns 409. The receipt and all effects commit together. Clients must not retry an old command beyond the 365-day receipt window.

At most five new reports per actor in a rolling 24 hours, checked under the actor/pair lock in PostgreSQL. Idempotent replay does not consume another report. The inherited per-account HTTP policy also limits requests to 120/minute/process. Other accounts cannot inspect report counts or receipts.

The confirmation modal freezes its exact payload/ID after an ambiguous failure and retries it unchanged while mounted. Definite validation/authorization/conflict/rate errors allow correction. Modal pending state is not persisted across process death; a later manually submitted report can be a new report and is still subject to the server limit.

## Mobile state

Discover, Matches and Chat expose safety actions; incoming messages offer message-specific reporting. The protected Profile -> Safety page lists own blocks and previous conversations, without reopening chat. Block/unmatch confirmation explains permanent match closure. Optional report can be included in either action.

Confirmed local closure, ConversationUnavailable, or chat REST 403/404 sets a revocation guard before clearing messages, composer draft, pending message journal, read cursors and cached account queries. In-flight history/send results cannot repopulate the revoked screen. Storage writes are ordered so revocation racing an unfinished journal write ends with deletion and cannot send afterwards. The live connection stops. Native storage deletion can fail and cannot revoke previously stored bytes. The chat screen surfaces deletion errors; real keychain failure/retry behavior remains a device verification requirement. No successful deletion is claimed on error. Other screens re-fetch authorized data on focus. Already received device data remains subject to the limits above.

## Verification

SafetyTests uses isolated real PostgreSQL databases and actual TestServer SignalR LongPolling handshakes. It covers both block directions, own-only block lists, reciprocal blocks and independent unblocks, no restored conversation, old receipt replay, report-at-unmatch and afterwards, own/nonmember evidence denial, protected server evidence, report atomicity/rate/retention, send/block and like/block races, subscribe/block registration, existing socket eviction and old media-ticket denial in both directions.

Mobile tests use native/transport mocks to cover report-and-block confirmation, unchanged-ID retries, account isolation, cache invalidation, revoked composer/history, late responses, durable pending-write races and live reconnect cancellation. These are not physical-device results. See STATUS.md for exact commands and unverified device/provider checks.
