# Spec stub: carpool-request-accept-mobile

Status: cancelled — superseded by Expo (2026-08-25); do not /spec
Parent: [docs/roadmap.md](../../roadmap.md)  
Created: 2026-08-18  
Added: 2026-08-18 · enhancement

Thin stub from `/roadmap`. **Not implementable yet.** Promote with `/roadmap`
after web [`carpool-request-accept`](../archive/carpool-request-accept.md) is dogfoodable,
then `/spec`.

## Problem

Ride request/accept will ship on web first. iOS and Android still need the
same request / accept / seat-update loop so carpool is not a web-only feature
after the vertical is proven.

## Non-goals (sketch)

- Inventing request/accept itself ([`carpool-request-accept`](../archive/carpool-request-accept.md))
- Visual restyle of the Carpool destination (`carpool-page-redesign`)
- Richer ride shapes (to XOR from, meet-at, early/late, multi-stop)

## Notes

- Selection logic, copy, and OpenAPI must match web; native chrome OK.
- Team-link and rotation mobile ports are separate follow-ups if those slices
  also ship web-only — do not fold them into this id.
