# Push notifications (Prompt 8)

## Delivery and privacy

Expo Push Service is the configured transport to APNs and FCM. The server uses its HTTPS send/receipt API; mobile uses Expo Notifications in a development/native build. Push is disabled by default until the owner's project and credentials are configured. Registration then returns 503 rather than pretending it worked.

New mutual matches enqueue one delivery per eligible registered device of each member. New messages enqueue only for the recipient. Enqueue happens in the authoritative match/message transaction; retrying the same like/message does not create another delivery. Notifications are not backfilled to newly registered devices. The database match/chat remains authoritative.

Both account preferences default off. Lock-screen text is always the generic English “You have a new match.” or “You have a new message.” No name, message body, photo, conversation ID or account ID is in the payload. Only {notificationId, version: 1} is included. Provider TTL is 600 seconds. Foreground OS banners, sounds and badges are suppressed; authorized hints refresh the match list.

External delivery is at-least-once and best-effort. Database event/device/binding uniqueness prevents accidental enqueue duplicates, but a provider acceptance followed by a database crash can cause another visible notification. Provider acceptance is not proof of display or user receipt. Already handed-off alerts cannot be recalled after logout, preference changes, block or unmatch.

## Registration and ownership

Bearer-authenticated registration binds installation ID to the actor and the validated sid claim. No caller user ID is accepted. The API validates provider=expo, the configured project UUID, ios/android platform, positive revision, 256-bit installation proof format, token syntax/length and a maximum of ten active installations per account. An Expo token is opaque: these metadata checks are not independent device/project attestation; actual provider credentials and physical verification remain necessary.

Each installation has a random ID and random 32-byte secret stored in OS-backed SecureStore, scoped to API origin. Only the secret hash is stored server-side. The token is held transiently on mobile; server delivery storage is AES-256-GCM with a random nonce and installation ID as associated data. A SHA-256 hash supports unique lookup. Token ciphertext, hashes, proof, provider tickets and secrets are never returned by response DTOs or logged. The authenticated device request necessarily carries the token/proof over the protected transport. Typed HttpClient logging is removed.

Registration writers take a PostgreSQL advisory lock, then ordered old/new owner user locks. An existing installation requires its proof. Tokens cannot be claimed by another installation ID. Command revisions reject delayed older-account requests. A separate binding revision changes only on actual owner/session/token/platform/project/active-state changes, so ordinary same-token refresh does not cancel queued notifications.

A new account rebinds the installation even with preferences off, without asking notification permission; this retires the prior ownership. Native registration and preference operations are serialized to prevent a stale background refresh undoing a deliberate enable. Token changes and foreground resume refresh registration. Permission denial deactivates the installation before reporting that result. Same-ID/same-revision retries are accepted only for the same bound request; higher revisions allow safe retries after ambiguous network results.

Confirmed logout/logout-all, password reset and refresh-family replay revoke the associated registrations and clear ciphertext in the auth transaction. Delivery also checks the current session expiry/revocation. Offline local logout cannot immediately reach the server: a generic queued alert may still arrive until remote revocation, rebinding or session expiry. This does not authorize opening a former account's conversation.

The installation proof intentionally survives normal logout for account switching. If its SecureStore record is lost while the provider reuses exactly the same token, registration fails closed with installation_conflict rather than allowing an unproven takeover. Recover using the retained installation or an owner-reviewed revocation/reset; do not delete arbitrary database ownership rows or paste push tokens into support logs. Reinstallation/backup behavior remains a physical-device check.

## Outbox and operations

PushDelivery uniqueness: (eventId, kind, deviceId, deviceRevision). A worker claims one due row with FOR UPDATE SKIP LOCKED, holds the ordered pair/device locks, and rechecks active match, both accounts, blocks/unmatch, recipient membership, current device binding/project, live session and current preference before provider delivery. Holding locks across a bounded three-second provider call ensures a revocation committed first prevents a later send. Lock waiting and provider calls remain bounded; the supported deployment is one API instance.

The delivery row stores attempts, next attempt, receipt ID, safe status code, finished/dead-letter timestamps. Transient errors back off exponentially up to 300 seconds and become dead letters at the attempt limit of eight; a ticket received on the last send still gets a receipt check. Pending receipts are first checked after 15 minutes and retried within the 24-hour event lifetime. Rate rejection from a completed provider receipt schedules a new send; network/pending-receipt errors poll the same receipt. Stale events, superseded ownership, preference changes and inaccessible conversations are cancelled.

DeviceNotRegistered in a send response or receipt deactivates only the current binding and clears its ciphertext. A receipt from a rotated/transferred binding cannot deactivate its replacement. Provider messages and raw errors are never persisted. Other permanent credential/payload failures become dead letters.

Operator SQL view PushDeadLetters exposes only delivery ID, kind, timestamps, attempt count and safe status code. No token/ciphertext is in the view. After fixing configuration, an operator can review a specific non-finished, under-24-hour row and reset its dead-letter timestamp/attempts/next attempt; reauthorization still occurs. Never blanket-replay expired rows or promise exactly-once delivery. Operational rows and installation proof/hash tombstones are retained in this stage; no automatic retention purge or general account-deletion workflow is introduced ahead of its stage.

## Server configuration and key rotation

Use a secret manager or ignored local environment file. Never use EXPO_PUBLIC variables for server credentials.

