# Spec: agenda-focus-carpool-actions

Status: draft  
Created: 2026-08-17  
Parent: [docs/roadmap.md](../../roadmap.md)  
Branch: `agenda-focus-carpool-actions`  
Added: 2026-08-17 · enhancement  
Updated: 2026-08-21 · amend (Request without RSVP Yes; Focus Request CTA;
match harden; Accept→Yes not create — dogfood)

## Problem

Ride request/accept shipped on the **Carpool tab**, so the loop is easy to miss
from Calendar — the place adults already live. Team events need **Request ride**
(and ride status) on Agenda event cards, and **incoming teammate asks** must be
impossible to overlook without leaving Calendar. There is still no way for a
driver to **pass** on a pending ask without cancelling it for everyone else.

Dogfood (2026-08-21): **Request** on Calendar feels intermittent; requiring
**RSVP Yes before Request** blocks the real loop (families often need a ride
before they know attendance); Focus only offers Assign on uncovered team
events — no Request on the hero when that is the next action.

## Non-goals

- Inventing request / accept / cancel / withdraw endpoints
  ([`carpool-request-accept`](../archive/carpool-request-accept.md)) — reuse
  those paths; this slice **adds** per-adult **pass** and **amends** create
  default-kid / Focus CTA rules as locked below
- Multi-hero / stacked Focus cards
- Context “open asks” aggregation panel or Week-glance rewrite
- Adding ride fields to `CalendarItem` / mega calendar OpenAPI rewrite —
  stable `uid`/`eventKey` on calendar is
  [`calendar-item-event-key`](../planned/calendar-item-event-key.md) (after
  this slice’s heuristic harden)
- Multi-stop / Open in Maps ([`carpool-multi-stop`](../planned/carpool-multi-stop.md))
- Carpool tab visual restyle ([`carpool-page-redesign`](../planned/carpool-page-redesign.md))
- Removing the Carpool tab or its secondary ride list
- Un-pass / reverse a pass
- In-app / push / email when someone passes
- Mobile Agenda / Focus / ride UI
  ([`carpool-request-accept-mobile`](../planned/carpool-request-accept-mobile.md),
  [`agenda-focus-card-mobile`](../planned/agenda-focus-card-mobile.md)) —
  still update `sharedLogic` clients for OpenAPI changes
- Focus chrome restyle
  ([`agenda-focus-card-polish`](../archive/agenda-focus-card-polish.md)) —
  keep slim summary; **Request** (and Accept/Pass) are allowed primary CTAs;
  leave-from and full RSVP Yes/No bands stay on expanded Agenda rows (Request
  may auto-Yes — see Approach)
- Treating **own** `PENDING` ride request as a Focus decision (wait state —
  surfaces as chip + Cancel; Focus stays an action you can take)
- Putting full per-kid RSVP controls on the Focus card this slice

## Approach

**Contract:** bump `info.version`. Add
`POST /api/carpool/spaces/{spaceId}/rides/{rideId}/pass` (empty body). Extend
list-rides payload so callers know which `otherRequests` they have already
passed (`passedByMe` — web + `sharedLogic` aligned). Document amended
**defaultKidIds** / create-kid rules. Do **not** add ride fields to
`CalendarItem`.

**Pass domain (locked):**

| Topic | Decision |
|--------|----------|
| Meaning | This adult will not accept this `PENDING` ride; request stays `PENDING` for everyone else |
| Authz | Space member, **not** requesting circle; ride must be `PENDING`. Own circle’s request → **409**. Non-member / unknown ride → **404**. Accept eligibility (`drives` / vehicle) is **not** required to pass |
| Persistence | Per `(rideId, adultId)` unique. Survives **Withdraw** (still `PENDING`). Cleared when the ride is **Cancelled** or **Accepted**. No un-pass this slice |
| Idempotent | Second pass by the same adult → **200** (no-op), not 409 |
| List | Adults who passed do not get an Accept CTA for that ride (`passedByMe`) |

**Request kids (amends [`carpool-request-accept`](../archive/carpool-request-accept.md) — locked 2026-08-21):**

