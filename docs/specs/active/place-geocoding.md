# Spec: place-geocoding

Status: in-progress  
Created: 2026-08-07  
Updated: 2026-08-09  
Approved: 2026-08-09  
Parent: [docs/roadmap.md](../../roadmap.md)  
Branch: `place-geocoding`  
Added: 2026-08-07 · re-rank split

## Problem

Named places store free-text addresses but no coordinates. Leave-by, coverage
travel estimates, and later proximity features need `lat`/`lng`. Families also
need to see when a place failed to locate and be able to **retry** without
waiting for a later product surface.

## Non-goals

- **Leave-by / routing math** — `event-leave-by-estimate`
- **Event / feed venue geocoding** — no calendar events yet; revisit when venues
  exist
- **In-app maps**, OSM tiles, turn-by-turn, maps deep links
- **Paid geocoders** (Google, Mapbox, etc.)
- **Manual lat/lng override** (type coords by hand)
- **Structured address components** (street/city as separate fields)
- **Background backfill job** for all existing places on deploy (use Retry /
  address edit instead)
- **OpenAPI codegen** — hand-written clients stay the pattern

## Approach

Extend the Modulith **`family`** module. Introduce a small **geocode port**
(Nominatim HTTP adapter in prod/dev; fake in unit tests) so CI never depends on
live OSM.

**On create / update place (address change):**

1. Persist the place as today (name uniqueness unchanged).
2. Attempt geocode of the trimmed address via Nominatim (or **address→coords
   cache** hit).
3. **Soft-fail:** if Nominatim errors, times out, or returns no result, keep the
   place with `latitude` / `longitude` **null** (write still succeeds).
4. On success, store WGS84 lat/lng on the place row (and cache the query).

**Retry:** `POST /api/family/circle/places/{placeId}/locate` (any circle member)
re-runs geocode for the place’s current address and returns the updated `Place`.
On failure, still **200** with null coords (soft); clients treat null lat/lng as
not located. Unknown place / other circle → **404**; unauthenticated → **401**.

**Cache:** table keyed by normalized address string → lat/lng (+ fetched_at).
Respect Nominatim usage policy: identifying **User-Agent**, serialize outbound
calls (~1 req/s), prefer cache hits.

**Contract:** extend `Place` with nullable `latitude` / `longitude` (number);
document locate endpoint; bump OpenAPI version. No map payloads.

**Clients:** web + Android + iOS show **Located** / **Not located** on each place
and a **Retry locate** action when not located (any member). Create/edit flows
unchanged aside from reflecting returned coords after save.

**Docs:** update `docs/architecture.md` Place row (coords + soft-fail + cache).

## Acceptance criteria

- [ ] OpenAPI: `Place` includes nullable `latitude` / `longitude`;
      `POST .../places/{placeId}/locate` under Bearer; create/update responses
      include coords when known.
- [ ] Creating or updating a place **geocodes** the address (cache or Nominatim);
      success persists lat/lng; Nominatim failure / no hit → place still saved
      with **null** coords (**soft-fail**, not 4xx/5xx for the write).
- [ ] Updating **only** the name (same address) does not require a new Nominatim
      call when coords already present (or cache hit is fine).
- [ ] Changing the address clears or refreshes coords via a new geocode attempt
      (soft-fail allowed).
- [ ] Any member can **Retry locate**; success fills coords; failure leaves nulls
      and UI still shows not located; unknown place / other circle → **404**;
      unauthenticated → **401**.
- [ ] Geocode cache is used for identical normalized address queries; outbound
      Nominatim calls use a respectful User-Agent; unit tests use a fake port
      (no live network required).
- [ ] Web, Android, and iOS: place list shows Located / Not located; **Retry
      locate** when not located; errors surfaced.
- [ ] Backend unit + integration tests cover soft-fail create, successful
      geocode, locate retry, authz; client tests cover locate + types;
      `ModularityTests` green.

## Tasks

- [x] **Backend:** Flyway columns `latitude`/`longitude` (nullable) on
      `family_places`; geocode cache table; `GeocoderPort` + Nominatim adapter +
      rate/cache; wire create/update place; `locatePlace` service + controller;
      fake port for tests.
- [x] **Contract:** OpenAPI `Place` lat/lng + locate path; bump version.
- [x] **Web:** types + `familyClient.locatePlace`; FamilyScreen Located /
      Not located + Retry locate; tests.
- [ ] **Mobile:** models/client + UiModel/Screen; iOS AuthBridge/ViewModel/
      ContentView; tests.
- [ ] **Docs:** `docs/architecture.md` Place / geocode notes.
- [ ] **Tests:** service unit (fake geocoder), integration with stubbed HTTP or
      test double, OpenAPI contract paths, web + KMP client tests.

## Open questions

_None blocking — resolved in `/spec`: soft-fail on write; UI show + retry;
Nominatim + cache; places only (not event venues)._

## Locked in this spec

| Topic | Decision |
|--------|----------|
| Provider | **Nominatim** (OSM), identifying User-Agent, cache + throttle |
| Failure on create/update | **Soft-fail** — place saved, coords null |
| UI | **Located / Not located** + **Retry locate** |
| Scope | **Named places** only (not feed/event venues) |
| Writes / retry | **Any circle member** (same as place CRUD) |
| Manual coords | Out |
