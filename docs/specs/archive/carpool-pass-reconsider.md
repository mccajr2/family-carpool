# Spec: carpool-pass-reconsider

Status: done  
Parent: [docs/roadmap.md](../../roadmap.md)  
Created: 2026-08-26  
Updated: 2026-08-26 (`/pr`)  
Added: 2026-08-25 · enhancement  
Branch: `carpool-pass-reconsider`

## Problem

Dogfood: if you **accept** then **cancel/withdraw**, Accept/Pass returns (pass
rows were cleared). If you **pass**, that is final — no way to accept later when
no one else offered and the ask becomes more urgent. Pass should mean “not right
now” (soft decline), not “never.” While the ride is still `PENDING`, the passer
should be able to **Accept**. The requesting family is also blind today: they
cannot tell who actively declined vs who has not engaged.

## Non-goals

- Exposing a Pass **button** on the Carpool tab (wiring only) —
  [`agenda-carpool-action-parity`](../active/agenda-carpool-action-parity.md)
- Chip / section chrome, Focus Request CTA density, incoming who/where polish —
  [`carpool-ride-clarity`](../archive/carpool-ride-clarity.md),
  [`agenda-carpool-state-clarity`](../planned/agenda-carpool-state-clarity.md),
  [`agenda-chip-section-headers`](../planned/agenda-chip-section-headers.md)
- Push / in-app inbox / emergency **nudge** when coverage is still missing
  (leave the door open; `push-notifications` and later product work)
- Explicit **un-pass** API or UI (clearing pass without Accept)
- Changing Pass so it cancels the request for everyone
- Expo Agenda UI; KMP clients
- Visual restyle / new design tokens

## Approach

Amend the Pass domain locked in
[`agenda-focus-carpool-actions`](../archive/agenda-focus-carpool-actions.md):

1. **Soft decline for Focus.** Keep skipping `passedByMe` asks in Focus ranking
   and Focus Accept/Pass CTAs (`eligiblePendingRideAccept`). Pass still means
   “don’t surface this as my next decision.”
2. **Accept after Pass.** While status is `PENDING`, Carpool tab (and any
   non-Focus surface that already offers Accept on `otherRequests`) shows
   Accept even when `passedByMe`. Existing Accept API already clears pass rows
   on success; no un-pass endpoint. Seat / `drives` / vehicle rules unchanged.
3. **Requester signal.** Extend list-rides `CarpoolRide` with
   `passedByAdultNames` (adult `displayName`s who passed, stable order =
   pass `createdAt` ascending). Empty when none. Populate on list (and on
   pass response). Web shows a small line on the requesting circle’s own
   PENDING request: **Passed by {names}** (Agenda expanded own-request band +
   Carpool tab own-request row). No push.

**Contract:** bump `info.version`. Amend OpenAPI text that currently says
clients must not offer Accept when `passedByMe`. Document the new field and
the soft-decline meaning of Pass. No new HTTP path.

**Layers:** backend carpool module + OpenAPI + web API types/client + Carpool
tab Accept gating + own-request copy helpers. No Expo / KMP.

## Context

Allowlist for `/implement`.

- Prior Pass lock (amended by this slice):
  [`docs/specs/archive/agenda-focus-carpool-actions.md`](../archive/agenda-focus-carpool-actions.md)
  → **Pass domain (locked)**
- Architecture: [`docs/architecture.md`](../../architecture.md) → **Team carpool
  space** (Rides / Clients rows mentioning Pass / `passedByMe`)
- Contract: `contracts/openapi.yaml` → tag `carpool` (`CarpoolRide`,
  `passCarpoolRide`, list-rides description)
- Backend: `backend/modules/carpool/.../CarpoolRideService.java`,
  `CarpoolRidePassRepository`, `CarpoolRideResponse`,
  `CarpoolRideControllerIntegrationTest` / `CarpoolRideServiceTest`
- Auth name lookup: `AdultSessionApi.requireAdult` (displayName)
- Web: `web/src/api/types.ts`, `web/src/api/carpoolClient.ts`,
  `web/src/components/carpoolDisplay.ts` (`eligiblePendingRideAccept`,
  `ownRideStatusLine`), `CarpoolSpaceRides.tsx`, `AgendaRow.tsx` (own-request
  band), colocated tests

## Acceptance criteria

- [x] While a ride is `PENDING`, an adult who has `passedByMe: true` can still
      **Accept** from the Carpool tab (eligible vehicle / seats / `drives`
      unchanged). Successful Accept clears pass rows as today.
- [x] Focus selection and Focus Accept/Pass CTAs still **ignore** asks the
      caller has passed (`eligiblePendingRideAccept` continues to skip
      `passedByMe`). Passing soft-snoozes the ask out of Focus.
- [x] List-rides (and pass `200` body) include `passedByAdultNames: string[]`
      on each ride: display names of adults who passed, ordered by pass time;
      `[]` when none or after passes were cleared (Accept / Cancel).
- [x] Requesting circle sees **Passed by …** on their own `PENDING` request
      when the array is non-empty (Agenda expanded own-request status + Carpool
      tab own-request row). Empty → no passer line (still “Requested”).
- [x] OpenAPI documents soft-decline Pass + Accept-after-Pass for non-Focus
      surfaces; removes “must not offer Accept” for `passedByMe`; bumps
      `info.version`. Web types/client updated in the same change.
- [x] No new un-pass endpoint; second Pass remains idempotent; Pass still does
      not change RSVP or ride status.

## Tasks

- [x] Backend: resolve passer adultIds → `displayName` when mapping
      `CarpoolRideResponse`; add `passedByAdultNames`; batch-load passes for
      listed ride ids (not N+1 per ride)
- [x] Backend: unit + integration tests — pass names on list / pass response;
      Accept after pass still works; Focus-facing `passedByMe` still true after
      pass; names empty after Accept/Cancel
- [x] Contract: `passedByAdultNames` on `CarpoolRide`; amend Pass /
      `passedByMe` descriptions; bump `info.version`
- [x] Web API: types + `carpoolClient` fixtures/tests for the new field
- [x] Web: Carpool tab Accept enabled when `PENDING` + eligible even if
      `passedByMe` (status may still say “Passed” for the passer)
- [x] Web: keep Focus skip of `passedByMe` in `eligiblePendingRideAccept` /
      Focus tests
- [x] Web: own-request “Passed by …” via `ownRideStatusLine` (or sibling
      helper) on AgendaRow + Carpool own-request UI; component tests
- [x] Tests: run backend carpool ride tests + web vitest for touched files;
      report results

## Open questions

- None blocking. Future: requester/system **nudge** may re-surface Accept on
  Focus without clearing the pass row — out of this slice. Adult **displayName**
  (not circle name) is intentional: Pass is per-adult.
