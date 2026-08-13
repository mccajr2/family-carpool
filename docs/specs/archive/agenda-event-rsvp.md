# Spec: agenda-event-rsvp

Status: done  
Created: 2026-08-13  
Approved: 2026-08-13  
Updated: 2026-08-13 (`/pr`)  
Parent: [docs/roadmap.md](../../roadmap.md)  
Branch: `agenda-event-rsvp`  
Added: 2026-08-13 · enhancement

## Problem

Agenda treats every kid on every event as still in play. Adults cannot record
**whether a kid is going**, so leave-by, coverage, and “needs coverage” stay
noisy for practices nobody is attending. Later carpool seat counts and team
rollups need the same fact — **Yes / No / No response** per kid — not an
implied “going.” Coverage already answers who is responsible; it does not
answer attendance.

## Non-goals

- Carpool request/accept, team spaces, or team-wide RSVP rollup UI
  (`team-carpool-space-invite`, `carpool-request-accept`)
- Coach / parent-only attendance (adult at the event with no kid going)
- Writing RSVP back to iCal vendors or coach/league apps
- Hiding or deleting the event from the schedule
- A fourth RSVP choice (“I’ll cover”) or merging RSVP + coverage into one
  picker (see Flattening)
- Suspended / zombie coverage while a kid is No (hard-release only)
- Changing leave-by math, cheap-list isolation, or fill-in
- Changing coverage assign/confirm/decline rules for kids who are still in
  play (Yes or No response)
- Travel-margin warns, per-coverage leave-from, arrival lead times
- Restyling Calendar onto shared UI tokens (`ui-system-destination-adoption`)
- OpenAPI codegen — hand-written clients stay the pattern
- Playwright e2e (not in toolchain; web Agenda component tests cover the flow)

## Approach

### Domain split (locked)

| Concern | Answers | This PR |
| ------- | ------- | ------- |
| **RSVP** | Is this **kid** going to this event? | Yes |
| **Coverage** | Which adult is **responsible** for which in-play kids? | Unchanged, plus coupling below |
| **Carpool / trip** | Driver, seats, teammates | No |

RSVP is **per kid + calendar item** (`MANUAL` \| `FEED` + item id),
**circle-visible**. Any circle member may set it. Coach-only attendance stays
out of scope.

### States (locked)

`YES` \| `NO` \| `NO_RESPONSE`

- Missing row ≡ `NO_RESPONSE`. Do not insert Yes by default.
- `PUT NO_RESPONSE` deletes the row.
- `PUT YES` / `PUT NO` upserts.
- Strings: **Yes** / **No** / **No response**.

### In play vs out of play (locked)

A kid is **out of play** only when RSVP is **No**. Yes and No response stay
**in play** (coverage and leave-by still apply).

| Item | Row chrome |
| ---- | ---------- |
| One kid, and that kid is No | **Out of play:** deemphasize; hide dependent controls |
| 2+ kids, **all** No | Same |
| Any kid Yes or No response | **In play.** Per-kid controls for a No kid are off; Yes / No response kids stay fully usable |

**Dependent controls** (hide when the row is out of play): leave-by, leave-from,
Open Places, coverage lines, needs-coverage, Assign / Confirm / Decline,
conflict amber. **Keep:** title, when, location, kid names, **RSVP** (so they
can undo), manual **Edit / Remove**.

Deemphasize with muted foreground / reduced contrast on the item. No new inner
card, muted band, or bordered subsection (selection A).

### Flattening (locked) — two records, one common shortcut

Do **not** merge RSVP and coverage into one picker. Attendance and
responsibility are different facts; “someone else covers” and later carpool
both need them. Adding “I’ll cover” as a fourth RSVP option duplicates Assign
coverage and fails Hick.

The two cases are already two actions:

1. **Yes, figure out rides later** → set RSVP **Yes** only (uncovered).
2. **Yes, I’ll take him** → existing **Assign coverage** (self default,
   auto-CONFIRMED). That write **sets RSVP Yes** for those kids.

**Coupling (server, calendar orchestrates):**

- Assign / reassign / confirm coverage → `ensureYes` for those kids (No
  response becomes Yes; already-Yes unchanged). Cannot assign a **No** kid
  (**400**).
- Decline or remove coverage → RSVP unchanged.
- `PUT` No (or No response) while the kid is on an active (`PENDING` \|
  `CONFIRMED`) row → **hard-release**: drop that kid from the row; delete the
  row if empty. Changing back to Yes / No response does **not** restore the
  assignment; they return to the uncovered pool.

**Client confirm** only when that kid is on an active coverage row, before
`PUT` No or No response. Copy:
`This will remove coverage for {kidName}.`
Not a generic “Are you sure?” No confirm when there is no coverage to lose.
Confirm is client-only; the API always releases (no two-phase flag).

### `uncoveredKidIds` and conflicts

- **Uncovered** = in-play kids (Yes or No response) not on an active coverage
  row. **No kids are never uncovered** and never assignable.
- **Kid time-overlap:** ignore No kids (not attending → overlap is not
  actionable). Yes / No response still amber as today.
- Adult coverage overlap and double-CONFIRMED **409** unchanged (No kids
  cannot remain on active rows).

