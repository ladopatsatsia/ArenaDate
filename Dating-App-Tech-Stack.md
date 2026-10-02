# Dating MVP — ტექნოლოგიური სტეკი და Codex-ის წესები

მომზადებულია: 2026-09-30.

## 1. მიზანი და შენი სტეკი

მიზანია ერთი რეალური dating აპლიკაცია iOS-ისა და Android-ისთვის: რეგისტრაცია, პროფილი, ფოტოები, swipe, match, ტექსტური ჩატი, push, block/report და მოდერაცია.

არჩევანი ეყრდნობა შენს მიმართულებას: C# / ASP.NET Core backend, Angular ვებისთვის და React Native / Expo მობილურისთვის. Backend-ის ბიზნესლოგიკა იწერება C#-ში; მობილური აპი და Angular პანელი — TypeScript-ში. Angular არის ადმინისტრაციისთვის; მომხმარებლის მობილური ეკრანები React Native-ით აშენდება. სამივე ნაწილი ერთ API-ს იყენებს.

ეს ფაილი გამოიყენე Dating-App-Codex-Prompts.md-სთან ერთად. ის აზუსტებს ტექნოლოგიებს; ფუნქციების მოცულობა და შემოწმებები პირველი ფაილიდან რჩება ძალაში.

**კონკრეტული ცვლილება პირველ ფაილთან:** მე-9 პრომტში აღწერილი მოდერატორის პანელი გააკეთე Angular-ზე, server-rendered ASP.NET Core pages-ის ნაცვლად. ავტორიზაცია, MFA, CSRF დაცვა და დანარჩენი მოთხოვნები შენარჩუნდეს. არ შეიქმნას ორი ადმინპანელი.

## 2. საბოლოო არჩევანი

| ნაწილი | ტექნოლოგია | დანიშნულება |
|---|---|---|
| Backend | C#, .NET 10 LTS, ASP.NET Core Web API | ავტორიზაცია და ყველა ბიზნესწესი |
| არქიტექტურა | Modular monolith, feature modules | ერთი backend, მკაფიო მოდულებით |
| მონაცემთა ბაზა | PostgreSQL | ანგარიშები, პროფილები, გადაწყვეტილებები, match-ები, ჩატი |
| მონაცემებზე წვდომა | EF Core 10 + თავსებადი Npgsql 10 provider | მოდელები, migrations, ტრანზაქციები |
| გეოგრაფიული ძებნა | PostGIS + NetTopologySuite | მანძილის მიხედვით ინდექსირებული ძებნა |
| ავტორიზაცია | ASP.NET Core Identity + JWT + rotating refresh tokens | პაროლები და სესიები |
| რეალურ დროში ჩატი | ASP.NET Core SignalR + ოფიციალური JS client | ახალი მესიჯებისა და match-ების მოვლენები |
| მობილური | React Native + Expo + strict TypeScript | საერთო კოდი iOS/Android-ზე |
| მობილური ნავიგაცია | Expo Router | ეკრანები და deep links |
| API cache | TanStack Query | სერვერული მონაცემები, invalidation, retry |
| ფორმები | React Hook Form + Zod | მობილური ფორმების შემოწმება |
| ჟესტები და ანიმაცია | Expo-compatible Gesture Handler + Reanimated | swipe და მსუბუქი ანიმაციები |
| სენსიტიური მობილური შენახვა | expo-secure-store | refresh token |
| ფოტოები/ლოკაცია/push | Expo ImagePicker, Image, Location, Notifications | შესაბამისი native ფუნქციები |
| ადმინისტრაცია | Angular + TypeScript + Angular Material | ანგარიშები, საჩივრები, ფოტოები, მოდერაცია |
| ფაილები | კერძო S3-compatible object storage | პროფილის ფოტოები და thumbnails |
| გადადებული მიწოდება | PostgreSQL outbox + .NET BackgroundService | მოვლენები, push, cleanup jobs |
| ლოკალური გარემო | Docker Compose | PostgreSQL/PostGIS და mail capture |
| მობილური build | EAS Build, development/preview/production profiles | iOS/Android binaries |
| CI | GitHub Actions, თუ პროექტი GitHub-ზეა | build, tests, lint, contract checks |

