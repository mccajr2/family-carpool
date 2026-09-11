# Spec stub: carpool-ride-coverage-card

Status: planned  
Parent: [docs/roadmap.md](../../roadmap.md)  
Created: 2026-09-10  
Added: 2026-09-10 · re-rank split

Thin stub from `/roadmap` split of Ride Coverage Card goals. **Not
implementable yet.** Run `/spec carpool-ride-coverage-card` after
`carpool-leg-to-from` lands.

If fleshing out reveals more than one PR-sized slice, stop and `/roadmap`
**split** — do not grow this stub into a mega-spec.

## Problem

Per-leg domain exists (or will), but the Calendar coverage card still does not
make **self round-trip confirm from the household default leave-from** the most
prominent action. Driver chips, leave-from combobox, and live Confirm / Post to
team labels need a default collapsed chrome that matches product goals.

## Non-goals (sketch)

- Per-leg split editor — [`carpool-leg-split-plans`](carpool-leg-split-plans.md)
- Ask-the-team radius / meet-at sub-flow — [`carpool-meet-at`](carpool-meet-at.md)
- Domain leg persistence — [`carpool-leg-to-from`](../active/carpool-leg-to-from.md)
  (prerequisite; move to archive link after ship)

## Notes

- Default selection: logged-in parent (self). Household adult chips dynamic
  (1, 2, 3+) + trailing **Ask the team** (plain request only).
- Leave from: single combobox; household default pre-selected; other saved
  places as options — no separate “other location” control.
- Confirm label updates live from Driver + Leave-from; Ask the team →
  “Post to team — round trip”.
- Afford **“Different plans for each leg.”** as a link only; split UI is the
  next id. Per-kid progressive split is later
  ([`carpool-kid-split-plans`](carpool-kid-split-plans.md)) — default card
  still plans **all going siblings** together.
- Web first. Reuse `DriverPicker` / `coverageCopy` / leave-from helpers where
  possible — restyle and wire, do not fork a second assign stack.
