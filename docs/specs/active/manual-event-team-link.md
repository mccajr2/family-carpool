# Spec: manual-event-team-link

Status: draft
Created: 2026-08-13
Promoted: 2026-09-17 · `/spec`
Updated: 2026-09-21 · amend — FEED-parity when linked + revert MANUAL opt-in
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

Attendance for manuals stays the same mental model as today and as FEED
(ADR-0003): kids on the event are **going** until someone marks **not going**.
Hero / Agenda still show **Ride needed** for uncovered kids with no explicit
`NO`. (A future reservation-style flow may treat “no explicit RSVP → assume
NO”; that is **not** this slice.)

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
- A **custom kid subset** or per-kid picker on a team-linked manual (roster
  comes from the feed, same as a FEED row). Standalone manuals keep today’s
  kid picker. Sibling-only / partial-roster one-offs revisit later if needed
- Recurring rotation ([`carpool-recurring-rotation`](../planned/carpool-recurring-rotation.md))
- Party size / extra seats on an RSVP (“Declan — going, +2”) —
  [`manual-event-party-size`](../planned/manual-event-party-size.md)
- Parents-only / adults-only events (zero `kidIds`, per-adult RSVP) —
  [`manual-event-adults-only`](../planned/manual-event-adults-only.md). This
  slice keeps **1+ `kidIds`** even when `feedId` is set
- Anchored / relative timing (“20 min after Sharks practice ends”) and
  open-ended / no-fixed-end — compose/scheduling, not linking —
  [`manual-event-relative-timing`](../planned/manual-event-relative-timing.md)
- OpenTable / restaurant reservation booking or hold; **reservation-style
  “no RSVP → assume NO”** polarity (parked; do not implement here)
- Expo / KMP

## Approach

**Web-first. Optional `feedId` on a manual event (the circle’s subscribe
row). Standalone remains the default. When linked, the row behaves like a
normal team FEED event for roster and carpool UX** (`source` stays `MANUAL`
for API identity / `eventKey` = `CAL:MANUAL:{id}`).

1. **Identity.** Store nullable `feed_id` on `manual_events` (FK to the
   circle feed; `ON DELETE SET NULL` so removing a feed unlinks, it does not
   delete the one-off). Validate on create/update: `feedId` is a feed in this
   circle or null. Any member may set it (same write policy as today’s manual
   CRUD). Do **not** key off `spaceId` — the feed is how the family names the
   team. Linking does **not** require Enable carpool; Ask-the-team still
   needs a MEMBER/OWNER space, same as FEED rows. **Standalone (`feedId`
   null):** **`kidIds` from the client** (1+ circle kids, today’s rule).
   **Linked (`feedId` set):** **no client kid selection** — server **sets
   `kidIds` to that feed’s linked kids** on create/update (same roster a FEED
   snapshot row would carry). Feed with zero linked kids → **400**. Client
   `kidIds` on linked create/update are **ignored** (or must match feed
   exactly if sent — prefer ignore + overwrite).

2. **Calendar.** Linked MANUAL `CalendarItem`s include `feedId` / `feedName`
   and a stable `eventKey` = `CAL:MANUAL:{id}`. Standalone MANUAL stays
   `feedId`/`feedName`/`eventKey` null. **`kidIds` on linked rows = feed
   roster** (persisted on the manual event at save time).

3. **RSVP polarity (unchanged vs pre-slice).** Do **not** flip MANUAL to
   opt-in. Missing / `NO_RESPONSE` still counts as **going** for MANUAL and
   FEED (ADR-0003 default-going). Explicit **`NO`** is the only opt-out.
   Agenda toggle still **writes `YES`** when marking going. Hero / coverage
   queue / Ride-needed chips treat uncovered in-play kids the same as before
   this slice. Roll back any source-aware “MANUAL YES-only” read path and
   restore ADR-0003 wording to default-going for both sources. (Future
   reservation / headcount flows may want “no RSVP → assume NO”; park that.)

