# Spec stub: ride-playlist-merge

Status: parking  
Parent: [docs/roadmap.md](../../roadmap.md)  
Created: 2026-08-14  
Added: 2026-08-14 · enhancement

Thin stub from `/roadmap`. **Not implementable yet.** Run `/spec ride-playlist-merge`
to flesh out Approach, Acceptance Criteria, and Tasks before any code.

If fleshing out reveals more than one PR-sized slice, stop and `/roadmap` **split**
(`Added: … · re-rank split`) — do not grow this stub into a mega-spec.

## Problem

Kids in a carpool should be able to keep a ride playlist that can change through
the season. When three teammates share a ride, merge their lists into one:
prefer **shared songs** where they overlap, then **balance coverage** so one
kid does not dominate. Shuffle for the trip; **pin lucky songs**. Adults/kids
can edit as tastes change.

## Non-goals (sketch)

- Song catalog search and Apple Music / Spotify open/export
  (`playlist-open-in-streaming`)
- Team locker-room pump-up mix (`locker-room-mix`)
- In-app audio playback or a paid streaming license
- Replacing carpool request/accept

## Notes

- Fun, after carpool request/accept is real — not a beta gate.
- Merge algorithm and pin/shuffle UX live here; resolving a song to a
  streaming URL lives in `playlist-open-in-streaming`.
- Keep Hick: playlist is secondary to “who is driving / who has seats.”
