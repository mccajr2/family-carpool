# Spec stub: agenda-focus-next-action

Status: planned  
Parent: [docs/roadmap.md](../../roadmap.md)  
Created: 2026-08-17  
Added: 2026-08-17 · enhancement

Thin stub from `/roadmap`. **Not implementable yet.** Run `/spec agenda-focus-next-action`
to flesh out Approach, Acceptance Criteria, and Tasks before any code.

If fleshing out reveals more than one PR-sized slice, stop and `/roadmap` **split**
(`Added: … · re-rank split`) — do not grow this stub into a mega-spec.

## Problem

The Focus card is supposed to be the adult’s **most important next action**.
Today `selectFocusItem` picks the earliest uncovered or conflicted item in the
whole loaded window, so a 3-week-out RSVP/uncovered event steals the hero from
tonight’s practice. That is not helpful. Near-term actions (RSVP or coverage
this week, then the next event to leave for) should win; far-future planning
stays in the list.

## Non-goals (sketch)

- Focus card chrome / ring layout ([`agenda-focus-card-polish`](agenda-focus-card-polish.md))
- iOS / Android port ([`agenda-focus-card-mobile`](agenda-focus-card-mobile.md) copies this rule)
- Ride request / accept / decline as a Focus candidate — after
  [`carpool-request-accept`](carpool-request-accept.md); parked
  [`agenda-focus-carpool-actions`](agenda-focus-carpool-actions.md)
- Changing coverage, RSVP, or leave-by **write** rules — selection only
- Promoting more than one Focus card

## Notes

- The addendum already said needs-decision is “today, then tomorrow, then this
  week”; the shipped helper never applied that horizon. `/spec` should update
  `docs/agenda-focus-card-addendum.md` to match the new ranking.
- Sketch ranking (lock exact order in `/spec`): (1) earliest **this-week**
  decision — uncovered (includes RSVP no-response), conflicts, pending
  coverage confirm for the signed-in adult; (2) else the earliest in-play
  upcoming item (the next event to get to, even if all-set); (3) never
  all-RSVP-No; (4) none if the agenda is empty.
- A 3-week uncovered/RSVP item must not beat a calmer event that starts sooner.
- Web `selectFocusItem` only (mobile has no Focus card yet).
