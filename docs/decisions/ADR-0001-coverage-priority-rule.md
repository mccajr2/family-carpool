# ADR-0001: Coverage priority is event-grouped (family-first within an event)

**Status:** Accepted (amended 2026-09-16)  
**Date:** 2026-08-27  
**Governs:** [`coverage-priority-engine`](../specs/archive/coverage-priority-engine.md), [`hero-attention-carousel`](../specs/archive/hero-attention-carousel.md), [`coverage-priority-same-event`](../specs/archive/coverage-priority-same-event.md), [`player-conflict-hero`](../specs/archive/player-conflict-hero.md)

## Context

The app has two categories of "needs your attention" items:

1. **Coverage** — one of your own children has an upcoming event with no assigned ride (or a pending confirm-for-self).
2. **Carpool requests** — another family has asked if their child can ride with you.

Both used to render as an identical "NEEDS COVERAGE" badge with no distinction, so the hero card could surface a teammate's carpool ask ahead of your own kid sitting without a ride, purely because the teammate's game was chronologically sooner.

The original decision (2026-08-27) fixed that with an **absolute** two-tier rule: every own-child gap ranked ahead of every carpool ask. That over-corrected — a teammate's ask for the practice you just covered could sit behind your own kid's gap on a later event, even though finishing the same-event ask is the natural next decision.

A later need: when the same kid is in-play on two overlapping events (`KID_TIME_OVERLAP`), coverage and ask slides for either peer are premature until the adult picks which event to keep. That decision belongs **above** gaps/asks for those events, without jumping ahead of sooner unrelated events.

## Decision

Walk calendar events **soonest-first**. For each event E:

1. If E participates in an **unresolved player-conflict** pair (same household kid still in-play on both peers of a `KID_TIME_OVERLAP`), emit the **player-conflict** slide for that pair **once** (dedupe by unordered peer pair — not once per peer event), **before** E's own gaps and inbound asks.
2. Emit own-ride coverage gaps on E (`isOwnRideGap`), soonest/stable among kids on E.
3. Then emit actionable inbound carpool asks on E (pending, not auto-declined, not passed-by-me), **deduped by `request.id`**.
4. Then advance to the next event.

So: `playerConflict(pair) → ownGap(E) → ask(E) → …` when E is in that pair; a sooner event F that is **not** part of the pair still emits its gaps/asks before the later conflict.

Family-first still holds **within** an event. Same-event carpool asks follow immediately after that event's own gaps, before own gaps on later events. An empty queue still means all caught up.

Unresolved for Hero means the kid is in-play (`attendance !== "not_going"`) on **both** peers; marking one side not-going clears that kid from the conflict slide even if amber Agenda `conflicts` remain.

## Consequences

- Any component or endpoint that determines "what's the top action" must call the single shared priority function (`getQueue`) rather than re-implementing sort/filter logic locally.
- If the product later introduces more item types, they must be explicitly slotted into this event-grouped precedence by a follow-up ADR.
- Support/design copy should never imply carpool requests are "second-class" — within an event they simply follow own coverage when both are pending (and both follow player-conflict when that event is in an unresolved pair).

## Supersedes

- Today/tomorrow-bucket family-vs-community ordering in [`agenda-focus-next-action`](../specs/archive/agenda-focus-next-action.md) for the hero attention queue (replaced by shared `getQueue` ordering).
- Absolute “all own gaps, then all asks” precedence from the original 2026-08-27 form of this ADR (replaced by event-grouped ordering via [`coverage-priority-same-event`](../specs/archive/coverage-priority-same-event.md)).

## Alternatives considered

- **Soonest-event-wins across both categories** — rejected: status quo bug (ask on E could beat own gap on E).
- **Absolute all-own-gaps-then-all-asks** — rejected after ship: same-event asks lagged behind later own gaps.
- **Jump player-conflict ahead of all sooner unrelated events** — rejected: adults should finish nearer decisions first; conflict only preempts gaps/asks for the overlapping peers.
- **One conflict slide per peer event** — rejected: duplicate cards for the same pair; emit once, ordered at the sooner peer's turn in the soonest-first walk.
- **Let the parent manually reorder/pin items** — deferred.
