# Spec: activity-feed-poller

Status: in-progress  
Created: 2026-08-10  
Updated: 2026-08-10  
Approved: 2026-08-10  
Parent: [docs/roadmap.md](../../roadmap.md)  
Branch: `activity-feed-poller`  
Added: 2026-08-10 · re-rank split

## Problem

Subscribed feeds go stale unless someone hits **Sync now**. Circles need a
**background poll** on a sensible interval that reuses the same fetch / parse /
UID snapshot path, updating **last-synced** and soft-fail error state without
blocking the UI. Organizers also need a cheap way to **refresh the feeds list**
on clients so poller results show up without a full page reload.

## Non-goals

- Feed URL CRUD, kid attachment, or changing Sync now semantics
  (`activity-feed-subscribe` — already shipped)
- **Sync all feeds** in one client action (would hammer calendar hosts; Sync now
  stays per-feed)
- Manual event CRUD (`manual-events`)
- Calendar UI / event grid (`family-calendar-surface`)
- Per-vendor pollers or private sport APIs
- Push / email when a feed changes (`push-notifications` parking)
- Distributed multi-instance lease/locking beyond a single Render process (note
  risk if we later scale to multiple backend replicas)
- Live SSE/WebSocket push of sync status to open clients

## Approach

Stay inside the existing Modulith **`feeds`** module. Add a Spring
**`@Scheduled`** job (enable scheduling on the app) that periodically loads all
activity feeds and runs each through the **same sync path** used by Sync now /
create / URL-change (fetch → parse → UID snapshot replace; soft-fail writes
`lastSyncError` and leaves prior snapshot / `lastSyncedAt` on failure).

**Interval:** default **30 minutes**, configurable
(`app.feeds.poll-interval-ms` / `FEEDS_POLL_INTERVAL_MS`). Disable or use a
no-op in CI/tests via `app.feeds.poll-enabled` / `FEEDS_POLL_ENABLED` (default
`true` in app config; tests force `false`). Stagger or sequential per-feed
processing with a short delay between hosts so we do not burst outbound HTTP.

**Politeness:** reuse identifying `FEEDS_USER_AGENT`, existing fetch timeouts;
no live vendor hosts in CI (stub fetch provider). Document that a single app
instance is assumed for v1 scheduling.

**Contract:** **no new OpenAPI paths** — list + Sync now already exist. OpenAPI
description / architecture note that last-synced may update from background
poll (optional doc-only version bump if description changes; prefer architecture
only unless contract text must mention polling).

**Clients (web + Android + iOS):** Organizer manage-feeds UI gains a **Refresh**
control that re-calls existing `GET /api/family/circle/feeds` (and updates local
list / status labels). Does **not** trigger sync. Sync now remains per feed.

## Acceptance criteria

- [ ] Backend scheduled job runs on the configured interval (default 30m) when
      `poll-enabled` is true; each feed uses the **same sync path** as Sync now
      (UID snapshot replace on success; soft-fail on fetch/parse).
- [ ] Soft-fail from poll updates `lastSyncError` without wiping a prior good
      event snapshot; successful poll clears error and updates `lastSyncedAt` +
      event count.
- [ ] Polling is **off in tests/CI** (`poll-enabled=false` or equivalent) so
      suites do not wait on timers or hit live HTTP; unit/integration tests
      invoke the poller/service method directly with stub fetch.
- [ ] Config documents `FEEDS_POLL_INTERVAL_MS` (default 30m) and
      `FEEDS_POLL_ENABLED`; `FEEDS_USER_AGENT` remains required for polite
      outbound fetch in prod.
- [ ] **No new OpenAPI paths**; Sync now and list unchanged. Architecture notes
      subscribe vs poller (poller fills last-synced between Sync nows).
- [ ] Web, Android, and iOS: Organizer feeds UI has **Refresh** that reloads the
      feeds list from GET (status / kid labels / event counts update); does not
      call Sync now for every feed.
- [ ] Tests cover: poller syncs eligible feeds via stub; soft-fail path; disabled
      when `poll-enabled=false`; client Refresh reloads list. `ModularityTests`
      green; no live vendor HTTP in CI.

## Tasks

- [x] **Backend:** Enable scheduling; `FeedsPoller` (or equivalent) + config
      (`poll-enabled`, `poll-interval-ms`); sequential/soft-polite sync-all using
      existing service sync; tests with stub + disabled schedule.
- [x] **Contract:** No path changes; optional description-only note if needed —
      prefer `docs/architecture.md` over version bump unless OpenAPI text must
      change.
- [ ] **Web:** Refresh control on manage-feeds; re-`listFeeds`; tests.
- [ ] **Mobile:** sharedUI + iOS Refresh; tests.
- [ ] **Docs:** architecture — poller interval, enable flag, single-instance
      assumption, Refresh vs Sync now.
- [ ] **Tests:** poller unit/integration + client Refresh; `ModularityTests`.

## Open questions

_None blocking — interval 30m, backend poll + client Refresh (list only), no
sync-all, locked in `/spec`._

## Locked in this spec

| Topic | Decision |
|--------|----------|
| Default interval | **30 minutes** (`FEEDS_POLL_INTERVAL_MS`) |
| Sync path | **Reuse** existing feed sync (same as Sync now) |
| Failure | Soft-fail; preserve prior snapshot on error |
| Enablement | `FEEDS_POLL_ENABLED` (off in CI/tests) |
| Contract | **No new endpoints** |
| Client | **Refresh** = re-GET list; Sync now stays per-feed |
| Sync all | Out of scope |
| Push on change | Out → parking / later |
| Multi-instance lock | Out for v1 (single Render process assumed) |
