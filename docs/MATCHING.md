# Swipe and mutual matching (Prompt 5)

## Run and scope

Run local services, `./scripts/dev.ps1 migrate`, `./scripts/dev.ps1 api`, and `npm.cmd run mobile:start`. Use two verified, complete, visible adult accounts with approved photos and reciprocal discovery preferences. In explicit local development, `./scripts/dev.ps1 api -AutoApprovePhotos` approves NEW photos. There are no production seed profiles.

Discover supports horizontal like/pass gestures and labeled buttons. A mutual server-confirmed like shows a match modal. Matches lists real active matches in pages of 20. No chat UI, message endpoints, SignalR or push were implemented; Prompt 6 is not started. Conversations here are persisted identities only. Internal block/unmatch primitives exist to enforce and test matching concurrency; public safety routes/UI remain Prompt 7.

## Transaction and invariants

The authenticated subject owns the decision. POST /api/swipes accepts only requestId (nonempty UUID), targetId and kind (like/pass). Both accounts must currently satisfy the shared discovery policy INSIDE the transaction: adulthood, active/verified, visible/complete/approved photos, reciprocal age/gender/city/radius, no block in either direction, no previous decision or unmatch.

Every directed decision has a composite primary key (UserId,TargetId), check constraints for self/kind, and a database trigger rejecting UPDATE. MVP decisions are final. No rewind or implicit rematch. Two valid reciprocal likes create one canonical ordered UUID pair, one conversation and one match event in the SAME transaction. Unique indexes enforce pair, conversation.MatchId and event.MatchId. A failed conversation/event write rolls back the entire new decision and match.

PairSynchronization locks BOTH AspNetUsers rows with SELECT ... ORDER BY Id FOR UPDATE, using PostgreSQL UUID order. All pair writers (like, internal block, internal unmatch) acquire these locks before reading domain state; profile/auth writers already acquire their one user row. The database's READ COMMITTED snapshots then see the earlier reciprocal commit after waiting, preventing both likes from missing each other. This deliberately serializes different pairs sharing an account; an MVP throughput tradeoff. There is no in-memory backend lock. A five-second lock timeout rolls back the request; clients retain the same pending intent for retry.

Block atomically writes its directed block and closes any pair match. Unmatch closes the match and stores the durable exclusion. A like that wins first can briefly create a match, but the later block closes it before the block commits. A block that wins first makes the like ineligible. Public reads/receipts/notices recheck active accounts, blocks and unmatches. Closed identities are retained; no additional conversation/event is created on replay. Future safety/lifecycle/chat writers must use this synchronization order and authorize against Match.Active; direct uncoordinated table writes are not a supported mutation interface.

## Idempotency and ambiguous responses

SwipeReceipt is unique by (UserId,RequestId) AND (UserId,TargetId). The same request/payload replays the original accepted decision, with a match ID suppressed if no longer available. A different payload with an existing request ID is 409 request_id_reused after validating/locking the pair; an invalid/missing target may instead be 400/404. A NEW request ID for an already decided pair returns 409 decision_final, even if its kind is unchanged. A pass can never become a like.

GET /api/swipes/{requestId} reads only the caller's receipt. Unknown/other-account IDs return 404. Receipt reads do not mutate. A 404 is not proof an in-flight write can never commit: the client resends the SAME ID and payload. If A's original like preceded B's like, A's receipt remains its original no-match result; A receives the later match through its durable notice.

The mobile coordinator persists a small account-bound SecureStore intent BEFORE any request. It disables competing actions while a request is pending. Timeouts/offline/401/429/5xx preserve it; bounded 15-second transport timeout does not discard the decision. Focus polling/manual retry first checks the receipt, then resends that same intent only if unknown. Definitive validation/conflict/unavailable errors clear pending state and refresh the feed. A mismatched response is never accepted.

The card follows the gesture optimistically and dims during submission; server confirmation removes it. Cancellation or sub-threshold motion does not submit. The pending state never silently becomes another action. Cache/query keys and API client callbacks are account-bound. Journals persist across restart/logout for reconciliation on returning to the SAME account; they are never replayed into another account or backend origin. SecureStore contains IDs/kind, no cached profile, coordinates, access token or photo. Uninstall/local storage removal can remove the device journal; server pair constraints still prevent changing an accepted decision.

## Transactional outbox and modal deduplication

MatchEvent is inserted with the match. A BackgroundService claims up to 20 due events using FOR UPDATE SKIP LOCKED. Database row locks are the lease and release on process/connection failure. Its consumer inserts one MatchNotice per (EventId,UserId), using ON CONFLICT DO NOTHING, then marks the event processed in the same transaction. A crash/retry cannot create a second notice or erase SeenAt.

Per-event savepoints roll back failed delivery writes. Safe failure codes and attempt counts are persisted; exponential retry delay is capped at 300 seconds, with dead-letter status after 8 failures. Infrastructure failures before durable updates back off at the worker level (10..300 seconds) and do not discard work. Database access is required for recovery.

Authorized operators can inspect the read-only MatchOutboxDeadLetters SQL view (bounded SELECT recommended). After fixing the cause, explicitly reset Attempts=0, DeadLetterAt=NULL and NextAttemptAt=now() for the reviewed event ID. No public retry endpoint or unauthenticated operational view exists. Raw exception text/payloads are never persisted or logged.

GET /api/matches/notices returns up to 20 currently available unseen events. POST /api/matches/{id}/acknowledge upserts only the member's own notice, even before the worker delivers; later processing cannot resurrect it. Receipt and event paths use the SAME match ID for modal deduplication. Each shown ID gets its own tiny account-specific SecureStore claim, then server acknowledgement. Failure to acknowledge retries on later polls. Local claims survive restart and avoid a large SecureStore value. A crash after claim but before rendering can suppress that modal on this device; the durable Matches list remains available. Exactly-once visual display across device loss/multiple devices is not promised.

No notification is invented from a gesture or optimistic state. Events are polled only while Discover is focused. Existing matches do not depend on continuing to satisfy changed discovery preferences, but inactive/blocked/unmatched pairs are hidden. GET /api/matches uses deterministic UUID keyset ordering, 20 rows plus one lookahead, and a single projected SQL read. It is a live list; refresh restarts pagination.

## Verification boundaries

Real PostgreSQL tests cover simultaneous reciprocal/replayed/opposite likes, exact unique identities, immutable constraints, transaction rollback, current eligibility, block and unmatch races, receipt ownership, match-list authorization, outbox competing consumers/replay/acknowledgement/backoff/dead-letter recovery. Mobile tests cover durable ambiguous intent, same-ID restart recovery, repeated gestures, storage failure, mismatched responses, modal claim replay, button accessibility and gesture cancellation/direction.

Jest mocks native gesture/animation/SecureStore boundaries. Real iPhone/Android animation, screen-reader hit targets, interrupted storage writes, app kill/restart, connectivity loss after server commit and secure storage lifecycle remain device checks. See STATUS.md for actual results; do not infer native verification from tests or Expo export.

Synchronization references: [PostgreSQL row locks](https://www.postgresql.org/docs/17/explicit-locking.html), [SKIP LOCKED](https://www.postgresql.org/docs/17/sql-select.html). Gesture/native versions follow [Expo Gesture Handler compatibility](https://docs.expo.dev/versions/latest/sdk/gesture-handler/).
