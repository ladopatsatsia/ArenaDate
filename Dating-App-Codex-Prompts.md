# Dating MVP — Codex prompts for iOS and Android

## როგორ გამოიყენო

მიზანი: რეალური მობილური MVP — რეგისტრაცია, პროფილები, ფოტოები, ფილტრები, swipe, ორმხრივი match, ტექსტური ჩატი, push, unmatch, block/report და მოდერაცია. ერთი React Native/Expo აპი iOS-ისა და Android-ისთვის; ASP.NET Core backend.

პრომტები ინგლისურადაა, ინსტრუქციები — ქართულად. გაუშვი თანმიმდევრობით: ჯერ 0, შემდეგ 1–13, თითო პრომტი ცალკე დავალებად. ახალი სესიისას მიუთითე, რომ ჯერ AGENTS.md და docs/STATUS.md წაიკითხოს. ყოველი ეტაპის შემდეგ თავადაც გამოცადე აღწერილი მომხმარებლის სცენარი. არ დაიწყო შემდეგი ეტაპი, სანამ წინა ეტაპის შეცდომები არ გასწორდება; გარე ანგარიშებით ან მოწყობილობებით დაბლოკილი შემოწმებები ცალკე აღირიცხოს და გამოშვებამდე შესრულდეს.

ეს პრომტები ამცირებს შეცდომების რისკს, მაგრამ არც Codex და არც ტესტები არ იძლევა უბაგო აპის გარანტიას. კოდის შექმნა, რეალურ მოწყობილობაზე გადამოწმება და მაღაზიის დამტკიცება სხვადასხვა ეტაპებია.

დაწყებისას საკმარისია დროებითი სახელი DatingMVP. ბრენდი მოგვიანებით შეიცვალოს. ფასიანი სერვისების გამოწერა და საჯარო გამოშვება ამ პრომტებით ავტომატურად არ არის მოთხოვნილი.

## 0 — მუდმივი სამუშაო წესები

```text
You are implementing a real dating MVP for iOS and Android in this repository. Work as an experienced engineer: inspect, implement, run checks, fix failures, and report evidence. Do not merely return sample code or a plan.

First inspect the repository and existing AGENTS.md instructions. Preserve existing user work. If this is an empty repository, create the project. Set the temporary name to DatingMVP. Merge these working rules into the applicable AGENTS.md without overwriting unrelated instructions.

Scope: adults 18+, email/password auth, verified email, profile and photos, discovery preferences, swipe like/pass, mutual match, text chat, push notifications, unmatch, block/report, account deletion, and a minimal moderator interface. Defer payments, boosts, AI, personality tests, social feed, video/audio calls, chat attachments, and swipe rewind.

Default stack: a currently supported .NET LTS and ASP.NET Core, EF Core, PostgreSQL, ASP.NET Core Identity, SignalR; React Native with a supported Expo SDK, strict TypeScript and Expo Router for the mobile app. Use Expo-compatible dependencies. Choose compatible stable versions using current official documentation, record and lock versions; never blindly install every latest package. Use a modular monolith, not microservices. Prefer straightforward code over speculative abstractions.

Each task must:
1. Read docs/STATUS.md, docs/DECISIONS.md, docs/API.md and existing code if present.
2. Briefly state the bounded scope, then implement it completely. Ask only for genuinely blocking decisions; otherwise document sensible defaults.
3. Enforce identity and resource authorization server-side. Never trust user IDs, roles, match membership or age claims from the client.
4. Add meaningful tests for business rules, authorization, concurrency and regressions. Use real PostgreSQL for relational integration tests; do not substitute EF InMemory for database guarantees.
5. Run relevant builds, type checks, lint and tests. Do not weaken assertions, disable checks, or remove failing tests to obtain a green result.
6. Keep secrets out of code, logs, mobile bundles and committed environment files. Provide sanitized .env.example files. Redact personal information, tokens and message content from logs.
7. Keep mocks/demo fixtures restricted to development and tests. No fake success UI, hard-coded sessions, placeholder production handlers or swallowed exceptions.
8. Update docs/STATUS.md with completed work, exact commands and results, remaining issues and the next step. Label unrun checks as NOT RUN with the reason. Distinguish mock tests, emulator checks and physical-device verification.
9. Provide concise Georgian completion notes: implemented behavior, how to run and test it, checks actually run, and remaining blockers.

If a test needs unavailable credentials, Docker, signing, macOS or a physical device, complete independent work and document the exact verification steps. Do not claim verified iOS/Android behavior from a browser or Expo Go alone. Do not publish to stores, subscribe to paid services or deploy publicly unless separately requested.
```

