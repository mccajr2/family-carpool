# Spec stub: carpool-page-redesign

Status: parking  
Parent: [docs/roadmap.md](../../roadmap.md)  
Created: 2026-08-16  
Added: 2026-08-16 · enhancement

Thin stub from `/roadmap`. **Not implementable yet.** Needs a mockup pass
and/or `docs/carpool-design-intent.md` before `/spec`.

If fleshing out reveals more than one PR-sized slice, stop and `/roadmap` **split**
(`Added: … · re-rank split`) — do not grow this stub into a mega-spec.

## Problem

The Carpool destination is a product surface (team spaces, Enable, join)
but has no visual restyle id. Agenda/Feeds have redesign slices; Family /
Places / Garage are parked pending mockups. Carpool should get the same
treatment rather than inheriting utilitarian chrome forever.

## Non-goals (sketch)

- Ride request/accept behavior (`carpool-request-accept`)
- Multi-stop pickup UI (`carpool-multi-stop`)
- Agenda / Feeds restyles
- Inventing a visual direction outside the existing token system

## Notes

- Sibling of [`family-places-garage-redesign`](family-places-garage-redesign.md).
- Stay inside existing tokens, WCAG AA, one visual priority per screen.
- Token adoption leftover is [`ui-system-destination-adoption`](ui-system-destination-adoption.md)
  — this id is the Carpool visual pass, not a second token schema change.
