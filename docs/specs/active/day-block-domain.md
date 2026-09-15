# Spec: day-block-domain

Status: draft  
Created: 2026-09-14  
Updated: 2026-09-15 (`/spec`)  
Parent: [docs/roadmap.md](../../roadmap.md)  
Added: 2026-09-14 · enhancement  
Branch: `day-block-domain`

## Problem

Hero and Agenda are **per event** (one `CalendarItem` → one card / Route). That
breaks down when one continuous drive serves multiple events (e.g. one leave-
home run feeding back-to-back practices at the same rink). We need a
**driving block** — CalendarItems sharing a confirmed driver (adult), same
leg, same venue identity, and a drive-time-aware contiguous window — as a
computed grouping over live RideRequest / per-leg data. Without a server
grouping rule (and a cheap way to correct it), later Agenda/Route block UI
will invent divergent merge heuristics.

## Non-goals

- Agenda/Focus **one card per block** chrome (`day-block-agenda`) — no new
  card components or visual treatments in this PR
- Route tab multi-event stop sequence (`day-block-route`)
- Stop-order optimize (`carpool-route-optimize` — single-event until blocks
  exist; block-wide optimize stays on `day-block-route`)
- Any change to per-event RideRequest / coverage semantics
- Cross-family block merging (viewer household’s own confirmed driving only)
- Merging on shared leave-from / logistics without shared venue (rejected —
  infers intent; fails unsafe)
- Editable arrival lead times (`event-arrival-lead-time`) — still read the
  existing title-heuristic `bufferMinutes` / `RouteBufferMinutes`
- Expo / KMP
- **This PR’s UI is a functional stopgap to validate the merge rule and
  override, not a preview of day-block-agenda’s design. No new components;
  reuse existing card/link patterns.**

## Approach

**Computed view, not a new trip entity.** On each calendar read (and after
override writes), for the signed-in adult, derive driving blocks from live
confirmed leg assignments. Membership must change the moment a driver becomes
confirmed (e.g. accept of a pending ask) — no persisted block rows, no
explicit re-merge job.

**Membership (auto-merge of two items into one block):**

1. Same viewing adult is the **confirmed** driver on the **same leg** (TO or
   FROM — never mixed). Pending asks do not qualify.
2. Same destination **venue identity** for that leg’s events — match on the
   leave-by destination geocode identity already used for travel estimates
   (same `geocode_cache` hit / rounded coords), **not** free-text `location`
   string equality and not inventing circle Place rows for venues.
3. Contiguous via effective gap (not a flat raw-gap threshold):

   ```
   effectiveGap = event2.startsAt − padding(event2) − event1.endsAt
   merge (wait at venue) if effectiveGap < roundTripDriveTime(venue, home) + buffer
   ```

   - `padding(event)` = existing title-heuristic arrival buffer
     (`RouteBufferMinutes` / Route `bufferMinutes`: practice 20 / game 45 /
     other 0) — read from that helper, do not hardcode in the merge rule.
   - `roundTripDriveTime` = **2 ×** the one-way home→venue duration already
     available from leave-by’s route cache / enrichment path — no new
     geocoding stack.
   - Contiguity **buffer**: lock **15 minutes** on top of round-trip for v1
     (dogfood may tune; do not invent a second padding system).
   - Drive-time unavailable (no home, cache miss / `PENDING` /
     `UNAVAILABLE`) → flat **30-minute** raw-gap fallback, **biased toward
     merge** (wrong merge costs Agenda granularity; wrong split can suggest
     an infeasible go-home-and-return).
   - Missing `endsAt` on either event → treat that pair with the same flat
     fallback (do not invent an end time).
4. Same driver + same leg + adjacent times but **different venue identity** →
   two blocks regardless of gap.
5. Every confirmed-driving (or singleton eligible) event still yields a
   one-item block so later Agenda can always key off blocks.

**Manual override (v1, persisted):** FORCE_MERGE / FORCE_SPLIT between an
ordered adjacent pair (adult + leg + two calendar item refs). Overrides are
the only persisted block-related state; recompute still runs from live rides,
then applies overrides. Clearing an override returns that pair to the auto
rule.

**OpenAPI (explicit):**

- Enrich calendar payloads for the viewing adult with enough block adjacency
  for the interim control (e.g. per-item `driveBlock` / sibling refs +
  whether the pair is auto-combined vs override-forced). Prefer embedding on
  `GET …/calendar` (and leave-by fill-in / mutation responses that return
  `CalendarItem`) over a separate list endpoint unless Modulith forces a
  cleaner split.
- Write endpoints for merge / split / clear override (member-authz: viewing
  adult only for their own overrides). Persist with `createdAt` so dogfood
  can count override frequency vs auto merges.
- Update **web** `familyClient` in the same change. No Expo/KMP.

**Minimal web control:** on today’s **existing** per-event Agenda row (and
Focus only if the same link pattern already sits there — do not invent Focus
chrome), when the adult is the confirmed driver and an adjacent sibling
exists for that leg, show a plain text link like:

- Combined: `Combined with your 6:00 drive · Split this out`
- Splittable: `Split from your 6:00 drive · Combine these`

Reuse existing `text-xs underline` link classes from Agenda override links.
No new components, tokens, or card layout.

**Carry-forward** (also on `day-block-agenda` stub): remove this interim
control once block cards ship — do not leave two competing affordances.

