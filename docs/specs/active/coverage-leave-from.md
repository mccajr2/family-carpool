# Spec: coverage-leave-from

Status: draft  
Created: 2026-08-12  
Updated: 2026-09-08 (`/spec` — slim Focus leave-from)  
Parent: [docs/roadmap.md](../../roadmap.md)  
Branch: `coverage-leave-from`  
Added: 2026-08-12 · enhancement

## Problem

Leave-from (and thus leave-by) is too coarse for real mornings. Adults keep a
small set of **named places** (Home, School, Community Center) and usually
leave from the default — but sometimes need a **one-time** origin (“Jack’s
house”, “playground”) that must **not** become a saved place. When two adults
take **separate cars** and **separate kids** to the same event, each
responsibility needs its own origin and leave-by. The signed-in parent needs a
**slim Focus card**: one tap to assign themselves with **default** leave-from,
plus a **subtle** way to override leave-from without expanding the day row —
and the same control in expanded Agenda. They should still see **when other
covering adults need to leave**. Today the **Route** page ignores a chosen
leave-from and always starts from the adult’s default (e.g. Home); Route must
honor the same origin.

## Non-goals

- Multi-stop teammate pickups / stop-order optimize (`carpool-route-optimize`)
- Meet-at pickup vs drop-off at a teammate house (`carpool-meet-at`)
- Changing coverage assign / confirm / decline rules (`coverage-confirm-decline`)
- Conflict amber UI or travel-margin soft warn (`conflict-detection`,
  `conflict-travel-margin`)
- Trip seat plans, vehicles, or “save one-time as named place” prompts
- Editable arrival lead times (`event-arrival-lead-time`)
- Expo / KMP clients (web only this PR)
- Restyling Calendar onto full UI-token adoption
  (`ui-system-destination-adoption`)
- Turning Focus back into a full five-band form or a heavy Leave-from field row
  on the hero — Focus stays slim; leave-from override chrome is subtle (see
  Web UX)

## Approach

### Origin modes (locked)

Each leave-from setting is one of:

| Mode | Meaning | Stored |
| ---- | ------- | ------ |
| **Default** | Resolve via membership default leave-from → first located place by name | No override (null place + null address) |
| **Named place** | A **located** circle place for this override only (does not change membership default) | `leaveFromPlaceId` |
| **One-time** | Free-text address for this override only; geocode for leave-by; **never** create/update a named place | `leaveFromAddress` (trimmed non-empty string) |

Named place and one-time are mutually exclusive. Clearing both returns to
**Default**. UI always **shows** the resolved default place name when mode is
Default (never a blank “unset” if a located default/first place exists).

### Where it attaches (locked)

1. **Per active coverage** (`PENDING` / `CONFIRMED`): when a covering adult is
   **assigned**, that row owns leave-from. New assignments start in **Default**
   (membership default → first located). **Any circle member** may change it
   (Mom plans, Dad edits). Circle-visible leave-from + leave-by so other adults
   know when that car needs to go.
2. **Item-level fallback** (per signed-in adult × item): when the signed-in
   adult has **no** active coverage on the item, keep item override (including
   one-time). Once they **do** have an active coverage, **that coverage’s**
   leave-from wins for their item `leaveFrom*` / `leaveBy*` enrichment
   (mirror).

Resolution for **signed-in adult** item leave-by:

1. Active coverage for this adult on the item → that row’s leave-from  
2. Else item override (place or one-time) → membership default → first located
   by name  
3. Else `UNAVAILABLE` / `NO_ORIGIN`

### Persistence & modules

- **Coverage origin fields** live with the assignment (coverage module): optional
  `leaveFromPlaceId` XOR optional `leaveFromAddress`. Default = both null.
- **Item override** stays in `leaveby` (`calendar_leave_from`); extend to store
  optional one-time address (place id null when one-time).
- **`leaveby`** computes estimates: named-place coords as today; one-time and
  event destinations via existing `FamilyGeocodeApi` / `geocode_cache`. Soft-fail
  geocode miss → `UNAVAILABLE` (document reason in OpenAPI). Do **not** invent
  a Place row.
- Cheap calendar list: still **no** Nominatim/OSRM HTTP. One-time / dest /
  duration use **cache-only**; miss → `PENDING` until fill-in (same contract as
  `agenda-leave-by-async`).
- Fill-in and single-item mutation responses fully enrich **item** leave-by
  **and** each **active coverage’s** leave-by on that item.

### Contract

- Extend `CalendarCoverageAssignment` with leave-from + leave-by fields
  (circle-visible).
- New (or extend) write: set leave-from on a coverage assignment — any member;
  body = place id XOR one-time address XOR clear-to-default.
- Extend item `setCalendarLeaveFrom` the same way (signed-in adult’s own
  item override only).
- OpenAPI + web clients in the same change. Bump contract version as usual.

### Web UX

- **Focus (hero) — keep slim:**
  - Primary: existing one-click **Assign to me** (or Confirm) still lands
    coverage with leave-from in **Default** — no extra step.
  - After the signed-in adult is covering: show resolved leave-from / leave-by
    as calm secondary copy (e.g. “Leave from Home · estimate 5:10”), not a
    full Agenda-style field row.
  - **Subtle override:** a low-weight control (link / menu / disclosure) on
    Focus to switch default ↔ named place ↔ one-time without opening the
    expanded day row. Prefer Hick’s law — few choices; sole located place
    stays label-only. Implementer picks the exact chrome; must stay visually
    quieter than primary CTAs.
  - This **supersedes** the Focus-addendum “leave-from only on expand” note
    for a *subtle* override only — do not restore the old form-hero.