## 1 — პროექტი და გაშვებადი საფუძველი

```text
Apply AGENTS.md. Implement the repository foundation for the dating MVP.

Create backend, mobile, tests and docs directories with an understandable structure. Use ASP.NET Core with feature-oriented modules and PostgreSQL; Expo React Native with strict TypeScript for iOS and Android. Do not add CQRS frameworks, generic repositories, microservices or Redis without an evidenced need.

Set up reproducible local commands, dependency lockfiles, pinned SDK/runtime configuration, PostgreSQL Docker Compose, migrations, API health/readiness checks, centralized safe ProblemDetails responses, request correlation and structured redacted logs. Expose OpenAPI in development. Generate a typed mobile API client from the API contract with a documented repeatable command.

Implement a mobile shell: onboarding/auth placeholder routes, authenticated tab layout for Discover, Matches and Profile, an API health screen available only in development, safe-area handling and Georgian/English translation infrastructure. Use real API connectivity, not a mocked success response. Configure development, preview and production EAS profiles without inventing project IDs, credentials or account data. Document connecting physical phones to a local API; localhost on a phone is not the development PC.

Create docs/DECISIONS.md, docs/API.md, docs/TESTING.md and docs/STATUS.md. Record domain invariants, environment variables and the planned stages. Add CI for backend build/test, mobile lint/typecheck/tests, API-client drift and migration validation. Backend integration jobs must start real PostgreSQL.

Acceptance: a clean checkout has documented setup; API and database start; mobile can reach API; CI checks are real executable commands. Run available checks and state what could not be run.
```

## 2 — უსაფრთხო ავტორიზაცია

```text
Apply AGENTS.md. Implement production-oriented authentication end to end on the API and mobile.

Use ASP.NET Core Identity's password hashing and validation, verified-email registration, login, logout, password reset and session revocation. Use short-lived validated access tokens and cryptographically random opaque refresh tokens stored hashed server-side. Implement rotating refresh-token families, replay handling, expiry and revocation. Validate issuer, audience, signature and lifetime. Define behavior for concurrent refresh: mobile performs a single refresh shared by pending requests; cover server race behavior in tests rather than accidentally revoking every normal login.

Use OS-backed secure storage on iOS/Android for refresh tokens. Prefer access tokens in memory. Clear tokens and all user-specific caches on logout, account switching, deletion and invalid refresh. Never place tokens in AsyncStorage or URL logs. Permit only narrowly scoped token extraction if required by SignalR transport and redact it.

Implement an email-provider interface, explicit local-only mail capture for development, and production configuration that fails clearly when missing. Registration/reset responses must avoid account enumeration; add rate limits and lockout controls with documented limits. Enforce 18+ using server-side date-of-birth validation, with testable UTC date boundaries; do not call this identity/age verification.

Build register/login/verify/reset screens, error/loading states and protected navigation. Use a redacted response contract that never exposes password/token hashes or private DOB.

Test wrong/expired tokens, duplicate email, unverified login, age boundaries, refresh/replay/races, revoked sessions, reset-token reuse and unauthorized API access. Test that user A's cache and credentials cannot appear after logging in as B. Run checks and update docs.
```

## 3 — პროფილი და ფოტოები

```text
Apply AGENTS.md. Implement profiles and photos end to end.

Profile: display name, private DOB with computed public age, bio, explicitly selected gender and desired genders, city, interests, relationship goal, discovery visibility and ordered photos. Define clear supported choices and editable preferences without assuming every user wants the same genders. Enforce lengths, photo limits and ownership on the server. Make at least one approved photo and a completed profile required for discovery. Do not expose email, DOB, exact coordinates, admin flags or storage credentials in discovery DTOs.

Use a storage abstraction with local private development storage and documented S3-compatible production configuration. Implement authenticated upload finalization, randomized server-owned object keys, byte and decoded-image limits, content validation, safe re-encoding and EXIF removal, thumbnails and aspect-correct rendering. Handle common iPhone photo inputs using supported conversion and document any remaining format limits. A client MIME type or file extension is not validation. Reject arbitrary remote URLs as uploads.

Photo states: pending, approved and rejected. Only approved photos appear in discovery. Local auto-approval must be explicitly development-only; implement minimal moderator approval APIs now, and build their UI in the moderation stage. Protected media access must respect visibility and blocks; use bounded signed access and document that delivered photos cannot be recalled from someone who already saved them.

Handle interrupted uploads, orphan cleanup, deletion of the primary photo and concurrent photo reorder. Build profile onboarding/edit screens, photo selection with denied/limited access fallbacks on both platforms, upload retry and completion state. Never show a success state before the server confirms persistence.

Test ownership violations, malformed and oversized images, EXIF stripping, pending-photo exclusion, order constraints, profile validation and round-trip persistence. Run checks and update docs.
```

