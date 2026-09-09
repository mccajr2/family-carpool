# Spec: Ride cards cleanup

Status: archived  
Completed: 2026-09-09  
Created: 2026-09-08  
Updated: 2026-09-09 (`/pr` closeout — shipped in #104 on `coverage-leave-from`)  
Parent: [docs/roadmap.md](../../roadmap.md) — UI polish on `coverage-leave-from` PR (#104); no separate roadmap Upcoming row  
Branch: `coverage-leave-from`  

## Problem

Hero (“needs attention”) and Agenda GameCards still show verbose datetimes, duplicate
status/leave-by facts, a redundant Leave-from label above the combobox, and mixed
primary vs override chrome for already-confirmed decisions. Adults scanning the
Calendar need one fact per place and a clear confirm path for pending rides.

## Non-goals

- Backend / OpenAPI / leave-from persistence model changes
- New coverage or carpool product behavior
- iOS / Android / Expo ports
- Full Carpool destination redesign
- Changing which items enter the hero queue

## Approach

UI/UX cleanup on web reference cards only. Shared helpers for compact event when +
location line + detour pill thresholds. Restructure `HeroAttentionSlide` and
`AgendaRow` (and align DriverPicker / LeaveFromControls / PickupLine) so pending
decisions get one dynamic primary confirm and confirmed decisions get quiet
override links. Document the conventions in the Agenda web contract addendum.

## Context

- Brief: user-attached `ride-cards-cleanup-brief.md` (requirements source)
- Design: `docs/agenda-full-redesign-addendum.md`, `docs/agenda-coverage-web-contract.md`
  (leave-from / coverage rules unchanged)
- Tokens: `design-tokens/tokens.json` → add `locationLine` (13px) if needed
- Source:
  - `web/src/components/HeroAttentionSlide.tsx`
  - `web/src/components/AgendaRow.tsx`
  - `web/src/components/DriverPicker.tsx`
  - `web/src/components/LeaveFromControls.tsx`
  - `web/src/components/PickupLine.tsx`
  - `web/src/components/eventTimes.ts`
  - `web/src/components/pickupTone.ts`
  - `web/src/components/coverageCopy.ts`

## Acceptance criteria

- [x] Card datetime lines use compact `{Month} {day}, {start} – {end}` (same-day
      drops redundant end date/year; multi-day shows both dates)
- [x] Location lines use map-pin + 13px secondary text under the datetime
- [x] Hero own-ride: UP NEXT / headline / ring → datetime → location → divider →
      Driver chips → Leave from (label + select + one-time reveal) → full-width
      dynamic `Confirm — … from …` → divider → household-free + Ask the team
- [x] Leave-from no longer shows a duplicate “Leave from {place}” label above the
      select; one-time address reveals inline input (no separate Apply required for
      draft/confirm label; live text feeds confirm copy, empty → “the address you enter”)
- [x] Agenda collapsed header: team/title/when/where + status chips +
      icon-only Route (`aria-label` “Route for this ride”) + chevron; rider stack
      once below header; expanded body has horizontal override links, full Route
      CTA, one leave-by helper, Carpool section with Accepted + detour pill +
      “Can't take them anymore” (no duplicate driving chip / duplicate leave-by /
      large Request on accepted asks)
- [x] Detour pills use app-wide thresholds: 0–10 success, 11–20 warning, 21+
      danger (v6 mock; not the brief’s placeholder 0–5 / 6–15 / 16+)
- [x] Agenda “Ride needed” / other cards that share leave-from or datetime follow
      the same conventions; judgment calls flagged in Open questions if any
- [x] Unit/component tests cover compact when, confirm label, leave-from reveal,
      agenda header route a11y, and detour thresholds; relevant suite passes

## Tasks

- [x] Docs: this spec + short addendum note in `docs/agenda-full-redesign-addendum.md`
- [x] Tokens: `locationLine` 13/18/400; regenerate
- [x] Shared: `formatCompactEventWhen`; `EventLocationLine`; update `pickupTone` +
      `PickupLine` pill; confirm-label helpers in coverageCopy / DriverPicker
- [x] Web: restructure HeroAttentionSlide + DriverPicker + LeaveFromControls
- [x] Web: restructure AgendaRow (header, riders, overrides, leave-from, carpool)
- [x] Tests: eventTimes, pickupTone, PickupLine, DriverPicker, HeroAttentionSlide /
      carousel, AgendaRow, LeaveFromControls as needed

## Open questions

_(none — smoke review resolved both judgment calls)_

- Pending inbound carpool on Agenda: **keep Accept/Pass as primary CTAs**
  (pending decision, same bucket as Hero confirm). Demote-to-override applies
  only to already-confirmed decisions. Confirmed 2026-09-09.
- Detour thresholds: use the **v6 mock** bands 0–10 / 11–20 / 21+ (authoritative).
  Brief’s 0–5 / 6–15 / 16+ was a placeholder. Confirmed 2026-09-09.

## Smoke follow-ups (2026-09-09)

- [x] Waiting-on card: single leave-from = pending driver’s coverage origin (no
      stacked item + coverage choosers)
- [x] Waiting-on card: `Cancel request to {driver}` override next to Mark not going
- [x] Ride Needed: Driver → Leave from (+ leave-by) → Confirm; secondary links /
      Needs coverage below
- [x] Hero countdown ring: adaptive minutes / hours / days via `formatHeroCountdownRing`
