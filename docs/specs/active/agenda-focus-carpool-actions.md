# Spec: agenda-focus-carpool-actions

Status: draft  
Created: 2026-08-17  
Parent: [docs/roadmap.md](../../roadmap.md)  
Branch: `agenda-focus-carpool-actions`  
Added: 2026-08-17 · enhancement  
Updated: 2026-08-21 · enhancement (Agenda-primary UX + pass + Focus rank lock)

## Problem

Ride request/accept shipped on the **Carpool tab**, so the loop is easy to miss
from Calendar — the place adults already live. Team events need **Request ride**
(and ride status) on Agenda event cards, and **incoming teammate asks** must be
impossible to overlook without leaving Calendar. There is still no way for a
driver to **pass** on a pending ask without cancelling it for everyone else.

## Non-goals

- Inventing request / accept / cancel / withdraw
  ([`carpool-request-accept`](../archive/carpool-request-accept.md)) — reuse
  those paths; this slice only **adds** per-adult **pass**
- Multi-hero / stacked Focus cards
- Context “open asks” aggregation panel or Week-glance rewrite
- Adding ride fields to `CalendarItem` / mega calendar OpenAPI rewrite
- Multi-stop / Open in Maps ([`carpool-multi-stop`](../planned/carpool-multi-stop.md))
- Carpool tab visual restyle ([`carpool-page-redesign`](../planned/carpool-page-redesign.md))
- Removing the Carpool tab or its secondary ride list
- Un-pass / reverse a pass
- In-app / push / email when someone passes
- Mobile Agenda / Focus / ride UI
  ([`carpool-request-accept-mobile`](../planned/carpool-request-accept-mobile.md),
  [`agenda-focus-card-mobile`](../planned/agenda-focus-card-mobile.md)) —
  still update `sharedLogic` clients for the new OpenAPI path
- Focus chrome restyle
  ([`agenda-focus-card-polish`](../archive/agenda-focus-card-polish.md)) —
  reuse slim summary + one primary CTA; write bands stay on expanded rows
- Treating **own** `PENDING` ride request as a Focus decision (wait state —
  surfaces as row chip + Cancel only; Focus stays an action you can take)

## Approach

**Contract:** bump `info.version`. Add
`POST /api/carpool/spaces/{spaceId}/rides/{rideId}/pass` (empty body). Extend
list-rides payload so callers know which `otherRequests` they have already
passed (either omit those from `otherRequests`, or include a boolean such as
`passedByMe` — pick one and keep web + `sharedLogic` aligned). Do **not** add
ride fields to `CalendarItem`.

**Pass domain (locked):**

| Topic | Decision |
|--------|----------|
| Meaning | This adult will not accept this `PENDING` ride; request stays `PENDING` for everyone else |
| Authz | Space member, **not** requesting circle; ride must be `PENDING`. Own circle’s request → **409**. Non-member / unknown ride → **404**. Accept eligibility (`drives` / vehicle) is **not** required to pass |
| Persistence | Per `(rideId, adultId)` unique. Survives **Withdraw** (still `PENDING`). Cleared when the ride is **Cancelled** or **Accepted**. No un-pass this slice |
| Idempotent | Second pass by the same adult → **200** (no-op), not 409 |
| List | Adults who passed do not get an Accept CTA for that ride (list filter or `passedByMe`) |

**Web join (no calendar enrichment):** On Calendar, load carpool summary +
`listRides` for each member space (same today→+30d window spirit as
`CarpoolPanel`). Map `feedId` → `spaceId` via summary. Match a FEED
`CalendarItem` to a `CarpoolRideEvent` by **space + `startsAt` + title** (and
location when both non-blank). Manual / non-member-feed rows stay ride-less.

