# Spec stub: in-app-notifications

Status: parking  
Parent: [docs/roadmap.md](../../roadmap.md)  
Created: 2026-08-16  
Added: 2026-08-16 · enhancement

Thin stub from `/roadmap`. **Not implementable yet.** Run `/spec in-app-notifications`
to flesh out Approach, Acceptance Criteria, and Tasks before any code.

If fleshing out reveals more than one PR-sized slice, stop and `/roadmap` **split**
(`Added: … · re-rank split`) — do not grow this stub into a mega-spec.

## Problem

Families need timely in-app alerts for coverage asks, ride request/accept,
and later rotation driver-gaps — not only whatever is visible if they
happen to have the right screen open.

## Non-goals (sketch)

- Native APNs/FCM (`push-notifications` — follow-up once this inbox exists)
- In-app chat
- Agenda/Feeds redesign
- Choosing rotation gap-fill rules (`carpool-driver-gap-fill`)

## Notes

- Cross-cutting: first consumers are carpool + coverage; rotation gap-fill
  should not ship without this (or an explicit amend that in-app banners
  on the Carpool screen are enough).
- **Carpool push beta does not wait on this inbox** — see `push-notifications`.
- Device push is Upcoming `push-notifications` (Expo); promote this stub later
  if an in-app history/inbox is still needed after push ships.
