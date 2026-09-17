# Spec: family-conflict-report

Status: draft  
Created: 2026-09-16  
Parent: [docs/roadmap.md](../../roadmap.md)  
Branch: `family-conflict-report`  
Added: 2026-09-16 · enhancement  
Depends on: [`conflict-detection`](../archive/conflict-detection.md), [`player-conflict-hero`](../archive/player-conflict-hero.md) (Done — contrast only; this slice does not amend Hero)

## Problem

When **different kids** have overlapping events (e.g. soccer vs dance at the
same time), the household must split up or lean on carpool. Today Agenda only
surfaces same-kid (`KID_TIME_OVERLAP`) and adult-coverage overlaps. Families
need a **clear, lower-urgency report** (who + which events) so the split is
visible early — without a forced Hero decision and without overloading
adult-coverage amber.

## Non-goals

- Forced pick / decline Hero (`player-conflict-hero`) — family conflicts stay
  **off** the Hero carousel / `getQueue`
- Soft travel / leave-by “cutting it close” (`conflict-travel-margin`)
- Changing adult coverage amber or CONFIRMED double-book **409**
  (`ADULT_COVERAGE_OVERLAP` / coverage writes)
- Same-feed or same-venue exclusion rules (two kids on one team practice are
  already one calendar item; an item never conflicts with itself)
- Auto-assign two drivers, auto-ask the team, or any resolve UI
- Push / email alerts
- Expo / KMP clients
- Amending ADR-0001 / Hero priority

## Approach

**Server owns truth** (same as [`conflict-detection`](../archive/conflict-detection.md)):
enrich `CalendarItem.conflicts`; clients render only.

1. **New type:** OpenAPI + backend `CalendarConflictType.FAMILY_TIME_OVERLAP`.
2. **When:** For each pair of distinct overlapping calendar items (same
   `startsAt`/`endsAt` half-open math as today), take **in-play** kid sets
   (RSVP ≠ `NO` — same filter already used for kid overlaps). If both sets are
   non-empty and **disjoint** (no shared kid), emit family conflicts. If any
   kid is shared, emit only existing `KID_TIME_OVERLAP` for those kids — **no**
   `FAMILY_TIME_OVERLAP` for that pair.
3. **Payload:** Reuse peer fields (`otherSource`, `otherItemId`, `otherTitle`,
   `otherStartsAt`). For `FAMILY_TIME_OVERLAP`, set `kidId` = local in-play kid
   and add **`otherKidId`** = peer in-play kid. Emit one conflict entry per
   `(localKid, peerKid)` Cartesian pair on **both** items. `adultId` /
   `adultDisplayName` stay null.
4. **No hard guard:** Creation and coverage writes unchanged. Family conflict is
   report-only (orthogonal to adult CONFIRMED **409**).
5. **Web Agenda:** Distinct **quieter** chrome than kid/adult amber — new
   token roles for family-conflict status lines (and chip tone when the only
   conflicts on a row are family). Copy via `conflictDisplay.ts`, e.g.
   `{localName} overlaps {peerName}'s {otherTitle}` (fallbacks when names
   missing). Do **not** reuse provisional amber / danger warning styling.
6. **Chips / week glance:** If a row’s conflicts are **only**
   `FAMILY_TIME_OVERLAP`, use the quieter tone (not amber `Overlaps`). If any
   `KID_TIME_OVERLAP` or `ADULT_COVERAGE_OVERLAP` is present, amber still wins.
7. **Hero:** Do not add a queue kind; `getQueue` / carousel ignore
   `FAMILY_TIME_OVERLAP`.

**Visual:** No destination mock for this slice. Lock quieter size/weight/color
from measured calm Agenda patterns (e.g. muted chip / secondary text) into new
`design-tokens/tokens.json` roles (e.g. `conflictFamily*`) — do not snap to
nearby amber/`hero*` roles. WCAG AA is the only hex exception.

## Context

Allowlist for `/implement`. Paths and **headings**, not whole-doc dumps.

