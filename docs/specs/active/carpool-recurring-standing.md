# Spec: carpool-recurring-standing

Status: draft  
Created: 2026-09-21  
Promoted: 2026-09-24 · `/spec` (slice A — series Ask)  
Parent: [docs/roadmap.md](../../roadmap.md)  
Added: 2026-09-21 · re-rank split  
Updated: 2026-09-24 · `/spec` split — week exceptions → `carpool-standing-week-exception`  
Branch: `carpool-recurring-standing`

## Problem

A parent who cannot cover a recurring team event (e.g. every Tuesday practice)
needs to ask the team for a **primary ride** — not re-Ask and re-Accept each
week. Teammates seeing that Ask must understand it is **standing / every
matching week**, with the same one-way legs, places, and meet-side options as
a normal Ask. Once accepted, that driver family is the fixed primary until the
arrangement ends. Today rides are one `eventKey` at a time; nothing models a
series Ask or a fixed-primary commitment.

## Non-goals

- Per-week exceptions: requester skip-one-week, driver bail-one-week, and the
  distinct “standing driver cancelled — need coverage” Hero
  (`carpool-standing-week-exception`)
- Fair turn-taking / driver pool (`carpool-recurring-rotation`)
- Neighborhood proximity recommendations (`neighborhood-carpool`)
- Household-only locked multi-event plans
  (`carpool-recurring-locked-plan` — already Done; do not merge tables)
- Driver can’t-cover replacement rules for rotation
  (`carpool-driver-gap-fill`)
- Auto-creating one-off Asks when standing expires; standing re-ask cool-down
- Push / in-app inbox (`push-notifications`, `in-app-notifications`)
- Expo / KMP / RN
- Changing one-off Ask/Accept/Pass/Cancel/Withdraw semantics for non-standing
  rides
- Inventing new place / meet / one-way UX (reuse today’s Ask shape)

## Approach

**Web-first. Series standing Ask in the `carpool` module — not a flag on a
single `RideRequest`, and not Lock-after-Accept.**

### Standing ride arrangement

Persist a **standing ride arrangement** (space-scoped):

| Field | Notes |
|--------|--------|
| id | UUID (`arrangementId`) |
| spaceId | Team space |
| requestingCircleId / requestedByAdultId | Household asking |
| fingerprint | Same spirit as household lock: `feedId` + local weekday + local start time-of-day (minute) + normalized location — reuse `RecurringFeedFingerprint` |
| ask template | Kids, TO/FROM legs (one-way OK), family-side places, meet side — same shape as today’s create-ride Ask |
| assignment | `FIXED_PRIMARY` (rotation later adds other policies on the same object) |
| status | `OPEN` → `ACTIVE` (on Accept) → `ENDED` |
| primary | Accepting adult + circle set only when `ACTIVE` |

**Create gate.** Offer standing Ask only when the FEED occurrence’s fingerprint
has **≥3 other upcoming** matches in the feed-backed known schedule (same
forward-recurrence spirit as `ForwardRecurrenceGate` / locked-plan). Irregular
games fail the gate — use one-off Ask.

**Duplicate.** At most one non-`ENDED` arrangement per
`(spaceId, requestingCircleId, fingerprint)` → **409**.

**OPEN visibility.** One arrangement-level Ask for the team — **not** N
independent PENDING ride heroes. Inbound Hero / Accept chrome collapses to
**one queue item per `arrangementId`** and copy must make the series obvious
(e.g. every Tuesday / standing primary). Matching Agenda rows may show standing
state, but must not spam Accept once per week.

**Accept.** Space-member adult from another circle Accepts the arrangement →
`ACTIVE`, records primary, **commits to all fingerprint-matching future weeks**
until End (week-level bail/skip is the follow-up spec). Pass stays soft
per-adult (same spirit as one-off Pass).

**Materialise.** On Accept and on subsequent calendar/sync enrich over the
feed-backed horizon: for each upcoming FEED row matching the fingerprint that
is still **blank for this arrangement** (no materialised ride linked yet),
create the accepted ride snapshot (kids, legs, places, meet, primary assignee)
linked by `arrangementId`. **Never overwrite** an occurrence that already has
an active one-off or materialised ride for that circle. Soft-fail materialise
must not roll back Accept (same TX split spirit as locked-plan apply).

**End standing (requester).** Deletes/`ENDED` the arrangement; stops
materialise; clears materialised teammate rides on fingerprint matches from
the End cutoff (`from` / occurrence `startsAt`) forward; past weeks keep
history. Primary may End only if product copy needs it in chrome — **requester
End is required** in this slice; driver End-whole can wait unless Accept UI
already needs a symmetric exit (prefer requester-only End in v1).

