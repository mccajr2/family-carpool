# Spec stub: family-circle-and-kids

Status: planned  
Parent: [docs/roadmap.md](../../roadmap.md)  
Created: 2026-08-07  
Added: 2026-08-07 · initial

Thin stub from `/roadmap`. **Not implementable yet.** Run `/spec family-circle-and-kids`
to flesh out Approach, Acceptance Criteria, and Tasks before any code.

If fleshing out reveals more than one PR-sized slice, stop and `/roadmap` **split**
(`Added: … · re-rank split`) — do not grow this stub into a mega-spec.

## Problem

After sign-in, an adult needs a family circle centered on kids — the shared unit
for schedules and rides. Creating adult becomes Organizer and can add/edit kids.

## Non-goals (sketch)

- Inviting other adults (next slice)
- Named places, feeds, calendar, carpool
- Driver-only role

## Notes

- Depends on `adult-auth-magic-link`.
- **Display name / “what should we call you?”** — collect here (create or join
  circle). Auth v1 auto-creates adults with email only (`displayName` null).
- Roles introduced lightly here (Organizer on create); invite/remove Caregivers in `family-adult-invites-roles`.
