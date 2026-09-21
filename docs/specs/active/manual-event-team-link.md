# Spec: manual-event-team-link

Status: draft
Created: 2026-08-13
Promoted: 2026-09-17 · `/spec`
Updated: 2026-09-18 · RSVP polarity + follow-up carve-outs
Parent: [docs/roadmap.md](../../roadmap.md)
Added: 2026-08-13 · re-rank split
Branch: `manual-event-team-link`

## Problem

Manual events are circle-only: dentist, school concert, a rescheduled
scrimmage that never hit the team iCal. Household ride plans already key those
rows as `CAL:MANUAL:{id}`, but **Ask the team** and Agenda carpool chrome only
join **FEED** snapshots. A one-off that belongs on U12 cannot participate in
that team’s carpool, so the family either skips teammate coverage or pretends
the iCal grew a row. Recurring rotation needs a team-attached event as well.

Manual events are **opt-in**: nobody is attending until they mark **going**
(`RSVP YES`). FEED events stay **opt-out** (ADR-0003: missing / `NO_RESPONSE`
counts as going). Team-link ride defaults must use that manual polarity, not
FEED’s “not RSVP NO” bag.

## Non-goals

- Creating or joining carpool spaces (`team-carpool-space-invite` already
  shipped)
- New ride request/accept shapes (legs, meet-at, per-kid split stay as today)
- Turning a manual event into a feed snapshot, writing back to iCal, or
  editing FEED rows
- **Fan-out:** do not copy a linked manual onto other member circles’
  calendars. Teammates Accept from the **Carpool tab** (space `listRides`);
  they do not get a new Agenda row for someone else’s one-off
- Driving-block auto-merge of linked manuals (blocks stay FEED-only this PR)
- Constraining event `kidIds` to the feed’s kid links (siblings may attend a
  banquet)
- Recurring rotation ([`carpool-recurring-rotation`](../planned/carpool-recurring-rotation.md))
- Party size / extra seats on an RSVP (“Declan — going, +2”) —
  [`manual-event-party-size`](../planned/manual-event-party-size.md)
- Parents-only / adults-only events (zero `kidIds`, per-adult RSVP) —
  [`manual-event-adults-only`](../planned/manual-event-adults-only.md). This
  slice keeps **1+ `kidIds`** even when `feedId` is set
- Anchored / relative timing (“20 min after Sharks practice ends”) and
  open-ended / no-fixed-end — compose/scheduling, not linking —
  [`manual-event-relative-timing`](../planned/manual-event-relative-timing.md)
- OpenTable / restaurant reservation booking or hold
- Expo / KMP

## Approach

**Web-first. Optional `feedId` on a manual event (the circle’s subscribe
row). Standalone remains the default. When linked, the event is
carpool-eligible for that team.**

1. **Identity.** Store nullable `feed_id` on `manual_events` (FK to the
   circle feed; `ON DELETE SET NULL` so removing a feed unlinks, it does not
   delete the one-off). Validate on create/update: `feedId` is a feed in this
   circle or null. Any member may set it (same write policy as today’s manual
   CRUD). Do **not** key off `spaceId` — the feed is how the family names the
   team. Linking does **not** require Enable carpool; Ask-the-team still
   needs a MEMBER/OWNER space, same as FEED rows. **`kidIds` stay 1+** (same
   as today’s manual create); adults-only is a follow-up.

2. **Calendar.** Linked MANUAL `CalendarItem`s include `feedId` / `feedName`
   and a stable `eventKey` = `CAL:MANUAL:{id}` (the same string household
   plans already send when `eventKey` was null). Standalone MANUAL stays
   `feedId`/`feedName`/`eventKey` null. Kid ids stay the event’s kids, not
   the feed roster.

3. **Manual RSVP polarity (this slice owns it).** The RSVP API already has
   an explicit **`YES`** distinct from **`NO_RESPONSE`** / missing (`YES` |
   `NO` | `NO_RESPONSE`; Agenda toggle already **writes `YES`** when marking
   going). No new RSVP enum or column. What this PR changes is the **read
   path for `source=MANUAL`**: missing / `NO_RESPONSE` is **not going**
   (opt-in). FEED is unchanged (ADR-0003: missing / `NO_RESPONSE` → going).
   Amend ADR-0003 accordingly (default-going is **FEED-only**). Server
   `uncoveredKidIds` and client `mapRsvpToAttendance` /
   `goingKidIdsForItem` must be source-aware so Hero / coverage / ride
   create do not treat un-RSVPed manual kids as attending.

