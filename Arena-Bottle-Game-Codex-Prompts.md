# ARENA — ბოთლის თამაშის ლოგიკა და Codex-ის ეტაპობრივი პრომტები

თარიღი: 2026-10-03. ეს დოკუმენტი აფართოებს უკვე შექმნილ dating MVP-ს. მომხმარებლის ანგარიშით პროექტი ჯერ development გარემოშია გამოცდილი; აპის რეალური კოდი ამ დოკუმენტის მომზადებისას არ შემოწმებულა.

## როგორ გამოიყენო

პროექტში ჩადე ეს ფაილი, Dating-App-Tech-Stack.md და Dating-App-Codex-Prompts.md. დაიწყე ქვემოთ მოცემული საწყისი პრომტით და ეტაპი 14-ით. შემდეგ 15–21 გაუშვი ცალ-ცალკე. ნომრები აგრძელებს MVP-ის 0–13 პრომტებს. არსებული პროექტი არ შექმნა თავიდან.

ამ ფაილში თამაშის, კრისტალებისა და AI-ის ახალი მოცულობა ცვლის ძველი დოკუმენტის შესაბამის defer ინსტრუქციებს მხოლოდ ამ მოდულის ფარგლებში. არსებული უსაფრთხოების/ტესტირების წესები ძალაში რჩება. ძირითადი swipe dating-ის უფასო ჩატი ავტომატურად ფასიანი არ ხდება; ფასიანი ჩატის წესი ეხება თამაშიდან შექმნილ, ჯერ გაუხსნელ კავშირს.

## A. პროდუქტის ლოგიკა

### ოთახი და მონაწილეები

- მაქსიმუმ 10 ადამიანი; ფოტო, display name და ასაკი ხილულია. დამატებითი ინფორმაცია მხოლოდ ნებადართული ველების ნაკრებია, არა email, DOB, ზუსტი მისამართი ან კოორდინატები.
- პირველი ვერსიის default ოთახი: 5 ქალი/5 კაცი, მამაკაცებისა და ქალების ორმხრივი dating preferences-ისთვის. ამ კონკრეტულ ფორმატში მოთამაშეების პრეფერენციები მას უნდა შეესაბამებოდეს. სხვა ფორმატები მოგვიანებით; სხვა მომხმარებლებისთვის ჩვეულებრივი dating MVP რჩება ხელმისაწვდომი.
- სავსე ოთახი იწყებს 5+5-ით; 30 წამის ლოდინის შემდეგ დაწყება შეუძლია მინიმუმ 6 აქტიურს, მინიმუმ 3+3-ით. ეს და სხვა დროები საწყისი configurable defaults-ია.
- დაწყებული თამაში გრძელდება მინიმუმ 4 აქტიურით, თუ ყველა აქტიურ მოთამაშეს ჰყავს მინიმუმ ერთი ურთიერთთავსებადი სამიზნე. თუ ასე აღარ არის, მიმდინარე რაუნდი სრულდება და ოთახი ელოდება შევსებას; 2 წუთში შეთავაზებულია სხვა ოთახი/გასვლა, არჩევითი მოქმედებით.
- ახალი წევრები ერთვებიან დასრულებული წყვილის რაუნდის შემდეგ. ადგილები, join reservations და gender quota სერვერზე მოწმდება, ერთდროულმა join-ებმა 10-ს არ უნდა გადააჭარბოს.

### სვლა, ბოთლი და კითხვები

სამუშაო წესი: სვლები რიგრიგობით ეკუთვნის აქტიურ მონაწილეებს. თავის სვლაზე მოთამაშე ატრიალებს ბოთლს; სერვერი შემთხვევით ირჩევს სხვა აქტიურ, ურთიერთთავსებად და დაუბლოკავ მონაწილეს. ეს ორი ხდება მიმდინარე კითხვების წყვილი. შემთხვევითობა უფასოა და კრისტალებით არ იცვლება.

ბოთლის ვიზუალური მოძრაობა აჩვენებს უკვე არჩეულ შედეგს. თითო წყვილის რაუნდში არის ზუსტად 5 განსხვავებული კითხვა, წინასწარ მომზადებული 3–4 პასუხით. ორივე დამოუკიდებლად პასუხობს; პასუხი უცვლელი ხდება მიღების შემდეგ. არჩევანი იხსნება ორივეს პასუხის მიღებისას, მხოლოდ წყვილისთვის. სხვები ხედავენ აქტიურ წყვილსა და პროგრესს, არა მათ პირად არჩევანს.

