# Spec stub: coverage-confirm-decline

Status: planned  
Parent: [docs/roadmap.md](../../roadmap.md)  
Created: 2026-08-07  
Added: 2026-08-07 · re-rank split

Thin stub from `/roadmap`. **Not implementable yet.** Run `/spec coverage-confirm-decline`
to flesh out Approach, Acceptance Criteria, and Tasks before any code.

If fleshing out reveals more than one PR-sized slice, stop and `/roadmap` **split**
(`Added: … · re-rank split`) — do not grow this stub into a mega-spec.

## Problem

Adults assign who covers whom (adult + kid(s) + leave-from place) and explicitly
confirm or decline. Example: Parent A + Kid B → Event 1; Parent C + Kid D → Event 2.

## Non-goals (sketch)

- Inventing conflict rules beyond what `conflict-detection` already surfaces
- Carpool request/accept
- Push notifications (parking)

## Notes

- Depends on `conflict-detection` (and places for leave-from).
- Split from former `conflicts-and-coverage`.
