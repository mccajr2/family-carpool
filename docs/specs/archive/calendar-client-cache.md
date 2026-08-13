# Spec: calendar-client-cache

Status: done  
Created: 2026-08-12  
Approved: 2026-08-12  
Updated: 2026-08-12 (`/pr`)  
Parent: [docs/roadmap.md](../../roadmap.md)  
Branch: `calendar-client-cache`  
Added: 2026-08-12 · enhancement (split: conditional GET deferred)

## Problem

Every login (and many Agenda visits) waits on a fresh
`GET /api/family/circle/calendar` before anything appears. Circles’ schedules
change infrequently, but the UX still feels cold-start slow. Adults need Agenda
**prepopulated immediately** from a local cache, with a **background refresh**
updating to the server view without blanking the list.

## Non-goals

- **HTTP conditional GET / `ETag` / `304`** — follow-up
  [`calendar-conditional-get`](../planned/calendar-conditional-get.md)
- Changing feed Sync now / server poller semantics (`activity-feed-poller`)
- Offline-first write queue / full offline editing of events or coverage
- Conflict detection rules (`conflict-detection`)
- Month grid virtualization (`family-calendar-grid`)
- Persisting the web Bearer session (web auth stays in-memory; cache only helps
  within an authenticated SPA session / after Ready)
- OpenAPI / backend changes
- Restyling Calendar onto shared UI tokens (`ui-system-destination-adoption`)

## Approach

### End-state (this PR + follow-up)

| Slice | Delivers |
|-------|----------|
| **This PR** | Persist last successful calendar payload; paint cache first; full `GET` revalidate in background; keep cache coherent after mutations |
| **`calendar-conditional-get`** | Server `ETag` + client `If-None-Match` on background revalidate |

### Cache contents (locked)

Persist one snapshot per **(adultId, circleId)**:

- `from` / `to` (the loaded half-open window — includes Load more extent)
- `items` (full `CalendarItem` list as last successfully fetched, including
  leave-by, coverages, conflicts)
- `fetchedAt` (client clock, for soft-stale UX)

Enrichment is **adult-scoped**, so the key must include `adultId`, not only
circle.

### Storage (locked)

| Client | Store |
|--------|--------|
| Web | `localStorage` (JSON); clear on sign-out |
| Android | App-private storage via a small `CalendarCacheStore` in `sharedLogic` (not the secure token store) |
| iOS | Same `CalendarCacheStore` expect/actual (or thin Swift mirror with identical schema if bridging is awkward) — clear on sign-out |

Calendar payloads are not secrets; do **not** put them in encrypted token storage.

### Stale-while-revalidate (locked)

1. On Calendar Ready / Agenda bootstrap for a matching adult+circle: if a cache
   hit exists, **set `calendarItems` + `calendarLoadedTo` from cache immediately**
   (no blank spinner over cached rows).
2. Always kick off a background `GET` for
   `[localTodayStart, max(localTodayStart+30d, cachedTo))` (or the current
   in-memory loaded window if already extended this session).
3. On **200**: replace in-memory items + window bounds; rewrite the persisted
   snapshot.
4. On **network/HTTP failure** with cache already shown: **keep cache**; surface
   a soft error (existing error string pattern) — do not clear Agenda.
5. On failure with **no** cache: keep today’s empty/error behavior.

Do **not** block first paint on the network when cache hits.

### Soft-stale indicator (locked)

While a background revalidate is in flight **and** cached rows are visible,
show a subtle non-blocking refresh affordance (existing Agenda busy / Doherty
patterns — not a full-screen loader, not blanking the list). Hide it when the
revalidate settles (success or soft failure).

### Refresh triggers (this PR)

- Cold Ready / first Agenda load after auth (always revalidate; paint cache first)
- Returning to the Calendar destination when `fetchedAt` is older than **5
  minutes** (soft TTL — still show cache, then revalidate)
- After Agenda-affecting **full-range** reloads already in clients (Sync now,
  feed CRUD that reloads calendar, manual create/delete that reloads range)

No idle polling timer while the app sits open — keep this PR thin. Conditional
`304` savings land in the follow-up.

### Mutations (locked)

| Write | Cache behavior |
|-------|----------------|
| Coverage assign / reassign / confirm / decline / remove; leave-from PUT; compose updates that already **patch one** `CalendarItem` in memory | Update that row in the persisted snapshot (same adult+circle key) — do not wait for a full refetch |
| Writes that **reload the loaded range** (Sync now, feed URL change, manual create/delete that refetches) | After successful reload, persist the new full snapshot |
| Sign-out, leave circle, or adult/circle identity change | **Clear** that cache entry (and in-memory calendar) |

### Load more

Append pages as today; after a successful Load more, persist the **merged**
items and the new `to` (`calendarLoadedTo`).

## Acceptance criteria

- [x] **Web + Android + iOS:** With a prior successful calendar fetch for the
      same adult+circle, signing in / reaching Ready paints Agenda from cache
      **before** the network revalidate completes (observable: items visible
      while request in flight).
- [x] Background revalidate on Ready always runs; on 200, Agenda matches the
      server payload and the persisted snapshot is updated.
- [x] Revalidate failure after a cache hit leaves cached items on screen and
      does not wipe Agenda to empty.
- [x] Soft-stale refresh UI appears while revalidating over cached rows and
      clears when settled — no full-screen blanking of the list.
- [x] Returning to Calendar with `fetchedAt` older than 5 minutes triggers
      revalidate; fresher visits do not force an extra fetch solely due to
      navigation (mutations/Sync still refresh as today).
- [x] Single-item mutation responses that update in-memory Agenda also update
      the persisted snapshot for that adult+circle.
- [x] Successful Sync now / range reload / Load more persists the new window +
      items.
- [x] Sign-out (and circle leave / identity change) clears the calendar cache
      for that client.
- [x] **No** OpenAPI or backend changes in this PR.
- [x] Unit/component tests cover: cache hit paints before fetch; fetch
      failure keeps cache; mutation patches persist; sign-out clears (per
      client layer that owns the store).

## Tasks

- [x] Web: `CalendarCacheStore` (localStorage) + wire `FamilyScreen` Ready /
      reload / Load more / single-item patch / sign-out; soft-stale indicator
- [x] Android / sharedLogic: `CalendarCacheStore` expect/actual +
      `FamilyUiModel` SWR bootstrap, TTL on Calendar focus, persist hooks,
      clear on sign-out
- [x] iOS: same SWR behavior in `AuthViewModel` / Calendar UI (shared store or
      schema-identical Swift store); soft-stale indicator; clear on sign-out
- [x] Docs: note client cache in `docs/architecture.md` Calendar agenda row;
      point at follow-up conditional GET
- [x] Tests: web + sharedLogic/UI (+ iOS script if that is the repo pattern)
      for hit/miss, failure-keeps-cache, patch, clear

## Open questions

- None blocking — `ETag` / `304` deliberately deferred to
  [`calendar-conditional-get`](../planned/calendar-conditional-get.md).
- Soft TTL **5 minutes** is a product default; adjust only if review wants a
  different constant before `/implement`.