- Architecture: [`docs/architecture.md`](../../architecture.md) → **Conflict detection (detail)**
- Contract doc: [`docs/agenda-coverage-web-contract.md`](../../agenda-coverage-web-contract.md) → **Conflict chrome (server-owned)**; week-glance / overlaps chip notes that key off `conflicts`
- Prior slices: [`conflict-detection`](../archive/conflict-detection.md); [`player-conflict-hero`](../archive/player-conflict-hero.md) (Hero exclusion contrast only)
- Contract: `contracts/openapi.yaml` → `CalendarConflictType`, `CalendarConflict`
- Backend: `backend/modules/calendar/.../CalendarConflictType.java`;
  `CalendarConflictResponse.java`;
  `internal/CalendarConflictDetector.java`;
  `internal/CalendarService.java` (in-play kid filter + enrichment)
- Web: `web/src/api/types.ts` (`CalendarConflictType` / `CalendarConflict`);
  `web/src/components/conflictDisplay.ts`;
  `web/src/components/AgendaRow.tsx` (conflict lines);
  `web/src/components/rideStatusChip.ts` / agenda status chip tone for
  `Overlaps`; week-glance conflict coloring if it treats any conflict as amber;
  `web/src/components/coverageQueue.ts` (ensure no Hero emission)
- Tokens: `design-tokens/tokens.json`
- Tests: calendar conflict detector unit tests; OpenAPI contract assert; web
  `conflictDisplay.test.ts` + Agenda row / chip tests as needed;
  `coverageQueue.test.ts` asserts family type does not produce Hero items

## Acceptance criteria

- [ ] Overlapping distinct items with **disjoint** non-empty in-play kid sets
      produce `FAMILY_TIME_OVERLAP` on **both** items (peer refs + `kidId` +
      `otherKidId`), visible on `GET …/calendar` (and enrichment paths that
      already attach `conflicts`).
- [ ] Same-kid overlap still emits only `KID_TIME_OVERLAP` for shared kids; that
      pair does **not** also get `FAMILY_TIME_OVERLAP`.
- [ ] Two kids on the **same** calendar item (typical same-team practice) do
      **not** produce a family conflict (item never pairs with itself).
- [ ] RSVP `NO` kids are excluded from family detection (same in-play rule as
      kid overlaps).
- [ ] OpenAPI enum includes `FAMILY_TIME_OVERLAP`; `CalendarConflict` documents
      `otherKidId` (required/present for family; null for existing types). Web
      hand-written types updated in the same change.
- [ ] Agenda shows quieter, distinct family-conflict status lines (who + peer
      event) — not the same amber weight as kid/adult conflicts. New token roles
      landed in `design-tokens/tokens.json`.
- [ ] Collapsed/status chip (and week-glance if applicable): family-only →
      quieter tone; mixed with kid/adult → amber still wins.
- [ ] No Hero / `getQueue` item for `FAMILY_TIME_OVERLAP`.
- [ ] Adult CONFIRMED double-book **409** and `ADULT_COVERAGE_OVERLAP` behavior
      unchanged.
- [ ] Backend unit tests cover detect cases above; web tests cover copy +
      quieter chrome / chip precedence + Hero non-emission.

## Tasks

- [ ] Backend: extend `CalendarConflictDetector` (+ response/type) for
      `FAMILY_TIME_OVERLAP` with `otherKidId`; wire through calendar enrichment
- [ ] Contract: OpenAPI `CalendarConflictType` + `CalendarConflict.otherKidId`;
      description updates; `OpenApiContractTest` assert
- [ ] Web API: hand-written `CalendarConflictType` / `CalendarConflict` in
      `web/src/api/types.ts`
- [ ] Web: `conflictDisplay` copy + Agenda conflict line styling via new tokens;
      chip / week-glance precedence for family-only vs mixed
- [ ] Web: confirm `coverageQueue` / Hero ignore family conflicts (test)
- [ ] Docs: update architecture **Conflict detection (detail)** table +
      agenda-coverage-web-contract **Conflict chrome** for family type / quieter
      chrome
- [ ] Tokens: add quieter `conflictFamily*` (or equivalent) roles; regenerate /
      consume on web
- [ ] Tests: detector unit + web display/chip/queue as listed in AC

## Open questions

_None — locked in `/spec`:_

- Detection = always report disjoint in-play different-kids overlaps (no
  same-feed exclusion)
- Type name = `FAMILY_TIME_OVERLAP` (+ `otherKidId`)
- Chrome = quieter / distinct (not kid/adult amber weight)
- Hero = off carousel
