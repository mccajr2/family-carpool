# Spec: ride-detail-route-only

Status: draft  
Parent: [docs/roadmap.md](../../roadmap.md)  
Created: 2026-09-08  
Added: 2026-09-08 · enhancement  
Branch: `ride-detail-route-only`  
Depends on: [`ride-playlist-tab`](../archive/ride-playlist-tab.md) (live
Playlist on `main`), [`ride-route-tab`](../archive/ride-route-tab.md) (Route
behavior preserved)  
Feeds: [`ride-detail-polish`](../planned/ride-detail-polish.md), parking
`music-provider-model` → `apple-music-*` (Playlist UI returns later)

## Problem

Confirmed-ride detail still shows Route / Playlist tabs and mounts live Spotify
Playlist UI. Spotify developer/Premium constraints make that path unsuitable for
dogfood, so adults hit a music surface we cannot honestly support while Route
(the carpool need) remains one tab away. Hide Playlist so Route is the only
detail surface and the shipped Spotify stack stays dormant for later reuse.

## Non-goals

- Deleting Spotify backend, OAuth, OpenAPI playlist paths, `playlistClient`,
  `RidePlaylistTab`, or `mergeTracks` (keep dormant — do not delete)
- Building Apple Music or a provider abstraction
  ([`music-provider-model`](../planned/music-provider-model.md)+)
- Route loading / notify / OSRM-unreachable polish
  ([`ride-detail-polish`](../planned/ride-detail-polish.md))
- Changing OSRM / multi-stop Route behavior, leave-by math, or maps deep links
- Changing Agenda `canRoute` entry rules
  ([`ride-detail-shell`](../archive/ride-detail-shell.md) /
  [`ride-route-tab`](../archive/ride-route-tab.md))
- OpenAPI / backend / Expo / KMP changes
- Restyling Route chrome or inventing new design tokens (hide only; product
  parking overrides the mock’s Playlist tab for dogfood)

## Approach

Web-only: make confirmed-ride detail **Route-only**.

1. **`RideDetailScreen`** — remove the Route | Playlist segmented control
   (`role="tablist"` / Playlist tab). Keep back + event header; always render
   the Route body (no tab state required for Playlist). Simplify props so
   callers are not forced to pass `playlistPanel` / playlist tab wiring.
2. **`FamilyScreen`** — stop mounting `RidePlaylistTab`, stop calling
   `getCalendarPlaylist` / open-playlist when detail opens, and drop Playlist
   tab state (`rideDetailTab === "playlist"`, shuffle seed, designate-after-OAuth
   resume). Opening detail always shows Route.
3. **Spotify OAuth return** — if `consumeSpotifyConnectedQuery` /
   `takeSpotifyOAuthReturn` still run, they must **not** reopen Playlist UI
   (consume/clear return state; optional: still land on that ride’s Route
   detail). Do not leave a dead “connected but no Playlist” path in the UI.
4. **Dormant code** — leave `backend/modules/playlist/`, calendar playlist
   endpoints, `contracts/openapi.yaml` playlist operations,
   `web/src/api/playlistClient.ts`, `RidePlaylistTab.tsx`,
   `spotifyOAuthReturn.ts`, and unit tests for those modules in the tree.
   Colocated shell/integration tests that assert Playlist chrome must be
   updated or narrowed to Route-only; do not delete Playlist module tests.

**Visual:** mock
[`docs/ui-system/carpool-combined-flow.jsx`](../../ui-system/carpool-combined-flow.jsx)
still shows Playlist — **product parking wins** for this PR. No token lock
changes.

**Contract:** none.

## Context

Allowlist for `/implement`:

- Prior slice (reuse Route entry + chrome; do not re-read Playlist AC as
  shipping work): [`ride-route-tab`](../archive/ride-route-tab.md) Approach /
  AC for live Route; [`ride-detail-shell`](../archive/ride-detail-shell.md)
  `canRoute` + detail overlay shape
- Source:
  [`web/src/components/RideDetailScreen.tsx`](../../web/src/components/RideDetailScreen.tsx)
  (tablist + panels);
  [`web/src/components/FamilyScreen.tsx`](../../web/src/components/FamilyScreen.tsx)
  (detail overlay, playlist fetch, Spotify OAuth resume ~L377–390);
  [`web/src/components/RideRouteTab.tsx`](../../web/src/components/RideRouteTab.tsx)
  (must keep working as sole body);
  [`web/src/components/spotifyOAuthReturn.ts`](../../web/src/components/spotifyOAuthReturn.ts)
- Tests to update:
  [`web/src/components/RideDetailScreen.test.tsx`](../../web/src/components/RideDetailScreen.test.tsx);
  Playlist chrome assertions in
  [`web/src/components/FamilyScreen.test.tsx`](../../web/src/components/FamilyScreen.test.tsx)

Do not implement Apple Music stubs. Product parking (hide Playlist, keep Spotify
dormant) is already locked in Problem / Non-goals / Approach above.

## Acceptance criteria

- [ ] Opening a `canRoute` confirmed ride from Agenda shows ride detail with
      **Route content only** — no Playlist tab, no `role="tablist"` segmented
      control for Route/Playlist, and no `ride-detail-tab-playlist` in the DOM
- [ ] Route panel still shows live stops / leave-by / maps / notify behavior
      from [`ride-route-tab`](../archive/ride-route-tab.md) (no regression to
      fixture-only Route)
- [ ] Opening detail does **not** call calendar playlist GET (or equivalent
      playlist load) and does not mount `RidePlaylistTab`
- [ ] A Spotify OAuth success query / stored OAuth return does **not** surface
      Playlist UI; user is not stuck on a missing Playlist tab
- [ ] Spotify / playlist **source modules remain in the repo** (backend
      playlist module, OpenAPI playlist paths, `playlistClient`,
      `RidePlaylistTab`) — this PR is hide/unwire, not delete
- [ ] Web tests: `RideDetailScreen` asserts Route-only chrome; FamilyScreen
      ride-detail smoke no longer requires Playlist tab click / live playlist
      panel; a test would fail if Playlist tab chrome were restored

## Tasks

- [ ] Web: Route-only `RideDetailScreen` (remove Playlist tab chrome; simplify
      props / always show `routePanel`)
- [ ] Web: Unwire Playlist from `FamilyScreen` detail (no playlist fetch/mount;
      drop playlist tab state; neutralize Spotify OAuth resume so it cannot open
      Playlist)
- [ ] Tests: Update `RideDetailScreen.test.tsx` + FamilyScreen ride-detail /
      Playlist smoke to Route-only; keep Playlist module unit tests intact
- [ ] Verify: `npm test` (relevant suites) under `web/` — report actual result

## Open questions

_None — scope locked by roadmap park (2026-09-08). Playlist returns via
`music-provider-model` / Apple Music path, not this PR._