**Agenda rows:** Carpool-eligible expanded rows expose Request / Requested /
Accepted (who) beside coverage — reuse create/cancel handlers and display
helpers from `CarpoolSpaceRides` / `carpoolDisplay` where practical. Collapsed
rows may show a single carpool status chip only. Kid subset + vehicle Hick
rules match the Carpool tab.

**Focus (exactly one card) — ranking + CTA locked 2026-08-21:**

Horizon buckets stay
[`agenda-focus-next-action`](../archive/agenda-focus-next-action.md): Today
decisions → Tomorrow decisions → earliest in-play (even all-set). Rest-of-week
decisions never beat a sooner all-set event.

**Needs a decision** (urgent predicate + today/tomorrow eligibility):

| Kind | Counts? |
|------|---------|
| Uncovered kids (incl. RSVP no-response) | Yes — family |
| Conflicts | Yes — family |
| Pending coverage Confirm for self | Yes — family |
| Eligible pending **ride Accept** for self (other-circle `PENDING`, not passed, caller could accept) | Yes — community |
| Own circle’s `PENDING` / `ACCEPTED` ride | **No** — not a Focus decision |

**Family-before-community (Today / Tomorrow only):** When picking the Focus
item inside a day bucket, prefer any **family** decision (uncovered /
conflict / pending Confirm) over an eligible ride Accept, then earliest
`startsAt`. Do **not** apply this across day buckets (tomorrow’s uncovered
still beats today’s all-set; today’s family decision still beats tomorrow’s
ride ask).

**CTA on the selected card:**

1. Pending coverage for self → Confirm + Decline  
2. Else eligible pending ride → Accept + Pass  
3. Else uncovered → Assign (existing)  
4. Else calm leave-by / Edit  

Accept vehicle Hick unchanged from request/accept. Pass calls the new
endpoint; after pass, that ask no longer qualifies for Focus for this adult.
RSVP Yes/No stays on expanded Agenda rows (missing RSVP surfaces as Assign
via uncovered).

**Carpool tab:** Keep membership + secondary ride list; honor pass in the
list so Accept does not reappear for a passed ride. Calendar is primary after
this slice.

**Docs:** Update `docs/architecture.md` → **Team carpool space (detail)**
Clients row and **Interaction UX** → **Forward-looking seams** / Busy ladder
so Agenda is the primary request/accept surface (Carpool tab secondary).

**Mobile:** OpenAPI + `sharedLogic` `CarpoolClient` only — no Android/iOS UI.

## Context

Allowlist for `/implement`. Paths and **headings**, not whole-doc dumps.

- Architecture: `docs/architecture.md` → **Team carpool space (detail)** (Rides +
  Clients — update Clients / primary surface in this PR)
- Architecture: `docs/architecture.md` → **Interaction UX** → **Forward-looking
  seams** and **Busy ladder** (ride-share on Agenda; update seams wording)
- Archived (reuse ranking): `docs/specs/archive/agenda-focus-next-action.md`
- Archived (reuse APIs): `docs/specs/archive/carpool-request-accept.md`
  (Accept/Cancel/Withdraw, seat math, Hick; parked pass becomes this slice)
- Archived (Focus CTA chrome): `docs/specs/archive/agenda-focus-card-polish.md`
- Contract: `contracts/openapi.yaml` → tag `carpool` (`/rides` + new `/pass`)
- Backend: `backend/modules/carpool/.../CarpoolController.java`
- Backend: `backend/modules/carpool/.../internal/CarpoolRideService.java`
- Web: `web/src/api/carpoolClient.ts`, `web/src/api/types.ts`
- Web: `web/src/components/agendaFocusSelection.ts`
- Web: `web/src/components/AgendaFocusCard.tsx`
- Web: `web/src/components/AgendaRow.tsx`
- Web: `web/src/components/FamilyScreen.tsx` (Calendar ride load + wiring)
- Web: `web/src/components/CarpoolPanel.tsx`, `CarpoolSpaceRides.tsx`,
  `carpoolDisplay.ts`
