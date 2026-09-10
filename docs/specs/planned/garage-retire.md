# Spec stub: garage-retire

Status: planned  
Parent: [docs/roadmap.md](../../roadmap.md)  
Created: 2026-09-10  
Added: 2026-09-10 · enhancement

Thin stub from `/roadmap`. **Not implementable yet.** Run `/spec garage-retire`
to flesh out Approach, Acceptance Criteria, and Tasks before any code.

If fleshing out reveals more than one PR-sized slice, stop and `/roadmap`
**split** (`Added: … · re-rank split`) — do not grow this stub into a mega-spec.

## Problem

Household garage (vehicles, seats, `drives`, vPIC) shipped before carpool
dogfood was solid. Accept / household drive still require a `vehicleId` and
seat eligibility, and Garage remains in the Settings rail — so empty or
unused garages block the core request/accept loop. Capacity modeling was
premature and is interfering with recovery.

## Non-goals (sketch)

- Re-introducing vehicles, seat counts, or a Garage nav destination
- “I drive / I don’t drive” gating (Accept stays visible to all circle adults)
- Seat-capacity / multi-family capacity math (parking `garage-capacity`)
- Expo / push

## Notes

- **Product lock for this slice:** any circle adult may Accept/Decline; no
  driver-capability toggle.
- Prefer **full product + API retire** over Spotify-style dormant keep —
  do not leave Accept coupled to garage under the hood.
- Future revive (unranked): parking `garage-capacity` after carpool cluster
  dogfoods — not a dependency of Upcoming carpool slices.
- After this ships: remove Garage from chrome; Accept works with zero
  vehicles; strip seat-capacity gates from Calendar/Carpool dogfood copy.