| Topic | Decision |
|--------|----------|
| Who needs a ride | Feed-linked kids who are **not RSVP No** and not already on this circle’s **ACCEPTED** ride for the event. **Yes** and **No response** both qualify |
| `defaultKidIds` (list) | That set (stable order = feed kid link order) |
| Create body | Omit `kidIds` → all of that default set. Subset override OK. Empty default (no feed kids, or all No / already covered) → **400** with a clear message — not “must RSVP Yes first” |
| Create ↔ RSVP | Create does **not** change RSVP. Requested kids may stay **No response** (asking for a ride is not committing attendance) |
| Accept ↔ RSVP | Successful **Accept** sets RSVP **Yes** for the kids on that ride (requesting circle). Cancel / Withdraw / Pass do **not** auto-change RSVP |
| Reject | Explicit **RSVP No** kid in `kidIds` → **400**. Unknown / not on feed → **400** |
| UI copy | Drop “Mark who’s going on Calendar to request a ride” when the empty case was only missing Yes; show Request + kid checkboxes whenever defaults are non-empty |

**Web join (no calendar enrichment):** On Calendar, load carpool summary +
`listRides` for each member space (same today→+30d window spirit as
`CarpoolPanel`). Map `feedId` → `spaceId` via summary. Match a FEED
`CalendarItem` to a `CarpoolRideEvent` by **space + `startsAt` + title**.
**Location:** only use to **disambiguate** when more than one candidate shares
title+startsAt; if exactly one candidate matches title+startsAt, take it even
when locations differ (fixes FP fingerprint drift). Manual / non-member-feed
rows stay ride-less.

**Agenda rows:** Carpool-eligible expanded rows expose Request / Requested /
Accepted (who) beside coverage — reuse create/cancel handlers and display
helpers from `CarpoolSpaceRides` / `carpoolDisplay` where practical. Collapsed
rows may show a single carpool status chip only. Kid subset + vehicle Hick
rules match the Carpool tab. Request must appear whenever join matched and
`defaultKidIds` (or own request) warrants it — not only after a prior Yes.

**Focus (exactly one card) — ranking locked 2026-08-21; CTA amended 2026-08-21:**

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
| “Could Request” (matched FEED, no own request, non-empty requestable kids) | **No** as its own urgent kind — uncovered already covers no-response; Request is a **CTA** on the selected card, not a separate ranking bucket |

**Family-before-community (Today / Tomorrow only):** When picking the Focus
item inside a day bucket, prefer any **family** decision (uncovered /
conflict / pending Confirm) over an eligible ride Accept, then earliest
`startsAt`. Do **not** apply this across day buckets.

**CTA on the selected card (amended):**

1. Pending coverage for self → Confirm + Decline  
2. Else eligible pending ride → Accept + Pass  
3. Else carpool-eligible + no `ownRequest` + requestable kids → **Request**
   (primary). If also uncovered, **Assign** may stay as a secondary/outline
   action (same card) — do not hide Request behind expand-the-list  
4. Else uncovered → Assign (existing)  
5. Else calm leave-by / Edit  

Accept vehicle Hick unchanged. Pass calls `/pass`; after pass, that ask no
longer qualifies for Focus for this adult. Full RSVP Yes/No stays on expanded
Agenda rows; Focus does not grow an RSVP band this slice. Request leaves
No-response kids unchanged; Accept sets Yes (see Request kids table).

**Carpool tab:** Keep membership + secondary ride list; honor pass; use the
same requestable-kid rules / copy as Calendar.

**Docs:** Update `docs/architecture.md` → **Team carpool space (detail)**
(Rides default kids + Clients) and **Interaction UX** → **Forward-looking
seams** / Busy ladder for Agenda-primary rides + Request-without-prior-Yes
(Accept → Yes).

**Web join (this slice):** Heuristic match only (title+startsAt; location
disambiguates). Stable join via calendar `uid`/`eventKey` is
[`calendar-item-event-key`](../planned/calendar-item-event-key.md) — out of
this PR.

**Mobile:** OpenAPI + `sharedLogic` `CarpoolClient` only — no Android/iOS UI.