4. **Carpool.** Space event lookup unions feed snapshots with manuals linked
   to the matching-URL feed. Create / list / Accept / Enable-attach /
   RSVP-NO transport clear must resolve that `eventKey`, including RSVP
   lookups as `MANUAL` + event id (not `FEED` + synthetic snapshot).
   **Default ride kids for a linked manual** = event kids with **`RSVP YES`**
   who are not already on this circle’s ACCEPTED ride — **not** “not RSVP
   NO” (that FEED bag includes `NO_RESPONSE`). Zero YES kids → existing
   create **400** (“No kids need a ride”). Changing or clearing `feedId` →
   **409** when this eventKey has active **space-scoped** `PENDING`/`ACCEPTED`
   rides; circle-local null-space PLANs do not block. Hard-delete of a
   linked manual cancels this circle’s active plans for that key.

5. **OpenAPI.** Optional nullable `feedId` on `ManualEvent` /
   `CreateManualEventRequest` / `UpdateManualEventRequest`. Amend
   `CalendarItem` (`feedId`/`feedName`/`eventKey` descriptions) and the
   calendar list description so linked manuals are documented. Update **web**
   clients in the same change; do **not** update frozen KMP. No `partySize`
   / extra-seats field this PR.

6. **Web compose + Agenda.** Add/Edit event: when the circle has 1+ feeds,
   a **Team** select — default **Standalone (family only)**, then feed names.
   Zero feeds → omit the control. Exact start/end fields stay as today
   (relative / open-ended timing is a follow-up). Agenda/Focus carpool
   **actions** on a MANUAL row with a member/owner `feedId` use the same
   Request / status / reverse-action chrome as FEED (`eventKey` join); the
   **eligible kid bag** is YES-only. Carpool tab upcoming list includes
   those events because `listRides` does.

## Context

Allowlist for `/implement`.

- Architecture: `docs/architecture.md` → **Family circle (v1)** (Manual
  events, Activity feeds, RSVP, How objects link) and **Team carpool space
  (detail)** (Rides, Clients)
- Decision: [`docs/decisions/ADR-0003-attendance-manual-default-going.md`](../../decisions/ADR-0003-attendance-manual-default-going.md)
  — this slice **amends** it: default-going stays FEED; MANUAL is opt-in
- Prior identity: [`docs/specs/archive/calendar-item-event-key.md`](../archive/calendar-item-event-key.md)
  — `eventKey` formula; this slice amends “null for MANUAL” for **linked**
  rows only
- Contract: `contracts/openapi.yaml` → `ManualEvent`,
  `CreateManualEventRequest`, `UpdateManualEventRequest`, `CalendarItem`,
  `GET /api/family/circle/calendar`
- Backend: `backend/modules/events/` (`ManualEventEntity`,
  `EventsService`, `ManualEventCalendarApi` / `ManualCalendarEventDto`);
  `backend/modules/feeds/FeedsApi.java`;
  `backend/modules/calendar/.../internal/CalendarService.java` (`fromManual`,
  `uncoveredKidIds`, RSVP NO → carpool);
  `backend/modules/carpool/.../internal/CarpoolRideService.java`
  (`spaceEvents`, `findSpaceEvent`, `attachCircleLocalPlansToSpace`,
  `defaultKidIds`, `withdrawAcceptedInboundForFeedEvent`,
  `clearTransportForNotGoingKid`)
- Web: `web/src/api/familyClient.ts` (`createEvent` / `updateEvent`),
  `web/src/api/types.ts` (`ManualEvent`, `CalendarItem`);
  `web/src/components/FamilyScreen.tsx` (Add/Edit compose);
  `web/src/components/calendarRideJoin.ts` (`matchCalendarItemToRideEvent`,
  `circleLocalEventKey`);
  `web/src/components/coverageQueue.ts` (`mapRsvpToAttendance`);
  `web/src/components/rsvpDisplay.ts` (`goingKidIdsForItem`)

Do not list `docs/roadmap.md`. Cite
[`carpool-recurring-rotation`](../planned/carpool-recurring-rotation.md) only
as the consumer this unlocks — do not implement it. Same for the Non-goals
planned stubs.

## Acceptance criteria

