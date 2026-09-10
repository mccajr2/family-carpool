# Spec stub: garage-seat-kinds

Status: parking  
Parent: [docs/roadmap.md](../../roadmap.md)  
Created: 2026-08-14  
Added: 2026-08-14 · enhancement

Thin stub from `/roadmap`. **Not implementable yet.** Parked with
`garage-capacity` after `garage-retire`. Do not promote until capacity
returns.

If fleshing out reveals more than one PR-sized slice, stop and `/roadmap`
**split** (`Added: … · re-rank split`) — do not grow this stub into a mega-spec.

## Problem

A single “total seats including the driver” number is enough to start carpool
math, but real cars mix **adult seats**, **kid seats**, and **boosters** for
little ones. Families need to know whether there is a legal/comfortable place
for a toddler, not only whether a raw seat count is left.

## Non-goals (sketch)

- Reviving garage / capacity before `garage-capacity` dogfoods
- Changing Accept to require vehicles while garage is retired
- Insurance, LATCH hardware catalogs, or legal-compliance engines

## Notes

- Depends on parking `garage-capacity` (and prior `garage-retire`).
- Do not promote while Accept is vehicle-free.
- Keep Hick: don’t add three counters on Add vehicle when capacity returns.
