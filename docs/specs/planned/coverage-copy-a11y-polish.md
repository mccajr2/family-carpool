# Spec stub: coverage-copy-a11y-polish

Status: planned  
Parent: [docs/roadmap.md](../../roadmap.md)  
Created: 2026-08-28  
Added: 2026-08-28 · initial

Thin stub from hero & coverage flow redesign import. **Not implementable yet.**
Run `/spec coverage-copy-a11y-polish` before any code.

**Depends on:** ranks 2–9 in the hero & coverage flow batch (all prior slices in this import)

## Problem

Once functional pieces exist, microcopy consistency, visual separation of
unrelated controls, and accessibility need a dedicated pass — otherwise they drift.

## Non-goals (sketch)

- New behavior (file bugs against earlier ranks unless one-line copy/style fix)
- Full destination visual restyle ([`ui-system-destination-adoption`](ui-system-destination-adoption.md) stays parked)

## Notes

- Shared copy constants file; verify **"drive"** vs **"going"** vocabulary split everywhere.
- Verify `DriverPicker` household vs team paths visually separated; same principle elsewhere.
- a11y: focus rings, keyboard reachability, `aria-live="polite"` on hero state changes, carousel `aria-label`s, chips not color-only.
- Responsive reflow for carousel and chip rows at narrow widths.
