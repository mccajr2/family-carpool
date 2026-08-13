# Spec stub: conflict-travel-margin

Status: planned  
Parent: [docs/roadmap.md](../../roadmap.md)  
Created: 2026-08-12  
Added: 2026-08-12 · enhancement

Thin stub from `/roadmap`. **Not implementable yet.** Run `/spec conflict-travel-margin`
to flesh out Approach, Acceptance Criteria, and Tasks before any code.

If fleshing out reveals more than one PR-sized slice, stop and `/roadmap` **split**
(`Added: … · re-rank split`) — do not grow this stub into a mega-spec.

## Problem

True event-time overlap (“pick one”) is handled by `conflict-detection`. Adults
can still be **cutting it close**: leave-by / travel from one event leaves too
little gap before the next. That softer case needs a distinct **warn** signal —
not the same amber as hard overlap, and not a 409.

## Non-goals (sketch)

- Replacing event-window overlap / CONFIRMED 409 (`conflict-detection`)
- Auto-resolve or auto-reassign
- Paid live traffic (`paid-live-traffic`)
- Push alerts (`push-notifications`)

## Notes

- **Depends on** leave-by maturity: prefer after
  [`coverage-leave-from`](coverage-leave-from.md) and
  [`event-arrival-lead-time`](event-arrival-lead-time.md) so origin and arrival
  lead times are stable before warning on travel gaps.
- Builds on shipped leave-by estimates (labeled estimate — warn copy must not
  imply live traffic).
- `/spec` should lock: warn vs conflict severity in OpenAPI + UI; margin
  threshold; whether warn is adult-scoped (leave-by) vs kid-scoped; no 409 for
  soft warn.
