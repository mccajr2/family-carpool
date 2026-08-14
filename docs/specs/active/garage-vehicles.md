# Spec: garage-vehicles

Status: in-progress  
Created: 2026-08-07  
Updated: 2026-08-14 (`/implement` backend)  
Approved: 2026-08-14  
Parent: [docs/roadmap.md](../../roadmap.md)  
Branch: `garage-vehicles`  
Added: 2026-08-07 · initial

## Problem

Team carpool spaces exist, but the household has no **garage**: no vehicles,
no seat counts, and no way for an adult to say **I don’t drive**. A circle is
not one driveway — Mom and Dad may share two cars at one house, Grandma and
Grandpa may each have a car at another house that the other does not drive,
and a nanny may have a car only she drives. Ride request/accept cannot do
seat math, or know who is allowed to take which car, without this.

## Non-goals

- **Ride request / accept / seat updates on a trip** — next slice
  `carpool-request-accept` (this PR only stores capacity)
- **Assigning a vehicle to a coverage row or a specific event**
- **Paid vehicle-data providers** (Chrome Data, Edmunds, etc.)
- **Driver-only role** — parking `driver-only-role`
- **VIN** — users never enter, see, or store a VIN
- **Kid vs adult vs booster seat kinds** — parking `garage-seat-kinds` (v1 is
  one total capacity including the driver)
- **Inferring who can drive from a named place** — same house ≠ shared cars
  (Grandma/Grandpa). Drivers are an explicit list
- **Insurance, license plate, color, photos, fuel, EV**
- **Teammate (other-circle) visibility** of garage — circle-internal only;
  team-space roster/PII stays parked `carpool-least-privilege`
- **In-app maps**, live traffic, or treating garage as a rideshare fleet
- **Restyling Carpool / Agenda onto extra UI tokens** —
  `ui-system-destination-adoption` (Garage lives under More; use existing More /
  Places patterns)
- **OpenAPI codegen** — hand-written clients stay the pattern
- **Playwright e2e** (not in toolchain)

## Approach

Extend the Modulith **`family`** module (no new module — same cut as places).
Garage is **circle-visible**. A vehicle is **not** 1:1 with an adult.

**Driving flag:** `drives` on the membership (default **true**). `false` means
“I don’t drive.” They stay a full Caregiver. This slice does not change
carpool join/enable. Empty owned list + `drives=true` is valid (haven’t added
a car yet; they may still be listed as a driver on someone else’s). Toggling
`drives` does **not** delete vehicles or strip driver lists (request/accept
will ignore `drives=false` adults later).

**Who may drive (required for v1):** each vehicle has an **owner** (creator;
only they edit/delete) and **`driverAdultIds`** — circle members allowed to
take that car. Owner is always a driver and cannot be removed. Default on
create: **just the owner**. Adding other members is explicit (Mom adds Dad to
both shared cars; Grandma does not add Grandpa; Nanny adds no one). Same
named place does **not** imply shared drivers.

**Worked example (one circle):**

| Vehicle | Owner | Drivers | Kept at (optional) |
|---------|--------|---------|--------------------|
| Blue van, Honda | Mom | Mom, Dad | Mom’s house |
| Camry | Grandma | Grandma | Grandma’s house |
| Truck | Grandpa | Grandpa | Grandma’s house |
| Civic | Nanny | Nanny | (unset or Nanny’s place) |

**Vehicle model:**

| Field | Notes |
|--------|--------|
| `id` | Stable id |
| `circleId` + `ownerAdultId` | Owner; cascade-delete **owned** vehicles when that adult leaves / is removed. If a **driver** (not owner) leaves, drop them from `driverAdultIds` only |
| `driverAdultIds` | 1+ circle adult ids; **must include owner**; no duplicates; all must be current members. Default `[owner]` |
| `keptAtPlaceId` | Optional circle named place (where the car lives). Does **not** grant driving rights. Default: creator’s **default leave-from** when set, else unset |
| `label` | Nickname (“Blue van”) — required, trimmed, non-blank; **unique per owner in the circle** (case-insensitive) |
| `year` | Required; integer **1996–(current calendar year + 1)** (vPIC model lists are year ≥ 1996) |
| `make` | Required; vPIC make name from the garage makes list |
| `model` | Required; vPIC model name from the garage models list for that make+year |
| `seats` | **Total seating capacity including the driver**. Required integer **2–18**. Source of truth; always overridable. Request/accept will subtract driver + own occupants later — not this PR |
| `suggestedSeats` | Nullable last vPIC hint; never overwrite `seats` unless the client sends the new value |

