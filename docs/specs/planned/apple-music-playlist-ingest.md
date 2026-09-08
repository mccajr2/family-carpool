# Spec stub: apple-music-playlist-ingest

Status: parking  
Parent: [docs/roadmap.md](../../roadmap.md)  
Created: 2026-09-08  
Added: 2026-09-08 · re-rank split

Thin stub from `/roadmap`. **Not implementable yet.** Promote after
`apple-music-connect`. Run `/spec apple-music-playlist-ingest` before code.

If fleshing out reveals more than one PR-sized slice, stop and `/roadmap` **split**
(`Added: … · re-rank split`) — do not grow this stub into a mega-spec.

## Problem

Once Apple Music connect works, riders need the existing ride-playlist product
rules on Apple Music: one tile per attending kid, one designated source
playlist, persist until changed, normalize tracks into the internal model for
merge — and the Playlist participation UI can return.

## Non-goals (sketch)

- Web/native playback of the generated mix (`apple-music-web-playback` /
  `apple-music-native-playback`)
- Playback-host designation (`music-playback-host`)
- Changing overlap/fairness merge semantics
- Team locker-room mixes

## Notes

- Preserve product decisions from [`ride-playlist-tab`](../archive/ride-playlist-tab.md)
  unless the provider boundary forces a revisit.
- `/spec` resolves library vs catalog playlist selection and no-provider rider
  behavior for participation (not full playback-host UX).
