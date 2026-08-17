# Spec: web-shell-nav-rail

Status: in-progress  
Created: 2026-08-17  
Updated: 2026-08-17  
Approved: 2026-08-17  
Parent: [docs/roadmap.md](../../roadmap.md)  
Branch: `web-shell-nav-rail`  
Added: 2026-08-17 · enhancement

Scope: **web signed-in sidebar chrome only.** Same destinations and handlers as
[`app-shell-navigation`](../archive/app-shell-navigation.md). No OpenAPI,
backend, iOS, or Android.

## Problem

The web sidebar already has the right destinations (Calendar / Carpool /
Family, Settings: Places / Garage / Feeds, Account + Sign out) but it is a
theme-following raised card, not the always-dark docked rail in the Claude
Calendar + Feeds mockups. Primary items lack icons; Account sits in the
Settings stack instead of a pinned **ACCOUNT** footer. The result is a
generic card that does not match the rest of the visual-language cluster
(Focus card, chips, week-glance).

## Non-goals

- Changing destination set, order, or click handlers (Caregiver still omits
  Feeds; Garage stays even though the Calendar crop hides it)
- iOS / Android bottom tabs (chrome differs; IA already matches)
- Agenda, Focus card, Feeds page, week-at-a-glance, or carpool right-rail
  restyles (`agenda-focus-card-polish`, `agenda-list-chips`,
  `feeds-page-redesign`, `agenda-week-glance`, `carpool-multi-stop`)
- Renaming packages or product identity (`app-identity-rename`); the rail
  wordmark is placeholder chrome (accent mark), not a name we lock in
  tests or copy
- Reusing `hero*` token roles on the rail (`hero*` stays Focus-card urgent
  spotlight only)
- Deep links / URL restore beyond today’s in-app `setDestination`
- Signed-out auth or create/join-circle empty states (no rail there)

## Approach

Restyle `web/src/components/FamilyScreen.tsx`’s `<aside aria-label="App
navigation">` and `web/src/components/shellNav.tsx`. Handlers stay
`setDestination(...)` / `onSignOut`. Icons already exist in `uiIcons.ts`
(`icon.calendar`, `icon.carpool`, `icon.family`, `icon.places`,
`icon.garage`, `icon.feeds`, `icon.signout`).

**Tokens — new `rail*` family, not `hero*`.** The rail is theme-independent
dark (light page + dark rail; still dark when the site is in dark mode).
Locked visual language forbids using `hero*` outside the Focus card, so add
dedicated roles with the **same hex in light and dark**:

| Role | Hex | Use |
|------|-----|-----|
| `railSurface` | `#16181A` | Rail background |
| `railOn` | `#FFFFFF` | Primary labels, wordmark, initials |
| `railOnSecondary` | `#9AA0A8` | SETTINGS / ACCOUNT captions, email/role meta |
| `railActive` | `#242832` | Selected-row fill (quiet darker rect, **not** bright `accent`) |
| `railAccent` | `#5E6DFF` | Wordmark square; idle icons (3:1 on `railSurface`) |
| `railDanger` | `#F2994A` | Sign out text/icon (light `--fc-danger` fails on charcoal) |

Hex overlap with `hero*` is coincidence. Rail CSS must use `--fc-rail-*`
only — never `--fc-hero-*`. After editing `tokens.json`, run
`node design-tokens/generate.mjs` (rewrites web CSS **and** Kotlin/Swift
outputs — check those generated files in). Extend
`design-tokens/contrast.test.mjs` + `generate.test.mjs` role lists. Update
`docs/ui-system.md` color-role table.

**Layout — three zones, ACCOUNT never scrolls away**

The mock’s rail hides ACCOUNT below the fold (you have to scroll). We
deviate: **bottom is right; scrolling to reach Sign out is not.** Three
flex zones inside the aside, at **every** breakpoint:

1. **Wordmark** — `shrink-0`
2. **Nav list** — primary + SETTINGS; `flex-1 min-h-0 overflow-y-auto`
   (this is the only region that may scroll)
3. **ACCOUNT** — `shrink-0`; avatar, email, role, Sign out. Not inside
   the scrolling list. Always on screen whenever the rail is on screen.

- `md+`: docked (`sticky top-0 h-svh`, `flex-col`). Keep today’s `md:w-56`.
- Narrow: stacked above content; still `rail*`. Use `min-h-svh` so ACCOUNT
  sits at the bottom of the first screen; scrolling the **page** to Agenda
  may move the whole rail (do **not** `position:fixed` Sign out over the
  calendar).

**Chrome (Calendar mock + Feeds ACCOUNT footer)**

