# Spec stub: drive-block-home-hop-merge

Status: parking  
Parent: [docs/roadmap.md](../../roadmap.md)  
Created: 2026-09-21  
Added: 2026-09-21 · re-rank split

Thin stub from `/roadmap` (drive-block intelligence split). **Not
implementable yet.** Run `/spec drive-block-home-hop-merge` to flesh out
Approach, Acceptance Criteria, and Tasks before any code.

If fleshing out reveals more than one PR-sized slice, stop and `/roadmap`
**split** (`Added: … · re-rank split`) — do not grow this stub into a
mega-spec.

## Problem

When the same adult is driving two nearby events, the gap may be too short to
honor Leaving from / Returning to (home or other named place) between them —
even across **different feeds**. Today merge is gap/buffer-aware for FEED
pairs but does not treat “impossible home hop” as a first-class reason to
keep one continuous driving block and itinerary.

## Non-goals (sketch)

- Source eligibility for linked MANUAL (`drive-block-linked-manual`)
- Early leave / late arrive schedule overrides
  (`drive-block-early-leave-late-arrive`)
- Soft “cutting it close” Agenda warn only (`conflict-travel-margin`)
- Changing Leaving from / Returning to UX (`block-route-origin` Done)
- Teammate early-drop / late-pickup **asks** (`carpool-early-late-window`)

## Notes

- Builds on archived `day-block-domain` drive-time gap + buffer; expect
  ADR-0004 / merge-rule touch — confirm at `/spec`.
- **Cross-feed is in scope** for this slice (unlike same-feed preference on
  linked-manual eligibility).
- **Multi-kid / multi-feed same-driver** (different kids on different teams
  in one evening) stays in this epic — ship single-kid first if `/spec`
  balloons; do not invent a second id until needed.
- **Web first.**
