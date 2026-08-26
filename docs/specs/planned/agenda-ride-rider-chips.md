# Spec stub: agenda-ride-rider-chips

Status: planned  
Parent: [docs/roadmap.md](../../roadmap.md)  
Created: 2026-08-26  
Added: 2026-08-26 · enhancement

Thin stub from `/roadmap`. **Not implementable yet.** Run `/spec agenda-ride-rider-chips`
to flesh out Approach, Acceptance Criteria, and Tasks before any code.

If fleshing out reveals more than one PR-sized slice, stop and `/roadmap` **split**
(`Added: … · re-rank split`) — do not grow this stub into a mega-spec.

## Problem

Adults want a glanceable “who’s in the car” cue on Agenda Focus and cards —
small circles for kids (and related people) on ride states. Profile photos do
not exist in the product yet; names + initials should carry dogfood.

## Non-goals (sketch)

- Photo upload / storage —
  [`member-profile-photos`](member-profile-photos.md) (parking)
- Ride action parity or who/where text density (sibling slices)
- Multi-stop passenger lists, Expo Agenda UI

## Notes

- Reuse covering-adult initials avatar pattern from
  [`agenda-list-chips`](../archive/agenda-list-chips.md).
- First-name labels (and a11y names) with initials circles; keep existing
  covering avatars. Names/initials only.