თითო კითხვაზე 20 წამი. გამოტოვება უფასოა. თუ ერთმა არ უპასუხა/გამოტოვა, არც ერთი პასუხი არ იხსნება; კითხვას არ ეწერება დამთხვევა ან განსხვავება. ზედიზედ ორი არასრული კითხვა ასრულებს რაუნდს. დასრულებულ კითხვებზე პასუხების გამოჩენისთვის 4 წამია გამოყოფილი; AI ლოდინი თამაშის დროებს არ ახანგრძლივებს.

მესიჯი ჩნდება ყოველი დასრულებული კითხვის შემდეგ; ბოლოს — საერთო მესიჯი. 0 დამთხვევაც არ აფერხებს კოცნას ან match-ს. არ არსებობს სწორ/არასწორ პასუხები, თავსებადობის დიაგნოზი ან პოპულარობის ქულა.

### კოცნა და match

საწყისი შეთანხმების შენარჩუნება: თავის სვლაზე ადამიანს შეუძლია კოცნა გაუგზავნოს ნებისმიერ სხვა უფლებამოსილ ოთახის მონაწილეს; ბოთლით არჩეული კითხვების პარტნიორი შეთავაზებული default სამიზნეა, არა ერთადერთი შესაძლო სამიზნე. კითხვების დასრულება კოცნის სავალდებულო პირობა არ არის.

ერთ სვლაზე მაქსიმუმ ერთი ახალი კოცნა; არჩევანი 15 წამში, ან გამოტოვება. კოცნა მხოლოდ მიმღებს ეჩვენება, არც მიღებული კოცნების რაოდენობა და არც უარი საჯარო არ არის. მიმღებს შეუძლია საკუთარი სვლისას საპასუხო კოცნა გაგზავნოს. ორი მიმართულებით კოცნა ქმნის ერთ match-ს. უპასუხობა არ ნიშნავს თანხმობას.

კოცნები მოქმედებს იმავე ოთახის წევრობის მიმდინარე პერიოდში; expire ხდება ერთ-ერთის გასვლის, ადგილის საბოლოო გათავისუფლების ან ოთახის დახურვისას. უკვე მიღებული match რჩება. Disconnect-ის 60-წამიან პერიოდში კოცნა ინახება, მაგრამ ოფლაინ მოთამაშე ახალი კოცნის სამიზნე არ არის. უკვე დამეჩილი ან unmatched წყვილი თავიდან თამაშით არ დამეჩდეს.

### დამატებითი პროფილი და ჩატი

1. Match-მდე კონკრეტული ადამიანის დამატებითი პროფილი იხსნება 25 კრისტალად, ერთხელ და ერთი მიმართულებით. მფლობელი ხედავს, ვინ გახსნა მისი ინფორმაცია. თამაში, ბოთლის ალბათობა და კოცნა არ იცვლება.
2. გახსნა რჩება ძალაში სხვა ოთახშიც, სანამ account/block/deletion უფლებები ამის საშუალებას იძლევა; profile ნახვა არ არის like ან match.
3. თამაშის match-ის შემდეგ ჩატი ჯერ დახურულია. ერთ-ერთი იხდის 25 კრისტალს; ორივეს უხსნის ჩატს და ერთმანეთის დამატებით პროფილს. თითო მესიჯზე გადასახადი აღარ არსებობს.
4. Match-მდე პროფილისთვის დახარჯული 25 კრისტალი არ აკლებს ჩატის ფასს. ადრე პროფილის არგახსნაც არ აფერხებს match-ს.
5. უკვე გახსნილი ჩვეულებრივი MVP match/chat არ დაიკეტოს და არ მოითხოვოს კრისტალები. თამაშის locked match-ზე შემდგომი ორმხრივი ordinary swipe შეიძლება გადაიყვანოს იგი არსებული MVP-ის free-chat მდგომარეობაში; ეს ღიად აღწერილი წესია და არა საიდუმლო გზის დაბლოკვა.
6. ჩატის გახსნის გამო გადამხდელს არ ეძლევა სხვისი თანხმობის შეცვლის უფლება. block/unmatch მაშინვე აუქმებს შესაბამის წვდომას; თავიდან გადახდა ასეთ წვდომას ვერ აღადგენს.
7. გადახდის ფასი, გამხსნელის ხილვადობა და მიღებული წვდომა წინასწარ ჩანს. პროფილის არასავალდებულო პირადი ინფორმაცია ასეთ რეჟიმში მხოლოდ მომხმარებლის ინფორმირებული თანხმობით გამოიყენება.
8. 100 კრისტალი / 1 GEL არის სასურველი საწყისი პაკეტი, არა უკვე დადასტურებული store price. რეალური ფასი მოდის მაღაზიის პროდუქტის მონაცემებიდან. შეძენილ კრისტალებს ვადა არ გასდის; არ არის cash-out, გადაცემა, ფსონი ან შემთხვევითი ფასიანი პრიზი.

