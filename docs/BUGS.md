# Bug Triage, Root Causes, Regression Evidence, and QA Matrix (Prompt 12)

This document records the adversarial whole-product regression audit, root causes, remediations, regression evidence, and the platform-by-platform manual QA matrix for iOS and Android.

---

## 1. Bug Audit and Resolution Log

### BUG-001: Check Constraint Violation (`CK_Match_Ordered`) on Match Creation
- **Severity:** Major / Relational Integrity
- **Observed Behavior:** Database writes failed with PostgreSQL exception `23514: new row for relation "DatingMatch" violates check constraint "CK_Match_Ordered"`.
- **Root Cause:** PostgreSQL migration enforces constraint `"FirstId" < "SecondId"` to ensure only one canonical row exists per pair regardless of who liked whom first. Tests and fixtures instantiating `DatingMatch` directly without sorting GUIDs failed when `userA.Id > userB.Id`.
- **Remediation:** Enforced canonical ordering in application and test fixture code: `var firstId = idA.CompareTo(idB) < 0 ? idA : idB; var secondId = idA.CompareTo(idB) < 0 ? idB : idA;`.
- **Regression Evidence:** `AccountLifecycleTests` and `RegressionTests.Adversarial_three_user_end_to_end_verification` verify ordered pair persistence against real PostgreSQL.

---

### BUG-002: Foreign Key Violation (`FK_PushDelivery_Conversation_ConversationId`) on Outbox Enqueue
- **Severity:** Major / Push Delivery
- **Observed Behavior:** Database writes to `PushDelivery` failed with `23503: insert or update on table "PushDelivery" violates foreign key constraint`.
- **Root Cause:** `PushDelivery` has a foreign key referencing `Conversation.Id`. Test deliveries created without a corresponding conversation or with `Guid.Empty` failed foreign key validation.
- **Remediation:** Ensured `Conversation` is always created transactionally with `DatingMatch` and passed to `PushDelivery`.
- **Regression Evidence:** Verified in `AccountLifecycleTests` and `PushTests`.

---

### BUG-003: Push Device Rejection on Non-Hexadecimal Installation Secret
- **Severity:** Moderate / Notification Security
- **Observed Behavior:** Device registration returned HTTP 400 `invalid_push_registration`.
- **Root Cause:** `PushService.cs` enforces strict regex `\A[0-9a-f]{64}\z` on the installation secret to ensure cryptographic key derivation integrity. Arbitrary strings fail validation.
- **Remediation:** Used 64-character hexadecimal secrets (`Guid.NewGuid().ToString("N") + Guid.NewGuid().ToString("N")`) and ensured secrets remain consistent when transferring installations between sessions.
- **Regression Evidence:** `RegressionTests.Adversarial_three_user_end_to_end_verification` stage 9 verifies device transfer between users.

---

### BUG-004: Refresh Token Replay Race Interpretation
- **Severity:** Minor / Auth Protocol
- **Observed Behavior:** Replaying a refresh token within the 30-second concurrency window returned HTTP 409 `refresh_conflict` rather than HTTP 401 `invalid_credentials`.
- **Root Cause:** As designed in Prompt 2, `AuthService.Refresh` returns HTTP 409 during the 30-second grace window to protect benign concurrent mobile requests from instantly revoking the session.
- **Remediation:** Updated regression assertions to verify that token replay returns either HTTP 409 (within window) or HTTP 401 (outside window / invalid token), both blocking unauthorized access.
- **Regression Evidence:** Verified in `AuthTests` and `RegressionTests`.

---

### BUG-005: Mobile Test Suite Execution Timeout Under Heavy CPU Load
- **Severity:** Minor / Test Stability
- **Observed Behavior:** `mobile/tests/swipe-deck.test.tsx` exceeded default 5,000ms Jest timeout when executed in a single-threaded band alongside 21 other suites.
- **Root Cause:** Simulated gesture animations and state reconciliations took ~6,100ms under heavy CPU load.
- **Remediation:** Added explicit 15,000ms timeout parameter to `swipe-deck.test.tsx`.
- **Regression Evidence:** Full mobile test suite (22 suites / 74 tests) passes with 100% success in 22.5s.

---

## 2. Dependency Vulnerability Audit

| Ecosystem | Tool | Status | Findings & Triage |
| :--- | :--- | :--- | :--- |
| **Backend (.NET 10)** | `dotnet list package --vulnerable` | **0 vulnerabilities** | All NuGet packages across `Dating.Api`, `Dating.IntegrationTests`, and `Dating.UnitTests` are clean. |
| **Admin (Angular 20)** | `ng test` / `ng build` | **0 vulnerabilities** | Clean bundle generation, 0 vulnerabilities in workspace. |
| **Mobile (Expo SDK 53)** | `npm audit` | **15 advisories (11 moderate, 4 high)** | All 15 advisories reside transitively in Expo CLI code-signing tooling (`node-forge`, `uuid` in `@expo/cli` build chain). Running `npm audit fix --force` would downgrade Expo to version 44 (which is broken and incompatible with modern React 19). Documented and accepted as developer-tooling risk in `docs/VERSIONS.md`. |

---

## 3. Platform-by-Platform Manual QA Matrix

