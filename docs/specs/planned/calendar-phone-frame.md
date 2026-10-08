# Spec stub: calendar-phone-frame

Status: planned  
Parent: [docs/roadmap.md](../../roadmap.md)  
Created: 2026-10-08  
Added: 2026-10-08 · enhancement

Thin stub from `/roadmap`. **Not implementable yet.** Run
`/spec calendar-phone-frame` to flesh out Approach, Acceptance Criteria,
and Tasks before any code.

If fleshing out reveals more than one PR-sized slice, stop and `/roadmap`
**split** (`Added: … · re-rank split`) — do not grow this stub into a
mega-spec.

## Problem

The signed-in frame is a fixed desktop grid: a 15rem rail, the page, and
on Calendar a 20rem aside. There is no phone breakpoint. Parents will open
this on a phone the first evening they try it, and that width is where the
card hierarchy has to stay obvious.

## Non-goals (sketch)

- Redesigning Carpool, Family, Places, or Feeds
  (`carpool-page-redesign`, `family-places-garage-redesign`)
- Changing card rules (`calendar-card-hierarchy`)
- Expo bottom tabs (`rn-expo-scaffold`)
- Month/week grid (`family-calendar-grid`)

## Notes

- **Beta gate, rank 3.** After `calendar-card-hierarchy`, so the phone
  layout is judged with the simple plan already prominent.
- Narrow widths: one column. Navigation still reaches Calendar, Carpool,
  Family, Places, and Feeds. The week-glance aside may hide or stack; it
  does not have to be restyled.
- Amends the desktop-only page frame from `web-shell-page-frame` for narrow
  viewports. Wide layout stays the rail.
- Web only.