ეს არის პროექტის არქიტექტურული არჩევანი და არა გარანტია, რომ ყველა ტექნოლოგია ყველა სხვა პროექტისთვის საუკეთესოა.

## 3. ვერსიების პოლიტიკა

.NET 10 არის არჩეული LTS საფუძველი. გამოიყენე ამ major-ის მხარდაჭერილი patch; ASP.NET Core, EF Core და Npgsql provider თავსებადი ხაზებით. ზუსტი ვერსიები შეამოწმე დანერგვის დღეს ოფიციალურ დოკუმენტაციაში.

Expo SDK აირჩიე მხარდაჭერილი stable ხაზიდან. React-ის, React Native-ის, Reanimated-ისა და native მოდულების ვერსიები შეათანხმე Expo SDK-სთან. **React Native დამოუკიდებლად უახლეს ვერსიაზე არ განაახლო.** Expo მოდულებისთვის გამოიყენე `npx expo install`; შეამოწმე `npx expo-doctor` და `npx expo install --check`.

Angular გამოიყენე მხარდაჭერილი stable major-ით და თავსებადი CLI/Material/Node.js/TypeScript ვერსიებით. ექსპერიმენტული ან preview API-ები MVP-ში არ იყოს საჭირო დამოკიდებულება.

შეინახე არჩეული ვერსიები `docs/VERSIONS.md`-ში: ტექნოლოგია, ზუსტი ვერსია, შემოწმების თარიღი, ოფიციალური წყარო. დააფიქსირე .NET SDK `global.json`-ში, NuGet dependency resolution lock-ით, Node runtime და npm lockfiles. გამოიყენე npm; CI-ში — `npm ci`. სერვერისა და DB container-ების ვერსიებიც ჩაიწეროს. არ გამოიყენო production-ში გაუკონტროლებელი `latest` image tags.

## 4. Backend-ის მოწყობა

ერთი ASP.NET Core API განთავსდება ერთი აპლიკაციის სახით. მოდულები: Auth, Profiles, Media, Discovery, Swipes, Matches, Chat, Safety, Notifications, Moderation და AccountLifecycle.

მცირე MVP-სთვის საკმარისია ერთი API project feature საქაღალდეებით, ერთი ძირითადად გამოყენებული DbContext და ცალკე test projects. რთული ბიზნესწესები იყოს სერვისებში, endpoint-ები — მოკლე. ნუ დაამატებ ცარიელ მრავალშრიან projects-ს მხოლოდ Clean Architecture-ის სახელით. არ არის საჭირო MediatR, generic repository ან microservices.

გამოიყენე:

- ASP.NET Core-ის DI, Options validation და built-in rate limiting.
- Controller-based REST API + ProblemDetails ერთიანი შეცდომებისთვის.
- async/await და CancellationToken ყველა I/O გზაზე.
- nullable reference types და compiler/analyzer შემოწმებები.
- საჯარო DTO-ები; EF entities პირდაპირ არ დაბრუნდეს API-დან.
- სერვერული ვალიდაცია; მობილურის Zod ვალიდაცია მას ვერ ჩაანაცვლებს.
- OpenAPI კონტრაქტი და `openapi-typescript`-ით გენერირებული საერთო API types; HTTP კლიენტები იყოს პატარა ტიპიზებული wrappers.

JWT ვალიდაცია შეამოწმებს signature/issuer/audience/lifetime-ს. refresh token — შემთხვევითი opaque მნიშვნელობა, hashed ბაზაში და უსაფრთხო storage-ში ტელეფონზე. როტაცია, revoke და concurrent refresh წესები ტესტებით დადასტურდეს.

## 5. მონაცემთა ბაზა: რატომ PostgreSQL

შენ SQL Server-თან მუშაობის გამოცდილებაც გაქვს. ამ პროექტში PostgreSQL არის არჩეული default, რადგან პირველი პრომტები უკვე ამ ბაზაზეა გათვლილი და მანძილის ძებნისთვის PostGIS-ს გამოვიყენებთ.

