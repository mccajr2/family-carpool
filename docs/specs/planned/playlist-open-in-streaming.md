# Spec stub: playlist-open-in-streaming

Status: parking  
Parent: [docs/roadmap.md](../../roadmap.md)  
Created: 2026-08-14  
Added: 2026-08-14 · enhancement

Thin stub from `/roadmap`. **Not implementable yet.** Run `/spec playlist-open-in-streaming`
to flesh out Approach, Acceptance Criteria, and Tasks before any code.

If fleshing out reveals more than one PR-sized slice, stop and `/roadmap` **split**
(`Added: … · re-rank split`) — do not grow this stub into a mega-spec.

## Problem

Playlists only work if people can **find a song** and **open it** in the player
they already use (Apple Music, Spotify, and similar). Lookup and export must use
a **free** catalog/API — no paid music-data provider and no in-app licensed
playback.

## Non-goals (sketch)

- Merge / pin / shuffle UX (`ride-playlist-merge`)
- Playing audio inside this app
- Paid metadata or lyrics APIs
- Requiring every family to have the same streaming service

## Notes

- Depends on `ride-playlist-merge` (or ship a minimal catalog spike first if
  `/spec` shows lookup is the risky cut).
- Constraint: **free** lookup + deep link / export. Candidate research at
  spec time (not locked): iTunes Search, MusicBrainz, vendor deep-link
  schemes. Spotify/Apple developer keys are not “free” just because search
  exists — pick a path that stays free for this product.
- Must not invent a new npm/Gradle music SDK without asking.
