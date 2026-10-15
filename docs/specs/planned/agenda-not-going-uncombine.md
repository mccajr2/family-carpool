# Spec stub: agenda-not-going-uncombine

Status: planned  
Parent: [docs/roadmap.md](../../roadmap.md)  
Created: 2026-10-15  
Added: 2026-10-15 · enhancement

Thin stub from `/spec agenda-card-one-language` follow-up. **Not implementable
yet.** Run `/spec agenda-not-going-uncombine` after the collapsed (and ideally
expanded) card-language slices ship.

If fleshing out reveals more than one PR-sized slice, stop and `/roadmap`
**split** — do not grow this stub into a mega-spec.

## Problem

When a kid is marked **not going** for their event, that event can still sit
inside a same-day drive-block combination with sibling events in a similar
time window. The combined card then implies a shared trip the skipped kid is
not on. Marking not going should pull that event out of the combination so
remaining going kids regroup (or stand alone) without the skipped kid’s event.

## Non-goals (sketch)

- Collapsed/expanded card chrome restyle (`agenda-card-one-language`,
  `agenda-card-expanded-bodies`)
- Changing ADR-0003 going / not going vocabulary or RSVP mapping
- Phone layout (`calendar-phone-frame`)
- Inventing a third attendance state

## Notes

- **Beta gate.** Ranked after `agenda-card-expanded-bodies` so combination
  rules consume one card language.
- Touches drive-block grouping (`driveBlockLinks` / domain merge rules) —
  confirm at `/spec` whether client-only regroup or server recompute.
- Captured from PDF slice-1 out-of-scope note (“skipped kid un-combines the
  block”) and product clarification 2026-10-15.