### Disconnect და აღდგენა

- Explicit leave: ადგილი მაშინვე თავისუფლდება და პასუხები/კოცნები აღარ მიიღება.
- კავშირის დაკარგვა: ადგილის reservation 60 წამი. ყველა კავშირის დაკარგვა გამოითვლება მომხმარებლის ყველა აქტიური connection-ის გათვალისწინებით; ერთი socket-ის დახურვა სხვა მოქმედ connection-ს არ აუქმებს.
- მიმდინარე წყვილის disconnect: ერთხელ, ჯამურად მაქსიმუმ 15 წამი შეჩერება თითო რაუნდზე. Pause ინახავს კითხვაზე დარჩენილ დროს; repeated disconnect-ებით ახალი დრო არ გაიცემა. თუ ვადა გავიდა, რაუნდი სრულდება partial შედეგით.
- ოთახიდან საბოლოოდ წასული წევრი ხელახლა შემოდის ახალ membership-ად და ძველ სვლაზე უფლებას ვერ იყენებს.
- recovery: სერვერული snapshot, version და deadline; აღდგება საკუთარი მიღებული პასუხი და წყვილისთვის გახსნილი შედეგები, არა სხვისი ფარული პასუხები. ძველი მოვლენები ახალ snapshot-ს ვერ გადაფარავს.
- ფინანსური ledger, matches და completed results მუდმივად ინახება. server restart-ზე deadlines და room state აღდგება; არ ტრიალდება თავიდან უკვე არჩეული ბოთლი.

## B. საწყისი პრომტი

```text
Read AGENTS.md, docs/STATUS.md, Dating-App-Tech-Stack.md, Dating-App-Codex-Prompts.md and Arena-Bottle-Game-Codex-Prompts.md. Inspect the actual completed MVP before editing. Implement the numbered stage I request, preserving the existing working application.

This extension authorizes the Arena game module, optional AI commentary and crystal monetization in the specified stages. It supersedes old scope deferrals only for this module. Keep the agreed stack and safety/testing rules. Do not rebuild the MVP, change frameworks or make all existing chats paid. Use Arena branding and the agreed purple/pink palette if existing design tokens reflect it.

The product rules in section A are the working contract. If existing code conflicts materially, identify the discrepancy and choose a minimal compatible migration; never silently alter paid access or erase data. Use database transactions/constraints, authenticated server-owned identities and resource authorization for every operation.

Implement actual code and meaningful tests, run relevant checks and fix failures. Update STATUS, API, DECISIONS and a game-specific QA document. Report exact checks and NOT RUN limitations in Georgian. Keep production credentials missing explicitly; do not fake success. Do not purchase services, charge real users, publish or deploy without separate authorization.

Start with stage 14 only. Do not advance automatically to stage 15.
```

## 14 — არსებული MVP-ის დაკავშირება და ოთახების საფუძველი

```text
Apply the extension contract and existing AGENTS.md. Inspect auth, profiles, photo moderation, match/chat authorization, SignalR, migrations and block/unmatch lifecycle in the actual repository. Record baseline build/test results; fix only blocking integration defects, preserving unrelated work.

Add game feature modules and a versioned persisted room/membership model. Room capacity 10, default 5 female/5 male quota with reciprocal matching preferences, full start or 30-second lobby fallback to at least 3+3 active members. Make defaults configurable and validated. The lobby does not reserve seats indefinitely. Define room states and allowed transitions explicitly in docs/GAME.md.

Implement list/create/join/leave endpoints and mobile lobby UI with real API integration. Users must be verified active adults with an eligible completed profile and approved photos. Enforce one active room membership per account, capacity and quota atomically under concurrent joins. Blocked pairs cannot share a room; blocked join must return a non-identifying unavailable response. No private profile fields in room DTOs. Include account deletion/suspension invalidation hooks.

Use development-only labelled fixtures to support manual testing; never present simulated users as real people. No spin/questions/kisses/wallet yet. Test parallel joins, duplicate join/leave requests, quotas, unauthorized reads, blocked pairs and profile eligibility with real PostgreSQL. Update docs and report evidence.
```

