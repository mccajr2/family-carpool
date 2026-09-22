# Spec stub: manual-event-adults-only

Status: planned  
Parent: [docs/roadmap.md](../../roadmap.md)  
Created: 2026-09-18  
Added: 2026-09-18 · enhancement

Thin stub from `/spec manual-event-team-link`. **Not implementable yet.**
Run `/spec manual-event-adults-only` to flesh out Approach, Acceptance
Criteria, and Tasks before any code.

If fleshing out reveals more than one PR-sized slice, stop and `/roadmap`
**split** (`Added: … · re-rank split`) — do not grow this stub into a
mega-spec.

## Problem

Team socials (e.g. parents happy hour) have **no kid rows**. RSVP is per
family/adult, not per kid. Today every manual event requires **1+ `kidIds`**.

## Non-goals (sketch)

- Party-size extra seats (`manual-event-party-size`)
- Relative timing (`manual-event-relative-timing`)
- Changing FEED events (kids still come from the feed roster)

## Notes

- Relax `kidIds` minItems for this attendee mode; a linked manual may have
  `feedId` set with **zero** kids.
- Ride `defaultKidIds` is empty — Ask-the-team for kids does not apply
  (adult/family RSVP is the product; do not fake kid rides).
- Depends on `manual-event-team-link` if these socials attach to a team
  feed; standalone adults-only is in play too.
- **Web first.**
