# Spec stub: music-provider-model

Status: parking  
Parent: [docs/roadmap.md](../../roadmap.md)  
Created: 2026-09-08  
Added: 2026-09-08 · re-rank split

Thin stub from `/roadmap`. **Not implementable yet.** Promote + `/spec` when
music returns from parking. Inspect archived
[`ride-playlist-tab`](../archive/ride-playlist-tab.md) before prescribing
migrations.

If fleshing out reveals more than one PR-sized slice, stop and `/roadmap` **split**
(`Added: … · re-rank split`) — do not grow this stub into a mega-spec.

## Problem

Ride music is Spotify-coupled end-to-end. Before Apple Music (or any second
provider), the app needs a provider-neutral boundary: music source, connection,
normalized track metadata, and merge/DJ logic that does not depend on Spotify
SDK objects — without deleting the dormant Spotify implementation.

## Non-goals (sketch)

- Apple Music credentials, OAuth, catalog, or playback (`apple-music-*`)
- Re-enabling Playlist UI for end users
- Locker-room / recurring mixes
- Inventing a new merge algorithm (preserve `mergeTracks` overlap + fairness)

## Notes

- First slice when promoting the Carpool music path from parking.
- Keep Spotify-specific API/OAuth/playback assumptions behind an adapter seam.
- Exact module/class names deferred to `/spec` (Spring Modulith + web/Expo).
