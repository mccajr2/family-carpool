# Spec stub: carpool-kid-split-plans

Status: planned  
Parent: [docs/roadmap.md](../../roadmap.md)  
Created: 2026-09-10  
Added: 2026-09-10 · re-rank split

Thin stub from `/roadmap` (Ride Coverage Card follow-on for multi-kid teams).
**Not implementable yet.** Run `/spec carpool-kid-split-plans` after
`carpool-leg-split-plans` (same progressive-disclosure pattern).

If fleshing out reveals more than one PR-sized slice, stop and `/roadmap`
**split** — do not grow this stub into a mega-spec.

## Problem

A family can have **multiple kids on the same team** (twins, triplets, siblings).
Default is one shared plan: all going kids, same driver, round-trip, same
location. Real life needs the same progressive treatment as legs — one tap away
from “simple,” then distinct plans per kid (including distinct per-leg plans).

## Non-goals (sketch)

- Domain four-state legs + not-going clears transport —
  [`carpool-leg-to-from`](../archive/carpool-leg-to-from.md) (prerequisite)
- Default card chrome — [`carpool-ride-coverage-card`](../active/carpool-ride-coverage-card.md)
- Leg-only split editor — [`carpool-leg-split-plans`](carpool-leg-split-plans.md)
  (ship first; reuse disclosure pattern)
- Ask-team radius / meet-at — [`carpool-meet-at`](carpool-meet-at.md)

## Notes

- **Default (locked earlier):** assume both/all going kids attend with the same
  driver round-trip to/from the same location — no per-kid chrome until this id.
- **Progressive:** afford something like “Different plans for each kid” (exact
  copy at `/spec`); never show per-kid complexity inline by default.
- Kids are distinct people: one may need TO-only with Mom while another needs
  round-trip with a teammate — combinations are in scope for this follow-on.
- Town dogfood: triplets on one team; twins on multiple teams — must work.
- Web first. Prefer extending leg-slot persistence rather than reviving closed
  PR #107 wholesale.
