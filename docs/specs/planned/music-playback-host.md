# Spec stub: music-playback-host

Status: parking  
Parent: [docs/roadmap.md](../../roadmap.md)  
Created: 2026-09-08  
Added: 2026-09-08 · re-rank split

Thin stub from `/roadmap`. **Not implementable yet.** Promote after Apple Music
playback dogfoods on at least one client. Run `/spec music-playback-host`
before code.

If fleshing out reveals more than one PR-sized slice, stop and `/roadmap` **split**
(`Added: … · re-rank split`) — do not grow this stub into a mega-spec.

## Problem

Not every rider will share the same music subscription. Participation
(contribute playlist/preferences → fair mix) must stay separate from playback
(one device with a supported account hosts the mix). The product needs UX for
choosing/designating the host without requiring every participant to subscribe
to Apple Music.

## Non-goals (sketch)

- Multiple simultaneous playback hosts
- Solving licensing outside a licensed provider
- Recurring/persisted ride mixes (unless `/spec` explicitly pulls them in)
- Spotify as a required provider

## Notes

- Model: many participants → contribute → app generates one mix → one supported
  playback host.
- `/spec` resolves: no supported provider; host leaves mid-ride; can one
  subscriber play tracks contributed via others’ preferences; what to persist
  provider-neutrally.
