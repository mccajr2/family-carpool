# Spec: agenda-carpool-state-clarity

Status: done  
Parent: [docs/roadmap.md](../../roadmap.md)  
Created: 2026-08-26  
Added: 2026-08-26 · enhancement  
Branch: `agenda-carpool-state-clarity`

## Problem

Ride state copy on Calendar is thinner than the Carpool tab. Own `PENDING` /
`ACCEPTED` on Focus is often chip-only (plus Cancel); Focus incoming asks omit
**seats**; expanded Agenda rows often omit **pickup** (and accepted-by-us omits
seats/pickup). Adults confirm or accept rides without seeing decision-critical
**who / where / kids / seats** on the surface where they acted.

## Non-goals

- Cancel / Withdraw / Pass wiring —
  [`agenda-carpool-action-parity`](../archive/agenda-carpool-action-parity.md)
  (already shipped; keep those CTAs)
- Rider initials circles —
  [`agenda-ride-rider-chips`](../planned/agenda-ride-rider-chips.md)
- Restoring full RSVP / leave-from / conflict-detail bands on Focus
- Changing Focus ranking, CTA precedence, or chip ladder rules
- Rewriting Carpool tab copy (“Accepted by …”) or restyling the tab
  ([`carpool-page-redesign`](../planned/carpool-page-redesign.md))
- Multi-stop / meet-at / leg to-from; OpenAPI / backend changes; new tokens
- Expo / KMP Agenda UI

## Approach

**Web Calendar only.** No OpenAPI bump — `CarpoolRide` already carries
`requestingCircleName` / `acceptingCircleName`, `kidFirstNames`, `seats`,
`pickupPlaceName`, `pickupAddress`.

Match **`CarpoolSpaceRides` ride-line field density** on Focus and expanded
`AgendaRow` whenever a ride state is shown (own request, incoming ask for
Accept/Pass, accepted-by-us). Keep Focus otherwise slim: chips + one summary
line + existing CTAs; do not restore expanded-row bands.

**Shared helpers** in `carpoolDisplay.ts` (extend / replace thin helpers such as
`incomingRideAskSummary`) so Focus, AgendaRow, and the tab do not drift on
field order. Calendar **status wording stays** Calendar language
(`Requested` / `Riding with {circle}`; blank → `Riding with a teammate`); the
tab may keep “Accepted by …”. Density = fields, not tab status phrasing.

| Surface | Ride state | Ride line fields |
| --- | --- | --- |
| Focus | Incoming Accept/Pass ask | requesting circle · kid first names · seats · pickup place, address |
| Focus | Own `PENDING` / `ACCEPTED` (with Cancel) | status (`Requested` / `Riding with …`) · kids · seats · pickup |
| Focus | Accepted-by-us (with Withdraw) | requesting circle · kids · seats · pickup (status may be a short Accepted prefix or muted second line — same fields either way) |
| Expanded AgendaRow | Own request | same as Focus own (add pickup; keep kids + seats) |
| Expanded AgendaRow | Accepted-by-us | same field set as Focus accepted-by-us (upgrade minimal line) |

Collapsed chips (`Requested` / `Riding with …`) unchanged. No new design
tokens — reuse existing Focus subtitle / row secondary text styles.

**Docs:** Amend architecture **Team carpool space (detail)** → Clients and
`docs/agenda-focus-card-addendum.md` so Focus/rows document full who/where/kids/
seats density (not chip-only / seats-less incoming).

## Context

Allowlist for `/implement`. Paths and **headings**, not whole-doc dumps.

- Archived (Calendar ride chrome + incoming who/where; density deferred here):
  [`docs/specs/archive/carpool-ride-clarity.md`](../archive/carpool-ride-clarity.md)
- Archived (Cancel / Withdraw already on Focus/rows; density deferred):
  [`docs/specs/archive/agenda-carpool-action-parity.md`](../archive/agenda-carpool-action-parity.md)
- Architecture: `docs/architecture.md` → **Team carpool space (detail)**
  (Clients — amend ride-line density on Focus / expanded rows)
- Design contract: `docs/agenda-focus-card-addendum.md` (incoming summary line;
  amend seats + own/accepted-by-us ride lines)
- Web: `web/src/components/carpoolDisplay.ts` (+ `carpoolDisplay.test.ts`)
- Web: `web/src/components/AgendaFocusCard.tsx` (+ `.test.tsx`)
- Web: `web/src/components/AgendaRow.tsx` (+ `.test.tsx`)
- Web: `web/src/components/CarpoolSpaceRides.tsx` (density reference; share
  helpers if cheap — do not restyle the tab)
- Optional contract touch: `docs/agenda-coverage-web-contract.md` only if it
  still documents seats-less Focus incoming / chip-only Focus own ride

## Acceptance criteria

- [x] Focus Accept/Pass incoming ask summary includes **seats** with requesting
      circle, kid first names, and pickup (`place, address`) — same field set as
      Carpool tab `OtherRideRequest` summary (order may match the shared helper).
- [x] Focus with own `PENDING` or `ACCEPTED` shown: a ride detail line (not
      chip-only) includes status wording + kids + seats + pickup; outline
      **Cancel** still present; existing own-ride chips still render.
- [x] Focus with accepted-by-us: a ride detail line includes requesting circle +
      kids + seats + pickup; outline **Withdraw** still present.
- [x] Expanded AgendaRow own request: status · kids · seats · **pickup** (pickup
      was the main gap).
- [x] Expanded AgendaRow accepted-by-us: requesting circle · kids · seats ·
      pickup (not kids-only minimal line).
- [x] Collapsed Agenda chips and Focus chip ladder unchanged; Focus still exactly
      one card; ranking / CTA precedence unchanged; no OpenAPI / backend / new
      tokens.
- [x] Architecture Clients (+ Focus addendum) document Calendar ride-line density
      for those states.
- [x] Component / unit tests would fail if seats were dropped from Focus
      incoming, pickup from own Focus/row lines, or seats/pickup from
      accepted-by-us lines; `cd web && npm test` (touched suites) and
      `npm run lint` pass.

## Tasks

- [x] Web: Shared ride-line helpers in `carpoolDisplay.ts` (incoming + own +
      accepted-by-us field sets); unit tests; wire Focus incoming to include seats
- [x] Web: Focus own `PENDING`/`ACCEPTED` detail line (kids · seats · pickup) with
      Cancel; keep chips; Focus tests
- [x] Web: Focus accepted-by-us detail line (circle · kids · seats · pickup) with
      Withdraw; Focus tests
- [x] Web: Expanded AgendaRow own + accepted-by-us lines match that density; row
      tests
- [x] Docs: architecture Clients + Focus addendum (and web contract only if stale)
- [x] Tests: run web lint + relevant vitest; report real results

## Open questions

- None blocking. Prefer one shared helper (or small family) so tab and Calendar
  stay aligned on fields; Calendar keeps “Riding with” / “Requested” status
  wording.