- Mobile shared: `mobile/sharedLogic/.../CarpoolClient.kt` (+ models/tests)

## Acceptance criteria

- [x] OpenAPI: `POST …/rides/{rideId}/pass` documented; `info.version` bumped;
      list-rides documents how passed asks are represented for the caller.
- [x] Backend: pass authz/idempotency/clear-on-cancel-or-accept as in Approach;
      unit + integration tests would fail if pass were removed or cancelled the
      ride for others.
- [x] Web Calendar: carpool-eligible expanded Agenda FEED rows show Request /
      Requested / Accepted (who); collapsed may show a status chip; create/cancel
      use existing ride endpoints.
- [x] Frozen `now`: all-set today + eligible pending ride accept tomorrow →
      tomorrow Focus; rest-of-week pending ride does **not** beat a sooner
      all-set item (same horizon as next-action).
- [x] Frozen `now`: today teammate ride ask at 4pm + today uncovered at 5pm →
      Focus is the **5pm uncovered** (family-before-community); reverse times →
      4pm uncovered still wins.
- [x] Frozen `now`: today eligible ride ask only (coverage all-set) → that ask
      is Focus with Accept + Pass.
- [x] Frozen `now`: own `PENDING` ride + coverage all-set today → Focus is calm
      leave-for (own ask is **not** a decision); Requested/Cancel stay on the row.
- [x] Focus still renders **exactly one** card; pending ride ask does not spawn
      a second hero or a Context inbox.
- [x] Focus CTA: eligible pending ride → Accept + Pass; Pass calls the new API
      and removes that ask from this adult’s Focus eligibility; Accept keeps
      existing vehicle Hick.
- [x] Focus CTA precedence on the same item: pending coverage for self →
      Confirm/Decline; else ride Accept/Pass; else Assign.
- [x] Week at a glance / Context stay coverage-status only — no open-asks panel.
- [x] Carpool tab still lists rides; passed rides do not offer Accept to the
      passer; membership chrome unchanged.
- [x] `sharedLogic` Carpool client covers pass (+ list shape); no Android/iOS
      Agenda UI in this PR.
- [ ] Architecture Clients / Forward-looking seams updated for Agenda-primary
      rides. No `CalendarItem` ride fields.
- [ ] `cd web && npm test` and `npm run lint` pass; backend carpool ride tests
      pass; relevant `sharedLogic` tests pass.

## Tasks

- [x] Contract: `/pass` + list-rides passed representation; bump version
- [x] Backend: persist passes; service + controller; clear on cancel/accept;
      unit + integration tests
- [x] Web API: `carpoolClient.passRide` + types; tests
- [x] Web: join helper (feed/space + startsAt/title[/location] → ride event);
      load rides on Calendar in `FamilyScreen`
- [x] Web: AgendaRow expanded request/status band + optional collapsed chip;
      component tests
- [x] Web: extend `focusItemNeedsDecision` / `selectFocusItem` for pending ride
      accept + family-before-community in Today/Tomorrow; Focus Accept/Pass CTA
      + same-card precedence; selection + Focus card tests (incl. own-PENDING
      not urgent)
- [x] Web: Carpool tab honors pass (no Accept after pass)
- [x] Mobile sharedLogic: pass (+ list shape) client + unit tests
- [ ] Docs: architecture Team carpool Clients + Interaction UX seams / Busy
      ladder
- [ ] Tests: run web lint/test, backend carpool ride suites, sharedLogic
      CarpoolClient tests — report real results

## Open questions

- None for approval — Decline = per-adult **pass** (2026-08-21); Focus rank =
  family-before-community in Today/Tomorrow + own PENDING off Focus
  (2026-08-21). Matching FEED rows without `uid` on `CalendarItem` is accepted
  risk; if dogfood finds collisions, a follow-up may add nullable
  `uid`/`eventKey` to calendar (out of this slice unless implement proves
  matching is unsafe).
