# Spec stub: agenda-focus-card-mobile

Status: planned  
Parent: [docs/roadmap.md](../../roadmap.md)  
Created: 2026-08-14  
Added: 2026-08-14 · enhancement

Thin stub from `/roadmap`. **Not implementable yet.** Run `/spec agenda-focus-card-mobile`
to flesh out Approach, Acceptance Criteria, and Tasks before any code.

If fleshing out reveals more than one PR-sized slice, stop and `/roadmap` **split**
(`Added: … · re-rank split`) — do not grow this stub into a mega-spec.

## Problem

Web Agenda promotes exactly one highest-priority item into a Focus card;
iOS and Android still use spacing-only treatment for every row, so the
visual hierarchy will drift across clients after the web slice ships.

## Non-goals (sketch)

- Changing Focus card selection logic or copy (must match web)
- Web Focus chrome (`agenda-focus-card` + [`agenda-focus-card-polish`](agenda-focus-card-polish.md))
- Font family change (`typography-font-family`)

## Notes

- Depends on shipped [`agenda-focus-card`](../archive/agenda-focus-card.md),
  web [`agenda-focus-next-action`](../active/agenda-focus-next-action.md), and
  [`agenda-focus-card-polish`](agenda-focus-card-polish.md) — port the
  polished hero **and** the next-action ranking, not the pre-horizon
  `selectFocusItem`.
- [`docs/agenda-focus-card-addendum.md`](../../agenda-focus-card-addendum.md).
- Card chrome may use native components; selection logic and copy must not.
- Day-grouping + expandable rows are a separate web slice
  ([`agenda-full-page-redesign`](../archive/agenda-full-page-redesign.md)) with mobile
  follow-up [`agenda-full-page-redesign-mobile`](agenda-full-page-redesign-mobile.md).
  Combine this id with that mobile port at `/spec` time if one PR is cheaper.
