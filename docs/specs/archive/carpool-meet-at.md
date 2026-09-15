# Spec: carpool-meet-at

Status: done  
Parent: [docs/roadmap.md](../../roadmap.md)  
Created: 2026-08-14  
Added: 2026-08-14 · enhancement  
Promoted: 2026-09-08 · carpool Beta  
Updated: 2026-09-15 · `/spec` — declare who meets where; no radius match  
Branch: `carpool-meet-at`

## Problem

Ask the team still assumes the teammate driver meets the kids at the
**requester’s** family-side place. Often the plan is the other way: the
requester brings kids to the **driver’s** start before leave-by, or collects
them later from the driver’s place after the event. Until each asked leg can
say **whose place** is the meet point — and Accept binds the driver’s place
when that is chosen — neither side can read a plan they can actually run.

## Non-goals

- Radius / distance matching of candidate drivers (deferred; no new id yet)
- Agreed early/late clocks (“drop by 4:15”) — parking
  `carpool-early-late-window` (use existing leave-by **estimates** only)
- Changing household Confirm / Assign place editors (already
  [`carpool-leg-places`](../archive/carpool-leg-places.md))
- Inventing a second address model (reuse circle named places + one-time)
- Stop-order optimize (`carpool-route-optimize`)
- Driving blocks (`day-block-*`)
- Least-privilege address hiding — parking `carpool-least-privilege`
  (Accept may expose the bound accepter address to space members, same PII
  spirit as today’s pickup snapshot)
- Live maps / navigation, Expo / push / KMP UI

## Approach

**Web-first** OpenAPI + carpool Accept/list/detail + DriverPicker Ask chrome.
Reuse per-leg family-side places from
[`carpool-leg-places`](../archive/carpool-leg-places.md). This slice only adds
**whose place** on **Ask the team** legs.

### Meet side (locked)

Each **ASK_TEAM** TO / FROM leg stores a meet side:

| Side | Meaning |
| ---- | ------- |
| **REQUESTER** (default) | Meet at the requesting circle’s family-side place (existing triad: Default / named / one-time). TO = accepter picks up there; FROM = accepter drops off there. |
| **ACCEPTOR** | Meet at the accepting driver’s place. Place triad empty while `PENDING`. On **Accept**, bind that leg’s family-side place from the accepting adult’s resolved leave-from (same order as Default: membership **My default leave-from**, else first located by name). If Accept cannot resolve a place → **400**. |

Household / `NEEDS_RIDE` legs do not use meet side (omit or ignore).

### Clarity both sides (product copy intent)

**TO + REQUESTER:** requester stays put; accepter sees pickup at requester
place (PickupLine / detour as today).

**TO + ACCEPTOR:** after Accept, requester sees drive kid(s) to **{accepter
place name + address}** (leave-by estimate stays the driver’s timing cue —
not a new negotiated window); accepter sees no requester pickup stop for that
leg (kids arrive at their place).

**FROM + REQUESTER:** traditional drop-off at requester place; requester knows
ride home is covered.

**FROM + ACCEPTOR:** after Accept, drop-off / meet is accepter place; requester
knows they collect kids later from there; Route uses that bound place for the
FROM family-side stop.

### Editors (web)

When a leg (or simple round-trip Ask) is **Ask the team**:

1. **Meet where?** — two choices: **Our place** (`REQUESTER`) / **Driver’s
   place** (`ACCEPTOR`). Default **Our place**.
2. **Our place** → existing `LeaveFromControls` (simple: one Leave from for
   both legs when both Ask + REQUESTER; split / kid-split: per-leg as today).
3. **Driver’s place** → hide the place picker for that leg; short helper copy
   that the address appears after someone Accepts.

Simple round-trip Ask: independent meet side for Getting there vs Coming back
(two compact controls — not a radius wizard). Split / kid-split: same control
under each Ask leg.

Primary labels stay close to today (`Post to team — …` / **Save ride plan**);
include meet intent in button or helper text only when needed for Hick clarity.

### Persistence / Accept / Route

- Flyway: meet-side column on leg slots (default `REQUESTER` for existing
  rows).
- Create / Save: persist meet side; `ACCEPTOR` legs skip requester place
  resolution (no Ask **400** for missing TO pickup when TO is `ACCEPTOR`).
- Ride-level `pickupPlaceName` / `pickupAddress`: from TO when TO is
  `REQUESTER`; when TO is `ACCEPTOR` and still pending, null or explicit
  “Driver’s place” display without a street address; after Accept, from the
  bound accepter place.
