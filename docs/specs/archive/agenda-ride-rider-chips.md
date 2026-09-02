# Spec: agenda-ride-rider-chips

Status: archived  
Completed: 2026-09-01  
Parent: [docs/roadmap.md](../../roadmap.md)  
Created: 2026-08-26  
Updated: 2026-09-01 (`/pr`)  
Added: 2026-08-26 · enhancement  
Branch: `agenda-ride-rider-chips`

## Problem

When a ride is resolved — household driver confirmed, another adult driving, or
riding with a teammate — Agenda shows a status chip (`You're driving`,
`{name} driving`, `Riding with {circle}`) and sometimes an opaque `· +{n}`
suffix for accepted carpool kids. Adults cannot see **who** is in the car at a
glance without expanding the row or reading ride-line prose.

Profile photos do not exist yet; names and initials should carry dogfood until
[`member-profile-photos`](../planned/member-profile-photos.md).

## Non-goals

- Photo upload / storage — [`member-profile-photos`](../planned/member-profile-photos.md)
- Ride action parity, who/where/kids/seats text density, or `PickupLine` —
  already shipped in sibling slices
- Re-adding **covering-adult** avatars on collapsed rows (archived
  [`agenda-list-chips`](../archive/agenda-list-chips.md); coverage is chip-only
  on Agenda now)
- Hero attention carousel slides — queue items are gaps and inbound asks, not
  resolved “who's riding” states
- `AgendaFocusCard` wiring (not mounted in `FamilyScreen`; skip unless a
  one-line shared component drop-in is free)
- Replacing or changing ride-status chip **labels/precedence** (see
  [`unified-ride-status-chip`](../archive/unified-ride-status-chip.md))
- Pending carpool asks, ride-needed / asked-team states, or out-of-play rows
- Multi-stop passenger ordering — [`carpool-multi-stop`](../planned/carpool-multi-stop.md)
- OpenAPI / backend changes
- Expo / KMP Agenda UI

## Approach

**Web Calendar only.** No contract bump. Reuse existing view-model data from
`coverageQueue.ts` (`CoverageGameEvent`, `acceptedRiders`, `mapCalendarItemToCoverageGames`)
and `heroKidFirstName` from `heroAttentionCopy.ts`.

### 1. Pure rider list helper

Add a small pure module (e.g. `riderChips.ts` colocated with `rideStatusChip.ts`)
that returns ordered `{ firstName, initial }` descriptors for a calendar item's
**resolved ride** state:

| Ride chip state (from `rideStatusChipForGameRow` / item aggregate) | Riders to show |
| --- | --- |
| Confirmed household driver (`isConfirmedDriver`) | Every **in-play** circle kid on the item whose game row is `isConfirmedDriver`, **plus** each accepted inbound kid first name from `acceptedRiders` on the shared event requests (dedupe names) |
| Teammate ride (`ownRequest.status === "ACCEPTED"`) | Every **in-play** circle kid on the item covered by that accepted own request |
| All other states | **No rider chips** (empty list) |

- **First name:** `heroKidFirstName` for circle kids; first token of each
  `kidFirstNames` entry for accepted teammates (API already supplies first names).
- **Initial:** first grapheme of `firstName`, uppercased; `?` when blank.
- **Order:** circle kids first (stable `order` on game rows), then accepted
  teammate kids (request order).

### 2. Shared `RiderChips` component

Colocate under `web/src/components/`:

- One row of **initial circle + first-name label** per rider (mock GameCard
  expanded kid row pattern — see
  [`carpool-hero-flow-mockup-v6.jsx`](../../ui-system/carpool-hero-flow-mockup-v6.jsx)
  `GameCard` open body).
- **Collapsed summary:** when `riders.length > 0`, render below the when/where
  meta block (or immediately above status chips if layout fits mock) inside the
  collapsed `AgendaRow` toggle — not inside the chip cluster.
- **Expanded per-kid band:** replace the ad-hoc `size-7` accent circle in
  `AgendaRow` with this component for consistency (same tokens).
- **Stacking:** when space is tight on collapsed rows, circles may overlap
  (reuse existing `listRowAvatar` / `listRowAvatarOverlap` / `listRowAvatarBorder`
  tokens from [`agenda-list-chips`](../archive/agenda-list-chips.md)); first
  names stay visible beside or under the stack per mock — do not truncate names.
