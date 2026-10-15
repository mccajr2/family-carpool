# Spec stub: agenda-standing-leg-marker

Status: planned  
Parent: [docs/roadmap.md](../../roadmap.md)  
Created: 2026-10-15  
Added: 2026-10-15 · enhancement

Thin stub from `/spec agenda-card-one-language` (Frame D ↻ deferred). **Not
implementable yet.** Run `/spec agenda-standing-leg-marker` after collapsed
card language ships.

If fleshing out reveals more than one PR-sized slice, stop and `/roadmap`
**split** — do not grow this stub into a mega-spec.

## Problem

Collapsed Agenda shows standing coverage only at event level
(`standingLocked`). The collapsed-language mock wants a **per-leg** ↻ after
There or Back when that leg is on the recurring plan, and no marker when the
leg is open (Frame D: There You ↻ · Back Needs ride). Without per-leg standing
on the calendar item (or an agreed client match to standing-template
ridePlans), the marker cannot be honest.

## Non-goals (sketch)

- Collapsed header/body/chip restyle (`agenda-card-one-language`)
- Expanded Plan locked chrome (`agenda-card-expanded-bodies`)
- Ending or editing standing series (`carpool-standing-week-exception`,
  Remove recurring)
- Card-level `↻ Every {weekday}` as a substitute for per-leg markers

## Notes

- **Beta gate.** After `agenda-not-going-uncombine`; before undo / phone so
  Frame D’s standing affordance lands with the card language.
- At `/spec`, pick one: client-match `standingBlockTemplateId` ridePlans to
  current legs, or add per-leg standing on the calendar contract (OpenAPI).
- Do not invent a fake ↻ on every assigned leg when only the event is locked.
