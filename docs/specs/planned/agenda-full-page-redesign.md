# Spec stub: agenda-full-page-redesign

Status: planned  
Parent: [docs/roadmap.md](../../roadmap.md)  
Created: 2026-08-15  
Added: 2026-08-15 · enhancement

Thin stub from `/roadmap`. **Not implementable yet.** Run `/spec agenda-full-page-redesign`
to flesh out Approach, Acceptance Criteria, and Tasks before any code.

If fleshing out reveals more than one PR-sized slice, stop and `/roadmap` **split**
(`Added: … · re-rank split`) — do not grow this stub into a mega-spec.

## Problem

Agenda below the Focus card is still Selection A (spacing-only stack). The
page should be day-grouped (Today / Tomorrow / This week / Later) with
collapsed card rows that expand to the same field bands as the Focus card —
visual distinctiveness for the whole list, not one promoted item.

## Non-goals (sketch)

- Rewriting the shipped Focus card, `tokens.json`, selection logic, or
  coverage helpers
- Carpool multi-stop screen and any "N stops" tag (no data-model field)
- Family / Places / Garage / Feeds; iOS / Android
- Notification system

## Notes

- Intake already has a full spec + verbatim `agendaDayGroups.ts`,
  `AgendaRow.tsx`, and `docs/agenda-full-redesign-addendum.md` — copy at
  `/spec` time; do not invent a parallel design.
- Prerequisite: [`agenda-focus-hero-surface`](../archive/agenda-focus-hero-surface.md)
  shipped the intake `hero*` Focus card. Do not rewrite those three files here.
- Mobile port: [`agenda-full-page-redesign-mobile`](agenda-full-page-redesign-mobile.md)
  (Focus card port stays [`agenda-focus-card-mobile`](agenda-focus-card-mobile.md)).
