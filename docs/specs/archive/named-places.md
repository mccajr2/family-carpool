# Spec: named-places

Status: done  
Created: 2026-08-07  
Updated: 2026-08-09  
Approved: 2026-08-09  
Completed: 2026-08-09  
Parent: [docs/roadmap.md](../../roadmap.md)  
Branch: `named-places`  
Added: 2026-08-07 · initial

## Problem

Leave-by and coverage need **named origins** (Mom’s house, Dad’s house,
Grandma’s, School) shared across the family circle — not a single address for
the whole household. Circles already have adults and kids, but no place list.
Without this, every later travel/coverage slice invents its own ad-hoc address
fields.

## Non-goals

- **Geocoding / lat-lng** — next slice `place-geocoding` (Nominatim + cache)
- **Routing / leave-by estimates** — `event-leave-by-estimate`
- **In-app maps**, turn-by-turn, OSM tiles, maps deep links
- **Structured address components** (street/city/postal as separate columns) —
  one free-text `address` is enough for humans + later geocode query
- **Per-adult private places** — places are **circle-scoped** and shared
- **Default leave-from**, coverage assignment, or event↔place links
- **Venue places from calendar feeds** — feeds / events later
- **Organizer-only place writes** — **any member** may manage places (unlike kids)
- **OpenAPI codegen** — hand-written clients stay the pattern

## Approach

Extend the Modulith **`family`** module (no new module). Places belong to the
caller’s circle, same membership gate as reading kids.

**Model (this PR):**

| Field | Notes |
|--------|--------|
| `id` | Stable id |
| `circleId` | Owning family circle |
| `name` | Short label (“Mom’s house”) — required, trimmed, non-blank; **unique per circle** (case-insensitive) |
| `address` | Free-text address — required, trimmed, non-blank |
| *(no lat/lng)* | Added in `place-geocoding` |

**Cardinality:** zero places allowed; no hard cap in this PR. **Place `name` is
unique per circle** after trim, compared case-insensitively (e.g. “Mom’s house”
and “mom’s house” conflict). Distinct labels for distinct sites (“Lincoln ES” vs
“West MS”). Hard delete on remove (no soft-delete).

**Authorization:**

- **Any circle member** (Organizer or Caregiver) may create / update / delete
  places and see them on circle GET.
- Non-member → **404** (no leak). Unauthenticated → **401**.
- Kids / invite / roles / circle rename stay Organizer-only (unchanged).

**Contract:** add place schemas and `/api/family/circle/places` (+ `/{placeId}`)
under Bearer; extend `FamilyCircle` GET with a `places` array (parallel to
`kids`). Document blank name/address as **400**; create/rename that collides on
per-circle name uniqueness as **409**.

**Clients:** hand-written web + `sharedLogic` clients; web + Android + iOS show
a places list on the family surface with add / edit / remove for every member
(not Organizer-gated). Empty list is fine.

**Docs:** note in `docs/architecture.md` that places are circle-scoped, any
member may write, and coords arrive in `place-geocoding`.

## Acceptance criteria

- [x] OpenAPI documents place create/update/delete and includes `places` on
      circle GET; Bearer on all; blank/missing `name` or `address` → **400**;
      duplicate place name in the same circle → **409**.
- [x] Authenticated **Organizer or Caregiver** can **add** a place (`name` +
      `address`), **rename/edit** either field, and **delete** a place; GET
      circle lists places for that circle.
- [x] Creating or renaming to a name that another place in the same circle
      already uses (trim + case-insensitive) → **409**; renaming a place to its
      own current name (same spelling/casing after normalize) succeeds.
- [x] Circle may have **zero** places; unknown `placeId` or place in another
      circle → **404** (no leak).
- [x] Unauthenticated place calls → **401**; adult with **no** membership →
      **404** on place endpoints.
- [x] Caregiver place writes succeed (regression: kids write still Organizer-only
      **403** for Caregiver).
- [x] Responses include place `id`, `name`, and `address` only — **no** lat/lng
      fields in this PR.
- [x] Web, Android, and iOS: signed-in members can list / add / edit / remove
      places on the family UI; errors surfaced.
- [x] Backend unit + integration tests cover place CRUD + Caregiver write +
      authz; client tests cover new API paths; `ModularityTests` still green.

## Tasks

- [x] **Backend:** Flyway table for circle places (`id`, `circle_id`, `name`,
      `address`) with a uniqueness strategy for per-circle names (DB unique
      index on normalized name, or equivalent service check + test); entity/repo;
      `FamilyService` CRUD for any member; extend circle GET mapping; controller
      endpoints; 400 for blank fields; 409 on name collision.
- [x] **Contract:** OpenAPI place request/response + paths; `FamilyCircle.places`;
      document 409 on duplicate name; bump info version as usual.
- [x] **Web:** `familyClient` + types; `FamilyScreen` places section (all
      members); tests.
- [x] **Mobile:** `FamilyModels` / `FamilyClient` + tests; `FamilyUiModel` /
      `FamilyScreen` (Android shared UI); iOS `AuthViewModel` / `ContentView`
      (or equivalent) places CRUD.
- [x] **Docs:** `docs/architecture.md` Places row + link diagram note.
- [x] **Tests:** service unit + controller integration for Caregiver write,
      Organizer write, 401/404, blank validation, **duplicate-name 409**;
      `OpenApiContractTest` paths; web + KMP client tests.

## Open questions

_None blocking — resolved in `/spec`: any member writes; free-text address;
unique names per circle; lat/lng deferred to `place-geocoding`._

## Locked in this spec

| Topic | Decision |
|--------|----------|
| Scope | Circle-shared named places: label + free-text address |
| Writes | **Any member** (Organizer or Caregiver) |
| Name uniqueness | **Unique per circle** (trim + case-insensitive); conflict → **409** |
| Coords | **Out** — `place-geocoding` |
| Address shape | Single `address` string (not structured components) |
| Kids authz | Unchanged (Organizer-only) |