- Accept: for each asked open leg with `ACCEPTOR`, bind place from accepter;
  rebuild Route stops (omit requester pickup when TO is `ACCEPTOR`; FROM
  `ACCEPTOR` uses bound drop-off).
- Withdraw / Cancel: no special place rewrite beyond today’s clear rules.
- Inbound `detourMinutes` / PickupLine: only when TO meet side is `REQUESTER`
  (or bound requester pickup exists); soft-omit when meet is at driver’s place.

### Contract

OpenAPI version bump + web clients same change; KMP untouched:

- Extend `CarpoolRideLeg` (+ Save / create ask bodies) with meet side enum
  (`REQUESTER` \| `ACCEPTOR`).
- Document Accept bind + Ask **400** when `ACCEPTOR` Accept cannot resolve
  accepter leave-from.
- Update `docs/agenda-coverage-web-contract.md` Ask / place bullets.
- Update `docs/architecture.md` Team carpool **Rides** / **Out of scope**
  (meet side in; radius match still out).

## Context

Allowlist for `/implement`:

- Prior sketch / split notes: this file’s history; place triad locked in
  [`docs/specs/archive/carpool-leg-places.md`](../archive/carpool-leg-places.md)
- Web Ask chrome: `docs/agenda-coverage-web-contract.md` → Leave-from /
  DriverPicker / Ask the team bullets
- Architecture: `docs/architecture.md` → Team carpool **Rides** / **Out of
  scope**; Family circle **Place** / default leave-from
- Contract: `contracts/openapi.yaml` → `CarpoolRideLeg`,
  `SaveCarpoolRidePlanLeg`, ride pickup fields, Accept
- Source: `backend/modules/carpool/.../CarpoolRideService.java` (create /
  Save / Accept / Route upsert); leg entity + Flyway;
  `web/src/components/DriverPicker.tsx`, `LeaveFromControls`,
  `PickupLine` / inbound rows; `web/src/api/carpoolClient.ts` + `types.ts`

## Acceptance criteria

- [x] Ask create / Save persists per-leg meet side (`REQUESTER` default);
      re-GET list/detail returns it on asked legs.
- [x] `REQUESTER` Ask legs still require a resolvable family-side place (TO
      Ask **400** when unresolved); `ACCEPTOR` Ask legs may post without a
      requester place.
- [x] Accept on a `PENDING` ask with TO and/or FROM `ACCEPTOR` binds those
      legs’ place name/address from the accepting adult’s resolved leave-from;
      Accept **400** if that cannot resolve; re-GET shows the bound place to
      requester and accepter.
- [x] After Accept with TO `ACCEPTOR`, accepter Route / pickup list has **no**
      requester-house pickup stop for that ride; requester own-ride chrome
      shows the bound driver place as where to bring kids.
- [x] After Accept with FROM `REQUESTER`, drop-off stays at requester place;
      with FROM `ACCEPTOR`, FROM family-side stop is the bound accepter place.
- [x] Inbound PickupLine / detour run only when there is a requester pickup
      (TO `REQUESTER`); driver’s-place asks do not show a fake pickup detour.
- [x] Web DriverPicker (simple + split + kid-split Ask legs): **Our place** /
      **Driver’s place**; place picker only for Our place; defaults Our place.
- [x] OpenAPI documents meet side + Accept bind; web clients updated same
      change; KMP untouched.
- [x] Agenda coverage web contract + architecture Rides / Out of scope
      updated (meet side in; radius match still out).
- [x] Unit + integration tests cover Save/read meet side, Accept bind,
      Accept **400** without accepter place, and no requester pickup stop for
      TO `ACCEPTOR`; web component tests cover the Meet where? control
      (would fail if ignored).

## Tasks

- [x] Backend: Flyway meet-side column; entity + create/Save/list/detail;
      Accept bind for `ACCEPTOR`; pickup derivation + Route stops; detour
      skip when no requester pickup
- [x] Contract: OpenAPI meet side on leg + Save/create; version bump; Accept
      bind / **400** docs
- [x] Web: `carpoolClient` / types; DriverPicker Meet where? on Ask paths;
      own-ride + inbound copy for both sides; PickupLine gate
- [x] Docs: `agenda-coverage-web-contract.md`; `architecture.md` Rides /
      Out of scope
- [x] Tests: `CarpoolRideServiceTest` + controller integration (meet side,
      Accept bind, **400**); DriverPicker / FamilyScreen (or Agenda)
      component tests for Meet where?

## Open questions

- None blocking. Exact button label wording can tighten in implement against
  existing `coverageCopy` patterns. Radius matching stays a future roadmap
  add if dogfood asks for it.
