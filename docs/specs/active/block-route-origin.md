# Spec: block-route-origin

Status: draft  
Created: 2026-09-17  
Promoted: 2026-09-17 · `/spec`  
Parent: [docs/roadmap.md](../../roadmap.md)  
Added: 2026-09-17 · enhancement  
Branch: `block-route-origin`  
Blocked by: [`day-block-route`](../archive/day-block-route.md) (shipped)

## Problem

Route already builds There (TO) and Back (FROM) itineraries for singleton and
combined drives ([`day-block-route`](../archive/day-block-route.md)), but the
**governing home-side place** is implicit: combined There starts at the
membership default leave-from; singleton There uses the path item’s leave-from
chain; Back ends at the driver’s leave-from / home. Parents have no Route
surface to say “I’m leaving from the office” on There and “we’re returning
home” on Back when those places differ — a common afterschool → practice day.
Per-event / per-kid leave-from remains a **middle** (pickup / drop-off), not
the itinerary’s fixed HOME start or end.

## Non-goals

- Replacing per-event / per-kid / coverage leave-from (those stay middles)
- Syncing Route origin writes into Agenda/Focus leave-from (or the reverse) —
  itinerary override is **itinerary-only** this PR; dual sources may disagree
  until a follow-up if dogfood hates it
- Agenda / Focus / Hero origin chrome; block-card “Leaving from” control
- Public `/blocks/{id}/route` ([`agenda-block-api`](../planned/agenda-block-api.md))
- Changing driving-block merge / FORCE_MERGE/SPLIT
- Editable arrival lead times (`event-arrival-lead-time`)
- Membership **default** leave-from editor (Family settings stays as today)
- Expo / KMP / RN

## Approach

**Web-first. Persist a per-leg home-side override on the existing member-set
itinerary; expose set/read on the item route contract; edit on Route There /
Back chrome.**

1. **Resolution (per leg):** For TO, fixed HOME **start** = itinerary home-side
   override when set; else today’s fallback (combined → membership default;
   singleton → path-item leave-from chain). For FROM, fixed HOME **end** =
   itinerary home-side override when set; else today’s driver leave-from /
   home. There and Back overrides are **independent** (office out, home back).

2. **Flatten co-located kid places:** Before optimize, drop a middle whose
   resolved place matches the governing HOME place for that leg (same located
   `placeId`, or same normalized address / geocode when comparing one-time /
   named). Example: kid leave-from is Home and Leaving from is Home → one HOME
   start, then venue-bound stops (afterschool community center stays a middle
   when it differs). Same spirit as ADR-0004 rule 8, applied to origin +
   middle (and FROM end + drop-off middle).

3. **Persistence:** Store the override on the member-set itinerary row keyed
   `(adultId, leg, member-set)` — same key as
   [`day-block-route`](../archive/day-block-route.md). Do **not** invent a
   block UUID. Place triad mirrors Agenda leave-from: Default (clear) /
   located circle place / one-time free-text. Changing the override busts the
   stop fingerprint and rebuilds (re-auto-optimize middles). Does **not** write
   calendar-item or coverage leave-from.

4. **OpenAPI:** Extend `CalendarRoute` to echo the effective home-side triad
   for the assembled leg (so the client can drive controls). Add a dedicated
   write (e.g. `PUT …/calendar/{source}/{itemId}/route/origin?leg=TO|FROM`)
   with body shaped like `SetCalendarLeaveFromRequest`; returns rebuilt
   `CalendarRoute`. Keep middle reorder on the existing PUT. Document
   independent TO/FROM overrides + flatten rule. Update **web** clients in the
   same change; do **not** update frozen KMP.

5. **Web Route chrome:** On every routable Route view (singleton and
   combined), There tab shows **Leaving from** and Back tab shows **Returning
   to**, both reusing `LeaveFromControls` (Default + named located places +
   one-time). Save calls the new origin write for the active `leg`; refresh
   stops / leave-by from the response. No Agenda block-card control this PR.

## Context

Allowlist for `/implement`:

- Prior slice: [`docs/specs/archive/day-block-route.md`](../archive/day-block-route.md)
  — member-set cache, There/Back assembly, HOME start/end rules this PR
  overrides
