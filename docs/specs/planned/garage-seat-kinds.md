# Spec stub: garage-seat-kinds

Status: parking  
Parent: [docs/roadmap.md](../../roadmap.md)  
Created: 2026-08-14  
Added: 2026-08-14 · enhancement

Thin stub from `/roadmap`. **Not implementable yet.** Run `/spec garage-seat-kinds`
to flesh out Approach, Acceptance Criteria, and Tasks before any code.

If fleshing out reveals more than one PR-sized slice, stop and `/roadmap` **split**
(`Added: … · re-rank split`) — do not grow this stub into a mega-spec.

## Problem

A single “total seats including the driver” number is enough to start carpool
math, but real cars mix **adult seats**, **kid seats**, and **boosters** for
little ones. Families need to know whether there is a legal/comfortable place
for a toddler, not only whether a raw seat count is left.

## Non-goals (sketch)

- Changing v1 `garage-vehicles` (one overridable total)
- Insurance, LATCH hardware catalogs, or legal-compliance engines
- Ride request/accept trip math (consume this later)

## Notes

- Depends on `garage-vehicles`. Promote after request/accept is dogfoodable
  unless dogfood shows total-only seats is blocking.
- Keep Hick: don’t add three counters on Add vehicle in v1.
