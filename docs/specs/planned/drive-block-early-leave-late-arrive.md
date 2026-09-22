# Spec stub: drive-block-early-leave-late-arrive

Status: parking  
Parent: [docs/roadmap.md](../../roadmap.md)  
Created: 2026-09-21  
Added: 2026-09-21 · re-rank split

Thin stub from `/roadmap` (drive-block intelligence split). **Not
implementable yet.** Run `/spec drive-block-early-leave-late-arrive` to flesh
out Approach, Acceptance Criteria, and Tasks before any code.

If fleshing out reveals more than one PR-sized slice, stop and `/roadmap`
**split** (`Added: … · re-rank split`) — do not grow this stub into a
mega-spec.

## Problem

Sometimes two events you’re driving **overlap** or sit so tight that the only
viable plan is to **leave early** from event 1 and/or **arrive late** to event
2. The product needs a deliberate schedule/route story for that — not only
merge cards or a soft travel warning — so Agenda and Route reflect the real
leave/arrive times the driver intends.

## Non-goals (sketch)

- Impossible home-hop merge without early/late
  (`drive-block-home-hop-merge`)
- Soft travel margin warn only (`conflict-travel-margin`)
- Player-conflict keep/not-going Hero (`player-conflict-hero` Done)
- Teammate-requested early drop-off / late pickup that the **acceptor
  approves** (`carpool-early-late-window`) — different ask surface
- Editing FEED snapshot official start/end

## Notes

- Distinct from parking `carpool-early-late-window` (ride-request window +
  driver approval). This slice is **your** multi-event driving plan.
- May depend on editable lead times (`event-arrival-lead-time`) and conflict
  travel margin dogfood — sequence at promote time.
- Overlap vs tight-but-non-overlapping may need different UX; split at
  `/spec` if AC diverge.
- **Web first.**
