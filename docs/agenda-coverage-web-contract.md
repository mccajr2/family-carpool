# Agenda coverage — web behavior contract (reference client)

Status: **stable** (web dogfood complete — 2026-08-12; iOS + Android ported to this contract)  
Parent: [coverage-confirm-decline](specs/archive/coverage-confirm-decline.md)

Web Agenda is the **source of truth** for coverage + leave-from **client UX**.
iOS and Android ports must match these rules and copy; do not invent parallel
patterns. Toolkit chrome may differ; **decisions and strings** must not.

Reference implementation: `web/src/components/FamilyScreen.tsx` (Agenda + Places
default leave-from + event compose).

Shared leave-by reason copy (all clients): `No leave-from place yet` /
`Add a location to estimate leave-by` / `Couldn't locate the destination` /
`Leave-by estimate unavailable`; estimate line `Leave by ~{time} · estimate`.

## Layout

- Agenda section stacks with `--fc-space-xl` (24px) between the **Agenda**
  heading, kid filter chips (`All kids` + kid name buttons), and the event
  list / empty copy / Load more — chrome must not sit flush against events.
  (Web: one `flex`/`gap` column; Android: `Column` + `FcSpaceXl`; iOS:
  `VStack(spacing: UiTokens.Space.xl)` **inside** `calendarDestination`.)
- Extra `--fc-space-md` (12px) above the event list after the filter chips
  (`mt` / top padding on the list).
- Agenda **items** are clearly separated from each other:
  - list gap `--fc-space-2xl` (32px)
  - each item: bottom border + `--fc-space-xl` (24px) padding (omitted on last)
  - Controls for one item must not read as belonging to the next.

## Field rows (single-value attributes)

Single-value attributes use one **horizontal field row**: attribute label on the
**leading** side, current value or native picker on the **trailing** side.
Do not stack a tiny label above an unlabeled link/button.

Applies to:

- **Leave from** (Agenda item)
- **Covering adult** (Assign coverage)
- **My default leave-from** (Places)

Rules:

- Interactive: platform-native chooser (web `<select>`, iOS `Menu`, Android
  dropdown) showing the **current value** on the trailing side, with a clear
  affordance (chevron / control chrome).
- Sole / read-only (≤1 option): same row layout; trailing side is plain text
  (no chooser, no chevron). Applies to **Leave from** and **Covering adult**.
- **My default leave-from** is always a chooser: **None** is always an option
  (plus located places). Trailing side stays interactive even when there are
  zero located places (value may read `None` / `No located places yet`).
- Does **not** apply to multi-select **Uncovered kids** (checkbox list) or to
  action buttons (Assign / Confirm / Open Places / etc.).

Toolkit chrome may differ; **layout and strings** must not.

## Busy / loading indicators

- **Sign out** always stays labeled “Sign out” — never hijacked as a global
  “Working…” / busy indicator.
- **No** separate banner/chip above Agenda or inside the compose surface.
- Clients use one shared busy flag for in-flight family mutations. Labeled
  spinner+copy targets are:
  - Event compose: Save → spinner + “Saving…” (web also sets `aria-busy` on
    the dialog; native may use accessibility labels instead).
  - Agenda list: Load more → spinner + “Loading…” when the calendar list is
    busy and compose is closed (includes Load more itself and other Agenda
    mutations that share the busy flag). Other Agenda action buttons disable
    without their own busy labels.
- While Agenda calendar is loading and the list is empty, do **not** show
  “No events in the loaded window.” — keep busy on Load more → Loading…
  instead (initial in-Agenda fetch and Load more).
- Empty-state primary actions may still use local labels on their own buttons
  (e.g. Creating… / Joining…).
- Clients must not clear global busy from a parallel feeds fetch while calendar
  is still loading (iOS: `loadFeeds` must not clear `isLoading` unless it owns
  the busy, e.g. Refresh). Android: mirror mid-request busy into Compose
  (`stateListener` / equivalent) so Loading… / Saving… appear before await
  returns.

## Manual event controls

- Manual rows: **Edit** and **Remove event** only (adjacent).
- Do **not** show a separate **Edit location** button — destination / location
  fixes go through **Edit** (same compose dialog).
- Leave-by `NO_ORIGIN`: show **Open Places** recovery (navigates to Places).
- Leave-by unavailable copy stays as leave-by labels (estimate / reason
  strings); no duplicate edit affordance.

## Leave-from (per item)

- ≤1 **located** place → show a **label** (current leave-from name, or the sole
  located place name, or empty-state copy). No chooser.
- 2+ located places → select/menu to set per-item override (located only).
- Unlocated places appear disabled in the chooser when a chooser is shown.

## Default leave-from (Places)

- **My default leave-from** control on Places: always a field-row chooser with
  **None** + located places (see field-row rules above).
- Used by leave-by origin order (override → default → first located by name);
  not shown as a second chooser on every Agenda row when unnecessary.

## Coverage

### Display

- Active rows (`PENDING` / `CONFIRMED`):  
  `{adult} · {kids} · {Pending|Confirmed}` (+ **Remove coverage**).
- Declined rows are not shown as active coverage.
- Uncovered kids: **Needs coverage** / **Needs coverage: {names}**.
- Pending for signed-in adult: **Confirm coverage** and **Decline coverage**.

### Assign

- Show assign UI only when there are uncovered kids and at least one member.
- **Sole uncovered kid** → no kid checkboxes; that kid is implicit on Assign.
- **Sole circle adult** → no covering-adult picker; that adult is implicit.
- Otherwise covering adult **defaults to the signed-in member** when they are
  in the circle (do not wipe that default when toggling kids).
- Multiple uncovered kids → checkboxes; Assign disabled until ≥1 kid selected
  (and a covering adult is set).
- Button label: **Assign coverage**.
- Self-assign (covering adult === signed-in adult) → API returns `CONFIRMED`;
  UI must not imply a confirm step is still required for that assignment.

## Port checklist (iOS + Android)

Match this contract for each item before calling the port done:

1. Layout spacing (section / filters / items).
2. Busy labels on Save / Load more; Sign out label stable; no Agenda banner.
3. Manual: Edit + Remove only; Open Places for `NO_ORIGIN`.
4. Sole-option rules for adult / kid / leave-from (Agenda); Places default
   always chooser with None.
5. Coverage lines, needs-coverage, confirm/decline, assign defaults + self-confirm.
6. Default leave-from on Places.
7. Field rows: Leave from / Covering adult / My default leave-from are
   horizontal (label leading, value/picker trailing).
8. Tests covering the matrix above (especially sole kid, kid-toggle without
   clearing adult, Save → Saving… without Sign out → Working…).

## Toolkit differences (OK)

Compose as dialog (web) vs sheet (iOS) vs destination swap (Android);
`aria-busy` web-only; Sign out placement in shell chrome.

## Out of scope here

- Conflict amber UI (`conflict-detection`).
- Vehicle / seats / nonplayers / trip planning.
- Redesigning Calendar onto full UI-token adoption (`ui-system-destination-adoption`).
- Per-coverage leave-from (`coverage-leave-from`).
