# Spec stub: agenda-chip-section-headers

Status: planned  
Parent: [docs/roadmap.md](../../roadmap.md)  
Created: 2026-08-26  
Added: 2026-08-26 · enhancement

Thin stub from `/roadmap`. **Not implementable yet.** Run `/spec agenda-chip-section-headers`
to flesh out Approach, Acceptance Criteria, and Tasks before any code.

If fleshing out reveals more than one PR-sized slice, stop and `/roadmap` **split**
(`Added: … · re-rank split`) — do not grow this stub into a mega-spec.

## Problem

Agenda status chips use Title Case pills with a leading bullet/dot
([`agenda-list-chips`](../archive/agenda-list-chips.md), Focus polish). Feeds
already shipped the governing chip language: **uppercase**, **no bullet**,
shared feed-chip size/weight/padding. Agenda should match Feeds, and design
docs must be updated so later work does not reintroduce pills.

Agenda day-group subheaders also need clearer hierarchy and chrome: all-caps
slate section labels — **NEEDS YOUR ATTENTION**, **REST OF TODAY**,
**TOMORROW**, **THIS WEEK**, **LATER** (omit empty; **LATER** not Upcoming).

## Non-goals (sketch)

- Changing Focus selection / ranking or carpool ride actions
- Rider/person initials circles —
  [`agenda-ride-rider-chips`](agenda-ride-rider-chips.md)
- Feeds page restyle or new chip tones beyond matching existing Feeds chips
- Expo / mobile Agenda ports
- Exact `#9CA1A8` if it fails WCAG AA — prefer a token that passes (may reuse
  or add a section-label role near Feeds section labels)

## Notes

- **One PR:** chip language + section headers + design-doc lock (no handler
  changes beyond grouping/labels if NEEDS YOUR ATTENTION is a new bucket).
- `/spec` defines which list items land under **NEEDS YOUR ATTENTION** vs
  **REST OF TODAY** (Focus stays the single spotlight; list must not duplicate
  the Focus item).
- Docs to amend in the implementing PR: `docs/agenda-focus-card-addendum.md`,
  `docs/agenda-coverage-web-contract.md` (collapsed status tags),
  `docs/agenda-full-redesign-addendum.md`, `docs/ui-system.md` if chip guidance
  lives there; roadmap Visual language already locks Feeds as governing.
- Reuse `feedChip*` / `CarpoolFeedActions` chip tokens for Agenda status chips
  (`AgendaStatusChip` → tag/Feeds appearance; retire `appearance="pill"` on
  Agenda/Focus).
