# Spec stub: multi-circle-membership

Status: planned (parking)  
Parent: [docs/roadmap.md](../../roadmap.md)  
Created: 2026-08-08  
Added: 2026-08-08 · enhancement

Thin stub from `/roadmap`. **Not implementable yet.** Promote into Upcoming
via `/roadmap` re-rank, then `/spec multi-circle-membership`.

## Problem

Some adults belong in more than one household unit: blended families, or
grandparents with more than one set of grandkids. v1’s one-circle-per-adult
model cannot represent that without awkward workarounds.

## Non-goals (sketch)

- Replacing Organizer/Caregiver roles
- Attention-balance analytics (`caregiver-attention-balance`)
- Read-only follows of non-member calendars (`read-only-calendar-follows`)

## Notes

- Depends on `family-circle-and-kids` (+ likely invites).
- Keep circle = kids-centered household; membership is many-to-many adult↔circle.