- **a11y:** container `aria-label` e.g. `Riding: Declan, Ben`; each circle
  `aria-hidden` when the name is visible, or `aria-label` when names are
  icon-only in a stacked-only variant.
- **Tokens:** prefer `listRowKidAvatar` + `listRowAvatarLabel` for circle size
  and initials type; add roles only if mock measurement diverges — do not snap
  to unrelated sizes (`docs/ui-system.md`).

### 3. Chip copy adjustment

When `RiderChips` renders for an item, **drop the `· +{n}` suffix** from the
ride-status chip (`rideStatusChip.ts` `drivingLabel`) — rider identities are
visible in chips; keep `You're driving` / `{name} driving` / `Riding with …`
unchanged.

### 4. Surfaces

| Surface | When |
| --- | --- |
| Collapsed `AgendaRow` | `ridersForItem(...).length > 0` |
| Expanded `AgendaRow` per-kid header | Same kid appears in that item's rider list for the row's resolved state (subset per kid row when multi-kid states diverge — use per-game-row helper) |

Do not add rider chips to `HeroAttentionSlide` or inbound ask bands.

## Context

Allowlist for `/implement`. Paths and **headings**, not whole-doc dumps.

- Visual source: [`docs/ui-system/carpool-hero-flow-mockup-v6.jsx`](../../ui-system/carpool-hero-flow-mockup-v6.jsx) → `GameCard` expanded kid row
- Design tokens: [`docs/ui-system.md`](../../ui-system.md) (`listRowKidAvatar`, `listRowAvatar*`)
- Archived chip rules (do not change precedence): [`docs/specs/archive/unified-ride-status-chip.md`](../archive/unified-ride-status-chip.md)
- Archived list avatar pattern (overlap tokens only): [`docs/specs/archive/agenda-list-chips.md`](../archive/agenda-list-chips.md) → §3 Covering avatar(s)
- View-model: `web/src/components/coverageQueue.ts` (`acceptedRiders`, `mapCalendarItemToCoverageGames`)
- Chip helper: `web/src/components/rideStatusChip.ts` (+ `.test.ts`)
- First-name helper: `web/src/components/heroAttentionCopy.ts` → `heroKidFirstName`
- Consumers: `web/src/components/AgendaRow.tsx` (+ `.test.tsx`)
- Tokens: `design-tokens/tokens.json` (only if new roles required)

## Acceptance criteria

- [x] Collapsed `AgendaRow` with a confirmed household driver shows **RiderChips**
      for every in-play circle kid on that item plus accepted teammate first
      names; ride-needed / asked-team / pending-confirm / not-going rows do not.
- [x] Collapsed row with teammate ride (`Riding with …` chip) shows **RiderChips**
      for in-play circle kids on that accepted own request.
- [x] Ride-status chip no longer appends `· +{n}` when rider chips are shown for
      the same item; chip still reads `You're driving` or `{name} driving`.
- [x] Multi-kid event: when two kids share the same confirmed driver, both circle
      kids appear in rider chips on the collapsed row.
- [x] Expanded per-kid band uses the shared `RiderChips` component (token-driven
      circle size/type — no raw `size-7` / hex).
- [x] `aria-label` on the rider group names all riders for screen readers.
- [x] `cd web && npm test`, `npm run lint`, and
      `node design-tokens/generate.mjs --check` pass.

## Tasks

- [x] **Web:** `riderChips.ts` pure helpers + unit tests (driver, teammate ride,
      empty, dedupe, multi-kid).
- [x] **Web:** `RiderChips.tsx` component + colocated tests (labels, a11y,
      overlap layout).
- [x] **Web:** wire collapsed + expanded `AgendaRow`; adjust `drivingLabel` in
      `rideStatusChip.ts` when riders are present.
- [x] **Tokens:** only if mock measurement requires new roles; regenerate +
      WCAG AA on new text/fill pairings. *(No new roles — existing `listRowKidAvatar` / `listRowAvatar*` suffice.)*
- [x] **Tests:** extend `AgendaRow.test.tsx` and `rideStatusChip.test.ts` for AC
      fixtures (driving + accepted riders, teammate ride, no chips on gap).

## Open questions

None — stub + mock GameCard kid row are sufficient. If collapsed-row placement
conflicts with an older layout lock, defer to the mock per `docs/ui-system.md`.
