# Spec stub: ui-system-destination-adoption

Status: planned  
Parent: [docs/roadmap.md](../../roadmap.md)  
Created: 2026-08-10  
Added: 2026-08-10 · note carried from cross-platform-ui-system approval

Thin stub from `/roadmap`. **Not implementable as one mega-PR.** When a
destination is ready to adopt shared tokens, run `/spec` for a
**per-destination** slice (or `/roadmap` **split** into Calendar / Family /
Carpool / …). Do not grow this stub into a single restyle-everything spec.

## Problem

`cross-platform-ui-system` establishes tokens + component parity and proves
them on the **More** reference screen only. Later destinations (Calendar,
Family, Carpool, Places/Feeds under More detail, etc.) still need to adopt the
same system without assuming More’s verification covers them.

## Non-goals (sketch)

- Replacing or expanding the token JSON schema itself (that stays with
  `cross-platform-ui-system` / follow-up token work)
- Re-running More’s screenshot/contrast check as a substitute for the new
  destination’s own review

## Carry-forward verification (mandatory)

**Note:** verification does **not** carry forward from
`cross-platform-ui-system`. That spec’s WCAG AA contrast check and light/dark
screenshot review were scoped **only** to the More reference screen. When any
subsequent destination (Calendar, Family, Carpool, etc.) adopts the shared
tokens/component system, **that** spec must independently re-run both checks
for its own screens — a pass on More does **not** certify contrast or visual
consistency anywhere else.

Added: 2026-08-10 · note carried from cross-platform-ui-system approval

### Required acceptance criteria (include in every destination-adoption `/spec`)

1. Light + dark screenshots for the newly restyled destination (web, Android,
   iOS) attached to the PR.
2. WCAG AA contrast verified for **that destination’s** actual text-on-surface
   pairings — **4.5:1** body text, **3:1** large text/icons — in both light and
   dark.

## Notes

- Depends on shipped [`cross-platform-ui-system`](../archive/cross-platform-ui-system.md).
- Prefer one destination (or one cohesive surface) per PR at `/spec` time.
- **Agenda and Feeds visual passes are the adoption for those surfaces**
  (`agenda-focus-card`, `agenda-full-page-redesign`, `feeds-page-redesign`
  + mobile ports). Do not restyle Agenda again under this id.
- Remainder: Carpool (`carpool-page-redesign`), Family/Places/Garage
  (`family-places-garage-redesign`), and `family-calendar-grid` — each
  re-runs screenshots + WCAG AA for **that** surface.
- Brand hex already shipped with `agenda-focus-card`; parked
  [`ui-palette-refresh`](ui-palette-refresh.md) is not a second palette PR.
