# Spec: manual-events

Status: done  
Created: 2026-08-07  
Updated: 2026-08-10  
Approved: 2026-08-10  
Parent: [docs/roadmap.md](../../roadmap.md)  
Branch: `manual-events`  
Added: 2026-08-07 · re-rank split

## Problem

Not every activity has an iCal feed. Adults still need one-off practices, dentist
visits, school concerts, and similar schedule items on the family calendar.
Circles can subscribe feeds and attach kids, but there is no way to **manually
add or edit** events that are not imported. Without this escape hatch, calendar /
coverage / carpool slices have nothing for non-feed activities.

## Non-goals

- **Calendar grid / month-week UI** — `family-calendar-surface` (becomes the
  primary create/edit surface later; this slice ships a thin manage list only)
- **Editing or deleting feed-imported events** — feed snapshots stay owned by
  Sync now / poller replace
- **Recurrence / all-day type** — use a long `startsAt`–`endsAt` window if needed
- **Link to named places** — location stays optional free text; place-id later if
  needed
- **Leave-by, conflicts, coverage, carpool**
- **Merging feed + manual into one list API** — calendar composes later
- **Creator-only edit rules** — any member may edit/delete any manual event (same
  as places)
- **OpenAPI codegen** — hand-written clients stay the pattern

## Approach

New Modulith module **`events`** (vertical slice). Circle membership and kid
validation stay in **`family`** via existing public **`FamilyMembershipApi`** (or
equivalent) — no imports of `family.internal`. Feed event rows stay in **`feeds`**;
do not overload snapshot replace with manual rows.

**Authz model (intentional two categories):**

| Category | Who writes | Examples |
|----------|------------|----------|
| Structure / plumbing | **Organizer-only** | Kids, invite/roles, **activity feeds** + Sync |
| Shared household content | **Any circle member** | **Named places**, **manual events** |

**Manual event (circle-scoped):**

| Field | Notes |
|-------|--------|
| id | UUID |
| circleId | Owning family circle |
| title | Required trimmed non-blank (summary/label) |
| startsAt | Required Instant (UTC); clients send ISO-8601 |
| endsAt | Optional Instant; if present must be **≥ startsAt** else **400** |
| location | Optional free-text |
| kidIds | **1+** kids from the same circle (many-to-many); empty/invalid → **400** |

Hard delete on remove (no soft-delete). No uniqueness constraint on title.

**List:** `GET` returns **all** manual events for the circle, ordered by
`startsAt` ascending (then `id` for stability). No upcoming filter — keep the
contract simple; calendar owns windowing later. Manage UI may remain as a
secondary chronological/agenda list after calendar ships.

**Contract:** `/api/family/circle/events` list/create + `/{eventId}` get/update/delete
under Bearer. Responses include `kidIds`. Document 400/401/404. Caregiver writes
**succeed** (unlike feeds).

**Clients (web + Android + iOS):** thin **manage-events** section on the family
surface for **every member** (not Organizer-gated): list, add, edit, delete.
Show title, time range, location, kid labels. Not a calendar grid. Feed manage
UI stays Organizer-only and unchanged.

**Docs:** architecture notes the Organizer vs any-member split and that calendar
will read feed events + manual events.

## Acceptance criteria

- [x] OpenAPI: manual event schemas + Bearer paths for list/create/get/update/delete;
      401/404/400 documented; version bumped; web + mobile clients updated in the
      same change.
- [x] Authenticated **Organizer or Caregiver** can **create** a manual event
      (`title`, `startsAt`, 1+ `kidIds`; optional `endsAt`, `location`); **update**
      any field; **delete**; **list** all circle manual events ordered by
      `startsAt` ascending.
- [x] Missing/blank `title`, missing `startsAt`, empty `kidIds`, kid not in
      circle, or `endsAt` &lt; `startsAt` → **400**.
- [x] Unknown `eventId` / other circle → **404** (no leak). Unauthenticated →
      **401**. Adult with no membership → **404**.
- [x] Caregiver manual-event writes succeed (regression: Caregiver feed mutations
      still **403**; kids writes still Organizer-only).
- [x] Manual events are **not** modified by feed Sync now / poller; feed event
      tables remain feed-scoped.
- [x] Web, Android, and iOS: signed-in members see manage-events UI (list / add /
      edit / delete); errors surfaced. No calendar grid in this PR.
- [x] Unit + integration tests cover CRUD, 1+ kids validation, Caregiver write,
      authz, endsAt ordering; `ModularityTests` green.

## Tasks

- [x] **Backend:** New `backend/modules/events/` with module conventions; Flyway
      tables for manual events + event↔kid; entity/repo/service/controller;
      `FamilyMembershipApi` for membership + kid validation; hard delete.
- [x] **Contract:** OpenAPI paths/schemas; bump info version; architecture note.
- [x] **Web:** types + `familyClient` (or events client); manage-events section on
      `FamilyScreen` for all members; tests.
- [x] **Mobile:** sharedLogic models/client + tests; Android sharedUI; iOS
      AuthViewModel / ContentView manage-events CRUD.
- [x] **Docs:** `docs/architecture.md` — events module + authz categories
      (Organizer plumbing vs any-member content).
- [x] **Tests:** service unit + controller integration (Caregiver write, 400/401/404,
      endsAt validation); `OpenApiContractTest`; web + KMP client tests;
      `ModularityTests`.

## Open questions

_None blocking — resolved in `/spec` walkthrough._

## Locked in this spec

| Topic | Decision |
|--------|----------|
| Writes | **Any circle member** (like places; not like feeds) |
| Kids | **1+ required** from circle; feeds stay 0+ |
| Fields | `title` + `startsAt` required; `endsAt` + `location` optional; no all-day; no place-id |
| endsAt | If set, must be **≥ startsAt** |
| Module | New **`events`** Modulith module (not `feeds` / `family`) |
| List | All manual events, `startsAt` asc; no upcoming filter |
| UI this PR | Thin manage list (verify CRUD); calendar becomes primary write UX later |
| Feed imports | Out of scope to edit/delete via this API |