## 15 — presence, deadlines და მდგომარეობის აღდგენა

```text
Implement authenticated game SignalR subscriptions and reconnect recovery on the stage-14 foundation. Authorize membership on each relevant command and subscription; groups alone are not authorization. Define one command path, REST by default, with hub updates for events.

Persist room state, membership generation, state version, sequence and deadlines. Provide an authorized snapshot endpoint with recipient-specific redaction. Include own pending answer only when applicable; never serialize hidden answers to all room members. Clients apply ordered events, discard obsolete versions and refetch on sequence gaps/reconnect. Events must not race DB commits; use the existing outbox or a justified durable equivalent.

Detect unavailable players with bounded heartbeats/leases, not just client AppState. Handle several connections per account. Intentional leave releases immediately; transient loss reserves for 60 seconds. Expiry is server-driven. Handle reconnect-vs-expiry and leave-vs-reconnect races. Enforce one pause budget of 15 seconds per future pair round; store remaining question time, so disconnect never grants unlimited answer time.

Use an injected testable server clock and durable deadline processing. Startup recovery processes expired deadlines exactly once logically. Duplicate events or workers cannot advance a turn twice. Define room pause/refill/2-minute exit-offer behavior, requiring at least 4 active members and an eligible partner for each. New active members join play at round boundaries.

Build offline/reconnecting/seat-expired UI and safe app-resume behavior on iOS/Android. Test event gaps, lost events, multiple sockets, deadline races, crash recovery and block/deletion revocation. Run checks and update docs.
```

## 16 — სვლები, ბოთლი და ხუთი კითხვა

```text
Implement a persisted server-authoritative game state machine: lobby, waiting, turn/spin, five question/reveal steps, kiss choice and round completion. Respect all section-A timer/presence rules.

Schedule round-robin turns among eligible active memberships; no paid priorities. Only the current turn owner may request a spin. Generate the target server-side with a cryptographically secure RNG over the eligible candidates. Persist spin/result before emitting events. Clients cannot choose outcomes. Document candidate filtering, fair repetition avoidance and behavior when no candidate exists; no paid reroll.

Create versioned curated Georgian question content with exactly 3–4 options, seed at least 20 questions, select 5 nonrepeating questions per round and freeze their text/options for the round. Moderator management through existing Angular admin; do not mutate questions mid-round.

Both pair members submit independently with idempotency keys, question/round IDs and expected state version. Lock each accepted answer; reveal only after both valid answers. Skip/timeouts suppress both answers and are not counted as a disagreement. Two consecutive incomplete questions end the round. Use 20-second answer deadlines and 4-second reveal windows. Stale, late, cross-room and third-user submissions must fail safely.

Only the selected pair sees question answers and personal commentary; the rest see progress/participants. Mobile bottle animation follows the persisted outcome, uses server-based deadlines and can fast-forward after reconnect. Accessible buttons and reduced motion are required. Recheck block/account state at round transitions; invalidate a round if necessary.

Add deterministic state-machine and real database race tests for double spin, answer-vs-timeout, simultaneous answers, pause budgets, partial summaries and server restarts. Use simple reviewed fallback messages now, not AI or billing. Run checks and update docs.
```

## 17 — კოცნები და არსებული match სისტემა

```text
Implement private kisses and match integration according to section A. One new kiss per current owner's turn within a 15-second choice window. Owner may select any eligible active room member, defaulting to the bottle-selected partner. Do not require full-profile purchase or matching question answers. Recipient can reciprocate on their own later turn; no public rejection/popularity counters.

Scope pending kisses to the room and both current membership generations. Expire on explicit leave, reservation expiry or room closure. Persist during the reconnect grace. Existing matches survive room closure. Repeated identical request IDs are idempotent; conflicting reuse is rejected.

Reuse existing match/conversation creation through a common domain service, not a second matching database. Exactly one canonical-pair match and conversation even when reciprocal kisses and ordinary likes arrive simultaneously. Match creation must synchronize with block/unmatch/account lifecycle and transactional outbox events. Never resurrect an unmatched or blocked pair.

Add match provenance and explicit chat entitlement: existing ordinary matches remain open; newly game-only matches may be created locked pending stage-19 unlock. Until that stage, show the honest unavailable state, not fake payments or unauthorized chat. If normal reciprocal swipes later establish their free entitlement, it opens the existing conversation without creating another match. Build all chat reads/writes/hub subscriptions against central entitlement + membership + safety checks.

Question outcome cannot force or prevent mutual kisses. Test all match/ordinary-like/concurrency combinations, stale memberships, expired kisses and bypasses through REST/hub/history/notifications. Update docs and run checks.
```