## 4 — ადამიანების აღმოჩენა და ფილტრები

```text
Apply AGENTS.md. Implement discovery and preferences end to end.

Provide age-range, desired genders and distance preferences. Define reciprocal eligibility: each person must satisfy the other's supported age/gender preferences. Require visible, completed, active adult profiles with approved photos. Exclude self, blocked pairs in either direction, suspended/deleted accounts, prior decisions and previously unmatched pairs. Document decisions are final in MVP; no rewind or implicit rematch.

Use foreground location only, explicit permission and consent, and a manual city fallback. Store location privately. Never send exact coordinates to another user. Return only a coarse distance bucket and/or city, with validated query limits so arbitrary repeated precision queries cannot expose someone else's location. Do not implement a live user map or background tracking.

Choose a supported PostgreSQL distance strategy with indexed queries; document radius/city-fallback semantics. Implement stable cursor pagination with deterministic ordering, bounded page sizes and no N+1 photo loading. Recheck eligibility at swipe time; a previously fetched card may now be blocked or hidden.

Build filter controls and real discovery cards with loading, empty, offline, denied-location and server-error states. Cache only for the signed-in account. Test reciprocal preferences, age boundaries, radius boundaries, city fallback, block directions, hidden/deleted profiles and pagination. Verify no private fields leak. Run checks and update docs.
```

## 5 — swipe და ერთი სწორი match

```text
Apply AGENTS.md. Implement transactional like/pass and mutual matching. Prioritize correctness under concurrency.

Define a server-owned immutable decision per directed user pair with a unique database constraint. Client request IDs allow safe retries; conflicting reuse or a different later decision must have documented behavior. Validate self-action, both users' eligibility and account/block state in the transaction. A match requires two valid mutual likes. Store a canonical ordered user pair with a database uniqueness constraint and create exactly one match and one conversation.

Prevent the race in which simultaneous reciprocal likes both commit but neither creates a match. Use explicit database synchronization or a transaction strategy with bounded retries and a documented lock order. Serialize conflicting block/unmatch/like operations around the same pair where necessary. Do not rely only on a pre-insert existence check or an application memory lock. Record match events in a transactional outbox in the same commit; consumers must tolerate retries.

Implement native-feeling swipe gestures and accessible like/pass buttons. Optimistic UI must reconcile to server responses, prevent repeated gestures and handle timeouts with the same request ID. Keep ambiguous requests pending and reconcile their result; do not silently turn an unknown result into a new action. Show a match modal only for the actual server match and deduplicate it across retries/events.

Use real PostgreSQL concurrency tests for simultaneous likes, repeated requests, opposite actions, block racing with like and unmatch interactions. Assert exactly one match/conversation/event identity and no active blocked match. Run checks and update docs.
```

## 6 — დახურული, სანდო ტექსტური ჩატი

```text
Apply AGENTS.md. Implement match lists, persisted text chat and authorized SignalR updates.

Treat the database as the source of truth; SignalR events are delivery hints. Use one authoritative message-write path. Every history/read/send/hub operation must verify the authenticated user is a participant in an active conversation and that neither participant is blocked, suspended or deleted. Never authorize solely by hub group membership or a user ID provided by the client.

Persist messages before sending events. Assign a clientMessageId for idempotent retry with a database unique constraint scoped to sender/conversation. Return the same persisted message for identical retries; reject a reused ID with different content. Set bounded message length/rate limits, server timestamps and a deterministic per-conversation ordering cursor. Use a monotonic server sequence if needed; timestamps alone cannot resolve ties. Enqueue events transactionally for eventual delivery.

Implement cursor history, last-message previews, unread counts and monotonic per-user read cursors. A read receipt cannot refer to another conversation's message or move backwards. Use text rendering, never raw HTML. Do not claim end-to-end encryption; implement encrypted transport and document actual storage protection.

Mobile: keyboard-safe composer on both platforms, stable message keys, pending/sent/failed states, retry with the same ID, pagination, newest-message behavior and deduplication when HTTP responses race with live events. Reconnect with backoff, refresh auth safely and catch up from persisted history on reconnect/app resume. No unbounded background socket assumption.

Test unauthorized history/send/group access, concurrent duplicate sends, ordering, read cursors and reconnect gaps. Test lost response after successful persistence produces one message on retry. Run checks and update docs.
```

