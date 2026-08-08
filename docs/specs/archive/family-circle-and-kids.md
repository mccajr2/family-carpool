# Spec: family-circle-and-kids

Status: done  
Created: 2026-08-07  
Approved: 2026-08-08  
Completed: 2026-08-08  
Parent: [docs/roadmap.md](../../roadmap.md)  
Branch: `family-circle-and-kids`

## Problem

Signed-in adults have identity (email + Bearer) but no **household unit**. Later
calendar and carpool slices need a family circle centered on kids, with the
creating adult as Organizer and a place to store the adult’s display name
(deferred from auth v1). Without this, every feature would invent its own
“who’s in the family?” hack.

## Non-goals

- **Inviting / joining other adults** — `family-adult-invites-roles`
- **Multiple circles per adult** — parking `multi-circle-membership`
- **Named places, feeds, feed↔kid links, calendar, carpool**
- **Kid birth year / grade / “player vs sibling” types** — kid is id + display
  name; team association comes later via feeds
- **Driver-only role**, attention-balance, read-only follows, venue alerts
- **App identity rename**, production mail, web cookie hardening
- **OpenAPI codegen** — hand-written clients stay the pattern

## Approach

Add a Spring Modulith **`family`** vertical module (circle + kids + membership)
with Postgres/Flyway tables. Authenticate with the existing Bearer session;
resolve the current adult id via auth’s public surface (do not reach into auth
`internal`).

**Model (this PR):**

- **FamilyCircle** — `id`, optional `name` (null → UI shows “Your family”)
- **Membership** — adult ↔ circle, role `ORGANIZER` on create (Caregiver arrives
  with invites)
- **Kid** — `id`, `circleId`, `displayName` (no other profile fields)
- **Adult.displayName** — set when creating the circle (auth-owned field;
  family create flow writes it through a small auth public API / port)

**Cardinality:** at most **one** circle membership per adult. Create with zero
kids allowed; add/edit/remove kids afterward.

**Contract:** new `/api/family/*` (or equivalent) paths under Bearer security;
extend adult responses so `displayName` can be non-null after create. No
greeting path (already gone).

**Clients:** hand-written API in `web/src/api/` and `mobile/sharedLogic`; after
sign-in, web + Android + iOS show either create-circle (adult display name +
optional circle name) or the circle’s kids list with add / rename / remove.

**Extensibility note (docs only):** adults link to circles; kids link to
circles; later feeds attach to the circle with **feed↔kid** links for “on this
team.” Sibling vs player is not a kid type. Document briefly in
`docs/architecture.md`.

## Acceptance criteria

- [x] OpenAPI documents create/get/update circle, add/update/delete kid, and
      Bearer protection; adult `displayName` may be non-null after create.
- [x] Authenticated adult with **no** circle can `POST` create with required
      adult display name and optional circle name → becomes **Organizer**;
      adult `displayName` is persisted; circle may have **zero** kids.
- [x] UI uses circle name when set; otherwise shows a **“Your family”**
      placeholder (or equivalent).
- [x] Second create for the same adult fails with a documented conflict (e.g.
      **409**); `GET` circle without membership returns documented empty/404.
- [x] Organizer can **add** a kid (display name), **rename** a kid, and
      **remove** a kid; list kids on get-circle; unknown kid id → 404;
      kid in another circle → 404 (no leak).
- [x] Unauthenticated family calls → **401**; adult cannot mutate another
      adult’s circle.
- [x] Web, Android, and iOS: signed-in flow supports create-circle and
      kids CRUD at a minimal level (same Bearer session as auth).
- [x] Backend unit + integration tests cover create, conflict, kids CRUD, and
      authz enough that reverting fails a test; client tests cover the new API
      client paths; `ModularityTests` passes with `family` (and `auth`).

## Tasks

- [x] **Contract:** Add family circle + kids paths and schemas to
      `contracts/openapi.yaml`; keep auth `/me` displayName accurate.
- [x] **Backend (`family` module):** Flyway migration; entities/repos; create /
      get / patch circle; kids add/update/delete; Organizer membership; enforce
      one circle per adult.
- [x] **Backend (auth touch):** Public way for family (or controller layer) to
      set current adult `displayName` without breaking Modulith boundaries.
- [x] **Web:** Family API client + minimal create-circle / kids UI after auth.
- [x] **Mobile (`sharedLogic`):** Family client types + calls.
- [x] **Android / iOS:** Minimal create-circle / kids UI wired to sharedLogic.
- [x] **Tests:** Backend unit + Testcontainers integration; web + sharedLogic
      tests; ModularityTests green.
- [x] **Docs:** Architecture note for circle/kid/feed linking; README smoke
      mentions create circle after auth if useful.

## Open questions

- Exact path prefix (`/api/family/...` vs `/api/circles/...`) — choose at
  implement; no product impact.
- Soft-delete kids vs hard delete — **hard delete** is fine until feeds/events
  exist; revisit when activity-feed lands.

## Decisions locked in `/spec` (+ `/roadmap`)

| Topic | Choice |
|--------|--------|
| Membership (this PR) | At most one family circle per adult |
| Empty circle | Allowed (zero kids on create) |
| Kid fields | Stable id + display name only |
| Circle name | Optional; UI placeholder “Your family” when unset |
| Adult display name | Required on create-circle |
| Multi-circle / follows / attention | Parking stubs only |
| Clients | Web + Android + iOS in this PR |
| Remove kid | Yes (hard delete for now) |
