# Spec stub: web-shell-page-frame

Status: planned  
Parent: [docs/roadmap.md](../../roadmap.md)  
Created: 2026-08-17  
Added: 2026-08-17 · enhancement

Thin stub from `/roadmap`. **Not implementable yet.** Run `/spec web-shell-page-frame`
to flesh out Approach, Acceptance Criteria, and Tasks before any code.

If fleshing out reveals more than one PR-sized slice, stop and `/roadmap` **split**
(`Added: … · re-rank split`) — do not grow this stub into a mega-spec.

## Problem

The always-dark rail shipped (`web-shell-nav-rail`) still sits inside the
signed-in `max-w-5xl` centered column (`App.tsx`), so it is not flush left
and is narrower than the Calendar mock (`240px`). The destination column is
a bordered `Card` with leftover gap. The mock’s Calendar right rail has no
home yet — week-glance content is a later slice.

## Non-goals (sketch)

- Filling the right rail (`agenda-week-glance`, parked `carpool-multi-stop`)
- Destination restyles (Focus card, chips, Feeds, Family/Places/Garage)
- iOS / Android (bottom tabs stay)
- Signed-out auth / create-join empty states (keep today’s centered column)
- A three-column dashboard on every destination or required at narrow width
  (product non-goal: desktop-first UX)

## Notes

- Intake: Calendar mock HTML (2026-08-17): `grid-template-columns: 240px 1fr
  320px`; sidebar padding `28px 20px`; main `36px 44px` / `max-width: 820px`;
  right rail `320px` with left border. Use for measurements, not copy.
- Signed-in only: break out of `max-w-5xl mx-auto px-4 py-10`; rail ~`240px`
  flush left; fluid center; drop destination `Card` border/shadow.
- Right column: **Calendar `md+` placeholder only** (empty chrome). Other
  destinations stay rail + main. Narrow: stack or collapse — do not `position:
  fixed` a third pane over Agenda.
- [`agenda-week-glance`](agenda-week-glance.md) fills the placeholder; do not
  invent week-strip or stop-list data here.
