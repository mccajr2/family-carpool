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
Maps") and Agenda's deferred "N stops" tag needs a real per-event
stop/pickup-order field. Neither is in this redesign pass.

## Non-goals (sketch)

- Restyling `CarpoolFeedActions` inside Feeds
- Agenda/Feeds page redesigns
- Native push notifications

## Notes

- `docs/carpool-design-intent.md` is **not** in the repo yet; treat Carpool
  as untouched until a dedicated `/roadmap` intake lands that file (or
  equivalent).
- Related later: [`driver-leave-by-pickups`](driver-leave-by-pickups.md),
  [`maps-deep-links`](../../roadmap.md) (parking).
