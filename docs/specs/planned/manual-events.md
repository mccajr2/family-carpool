# Spec stub: manual-events

Status: planned  
Parent: [docs/roadmap.md](../../roadmap.md)  
Created: 2026-08-07  
Added: 2026-08-07 · re-rank split

Thin stub from `/roadmap`. **Not implementable yet.** Run `/spec manual-events`
to flesh out Approach, Acceptance Criteria, and Tasks before any code.

If fleshing out reveals more than one PR-sized slice, stop and `/roadmap` **split**
(`Added: … · re-rank split`) — do not grow this stub into a mega-spec.

## Problem

Not every activity has a feed. Adults need a manual add/edit escape hatch so
events still land on the family calendar and can attach kids.

## Non-goals (sketch)

- Feed import/sync
- Calendar presentation polish beyond what’s needed to verify CRUD
- Coverage / conflicts / leave-by

## Notes

- Depends on kids; can land before or after `activity-feed-sync` — ranked after sync so import is the primary path.
- Split from former `feed-import-calendar`.
