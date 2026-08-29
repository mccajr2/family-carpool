# ADR-0001: Own-child coverage outranks carpool requests

**Status:** Accepted  
**Date:** 2026-08-27  
**Governs:** [`coverage-priority-engine`](../specs/archive/coverage-priority-engine.md), [`hero-attention-carousel`](../specs/archive/hero-attention-carousel.md)

## Context

The app has two categories of "needs your attention" items:

1. **Coverage** — one of your own children has an upcoming event with no assigned ride.
2. **Carpool requests** — another family has asked if their child can ride with you.

Both used to render as an identical "NEEDS COVERAGE" badge with no distinction, so the hero card could surface a teammate's carpool ask ahead of your own kid sitting without a ride, purely because the teammate's game was chronologically sooner.

## Decision

The hero queue's ordering is always:

1. Any of the parent's own children with an **unassigned ride**, soonest event first.
2. Only if (1) is empty: any **pending carpool request** addressed to the parent, soonest event first.
3. Only if (1) and (2) are both empty: an "all caught up" resolved state.

This ordering is absolute — a carpool request due tomorrow never outranks an own-child coverage gap due next week.

## Consequences

- Any component or endpoint that determines "what's the top action" must call the single shared priority function (`getQueue`) rather than re-implementing sort/filter logic locally.
- If the product later introduces more item types, they must be explicitly slotted into this precedence list by a follow-up ADR.
- Support/design copy should never imply carpool requests are "second-class" — they're simply lower precedence when both are pending.

## Supersedes

- Today/tomorrow-bucket family-vs-community ordering in [`agenda-focus-next-action`](../specs/archive/agenda-focus-next-action.md) for the hero attention queue (replaced by global own-ride-first ordering via `getQueue`).

## Alternatives considered

- **Soonest-event-wins across both categories** — rejected: status quo bug.
- **Let the parent manually reorder/pin items** — deferred.
