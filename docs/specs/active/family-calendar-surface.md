# Spec: family-calendar-surface

Status: Approved  
Created: 2026-08-07  
Updated: 2026-08-10  
Approved: 2026-08-10  
Parent: [docs/roadmap.md](../../roadmap.md)  
Branch: `family-calendar-surface`  
Added: 2026-08-07 · re-rank split

## Problem

Adults have feeds (synced) and manual eapprvents (CRUD), but no single place to **see the household schedule**. Manage lists are Organizer/plumbing-oriented; Caregivers
especially need a phone-first **agenda** of what’s coming up across kids — without
leave-by, conflicts, or a month grid yet.

## Non-goals

- **Month/week calendar grid** — `family-calendar-grid` (iOS-style; ranked next)
- **Leave-by estimates**, **conflict detection**, **coverage**, **carpool**
- **Editing or deleting feed-imported events** — still owned by Sync now / poller
- **Desktop-first dashboard** / multi-pane scheduling UI
- **Recurrence expansion** beyond what’s already stored as discrete feed/manual rows
- **Push / reminders**
- **OpenAPI codegen** — hand-written clients stay the pattern
- **Replacing manual-event or feed CRUD APIs** — calendar adds a read model; manual
writes keep using `/api/family/circle/events`



## Approach

New Modulith module `calendar` (vertical slice) that **orchestrates** public
APIs from `feeds` and `events` — no imports of either module’s `internal`
packages. `ModularityTests` must stay green.

**Unified read API (any circle member):**

`GET /api/family/circle/calendar?from={instant}&to={instant}`


| Query         | Notes                                                                                                 |
| ------------- | ----------------------------------------------------------------------------------------------------- |
| `from` / `to` | Required ISO-8601 instants; inclusive start, exclusive end (`[from, to)`); `from ≥ to` → **400**      |
| Authz         | Bearer + **any member** (`requireMemberCircleId`); unauthenticated → **401**; no membership → **404** |


**Calendar item (response element):**


| Field             | Notes                                                                                 |
| ----------------- | ------------------------------------------------------------------------------------- |
| id                | UUID (manual event id or feed event id)                                               |
| source            | `MANUAL` | `FEED`                                                                     |
| title             | Manual `title` or feed event `summary`                                                |
| startsAt / endsAt | Instant; endsAt optional                                                              |
| location          | Optional free-text                                                                    |
| kidIds            | Manual: event↔kids. Feed: **feed’s** kid links (events themselves are not kid-tagged) |
| feedId / feedName | Present when `source=FEED` (helps label “Soccer”); omitted for manual                 |


Ordered by `startsAt` ascending, then `source`, then `id`. Overlapping feed +
manual rows both appear (no dedupe across sources). Empty window → `[]`.

**Public module APIs (new):**

- `feeds`: e.g. `FeedCalendarApi.listEventsInRange(circleId, from, to)` — member-safe
read of synced events + feed metadata/kids (today’s Organizer-only feed *manage*
list stays Organizer-only).
- `events`: e.g. `ManualEventCalendarApi.listInRange(circleId, from, to)` — or
extend existing service with a range query used only via that public API.

**Clients (web + Android + iOS):**

- Primary **Agenda** surface for every member: load a default window of **local
start-of-today → +30 days** (send as UTC instants); show readable local times
(same spirit as current web/iOS formatters).
- Each row: title, when, location, kid labels, and a feed vs manual cue
(`feedName` or “Manual”).
- Optional **kid filter** chips (client-side on the loaded window).
- **Manual writes from agenda:** Add event; edit/delete when `source=MANUAL`
(reuse existing events client + datetime pickers / validation). Feed rows are
not editable.
- **Remove** the dedicated manage-events CRUD block as the primary UX (API
remains). Feed manage UI stays Organizer-only and unchanged.
- Empty state when no items in window.

**Docs:** architecture notes the `calendar` module + unified agenda read model;
grid remains a follow-up id.

## Acceptance criteria

- [ ] OpenAPI: calendar item schema + `GET /api/family/circle/calendar` with
  ```
  required `from`/`to`; 400/401/404 documented; version bumped; web + mobile
  clients updated in the same change.
  ```
- [ ] Any circle member receives feed + manual items in `[from, to)`, ordered by
  ```
  `startsAt`; Caregiver succeeds (not Organizer-only). Empty → `[]`.
  ```
- [ ] Feed items include `kidIds` from the feed’s kids and `feedId`/`feedName`;
  ```
  manual items omit feed fields and remain editable via existing events API.
  ```
- [ ] `from ≥ to` → **400**; unauthenticated → **401**; adult with no membership
  ```
  → **404**.
  ```
- [ ] Web, Android, and iOS: Agenda UI (default today→+30d), kid filter optional,
  ```
  add/edit/delete **manual** events from that surface; feed rows read-only;
  dedicated manage-events list removed as primary UX; errors surfaced near
  the agenda.
  ```
- [ ] Unit + integration tests cover range merge, authz, ordering, empty window,
  ```
  bad range; `ModularityTests` green.
  ```



## Tasks

- [ ] **Backend:** New `calendar` module + controller; `FeedCalendarApi` /
  ```
  `ManualEventCalendarApi` (names flexible) on feeds/events; range queries;
  Caregiver-readable feed events for calendar only.
  ```
- [ ] **Contract:** OpenAPI calendar path/schemas; bump version.
- [ ] **Web:** types + client; Agenda UI + manual write flows; drop primary
  ```
  manage-events block; tests.
  ```
- [ ] **Mobile:** sharedLogic client/models; sharedUI + iOS Agenda; same write
  ```
  rules; tests.
  ```
- [ ] **Docs:** `docs/architecture.md` calendar orchestration notes; roadmap
  ```
  Active row.
  ```
- [ ] **Tests:** unit + integration as in AC; client tests for merge display /
  ```
  filter / manual edit gating.
  ```



## Open questions

*None blocking — defaults locked:*


| Topic              | Decision                                                         |
| ------------------ | ---------------------------------------------------------------- |
| v1 surface         | **Agenda** (not month grid)                                      |
| Full calendar grid | Roadmap `family-calendar-grid` (rank 2)                          |
| Writes             | Manual add/edit/delete from agenda; feed rows read-only          |
| Data API           | Unified `GET .../calendar?from&to`                               |
| Default window     | Local start-of-today → +30 days                                  |
| Kid filter         | Client-side chips on loaded window                               |
| Module             | New Modulith `calendar` orchestrating feeds + events public APIs |




## Approval

**Approved** 2026-08-10. Ready for `/implement`.