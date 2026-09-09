# ADR-0001: Coverage priority is event-grouped (family-first within an event)

**Status:** Accepted (amended 2026-09-09)  
**Date:** 2026-08-27  
**Governs:** [`coverage-priority-engine`](../specs/archive/coverage-priority-engine.md), [`hero-attention-carousel`](../specs/archive/hero-attention-carousel.md), [`coverage-priority-same-event`](../specs/archive/coverage-priority-same-event.md)

## Context

The app has two categories of "needs your attention" items:

1. **Coverage** — one of your own children has an upcoming event with no assigned ride (or a pending confirm-for-self).
2. **Carpool requests** — another family has asked if their child can ride with you.

Both used to render as an identical "NEEDS COVERAGE" badge with no distinction, so the hero card could surface a teammate's carpool ask ahead of your own kid sitting without a ride, purely because the teammate's game was chronologically sooner.

The original decision (2026-08-27) fixed that with an **absolute** two-tier rule: every own-child gap ranked ahead of every carpool ask. That over-corrected — a teammate's ask for the practice you just covered could sit behind your own kid's gap on a later event, even though finishing the same-event ask is the natural next decision.

## Decision

Walk calendar events **soonest-first**. For each event E:

1. Emit own-ride coverage gaps on E (`isOwnRideGap`), soonest/stable among kids on E.
2. Then emit actionable inbound carpool asks on E (pending, not auto-declined, not passed-by-me), **deduped by `request.id`**.
3. Then advance to the next event.

So: `ownGap(E) → ask(E) → ownGap(F) → ask(F) → …`.

Family-first still holds **within** an event. Same-event carpool asks follow immediately after that event's own gaps, before own gaps on later events. An empty queue still means all caught up.

## Consequences

- Any component or endpoint that determines "what's the top action" must call the single shared priority function (`getQueue`) rather than re-implementing sort/filter logic locally.
- If the product later introduces more item types, they must be explicitly slotted into this event-grouped precedence by a follow-up ADR.
- Support/design copy should never imply carpool requests are "second-class" — within an event they simply follow own coverage when both are pending.

## Supersedes

- Today/tomorrow-bucket family-vs-community ordering in [`agenda-focus-next-action`](../specs/archive/agenda-focus-next-action.md) for the hero attention queue (replaced by shared `getQueue` ordering).
- Absolute “all own gaps, then all asks” precedence from the original 2026-08-27 form of this ADR (replaced by event-grouped ordering via [`coverage-priority-same-event`](../specs/archive/coverage-priority-same-event.md)).

## Alternatives considered

- **Soonest-event-wins across both categories** — rejected: status quo bug (ask on E could beat own gap on E).
- **Absolute all-own-gaps-then-all-asks** — rejected after ship: same-event asks lagged behind later own gaps.
- **Let the parent manually reorder/pin items** — deferred.
