# Spec stub: apple-music-connect

Status: parking  
Parent: [docs/roadmap.md](../../roadmap.md)  
Created: 2026-09-08  
Added: 2026-09-08 · re-rank split

Thin stub from `/roadmap`. **Not implementable yet.** Promote after
`music-provider-model`. Run `/spec apple-music-connect` before code.

If fleshing out reveals more than one PR-sized slice, stop and `/roadmap` **split**
(`Added: … · re-rank split`) — do not grow this stub into a mega-spec.

## Problem

Apple Music is the intended first viable music provider (developer already has
an Apple Music subscription; Apple Developer Program ~$99/yr is acceptable). The
product needs a secure credentials + catalog + user-authorize proof before
playlist ingest or playback.

## Non-goals (sketch)

- Playlist designate/ingest UI (`apple-music-playlist-ingest`)
- Playback on web or native
- Spotify Premium / asking users for API keys or music-service passwords
- Independent catalog / Audius-style niche providers as primary

## Notes

- Success bar: developer can configure MusicKit/Apple Music credentials and a
  test user can authorize; catalog query works.
- Open questions for `/spec`: what “connected” means; token lifecycle;
  catalog-only vs user-authorized operations.