**Unanswered expire.** At **start of the first matching occurrence’s local
calendar day**, if still `OPEN` (no Accept): arrangement → `ENDED` (expired).
No auto one-off Ask to the team. Requester Hero for that week falls back to
normal coverage / one-off Ask. Re-posting standing is allowed (no cool-down in
v1).

**Parallel to household lock.** Do **not** store teammate standing in
`standing_block_templates`. Reuse fingerprint + horizon helpers only.

**Contract.** OpenAPI: arrangement create / accept / pass / end (+ list or
enrich fields on rides/calendar as needed), bump `info.version`; update **web**
clients in the same change. No KMP `sharedLogic`.

## Context

Allowlist for `/implement`. Paths and **headings**, not whole-doc dumps.

- Architecture: `docs/architecture.md` → Team carpool space (detail) **Rides**;
  Carpool summary row
- Archived reuse (fingerprint / horizon / never-overwrite / soft-fail apply):
  `docs/specs/archive/carpool-recurring-locked-plan.md`
- Sibling stubs (boundaries only):
  `docs/specs/planned/carpool-standing-week-exception.md`,
  `docs/specs/planned/carpool-recurring-rotation.md`,
  `docs/specs/planned/neighborhood-carpool.md`
- Source: `backend/modules/carpool/internal/CarpoolRideService.java`,
  `CarpoolController.java` (rides create/accept/pass/cancel/withdraw);
  `backend/modules/feeds/RecurringFeedFingerprint.java`,
  `ForwardRecurrenceGate.java`;
  `web/src/api/carpoolClient.ts`, `web/src/api/types.ts`;
  `web/src/components/coverageQueue.ts`, `HeroAttentionSlide.tsx`,
  `AgendaRow.tsx`, `AgendaFocusCard.tsx`, DriverPicker / Ask chrome;
  `contracts/openapi.yaml` (carpool ride paths)

## Acceptance criteria

- [ ] **Standing create gated:** Web offers standing Ask only when the FEED
      event fingerprint has ≥3 other upcoming matches in the feed-backed known
      schedule; otherwise only one-off Ask.
- [ ] **Series-obvious Ask:** Creating a standing Ask persists an `OPEN`
      arrangement with the same kids/legs/places/meet options as a normal Ask
      (including one-way). Teammate Hero/inbound chrome shows it is standing /
      every matching weekday — not a single practice — and Accept appears **once
      per arrangement**, not once per future week.
- [ ] **Accept = fixed primary:** Accept by another circle’s adult sets
      `ACTIVE` + primary and materialises accepted rides onto blank fingerprint
      matches in the known schedule; later blank matches also receive
      materialise; already-filled occurrences are never overwritten.
- [ ] **Requester End:** End standing marks `ENDED`, stops materialise, and
      clears materialised rides from the cutoff forward; weeks before cutoff
      keep data.
- [ ] **Unanswered expire:** Still-`OPEN` arrangement at local start of the
      first matching occurrence day becomes `ENDED`; no automatic one-off Ask
      is posted to the team; requester can create a one-off or re-post standing.
- [ ] **No week-exception Hero:** Driver withdraw / requester cancel of a
      single materialised week is **out of scope** — do not invent the distinct
      “need coverage this week” standing-gap Hero here (follow-up id).
- [ ] **Contract + web:** OpenAPI + web clients updated together; no KMP
      `sharedLogic` updates.
- [ ] **Tests:** Unit + integration for create gate, Accept+materialise,
      never-overwrite, End-from-cutoff, unanswered expire; web component/unit
      coverage for series Hero chrome (one Accept per arrangement).

## Tasks

- [x] Backend: Standing ride arrangement persistence (`FIXED_PRIMARY`, statuses,
      fingerprint, ask template snapshot) in `carpool`
- [ ] Backend: Create (gated) / Accept / Pass / End APIs; unanswered expire on
      enrich or scheduled path tied to known schedule
- [ ] Backend: Materialise onto blank fingerprint matches; soft-fail apply;
      never overwrite; link via `arrangementId`
- [ ] Contract: OpenAPI schemas + paths; bump `info.version`
- [ ] Web: Standing Ask entry (Calendar/Carpool) when gate passes; reuse Ask
      legs/places/meet chrome
- [ ] Web: Inbound Hero/Agenda series chrome — one Accept/Pass per arrangement;
      End standing for requester; expire → calm one-off path
- [ ] Web: `carpoolClient` / types aligned with OpenAPI
- [ ] Tests: Backend unit + integration as in AC; web tests for standing Hero
      collapse / series copy

## Open questions

- Driver-initiated **End whole arrangement** in slice A vs only requester End —
  default **requester-only** unless Accept chrome needs a symmetric exit.
- Exact standing Ask CTA placement (DriverPicker toggle vs separate control) —
  tune at implement against Hick (few choices); gate still required.
