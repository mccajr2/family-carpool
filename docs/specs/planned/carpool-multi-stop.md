# Spec stub: carpool-multi-stop

Status: parking  
Parent: [docs/roadmap.md](../../roadmap.md)  
Created: 2026-08-15  
Added: 2026-08-15 · enhancement

Thin stub from `/roadmap`. **Not implementable yet.** Separate future
intake — do not pull into Agenda/Feeds work.

If fleshing out reveals more than one PR-sized slice, stop and `/roadmap` **split**
(`Added: … · re-rank split`) — do not grow this stub into a mega-spec.

## Problem

Carpool needs a multi-stop destination (ordered pickup list, "Open in
Maps") and Agenda's deferred "N stops" / "3 STOPS" tag needs a real
per-event stop/pickup-order field. The Calendar mock’s right-rail
**Sharks Practice — Carpool** card (numbered stops + Open in Maps) is
this slice — not [`agenda-week-glance`](agenda-week-glance.md).

## Non-goals (sketch)

- Restyling `CarpoolFeedActions` inside Feeds
- Agenda/Feeds page redesigns
- Native push notifications

## Notes

- `docs/carpool-design-intent.md` is **not** in the repo yet; treat Carpool
  as untouched until a dedicated `/roadmap` intake lands that file (or
  equivalent).
- Related later: [`driver-leave-by-pickups`](driver-leave-by-pickups.md)
  (estimate math once pickup order exists),
  [`maps-deep-links`](../../roadmap.md) (parking),
  [`carpool-page-redesign`](carpool-page-redesign.md) (visual pass; not this
  data-model slice).
