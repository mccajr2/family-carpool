# Spec stub: agenda-carpool-action-parity

Status: planned  
Parent: [docs/roadmap.md](../../roadmap.md)  
Created: 2026-08-26  
Added: 2026-08-26 · enhancement

Thin stub from `/roadmap`. **Not implementable yet.** Run `/spec agenda-carpool-action-parity`
to flesh out Approach, Acceptance Criteria, and Tasks before any code.

If fleshing out reveals more than one PR-sized slice, stop and `/roadmap` **split**
(`Added: … · re-rank split`) — do not grow this stub into a mega-spec.

## Problem

Calendar Focus and Agenda rows expose a different ride action set than the
Carpool tab. **Withdraw** exists only on the tab; **Cancel** is missing on
Focus. Because Focus items are **not** duplicated in the day list, own
`PENDING` on calm Focus makes Cancel unreachable on Calendar (contradicts the
archived AC that said Cancel stays on the row). Pass is Focus-only; expanded
rows have Request/Cancel but no Accept/Pass/Withdraw. Families undo where they
acted — Calendar must be self-sufficient for the ride lifecycle.

## Non-goals (sketch)

- Un-pass / Accept after Pass —
  [`carpool-pass-reconsider`](carpool-pass-reconsider.md)
- Who/where/kids/seats copy density —
  [`agenda-carpool-state-clarity`](agenda-carpool-state-clarity.md)
- Rider initials / photos
- New ride endpoints (reuse cancel / withdraw / pass / accept)
- Multi-hero, Context ask inbox, Expo Agenda UI
- Restoring full RSVP / leave-from bands on Focus

## Notes

- Web first. Keep Focus slim: reverse actions as **secondary/outline**.
- Wire Cancel on Focus when own ride status is shown; Withdraw on Focus (and
  row if accepted-by-us is shown) when this circle accepted; expose **Pass**
  CTA on Carpool tab consistently (display-only “Passed” today).
- Do **not** duplicate un-pass behavior here.
