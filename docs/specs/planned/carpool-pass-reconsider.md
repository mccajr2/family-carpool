# Spec stub: carpool-pass-reconsider

Status: planned  
Parent: [docs/roadmap.md](../../roadmap.md)  
Created: 2026-08-25  
Added: 2026-08-25 · enhancement

Thin stub from `/roadmap`. **Not implementable yet.** Run `/spec carpool-pass-reconsider`
to flesh out Approach, Acceptance Criteria, and Tasks before any code.

If fleshing out reveals more than one PR-sized slice, stop and `/roadmap` **split**
(`Added: … · re-rank split`) — do not grow this stub into a mega-spec.

## Problem

Dogfood: if you **accept** then **cancel/withdraw**, Accept/Pass returns (pass
rows were cleared). If you **pass**, that is final — no way to accept later when
no one else offered and the ask becomes more urgent. Pass should mean “not right
now,” not “never.” While the ride is still `PENDING`, the passer should be able
to **Accept**.

## Non-goals (sketch)

- Exposing a Pass **button** on the Carpool tab (wiring only) —
  [`agenda-carpool-action-parity`](agenda-carpool-action-parity.md)
- Chip copy, Focus Request CTA, incoming who/where —
  [`carpool-ride-clarity`](../archive/carpool-ride-clarity.md); further
  density —
  [`agenda-carpool-state-clarity`](agenda-carpool-state-clarity.md)
- Notifying others that you passed or un-passed (push / in-app inbox)
- Changing Pass so it cancels the request for everyone
- Expo Agenda UI

## Notes

- [`agenda-focus-carpool-actions`](../archive/agenda-focus-carpool-actions.md)
  locked **no un-pass** and hid Accept when `passedByMe`. This slice amends that.
- `/spec` should pick: allow Accept despite `passedByMe` (simplest) vs an
  explicit un-pass. Either way, Accept stays gated on `PENDING` and existing
  seat/driver rules; if someone else already accepted, there is nothing to take.
- Coordinate with action-parity: Pass CTA on tab is that slice; **un-pass /
  Accept-after-Pass** stays here.
