# Spec stub: coverage-leave-from

Status: planned  
Parent: [docs/roadmap.md](../../roadmap.md)  
Created: 2026-08-12  
Added: 2026-08-12 · enhancement

Thin stub from `/roadmap`. **Not implementable yet.** Run `/spec coverage-leave-from`
to flesh out Approach, Acceptance Criteria, and Tasks before any code.

If fleshing out reveals more than one PR-sized slice, stop and `/roadmap` **split**
(`Added: … · re-rank split`) — do not grow this stub into a mega-spec.

## Problem

Today leave-from (and thus leave-by) is **one origin per calendar item**. When two
adults take **separate cars** and **separate kids** to the same event, they often
leave from different places (Mom’s house vs Dad’s). Adults need leave-from / leave-by
that match **who is covering whom**, not a single shared origin on the event.

## Non-goals (sketch)

- Multi-stop teammate pickups / carpool routing (`driver-leave-by-pickups`)
- Changing coverage assign/confirm/decline rules (`coverage-confirm-decline`)
- Conflict amber UI (`conflict-detection`)
- Trip seat plans or vehicle assignment

## Notes

- Builds on shipped leave-by + coverage. Origin order today: item override →
  per-adult default → first located place — `/spec` should add a **coverage-level**
  leave-from (likely on the responsibility row) and keep sensible fallbacks for
  uncovered kids / before assign.
- UI: field-row Leave from may move from the event chrome onto (or beside) each
  active coverage, or stay item-level as fallback — decide at `/spec`. Put that
  chrome on **expanded `AgendaRow`**, not the slim Focus card
  ([`docs/agenda-focus-card-addendum.md`](../../agenda-focus-card-addendum.md)).
- Prefer one vertical PR: API + leave-by computation + Agenda (web/Android/iOS).