## 7 — unmatch, block და report

```text
Apply AGENTS.md. Implement unmatch, block and report consistently across discovery, REST, SignalR, media and mobile state.

Unmatch deactivates the match, hides its conversation from normal user access and prevents future messages and rematching for that pair in MVP. Block is private to the blocker, excludes both sides from discovery, deactivates the match and revokes chat authorization immediately. Unblock does not recreate a previous match. Document precise semantics.

Serialize block/unmatch against message sends and like creation so actions after revocation commits cannot send new messages or reactivate the pair. Hub methods must reauthorize; evict connected users from affected groups and have mobile clear affected cached content. Already transmitted bytes cannot be revoked; document this limit.

Report profile or message with category, bounded description and server-resolved evidence. Permit reporting at unmatch time and retain a narrow reporting route for a user's prior conversation without restoring normal history/send access. Protect evidence from users; define retention and deletion policy. Do not expose reporter identity to the reported account. Add idempotency/rate limits against report spam.

Build clear confirmation flows and a report-and-block option. Test both block directions, unblock semantics, existing socket revocation, send/block races, report evidence ownership and reporting after unmatch. Run checks and update docs.
```

## 8 — push ორივე პლატფორმაზე

```text
Apply AGENTS.md. Implement match/message push notifications for iOS and Android using a documented Expo-compatible approach and real provider configuration.

Register device/install tokens only for the authenticated account. Validate provider/project/platform metadata. Support several devices, token rotation, logout revocation and safe ownership transfer after account switching. Treat tokens as sensitive: encrypt server-side for delivery with separately configured keys, hash for lookup, exclude all token material from public DTOs and logs.

Use a persisted outbox worker with bounded retries/backoff, attempt tracking and dead-letter visibility. Handle provider invalid-token receipts by deactivating registrations. Define deduplication keys, acknowledging external delivery is at-least-once and cannot guarantee exactly one visible notification.

Recheck active match/account/block state before delivery. Use privacy-friendly generic lock-screen text by default, not private message bodies. Provide notification preferences. Notification payload IDs are untrusted: authenticated deep-link navigation must fetch and authorize the target. Handle foreground, background and cold-start taps, expired sessions and deleted/unmatched conversations.

Configure APNs/FCM and EAS development builds with accurate official steps and placeholders only for missing user-owned credentials. Do not claim real push works because a mocked provider test passes, and do not use Expo Go as proof of remote push support.

Test outbox recovery, invalid tokens, retries, preferences, ownership transfer, blocked/deleted recipients and malicious deep links. Provide separate physical iPhone/Android verification checklists. Run available checks and record credential/device blockers honestly.
```

## 9 — მოდერატორის რეალური პანელი

```text
Apply AGENTS.md. Build a minimal functional moderator web interface; use server-rendered ASP.NET Core pages unless the repository already has a suitable admin frontend.

Implement moderator/admin authorization separate from user privileges, server-side checks on every action, secure admin sessions, CSRF protection for cookie-authenticated mutations, and MFA for production administrators. Bootstrap the first administrator securely through a documented operator command; no hard-coded credentials or public role-assignment endpoint.

Provide pending-photo approval/rejection, report queue, restricted report evidence view, user suspension/reactivation and audit history. Moderators must not have unrestricted access to all private conversations. Record actor, reason and timestamp without exposing secrets or unnecessary private data.

Suspension must remove discovery visibility, revoke refresh sessions and live access, prevent message sends and push delivery. Approved/rejected media must update affected clients predictably. Ensure operations use the existing pair/account synchronization rules where relevant.

Test normal user access to every moderator endpoint, role escalation attempts, CSRF/session controls, evidence access limits and suspended-user REST/hub behavior. Run checks and update docs.
```

## 10 — ხარისხიანი მობილური გამოცდილება

