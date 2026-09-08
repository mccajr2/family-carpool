# Spec stub: apple-music-native-playback

Status: parking  
Parent: [docs/roadmap.md](../../roadmap.md)  
Created: 2026-09-08  
Added: 2026-09-08 · re-rank split

Thin stub from `/roadmap`. **Not implementable yet.** Promote after web playback
proof and `rn-expo-scaffold` (or a thin native spike if product pulls music
earlier). Run `/spec apple-music-native-playback` before code.

If fleshing out reveals more than one PR-sized slice, stop and `/roadmap` **split**
(`Added: … · re-rank split`) — do not grow this stub into a mega-spec.

## Problem

Native playback / background audio is a **technical risk to validate early**:
Google Maps may be foregrounded while the mix continues. Web MusicKit does not
automatically solve Expo/iOS/Android integration.

## Non-goals (sketch)

- Full playback-host product UX (`music-playback-host`)
- Supporting every music provider
- Replacing Apple Music with self-hosted streaming
- Lockstep feature parity with every web surface

## Notes

- Treat iOS and Android as separate architecture answers in `/spec`.
- Minimum supported device/account combo for a playback host deferred to `/spec`.
