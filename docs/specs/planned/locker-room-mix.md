# Spec stub: locker-room-mix

Status: parking  
Parent: [docs/roadmap.md](../../roadmap.md)  
Created: 2026-08-14  
Added: 2026-08-14 · enhancement

Thin stub from `/roadmap`. **Not implementable yet.** Run `/spec locker-room-mix`
to flesh out Approach, Acceptance Criteria, and Tasks before any code.

If fleshing out reveals more than one PR-sized slice, stop and `/roadmap` **split**
(`Added: … · re-rank split`) — do not grow this stub into a mega-spec.

## Problem

The same merge idea as a ride playlist can make a **team pump-up mix** for the
locker room (or pre-game). One shared list for the space, not one per carpool
trip — still overlap-aware, still editable through the season, still able to
pin lucky songs.

## Non-goals (sketch)

- Inventing a second playlist engine (reuse `ride-playlist-merge`)
- Song lookup / streaming export (`playlist-open-in-streaming`)
- Coach-administered club software
- In-app playback

## Notes

- Depends on `ride-playlist-merge` + a real team space
  (`team-carpool-space-invite`).
- Surface is the carpool space, not a single ride. Keep it optional and
  secondary to rides.
