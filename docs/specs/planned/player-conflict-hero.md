# Spec stub: player-conflict-hero

Status: planned  
Parent: [docs/roadmap.md](../../roadmap.md)  
Created: 2026-09-16  
Added: 2026-09-16 · enhancement

Thin stub from `/roadmap`. **Not implementable yet.** Run `/spec player-conflict-hero`
to flesh out Approach, Acceptance Criteria, and Tasks before any code.

If fleshing out reveals more than one PR-sized slice, stop and `/roadmap` **split**
(`Added: … · re-rank split`) — do not grow this stub into a mega-spec.

## Problem

When the same kid is on two overlapping events (e.g. two hockey teams), amber
Agenda chrome from [`conflict-detection`](../archive/conflict-detection.md) is
easy to miss. Adults need a **Hero card** that shows both events, **forces a
pick** (keep one → mark the other **not going**), then continues into **ride
assign** for the kept event — before coverage and carpool work piles up on an
impossible double-book.

## Non-goals (sketch)

- Soft travel / leave-by “cutting it close” (`conflict-travel-margin`)
- Multi-kid household “family conflict” reporting (`family-conflict-report`)
- Auto-pick which event to keep; push/email alerts
- Changing overlap math (still event `startsAt`/`endsAt` from `conflict-detection`)
- Adult CONFIRMED double-book **409** (already shipped)

## Notes

- Builds on existing `KID_TIME_OVERLAP` calendar enrichment — prefer promoting
  that signal into the attention queue / Hero, not inventing a second detector.
- Resolution should reuse attendance **not going** ([`attendance-manual-toggle`](../archive/attendance-manual-toggle.md))
  and existing DriverPicker / ride-assign chrome after the keep choice.
- `/spec` should lock: Hero priority vs coverage gaps / inbound asks; whether
  both peers must be in-window; undo after pick; copy naming both teams/events.
