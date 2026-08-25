# Spec: calendar-item-event-key

Status: draft  
Created: 2026-08-21  
Parent: [docs/roadmap.md](../../roadmap.md)

## Problem

Agenda joins FEED calendar rows to carpool `listRides` events by title +
`startsAt` (+ location to break ties). That is flaky under fingerprint/`FP:`
keys and location drift, so Request/status on Calendar appears intermittently
even when the adult is a space member. Carpool already keys rides by
`eventKey` (`UID:<uid>` or `FP:…`); `CalendarItem` does not expose a matching
stable id, so the client cannot do an exact join.

## Non-goals

- Rewriting coverage / RSVP / leave-by domain
- Multi-stop pickup order, Open in Maps, or other carpool shape work
- Exposing raw iCal `uid` on `CalendarItem` (use carpool-compatible
  `eventKey` only)
- Updating frozen KMP `sharedLogic` or Android/iOS Agenda UI
- Expo client work (no Expo app yet)
- Changing how rides are stored or how `RideRequest.eventKey` is computed at
  create/list time beyond sharing one key formula with calendar
- Backfilling or migrating historical ride rows whose fingerprint keys drifted

## Approach

Add nullable `eventKey` on OpenAPI `CalendarItem` and the calendar response
DTO. For `source=FEED`, set it with the **same** formula carpool already uses
on `FeedCalendarEventDto` (`UID:` + trimmed uid when present; otherwise
`FP:` + normalized title `|` startsAt `|` normalized location). For
`source=MANUAL`, leave `eventKey` null.

Lift that formula into the **feeds** public package (e.g. `FeedEventKey.of`)
so carpool’s internal `RideEventKey` delegates to it and calendar maps
`fromFeed` without depending on carpool. Do not invent a second identity.

**Web:** `matchCalendarItemToRideEvent` prefers exact `eventKey` equality
within the member/owner space. When `item.eventKey` is null, keep the existing
title+startsAt(+location) heuristic as fallback (MANUAL / defensive). Update
`web` types only — no KMP.

## Context

Allowlist for `/implement`.

- Architecture: `docs/architecture.md` → **Family circle (v1)** (Activity feeds
  row; Carpool / Rides / Clients rows under Team carpool)
- Prior join harden (heuristic to replace as primary):
  `docs/specs/archive/agenda-focus-carpool-actions.md` → Approach / Acceptance
  (calendar↔ride match)
- Contract: `contracts/openapi.yaml` → `CalendarItem`
- Backend: `backend/modules/feeds/.../FeedCalendarEventDto.java`;
  `backend/modules/carpool/.../internal/RideEventKey.java` (+
  `RideEventKeyTest`); `backend/modules/calendar/.../CalendarItemResponse.java`;
  `backend/modules/calendar/.../internal/CalendarService.java` (`fromFeed` /
  `toResponse`)
- Web: `web/src/api/types.ts` (`CalendarItem`);
  `web/src/components/calendarRideJoin.ts` (+ colocated tests);
  Agenda wiring already consumes the matcher via `FamilyScreen` /
  `AgendaRow` — only join + types need product change

## Acceptance criteria

- [ ] OpenAPI `CalendarItem` includes nullable string `eventKey` (not required);
      description documents `UID:` / `FP:` parity with carpool ride keys and
      null for MANUAL
- [ ] `GET /api/calendar` (and single-item enrich responses that return
      `CalendarItem`) include `eventKey` for FEED rows; MANUAL rows omit/null
- [ ] FEED `eventKey` matches carpool’s key for the same `FeedCalendarEventDto`
      (uid present → `UID:…`; uid absent → `FP:…` with same normalize rules)
- [ ] Key formula lives in feeds’ public API; carpool uses that shared helper
      (no duplicated divergent string building)
- [ ] Web `CalendarItem` type includes `eventKey: string | null`
- [ ] Web Agenda↔ride join: when `item.eventKey` is non-null, match the ride
      event in the eligible space whose `eventKey` equals it (no title/time
      required for that hit)
- [ ] When `item.eventKey` is null, existing title+startsAt(+location)
      heuristic still applies (MANUAL stays unmatched)
- [ ] Unit/integration coverage: calendar FEED list asserts `eventKey`; shared
      key helper / carpool delegation covered; web join tests cover exact-key
      hit and null-key fallback
- [ ] Frozen KMP untouched; no Expo work in this PR

## Tasks

- [x] Backend (feeds): extract public `FeedEventKey` (or equivalent) from
      carpool’s `RideEventKey` algorithm; unit-test UID and FP cases
- [x] Backend (carpool): make `RideEventKey` delegate to the feeds helper;
      keep existing ride tests green
- [x] Backend (calendar): add `eventKey` to `CalendarItemResponse`; set from
      feeds helper in `fromFeed`; null in `fromManual`
- [ ] Contract: add `eventKey` on `CalendarItem` in `contracts/openapi.yaml`
- [ ] Web: add `eventKey` to `CalendarItem` in `web/src/api/types.ts`
- [ ] Web: update `matchCalendarItemToRideEvent` to prefer exact `eventKey`;
      retain heuristic when key is null; extend `calendarRideJoin.test.ts`
- [ ] Tests: calendar integration asserts FEED `eventKey` on list (and at least
      one enrich path if cheap); no KMP / Expo tasks

## Open questions

None — scope locked: nullable carpool-compatible `eventKey` only; web exact-key
join with heuristic fallback when key is null.
