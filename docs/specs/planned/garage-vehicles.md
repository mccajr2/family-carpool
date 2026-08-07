# Spec stub: garage-vehicles

Status: planned  
Parent: [docs/roadmap.md](../../roadmap.md)  
Created: 2026-08-07  
Added: 2026-08-07 · initial

Thin stub from `/roadmap`. **Not implementable yet.** Run `/spec garage-vehicles`
to flesh out Approach, Acceptance Criteria, and Tasks before any code.

If fleshing out reveals more than one PR-sized slice, stop and `/roadmap` **split**
(`Added: … · re-rank split`) — do not grow this stub into a mega-spec.

## Problem

Adults who drive register vehicles with seat capacity. NHTSA vPIC (or equivalent)
suggests seats from make/model/year; always manually overridable. Adults with
zero vehicles / “don’t drive” remain full Caregivers and can still request rides.

## Non-goals (sketch)

- Ride request/accept (next slice)
- Paid vehicle data providers
- Driver-only role

## Notes

- Driving is orthogonal to Organizer/Caregiver role (locked).
- Capacity math foundation for seat updates on accept.
