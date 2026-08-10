# Spec: activity-feed-subscribe

Status: in-progress  
Created: 2026-08-07  
Updated: 2026-08-10  
Approved: 2026-08-10  
Parent: [docs/roadmap.md](../../roadmap.md)  
Branch: `activity-feed-subscribe`  
Added: 2026-08-07 · re-rank split · 2026-08-10 · re-rank split (from activity-feed-sync)

## Problem

Families need schedules from external **iCal / webcal / `.ics` subscribe URLs**
without proprietary sport APIs. Circles already have Organizers, Caregivers, and
kids, but no way to subscribe a team/activity calendar, attach which kids are on
that feed, or pull events into the backend. Without this, calendar / leave-by /
coverage have nothing imported to show.

## Non-goals

- **Background / interval polling** — `activity-feed-poller`
- **Manual event CRUD** — `manual-events`
- **Calendar UI / event list grid** — `family-calendar-surface` (this slice stores
  events and shows sync status + count only)
- **Team carpool spaces** — feed = calendar only
- **Vendor-specific private sport APIs** — paste the public subscribe URL into a
  generic importer (no Crossbar/SportsYou/SportsEngine SDKs)
- **RSS/Atom** — `rss-atom-schedule-feeds` parking
- **Geocoding feed venues** — places/geocode stay separate; location stays text
- **Caregiver feed management** — **Organizer-only** create/update/delete/Sync now
  (Caregivers consume events later via calendar)
- **OpenAPI codegen** — hand-written clients stay the pattern

## Approach

New Modulith module **`feeds`** (vertical slice). Circle membership and kid
ownership stay in **`family`**; expose a small public **`FamilyMembershipApi`**
(or equivalent) so `feeds` can require Organizer, resolve the adult’s circle,
and validate kid ids belong to that circle — no imports of `family.internal`.

**Feed (circle-scoped):**

| Field | Notes |
|-------|--------|
| id | UUID |
| name | Required short label (e.g. “U12 Travel”) |
| sourceUrl | Required; trim; accept `webcal://` by normalizing to `https://` for fetch; store the normalized URL used for fetch (or store original + normalized — pick one in implement and document) |
| kidIds | 0+ kids from the same circle (many-to-many) |
| lastSyncedAt | Nullable timestamptz |
| lastSyncError | Nullable short message; cleared on successful sync |
| eventCount | Derived or denormalized for UI after sync |

**Event (feed-scoped, for later calendar):**

| Field | Notes |
|-------|--------|
| id | UUID |
| feedId | FK |
| uid | Nullable iCal `UID`; unique per feed when present (dedupe key) |
| summary | Title/text |
| startsAt / endsAt | Instant (UTC); all-day handling: store as date-only → midnight UTC or document a simple rule |
| location | Nullable free-text from iCal |

**Sync behavior:**

1. **Create feed** and **update URL** → persist, then **auto-run sync** (same path as Sync now). Soft-fail: feed row remains; `lastSyncError` set; `lastSyncedAt` unchanged on failure (null if never succeeded).
2. **Sync now** (Organizer) → fetch `.ics`, parse, upsert by `UID` when present; events missing from feed with a UID may be removed or left (prefer **replace snapshot for that feed** on each successful sync — simpler).
3. Fetch uses identifying User-Agent (app name + contact URL/email, same spirit as Nominatim); timeouts; no live third-party hosts required in CI (fixture `.ics` files).
4. Duplicate **normalized URL** in the same circle → **409**.

**Authz:** Organizer for all feed writes + Sync now + list management. Unauthenticated → **401**. Non-member / wrong circle → **404**. Caregiver → **403** on feed management endpoints (or omit from Caregiver UI and still enforce 403).

**Contract:** `/api/family/circle/feeds` (or `/api/feeds` under Bearer — prefer under family circle path for consistency) CRUD + `POST .../feeds/{feedId}/sync`. Responses include kids, last-synced, last error, event count. Bump OpenAPI version. No calendar event listing endpoint in this PR (unless needed for a tiny debug count — prefer count on Feed only).

**Clients:** web + Android + iOS Organizer **manage feeds** UI: list, add (name + URL + kid multi-select), edit, delete, Sync now, show last-synced / error / event count. No calendar grid.

**Platform validation:** parser/integration tests use fixture `.ics` samples representative of Crossbar / SportsYou / SportsEngine-style feeds; README or architecture note for optional manual live-URL smoke. CI must not call live vendor hosts.

## Acceptance criteria

- [ ] OpenAPI: feed schemas + Organizer Bearer paths for list/create/update/delete +
      Sync now; 401/403/404/409 documented; version bumped; web + mobile clients
      updated in the same change.
- [ ] Organizer can create a feed (name, URL, 0+ kid ids); `webcal://` URLs fetch
      as `https://`; create **auto-syncs**; success sets `lastSyncedAt` and event
      count; fetch/parse failure **soft-fails** (feed saved, `lastSyncError` set,
      not 5xx for the write).
- [ ] Organizer can update name/kids/URL; **URL change auto-syncs**; Sync now
      re-runs sync for current URL.
- [ ] Successful sync **dedupes by `UID`** within a feed (upsert/replace snapshot);
      events are persisted for later calendar use.
- [ ] Duplicate normalized URL in the same circle → **409**; unknown feed /
      other circle → **404**; Caregiver feed mutations → **403**; unauthenticated
      → **401**.
- [ ] Kid ids must belong to the Organizer’s circle (invalid kid → **400** or
      **404** — pick one and document).
- [ ] Web, Android, and iOS: Organizer manage-feeds UI with Located-style sync
      status (last-synced / error / event count) + Sync now; errors surfaced.
- [ ] Unit + integration tests cover create+auto-sync, soft-fail, Sync now, authz,
      UID dedupe with fixtures; `ModularityTests` green; no live vendor HTTP in CI.

## Tasks

- [ ] **Backend:** New `feeds` module + Flyway (feeds, feed_kids, events);
      `FamilyMembershipApi` (or equivalent) on `family`; iCal fetch/parse port +
      stub/fixtures; create/update/delete + auto-sync + Sync now; soft-fail +
      UID snapshot replace.
- [ ] **Contract:** OpenAPI feed paths/schemas; bump version.
- [ ] **Web:** types + client; Organizer manage-feeds UI + tests.
- [ ] **Mobile:** sharedLogic models/client; sharedUI + iOS manage-feeds; tests.
- [ ] **Docs:** `docs/architecture.md` ActivityFeed notes (subscribe vs poller).
- [ ] **Tests:** fixtures for Crossbar/SportsYou/SportsEngine-like `.ics`;
      service + integration + client tests; `ModularityTests`.

## Open questions

_None blocking — auto-sync on create/URL change locked in `/spec`; Caregiver
management deferred to calendar consumption; poller is a follow-up id._

## Locked in this spec

| Topic | Decision |
|--------|----------|
| Sync on create / URL change | **Auto-sync** + explicit Sync now |
| Authz | **Organizer-only** manage + Sync now |
| Module | New Modulith **`feeds`** + thin family membership API |
| Fetch | Generic iCal/webcal; normalize `webcal://` → `https://` |
| Failure | **Soft-fail** write; `lastSyncError` |
| Dedupe | iCal **`UID`** per feed; successful sync replaces feed snapshot |
| UI | Manage feeds only (no calendar grid) |
| Vendors | Fixture validation only in CI; no vendor SDKs |
| Polling | Out → `activity-feed-poller` |
