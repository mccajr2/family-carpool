# Spec stub: day-block-agenda

Status: planned  
Parent: [docs/roadmap.md](../../roadmap.md)  
Created: 2026-09-14  
Added: 2026-09-14 · enhancement

Thin stub from `/roadmap`. **Not implementable yet.** Run `/spec day-block-agenda`
to flesh out Approach, Acceptance Criteria, and Tasks before any code.

If fleshing out reveals more than one PR-sized slice, stop and `/roadmap` **split**
(`Added: … · re-rank split`) — do not grow this stub into a mega-spec.

## Problem

Once the block domain exists, Agenda and Focus still render one card per
event. Parents need **one card per driving block** when 2+ events share a
driver + contiguous window, with per-event/per-leg breakdown inside and
quiet "not your job tonight" rows for legs another adult owns.

## Non-goals (sketch)

- Block domain/API (`day-block-domain`)
- Route tab full stop sequence (`day-block-route`)
- Stop-order optimize
- Changing RideRequest / coverage primitives
- Cross-family block merging

## Notes

- **Must list [ADR-0004](../../decisions/ADR-0004-carpool-card-perspective-rules.md)
  in Context and apply all nine rules directly** — do not re-derive from this
  stub or the mockup prose.
- Mockup SoT (wording/grouping/layout only):
  [`docs/ui-system/day-block-grouping.mockup.html`](../../ui-system/day-block-grouping.mockup.html)
  + [`docs/ui-system/carpool-card-perspective-rules.mockup.html`](../../ui-system/carpool-card-perspective-rules.mockup.html)
- **Color:** keep existing Hero dark / Agenda light treatments for cards that
  map to those surfaces. Ungrounded "today" grouped agenda cards default to
  whichever existing card type they're closest to — do not invent a new style
  from the mockup's dark/light choice.
- **Density:** mockups are intentionally wordy to prove ambiguity resolution.
  Compress via progressive disclosure (collapse/mute route line, drive-time
  delta, "driving separately" notes) — but **never** collapse ADR-critical
  copy (round-trip banner, named/qualified address, paired cancel links).
- Builds on [`day-block-domain`](../active/day-block-domain.md). Web first.
- **Carry-forward from `day-block-domain`:** remove the interim per-event
  merge/split control once block cards ship — do not leave two competing
  affordances for the same action.