## 18 — AI-ის კომენტარები და საბოლოო მესიჯი

```text
Implement an AI commentary provider behind a narrow backend interface, with a reviewed deterministic fallback. Before implementing an OpenAI provider, verify current official API/SDK documentation and key availability through supported environment tooling. Keep the key server-side; do not invent credentials, hard-code model names as universally available or include secrets in mobile bundles.

Send only curated question text, option labels, this pair's jointly revealed selections, language and a bounded recent-commentary context. No photos, names, DOB, location, paid hidden profiles or private chats. Inform users about third-party AI processing and obtain required permission before sending their selections; if not enabled, use fallback and retain all game functionality.

Generate one shared short Georgian message after each complete question and one final message from completed questions. Messages should combine concrete selections, use restrained humor/flirt and avoid repeating prior text. Never infer actual attraction, personality diagnoses or scientific compatibility, promise romance, shame differences, pressure kisses or encourage spending. No generation for suppressed/unanswered questions. Partial summaries accurately state the number answered.

Use bounded structured output and server validation for content/length/language. Schema compliance is not a safety guarantee. Detect refusals, incomplete outputs and content failures. Persist one accepted message per round/question/prompt version; both clients see the same result. Use deadlines, concurrency/cost caps and bounded retries. Finalize fallback if generation misses the deadline; late output cannot replace text already shown. AI failure never blocks turns/matching.

Build repeatable Georgian quality tests/evaluation fixtures including 0 matches, differing choices and incomplete rounds. Mock provider for deterministic tests; live API checks only with authorized credentials, small explicit budgets and labelled evidence. Measure actual generation latency/cost before selecting a model. Update docs and run checks.
```

## 19 — კრისტალების ledger და 25-კრისტალიანი გახსნები

```text
Implement integer crystal balances using an auditable persisted ledger and transactional entitlement grants. No real-money purchasing yet. Development test grants must be labelled, operator-controlled and disabled in production.

Implement the section-A purchases:
A. Directed full-profile unlock before game match: 25 crystals once, no game advantages. Notify the owner once of the actual viewer/unlock; no invented attraction claim.
B. A locked game match's conversation unlock: 25 crystals charged once to one participant, grants both chat and full-profile access. Earlier profile unlock does not reduce this price. Existing free/open conversations are never charged again. Full-profile entitlement does not expose private identity/contact/location data. Obtaining paid access requires profile owner's prior informed game-disclosure permission.

Serialize debits and entitlement changes in one DB transaction, with idempotency keys and unique constraints. Guard against negative balances, overspending across devices and simultaneous A/B unlocks. The loser of a race receives already-open status with no debit. Revalidate active match/target/block/account state at commit. If access could not be granted, no debit. A lost response after successful purchase must recover the same receipt, not purchase twice.

Race ordinary-free-match creation with paid unlock: evaluate entitlement consistently in the commit order and document when charge is valid. Do not charge if free entitlement already exists. Unmatch/block cannot be bypassed by another purchase; define no automatic credit return for ordinary subsequent unmatch but separate real failed-grant remedies and provider refunds.

Gate full profiles and every chat/history/hub access server-side; hiding client UI is not protection. Audit discover DTOs: the user's own profile remains editable, ordinary dating behavior stays as already implemented, game previews expose only game-approved summary fields. Log minimal ledger metadata, not private profile content. Implement clear price/visibility confirmation, receipts and account-scoped cache invalidation.

Test parallel purchases, duplicated IDs, cross-account access, lost responses, insufficient balance, free entitlements and lifecycle races using PostgreSQL. Update docs and run checks.
```

## 20 — iOS/Android კრისტალების რეალური შეძენა

