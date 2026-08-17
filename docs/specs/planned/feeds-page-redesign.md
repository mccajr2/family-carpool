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

Feeds is still a utilitarian settings list. Restyle it to the Claude Feeds
dark mock: raised cards, **OWNED** / **NO CARPOOL** chips, kid · synced ·
event-count metadata, Sync now / Edit quieter, Open carpool or Enable
carpool as the primary action, Remove as text, ADD A FEED form below.
**Zero behavior change** — same handlers, validation, and
`CarpoolFeedActions` outcomes.

## Non-goals (sketch)

- Changing Enable / Open / join / request carpool rules
- Carpool destination / multi-stop screen
- iOS / Android ([`feeds-page-redesign-mobile`](feeds-page-redesign-mobile.md))
- Web shell rail (`web-shell-nav-rail`)

## Notes

- Intake: Feeds dark screenshot (2026-08-17). Older verbatim `FeedCard.tsx`
  intake is superseded by this shot at `/spec` time.
- Split from [`destination-design-pass`](destination-design-pass.md).
- Reuse `eventKidNames` from `coverageDisplay.ts`.
- Mobile port: [`feeds-page-redesign-mobile`](feeds-page-redesign-mobile.md).