1. **Wordmark** — small `railAccent` rounded square + a short display-font
   label (`--fc-font-family-display`). Mock copy is a **placeholder**, not
   product identity: do not treat any particular string as required, and
   do **not** write tests that assert it. Not a destination control (not a
   button). Real naming is `[app-identity-rename](../planned/app-identity-rename.md)`.
2. **Primary** — Calendar / Carpool / Family: leading semantic icon +
   label. Active = `railActive` rounded rect spanning icon+label and
   `aria-current="page"`. Idle = `railOn` text, `railAccent` (or
   `railOnSecondary`) icon. No tinted square chips.
3. **SETTINGS** — drop the nested **General** group label. Keep Places,
   **Garage**, Feeds (Organizer only). Same icon+label treatment as
   primary; **no chevrons**. Active uses `railActive`, not `accent`.
4. **ACCOUNT** — caption **ACCOUNT**; circular initials avatar from
   `adult.displayName` (up to two letters from the first two words) else
   the first letter of the email local-part; truncated email; humanized
   role (`ORGANIZER` → `Organizer`, `CAREGIVER` → `Caregiver`). Not a
   button. Sign out: danger text (`railDanger`), no chevron, no full-row
   red fill — quieter than primary, matching the existing destructive
   rule. This block is a **pinned footer** (zone 3), always visible
   without scrolling the rail.

Reference: Calendar light screenshot (rail + wordmark + primary +
SETTINGS). ACCOUNT and Garage are locked from the Feeds mock and
[`app-shell-navigation`](../archive/app-shell-navigation.md) — the Calendar
crop simply cuts them off.

## Acceptance criteria

- [ ] Signed-in web rail uses `rail*` tokens only (no `hero*`, no
      theme-following `surfaceRaised` / `textPrimary` / `accent` fill on
      the aside). Light and dark page themes both show the same charcoal
      rail.
- [ ] ACCOUNT + Sign out are always visible without scrolling the rail
      (pinned footer, `shrink-0`). Primary + SETTINGS may scroll inside
      the rail if they overflow. `md+`: docked `h-svh`. Narrow: stacked,
      `min-h-svh`, still always-dark; no fixed overlay over Agenda.
- [ ] Rail has a non-interactive wordmark (accent square + display-font
      label). It is not a destination control. Packages / API identity
      unchanged. Tests must **not** assert any particular wordmark string.
- [ ] Primary rows have leading icons; active state is a quiet
      `railActive` rect (`aria-current="page"`), not a bright accent pill.
- [ ] Settings: Places, Garage, Feeds (Organizer); no **General** label;
      Caregiver still omits Feeds. Same `setDestination` handlers.
- [ ] ACCOUNT: initials avatar, truncated email, humanized role, Sign out
      (`railDanger`, no chevron). Sign out still calls `onSignOut`.
      FamilyScreen test: Sign out is in the rail footer, **not** nested
      in the scrolling primary/SETTINGS region.
- [ ] `node design-tokens/generate.mjs --check` passes. `rail*` pairings
      in `contrast.test.mjs` meet WCAG AA (4.5:1 text, 3.0:1 `railAccent`
      as icon) in **both** schemes.
- [ ] Web tests updated: `shellNav.test.tsx` (icons, rail classes, avatar
      initials, humanized role) and FamilyScreen sidebar test (no General
      label, wordmark present and not a button, ACCOUNT visible,
      destinations unchanged — **no** wordmark-string assertion).
      Caregiver Feeds omission still passes.

## Tasks

- [x] Tokens: add `rail*` roles (same hex light + dark) to
      `design-tokens/tokens.json`; note them in `meta.description`. Run
      `node design-tokens/generate.mjs` then `--check`. Extend
      `generate.test.mjs` + `contrast.test.mjs`. Update
      `docs/ui-system.md` color-role table.
- [x] Web: restyle `FamilyScreen` aside — three-zone flex (wordmark /
      scrollable nav / pinned ACCOUNT footer), docked `md+`, `min-h-svh`
      narrow, flatten Settings. Pass icons into `ShellNavButton`.
- [ ] Web: restyle `shellNav.tsx` — `rail*` classes; primary + settings
      rows as icon+label (no chips/chevrons); `AccountSummaryRow` initials
      + humanized role. Extract a tiny initials helper next to the
      component (Fast Refresh: not in the same file as a React export if
      that would break HMR — follow `agendaFocusRing.ts`).
- [ ] Tests: `shellNav.test.tsx` + FamilyScreen sidebar assertions; token
      contrast/declaration tests. Run `npm test` in `web/` and
      `node --test design-tokens/*.test.mjs`. Fix real regressions.

## Open questions

None. Calendar crop vs Feeds ACCOUNT footer and Garage-not-in-crop are
resolved by the locked **Web shell rail** decision — keep both. ACCOUNT
below the fold in the mock is a **deliberate deviation**: pin it so Sign
out is always visible.
