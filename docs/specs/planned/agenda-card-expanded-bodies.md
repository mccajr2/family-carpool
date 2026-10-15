# Spec stub: agenda-card-expanded-bodies

Status: planned  
Parent: [docs/roadmap.md](../../roadmap.md)  
Created: 2026-10-14  
Added: 2026-10-14 · re-rank split

Thin stub from `/roadmap` **re-rank split** of `agenda-card-one-language`.
**Not implementable yet.** Run `/spec agenda-card-expanded-bodies` after the
collapsed-language slice ships (or is active and this is Next up).

If fleshing out reveals more than one PR-sized slice, stop and `/roadmap`
**split** again — do not grow this stub into a mega-spec.

## Problem

Collapsed Agenda cards share one language
([`agenda-card-one-language`](../archive/agenda-card-one-language.md)). Expanded is still
several different frames: read Getting there / Coming back, simple
DriverPicker on single rows only, legSplit / kidSplit editors, locked settled
vs Edit-this-week, and commitment / Split / Remove words that do not match
across single and combined shells. Phone layout must consume one expanded
language, not that mix.

## Non-goals (sketch)

- Collapsed header/body/chip restyle (owned by `agenda-card-one-language`)
- New ride states, coverage rules, or OpenAPI fields
- Hero, Focus, Carpool, Family, Places, Feeds, Route
- Phone-width Calendar (`calendar-phone-frame`)
- Undo holes (`action-undo-parity`) — places quiet reverses; does not invent
  missing reverses beyond what that row owns
- Full visual polish of legSplit / kidSplit beyond matching resting expanded
  language (park further editor chrome if `/spec` is still too large)
- Inbound Accept/Pass row as a separate product surface (include only if the
  mock for this slice shows it)

## Notes

- **Beta gate, rank 1 (Next up).** After Done `agenda-card-one-language`; before
  `agenda-not-going-uncombine`, `agenda-standing-leg-marker`,
  `action-undo-parity`, and `calendar-phone-frame`.
- Desktop web Agenda only. `AgendaBlockCard` has no DriverPicker today —
  decide at `/spec` whether combined expanded stays read + links or gains a
  resting simple picker.
- Mock expanded composites after collapsed language is locked (or mock both
  in one Claude pass with clear slice labels). Missing from mock → out of
  scope.
- Depends on collapsed language shipping so expanded does not restyle the
  old RiderChips resting body.