| ASP.NET setting | Value |
|---|---|
| Push__Enabled | true only after configuring the owner project |
| Push__ProjectId | owner-provided EAS project UUID |
| Push__AccessToken | owner Expo access token; enable enhanced push security |
| Push__CurrentKeyId | key name, for example v1 |
| Push__Keys__v1 | independently generated cryptographically random 32-byte key, base64 encoded |

No key is derived from JWT/email/media keys or stored in source. Enabled push with missing/invalid settings fails startup. Disabled push leaves chat/matching usable. infra/.env.example and Compose provide equivalent PUSH_ENABLED, PUSH_PROJECT_ID, PUSH_ACCESS_TOKEN, PUSH_CURRENT_KEY_ID and PUSH_ENCRYPTION_KEY_V1 mappings; disabled is the default.

Rotation: retain v1, add a new random key under v2 in the secret manager, select CurrentKeyId=v2, restart with both keys. New/re-registered tokens are sealed with v2; old ciphertext can still be read with v1. Do not remove v1 while active registrations/backups require it. Use an owner-reviewed maintenance re-encryption or wait for verified device refresh/revocation, then retire old keys according to backup policy. The sample Compose mapping exposes v1; add the corresponding server-side v2 secret mapping when rotating. No production rotation or backup-restore test was performed.

## Owner setup for APNs, FCM and builds

These are configuration steps, not completed external actions. No project, identifier, credential, purchase or cloud build was invented.

1. Link the app to the owner's EAS project and set EAS_PROJECT_ID, IOS_BUNDLE_IDENTIFIER and ANDROID_APPLICATION_ID. The server's project must match the native build. The Notifications plugin and Android activity channel are configured. Remote push requires native/development builds; Expo Go is not verification. See [Expo setup](https://docs.expo.dev/push-notifications/push-notifications-setup/).
2. Android: use the Firebase project/application matching the Android package. Configure its FCM v1 service-account credential through EAS credentials/dashboard. Keep that private service-account JSON outside the repository. Separately supply the application's google-services.json using the GOOGLE_SERVICES_JSON file environment/path mapped by app.config.ts. For remote EAS builds use an EAS file environment variable so the ignored local file need not be uploaded. The app config file contains client identifiers; it is not the private FCM service-account credential. See [official FCM v1 instructions](https://docs.expo.dev/push-notifications/fcm-credentials/).
3. iOS: use the owner's Apple team, registered bundle ID and physical-device provisioning. Configure APNs push credentials in EAS credentials and rebuild with the Notifications plugin. Development profile already sets ios.simulator=false. No Apple membership purchase or key creation was performed.
4. Enable Expo enhanced push security for the owner project and provide its access token only to the server. Configure the separate encryption key ring, then set Push__Enabled=true. The implementation follows the documented ticket/receipt distinction and invalid-token handling. See [Expo delivery protocol](https://docs.expo.dev/push-notifications/sending-notifications/).
5. From mobile/, owner-authorized commands are eas build --profile development --platform ios and eas build --profile development --platform android; install each native build on its device. Preview/production retain HTTPS and owner-ID requirements. Do not publish as part of this task.

## Tap handling

Notification data is an untrusted strict object, not a URL. Unknown fields/versions and non-UUID IDs are rejected. Every tap calls authenticated POST /api/notifications/resolve; the server verifies original recipient and current conversation authorization before returning a conversation ID. Chat itself reauthorizes again. An expired session uses the existing refresh flow; signed-out/cold-start taps wait for authentication/navigation readiness. Offline failures can be retried on resume/settings reload. Closed/nonmember targets show an unavailable notice rather than opening protected content.

The response listener handles foreground/background taps; the saved last response handles cold starts. Successful/definitively rejected responses are cleared, and handled IDs are deduplicated in memory. Account changes invalidate late authorization results. Foreground received notifications only invalidate data after server authorization. [Expo receiving-notification lifecycle](https://docs.expo.dev/push-notifications/receiving-notifications/) informs these entry points; no client route or payload grants access.

## Physical iPhone checklist — NOT RUN

- Install the owner-provisioned development build on an actual iPhone with the configured EAS/APNs project.
- Sign in, open Profile -> Notifications, opt in separately to matches/messages. Verify allow, deny, provisional authorization and later system-settings changes.
- Use a second real account to create a mutual match and send text. Verify generic lock-screen content, foreground suppression, background tap and fully terminated cold-start tap.
- Let access expire, tap an alert, verify refresh/login then authorized chat; repeat after unmatch/block and confirm no history opens.
- Confirm logout, logout-all, A-to-B switching (including B opted out), and several devices do not expose A's conversation on B.
- Rotate/reinstall/restore and inspect registration behavior without exposing tokens. Confirm provider receipt state separately from actual display.

## Physical Android checklist — NOT RUN

- Install the development APK on an actual Android device using the matching package, Firebase config and FCM v1 credential.
- Verify channel creation precedes notification permission/token acquisition; exercise Android notification permission denial and re-enable in system settings.
- Verify new match/message alerts with the app foregrounded, backgrounded and cold-started. Confirm generic content and authorized tap routing.
- Exercise offline delivery/reconnect, expired sessions, block/unmatch, logout/logout-all and A-to-B transfer with B opted out.
- Verify two-device fanout, token change/reinstallation and invalid-token handling when FCM actually reports invalidation; uninstall does not guarantee an immediate invalid-token receipt.
- Record OS/build identifiers, actual arrival and receipt statuses. Never treat mocked provider tests, Hermes export or Expo Go as APNs/FCM delivery proof.
