# Spec stub: apple-music-web-playback

Status: parking  
Parent: [docs/roadmap.md](../../roadmap.md)  
Created: 2026-09-08  
Added: 2026-09-08 · re-rank split

Thin stub from `/roadmap`. **Not implementable yet.** Promote after
`apple-music-playlist-ingest`. Run `/spec apple-music-web-playback` before code.

If fleshing out reveals more than one PR-sized slice, stop and `/roadmap` **split**
(`Added: … · re-rank split`) — do not grow this stub into a mega-spec.

## Problem

Carpool music is a short generated DJ mix (~60–90 min), not a streaming service.
After Apple Music tracks can be ingested and merged, web must queue/play the mix
— preferring an ephemeral playback queue over requiring a permanent provider
playlist. “Open in Spotify”-style UX must not dictate Apple Music.

## Non-goals (sketch)

- Expo/native background playback (`apple-music-native-playback`)
- Playback-host multi-device UX (`music-playback-host`)
- Offline download / own audio CDN
- ML recommendations

## Notes

- Remix / duration coverage tied to existing route/drive-time model stays.
- `/spec` resolves unavailable tracks, explicit-content filtering, clean
  versions, and exact web MusicKit architecture.
