# Spec stub: agenda-card-one-language

Status: planned  
Parent: [docs/roadmap.md](../../roadmap.md)  
Created: 2026-10-09  
Added: 2026-10-09 · enhancement

Thin stub from `/roadmap`. **Not implementable yet.** Run
`/spec agenda-card-one-language` to flesh out Approach, Acceptance Criteria,
and Tasks before any code.

If fleshing out reveals more than one PR-sized slice, stop and `/roadmap`
**split** (`Added: … · re-rank split`) — do not grow this stub into a
mega-spec. If the matrix below will not fit one PR, stop and split.

## Problem

`calendar-card-hierarchy` matched a four-frame mock (combined night and locked
recurring event, each collapsed and expanded). Neighboring Agenda cards still
use the previous language, so one week shows two card systems.

The next spec is one Agenda card language on desktop web. Before any layout
work, write a matrix and one rule per cell. The mock for `/spec` must show
every cell below, collapsed and expanded. Do not restyle a cell that is
missing from that mock.

Cells:

- Single event vs combined drive block
- Ride needed vs fully assigned
- Locked recurring vs not locked
- Collapsed vs expanded

Rules to make consistent (decide the words in `/spec`; do not invent a third
pattern):

- **Header:** same eyebrow, title role (`listRowTitle`), when line, and chip
  treatment. Combined may say "You · N of M legs"; a single assigned round
  trip and a ride-needed row must use that same chip family, not "You're
  driving" beside "You · round trip".
- **Collapsed body:** same kid row (avatar, name, event, clock). Combined
  keeps "There {driver} · Back {driver}". A single row uses the same row,
  not compact RiderChips on one card and kid lines on the next.
- **Expanded body:** Getting there / Coming back for every assigned card,
  single and combined. Ride needed still opens the simple DriverPicker.
  Plan locked, Edit, not-going, and Remove appear only after expand.
- **Action words:** one not-going phrase, one split phrase ("Split into N
  events" on a combined card; a single row's Combine / Split matches that
  voice), Remove in danger text. Drop "Mark {name} as not going" on these
  cards if the short label wins.

## Non-goals (sketch)

- New ride states, coverage rules, or OpenAPI fields
- Hero, Focus, Carpool, Family, Places, Feeds, Route
- Phone-width Calendar (`calendar-phone-frame`)
- Undo holes (`action-undo-parity`)
- Changing who is queued in the Hero

## Notes

- **Beta gate, rank 2.** After `calendar-card-hierarchy` ships; before
  `action-undo-parity` and before `calendar-phone-frame` (phone layout
  consumes this language, not the mixed one).
- Desktop web Agenda only. Relative order of ranks below the insert stays
  as they were.
- At `/spec`: matrix + one rule per cell first; mock must cover every cell
  collapsed and expanded. Missing from mock → out of scope for that PR.
- If the matrix is too large for one PR → `/roadmap` split; do not grow
  this stub.