No VIN column. No hard cap on vehicle count. Hard delete (no soft-delete).

**NHTSA vPIC (free, no key) — server-side only:**

Clients never call NHTSA. A `VpicPort` (HTTP adapter in prod/dev; **fake in
unit tests**) backs:

1. **Makes** — `GetAllMakes` (cache). Optional year filter is a client
   convenience; models are year-scoped.
2. **Models** — `GetModelsForMakeYear/make/{make}/modelyear/{year}`.
3. **Seat hint** — `POST .../garage/suggest-seats` `{ year, make, model }` →
   **200** with nullable `seats` (null on miss, never 4xx/5xx for a miss).
   vPIC exposes `Seats` on decode, not on the make/model list. The port may
   use **WMI + year partial decode internally** (or an equivalent vPIC method)
   to read `Seats` when it matches that make/model. **Never collect or store
   a VIN.** Prefer the decode whose `Model` matches; if several seat values
   appear, pick the most common parseable int in 2–18; if none, null.

**Soft-fail:** timeout, HTTP error, incomplete decode, or empty `Seats` → no
hint; create/update still succeeds with the client’s `seats`. Never 5xx for a
miss.

**Cache:** table keyed by normalized `(make, model, year)` → seats +
`fetched_at`; plus short-TTL/cache for make and model lists. Identifying
User-Agent (same spirit as Nominatim / feeds). Respect vPIC rate control;
prefer cache hits. Do **not** add a vehicle SDK / npm wrapper.

**Retry** on a saved vehicle: `POST .../vehicles/{id}/suggest-seats` returns
the hint; does **not** overwrite `seats` unless the client PUTs.

**Authorization:**

- **GET** garage: any circle member sees **all vehicles** (with owner +
  drivers + optional place) and every member’s `drives` flag. Non-member →
  **404**. Unauthenticated → **401**.
- **PATCH** `drives`: **own flag only**.
- Vehicle CRUD + driver-list + kept-at place: **owner only**. Non-owner
  (including a listed driver) → **404**. Organizer cannot edit Grandma’s cars.
- `driverAdultIds` on write: unknown / non-member / missing owner → **400**.
  `keptAtPlaceId` not in this circle → **400**.
- Makes / models / suggest-seats: any circle member (**401** / **404** same as
  other family reads).
- Leave / Organizer-remove member: delete vehicles **they own**; remove them
  from other vehicles’ driver lists.

**Contract:** new `/api/family/circle/garage*` paths under Bearer; bump OpenAPI
`info.version`. Document 400 (blank label, seats/year range, missing
make/model, invalid drivers/place), 409 (duplicate label **for that owner**).
GET returns a flat `vehicles` array (not nested only under the owner) plus
member `drives` flags. Public **`FamilyGarageApi`** (circle garage snapshot,
including who may drive each car) so `carpool-request-accept` does not import
`family.internal`.

**Clients:** More / Settings → **Garage** row under General (next to Places),
all members (not Organizer-gated). Hick: one primary **Add vehicle** when the
signed-in adult’s `drives` is true; **I don’t drive** toggle at the top of my
section (copy: they can still request rides later). Add-vehicle flow:
**year → make → model**, suggest fills seats (overridable), nickname required;
**Who can drive this?** defaults to me only — add other circle members
explicitly (not “everyone at this place”); optional **Kept at** place
(preselect default leave-from when set). List: group by kept-at place, then
“Other”; each row shows “Driven by …” (display names). Edit/delete only on
cars you **own**; cars you can drive but don’t own are visible, not editable.
Empty: short hint to add a car or mark don’t drive. Errors surfaced. Add
semantic icon `icon.garage` (web Lucide `Warehouse`; Android garage/car-side;
iOS SF `door.garage.closed` or equivalent).

**Docs:** architecture — owner + driver list (not 1:1 adult→car; place ≠
share), including-driver seats, make/model/year vPIC hint (no VIN); README
smoke: add a vehicle, add a second driver, toggle don’t drive.

## Acceptance criteria

- [ ] OpenAPI documents garage GET, PATCH `drives`, vehicle create/update/delete,
      makes, models, suggest-seats (by year/make/model and by saved id); Bearer
      on all; blank label / missing make/model / year outside range / seats
      outside 2–18 / driver list missing owner or non-member / unknown place →
      **400**; duplicate label for the same **owner** → **409**. **No VIN**
      in schemas or paths.
