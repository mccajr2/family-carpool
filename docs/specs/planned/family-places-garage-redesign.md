# Spec stub: family-places-garage-redesign

Status: parking  
Parent: [docs/roadmap.md](../../roadmap.md)  
Created: 2026-08-15  
Added: 2026-08-15 · re-rank split

Thin stub from `/roadmap`. **Not implementable yet.** Needs a mockup pass
before `/spec`. Do not flesh out from the Agenda/Feeds intake.

If fleshing out reveals more than one PR-sized slice, stop and `/roadmap`
**split** (`Added: … · re-rank split`) — do not grow this stub into a mega-spec.

## Problem

Family and Places still read as utilitarian relative to the redesigned
Agenda/Feeds. No design work exists yet — not spec-able until a mockup
pass. **Garage is out of this id** after `garage-retire` (no Garage
destination until `garage-capacity` returns).

## Non-goals (sketch)

- Agenda / Feeds restyles (separate ids)
- Carpool destination (separate future intake)
- Garage chrome or vehicle UI (retired; revive only with `garage-capacity`)
- Inventing a visual direction outside the existing token system

## Notes

- Split remainder of [`destination-design-pass`](destination-design-pass.md).
- Stay inside existing tokens, WCAG AA (4.5:1 text / 3.0:1 icons), one
  visual priority per screen, quieter destructive actions.
- Rename to `family-places-redesign` at `/spec` time if Garage is still gone.
