# Spec stub: calendar-card-hierarchy

Status: planned  
Parent: [docs/roadmap.md](../../roadmap.md)  
Created: 2026-10-08  
Added: 2026-10-08 · enhancement

Thin stub from `/roadmap`. **Not implementable yet.** Run
`/spec calendar-card-hierarchy` to flesh out Approach, Acceptance Criteria,
and Tasks before any code.

If fleshing out reveals more than one PR-sized slice, stop and `/roadmap`
**split** (`Added: … · re-rank split`) — do not grow this stub into a
mega-spec.

## Problem

Calendar already has the plans parents need, and the cards do not agree.
A single event collapses behind a chevron. A drive block stays open and
uses a separate “Show details” link. The Hero was a slim decision and now
holds the full driver editor. Confirm, Accept, and Ask are 13.5px — the
same size as a filter chip and the secondary actions. The simple case (one
round-trip for every going kid) is not what the card leads with.

## Non-goals (sketch)

- New ride states, week-exception, mail, or session work
- Removing per-kid or per-leg plans
- Phone breakpoints (`calendar-phone-frame`)
- Restyling Carpool, Family, Places, Feeds, or the Route screen
- New OpenAPI fields

## Notes

- **Beta gate, rank 1.** Web Calendar only.
- Locked: [Simple plan first](../../roadmap.md) in `docs/roadmap.md`.
- Resting editor is the shared round-trip. “Different plans for each leg”
  and “Different plans for each kid” both stay one step inside, same weight
  as each other, quieter than the primary action. Opening the card does not
  land in a split view. When plans already diverge, the collapsed summary
  still shows that (existing chips).
- `AgendaRow` and `AgendaBlockCard` share one chevron. The block-only
  “Show details” underline goes away as a second pattern.
- Hero stays one decision. When that decision is picking a driver, the
  simple round-trip is what you see.
- Primary action is visually larger than chips, meta, and undo links.
  Existing reverses stay reachable as the quieter control; missing reverses
  are `action-undo-parity`, not this slice.
- Depends on shipped DriverPicker, drive-block cards, and Focus. No domain
  change.
