# Spec: garage-retire

Status: draft  
Created: 2026-09-10  
Parent: [docs/roadmap.md](../../roadmap.md)  
Branch: `garage-retire`  
Added: 2026-09-10 · enhancement

## Problem

Household garage (vehicles, seats, `drives`, vPIC/NHTSA) shipped before
carpool dogfood was solid. Accept still requires a `vehicleId`, checks
`drives`, and runs seat-capacity math; Settings still shows Garage. Empty or
unused garages block the request/accept loop. Capacity modeling was premature
— retire it fully (product, API, schema, living docs, and external vPIC
wiring). Fence accidental leaks in CI until an explicit parked revive
(`garage-capacity`) brings it back on purpose.

## Non-goals

- Re-introducing vehicles, seat counts, Garage nav, or vPIC (parking
  `garage-capacity` / `garage-seat-kinds` after carpool dogfood)
- “I drive / I don’t drive” gating — Accept stays visible to all circle adults
- Changing ride **request** seat semantics (`seats` = kid count on the ask)
- Expo / push / KMP OpenAPI client updates (KMP frozen; do not touch
  `mobile/sharedLogic` for this contract change)
- Restyling Calendar/Carpool beyond removing garage gates and Garage chrome
- Spotify / Playlist (already dormant)
- Rewriting **archive** specs or **Roadmap history** rows (historical record
  stays; living locks and smoke docs must not describe garage as current)

## Approach

**Hard delete + anti-regression.** Remove garage from the product surface,
OpenAPI, family module HTTP + `FamilyGarageApi`, Postgres schema, and all
vPIC/NHTSA code/config (`VpicPort`, lookup/cache, `app.vpic`,
`VPIC_BASE_URL` / `vpic.nhtsa.dot.gov`). Decouple Accept so any space-member
adult from another circle can Accept with an empty body (same shape as Pass)
— no `vehicleId`, no `drives` check, no remaining-seat math, no
one-vehicle-per-event uniqueness.

Keep ride-request `seats` as the kid-count field on asks/responses. Drop
`vehicleId` / `vehicleLabel` from ride persistence and `CarpoolRide`.

**Living docs:** rewrite `docs/architecture.md` so Garage is not a live
subsystem (point revive at parking `garage-capacity` only). Strip Garage /
vPIC / NHTSA smoke from `README.md` and invert `docs/garage-docs.test.mjs`
(or replace) into **absence** assertions. Do not scrub archive specs or
roadmap history.

**Anti-leak until revive:** contract and docs tests must assert garage HTTP
paths, `FamilyGarageApi`, live NHTSA/vPIC config, and Settings Garage chrome
are **absent** — so accidental / drive-by re-adds fail CI. This is a **fence
until an explicit revive slice** (parking `garage-capacity`, and later
`garage-seat-kinds` as needed) is `/spec`’d and implemented. That future
spec **owns** reintroducing product + API + schema and **replacing** these
absence assertions with positive locks. Do **not** treat the fence as a
permanent ban on garage.

Web: remove Settings → Garage destination and `GaragePanel`; stop fetching
garage for Accept eligibility. Hand-written `web/src/api/` clients stay
aligned with OpenAPI in the same change. Unused `icon.garage` token may be
removed if nothing references it after chrome deletion; not required if a
token-only leftover cannot call NHTSA or gate Accept.

## Context

Allowlist for `/implement`:

- Archived (prior model to reverse): `docs/specs/archive/garage-vehicles.md`
- Archived (Accept gates to remove): `docs/specs/archive/carpool-request-accept.md`
  → Accept / seat math / `drives` sections
- Architecture (rewrite living locks): `docs/architecture.md` → Family circle
  **Writes** / **Garage** / carpool Accept bullets; **Circle garage
  (detail)**; module tree / public API lists naming `FamilyGarageApi` / vPIC /
  NHTSA
- Living docs + guards: `README.md` (Garage smoke), `docs/garage-docs.test.mjs`
  (today asserts garage **present** — invert), `backend/.../OpenApiContractTest.java`
  (garage path presence tests → absence)
- Contract: `contracts/openapi.yaml` → `/api/family/circle/garage*`,
  `acceptCarpoolRide`, `AcceptCarpoolRideRequest`, `CarpoolRide`
  `vehicleId`/`vehicleLabel`, top-level narrative mentioning garage/vPIC
- Backend entry points:
  - Garage: `FamilyGarageController`, `FamilyGarageApi`,
    `internal/GarageService`, `internal/FamilyGarageApiImpl`, vehicle/drives
    entities/repos/DTOs
  - vPIC: `VpicPort` (+ HTTP/stub adapters), `VpicLookupService`,
    `VpicSeatCache*`, `app.vpic` in `application.yml`,
    `PostgresTestcontainers` vpic stub property
  - Carpool: `AcceptCarpoolRideRequest`, `CarpoolRideService` accept path,
    `CarpoolRideRequestEntity` `vehicleId`
  - Migrations: `V14__garage_vehicles.sql`, `V15__carpool_ride_requests.sql`