4. **Carpool.** Space event lookup unions feed snapshots with manuals linked
   to the matching-URL feed (viewer’s feed events + peer members’ linked
   manuals so Accept works on the Carpool tab without Agenda fan-out).
   Create / list / Accept / Enable-attach / RSVP-NO transport clear must
   resolve that `eventKey`, including RSVP lookups as `MANUAL` + event id
   (not `FEED` + synthetic snapshot). **Default ride kids for a linked
   manual** = event kids who are **not RSVP NO** and not already on this
   circle’s ACCEPTED ride — same bag as FEED. Zero in-play kids → existing
   create **400** (“No kids need a ride”). Changing or clearing `feedId` →
   **409** when this eventKey has active **space-scoped** `PENDING`/`ACCEPTED`
   rides; circle-local null-space PLANs do not block. Hard-delete of a
   linked manual cancels this circle’s active plans for that key.

5. **OpenAPI.** Optional nullable `feedId` on `ManualEvent` /
   `CreateManualEventRequest` / `UpdateManualEventRequest`. Amend
   `CalendarItem` (`feedId`/`feedName`/`eventKey` descriptions) and the
   calendar list description so linked manuals are documented. Document
   linked create/update: **`feedId` required; `kidIds` optional / ignored**
   (server derives roster from feed). Update **web** clients in the same
   change; do **not** update frozen KMP. No `partySize` / extra-seats field
   this PR.

6. **Web compose + Agenda (FEED parity when linked).** Add/Edit event: when
   the circle has 1+ feeds, a **Team** select — default **Standalone
   (family only)**, then feed names. Zero feeds → omit Team. **Standalone:**
   kid checkboxes as today. **Named team selected:** **hide the kid picker**
   (no “Assign Sam to event”); save sends `feedId` only. Exact start/end
   fields stay as today. On Agenda/Focus/Hero, a linked manual with a
   member/owner space uses the **same carpool UX as a FEED row**: default
   simple team ride ask, status / reverse-action chrome, **and** the
   progressive **split ride plan** flow (different plans per kid, different
   plans per leg) — reusing existing FEED paths keyed off `feedId` + space
   join (`eventKey` for the manual), not a one-off MANUAL-only ride UI.
   Eligible kid bag and RSVP behavior match FEED (not RSVP NO). Carpool tab
   `listRides` includes the event as today.

## Context

Allowlist for `/implement`.

- Architecture: `docs/architecture.md` → **Family circle (v1)** (Manual
  events, Activity feeds, RSVP, How objects link) and **Team carpool space
  (detail)** (Rides, Clients)
- Decision: [`docs/decisions/ADR-0003-attendance-manual-default-going.md`](../../decisions/ADR-0003-attendance-manual-default-going.md)
  — this slice **restores** default-going for MANUAL (rolls back the
  2026-09-21 FEED-only amend)
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
  (`spaceEvents` / `spaceEventsForList`, `findSpaceEvent`,
  `attachCircleLocalPlansToSpace`, `defaultKidIds`,
  `withdrawAcceptedInboundForFeedEvent`, `clearTransportForNotGoingKid`)
- Web: `web/src/api/familyClient.ts` (`createEvent` / `updateEvent`),
  `web/src/api/types.ts` (`ManualEvent`, `CalendarItem`);
  `web/src/components/FamilyScreen.tsx` (Add/Edit compose, Agenda ride/plan
  actions — align linked MANUAL with FEED where gated on `feedId`);
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
      write). When `feedId` is set, response **`kidIds` = that feed’s linked
      kids** (server-derived); feed with zero kids → **400**. Standalone
      create still requires **1+ client `kidIds`** (any circle kids).
- [ ] Web Add/Edit compose shows **Team** when the circle has feeds
      (Standalone default + feed names); saving Standalone vs a named team
      round-trips `feedId`. **Team selected → no kid picker**; create/update
      does not require checking kids. No feeds → no Team control; standalone
      kid picker still works.
- [ ] When that feed has a MEMBER/OWNER space, Agenda/Focus/Hero treat the
      linked manual like a **FEED** row for carpool: default ask ride,
      status / reverse-action chrome, and **split ride plan** (per-kid /
      per-leg) via exact `eventKey` join. Standalone manuals still have no
      team Ask chrome.
