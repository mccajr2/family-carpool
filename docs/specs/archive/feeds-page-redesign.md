# Spec: feeds-page-redesign

Status: archived  
Completed: 2026-08-18  
Created: 2026-08-18  
Approved: 2026-08-18  
Parent: [docs/roadmap.md](../../roadmap.md)  
Branch: `feeds-page-redesign`  
Added: 2026-08-15 · re-rank split

Scope: **web Feeds destination only** — Organizer manage-feeds list into
raised cards matching the Claude Feeds dark mock. No OpenAPI, backend,
iOS, or Android. Same add / edit / remove / Sync now / Refresh / carpool
handlers — presentation only.

## Problem

Feeds is still a utilitarian settings list: a heading plus stacked name /
sync line / `CarpoolFeedActions` text + equal-weight outline buttons
(Enable / Open / Sync now / Edit / Remove). The Claude Feeds dark mock
(2026-08-17) shows **raised cards**, uppercase **OWNED** / **NO CARPOOL**
chips, kid · synced · event-count metadata, a single primary carpool CTA
(**Open carpool** or **Enable carpool**), quieter Sync now / Edit, Remove
as text, and an **ADD A FEED** form below. That hierarchy is what makes
“this team has a carpool” scannable on the calendar you added.

## Non-goals

- Changing Enable / Request / Open / join / admit rules, confirm copy, or
  which role sees which CTA (`CarpoolFeedActions` **outcomes** stay)
- Restyling the **Carpool** destination (including default
  `CarpoolFeedActions` chrome on `CarpoolPanel`) —
  [`carpool-page-redesign`](../planned/carpool-page-redesign.md)
- Carpool multi-stop / numbered pickup card
  ([`carpool-multi-stop`](../planned/carpool-multi-stop.md))
- Feed subscribe / poller / sync semantics (list Refresh still re-GETs
  only; Sync now still per feed)
- Page header copy/type (`Feeds`, no subtitle) or shell rail / page frame
- Showing the source URL in the collapsed card (still hidden until Edit)
- iOS / Android ([`feeds-page-redesign-mobile`](../planned/feeds-page-redesign-mobile.md))
- Using `hero*` **color** roles (Focus-card urgent spotlight only)

## Approach

**No contract change.**

**Visual source:** Feeds dark screenshot (2026-08-17). Older verbatim
`FeedCard.tsx` intake is superseded by this shot — measure **this** mock
for size, weight, spacing, and color. Add or update roles in
`design-tokens/tokens.json` in the same PR (`docs/ui-system.md`). Do
**not** snap card padding, chip type, or action weights to nearby Agenda
roles. WCAG AA is the only mock-hex exception. Do **not** use `hero*`
colors on Feeds.

Extract a `FeedCard` component (web: one component per file) and replace
the inline list JSX in `FamilyScreen.tsx` (`destination === "feeds"`).
Pass through today’s handlers (`onSyncFeed`, `onSaveFeed`, `onRemoveFeed`,
edit field state, `CarpoolFeedActions` enable / request / open). Delete
local `feedKidNames` — use `eventKidNames(feed.kidIds, circle.kids)` from
`coverageDisplay.ts`. Keep `feedSyncStatusLabel` for sync copy.

**`CarpoolFeedActions` is shared with Carpool.** Add a Feeds layout
(prop/variant) used only by `FeedCard`. Default layout on `CarpoolPanel`
stays as shipped (button names **Enable** / **Open** / **Request**,
body-copy status). Feeds layout:

- Status as an **uppercase chip** (mock **OWNED** / **NO CARPOOL**; other
  `carpoolFeedStatusLabel` values also chips — REQUESTED, MEMBER, Carpool
  available). Reuse `AgendaStatusChip` `appearance="tag"` only if mock
  type/padding match; otherwise new `feedChip*` tokens — do not snap.
- Primary CTA copy **Enable carpool** / **Open carpool** (Request stays
  **Request**). Same `window.confirm` + `onEnable` / `onRequest` / `onOpen`.
- No competing body-copy status next to the chip.

**Card (view mode)**

1. Title = `feed.name` (`fc-display` if the mock’s title is display type).
   Do **not** `truncate` / `nowrap` the title (page-frame lock).
2. Meta = kids · `feedSyncStatusLabel(feed)` (same string as today, e.g.
   `Sam · Synced · 4 events`). Empty kids → sync line only.
3. Chip + primary carpool CTA (when summary is loaded).
4. Quiet **Sync now** and **Edit** (less weight than the carpool CTA).
5. **Remove** as text (less weight than Sync/Edit — visual-language lock).

