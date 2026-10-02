# Permanent working rules

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

## Concrete stack clarification
Read Dating-App-Tech-Stack.md and Dating-App-Codex-Prompts.md before changes. Use .NET 10 LTS, EF Core 10, Npgsql 10 and PostgreSQL/PostGIS. The sole moderator/admin frontend is Angular with Angular Material, superseding the server-rendered default in Prompt 9. Keep admin cookie/MFA/CSRF security separate from mobile bearer authentication. Implement only the requested stage.