- [ ] Authenticated member **GETs** the circle garage: every member’s `drives`
      (default true) and a **flat vehicle list** with owner, `driverAdultIds`,
      optional `keptAtPlaceId`. Non-member → **404**; unauthenticated → **401**.
- [ ] A member can **PATCH own `drives`**. Setting false does not delete
      vehicles or driver lists and does not change role. Other adult’s `drives`
      cannot be patched (**404**).
- [ ] A member can **add / edit / delete vehicles they own** (`label` + `year`
      + `make` + `model` + `seats` required; `driverAdultIds` default
      `[owner]`; optional place). Listed driver who is not the owner → **404**
      on write. Caregiver and Organizer have the same garage write rules.
- [ ] Owner can add another circle member as a driver (shared household cars)
      and can omit them (Grandma/Grandpa / nanny personal cars). Place does not
      auto-add drivers.
- [ ] Makes and models lists come from vPIC via the backend (fake port in
      tests). Suggest-seats for a known year/make/model returns parseable
      seats from the port when available; miss returns **200** with null
      `seats`. Client `seats` on create/update is kept even when a hint
      differs (overridable).
- [ ] Unit tests never call live vPIC; cache is used for the same normalized
      make/model/year. Integration tests use a fake/stub port.
- [ ] Adult **leave** or Organizer **remove** deletes vehicles they **own**
      and removes them from other vehicles’ driver lists.
- [ ] Web + Android + iOS: More → Garage; own don’t-drive toggle + Add
      vehicle; year → make → model then suggested seats (editable); **who can
      drive** (default me); optional kept-at place; list grouped by place with
      driver names; edit only if owner; no VIN field; errors surfaced;
      Caregiver sees Garage (not Feeds).
- [ ] Backend unit + Testcontainers integration cover authz, uniqueness,
      seats/year range, driver-list 400s, suggest soft-fail, leave cascade
      (owned vs driver-only); client tests cover API + Garage UI (don’t-drive
      hides Add; non-owner read-only; default drivers = me; no VIN);
      `ModularityTests` green.

## Tasks

- [ ] **Backend:** Flyway `drives` on membership (default true) +
      `family_vehicles` (owner, optional place, no VIN) + vehicle-drivers
      join + vPIC cache table; `VpicPort` + adapter (makes, models, seat
      hint); garage service/controller; leave/remove cascade (owned delete +
      driver unassign); public `FamilyGarageApi`; fake port for tests.
- [ ] **Contract:** OpenAPI garage schemas/paths; bump version; description
      notes including-driver seats and make/model/year hints (no VIN).
- [ ] **Web:** types + `familyClient` garage methods; More → Garage screen;
      year/make/model + overridable seats; who-can-drive; kept-at place;
      `icon.garage`; tests.
- [ ] **Mobile:** `sharedLogic` models/client; `sharedUI` Garage panel +
      More row; Android via sharedUI; iOS AuthBridge / ContentView; script
      tests as elsewhere.
- [ ] **Tokens:** add `icon.garage` to `design-tokens/tokens.json` +
      `docs/ui-system.md` mapping; regenerate checked-in outputs.
- [ ] **Docs:** `docs/architecture.md` garage row + write policy; README
      smoke.
- [ ] **Tests:** backend unit + integration; web + sharedLogic/sharedUI;
      `ModularityTests`; token generate `--check` if icons change.

## Open questions

_None blocking._ Seat kinds (adult / kid / booster) are parked as
`garage-seat-kinds`. Same-house adults who share cars must opt in per vehicle
(no “share with household” shortcut in v1).

## Decisions locked in `/spec`

| Topic | Choice |
|--------|--------|
| Module | **`family`** (not a new garage module) |
| Visibility | **Circle-visible** read; **owner-only** writes |
| Don’t drive | Membership `drives` boolean, default **true**; not a new role |
| Sharing | Explicit **`driverAdultIds`** (owner always included). Place / house does **not** imply sharing |
| Kept at | Optional named place for grouping; default leave-from when set |
| Identity | **Year + make + model** from vPIC lists; nickname `label`; **no VIN** |
| Seats | **One total capacity including driver**; 2–18; always overridable |
| NHTSA | Server-side vPIC only; seat hint from make/model/year (internal decode OK); soft-fail; no paid APIs; no SDK |
| Seat kinds | **Out** — `garage-seat-kinds` |
| UI | More / Settings → **Garage** (not Carpool tab, not Family kids list) |
| Clients | Web + Android + iOS in this PR |
| Trip seat math | **Not this PR** — `carpool-request-accept` |