**პროექტში ერთი ძირითადი ბაზა გამოიყენე.** SQL Server-ზე გადასვლა შესაძლებელია ცალკე შეთანხმებული ცვლილებით, მაგრამ მაშინ მანძილის queries, ტრანზაქციები, migrations და concurrency tests თავიდან უნდა მოერგოს მას. Codex-მა შუა პროცესში თვითნებურად ბაზა არ შეცვალოს.

მნიშვნელოვანი წესები:

- ერთი directed swipe per pair — database unique constraint.
- match — canonical ordered pair და database unique constraint.
- ერთი conversation per match.
- განმეორებითი მესიჯი — unique clientMessageId scoped to sender/conversation.
- concurrency კონტროლი reciprocal likes, block/unmatch და send-ზე: დაფიქსირებული lock order ან სხვა დასაბუთებული DB strategy; მხოლოდ in-memory lock საკმარისი არ არის.
- keyset/cursor pagination, ინდექსები რეალური query plans-ის მიხედვით.
- UTC timestamps; DOB — date ტიპით, private ველად.
- coordinates — private geography point; საჯარო API აბრუნებს მხოლოდ coarse distance/city-ს.
- schema ცვლილებები EF migrations-ით; production migration ცალკე release step.

ინტეგრაციული ტესტები უნდა მუშაობდეს რეალურ PostgreSQL/PostGIS-ზე, მაგალითად Testcontainers-ით. SQLite ან EF InMemory ამ სისტემის relational/concurrency გარანტიების შემოწმებას ვერ ჩაანაცვლებს.

## 6. iOS/Android მობილური

მომხმარებლის აპი — Expo development build, React Native, Expo Router და strict TypeScript. Expo Go დასაწყისის სწრაფი UI შემოწმებისთვის შეიძლება გამოიყენო, მაგრამ build-ების, permissions-ისა და remote push-ის დასადასტურებლად საკმარისი არ არის.

მონაცემების პასუხისმგებლობა:

- TanStack Query — სერვერული პროფილები, discovery, matches და chat history.
- React local state — მცირე UI state; Zustand მხოლოდ რეალური საჭიროების გაჩენისას.
- SecureStore — refresh token; access token სასურველია memory-ში.
- არასენსიტიური preferences-ისთვის — AsyncStorage; tokens და private chat history იქ ავტომატურად არ შეინახო.
- Query cache keys მოიცავს account scope-ს; logout/account switching-ზე private caches გასუფთავდეს.
- chat pending messages და idempotency ID-ები მართავდეს ერთი განსაზღვრული მოდული. MVP-ში app restart-ის შემდეგ ავტომატური offline sends არ მოხდეს, თუ უსაფრთხო persistent queue არ არის გაკეთებული და ტესტირებული.

რეკომენდებული native dependencies: `expo-secure-store`, `expo-image-picker`, `expo-image`, `expo-location`, `expo-notifications`, `expo-linking`, safe-area support, Gesture Handler და Reanimated. დააყენე მხოლოდ ის პაკეტები, რომლებიც ამ ეტაპის ფუნქციას სჭირდება. დეკოდირების/ანიმაციისა და Android/iOS მხარდაჭერა გადაამოწმე არჩეულ SDK-ზე.

ფორმებისთვის React Hook Form/Zod; ქართული/ინგლისური ტექსტებისთვის i18next/react-i18next. სტილისთვის React Native StyleSheet + საერთო design tokens; მეორე UI framework არ დაამატო ზედმეტად.

მობილურის `EXPO_PUBLIC_*` ცვლადები საჯაროა: იქ მხოლოდ API URL და მსგავსი არასენსიტიური კონფიგურაცია იყოს. DB credentials, signing keys და სერვერის email/storage საიდუმლოები მობილურ აპში არასოდეს მოხვდეს.

## 7. Angular ადმინისტრაცია

Angular აპი არის მოდერატორის და ადმინისტრატორის პანელი: photo approval, reports, suspension/reactivation და audit. ჩვეულებრივი მომხმარებლის ვებვერსია ამ MVP-ის მოცულობაში არ შედის.

