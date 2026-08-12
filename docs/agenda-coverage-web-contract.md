# Agenda coverage — web behavior contract (reference client)

Status: **stable** (web dogfood complete — 2026-08-12; iOS ported to this contract)  
Parent: [coverage-confirm-decline](specs/archive/coverage-confirm-decline.md)

Web Agenda is the **source of truth** for coverage + leave-from **client UX**.
iOS and Android ports must match these rules and copy; do not invent parallel
patterns. Toolkit chrome may differ; **decisions and strings** must not.

Reference implementation: `web/src/components/FamilyScreen.tsx` (Agenda + Places
default leave-from + event compose).

## Layout

- Agenda section stacks with `--fc-space-xl` (24px) between the **Agenda**
  heading, kid filter chips (`All kids` + kid name buttons), and the event
  list — chrome must not sit flush against events.
- Extra `--fc-space-md` (12px) above the event list after the filter chips
  (`mt` on the list).
- Agenda **items** are clearly separated from each other:
  - list gap `--fc-space-2xl` (32px)
  - each item: bottom border + `--fc-space-xl` (24px) padding (omitted on last)
  - Controls for one item must not read as belonging to the next.

## Busy / loading indicators

- **Sign out** always stays labeled “Sign out” — never hijacked as a global
  “Working…” / busy indicator.
- Busy feedback lives on the **focused control** only (spinner + label on the
  button). **No** separate banner/chip above Agenda or inside the compose
  dialog.
  - Event compose: Save → spinner + “Saving…” (`aria-busy` on the dialog).
  - Agenda list refresh via Load more → spinner + “Loading…”.
  - While Agenda calendar is loading and the list is empty, do **not** show
    “No events in the loaded window.” — keep busy on Load more → Loading…
    instead (initial fetch and Load more).
- Empty-state primary actions may still use local labels on their own buttons
  (e.g. Creating… / Joining…).
- Clients must not clear global busy from a parallel feeds fetch while calendar
  is still loading (iOS: `loadFeeds` must not clear `isLoading` unless it owns
  the busy, e.g. Refresh).

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

- **My default leave-from** control on Places: None + located places.
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

## Port checklist (iOS then Android)

Match web for each item before calling the port done:

1. Layout spacing (section / filters / items).
2. Busy on focused button only; Sign out label stable.
3. Manual: Edit + Remove only; Open Places for `NO_ORIGIN`.
4. Sole-option rules for adult / kid / leave-from.
5. Coverage lines, needs-coverage, confirm/decline, assign defaults + self-confirm.
6. Default leave-from on Places.
7. Tests covering the matrix above (especially sole kid, kid-toggle without
   clearing adult, Save → Saving… without Sign out → Working…).

## Out of scope here

- Conflict amber UI (`conflict-detection`).
- Vehicle / seats / nonplayers / trip planning.
- Redesigning Calendar onto full UI-token adoption (`ui-system-destination-adoption`).
