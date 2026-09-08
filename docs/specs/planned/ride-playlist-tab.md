# Spec stub: ride-playlist-tab

Status: planned  
Parent: [docs/roadmap.md](../../roadmap.md)  
Created: 2026-09-06  
Added: 2026-09-06 · enhancement

Thin stub from `/roadmap`. **Not implementable yet.** Run `/spec ride-playlist-tab`
to flesh out Approach, Acceptance Criteria, and Tasks before any code.

If fleshing out reveals more than one PR-sized slice, stop and `/roadmap` **split**
(`Added: … · re-rank split`) — do not grow this stub into a mega-spec.

## Problem

For a confirmed ride, adults cannot see who is in the car, whether riders have
connected music, or a drive-length-aware merged playlist — nor invite
unconnected riders or hand off “Open in Spotify” without Premium remote
control.

## Non-goals (sketch)

- Spotify Connect / remote playback (requires driver Premium) — preserve
  mockup “Open in Spotify” handoff only
- Apple Music or multi-service catalog (parked; was `playlist-open-in-streaming`)
- Team locker-room mix (`locker-room-mix`)
- Route tab / OSRM (`ride-route-tab`)

## Notes

- **Mockup SoT:** `PlaylistTab`, `RiderTile`, `InviteAction`, `TrackRow`,
  round-robin `mergeTracks` in
  [`docs/ui-system/carpool-combined-flow.jsx`](../../ui-system/carpool-combined-flow.jsx).
- **Supersedes** parking `ride-playlist-merge` (mockup merge is round-robin,
  not shared-songs-first) and the Spotify path of `playlist-open-in-streaming`.
- Free-tier Spotify Web API OAuth per rider; token storage/refresh + revoke;
  define source playlist (liked-songs vs designated) at `/spec`.
- Invite-to-connect notify: same channel pattern as route notify; may soft-fail
  until [`push-notifications`](push-notifications.md).
- Depends on [`ride-detail-shell`](../archive/ride-detail-shell.md) (+ [`ride-detail-schedule-utils`](../archive/ride-detail-schedule-utils.md) for
  `mergeTracks`).