გამოიყენე standalone components, Angular Router, Reactive Forms, HttpClient, Angular Material/CDK, Signals მცირე view state-სთვის და RxJS ასინქრონული ნაკადებისთვის. NgRx ამ მცირე პანელისთვის ავტომატურად არ დაამატო.

ადმინპანელი სერვერთან ერთ origin-ზე განთავსდეს reverse proxy-ით: `/admin` — Angular; `/api` და `/hubs` — backend. SPA deep routes სწორად fallback-დეს, მაგრამ API შეცდომები index.html-ად არ გადაიქცეს.

ადმინის ავტორიზაცია — ცალკე ASP.NET Core Identity cookie scheme, HttpOnly/Secure cookie, MFA და antiforgery დაცვა ყველა cookie-authenticated mutation-ზე. Angular-ში route guard მხოლოდ UX-ია; role/resource authorization ყოველთვის API-ზე სრულდება. Admin credentials/token არ შეინახო localStorage-ში.

თუ deployment სხვადასხვა origins-ს მოითხოვს, ცალკე დააფიქსირე CORS/cookie/CSRF კონფიგურაცია და ტესტები; wildcard origin + credentials არ გამოიყენო. არ აურიო admin cookie scheme და mobile JWT scheme.

## 8. ჩატი, push და background jobs

SignalR გამოიყენე შეტყობინებებისთვის; ტექსტური მესიჯის authoritative write path იყოს REST API. მესიჯი ჯერ DB-ში ინახება, შემდეგ outbox-ის გზით გამოიგზავნება live event. აპი ხელახლა დაკავშირებისას ისტორიიდან ავსებს გამოტოვებულ მოვლენებს.

Hub-ზე საჭიროა ავტორიზაცია და conversation membership/block/account სტატუსის შემოწმება. groups უსაფრთხოების საზღვარი არ არის. შეტყობინების გაგზავნა blocked/unmatched pair-ზე სერვერმა უნდა აკრძალოს.

Outbox და cleanup jobs მუშაობდეს .NET BackgroundService-ით PostgreSQL-ზე. Worker-ს ჰქონდეს leasing/claiming, bounded retries, backoff და dead-letter ხედვა; process crash-ზე დავალება არ დაიკარგოს. საერთო transaction-ში შეინახე მონაცემის ცვლილება და outbox event.

Push — Expo Push Service, `expo-notifications`, შესაბამისი APNs/FCM credentials. device tokens encrypt-დება მიწოდებისთვის და hash გამოიყენება lookup-ზე; encryption key ინახება server secret store-ში და როტაციის გზა დოკუმენტირდება. logout/ownership transfer/provider rejection შესაბამის token-ს აუქმებს.

MVP deployment: ერთი API instance. მასშტაბირებამდე შეამოწმე SignalR fan-out, outbox claiming და distributed concurrency. Redis/backplane დაემატოს მაშინ, როცა რამდენიმე instance რეალურად დაგჭირდება; ის არც ბაზას და არც authorization-ს არ ცვლის.

## 9. ფოტოები და ელფოსტა

ფოტოები ინახება private S3-compatible object storage-ში; DB-ში metadata და server-owned keys. ლოკალურად — private storage adapter, production-ში — არჩეული პროვაიდერი credential configuration-ით. public bucket ან permanent public photo URLs default არ იყოს.

ხანმოკლე signed access გამოიყენე thumbnail/original retrieval-სთვის შესაბამისი ავტორიზაციის შემდეგ. upload content validation, decoded-size limits, EXIF removal და re-encoding სერვერზე შესრულდეს. iPhone HEIC input გადაიყვანე მხარდაჭერილ ფორმატში და რეალური მოწყობილობით გადაამოწმე; მხოლოდ extension-ის შეცვლა conversion არ არის.

სერვერის image processing library აირჩიე მიმდინარე .NET/Linux მხარდაჭერისა და ლიცენზიის შემოწმების შემდეგ; გადაწყვეტილება ჩაიწეროს DECISIONS.md-ში. არ ჩართო დაუდასტურებელი decoder production-ში.

