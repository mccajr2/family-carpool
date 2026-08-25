# Spec: carpool-request-accept

Status: done  
Created: 2026-08-07  
Updated: 2026-08-21 (`/pr`)  
Approved: 2026-08-21  
Parent: [docs/roadmap.md](../../roadmap.md)  
Branch: `carpool-request-accept`  
Added: 2026-08-07 · initial

## Problem

Team spaces and household garages exist, but teammates still cannot **ask for a
ride** or **accept** one. Without an explicit request/accept loop and seat
math, the second product pillar is unproven: families cannot cover a practice
when their own adult cannot drive, and a willing teammate has no in-app way to
take the kids.

## Non-goals

- **Android / iOS UI** — parked
  [`carpool-request-accept-mobile`](../planned/carpool-request-accept-mobile.md).
  OpenAPI + `sharedLogic` clients still update in this PR.
- **Focus-card ride accept/decline ranking** —
  [`agenda-focus-carpool-actions`](../archive/agenda-focus-carpool-actions.md)
- **To XOR from** (v1 is always both legs) —
  [`carpool-leg-to-from`](../planned/carpool-leg-to-from.md)
- **Pickup vs drop-off at a teammate house** —
  [`carpool-meet-at`](../planned/carpool-meet-at.md)
- **Early/late windows the driver must approve** —
  [`carpool-early-late-window`](../planned/carpool-early-late-window.md)
- **Ordered multi-stop pickups** / Open in Maps —
  [`carpool-multi-stop`](../planned/carpool-multi-stop.md)
- **Standing rotations** —
  [`carpool-recurring-rotation`](../planned/carpool-recurring-rotation.md)
- **Manual events on a team** —
  [`manual-event-team-link`](../planned/manual-event-team-link.md) (v1 rides are
  **feed events** only)
- **Least-privilege nanny/grandparent roster** —
  [`carpool-least-privilege`](../planned/carpool-least-privilege.md) (v1: every
  adult in a member circle sees ride kid first names + pickup address)
- **In-app inbox / push / email** when a ride is requested or accepted
- **Partial accept** (driver takes a subset of the requested kids)
- **Merging two families’ requests onto one vehicle** (that is multi-stop)
- **Restyling Carpool** onto destination tokens —
  [`ui-system-destination-adoption`](../planned/ui-system-destination-adoption.md)
  / [`carpool-page-redesign`](../planned/carpool-page-redesign.md)
- **Ride-share controls on every Agenda row** or Calendar contract fields
- **OpenAPI codegen** — hand-written clients stay the pattern
- **Playwright e2e** (not in toolchain)

## Approach

Extend the existing Modulith **`carpool`** module (not a new module). Spaces,
membership, and join-by-code stay as they are. HTTP stays under
**`/api/carpool/*`**. Join requests keep `/spaces/{spaceId}/requests`; **rides**
are a new resource at `/spaces/{spaceId}/rides`.

**OpenAPI changes** (bump `info.version`): list / create / accept / cancel /
withdraw ride endpoints + schemas. `GET /api/carpool` summary copy that says
members never see other families’ kids or rides must be updated — **space
members** see ride kid first names, seat counts, and pickup address.

### Domain

A **ride request** belongs to a **space + event + requesting circle**.

| Field | Notes |
|--------|--------|
| id | UUID |
| spaceId | Team space |
| eventKey | Cross-circle event identity (below) |
| requestingCircleId | Household asking |
| requestedByAdultId | Who created it (pickup place is this adult’s) |
| kidIds | Non-empty; seats = `kidIds.size` |
| kidFirstNames | Snapshot at create (display for other circles) |
| pickupPlaceName + pickupAddress | Snapshot of the requester’s house |
| status | `PENDING` \| `ACCEPTED` \| `CANCELLED` |
| acceptedByAdultId / acceptingCircleId / vehicleId | Set only when `ACCEPTED` |

**Event identity:** derive `eventKey` from the caller’s synced feed event on
this space’s URL. Prefer iCal **UID** (`UID:<uid>`). Null UID → fingerprint
`FP:<normalized title>|<startsAt>|<normalized location>` (same spirit as feed
null-UID matching). Extend `FeedCalendarEventDto` with nullable `uid` so
carpool does not import `feeds.internal`.

**Attending / still need a ride:** **RSVP YES** kids on that feed event who
are not already on an `ACCEPTED` ride for this `(space, eventKey, circle)`.
`NO` and `NO_RESPONSE` are not attending — they are not defaulted and cannot
be added. Coverage is **orthogonal** (responsibility, not seats): a CONFIRMED
coverage row does not block a ride request.

Default create payload: all attending kids who still need a ride. Override:
non-empty subset (drop a sick kid). Duplicate **active** (`PENDING` or
`ACCEPTED`) request from the same circle for the same event → **409**. After
`CANCELLED`, they may request again.

**v1 shape (locked):** both legs; pickup at the **requesting adult’s house**
(their default leave-from if set, else the circle’s first named place with a
non-blank address, name-sorted). No pickup place with an address → **400**;
UI tells them to add a home address in Places. Snapshot name+address at
create so a later Places edit does not silently rewrite a live request.