- [ ] Create a manual event with `feedId` of a circle feed: response and
      calendar row include that `feedId`/`feedName` and `eventKey`
      `CAL:MANUAL:{id}`; source stays `MANUAL`. Omit/`null` `feedId` keeps
      today’s standalone row (`eventKey` null).
- [ ] Create/update with a `feedId` that is not a feed in this circle →
      **400**. Caregiver create with a valid `feedId` succeeds (any-member
      write). Create still requires **1+ `kidIds`** when `feedId` is set.
- [ ] Web Add/Edit compose shows **Team** when the circle has feeds
      (Standalone default + feed names); saving Standalone vs a named team
      round-trips `feedId`. No feeds → no Team control; create still works.
- [ ] When that feed has a MEMBER/OWNER space, Agenda/Focus show Request /
      status / reverse-action chrome for the linked manual via exact
      `eventKey` join (same **actions** as a FEED row). Standalone manuals
      still have no team Ask chrome.
- [ ] `listRides` for that space includes the linked manual in the window;
      another space member can Accept from the Carpool tab. The accepter’s
      Agenda does **not** gain a new calendar row.
- [ ] **CHANGED** Ride default kids on a linked manual are the event’s kids
      with **`RSVP YES`** (not the full feed roster, and **not** FEED’s
      YES+`NO_RESPONSE` in-play bag). RSVP **not going** (`NO`) on a linked
      manual still clears that kid’s transport the same as a FEED event.
      Zero YES kids → ride create **400**.
- [ ] **NEW** On `source=MANUAL`, missing / `NO_RESPONSE` reads as **not
      going** (Agenda toggle, `uncoveredKidIds`, Hero/queue). Marking going
      persists `YES` (existing write). FEED mapping unchanged (missing /
      `NO_RESPONSE` → going).
- [ ] Update that clears or changes `feedId` while a space-scoped
      PENDING/ACCEPTED ride exists for that `eventKey` → **409**; household
      PLAN-only does not block. Deleting a linked manual cancels this
      circle’s active plans for the key. Deleting the feed unlinks remaining
      manuals (they become standalone); it does not delete them.
- [ ] Enable carpool on the feed attaches matching null-space PLANs whose
      `eventKey` is `CAL:MANUAL:{id}` for manuals linked to that feed, same
      as feed-snapshot keys.

## Tasks

- [ ] **Backend:** Flyway nullable `feed_id` on `manual_events` (FK,
      `ON DELETE SET NULL`); events CRUD validate via `FeedsApi` (still 1+
      kids); calendar maps linked manuals; MANUAL `uncoveredKidIds` = YES
      only; carpool space-event union + RSVP-NO / Enable-attach /
      `defaultKidIds` YES-only for MANUAL; 409 on relink with active space
      rides; delete cancels own plans; amend ADR-0003
- [ ] **Contract:** OpenAPI `feedId` on manual event schemas; `CalendarItem`
      + calendar GET descriptions for linked MANUAL `feedId`/`eventKey`;
      web types + `familyClient` create/update bodies. No party-size field
- [ ] **Web:** compose Team select; `matchCalendarItemToRideEvent` allows
      MANUAL with member/owner `feedId` (exact key); source-aware
      `mapRsvpToAttendance` / `goingKidIdsForItem` (MANUAL YES-only); no
      new tokens
- [ ] **Tests:** events/calendar/carpool unit + integration for link /
      400 / 409 / listRides / YES-only default kids / RSVP-NO / Enable-attach
      / feed-delete unlink / MANUAL `uncoveredKidIds`; web compose Team
      round-trip; `calendarRideJoin` MANUAL+feedId join; MANUAL vs FEED
      attendance mapping; Caregiver path. No new Playwright e2e

## Open questions

*None blocking — locked this pass:*

- Team picker is **any circle feed**, not only feeds with a space. Space is
  still required for Ask-the-team.
- No teammate Agenda fan-out this PR. If dogfood hates Carpool-tab-only
  Accept for one-offs, that is a follow-up slice (do not sneak it in).
- Driving-block merge of linked manuals stays out; revisit only if a banquet
  needs to sit in a same-day FEED block.
- **RSVP polarity:** API already distinguishes `YES` vs `NO_RESPONSE`. This
  slice owns MANUAL read-path opt-in; it does not add extra seats, adult
  attendees, or relative clocks (parked stubs above).
- **Party size / adults-only / relative timing** stay out even though they
  touch RSVP or compose — they are not a small extension of `feedId` /
  `eventKey`.