- Web entry points:
  - `FamilyScreen.tsx` (Settings Garage row + destination)
  - `GaragePanel.tsx`, `garageDisplay.ts`
  - `carpoolDisplay.ts` (`callerDrives`, `eligibleVehiclesForAccept`, vehicle
    helpers)
  - Accept call sites: `CarpoolPanel.tsx`, Focus/Hero accept handlers
  - `web/src/api/familyClient.ts`, `carpoolClient.ts`, `types.ts`

Do **not** update frozen KMP OpenAPI clients. Prefer deleting web/backend
product paths; leave inert mobile helpers only if removing them is out of
reach without thawing KMP — they must not be called from web/backend.

## Acceptance criteria

- [ ] **Nav:** Signed-in Settings rail shows Places / Feeds only — no Garage
      row, no `destination === "garage"` route, no `GaragePanel` mount.
- [ ] **Accept eligibility (API):** Space-member adult whose circle is **not**
      the requesting circle may `POST .../accept` with **empty body** (no
      request schema / no `vehicleId`). Own-circle → **409**. Not `PENDING`
      → **409**. Member/unknown → **404**. **No** `403` for `drives=false`.
      **No** seat-remaining or vehicle-committed checks.
- [ ] **Accept effect:** Success sets `ACCEPTED`, records accepting
      adult/circle, clears passes, sets RSVP YES for kids on the ride —
      unchanged except **no** vehicle recorded.
- [ ] **Contract:** All `/api/family/circle/garage*` paths and garage/vehicle /
      vPIC schemas removed from OpenAPI (including overview narrative).
      `AcceptCarpoolRideRequest` removed. `CarpoolRide` has no `vehicleId` /
      `vehicleLabel`. Web clients + types updated in the same change.
- [ ] **Schema:** New Flyway migration drops `family_vehicle_drivers`,
      `family_vehicles`, `vpic_seat_cache`; drops `family_memberships.drives`;
      drops `carpool_ride_requests.vehicle_id` and the
      `carpool_ride_requests_vehicle_event_unique` index.
- [ ] **Backend cleanup:** Garage controller/service/API/DTOs/entities and
      **all** vPIC/NHTSA code gone (`VpicPort`, lookup, cache, YAML
      `app.vpic` / `VPIC_BASE_URL` / `vpic.nhtsa.dot.gov`, testcontainer stub
      property). Carpool no longer depends on `FamilyGarageApi`.
- [ ] **Web Accept UX:** Focus / Agenda inbound / Carpool tab Accept does not
      fetch garage, pick a vehicle, or hide Accept when garage would have been
      empty or `drives` false. Pass/Decline unchanged.
- [ ] **Copy:** No living dogfood copy that tells users to add a vehicle or
      set drives before Accept. Ride `seats` label (kid count) may remain.
- [ ] **Living docs:** `docs/architecture.md` does not lock live Garage,
      `FamilyGarageApi`, vPIC, or NHTSA as current product behavior; Accept
      rules match this spec; revive pointed only at parking
      `garage-capacity`. `README.md` has no Garage / garage-API smoke.
- [ ] **Anti-leak fence (until explicit revive):**
      - Docs test (replace/invert `docs/garage-docs.test.mjs`): architecture
        must **not** match live `FamilyGarageApi` / Circle garage detail /
        NHTSA-as-current; README must **not** contain Garage smoke /
        `/api/family/circle/garage`. Comment in the test: fence until
        `garage-capacity` (or successor) removes/replaces these asserts.
      - `OpenApiContractTest`: OpenAPI must **not** contain
        `/api/family/circle/garage` (or garage operationIds); Accept must not
        require `vehicleId`. Same “until revive” comment.
      - Backend/web tests cover Accept without vehicles and no Garage nav.
      - `ModularityTests` still passes.
      - **Allowed later:** a dedicated parked revive spec may re-add garage /
        vPIC and flip these tests — that is intentional, not a leak.
- [ ] **Archive/history untouched:** Do not rewrite
      `docs/specs/archive/*` or roadmap **Roadmap history** solely to erase
      past garage/NHTSA mentions.

## Tasks

- [x] Backend: Flyway hard-drop migration (vehicles, drivers, vpic cache,
      `drives`, ride `vehicle_id` + unique index)
- [x] Backend: Delete garage HTTP + `FamilyGarageApi` + `GarageService` +
      related DTOs/entities/repos; delete **entire** vPIC stack + config;
      strip carpool Accept of garage/seat/vehicle logic; empty-body Accept
- [x] Contract: Remove garage/vPIC paths/schemas/narrative; rewrite Accept;
      drop `vehicleId`/`vehicleLabel` from `CarpoolRide`
- [x] Web: Remove Garage destination/panel/client methods/types; strip
      `callerDrives` / `eligibleVehiclesForAccept` / garage props from Accept
      surfaces; Accept calls with no body
- [ ] Docs: Rewrite living garage/vPIC/NHTSA locks in `docs/architecture.md`;
      remove README Garage smoke; invert/replace `docs/garage-docs.test.mjs`
      to absence guards
- [ ] Tests: Flip `OpenApiContractTest` garage assertions to absence; backend
      accept + migration; remove garage/vPIC unit/integration tests; web nav +
      Accept + client tests; run ModularityTests + docs tests

## Open questions

- None blocking — hard-delete + anti-leak fence until explicit
  `garage-capacity` (etc.) revive; that future slice owns bringing garage
  back and replacing the absence tests. Not this migration’s data.
