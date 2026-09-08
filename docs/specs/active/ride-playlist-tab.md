# Spec: ride-playlist-tab

Status: draft  
Parent: [docs/roadmap.md](../../roadmap.md)  
Created: 2026-09-06  
Updated: 2026-09-07 (`/spec`)  
Added: 2026-09-06 · enhancement  
Branch: `ride-playlist-tab`  
Depends on: [`ride-detail-shell`](../archive/ride-detail-shell.md) (Playlist
chrome + fixtures), [`ride-detail-schedule-utils`](../archive/ride-detail-schedule-utils.md)
(`mergeTracks` / `fmtMinSec`), [`ride-route-tab`](../archive/ride-route-tab.md)
(live Route + drive minutes for coverage copy)  
Feeds: [`ride-detail-polish`](../planned/ride-detail-polish.md),
[`push-notifications`](../planned/push-notifications.md),
[`carpool-recurring-rotation`](../planned/carpool-recurring-rotation.md)
(persisted merge playlists — later)

## Problem

Confirmed-ride Playlist is still **fixture data**. Adults cannot connect
Spotify, designate a per-kid gameday playlist, see who in the car has music
ready, invite unconnected parents, or hand off a real “Open in Spotify” URL
(single playlist or fair merge) without Premium remote control.

## Non-goals

- Spotify Connect / remote playback (Premium) — keep mockup “Open in Spotify”
  handoff + Premium caveat copy
- Apple Music / multi-service catalog
  ([`playlist-open-in-streaming`](../planned/playlist-open-in-streaming.md))
- Team locker-room mix ([`locker-room-mix`](../planned/locker-room-mix.md))
- Persisted merged playlists for recurring / neighborhood rotation
  ([`carpool-recurring-rotation`](../planned/carpool-recurring-rotation.md)) —
  merges in this PR are **transient**
- Liked-Songs-as-source or per-ride playlist pick — **designated playlist per
  kid** only
- Rich loading / invite-failure polish chrome
  ([`ride-detail-polish`](../planned/ride-detail-polish.md)) — invite uses the
  same soft-succeed local UI as Route notify; honest invite error states wait
- Real push / SMS delivery ([`push-notifications`](../planned/push-notifications.md))
- Expo / KMP
- Rewriting Playlist visual chrome already shipped in the shell (tokens already
  locked unless a live-data edge forces a new role)
- Changing Route tab behavior

## Approach

Replace fixture `playlistRiders` on the Playlist tab with **live** rider tiles
and Spotify-backed open/merge. Reuse
[`mergeTracks`](../../web/src/components/rideScheduleUtils.ts) and existing
Playlist chrome; do not re-implement round-robin.

**Who’s in the car (tiles)** — one tile **per attending kid** on this confirmed
ride (going / in-play kids covered by the household confirmed coverage or the
accepted teammate request seats — same “in the car” idea as rider chips /
route pickups). Same parent with two kids → **two tiles**. Tile label = kid
display name; Spotify account + designation belong to a **circle adult** who
connected for that kid.

**Source playlist** — after Spotify OAuth, the adult picks **one designated
playlist per kid** (e.g. that kid’s gameday mix). Reused across rides until
changed. Not Liked Songs; not chosen per ride.

**Connection** — parent Spotify via Authorization Code (+ refresh). Persist
tokens server-side (refresh + revoke). Adult can connect from Playlist when
they own an unconnected kid tile in their circle, or from a small connect /
pick-playlist affordance on that tile. Revoke clears tokens and designations
for that adult.

**Open in Spotify**

| Connected kid-playlists | Behavior |
| ----------------------- | -------- |
| Exactly **1** | Open that playlist’s existing Spotify URL — **no create** |
| **2+** | Round-robin merge (`mergeTracks`); create a **transient** playlist on the **viewing** adult’s Spotify account with that order; open its URL |
| **0** | Open disabled (or inert); hero still explains coverage / who isn’t connected |

Do **not** persist merges for reuse across rides (recurring rotation later).

**Remix merge order** — only when **2+** connected playlists: reshuffle the
in-app merge (existing seeded shuffle). **Open** writes the remixed order into
the transient playlist (create or replace items). Hide or no-op Remix when
0–1 connected (Spotify’s own Shuffle covers a single open playlist).

**Drive coverage copy** — use live Route `legMinutes` sum when Route status is
`OK`; otherwise fall back to whatever the detail already has (do not invent a
second duration). Coverage messaging stays display-only (do not truncate the
track list to drive length).

**Invite-to-connect** — same pattern as Route ready-by notify: local
sending/sent UI + channel-agnostic call site that **soft-succeeds with no
network** (mirror
[`web/src/components/rideNotify.ts`](../../web/src/components/rideNotify.ts)).
Real delivery waits on `push-notifications`.

**Contract (OpenAPI — required):** adult Spotify connect/callback/status/
revoke; per-kid designated playlist list/set; confirmed-ride playlist read
(riders + connection + tracks metadata for merge UI); open/handoff endpoint
that returns the Spotify URL (1 vs 2+ rules above). Exact path/module ownership
(`playlist` Modulith module vs calendar composition) is an implementation
choice; keep secrets and Spotify HTTP out of the web client except OAuth
redirect UX.

**Clients:** update **web** API clients in the same change. Do **not** update
frozen KMP `sharedLogic`.

**Spotify Dev Mode risk:** as of Feb 2026, Development Mode requires the app
owner to hold Premium and caps allowlisted users (currently 5). Document env /
dashboard setup for dogfood; Extended Quota is out of scope for this PR.