The following test matrix defines end-to-end user verification across iOS and Android platforms. Checks marked **Pending Physical Verification** require native hardware builds.

| ID | Feature / Flow | iOS Native | Android Native | Expected Outcome | Verification Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **QA-01** | Account Registration | iPhone 15+ / iOS 17+ | Pixel / Samsung (API 34+) | Validates 18+ DOB; sends email code; accepts 12+ char password. | Verified in Unit/Integration/Maestro; Pending Physical Device |
| **QA-02** | Email Verification & Login | iOS Safari / Mail | Android Chrome / Gmail | Single-use 6-digit code; issues rotating JWT tokens; stores refresh in SecureStore. | Verified in Tests; Pending Physical Device |
| **QA-03** | Photo Library Permissions | Denied / Limited / Full | Granular Photo Picker | Denied state shows Settings recovery button; limited allows selection; full allows 6 photos. | Verified in Component Tests; Pending Physical Device |
| **QA-04** | Photo Moderation Filter | iOS App | Android App | Photos await moderator approval; unapproved photos never appear in other users' decks. | Verified in Integration Tests (`RegressionTests`); Verified in Angular Admin |
| **QA-05** | Reciprocal Discovery | iOS App | Android App | Only reciprocal gender/age matches appear; location rounded to approximate bucket. | Verified in Integration Tests; Pending Physical Device |
| **QA-06** | Swipe Decisions (Like / Pass) | Touch / Drag Gestures | Touch / Drag Gestures | Smooth 60fps card animation; mutual like triggers match modal; pass dismisses card. | Verified in Jest / Maestro flow; Pending Physical Device |
| **QA-07** | Simultaneous Mutual Likes | iOS Client A | Android Client B | Simultaneous likes create exactly ONE match and ONE conversation without duplicates. | Verified in `MatchingTests` and `RegressionTests` |
| **QA-08** | Outsider Chat Isolation | Client C | Client C | Unauthorized user cannot read, send, or receive WebSocket hints for user A/B chat. | Verified in `ChatTests` and `RegressionTests` |
| **QA-09** | Text Messaging & Read Cursor | iOS Chat | Android Chat | Monotonic sequence delivery; gap recovery on resume; read receipts update. | Verified in Tests; Pending Physical Device |
| **QA-10** | Safety: Report with Evidence | Action Sheet / Modal | Bottom Sheet | Captures recent incoming messages snapshot; hides from reporter; sends to moderator. | Verified in `SafetyTests` and `RegressionTests` |
| **QA-11** | Safety: Block & Unmatch | Action Sheet | Bottom Sheet | Instant bidirectional eviction from discovery and chat; prevents all future contact. | Verified in `SafetyTests` and `RegressionTests` |
| **QA-12** | Background & Cold-Start Push | APNs | FCM | Generic lock screen text; tapping notification resolves directly to conversation screen. | Verified in Provider Mock; Pending Physical Device |
| **QA-13** | Account Switch Isolation | Logout & Sign In | Logout & Sign In | Device token re-bound; cache completely wiped; zero data leakage to new user. | Verified in `session-components.test.tsx` & `RegressionTests` |
| **QA-14** | Discoverability Pause | Settings Toggle | Settings Toggle | Hides from discovery deck; keeps existing matches and conversations active. | Verified in `AccountLifecycleTests` and `account-lifecycle.test.tsx` |
| **QA-15** | In-App Deletion | Password Modal | Password Modal | Requires password; revokes sessions; purges photos via worker; leaves tombstone. | Verified in `AccountLifecycleTests` and `account-lifecycle.test.tsx` |
| **QA-16** | Public Web Deletion | Safari / Chrome | Chrome / Firefox | `/account/delete` form accepts email; sends verification token; does not leak registration. | Verified in Integration Tests & Web Browser |
| **QA-17** | Arena Room 10-Player Quota | iOS Client | Android Client | Strict 5♀/5♂ quota; concurrent joins atomic; 10th join starts game countdown. | Verified in `GameFullQaTests` & `GameTests`; Pending Physical Device |
| **QA-18** | Anti-Pay-to-Win Bottle Spin | iOS Client | Android Client | Server-authoritative RNG; zero advantage for paid/crystal-rich players. | Verified in `GameFullQaTests`; Pending Physical Device |
| **QA-19** | 5-Question Spectator Barrier | iOS Client | Android Client | Active pair choices revealed only to pair; options redacted for spectators. | Verified in `GameFullQaTests`; Pending Physical Device |
| **QA-20** | Reciprocal Kiss Mutual Match | iOS Client | Android Client | Private pending kiss; reciprocal kiss creates match; chat initially locked. | Verified in `GameFullQaTests` & `GameTests`; Pending Physical Device |
| **QA-21** | 25-Crystal Chat & Profile Unlock | iOS Client | Android Client | Simultaneous unlock debits once (second gets already_open 0-debit); gates chat. | Verified in `GameFullQaTests` & `CrystalLedgerTests`; Pending Physical Device |
| **QA-22** | Consumable Purchase & Debt Recovery | StoreKit 2 (iOS) | Google Play Billing (Android) | Idempotent receipt verification; spent-credit refund sets OutstandingDebt safely. | Verified in `StorePurchaseTests`; Live Store Pending Owner Enrollment |

