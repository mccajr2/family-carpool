# Spec: agenda-carpool-action-parity

Status: done  
Parent: [docs/roadmap.md](../../roadmap.md)  
Created: 2026-08-26  
Updated: 2026-08-26 (`/pr`)  
Added: 2026-08-26 · enhancement  
Branch: `agenda-carpool-action-parity`

## Problem

Calendar is the primary ride surface, but reverse actions are incomplete there.
**Cancel** exists on expanded Agenda rows, yet Focus items are **not** duplicated
in the day list — so own `PENDING` / `ACCEPTED` on calm Focus leaves Cancel
unreachable on Calendar. **Withdraw** (when this circle accepted) exists only on
the Carpool tab. **Pass** is Focus-only; the Carpool tab shows a display-only
“Passed” status with Accept-after-Pass but no Pass button. Families need to undo
where they acted without leaving Calendar, and Pass must be reachable on the
tab for soft decline.

## Non-goals

- Full Accept / Pass action clone on expanded Agenda rows (rows keep
  Request / Cancel only for own-request flows)
- Who / where / kids / seats copy density —
  [`agenda-carpool-state-clarity`](../active/agenda-carpool-state-clarity.md)
- Accept-after-Pass behavior or un-pass —
  already done in
  [`carpool-pass-reconsider`](../archive/carpool-pass-reconsider.md); do not
  re-litigate
- New ride endpoints (reuse existing cancel / withdraw / pass)
- OpenAPI / contract changes
- Multi-hero Focus, Context ask inbox, Expo Agenda UI, KMP clients
- Restoring full RSVP / leave-from / conflict-detail bands on Focus
- Visual restyle or new design tokens

## Approach

**Web-only wiring** over existing `carpoolClient.cancelRide` /
`withdrawRide` / `passRide`. No OpenAPI bump, no backend changes.

**Focus (`AgendaFocusCard`) — reverse actions as secondary/outline:**

| State shown on Focus | Action |
| --- | --- |
| Own `PENDING` or `ACCEPTED` request | **Cancel** (outline) |
| This circle accepted a teammate ask (`otherRequests` ACCEPTED + our `acceptingCircleId`) | **Withdraw** (outline) |

Keep existing primary CTA precedence (Confirm → Accept/Pass → Request → Assign
→ calm). Reverse actions sit beside / under that chrome; they do not become the
primary filled CTA and do not change Focus ranking (own PENDING / ACCEPTED and
accepted-by-us remain non-decision wait/calm states).

**Expanded Agenda rows:** Keep Request / Cancel for own request. Do **not** add
Accept or Pass. When accepted-by-us applies for that joined ride event, show a
minimal accepted-by-us affordance and **Withdraw** (outline) — enough to attach
the reverse action, not Carpool-tab density (seats / pickup polish stays in
`agenda-carpool-state-clarity`).

**Carpool tab (`CarpoolSpaceRides`):** For `PENDING` other requests, add a
**Pass** button consistent with Focus (calls `/pass`). When `passedByMe`, keep
Accept-after-Pass and the “Passed” status; do not offer un-pass. After Pass,
hide Pass (idempotent second Pass is API-legal but unnecessary in UI). Pass
eligibility matches Focus: space member, not requesting circle; `drives` /
vehicle **not** required.

**Wiring:** Reuse Calendar cancel handlers already on `FamilyScreen`; add
withdraw (+ Pass already exists for Focus) for Focus / row; wire Pass on
`CarpoolPanel` / `CarpoolSpaceRides` the same way Focus does.

**Docs:** Amend architecture **Team carpool space (detail)** → Clients (and
Interaction UX seams if wording still implies reverse actions are tab-only) so
Calendar is documented as self-sufficient for Cancel / Withdraw when those
states are shown, and Carpool tab offers Pass.

## Context

Allowlist for `/implement`. Paths and **headings**, not whole-doc dumps.

- Archived (Agenda-primary rides + Pass domain; own PENDING not Focus decision):
  [`docs/specs/archive/agenda-focus-carpool-actions.md`](../archive/agenda-focus-carpool-actions.md)
- Archived (Accept-after-Pass; Pass button deferred here):
  [`docs/specs/archive/carpool-pass-reconsider.md`](../archive/carpool-pass-reconsider.md)
- Architecture: `docs/architecture.md` → **Team carpool space (detail)**
  (Clients row — reverse actions / Pass surfaces)
- Architecture: `docs/architecture.md` → **Interaction UX** → **Forward-looking
  seams** / **Busy ladder** (only if Clients wording still contradicts Calendar
  reverse-action self-sufficiency)
- Web: `web/src/components/AgendaFocusCard.tsx`
- Web: `web/src/components/AgendaRow.tsx`
- Web: `web/src/components/CarpoolSpaceRides.tsx`, `CarpoolPanel.tsx`
- Web: `web/src/components/FamilyScreen.tsx` (cancel / withdraw / pass wiring)
- Web: `web/src/components/carpoolDisplay.ts` (helpers if accepted-by-us detection
  is shared)
- Colocated tests: `AgendaFocusCard.test.tsx`, `AgendaRow.test.tsx`,
  `CarpoolSpaceRides.test.tsx` (+ `FamilyScreen` / panel tests if wiring covered
  there)

## Acceptance criteria

- [x] Focus with own `PENDING` request shown: outline **Cancel** calls existing
      cancel; Focus item is not also in the day list, so Cancel is reachable
      without opening Carpool.
- [x] Focus with own `ACCEPTED` request shown: outline **Cancel** likewise.
- [x] Focus when this circle accepted a teammate ask on that ride event: outline
      **Withdraw** calls existing withdraw; Accept/Pass primary chrome unchanged
      for eligible pending asks.
- [x] Expanded Agenda row with accepted-by-us: minimal status + outline
      **Withdraw**; still Request/Cancel for own request; **no** Accept or Pass
      buttons on the row.
- [x] Carpool tab `PENDING` other request (not yet `passedByMe`): **Pass** button
      calls `/pass`; after pass, status reflects Passed and Accept-after-Pass
      still works; no un-pass control.
- [x] No OpenAPI / backend changes; no new design tokens; Focus still exactly one
      card; ranking rules unchanged.
- [x] Architecture Clients (and seams if needed) document Calendar Cancel /
      Withdraw when those states are shown + Carpool Pass CTA.
- [x] Component tests would fail if Focus Cancel/Withdraw, row Withdraw, or
      Carpool Pass were removed; `cd web && npm test` (touched suites) and
      `npm run lint` pass.

## Tasks

- [x] Web: Focus outline Cancel when `ownRequest` is `PENDING` or `ACCEPTED`;
      wire to existing cancel handler; Focus card tests
- [x] Web: Focus outline Withdraw when accepted-by-us on Focus ride event; wire
      withdraw on `FamilyScreen`; Focus card tests
- [x] Web: Expanded AgendaRow minimal accepted-by-us + Withdraw; no Accept/Pass
      on rows; row tests
- [x] Web: Carpool tab Pass on PENDING other requests (`!passedByMe`); keep
      Accept-after-Pass; `CarpoolSpaceRides` / panel tests
- [x] Docs: architecture Clients (+ seams only if required) for reverse-action /
      Pass surfaces
- [x] Tests: run web lint + relevant vitest; report real results

## Open questions

- None blocking. Minimal accepted-by-us line on the expanded row is only enough
  to host Withdraw — density polish is
  [`agenda-carpool-state-clarity`](../active/agenda-carpool-state-clarity.md).