- [ ] `listRides` for that space includes the linked manual in the window;
      another space member can Accept from the Carpool tab. The accepter’s
      Agenda does **not** gain a new calendar row.
- [ ] Ride default kids on a linked manual are the **feed roster kids** on
      the event who are **not RSVP NO** (same in-play bag as FEED — includes
      missing / `NO_RESPONSE`). RSVP **not going** (`NO`) still clears that
      kid’s transport like FEED. Zero in-play kids → ride create **400**.
- [ ] On `source=MANUAL`, missing / `NO_RESPONSE` reads as **going** (same
      as FEED): Hero / queue show Ride needed for uncovered kids; Agenda
      chip is Ride needed, not “marked not going.” Marking going still
      persists `YES`; marking not going persists `NO`.
- [ ] Update that clears or changes `feedId` while a space-scoped
      PENDING/ACCEPTED ride exists for that `eventKey` → **409**; household
      PLAN-only does not block. Deleting a linked manual cancels this
      circle’s active plans for the key. Deleting the feed unlinks remaining
      manuals (they become standalone); it does not delete them.
- [ ] Enable carpool on the feed attaches matching null-space PLANs whose
      `eventKey` is `CAL:MANUAL:{id}` for manuals linked to that feed, same
      as feed-snapshot keys.

## Tasks

- [x] **Backend (link):** Flyway nullable `feed_id` on `manual_events` (FK,
      `ON DELETE SET NULL`); events CRUD validate feed in circle; calendar
      maps linked manuals; carpool space-event union + peer linked manuals
      for list Accept; RSVP-NO / Enable-attach; 409 on relink with active
      space rides; delete cancels own plans
- [x] **Backend (amend):** When `feedId` set, **derive `kidIds` from feed
      roster** on create/update (ignore client list); zero feed kids → 400;
      restore MANUAL `uncoveredKidIds` / ride `defaultKidIds` to FEED-like
      not-RSVP-NO bag; restore ADR-0003 default-going for MANUAL
- [x] **Contract:** OpenAPI `feedId` on manual event schemas; `CalendarItem`
      + calendar GET descriptions for linked MANUAL `feedId`/`eventKey`;
      web types + `familyClient` create/update bodies. No party-size field
- [x] **Contract (amend):** Document linked create/update: server sets
      `kidIds` from feed; client `kidIds` optional/ignored when `feedId` set
- [x] **Web (link):** compose Team select; `matchCalendarItemToRideEvent`
      allows MANUAL with member/owner `feedId` (exact key); no new tokens
- [ ] **Web (amend):** Team selected → **no kid picker**; restore
      `mapRsvpToAttendance` / `goingKidIdsForItem` default-going for MANUAL;
      linked rows use **FEED-parity** carpool/plan UI (default ask + split
      per-kid/per-leg plans)
- [x] **Tests (link):** events/calendar/carpool for link / 400 unknown feed /
      409 / listRides + peer Accept / Enable-attach / feed-delete unlink;
      web Team round-trip; `calendarRideJoin` MANUAL+feedId; Caregiver path
- [ ] **Tests (amend):** server derives linked `kidIds` from feed; compose
      hides kid picker when Team set; FEED-parity ride/plan paths for linked
      MANUAL; default-going / Ride needed; remove YES-only assertions. No
      new Playwright e2e

## Open questions

*None blocking — locked this amend:*

- Team picker is **any circle feed**, not only feeds with a space. Space is
  still required for Ask-the-team.
- No teammate Agenda fan-out this PR. If dogfood hates Carpool-tab-only
  Accept for one-offs, that is a follow-up slice (do not sneak it in).
- Driving-block merge of linked manuals stays out; revisit only if a banquet
  needs to sit in a same-day FEED block.
- **RSVP polarity:** manuals stay default-going with FEED. “No RSVP → assume
  NO” is reserved for a future reservation / headcount slice — not a silent
  extension of team-link.
- **Party size / adults-only / relative timing** stay out.
- **Linked = full feed roster**, no compose kid picker this PR (FEED parity).
  Partial-roster / sibling-only team one-offs reopen only if dogfood needs them.
