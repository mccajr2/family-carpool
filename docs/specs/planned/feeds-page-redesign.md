# Spec stub: feeds-page-redesign

Status: planned  
Parent: [docs/roadmap.md](../../roadmap.md)  
Created: 2026-08-15  
Added: 2026-08-15 · re-rank split

Thin stub from `/roadmap`. **Not implementable yet.** Run `/spec feeds-page-redesign`
to flesh out Approach, Acceptance Criteria, and Tasks before any code.

If fleshing out reveals more than one PR-sized slice, stop and `/roadmap` **split**
(`Added: … · re-rank split`) — do not grow this stub into a mega-spec.

## Problem

Feeds is still a utilitarian settings list. Restyle it onto the same
card/token language as Agenda (raised cards, quieter Remove) with **zero**
behavior change — same handlers, validation, and `CarpoolFeedActions`.

## Non-goals (sketch)

- Redesigning `CarpoolFeedActions` itself
- Carpool destination / multi-stop screen
- iOS / Android
- Notification system

## Notes

- Split from [`destination-design-pass`](destination-design-pass.md).
- Intake already has a full spec + verbatim `FeedCard.tsx` /
  `AddFeedCard.tsx` — copy at `/spec` time; do not invent a parallel design.
- Reuse `eventKidNames` from `coverageDisplay.ts`; do not duplicate helpers.
- Mobile port: [`feeds-page-redesign-mobile`](feeds-page-redesign-mobile.md).