## Context

Allowlist for `/implement`. Paths and **headings**, not whole-doc dumps.

- Architecture: `docs/architecture.md` → **Team carpool space (detail)** (Rides +
  Clients — update Clients / primary surface / default kids in this PR)
- Architecture: `docs/architecture.md` → **Interaction UX** → **Forward-looking
  seams** and **Busy ladder** (ride-share on Agenda; update seams wording)
- Archived (reuse ranking): `docs/specs/archive/agenda-focus-next-action.md`
- Archived (reuse APIs; **default-kid rule amended here**):
  `docs/specs/archive/carpool-request-accept.md`
- Archived (Focus CTA chrome): `docs/specs/archive/agenda-focus-card-polish.md`
- Contract: `contracts/openapi.yaml` → tag `carpool` (`/rides` + `/pass` +
  create/list kid semantics)
- Backend: `backend/modules/carpool/.../CarpoolController.java`
- Backend: `backend/modules/carpool/.../internal/CarpoolRideService.java`
  (`defaultKidIds`, create, pass)
- Web: `web/src/api/carpoolClient.ts`, `web/src/api/types.ts`
- Web: `web/src/components/calendarRideJoin.ts` (match harden)
- Web: `web/src/components/agendaFocusSelection.ts`
- Web: `web/src/components/AgendaFocusCard.tsx` (Request CTA)
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
- [x] Week at a glance / Context stay coverage-status only — no open-asks panel.
- [x] Carpool tab still lists rides; passed rides do not offer Accept to the
      passer; membership chrome unchanged.
- [x] `sharedLogic` Carpool client covers pass (+ list shape); no Android/iOS
      Agenda UI in this PR.
- [x] Architecture Clients / Forward-looking seams updated for Agenda-primary
      rides. No `CalendarItem` ride fields.
- [x] OpenAPI + backend: `defaultKidIds` / create accept **Yes + No response**
      (not No; not already accepted); create does **not** change RSVP; Accept
      sets Yes for kids on the ride; unit + integration tests would fail if
      Yes-only create gate returned or create auto-Yesed.
- [x] Web join: title+startsAt unique match wins without location equality;
      location only disambiguates collisions; tests cover FP location drift.
- [x] Agenda + Carpool tab: Request shows for No-response kids (no prior Yes);
      copy no longer tells adults to RSVP Yes first when defaults exist.
- [ ] Focus CTA precedence: pending Confirm → Accept/Pass → **Request**
      (when eligible) with Assign secondary if also uncovered → else Assign →
      calm. Component test: uncovered carpool FEED Focus shows Request.
- [ ] Architecture Rides row documents amended default-kid / Accept→Yes
      (create leaves No response).
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
- [x] Docs: architecture Team carpool Clients + Interaction UX seams / Busy
      ladder
- [x] Tests: run web lint/test, backend carpool ride suites, sharedLogic
      CarpoolClient tests — report real results
- [x] Contract: document amended create / `defaultKidIds` (Yes + No response;
      create leaves RSVP; Accept → Yes); bump `info.version`
- [x] Backend: change `defaultKidIds` + create validation; Accept sets RSVP
      Yes for ride kids; unit + integration tests
- [x] Web: harden `matchCalendarItemToRideEvent` (location disambiguate only);
      tests
- [x] Web: AgendaRow + CarpoolSpaceRides copy / Request visibility for
      No-response defaults; tests
- [ ] Web: Focus Request CTA + precedence (Assign secondary when both);
      Focus card tests
- [ ] Docs: architecture Rides default-kid / Accept→Yes wording
- [ ] Mobile sharedLogic: align types/docs if OpenAPI create/accept semantics
      change; tests if client surface changes
- [ ] Tests: web lint/test, backend carpool ride suites, sharedLogic — report
      real results

## Open questions

- None — Request leaves No response; Accept sets Yes for ride kids; Focus
  Request CTA (no Focus RSVP band); heuristic match this slice; stable
  calendar `uid`/`eventKey` → [`calendar-item-event-key`](../planned/calendar-item-event-key.md)
  (2026-08-21).