```text
Apply AGENTS.md. Refine the implemented mobile app into a coherent iOS/Android product without adding new product scope or replacing working backend integrations.

Create reusable design tokens and components: warm minimal dating aesthetic, clear typography, consistent spacing, rounded profile cards, readable contrast and restrained motion. Keep platform-appropriate safe areas, navigation, keyboard behavior and Android back handling. Complete Georgian and English strings; verify Georgian glyphs render. Support dynamic text, screen readers, meaningful labels, accessible touch targets and reduced motion.

Audit every screen for loading, empty, offline, retry, validation and expired-session states. Fix stale cache across accounts, duplicate taps, subscription cleanup, scroll performance, image memory use, touch/gesture conflicts, keyboard occlusion and routing races. Use virtualized lists and bounded caches. Handle photo/location/notification permission denial and limited access without crashing or trapping users.

Add meaningful component tests for swipe reconciliation, refresh single-flight, chat deduplication and account switching. Define reproducible mobile end-to-end flows using a tool compatible with native builds, such as Maestro, for both platforms. Do not present a browser screenshot as evidence of native behavior.

Review on available native devices/emulators, save evidence and list unverified platform checks. Run relevant checks and update docs.
```

## 11 — ანგარიშის წაშლა და მონაცემების კონტროლი

```text
Apply AGENTS.md. Implement account lifecycle and privacy controls end to end.

Provide discoverability pause, notification settings, logout-all-devices and in-app account deletion with recent authentication. Deletion must immediately hide the profile, revoke tokens and hub access, deactivate matches, cancel pending notifications and prevent new discovery/message actions. Purge profile/media/device data through a retryable persisted job; do not depend on a single synchronous deletion request.

Define which conversation/report/audit records are erased, anonymized or narrowly retained, for what purpose and for how long. Do not invent a legal compliance guarantee. Reconcile privacy deletion with authorized report evidence and the other participant's retained conversation data explicitly. Define backup expiry and prevent deleted accounts being silently restored by backup recovery.

Provide a deletion-status flow and a minimal public deletion-request page/route appropriate for the eventual stores, with secure account verification. Avoid leaking whether a given email is registered. Draft accurate data-inventory and privacy-policy content marked for owner review; never claim nonexistent E2E encryption or verification.

Test deletion during active chat/upload/outbox jobs, retry after a worker crash, deleted-user authorization and media cleanup. Run checks and update docs.
```

## 12 — დამოუკიდებელი რეგრესიული შემოწმება და ბაგების გასწორება

```text
Apply AGENTS.md. Perform an adversarial whole-product regression review and implement fixes with regression tests. Do not add new features or perform broad aesthetic refactors.

Inspect actual code, database migrations, authorization and mobile behavior, not just earlier completion notes. Use three separate users and real PostgreSQL.

Verify: registration/verification/login/reset; restart and token expiry; profile/photo moderation; reciprocal discovery filters; pass and mutual like; simultaneous likes and one match; unauthorized user C accessing A/B chat; message send/history/order/read states; retries after lost responses; reconnect and app resume; unmatch; both block directions and concurrent sends; reporting; suspended accounts; push ownership across logins; deletion; cache isolation and malicious deep links.

Run repeatable randomized concurrency scenarios with fixed seeds. Run realistic load checks on discovery and chat, record environment/dataset/latency/error rates, investigate slow queries and add justified indexes. Do not claim a production capacity unsupported by measurements. Check dependency advisories with current tooling; triage and fix applicable issues without uncontrolled major upgrades.

Create docs/BUGS.md with severity, reproduction, cause, fix and regression evidence. Fix all confirmed release-blocking and major issues within scope. Rerun affected checks and final CI. Show exact unrun checks and remaining risks. Create a platform-by-platform manual QA matrix; physical-device checks remain pending until actually performed.
```

## 13 — iOS/Android build და გამოშვების მზადყოფნა