### Module / API

New Modulith module **`rsvp`**: persistence + per-kid status; public `RsvpApi`.
**`calendar`** orchestrates HTTP and enrichment (same pattern as coverage /
leave-by). **`coverage`** gains a public **release kid from active rows**
helper; it does not import rsvp internals. No rsvp ↔ coverage cycle.

**Contract (OpenAPI bump; web + Android + iOS same change):**

- Extend `CalendarItem` with `rsvps`: one entry per item kid
  (`kidId` + `status`). Materialize `NO_RESPONSE` when no row exists.
- `PUT /api/family/circle/calendar/{source}/{itemId}/rsvps/{kidId}`
  body `{ status }`; any member; returns the enriched `CalendarItem`.
  Kid not on item → **400** / **404**. Cheap list includes RSVP (DB only).

When a kid is removed from a manual event or feed link, delete that RSVP row.

### Clients (web + Android + iOS)

Web is the reference — extend
[`docs/agenda-coverage-web-contract.md`](../../agenda-coverage-web-contract.md).
iOS/Android match decisions and strings.

- People / source band: each kid is a **field row** (name leading, RSVP
  chooser trailing: No response / Yes / No).
- Assign checkboxes / implicit sole kid only include **uncovered** (in-play)
  kids.
- Out-of-play row: deemphasize + hide dependent controls; RSVP stays.
- Patch the client calendar cache on RSVP writes like other single-item
  mutations.
- Busy: RSVP save uses the shared Agenda busy flag; buttons disable; Load more
  still owns “Loading…”. Sign out label unchanged.

## Acceptance criteria

- [x] OpenAPI bumped; `rsvps` on `CalendarItem` + PUT endpoint documented;
      assign/confirm descriptions note they set RSVP Yes and reject No kids;
      web + Android + iOS clients updated in the same change.
- [x] Any member can set a kid on an item to Yes, No, or No response; missing
      row reads as No response; kid not on item → 400/404.
- [x] One-kid item with that kid No (or every kid No) → row deemphasized;
      leave-by / leave-from / coverage / assign / confirm / decline / conflict
      chrome hidden; summary + RSVP + manual Edit/Remove remain.
- [x] Mixed Yes/No (or No response/No): row stays in play; No kid omitted from
      assign / uncovered / that kid’s coverage controls; Yes / No response
      kids unchanged.
- [x] Assign / reassign / confirm sets those kids to Yes; assigning a No kid
      → **400**. Decline / remove coverage does not change RSVP.
- [x] PUT No or No response while the kid has active coverage: client confirm
      (`This will remove coverage for {kidName}.`); server hard-releases;
      flipping back does not restore the assignment. No confirm when uncovered.
- [x] `uncoveredKidIds` excludes No kids; needs-coverage copy follows that
      list. Kid time-overlap ignores No kids. Cheap calendar GET never calls
      Nominatim/OSRM and includes `rsvps`.
- [x] No carpool/team rollup UI; no vendor RSVP sync; no “I’ll cover” RSVP
      option.
- [x] `ModularityTests` green; unit + integration tests for RSVP writes,
      coverage coupling, uncovered/conflicts, and authz.
- [x] `docs/architecture.md` and the Agenda web contract updated.

## Tasks

- [x] **Backend (`rsvp`):** New module + migration; entity/repo; `RsvpApi`
      get-for-items / upsert / delete-on-NO_RESPONSE; missing ≡ No response;
      delete when kid leaves the item.
- [x] **Backend (`coverage`):** Public release-kid-from-active-rows (drop kid;
      delete empty row). Assign/reassign still 400 on empty / not-on-item /
      exclusivity.
- [x] **Backend (`calendar`):** Enrich `rsvps`; `uncoveredKidIds` skips No;
      kid-overlap ignores No; PUT RSVP endpoint; orchestrate coverage writes
      → `ensureYes` and reject No kids; RSVP No/No response → release then
      save.
- [x] **Contract:** OpenAPI RSVP fields + PUT; bump version; coverage
      operation descriptions.
- [x] **Web:** Per-kid RSVP field rows; out-of-play chrome; confirm dialog;
      assign implies Yes in UI after response; cache patch; tests.
- [x] **Android (`sharedLogic` / `sharedUI`):** Same surfaces + tests.
- [x] **iOS:** Same surfaces + tests.
- [x] **Docs:** `docs/architecture.md`; `docs/agenda-coverage-web-contract.md`.
- [x] **Tests:** Service unit + API integration; ModularityTests; web + mobile
      coverage of one-kid No, mixed, confirm-on-release, assign→Yes.

## Open questions

None blocking — locked in `/spec` discussion:

| Topic | Decision |
| ----- | -------- |
| Cardinality | Per kid + item, not per adult; coach-only attendance out |
| States | Yes / No / No response; no implicit Yes |
| Chrome | Out of play when all kids No; mixed keeps row in play; per-kid attrs off for No |
| Coverage on No | Client confirm + server hard-release; no suspend/restore |
| Flattening | Two records; Assign/confirm implies Yes; no fourth RSVP choice |
| Who writes | Any circle member |
| Conflicts | No kids excluded from kid time-overlap |