```text
Implement store-backed consumable crystal purchases using the existing Expo/native build setup. First verify current official Apple, Google and chosen billing SDK documentation, supported Expo versions, regional requirements and consumable/refund lifecycle. Choose a compatible integration and document it before coding; do not assume a third-party wrapper handles account attribution or virtual currency accounting automatically.

Desired starter offer is 100 crystals for approximately 1 GEL if supported store pricing permits. Fetch actual localized price/currency from store product metadata. Do not hard-code 1 GEL as guaranteed or bypass store billing by default. User-owned product IDs/signing/accounts must be real supplied configuration; missing values are explicit blockers.

Server verifies successful purchases with platform authoritative APIs, binds them securely to authenticated app accounts, and credits each verified store transaction once. Handle pending, cancelled, failed, duplicate, replayed, wrong-product/environment and interrupted purchases. Complete/acknowledge/consume in the platform-required order with crash-safe recovery. Consumable balances live in the server ledger; platform restore alone does not reconstruct them. Purchased balance has no expiry, cash-out or player transfer.

Verify store event signatures/authorization and process refunds/reversals idempotently. Keep original ledger immutable and append corrections. If refunded credits were spent, handle outstanding debt/restricted spending explicitly without corrupting balances; retain user access to support and account deletion. Document operator reconciliation.

Test sandbox purchasing on real iOS/Android development/release-like builds, account switching and interrupted credit flows. If credentials/devices are unavailable, deliver working mocked contract tests but mark live purchase acceptance NOT RUN; do not enable real-money sales. No production charges or store submission in this task.
```

## 21 — მთლიანი თამაშის QA და store-review მზადყოფნა

```text
Review and fix the complete game extension without adding unrelated features. Re-run baseline dating regression checks to ensure ordinary swipe/match/chat still work.

Exercise at least 10 independently authenticated clients in automated integration tests, then available physical iOS/Android clients: joins, quotas, turns, spin, five questions, incomplete answers, private reveals, kisses, match, directed profile unlock, chat unlock and reconnect. Inject network loss, reordered/duplicated events, stale requests, worker crash, restart, block/suspension/deletion and purchase retries. Verify third users never receive pair answers, paid information, hidden chats or purchase credentials.

Reconcile server ledger, unlocks, matches and room transitions. Measure room synchronization/recovery and AI fallback latency with documented environment and workload. Fix release-blocking and major defects with regression tests. Validate timers do not extend indefinitely through reconnects, waiting rooms expire safely and paid users never get advantageous spin outcomes.

Inspect current official store policies for the actual dating+game experience, user content, AI disclosure, virtual currency and billing. Draft accurate review notes and demo flows with full game visibility; do not hide features or enable unreviewed features after approval. Do not guarantee store approval. Include reporting/blocking/moderation flows and correct privacy disclosures.

Create docs/GAME-QA.md and update RELEASE/BUGS/STATUS with actual evidence, physical-device matrix and outstanding account/store checks. Mark release NO-GO when required checks remain. End with a concise Georgian handoff. Do not publish automatically.
```

## C. თამაშის დამატების მიღების პირობები

1. A/B/C-ის პირადი მონაცემები არ ერევა; ჩვეულებრივი dating ფუნქციები ისევ მუშაობს.
2. ერთდროულად ათზე მეტი ადგილი ვერ გაიცემა; მოთამაშე ორ ოთახში ერთდროულად ვერ თამაშობს.
3. ბოთლის შედეგი სერვერზე ერთია; თავიდან ჩართვა მას ვერ ცვლის.
4. პასუხის გახსნამდე პარტნიორის არჩევანი არც REST-ში და არც SignalR payload-ში არ ჩანს.
5. გამოტოვება/timeout განსხვავებად არ ითვლება; კოცნა არც დამთხვევაზეა მიბმული და არც გადახდაზე.
6. ორმხრივი კოცნა ქმნის ერთ match-ს, მაშინაც როცა ordinary swipes ერთდროულად ხდება.
7. Match-მდე დამატებითი პროფილის არგახსნით თამაში სრულად ხელმისაწვდომია.
8. ჩატის ერთჯერადი 25-კრისტალიანი გახსნა მუშაობს ორივესთვის; ერთდროულ გადახდაზე მხოლოდ ერთი debit.
9. გათიშვისას ოთახი არ იყინება; დაბრუნება სწორ სვლას/კითხვას აღადგენს.
10. AI ვერ ცვლის თამაშის შედეგს და მისი გათიშვა თამაშს არ აჩერებს.
11. სანახაობრივი რეიტინგები, ყალბი მოთამაშეები, დამალული ფასები და იძულებითი profile purchase არ არსებობს
12. რეალური iPhone/Android და store sandbox შეძენები ცალკე დადასტურებულია გამოშვებამდე.