ელფოსტა — MailKit SMTP transport აბსტრაქციის უკან, ან კონკრეტული პროვაიდერის ოფიციალური SDK საჭიროებისას. ლოკალურად — Mailpit. რეალური domain/sender/SMTP secrets მომხმარებლის მიერ გაიცემა; production-ში development mail capture არ ჩაირთოს.

## 10. ტესტები და მონიტორინგი

| დონე | ინსტრუმენტი | რას ვამოწმებთ |
|---|---|---|
| C# unit tests | xUnit | ბიზნესწესები და state transitions |
| API integration | WebApplicationFactory + Testcontainers PostgreSQL/PostGIS | ავტორიზაცია, DB constraints, ტრანზაქციები |
| მობილური component tests | Expo-compatible Jest + React Native Testing Library | UI states, retry, cache isolation |
| Native E2E | Maestro, ცალკე iOS/Android flows | register → swipe → match → chat → block |
| Angular tests | არჩეული Angular CLI-ის მხარდაჭერილი runner | forms, service behavior, guarded navigation |
| Admin E2E | Playwright | moderation, roles, CSRF/session flow |
| დატვირთვა | k6, მხოლოდ საკუთარი test/staging გარემო | discovery/chat latency და შეცდომები |

პირველ რიგში ტესტები რთული ბიზნესწესებისთვის და რეალური რეგრესიებისთვის. მხოლოდ coverage პროცენტის მისაღებად implementation-mirroring tests არ დაწერო.

Logging: Microsoft.Extensions.Logging სტრუქტურირებული JSON output-ით. logs-ში არა raw tokens, coordinates, emails ან message bodies. OpenTelemetry გამოიყენე უსაფრთხო server metrics/traces-ისთვის. მობილური crash reporting, მაგალითად Sentry, ჩაირთოს მხოლოდ არჩეული პროვაიდერისა და privacy configuration-ის შეთანხმების შემდეგ; error payloads გაწმინდე სენსიტიური მონაცემებისგან.

## 11. გარემო, hosting და build

შენ Windows-იდან შეგიძლია დაწერო backend, Angular და mobile კოდი და Android emulator გამოიყენო. iOS-ის ადგილობრივი Xcode build/simulator მოითხოვს macOS-ს; EAS cloud build ამ ადგილობრივ build-ის საჭიროებას ამცირებს, მაგრამ რეალურ iPhone-ზე ტესტს არ ანაცვლებს.

საჭიროა .NET SDK, თავსებადი Node.js, Git, Docker Desktop ან სხვა ხელმისაწვდომი Docker runtime, Android Studio და ტელეფონები. cloud builds/signing/store distribution მოითხოვს შესაბამის user-owned ანგარიშებსა და credentials-ს. ფასი/ანგარიშის მოთხოვნები შექმნის დღეს გადაამოწმე; საიდუმლოები დოკუმენტში არ ჩაწერო.

Production backend-ის მოთხოვნები: მუდმივად გაშვებადი process, HTTPS/WSS, WebSocket support, საკმარისი რესურსები, worker-ის მუშაობა, private object storage და DB backup/restore. Hosting provider ამ ფაილით არ არის არჩეული; შეამოწმე ეს შესაძლებლობები შეძენამდე. shared hosting-ს მხარდაჭერა ავტომატურად არ მიაწერო.

Production deployment — Linux container ან სხვა გამართული .NET hosting; PostgreSQL backup-ით; ერთი origin admin/API-სთვის. არც container და არც EAS build თავისთავად არ ნიშნავს, რომ აპი უკვე უსაფრთხო ან store-approved არის.

## 12. რეპოზიტორიის სტრუქტურა

