# ADR-0003: Attendance defaults — going is the default

**Status:** Accepted (restored 2026-09-21)  
**Date:** 2026-08-28  
**Amended:** 2026-09-21 · [`manual-event-team-link`](../specs/active/manual-event-team-link.md)
briefly tried MANUAL opt-in; smoke testing showed that broke Hero / Ride
needed for one-offs. Restored default-going for **FEED and MANUAL**.  
**Governs:** [`coverage-priority-engine`](../specs/archive/coverage-priority-engine.md), [`attendance-manual-toggle`](../specs/archive/attendance-manual-toggle.md), manual-event team link

## Context

An earlier iteration modeled attendance as a three-way RSVP: "going," "not sure," "not going," shown as a segmented control the parent was implicitly prompted to resolve.

Manual events can optionally link to a circle activity feed for team carpool
(`manual-event-team-link`). Those rows stay `source=MANUAL` but keep the same
attendance default as FEED so one-offs still surface as Ride needed until the
parent opts out.

## Decision

- **"Going" is the default state** for every child on FEED and MANUAL events,
  with no action required. Missing RSVP / `NO_RESPONSE` counts as going.
  **"Not going"** (`NO`) is the only real opt-out signal — never inferred,
  defaulted to, or reminded.
- **There is no "not sure" state** as a product concept beyond the stored
  `NO_RESPONSE` enum (treated as going on read).
- **Attendance never generates a hero/queue item.** Marking a child "not
  going" removes a ride-needed gap from the queue; it is not a task itself.
- Assigning any real driver / accepting a ride implicitly resets attendance
  back to `"going"` (`YES`) for those kids.
- A future reservation / headcount flow may want “no explicit RSVP → assume
  NO”; that is **out of scope** here and must not silently change this ADR.

## Consequences

- No RSVP reminder feature without revisiting this ADR.
- Copy for the toggle must use "going" / "not going" explicitly — lexically
  distinct from ride-side "drive" language (see
  [`coverage-copy-a11y-polish`](../specs/planned/coverage-copy-a11y-polish.md)).
- Clients and server share one read mapper: missing / `NO_RESPONSE` → going;
  `NO` → not going; `YES` → going — for both `FEED` and `MANUAL`.

## Supersedes

- Three-way **Yes / No / No response** RSVP UX on Agenda for this feature
  area (locked decision updated 2026-08-28).
  [`attendance-manual-toggle`](../specs/archive/attendance-manual-toggle.md)
  ships the two-state UI; OpenAPI enum rename remains deferred.
- The 2026-09-21 wording that default-going was **FEED-only** (rolled back
  the same day after smoke testing).

## Alternatives considered

- **Three-way going / not sure / not going control** — built, then rejected.
- **Time-based RSVP escalation** — explicitly not pursued.
- **MANUAL opt-in (YES-only)** — tried in `manual-event-team-link`; rejected
  for this product surface because new one-offs disappeared from Hero / Ride
  needed until an extra tap. Park for reservation-style flows if needed.