- Decision: [`docs/decisions/ADR-0004-carpool-card-perspective-rules.md`](../../decisions/ADR-0004-carpool-card-perspective-rules.md)
  — rules 4 (pickup vs drop-off), 5 (named/qualified addresses), 8
  (single-stop multi-kid; extend flatten to home-side + middle)
- Architecture: [`docs/architecture.md`](../../architecture.md) → **Leave-by**
  → **Multi-stop itinerary** and **Stop-sequence optimize**
- Contract: [`contracts/openapi.yaml`](../../../contracts/openapi.yaml) →
  `GET/PUT …/calendar/{source}/{itemId}/route`, `CalendarRoute`,
  `SetCalendarLeaveFromRequest`
- Backend: `backend/modules/leaveby/.../LeaveByApi.java`,
  `LeaveByApiImpl.java` (block/singleton build + HOME assembly + fingerprint),
  `ItineraryEntity.java` / migration under `leaveby_itineraries`;
  calendar route controller wiring for the new origin write
- Web: `web/src/components/LeaveFromControls.tsx`,
  `web/src/components/leaveFromDisplay.ts`,
  `web/src/components/RideRouteTab.tsx`,
  `web/src/api/familyClient.ts`, `web/src/api/types.ts`,
  `FamilyScreen.tsx` (route fetch / mutation pass-through)

Do not list `docs/roadmap.md`. Cite
[`agenda-block-api`](../planned/agenda-block-api.md) only as north-star for
public block ids.

## Acceptance criteria

- [ ] On a **combined** There route, driver can set **Leaving from** to a
      located circle place (e.g. Office) distinct from membership default;
      rebuilt stops use that place as fixed HOME start; kid/coverage leave-from
      places remain middles (not HOME).
- [ ] On the same block’s Back route, driver can set **Returning to** to a
      different place (e.g. Home) without changing the There override; FROM
      fixed HOME end uses Returning to.
- [ ] On a **singleton** Route, Leaving from / Returning to appear and persist
      the same way (independent per leg); when no itinerary override is set,
      assembly keeps today’s fallbacks (item leave-from chain for TO start;
      driver leave-from / home for FROM end).
- [ ] Clearing the control to **Default** removes the itinerary override and
      restores the fallback for that leg; Agenda/Focus leave-from for member
      events is **unchanged** by Route origin writes.
- [ ] When a household kid leave-from (or FROM drop-off) resolves to the same
      place as the governing HOME for that leg, assembly emits **one** home-side
      stop (no duplicate middle at that address).
- [ ] Opening the same member-set via any member `itemId` + same `leg` returns
      the same home-side override and ordered stops.
- [ ] OpenAPI documents the origin write + `CalendarRoute` echo fields; web
      `familyClient` / types call them; Route There/Back use `LeaveFromControls`
      with labels **Leaving from** / **Returning to**.
- [ ] Unit + integration coverage: independent TO/FROM overrides, Default
      clear, flatten when kid place == HOME, Agenda leave-from unchanged after
      Route origin PUT; web component test for Route origin controls.

## Tasks

- [x] Backend: persist home-side triad on member-set itinerary (Flyway); resolve
      TO start / FROM end from override → existing fallbacks; flatten
      co-located middles before optimize; bust fingerprint on override change
- [ ] Backend: `LeaveByApi` + calendar HTTP for origin PUT; same routability
      gate as get/reorder (403 when not the driving adult)
- [ ] Contract: OpenAPI origin write + `CalendarRoute` home-side echo; describe
      independent legs + flatten
- [ ] Web: `familyClient` / types for origin PUT + echo fields
- [ ] Web: `RideRouteTab` Leaving from (There) / Returning to (Back) via
      `LeaveFromControls`; wire save → rebuild
- [ ] Docs: update `docs/architecture.md` → **Multi-stop itinerary** for
      per-leg itinerary home-side override (itinerary-only; not Agenda leave-from)
- [ ] Tests: leaveby unit (resolution + flatten); calendar/route integration
      (PUT origin, independent legs, Agenda leave-from unchanged); 
      `RideRouteTab` component test for controls

## Open questions

- None blocking. Follow-up if dogfood wants Agenda ↔ Route origin sync or
  Agenda block-card origin chrome.