| გზა | შინაარსი |
|---|---|
| `backend/Dating.Api/` | ASP.NET Core API, Features, Persistence და Workers |
| `backend/tests/Dating.UnitTests/` | ბიზნესწესები |
| `backend/tests/Dating.IntegrationTests/` | API/DB/concurrency ტესტები |
| `mobile/` | Expo React Native აპი |
| `admin/` | Angular მოდერატორის პანელი |
| `packages/api-contract/` | გენერირებული TypeScript API types |
| `infra/` | Docker Compose, deployment templates |
| `docs/` | STATUS, DECISIONS, API, VERSIONS, TESTING, BUGS, RELEASE |

Shared API contract აიწყოს როგორც ჩვეულებრივი TypeScript package, რომელსაც Angular-ის და Expo-ს bundlers რეალურად ამუშავებენ. Monorepo tooling მხოლოდ საჭიროების მიხედვით; Nx/Turborepo თავიდან სავალდებულო არ არის.

## 13. Codex-ს მიეცი ეს პრომტი პირველივე ეტაპზე

```text
Read Dating-App-Tech-Stack.md and Dating-App-Codex-Prompts.md before implementation. Use the functional stages from the prompts file and the concrete stack decisions from the tech-stack file.

The agreed stack is C#/.NET 10 LTS + ASP.NET Core Web API + EF Core + PostgreSQL/PostGIS + ASP.NET Core Identity + SignalR; React Native/Expo/TypeScript for both iOS and Android; Angular/Angular Material for the moderator/admin interface.

Important clarification: stage 9's server-rendered admin default is superseded by Angular. Build one Angular admin, retaining server-side role/resource authorization, MFA and CSRF protection. Keep Angular admin cookie auth separate from mobile bearer-token auth. Do not introduce a public consumer website into the MVP.

Inspect existing repository instructions and code. If implementation already exists, preserve it and document any discrepancy rather than rewriting the entire repository or silently replacing its database/framework. For a new repository, apply the stack from the beginning. Record migration plans for material existing-stack differences before performing them.

Verify supported stable and compatible package versions in current official documentation, pin them and record the compatibility matrix in docs/VERSIONS.md. Install Expo native dependencies with expo install. Do not independently upgrade React Native outside the selected Expo SDK's compatibility range.

Use a modular monolith, a single primary relational database, REST as the authoritative chat write path, SignalR events for updates, and a persisted PostgreSQL outbox for eventual delivery. Implement business authorization and uniqueness/concurrency guarantees server-side with real PostgreSQL integration tests. Never use a frontend guard, in-memory lock or optimistic UI as the only correctness control.

Prepare separate iOS and Android development/preview/release builds and verification steps. Do not claim physical-device or push verification unless actually performed. Do not publish or purchase services unless separately requested. Follow all stage acceptance criteria and update STATUS.md after each stage.

Proceed with the currently requested numbered stage; do not attempt to implement all stages in one uncontrolled change.
```

## 14. ოფიციალური წყაროები და განახლების წესი

- .NET მხარდაჭერა: https://dotnet.microsoft.com/en-us/platform/support/policy
- Npgsql EF Core 10: https://www.npgsql.org/efcore/release-notes/10.0.html
- Npgsql spatial mapping: https://www.npgsql.org/efcore/mapping/nts.html
- Angular მხარდაჭერა: https://angular.dev/reference/releases
- Angular version compatibility: https://angular.dev/reference/versions
- Expo SDK: https://docs.expo.dev/versions/latest/
- Expo development builds: https://docs.expo.dev/develop/development-builds/introduction/
- Expo EAS: https://docs.expo.dev/tutorial/eas/introduction/
- Expo SecureStore: https://docs.expo.dev/versions/latest/sdk/securestore/
- Expo Notifications: https://docs.expo.dev/versions/latest/sdk/notifications/
- SignalR authorization: https://learn.microsoft.com/aspnet/core/signalr/authn-and-authz
- TanStack Query / React Native: https://tanstack.com/query/latest/docs/framework/react/react-native

ფაილი ასახავს არქიტექტურულ არჩევანს მომზადების თარიღისთვის. ზუსტი patch ვერსიები და store მოთხოვნები Codex-მა ინსტალაციის/გამოშვების მომენტში გადაამოწმოს. არ დაამატოს ახალი framework მხოლოდ იმიტომ, რომ ახალი ან პოპულარულია.