```text
Apply AGENTS.md. Prepare reviewable staging/release artifacts for the completed MVP, without automatically publishing or subscribing to services.

Verify current official Apple App Store, Google Play and Expo requirements before configuring release details. Choose actual owner-provided bundle/package IDs; leave missing owner information clearly documented rather than inventing it. Configure signing, EAS development/preview/production profiles, native app icons/splash, permission descriptions, associated links where used, APNs/FCM configuration, version/build numbers, environment separation and safe update runtime compatibility. Ensure production builds cannot reach development fixtures or insecure HTTP endpoints.

Prepare backend deployment configuration for HTTPS and WSS, database migrations as an explicit release step, private media storage, secret/key management, worker/outbox operation, least-privilege roles, redacted monitoring, alerting, backup/restore verification and rollback. Do not run destructive migrations against production automatically. Document that the first version uses one API instance unless hub fan-out and pair synchronization are verified across instances; do not silently scale beyond the tested topology.

Provide TestFlight and Google Play internal-testing instructions and build commands; execute builds only when authorized accounts and credentials are available. Test release-like binaries, not only Metro development sessions. Verify a physical iPhone and Android flow including photo permissions, location denial, notification permission, push taps in all app states, background/resume, token expiry, chat reconnect, unmatch/block and deletion.

Prepare accurate store privacy/data-safety answers from actual data flows, appropriate age-rating answers, account-deletion URL, privacy/support URLs, user-content reporting/moderation information and reviewer demo access. Keep drafts marked for review; store approval is not guaranteed.

Output docs/RELEASE.md with artifacts actually built, verification evidence, required accounts/credentials, operator commands, remaining blockers and a go/no-go checklist. Mark release readiness NO-GO if required checks are pending. Do not call the app production-ready merely because compilation passes.
```

## როცა რაღაც არ მუშაობს — ბაგის პრომტი

```text
Apply AGENTS.md. Fix this defect in the current repository without adding unrelated features.

Observed behavior: [what happens]
Expected behavior: [what should happen]
Reproduction: [exact steps]
Platform/build: [iOS or Android, OS, app build]
Sanitized error/log: [remove tokens, emails, private messages and credentials]

Read the relevant code and docs. Reproduce the defect or explain precisely why reproduction is blocked. Identify the cause, implement a minimal robust fix, add a regression test for the failure mode, and run affected checks. Inspect whether the same cause affects the other platform. Do not disable tests, swallow exceptions, fake success or redesign unrelated modules. Report evidence and update STATUS.md and BUGS.md.
```

## შემდეგ ეტაპზე გადასვლის პრომტი

```text
Read AGENTS.md and docs/STATUS.md. Verify the previous stage's acceptance criteria and actual check results. Fix outstanding in-scope failures before starting the next numbered prompt. Keep external-account/device blockers explicitly open; do not interpret them as passed. Then implement the next stage using its full prompt. Finish with evidence and updated docs.
```

## საკონტროლო სცენარი შენთვის

1. შექმენი A, B და C მომხმარებლები; შეავსე პროფილები და დაამტკიცე ფოტოები.
2. A-მ მოიწონოს B — ჯერ match არ უნდა იყოს.
3. B-მ მოიწონოს A — ორივემ უნდა ნახოს ერთი match.
4. A-მ და B-მ გაცვალონ მესიჯები; აპის გადატვირთვის შემდეგ ისტორია დარჩეს.
5. C-მ ვერ უნდა მიიღოს მათი საუბარი, მისი ID-ის ცოდნის შემთხვევაშიც.
6. გათიშე ინტერნეტი გაგზავნისას, შემდეგ სცადე ხელახლა — ერთი მესიჯი უნდა დარჩეს.
7. A-მ დაბლოკოს B — ახალი შეტყობინება აღარ უნდა გაიგზავნოს, არც უკვე გახსნილი ჩატიდან.
8. გადადი A-დან C-ის ანგარიშზე — A-ს ჩატი/ფოტოები/შეტყობინებები არ უნდა გამოჩნდეს.
9. ცალ-ცალკე გაიმეორე რეალურ iPhone-სა და Android-ზე; push გამოცადე development/release-like build-ში.
10. წაშალე ანგარიში — პროფილი აღარ უნდა გამოჩნდეს და ძველი სესია აღარ მუშაობდეს.

## ოფიციალური ცნობარები

- Expo EAS iOS/Android: https://docs.expo.dev/tutorial/eas/introduction/
- Expo development builds: https://docs.expo.dev/develop/development-builds/introduction/
- Expo build setup: https://docs.expo.dev/build/setup/
- Expo push notifications: https://docs.expo.dev/push-notifications/overview/
- ASP.NET Core SignalR authorization: https://learn.microsoft.com/aspnet/core/signalr/authn-and-authz

ვერსიები და მაღაზიების მოთხოვნები დანერგვის მომენტში თავიდან გადაამოწმოს Codex-მა ოფიციალურ დოკუმენტაციაში.
