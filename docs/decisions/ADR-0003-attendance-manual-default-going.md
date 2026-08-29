# ADR-0003: Attendance defaults to "going"; "not going" is manual-only

**Status:** Accepted  
**Date:** 2026-08-28  
**Governs:** [`coverage-priority-engine`](../specs/active/coverage-priority-engine.md), [`attendance-manual-toggle`](../specs/planned/attendance-manual-toggle.md)

## Context

An earlier iteration modeled attendance as a three-way RSVP: "going," "not sure," "not going," shown as a segmented control the parent was implicitly prompted to resolve.

## Decision

- **"Going" is the default state** for every event, for every child, with no action required.
- **"Not going" is the only real signal**, and it is exclusively a **manual, deliberate action** — never inferred, defaulted to, or reminded.
- **There is no "not sure" state.**
- **Attendance never generates a hero/queue item.** Marking a child "not going" removes a ride-needed gap from the queue; it is not a task itself.
- Assigning any real driver implicitly resets attendance back to `"going"`.

## Consequences

- No RSVP reminder feature without revisiting this ADR.
- Copy for the toggle must use "going" / "not going" explicitly — lexically distinct from ride-side "drive" language (see [`coverage-copy-a11y-polish`](../specs/planned/coverage-copy-a11y-polish.md)).

## Supersedes

- Three-way **Yes / No / No response** RSVP UX on Agenda for this feature area (locked decision updated 2026-08-28). API migration deferred to [`attendance-manual-toggle`](../specs/planned/attendance-manual-toggle.md); rank 1 may map existing RSVP values client-side (`YES`/`NO_RESPONSE` → going, `NO` → not_going).

## Alternatives considered

- **Three-way going / not sure / not going control** — built, then rejected.
- **Time-based RSVP escalation** — explicitly not pursued.
