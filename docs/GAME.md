# Arena Bottle Game Architecture & Specifications

This document specifies the architecture, data models, state machine, and security invariants for the **Arena Bottle Game** within DatingMVP.

---

## 1. Overview & Core Concept

The **Arena Bottle Game** is an interactive, real-time multiplayer feature where users enter 10-person virtual rooms to play a bottle-spinning social game with matchmaking mechanics.

### Key Tenets
1. **Balanced Quotas & Formats**: Rooms enforce strict 50/50 gender quotas for 3 selectable formats:
   - **6-player**: 3 female (`woman`) and 3 male (`man`)
   - **8-player**: 4 female (`woman`) and 4 male (`man`)
   - **10-player**: 5 female (`woman`) and 5 male (`man`)
2. **Single Active Presence**: A user may participate in at most one active queue or room at any given time. While searching or joined at a table, joining another queue or table is blocked with 409 `active_membership_exists`.
3. **Strict Eligibility**: Only adult (18+), verified, complete profiles with approved photos may join the queue or create rooms.
4. **Safety & Prior History Exclusion**: Users who are incompatible can NEVER share a table together:
   - **Blocks**: If user A has blocked user B (or B blocked A), they are excluded.
   - **Unmatches**: If user A and user B have unmatched (`UnmatchedPair`), they are excluded.
   - **Active Matches**: If user A and user B already have an active match (`DatingMatch.Active == true`), they are excluded.
   - If an outsider attempts to view or join an incompatible room directly, they receive a neutral 404 response (`room_unavailable`).
5. **Complete Invisibility of Starting / Playing Tables**: Tables that have transitioned to `Starting` or `Playing` are strictly invisible to outsiders:
   - They are completely omitted from public room listings (`GET /api/game/rooms`).
   - Any outsider attempting `GET /api/game/rooms/{id}` or `POST /api/game/rooms/{id}/join` receives 404 `room_unavailable`.
   - Only currently joined members can view and interact with their starting/playing room via `GET /api/game/current` or `GET /api/game/rooms/{id}`.
6. **No Speculative Data Leaks**: Room summaries and details never expose private user information (e.g., location, email, birth date, discovery radius). Only public nicknames, gender, age, bio, and approved avatar photos are transmitted.

---

## 2. Room & Membership Lifecycle

### State Machine

```
              ┌───────────────┐
              │     Lobby     │ <── Room Created (5 ♀ / 5 ♂ quota)
              └───────┬───────┘
                      │
        ┌─────────────┴─────────────┐
        │                           │
  Full Capacity (5+5)         Timer Fallback (>= 30s)
  or Ready Trigger            & >= 3 ♀ + 3 ♂ active
        │                           │
        ▼                           ▼
  ┌───────────┐               ┌───────────┐
  │ Starting  │               │ Starting  │
  └─────┬─────┘               └─────┬─────┘
        │                           │
        └─────────────┬─────────────┘
                      │ (Prompt 16+)
                      ▼
               ┌───────────────┐
               │    Active     │
               └───────┬───────┘
                       │
       ┌───────────────┴───────────────┐
       ▼                               ▼
┌──────────────┐              ┌────────────────┐
│    Ended     │              │   Cancelled    │
└──────────────┘              └────────────────┘
```

### State Definitions
- **`Lobby`**: The room is open for players to join and leave. Gender quotas are actively enforced.
- **`Starting`**: Quorum has been satisfied (either full 5 ♀ + 5 ♂ or lobby fallback threshold of >= 3 ♀ and >= 3 ♂ active for >= 30 seconds). Transition to gameplay.
- **`Active`**: Game rounds are underway (spin, truth/action questions, kisses, matching). (Deferred to Prompt 16+).
- **`Ended`**: Room session completed successfully. All memberships marked `Left` or `Ended`.
- **`Cancelled`**: Room cancelled due to insufficient players or moderator action.

---

## 3. Data Model

### `GameRoom`
Persisted in PostgreSQL table `GameRooms`:

| Field | Type | Description |
|---|---|---|
| `Id` | `uuid` (PK) | Unique room identifier |
| `Title` | `text` | Display title (max 60 characters) |
| `State` | `GameRoomState` | `Lobby`, `Starting`, `Active`, `Ended`, `Cancelled` |
| `Capacity` | `int` | Maximum room capacity (default: 10) |
| `FemaleQuota`| `int` | Female slot quota (default: 5) |
| `MaleQuota` | `int` | Male slot quota (default: 5) |
| `CreatedByUserId` | `uuid` | User who created the room |
| `CreatedAt` | `timestamptz` | Room creation timestamp (UTC) |
| `StartedAt` | `timestamptz?` | Timestamp when room transitioned to Starting/Active |
| `EndedAt` | `timestamptz?` | Timestamp when room closed |

### `GameMembership`
Persisted in PostgreSQL table `GameMemberships`:

| Field | Type | Description |
|---|---|---|
| `Id` | `uuid` (PK) | Unique membership identifier |
| `RoomId` | `uuid` (FK) | Reference to `GameRoom` |
| `UserId` | `uuid` (FK) | Reference to `ApplicationUser` |
| `Status` | `GameMembershipStatus` | `Active`, `Left`, `Kicked`, `Disconnected` |
| `JoinedAt` | `timestamptz` | Membership start timestamp (UTC) |
| `LeftAt` | `timestamptz?` | Membership exit timestamp (UTC) |

### Constraints & Indexes
- **Single Active Room Rule**: Enforced at the database level with a partial unique index:
  ```sql
  CREATE UNIQUE INDEX "IX_GameMemberships_UserId"
  ON "GameMemberships" ("UserId")
  WHERE "Status" = 'Active';
  ```
- **Foreign Keys**: Room cascade delete; User restrict delete (managed via `AccountLifecycleService` invalidation hooks).

---

## 4. Quota & Concurrency Enforcement

### Atomic Join Flow
To prevent race conditions when multiple players join simultaneously:
1. Begin EF Core database transaction with serializable isolation / row lock (`FOR UPDATE` pattern).
2. Fetch the target room and verify `State == Lobby`.
3. Verify that the joining user does not already have an `Active` membership in any room.
4. Count current active members in the room by gender:
   - For `woman`: count active females. If `>= FemaleQuota` (5), reject with `female_quota_full`.
   - For `man`: count active males. If `>= MaleQuota` (5), reject with `male_quota_full`.
   - Total active count must not exceed `Capacity` (10), otherwise reject with `room_full`.
5. Insert new `GameMembership` record with `Status = Active`.
6. Re-evaluate start condition:
   - If `femaleCount == 5 && maleCount == 5`, transition `room.State = Starting`.
   - If room has been in `Lobby` for `>= 30 seconds` and `femaleCount >= 3 && maleCount >= 3`, transition `room.State = Starting`.
7. Commit transaction.

---

## 5. Security, Eligibility & Privacy Invariants

### Server-Side Eligibility Rules
Before allowing a user to create or join a room, `GameService.ValidateEligibilityAsync` strictly verifies:
1. **Age**: User must be at least 18 years old (calculated server-side from `BirthDate`).
2. **Email Verification**: User account must have `EmailConfirmed == true`.
3. **Account Status**: User must not be deleted or suspended (`Active == true`).
4. **Profile Completion**: User must have a completed profile (`DisplayName`, `Gender`, `BirthDate`, `InterestedIn`).
5. **Approved Photo**: User must have at least one approved photo in `Approved` state.
6. **Matching Orientation**: Default 5+5 room requires reciprocal opposite-sex orientation (`woman` seeking `man`, or `man` seeking `woman`).

### Blocked Pairs Exclusion
When a user attempts to join a room:
- We check if any active room member has blocked the joining user, or if the joining user has blocked any active member.
- If a block relation exists in either direction, the request is rejected with `404 Not Found` (`room_unavailable`), preventing either party from detecting the other's room presence.

### Account Invalidation Hooks
- **Account Deletion (`AccountLifecycleService`)**: When an account is scheduled for deletion, all active game memberships are automatically marked `Left`.
- **Account Suspension (`ModerationService`)**: When a moderator deactivates an account, all active game memberships are automatically terminated.

---

## 6. API Endpoints

| Method | Route | Description | Auth |
|---|---|---|---|
| `GET` | `/api/game/current` | Get active game room for current authenticated user | Bearer |
| `POST` | `/api/game/queue` | Enter matchmaking queue for format (6, 8, or 10 players) | Bearer |
| `GET` | `/api/game/rooms` | List open lobby rooms (Starting/Playing are hidden) | Bearer |
| `POST` | `/api/game/rooms` | Create a new room with capacity (6, 8, or 10) | Bearer |
| `GET` | `/api/game/rooms/{id}` | Get room details (404 if Starting/Playing for non-members) | Bearer |
| `POST` | `/api/game/rooms/{id}/join` | Join room with atomic quota & incompatibility verification | Bearer |
| `POST` | `/api/game/rooms/{id}/leave` | Leave active room membership | Bearer |
| `POST` | `/api/game/rooms/{id}/dev-fixtures` | Seed test fixtures for local testing (Dev only) | Bearer |

---

## 7. Mobile UI Integration

- **Tab Navigation**: The mobile app includes a dedicated tab (`🍾 Arena`, `(tabs)/game.tsx`, testID: `nav-game`).
- **Format Selection**: 3 mode cards to select 6-Player (3♀ / 3♂), 8-Player (4♀ / 4♂), or 10-Player (5♀ / 5♂) tables.
- **Matchmaking Radar / Queue Screen**: While in `Lobby`, displays live search indicator, capacity progress badge, gender breakdown (`F/quota ♀`, `M/quota ♂`), and cancel search button.
- **Privacy & Safety Assurance Card**: Informs users that past matches, unmatches, and blocked users are automatically excluded.
- **Private Table View**: When quorum is reached, table switches to `Starting` / `Playing` state, with private room banner indicating the room is invisible to outsiders.
- **Dev Tool Helper**: In development mode (`__DEV__`), provides quick buttons to populate test fixtures for easy verification.