- **Expanded `AgendaRow`:** full Leave from field-row + leave-by on each
  active coverage band (other adults’ origins visible). Item-level Leave from
  only when the signed-in adult is **not** covering that item (no duplicate
  when they are).
- One-time: short address field + apply (on Focus, inside the subtle override
  flow; on Agenda, in the field-row band); copy says **estimate**, never live
  traffic. Unlocated named places stay disabled in place choosers.
- Out of play (all kids not going): hide leave-from / leave-by / coverage chrome
  as today.

### Route page (required — not optional polish)

Accepted-ride **Route** origin must use the **same resolved leave-from** as
Agenda for the driving adult on that event:

1. Driving adult’s active coverage leave-from on the event, if any  
2. Else that adult’s item override → membership default → first located  

Changing leave-from (Focus or Agenda) must change Route’s starting stop and
leave-by estimate — Route must **not** hard-wire Home/default when an override
or coverage origin exists. No multi-stop redesign in this PR.

## Context

Allowlist for `/implement`:

- Architecture: `docs/architecture.md` → **Leave-by estimate (detail)**;
  **Coverage (detail)** (note: “Leave-from not on coverage row” is superseded
  by this spec)
- Client UX: `docs/agenda-coverage-web-contract.md` → Field rows; Leave-from
  (per item); Default leave-from; Coverage (amend for per-coverage leave-from
  + Focus leave-from)
- Focus: `docs/agenda-focus-card-addendum.md` — keep slim card; **this spec**
  allows a subtle leave-from override on Focus (not a full form band)
- Prior decisions: `docs/specs/archive/agenda-leave-by-async.md` (cheap vs
  fill-in); `docs/specs/archive/coverage-confirm-decline.md` (default leave-from
  order); `docs/specs/archive/ride-route-tab.md` (Route origin — wire coverage /
  override here)
- Source: `backend/modules/leaveby/`; `backend/modules/coverage/`;
  `backend/modules/calendar/`; Route leave-by / stop-order code under ride /
  leaveby (as used by Route tab); `contracts/openapi.yaml`;
  `web/src/components/AgendaFocusCard.tsx`; `web/src/components/AgendaRow.tsx`;
  Route detail UI; `web/src/api/familyClient.ts`;
  `docs/agenda-coverage-web-contract.md` (update in this PR)

## Acceptance criteria

- [ ] Adult can set leave-from on an **active coverage** (covering adult
      assigned) to **default**, a **located named place**, or a **one-time**
      free-text address; new coverage rows start at Default; any circle member
      may write; response returns updated `CalendarItem` with enriched coverages.
- [ ] Default mode always **displays** the resolved place name when one exists
      (membership default or first located).
- [ ] One-time address is **not** persisted as a named place; geocode soft-fails
      without failing the whole calendar response; miss yields
      `UNAVAILABLE` with a documented reason (not a fake duration).
- [ ] Two active coverages on the same item can have **different** origins and
      **different** leave-by estimates; both are visible on expanded Agenda.
- [ ] **Focus card** stays slim: Assign-to-me / Confirm still defaults leave-from;
      when covering, shows calm leave-from + estimate copy; a **subtle** override
      reaches default / named place / one-time without expanding the day row and
      without a full field-row band on the hero.
- [ ] **Expanded Agenda** exposes Leave from on coverage bands; item-level
      chooser only when the signed-in adult is not covering (no duplicate).
- [ ] Signed-in adult **with** an active coverage: item `leaveFrom*` / `leaveBy*`
      reflect that coverage’s origin.
- [ ] Signed-in adult **without** an active coverage: item-level leave-from
      still supports default / named place / one-time.
- [ ] Cheap `GET …/calendar` never calls Nominatim/OSRM for one-time or coverage
      origins; cache miss → `PENDING` until fill-in / mutation enrich.
- [ ] `GET …/calendar/leave-by` fill-in refreshes item and **coverage** leave-by
      fields for the window.
- [ ] **Route page** starting stop + leave-by use the driving adult’s resolved
      leave-from (coverage → item override → default → first located), not a
      hard-wired Home/default when an override exists; a leave-from change on
      Focus/Agenda is reflected on Route after refresh/enrich.
- [ ] Unit + integration tests for coverage leave-from write/authz/resolution,
      one-time geocode, and Route origin resolution; web tests for Focus +
      AgendaRow leave-from; `ModularityTests` pass.

## Tasks

- [x] Backend (`coverage`): Persist optional place id XOR one-time address on
      assignment; clear = default; public DTO fields; any-member set API.
- [x] Backend (`leaveby`): Item override one-time address; resolve coverage
      origins; enrich per-coverage leave-by (cheap + full); signed-in mirror
      rule; **Route / ride leave-by origin** uses same resolution (coverage →
      override → default → first located).
- [x] Backend (`calendar` / family geocode): Wire PUT(s); keep cheap-list HTTP
      ban; soft-fail one-time geocode via existing cache path.
- [x] Contract: OpenAPI for coverage leave-from fields + write body; extend
      `SetCalendarLeaveFromRequest`; examples; version bump.
- [x] Web: `familyClient` + types; **AgendaFocusCard** slim leave-from display +
      subtle override; expanded `AgendaRow` full coverage leave-from / leave-by;
      item-level fallback when not covering; **Route** UI/origin consumes
      resolved leave-from; update `agenda-coverage-web-contract.md`.
- [ ] Tests: backend unit + integration (incl. Route origin); web Focus (slim +
      override) + AgendaRow / FamilyScreen; ModularityTests.

## Open questions

_None blocking — resolved in `/spec`: one-time = free-text not saved as place;
per-coverage when covering adult assigned (default shown, editable); any-member
write; Focus stays slim (default on assign + subtle override); full editor on
expanded Agenda; Route must honor leave-from; web-first._