Edit mode stays inline on the same card: same inputs, aria-labels, kid
checkboxes, Save / Cancel. Add form stays **below** the list, not inside
a feed card.

**Page chrome.** Keep destination `<h1>` **Feeds**. Drop the redundant
visible “Activity feeds” heading; keep `aria-label="Activity feeds"` on
the section. **Refresh** stays (list GET only) as a quiet control — the
mock may omit it; dropping it would be a behavior change.

**ADD A FEED.** Visible section label from the mock; fields and **Add feed**
button keep today’s names, validation (name + URL required), and kid
multi-select.

Regenerate tokens (`node design-tokens/generate.mjs` + `--check`). Light
and dark both consume generated vars (mock is dark; light pairings must
still be AA).

## Context

Allowlist for `/implement` — do not load the rest of `docs/`.

- Design: [`docs/ui-system.md`](../../ui-system.md) (mocks → tokens; chips;
  destructive quieter than Edit; no `hero*` on Feeds)
- Source: `web/src/components/FamilyScreen.tsx` (feeds destination +
  `feedKidNames`), `CarpoolFeedActions.tsx`, `carpoolDisplay.ts`
  (`carpoolFeedStatusLabel`, `enableCarpoolConfirmMessage`),
  `coverageDisplay.ts` (`eventKidNames`), `web/src/api/types.ts`
  (`feedSyncStatusLabel`), `agendaStatusChip.tsx` (reuse `tag` only if
  mock matches), `design-tokens/tokens.json`
- Tests: `FamilyScreen.test.tsx` (Feeds cases), `CarpoolFeedActions.test.tsx`

Do not restyle `CarpoolPanel.tsx`. Do not load archived carpool/feed
product specs unless a handler outcome is unclear from the source.

## Acceptance criteria

- [x] Each feed renders as a mock-aligned **raised card** (token surface /
      radius / padding — not a flat `li` of equal-weight buttons).
- [x] Carpool status on Feeds is an **uppercase chip** (at least **OWNED**
      and **NO CARPOOL**); primary CTA is **Enable carpool** or **Open
      carpool** (or **Request** when that is today’s CTA). Confirm-then-enable,
      request, and open still call the same handlers.
- [x] `CarpoolPanel` still shows **Enable** / **Open** / **Request** and
      body-copy status — Feeds layout does not leak onto Carpool.
- [x] Card meta is `eventKidNames` + `feedSyncStatusLabel` (e.g.
      `Sam · Synced · 4 events`); source URL stays hidden until Edit.
- [x] Sync now and Edit are quieter than the carpool CTA; Remove is text
      (less weight than Sync/Edit). Same click handlers and disabled-when-loading.
- [x] Add-feed form sits below the list with mock **ADD A FEED** labeling;
      **Add feed** still requires name + URL and assigns selected kids.
- [x] Refresh still re-GETs the feeds list and does not call Sync now.
- [x] Caregivers still have no Feeds nav row or manage UI.
- [x] Mock-measured card/chip/action type and spacing locked in
      `tokens.json` and consumed via `--fc-*` (no raw px/hex in adopted UI;
      no `hero*` color vars on Feeds).
- [x] `cd web && npm test`, `npm run lint`, and
      `node design-tokens/generate.mjs --check` pass.

## Tasks

- [x] **Tokens:** measure Feeds dark mock cards, chips, primary CTA, quiet
      actions, add-form label; add `feed*` (and chip) roles rather than
      snapping to Agenda `statusChip` / `filterChip` / `space-*`; regenerate
      + WCAG AA on new text/fill pairings.
- [x] **Web:** `FeedCard.tsx` + swap the feeds list in `FamilyScreen.tsx`;
      drop `feedKidNames` in favor of `eventKidNames`; drop visible
      “Activity feeds” heading; restyle Refresh + ADD A FEED form.
- [x] **Web:** `CarpoolFeedActions` Feeds layout (chip + Enable carpool /
      Open carpool copy); default layout unchanged for `CarpoolPanel`.
- [x] **Tests:** `FeedCard` (and/or FamilyScreen Feeds cases) — chip copy,
      Enable carpool / Open carpool, meta line, Remove still deletes, Add
      feed, Refresh does not sync; `CarpoolFeedActions` default tests still
      look for **Enable** / **Open**; new Feeds-layout cases. No
      `CarpoolPanel` visual rewrite.

## Open questions

None — Feeds dark screenshot is the intake reference (2026-08-17). If mock
px conflict with an older token lock, defer to the mock per
`docs/ui-system.md`. Button accessible names on Feeds change to **Enable
carpool** / **Open carpool**; Carpool tab keeps **Enable** / **Open**.
