# ADR-0003: Attendance defaults — FEED vs MANUAL

**Status:** Accepted (amended 2026-09-21)  
**Date:** 2026-08-28  
**Amended:** 2026-09-21 · [`manual-event-team-link`](../specs/active/manual-event-team-link.md)  
**Governs:** [`coverage-priority-engine`](../specs/archive/coverage-priority-engine.md), [`attendance-manual-toggle`](../specs/archive/attendance-manual-toggle.md), manual-event team link

## Context

An earlier iteration modeled attendance as a three-way RSVP: "going," "not sure," "not going," shown as a segmented control the parent was implicitly prompted to resolve.

Manual one-offs can now optionally link to a circle activity feed for team carpool. Those rows stay `source=MANUAL` and must not inherit FEED's default-going bag for ride defaults or uncovered kids.

## Decision

- **FEED events:** **"Going" is the default state** for every child, with no action required. Missing RSVP / `NO_RESPONSE` counts as going. **"Not going"** (`NO`) is the only real opt-out signal — never inferred, defaulted to, or reminded.
- **MANUAL events (including team-linked):** **Opt-in.** Missing / `NO_RESPONSE` is **not going**. Only explicit **`YES`** counts as going (Agenda toggle, `uncoveredKidIds`, Hero/queue, linked-manual ride `defaultKidIds`).
- **There is no "not sure" state** as a product concept beyond the stored `NO_RESPONSE` enum (FEED: treated as going; MANUAL: treated as not going).
- **Attendance never generates a hero/queue item.** Marking a child "not going" removes a ride-needed gap from the queue; it is not a task itself.
- Assigning any real driver / accepting a ride implicitly resets attendance back to `"going"` (`YES`) for those kids.

## Consequences

- No RSVP reminder feature without revisiting this ADR.
- Copy for the toggle must use "going" / "not going" explicitly — lexically distinct from ride-side "drive" language (see [`coverage-copy-a11y-polish`](../specs/planned/coverage-copy-a11y-polish.md)).
- Clients and server must be **source-aware** when mapping RSVP → attendance / uncovered / ride defaults.

## Supersedes

- Three-way **Yes / No / No response** RSVP UX on Agenda for this feature area (locked decision updated 2026-08-28). [`attendance-manual-toggle`](../specs/archive/attendance-manual-toggle.md) ships the two-state UI; OpenAPI enum rename remains deferred.
- The original wording that default-going applied to **every** event — default-going is **FEED-only** after the 2026-09-21 amend.

## Alternatives considered

- **Three-way going / not sure / not going control** — built, then rejected.
- **Time-based RSVP escalation** — explicitly not pursued.
- **Treat linked manuals like FEED (default-going)** — rejected; one-offs stay opt-in even when carpool-eligible.