### Seat math and accept

Garage `seats` is total capacity **including the driver**. On accept:

```
occupants = 1 (driver) + count(accepting circle’s RSVP YES kids on the matching event)
remaining = vehicle.seats − occupants
```

Accept succeeds only when `remaining >= request.seats`. **All-or-nothing** —
the driver takes every kid on that request or none. A vehicle may have **at
most one** `ACCEPTED` ride per event (second family on the same car →
multi-stop, parked). Leftover seats after one accept are unused in v1.

Who may accept: space-member adult with `drives=true` who is in that
vehicle’s `driverAdultIds`, **not** the requesting circle. `drives=false` →
**403**. Unknown / not-allowed vehicle → **404**. Own request → **409**.

Hick: if the accepter has exactly one eligible vehicle (enough remaining
seats, no existing accept on that event), default it. Otherwise they pick.

**Cancel:** any adult in the requesting circle, from `PENDING` or `ACCEPTED`
(accepted cancel frees the vehicle). **Withdraw:** any adult in the
**accepting** circle, `ACCEPTED` → `PENDING` (clears accepter/vehicle). No
per-driver “decline” that hides the request from others — that is Focus-card
follow-up.

### Clients

**Web Carpool tab** is the product home (architecture: do not absorb
ride-share into every Agenda row). For each space this circle belongs to,
list upcoming **feed** events in the same default window as Agenda (local
today → +30d). Per event: one primary situational CTA (Request / Accept /
status). Membership chrome (code, join-request admit, leave) stays on the
space, **below** upcoming rides.

Reuse existing CarpoolPanel patterns and tokens — not a visual restyle.

**Mobile:** update `sharedLogic` models + `CarpoolClient` only. Android/iOS
screens stay membership-only until the parked mobile spec.

### Module seams

Carpool talks through public APIs only:

- `FeedCalendarApi` / `FeedsApi` — events in range + UID + space URL
- `RsvpApi` — YES kids (new `carpool` → `rsvp` module dependency)
- `FamilyGarageApi` — `drives` + vehicles
- `FamilyPlaceApi` — pickup place (may need a circle-scoped lookup that
  returns a place **with address** even when not geocoded; default leave-from
  today skips unlocated)
- `FamilyMembershipApi` — circle names; add kid display names for snapshots

Do not import `*.internal`. Do not add ride fields to `CalendarItem`.

## Context

Allowlist for `/implement`. Paths and **headings**, not whole-doc dumps.

- Architecture: `docs/architecture.md` → **Family circle (v1)** (writes row;
  coverage vs carpool; RSVP; domain diagram)
- Architecture: `docs/architecture.md` → **Circle garage (detail)**
- Architecture: `docs/architecture.md` → **Team carpool space (detail)**
- Architecture: `docs/architecture.md` → **Interaction UX** → **Forward-looking
  seams** (Carpool stays the Carpool destination)
- Archived (reuse): `docs/specs/archive/team-carpool-space-invite.md`
  (membership, authz, Carpool tab vs Feeds, join-request path clash)
- Archived (reuse): `docs/specs/archive/garage-vehicles.md` (including-driver
  seats, `drives`, `FamilyGarageApi`)
- Contract: `contracts/openapi.yaml` → tag `carpool` (paths under `/api/carpool`)
- Backend: `backend/modules/carpool/src/main/java/com/yourorg/quickapp/carpool/CarpoolController.java`
- Backend: `backend/modules/carpool/src/main/java/com/yourorg/quickapp/carpool/internal/CarpoolService.java`
- Backend: `backend/modules/feeds/src/main/java/com/yourorg/quickapp/feeds/FeedCalendarApi.java`
- Backend: `backend/modules/feeds/src/main/java/com/yourorg/quickapp/feeds/FeedCalendarEventDto.java`
- Backend: `backend/modules/family/src/main/java/com/yourorg/quickapp/family/FamilyGarageApi.java`
- Backend: `backend/modules/family/src/main/java/com/yourorg/quickapp/family/FamilyPlaceApi.java`
- Backend: `backend/modules/family/src/main/java/com/yourorg/quickapp/family/FamilyMembershipApi.java`
- Backend: `backend/modules/rsvp/src/main/java/com/yourorg/quickapp/rsvp/RsvpApi.java`
- Web: `web/src/api/carpoolClient.ts`, `web/src/components/CarpoolPanel.tsx`
- Mobile (client only): `mobile/sharedLogic/src/commonMain/kotlin/org/example/project/CarpoolClient.kt`
- Smoke: `README.md` → **Team carpool smoke**

Do not list `docs/roadmap.md` or the entire architecture file.

## Acceptance criteria

- [x] OpenAPI documents space-scoped **rides** list (required `from`/`to`, same
      30-day window spirit as Agenda), create, accept, cancel, withdraw; Bearer
      on all; bump `info.version`. Join-request paths unchanged. Hand-written
      **web** and **sharedLogic** clients updated in the same change.
