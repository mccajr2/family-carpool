# Spec stub: playlist-open-in-streaming

Status: parking  
Parent: [docs/roadmap.md](../../roadmap.md)  
Created: 2026-08-14  
Added: 2026-08-14 · enhancement

Thin stub from `/roadmap`. **Not implementable yet.** Spotify open/export for
the confirmed-ride flow moved to [`ride-playlist-tab`](ride-playlist-tab.md).
This id remains for **Apple Music / multi-service** catalog lookup only.

If fleshing out reveals more than one PR-sized slice, stop and `/roadmap` **split**
(`Added: … · re-rank split`) — do not grow this stub into a mega-spec.

## Problem

Families on Apple Music (or mixed services) still need free song lookup and
open/export outside the Spotify-only ride playlist tab.

## Non-goals (sketch)

- Spotify OAuth / merge / Open in Spotify (`ride-playlist-tab`)
- In-app audio playback or paid music APIs
- Replacing carpool request/accept

## Notes

- Promote only after `ride-playlist-tab` dogfood if multi-service demand appears.
- Constraint remains: free catalog/API only.
