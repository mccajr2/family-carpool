# Spec: coverage-priority-same-event

Status: draft  
Created: 2026-09-08  
Parent: [docs/roadmap.md](../../roadmap.md)  
Added: 2026-09-08 · enhancement  
Branch: `coverage-priority-same-event`

## Problem

ADR-0001 ranks **all** own-child coverage gaps ahead of **all** pending carpool
asks. That pushes a teammate’s ask for the practice you just covered behind your
own kid’s gap on a later event — even though finishing the same-event carpool
ask is the natural next decision. Priority should stay family-first **within**
an event, but **same-event** carpool requests should follow immediately after
that event’s own coverage gaps, before own gaps on later events.

## Non-goals

- Manual pin/reorder of the attention queue
- Changing Pass / Accept / Assign / auto-decline / leave-from semantics
- Push or in-app inbox (`push-notifications`, `in-app-notifications`)
- New ride request shapes (`carpool-leg-to-from`, `carpool-meet-at`, etc.)
- OpenAPI / backend changes — queue ordering stays a pure web client concern
- Expo / frozen KMP clients
- Hero/Agenda UI redesign (consumers already call `getQueue`; they pick up the
  new order without layout work)

## Approach

Amend **ADR-0001** and change **`getQueue`** only (plus tests + ADR docs).

**Locked rule (event-grouped, option 1):** walk calendar events soonest-first
(by shared `order` / `startsAt`). For each event E:

1. Emit own-ride gaps on E (`isOwnRideGap`), soonest/stable among kids on E.
2. Then emit actionable inbound carpool asks on E (pending, not auto-declined,
   not passed-by-me), **deduped by `request.id`** so multi-kid rows for the same
   calendar item do not produce duplicate slides.
3. Then advance to the next event F.

So: `ownGap(E) → ask(E) → ownGap(F) → ask(F) → …`. A carpool ask for today when
your kid on that event is already covered ranks **before** your kid’s coverage
gap tomorrow.

No OpenAPI change. Empty queue still means all caught up. Horizon filtering
(`filterQueueWithinHorizon`) stays unchanged and continues to wrap `getQueue`.

## Context

- Decision to amend: [ADR-0001](../../decisions/ADR-0001-coverage-priority-rule.md)
- Prior engine slice (queue contract): [`coverage-priority-engine`](../archive/coverage-priority-engine.md) — `getQueue` / `isOwnRideGap` / request actionability
- Source: `web/src/components/coverageQueue.ts` → `getQueue`, `isOwnRideGap`,
  `isActionableInboundRequest`, `coverageGameEventKey`, `pendingRequests`
- Tests: `web/src/components/coverageQueue.test.ts` → `describe("getQueue")`
- Consumers (read-only for this PR — verify they still use `getQueue`, no local
  re-sort): hero carousel / weekly list focus sync call sites that import
  `getQueue`

## Acceptance criteria

- [ ] ADR-0001 is amended in the same PR: event-grouped ordering replaces the
      absolute “all own gaps, then all asks” rule; consequences still require a
      single shared `getQueue`.
- [ ] `getQueue` implements event-grouped order: for events E then F (E sooner),
      `ownGap(E)` before `ask(E)` before `ownGap(F)` before `ask(F)`.
- [ ] Motivating case: own ride on E confirmed + actionable ask on E + own gap on
      later F → queue starts with `ask(E)`, then `ownGap(F)` (not the reverse).
- [ ] Same-event family-first: own gap on E still outranks ask on E when both
      exist; that ask still outranks own gap on later F.
- [ ] Own-gap predicate unchanged: only `isOwnRideGap` rows (unassigned or
      pending confirm-for-self); `requested`, waiting on another adult, confirmed,
      and `not_going` stay out of the own-ride tier.
- [ ] Actionable-ask predicate unchanged: pending and not `autoDeclined` /
      `passedByMe`.
- [ ] Multi-kid same calendar item: one queue slide per distinct `request.id`
      (dedupe across duplicated `requests` arrays on kid rows).
- [ ] Empty input / all-resolved input still returns `[]`.
- [ ] Existing absolute-tier test(s) that assert “later own gap beats sooner ask”
      are updated to the new event-grouped expectation (not deleted without a
      replacement assertion).
- [ ] No OpenAPI / backend / Expo / KMP changes in this PR.

## Tasks

- [ ] Docs: amend [ADR-0001](../../decisions/ADR-0001-coverage-priority-rule.md) for event-grouped precedence (keep “single shared `getQueue`” consequence)
- [ ] Web: rewrite `getQueue` in `web/src/components/coverageQueue.ts` to group by calendar event (`coverageGameEventKey`), emit own gaps then asks per event, soonest event first; dedupe asks by `request.id`
- [ ] Tests: update `coverageQueue.test.ts` — replace absolute-tier ordering cases; add same-event interleave (covered E + ask E + gap F); add same-event own-gap-before-ask-before-later-gap; add multi-kid request dedupe
- [ ] Web (smoke): confirm hero carousel / focus-sync still consume `getQueue` output order with no local re-sort (fix-only; fix only if a stray sort exists)

## Open questions

- None — ordering locked as event-grouped (option 1) in `/spec`.
