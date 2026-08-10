# Spec stub: app-shell-navigation

Status: planned  
Parent: [docs/roadmap.md](../../roadmap.md)  
Created: 2026-08-10  
Added: 2026-08-10 · enhancement

Thin stub from `/roadmap`. **Not implementable yet.** Run `/spec app-shell-navigation`
to flesh out Approach, Acceptance Criteria, and Tasks before any code.

If fleshing out reveals more than one PR-sized slice, stop and `/roadmap` **split**
(`Added: … · re-rank split`) — do not grow this stub into a mega-spec.

## Problem

Signed-in adults land on one long scrolling **family surface** (members, kids,
places, events/agenda, feeds, leave/sign-out). Finding a use case means scrolling
and hunting. As calendar and carpool grow, that single screen will not scale.

## Non-goals (sketch)

- Redesigning calendar agenda/grid data models (`family-calendar-surface` /
  `family-calendar-grid`)
- Carpool product flows (own slices) — shell only reserves a tab/slot
- Deep linking / universal links (unless required for tab restore)
- Backend / OpenAPI changes (client IA only unless a gap appears)

## Notes

- Client-only vertical: web + Android + iOS tab/nav shell; move existing sections
  onto focused screens (e.g. Calendar, Family/Circle, Places, Feeds/Settings).
- Depends on having something to park on Calendar (`family-calendar-surface`).
- Do not fatten the active calendar PR with full shell unless the user chooses
  **amend** on that active spec.