**Module shape:** compute inside `calendar` (already depends on `leaveby` +
`carpool`); leave-by stays the duration/geocode source of truth; override
persistence lives with calendar (or a thin table owned by calendar). Keep
`ModularityTests` green.

## Context

Allowlist for `/implement`:

- Decision: [`docs/decisions/ADR-0004-carpool-card-perspective-rules.md`](../../decisions/ADR-0004-carpool-card-perspective-rules.md)
  (domain shapes that feed cards/Route must not fight the nine rules —
  especially leg-scoping and perspective)
- Architecture: [`docs/architecture.md`](../../architecture.md) → **Calendar
  agenda**, **Leave-by**, **Leave-by estimate (detail)**, **Team carpool
  space (detail)** → Rides (confirmed legs)
- Mockup (grouping scenarios only — not visual lock):
  [`docs/ui-system/day-block-grouping.mockup.html`](../../ui-system/day-block-grouping.mockup.html)
- Padding heuristic SoT: [`docs/specs/archive/ride-route-tab.md`](../archive/ride-route-tab.md)
  (game 45 / practice 20 / other 0)
- Source:
  - `backend/modules/calendar/…/CalendarService.java`, `CalendarController.java`
  - `backend/modules/leaveby/…/LeaveByApi.java`, `RouteBufferMinutes.java`,
    `LeaveByApiImpl.java` (cache-only duration / geocode identity)
  - `backend/modules/carpool/` — confirmed assignee / per-leg plan reads used
    by calendar today
  - `contracts/openapi.yaml` — `CalendarItem`, calendar list / leave-by
  - `web/src/api/familyClient.ts` (+ tests)
  - `web/src/components/AgendaRow.tsx` (existing override link pattern)

Do not re-derive ADR-0004 from the mockup. Cite
[`day-block-agenda`](../planned/day-block-agenda.md) /
[`day-block-route`](../planned/day-block-route.md) only as out-of-scope
siblings.

## Acceptance criteria

- [ ] Same rink (same geocode identity), back-to-back, 0-min raw gap, viewing
      adult confirmed on TO for both → one TO block containing both items.
- [ ] Same two events / venue / day, but another adult’s confirmed pickup on a
      different leg or as a different driver → **not** merged into the first
      adult’s block.
- [ ] Rink ~5 min one-way from home, 90-min raw gap, 20-min practice padding on
      event2 → effective gap ~70 min, round trip ~10 min + 15 buffer → **two**
      blocks (still manually mergeable).
- [ ] Rink ~25 min one-way from home, 30-min raw gap, 45-min game padding on
      event2 → effective gap negative → **one** block (wait at venue). A flat
      30-min raw-gap rule would have wrongly split this pair.
- [ ] Same confirmed driver, same leg, adjacent events, different venue
      geocode identity → two blocks regardless of gap.
- [ ] Drive-time estimate unavailable for a pair → flat 30-min fallback,
      biased toward merge.
- [ ] After today’s blocks were already computed, a driver **accepts** a
      pending carpool ask that makes them the confirmed driver → next calendar
      read reflects new block membership with **no** explicit re-merge action.
- [ ] FORCE_MERGE / FORCE_SPLIT override persists for that adult+leg+pair and
      wins over the auto rule until cleared; clearing restores auto.
- [ ] OpenAPI + web client expose block adjacency + override writes; interim
      Agenda link appears on existing per-event cards for adjacent siblings
      only — no new components / tokens.
- [ ] Unit tests cover the merge matrix above (including unavailable
      drive-time + missing `endsAt` fallback); integration test covers
      override write + calendar read reflecting it; web unit test covers the
      link labels / handlers. Relevant suites pass; `ModularityTests` pass.

## Tasks

- [ ] Backend: driving-block compute (confirmed driver + leg + venue identity
      + effective-gap rule + 15-min buffer + 30-min merge-biased fallback);
      singleton blocks; apply FORCE_MERGE / FORCE_SPLIT overrides
- [ ] Backend: persist overrides (adult, leg, ordered item pair, action,
      `createdAt`); clear path
- [ ] Backend: enrich calendar `CalendarItem` (or adjacent sibling fields)
      for the viewing adult; no Nominatim/OSRM on the cheap list path beyond
      existing leave-by cache reads
- [ ] Contract: OpenAPI schemas + override write operations; document
      computed-vs-override semantics
- [ ] Web: `familyClient` types + override calls aligned with OpenAPI
- [ ] Web: interim merge/split plain link on existing `AgendaRow` (today’s
      confirmed-driving adjacent siblings); reuse current link classes
- [ ] Docs: architecture Calendar / Leave-by note that driving blocks are a
      computed view + override table (short); update
      [`day-block-agenda`](../planned/day-block-agenda.md) carry-forward
- [ ] Tests: merge-rule unit matrix; override + accept→membership integration;
      Agenda link unit test; `ModularityTests`

## Open questions

- Contiguity buffer locked at **15** for v1 — retune only after dogfood if
  override rate is high.
- Venue identity = leave-by geocode identity (not circle Place UUID). If two
  free-text locations geocode apart despite being “the same rink,” override
  covers it; do not string-match.
- `carpool-route-optimize` may still be unmerged on `main` when this ships;
  this slice does not depend on it (`day-block-route` does).