- [x] **List rides** (space member): upcoming **feed** events on this space’s
      URL in `[from, to)`, each with viewer event identity, title, start, and
      ride overlay (this circle’s active request if any; other circles’
      `PENDING`/`ACCEPTED` requests with circle name, kid first names, seat
      count, pickup name+address). Non-member / unknown space → **404**. Range
      inverted or longer than 31 days → **400**. Manual events do not appear.
- [x] **Create:** any space-member adult. Default kids = RSVP YES on that event
      who still need a ride; body may send a non-empty subset of that set.
      Empty default set, unknown kids, RSVP not YES, or kid already on an
      `ACCEPTED` ride → **400**. No pickup address → **400**. Duplicate active
      request for this circle+event → **409**. Persists both-legs + pickup
      snapshots. Caregiver may create (not Organizer-gated).
- [x] **Accept:** another member circle’s adult with `drives=true` and a
      vehicle they may drive; `remaining >= seats`; that vehicle has no
      `ACCEPTED` ride for this event. Success sets `ACCEPTED` and records
      adult/circle/vehicle. Own-circle request → **409**. `drives=false` →
      **403**. Not enough seats or vehicle already committed → **409**.
      Non-PENDING → **409**.
- [x] **Cancel** (requesting circle) from PENDING or ACCEPTED → `CANCELLED`;
      accepted cancel frees the vehicle. **Withdraw** (accepting circle) from
      ACCEPTED → `PENDING` (clears accepter/vehicle). Wrong circle → **403**.
- [x] Non-members never see rides (same existence rule as space detail).
      Importing a feed still does not join a space.
- [x] **Web Carpool tab:** member spaces show upcoming events with Request
      (default all attending; deselect override), pending/accepted status,
      Accept (vehicle default when only one eligible), Cancel, Withdraw.
      Loading / error / empty (no upcoming events; “mark who’s going on
      Calendar” when RSVP YES is empty). Agenda / Focus **do not** gain
      ride-share controls. No Carpool visual restyle.
- [x] Android/iOS **UI unchanged** (membership only). `sharedLogic` covers the
      new paths in client tests.
- [x] Backend unit + Testcontainers integration cover create defaults/override,
      RSVP filter, duplicate 409, pickup 400, accept seat math (driver + own
      YES kids), vehicle one-accept-per-event, own-circle 409, drives=false
      403, cancel/withdraw, authz; web `CarpoolPanel` tests cover Request /
      Accept / Cancel / deselect; `ModularityTests` still green.

## Tasks

- [x] **Contract:** `/api/carpool/spaces/{spaceId}/rides*` paths + schemas;
      version bump; summary/tag text updated for member-visible rides; 400 /
      403 / 404 / 409 as above.
- [x] **Backend (`feeds`):** nullable `uid` on `FeedCalendarEventDto`.
- [x] **Backend (`family`):** kid display-name lookup on `FamilyMembershipApi`;
      pickup-place lookup on `FamilyPlaceApi` (address even if unlocated).
- [x] **Backend (`carpool`):** Flyway ride-request table; list/create/accept/
      cancel/withdraw; seat math via `FamilyGarageApi` + `RsvpApi`; `rsvp`
      module dependency; no `internal` imports.
- [x] **Web:** `carpoolClient` + types; `CarpoolPanel` upcoming rides +
      request/accept/cancel/withdraw; tests; loading/error/empty.
- [x] **Mobile:** `sharedLogic` models + `CarpoolClient` methods + tests only.
- [x] **Docs:** architecture Family writes + Team carpool space (detail) +
      domain diagram (`RideRequest`); garage “out of scope” line becomes this
      slice; README smoke: two families, Request, Accept, see seats/pickup.
- [x] **Tests:** as in AC (unit + integration + web + sharedLogic +
      `ModularityTests`).

## Open questions

_None blocking._ Pickup address and kid first names are visible to every adult
in member circles — parked `carpool-least-privilege` is the follow-up if
dogfood says nanny/grandparent should not see teammate PII.

## Decisions locked in `/spec`

| Topic | Choice |
|--------|--------|
| UI home | **Web Carpool tab** — not Agenda rows, not Focus (next slice) |
| Clients | Web UI this PR; **sharedLogic client yes**; Android/iOS UI parked |
| Event source | **Feed events** on the space URL; manual events wait on team-link |
| Event identity | iCal **UID** across circles; fingerprint if UID missing |
| Default kids | All **RSVP YES** who still need a ride; deselect override |
| Coverage | **Orthogonal** — does not gate request or occupy seats |
| Legs / meet | **Both legs**; pickup at **requester’s house** (named place address) |
| Accept | **All-or-nothing**; `remaining = seats − 1 − own RSVP YES kids` |
| One car, two families | **Not in v1** (vehicle has at most one accepted ride per event) |
| Decline | No personal hide; **Cancel** (requester) + **Withdraw** (accepter) |
| PII | Member circles see kid first names + pickup address |
| Visual | Existing Carpool chrome; no token restyle |
