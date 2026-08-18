# Spec stub: agenda-focus-carpool-actions

Status: planned  
Parent: [docs/roadmap.md](../../roadmap.md)  
Created: 2026-08-17  
Added: 2026-08-17 · enhancement

Thin stub from `/roadmap`. **Not implementable yet.** Run `/spec agenda-focus-carpool-actions`
after [`carpool-request-accept`](carpool-request-accept.md) ships (web Focus card).

## Problem

Once teammate ride request/accept exists, the Focus card’s next-action ranking
should sometimes be “accept or decline this ride,” not only RSVP / coverage /
leave-for-the-next-event.

## Non-goals (sketch)

- Inventing request/accept itself ([`carpool-request-accept`](carpool-request-accept.md))
- Changing Focus chrome ([`agenda-focus-card-polish`](../archive/agenda-focus-card-polish.md))
  — reuse the single CTA slot on the slim card; do not add a second form band.
- Multi-stop / Open in Maps ([`carpool-multi-stop`](carpool-multi-stop.md))

## Notes

- Extends [`agenda-focus-next-action`](../archive/agenda-focus-next-action.md); do not
  revive this as a substitute for that horizon/ranking slice.
- Keep exactly one Focus card.
- Web first (Focus card is web-only until [`agenda-focus-card-mobile`](agenda-focus-card-mobile.md)).
