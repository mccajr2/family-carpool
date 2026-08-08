# Spec: adult-auth-magic-link

Status: done  
Created: 2026-08-07  
Approved: 2026-08-07  
Completed: 2026-08-07  
Parent: [docs/roadmap.md](../../roadmap.md)

## Problem

Later slices (family circle, calendar, carpool) need a stable **per-adult
identity**. The repo still has only the greeting harness — no accounts, no
sessions, no way for web / Android / iOS to prove who is calling the API.
Without a shared sign-in path, every product feature would invent its own
identity hack.

## Non-goals

- **Magic links** — v1 is **email one-time code only** (better shared UX across
  three clients; deep links deferred).
- **Optional password** — `adult-optional-password`.
- **Sign in with Apple / Google** — parking: `sign-in-apple-google`.
- **Display name / profile completion** — collect when creating or joining a
  family circle (`family-circle-and-kids`), not at first sign-in.
- **Family circle, kids, invites, roles** — later slices.
- **Production SMTP/API mail** — interface + **dev delivery** only here; real
  provider is Upcoming `auth-email-delivery` (pre-beta).
- **HTTP-only cookie auth for web** — Bearer everywhere in v1; web hardening is
  Upcoming `web-auth-session-hardening` (pre-beta).
- **Refresh tokens / sliding sessions / device management** — single opaque
  Bearer session with logout/revoke is enough for v1.
- **OpenAPI codegen** — hand-written clients stay the pattern.
- **App identity rename** (`com.yourorg.quickapp` → product name) — parking:
  `app-identity-rename` (can stay template identity for this PR).

## Approach

Add a Spring Modulith **`auth`** (or `identity`) vertical module plus durable
storage (Postgres in app config; testcontainers or equivalent for integration
tests — first persistence in this product repo).

**Sign-in flow (all clients):**

1. `POST` request code with email → server creates a short-lived, **hashed**,
   single-use code; delivers via a `MailSender`-style port.
2. **Dev:** log the code (and optionally echo only when a explicit dev profile
   flag is on — never in prod config).
3. `POST` verify with email + code → on success, **auto-create** the adult if
   new; create an opaque session; return **Bearer token** + adult summary
   (`id`, `email`; `displayName` null until family-circle).
4. Authenticated calls send `Authorization: Bearer <token>`.
5. `GET` current adult + `POST` logout (revoke session).

**Contract:** replace the greeting-only OpenAPI with auth paths and a Bearer
HTTP security scheme. **Remove** `GET /api/greeting` in the same change (web +
mobile clients updated together per AGENTS.md).

**Delete greeting harness (this PR):** auth is the first real product slice.
Follow `docs/using-as-template.md` — remove `backend/modules/greeting/`, greeting
clients/UI on web + Android + iOS, greeting tests, and point README quick start
at the auth smoke path. Keep `ModularityTests`.

**Clients:** hand-written API + session storage in `web/src/api/` and
`mobile/sharedLogic`; minimal sign-in / signed-in / sign-out UI on **web,
Android, and iOS** in the same PR (these UIs replace the greeting demo). Mobile
tokens in platform secure storage; web uses in-memory or equally deliberate
short-lived storage (not “dump in localStorage forever”) pending
`web-auth-session-hardening`.

**Security baseline in this PR:** HTTPS assumed for any shared deploy; code TTL
+ rate limits on request/verify; hashed codes; opaque revocable sessions;
no tokens in URLs or access logs.

## Acceptance criteria

- [x] OpenAPI documents request-code, verify-code, current-adult, and logout
      (or equivalent names), plus a Bearer HTTP security scheme; **no** greeting
      path remains.
- [x] Requesting a code for a valid email returns a success response that does
      **not** include the plaintext code in production-shaped config; under the
      documented **dev** delivery path, a developer can complete verify without
      real SMTP.
- [x] Verifying a correct, unexpired, unused code creates an adult on first use
      and returns a Bearer token; repeating verify with the same code fails.
- [x] Invalid / expired / rate-limited request or verify fails with documented
      status codes (no account enumeration beyond what the locked UX requires —
      same response shape for known vs unknown email on request-code if feasible).
- [x] `GET` current adult with a valid Bearer returns that adult; without /
      with revoked token returns 401.
- [x] Logout revokes the session; the old Bearer then gets 401.
- [x] Web, Android, and iOS each expose a minimal email+code sign-in flow and
      can show signed-in identity and sign out; tokens stored per Approach.
- [x] Greeting harness is gone: no `backend/modules/greeting/`, no greeting API
      clients/UI, no greeting OpenAPI path; README quick start documents auth
      smoke instead.
- [x] Backend unit + integration tests cover code lifecycle, auto-create,
      session auth, logout, and rate-limit or lockout behavior enough that
      reverting the logic fails a test.
- [x] Client tests (web component/unit; `sharedLogic` host tests) cover auth API
      client + session handling enough that reverting fails a test.
- [x] `ModularityTests` still passes with the new module (and without greeting).

## Tasks

- [x] **Contract:** Replace greeting OpenAPI with auth paths + Bearer scheme
      (remove `/api/greeting`).
- [x] **Backend:** Postgres (or agreed durable store) + migrations; `auth`
      Modulith module (adults, codes, sessions); mail port + dev implementation;
      rate limits; secure code hashing; Bearer filter/resolver; controllers
      matching OpenAPI.
- [x] **Backend:** Delete `backend/modules/greeting/` and its tests.
- [x] **Web:** Remove greeting client/harness; auth API client, session holder,
      minimal sign-in / me / sign-out UI.
- [x] **Mobile (`sharedLogic`):** Remove greeting client; auth client + secure
      token storage API used by both apps.
- [x] **Android:** Remove greeting UI; minimal sign-in / me / sign-out wired to
      sharedLogic.
- [x] **iOS:** Remove greeting UI; minimal sign-in / me / sign-out wired to
      sharedLogic.
- [x] **Tests:** Backend unit + integration; web tests; sharedLogic host tests;
      ModularityTests green; no obsolete greeting tests left.
- [x] **Docs:** Auth decisions in `docs/architecture.md`; README quick start →
      auth smoke; drop harness-as-product framing where it still claims greeting
      is the cross-stack demo.

## Open questions

- Exact email validation / normalization rules (trim + lowercase) — default to
  trim + case-fold unless implementation surfaces a reason not to.
- Concrete code length / TTL / rate-limit numbers — pick sensible defaults in
  implement (e.g. 6-digit, ~10 minutes, tight per-email and per-IP limits) and
  document in code/config; adjust only if review objects.
- Package/module name `auth` vs `identity` — choose during implement to match
  existing `com.yourorg.quickapp.*` naming; no product impact.

## Decisions locked in `/spec`

| Topic | Choice |
|--------|--------|
| Proof | Email OTP code only (no magic link in v1) |
| Session | Bearer token for web + Android + iOS |
| First verify | Auto-create adult; no display name yet |
| Display name | `family-circle-and-kids` |
| Mail | Dev delivery now for easy smoke; Upcoming `auth-email-delivery` before real users (rank ~end, pre-beta) |
| Web cookie hardening | Bearer fine for dev; Upcoming `web-auth-session-hardening` before real users (pre-beta) |
| Greeting harness | **Delete in this PR** — first real feature replaces the disposable demo |
