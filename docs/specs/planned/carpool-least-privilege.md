# Spec stub: carpool-least-privilege

Status: planned  
Parent: [docs/roadmap.md](../../roadmap.md)  
Created: 2026-08-13  
Added: 2026-08-13 · enhancement

Thin stub from `/roadmap`. **Not implementable yet.** Run `/spec carpool-least-privilege`
to flesh out Approach, Acceptance Criteria, and Tasks before any code.

If fleshing out reveals more than one PR-sized slice, stop and `/roadmap` **split**
(`Added: … · re-rank split`) — do not grow this stub into a mega-spec.

## Problem

Carpool membership is the **family circle**: every adult in a member household
sees the same team space (invite code, other circle names, later pickup
addresses / teammate details). A nanny, grandparent, or co-parent may only need
**this family’s kids** (calendar, coverage, RSVP) and should not see other
families’ carpool roster, codes, or addresses.

## Non-goals (sketch)

- Changing `team-carpool-space-invite` v1 (circle-wide membership stays)
- Coach / league admin
- Driver-only role (`driver-only-role` parking — orthogonal: who drives, not
  who sees teammate PII)
- Multi-circle membership (`multi-circle-membership`)

## Notes

- **When it matters:** before `carpool-request-accept` (and any slice that
  shows teammate pickup places, garage, or kids). Today’s space UI is circle
  **names** only — no other families’ kids or addresses yet.
- Open: new circle role vs per-space “team carpool” flag vs Organizer-only
  roster. Keep Hick: don’t add a third competing primary on Carpool for v1.
- v1 already: Enable = Organizer; non-member circles don’t see members/code/rides.