## Context

- Design / mockup SoT:
  [`docs/ui-system/carpool-combined-flow.jsx`](../../ui-system/carpool-combined-flow.jsx)
  → `mergeTracks` (~L241–256); `InviteAction` / `RiderTile` / `TrackRow` /
  `PlaylistTab` (~L882–1057); Premium caveat copy (~L1033–1043)
- Prior slice decisions:
  [`ride-detail-shell`](../archive/ride-detail-shell.md) (fixture Playlist UI);
  [`ride-detail-schedule-utils`](../archive/ride-detail-schedule-utils.md)
  (`mergeTracks`); [`ride-route-tab`](../archive/ride-route-tab.md) (live
  `legMinutes`, notify soft-fail pattern)
- Web entry points:
  [`web/src/components/RidePlaylistTab.tsx`](../../web/src/components/RidePlaylistTab.tsx);
  [`web/src/components/rideDetailFixtures.ts`](../../web/src/components/rideDetailFixtures.ts);
  [`web/src/components/rideScheduleUtils.ts`](../../web/src/components/rideScheduleUtils.ts);
  [`web/src/components/rideNotify.ts`](../../web/src/components/rideNotify.ts);
  [`web/src/components/FamilyScreen.tsx`](../../web/src/components/FamilyScreen.tsx)
  (detail overlay wiring)
- Architecture: [`docs/architecture.md`](../../architecture.md) → Family circle
  (kids / RSVP / coverage) and Carpool (accepted ride seats); Backend (Spring
  Modulith) module discovery
- Contract / clients: [`contracts/openapi.yaml`](../../../contracts/openapi.yaml);
  [`web/src/api/`](../../web/src/api/)
- Tokens: reuse shell Playlist roles in
  [`design-tokens/tokens.json`](../../../design-tokens/tokens.json) unless a
  live-data edge needs a new role ([`docs/ui-system.md`](../../ui-system.md))

## Acceptance criteria

- [ ] Adult can complete Spotify OAuth, store refreshable tokens, and revoke;
  revoked adult loses designations and appears disconnected on kid tiles they
  owned.
- [ ] Adult can designate (and change) one Spotify playlist **per kid** in their
  circle; designation is reused across rides until changed.
- [ ] Playlist tab for a `canRoute` ride lists **one tile per attending kid** in
  the car (not one per unique parent); unconnected tiles show invite affordance.
- [ ] Connected tiles show playlist name, song count, and duration; merge hero /
  track list use `mergeTracks` over connected kids only.
- [ ] **Open in Spotify:** 1 connected → existing playlist URL (no Spotify
  create); 2+ → transient playlist on the viewing adult’s account from current
  merge order, then that URL; 0 connected → control disabled/inert.
- [ ] **Remix** visible/active only when 2+ connected; changes in-app order;
  subsequent Open uses the remixed order for the transient playlist.
- [ ] Invite-to-connect updates local sending/sent UI via a soft-succeed
  call site (no real push/SMS); mirrors Route notify pattern.
- [ ] Premium caveat remains; no Spotify Connect / remote play.
- [ ] OpenAPI + web API clients updated in the same change; no KMP
  `sharedLogic` updates; no Expo.
- [ ] Unit + integration tests for OAuth/token designate, playlist read rider
  set, and open handoff (1 vs 2+); web component tests for live Playlist wiring
  (incl. Remix visibility and Open URL behavior). Suites pass.

## Tasks

- [x] Backend: Spotify OAuth (authorize URL + callback), encrypted token
  storage, refresh, revoke; config for client id/secret/redirect
- [ ] Backend: per-adult-per-kid designated playlist persistence + list/set API
- [ ] Backend: confirmed-ride playlist read — attending kids, connection,
  designated playlist metadata + tracks for connected kids
- [ ] Backend: open/handoff — 1 → source URL; 2+ → create/replace transient
  playlist on viewer, return URL; refuse meaningfully when viewer lacks Spotify
- [ ] Contract: OpenAPI paths/schemas for the above; regenerate/align web
  clients in `web/src/api/`
- [ ] Web: wire `RidePlaylistTab` / `FamilyScreen` to live playlist read
  (drop fixture riders when live payload available)
- [ ] Web: connect + designate-playlist UX for the viewer’s kid tiles
- [ ] Web: Open / Remix behavior per Approach; invite call site parallel to
  `rideNotify` (soft-succeed)
- [ ] Tests: backend unit + integration for token/designate/read/open; web
  component tests for rider tiles, Open URL rules, Remix gating, invite local UI

## Open questions

- **Which adult “owns” a kid tile when two circle parents could connect?**
  **Proposal:** designation is `(adultId, kidId)`; tile is connected if **any**
  valid designation exists for that kid; viewer manages only their own
  designations; invite targets other circle adults for that kid (soft-fail).
- **Transient playlist hygiene:** **Proposal:** reuse one private playlist id
  per viewing adult (e.g. “Carpool merge”) and replace items on each Open with
  2+ connected — avoids littering Spotify; document in code. Do not share that
  playlist across adults.
- **Spotify Dev Mode allowlist:** dogfood limited to ~5 users until Extended
  Quota; treat as ops note, not a product AC blocker for the code path.
- **Drive minutes when Route is `UNAVAILABLE`:** **Proposal:** omit precise
  “covers the ~N min drive” number or show qualitative copy only — do not
  fall back to fixture minutes.
