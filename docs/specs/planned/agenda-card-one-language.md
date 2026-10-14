# Spec stub: agenda-card-one-language

Status: planned  
Parent: [docs/roadmap.md](../../roadmap.md)  
Created: 2026-10-09  
Added: 2026-10-09 · enhancement

Thin stub from `/roadmap`. **Not implementable yet.** Run
`/spec agenda-card-one-language` to flesh out Approach, Acceptance Criteria,
and Tasks before any code.

Split 2026-10-14: expanded bodies → [`agenda-card-expanded-bodies`](agenda-card-expanded-bodies.md).
Do not re-grow this stub into that work.

## Problem

`calendar-card-hierarchy` matched a four-frame mock for combined and locked
cards. Neighboring Agenda rows still use the previous language — compact
RiderChips on a single event beside kid + There/Back lines on a drive block —
so one week shows two card systems.

This slice is **one collapsed Agenda card language** on desktop web: shared
header (eyebrow, title role, when, chip family) and shared collapsed body
(kid row + There/Back). Derive variants from the real chip/plan inventory, not
a 16-cell yes/no matrix. Mock every in-scope composite before restyle; missing
from the mock → out of scope for this PR.

Slots this slice owns (closed sets; do not cross-multiply):

- Shell: single `AgendaRow` vs combined `AgendaBlockCard`
- Header identity + header chip family (urgent ride chips and combined plan
  chips such as `You · N of M legs` / `{Who} · round trip`)
- Collapsed body: kid row language on both shells (retire compact RiderChips
  as the resting single-event body)

Composite stress cards (collapsed; expand only if needed to prove a chip):

1. Single, one kid, ride needed
2. Combined 3 events, mixed coverage
3. Combined fully assigned, viewer drives nothing
4. Locked + open gap (chip + lock stamp can coexist)
5. Combined locked with one kid skipped (optional)

## Non-goals (sketch)

- Expanded bodies, DriverPicker modes, locked Edit/Done, commitment action
  words — [`agenda-card-expanded-bodies`](agenda-card-expanded-bodies.md)
- New ride states, coverage rules, or OpenAPI fields
- Hero, Focus, Carpool, Family, Places, Feeds, Route
- Phone-width Calendar (`calendar-phone-frame`)
- Undo holes (`action-undo-parity`)
- Inbound Accept/Pass row restyle (`AgendaInboundRequestRow`)
- Changing who is queued in the Hero

## Notes

- **Beta gate, rank 1.** After `calendar-card-hierarchy`; before
  `agenda-card-expanded-bodies` (rank 2). Phone layout waits until both card
  slices ship.
- Desktop web Agenda only.
- At `/spec`: lock slot variants + composites against the mock; one rule per
  in-scope slot. Do not invent a third chip or body pattern.
- Code inventory (2026-10-14): `rideStatusChipsForItem` + `combinedPlanChip`
  are the chip sources; `agendaItemStatusTags` is unused on these cards;
  `AgendaBlockCard` has no DriverPicker (expanded slice).
