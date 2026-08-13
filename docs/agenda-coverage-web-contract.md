# Agenda coverage — web behavior contract (reference client)

Status: **stable** (web dogfood complete — 2026-08-12; iOS + Android ported to this contract;
presentation hierarchy via [`calendar-ux-flow`](specs/archive/calendar-ux-flow.md))  
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

## Presentation hierarchy

Locked for [`calendar-ux-flow`](specs/archive/calendar-ux-flow.md). Durable
tenets / busy ladder: [`architecture.md` Interaction UX](architecture.md).

**Selection A — spacing / proximity only.** Group with hierarchy, type weight,
and spacing. Do **not** add card, muted band, or bordered subsection chrome
inside an Agenda item. Critical regroup of attribute **order / proximity** is
allowed; behavior and copy in this contract stay authoritative.

**No accordion / nested Agenda screens** in this slice. If still too dense after
dogfood, escalate via the busy ladder (architecture) — possible follow-up
`calendar-ux-disclosure`, not ad-hoc chrome.

### Bands (within one Agenda item)

Starting target for ports (adjust only with a written regroup outcome):

1. **Primary** — title + when (location with event identity when present);
   stronger type / weight than meta.
2. **Travel / origin** — leave-by + Leave from (+ **Open Places** when
   `NO_ORIGIN`). Keep travel together; not in the title band.
3. **People / source** — source label, kids on the event.
4. **Coverage / actions** — active coverage lines, needs-coverage,
   Confirm/Decline, Assign, Edit/Remove — one spacing-grouped region, no inner
   card/band.

### Situational primary CTA

Among an item’s action buttons:

- **Confirm coverage** shown (pending for signed-in adult) → Confirm is the
  filled/emphasized primary; **Decline coverage** stays secondary.
- Else **Assign coverage** shown → Assign is the filled/emphasized primary;
  Edit / Remove / Open Places stay secondary.
- Neither Confirm nor Assign → no fake primary; Edit/Remove remain secondary
  peers.

Event compose **Save** remains the primary action on the compose surface
(Saving… rule unchanged). Calendar **Add** stays the clear create entry point.

### Regroup outcome (vs flat stack before `calendar-ux-flow`)

**Today’s web stack (flat):** title → when → source → location → kids → leave-by
in one meta dump; **Edit / Remove** peer to that dump on wide layouts; then
Leave from (+ Open Places); then coverage lines / needs-coverage / Confirm /
Decline / Assign. Travel is split (leave-by in the dump, Leave from below
actions). Edit/Remove compete visually with later Confirm/Assign. Source and
kids sit between identity and leave-by, so “who” and “when to leave” blur.

**Chosen order (selection A — spacing only):**

| Band | Contents | Why |
|------|----------|-----|
| Primary | title, when, location | Event identity first; location belongs with “where is this,” not travel timing |
| Travel / origin | leave-by, Leave from, Open Places (`NO_ORIGIN`) | Keep leave timing + origin together so adults answer “when do I leave / from where?” in one place; recovery stays with the gap |
| People / source | source label, kids on the event | Who the event is about / where it came from — separate from travel |
| Coverage / actions | coverage lines, needs-coverage, Confirm/Decline, Assign, Edit/Remove | Responsibility + situational CTAs as one proximity group; Edit/Remove stay secondary peers (never fake primary when Confirm/Assign exists) |

**Forward-looking seams (not shipped here):** conflict chrome can attach to the
item (primary or a future status affordance) without inventing a new dump;
per-coverage leave-from can extend Travel later; carpool request/accept stays
on the **Carpool** destination — not absorbed into Coverage / actions.

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
- Multiple uncovered kids → checkboxes **pre-checked for all uncovered**;
  Assign enabled when ≥1 kid remains selected (and a covering adult is set).
  Adults can deselect kids before assigning.
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
8. Presentation hierarchy (selection A): bands + one situational primary CTA;
   no inner card/band; no accordion in this slice.
9. Tests covering the matrix above (especially sole kid, kid-toggle without
   clearing adult, Save → Saving… without Sign out → Working…).

## Toolkit differences (OK)

Compose as dialog (web) vs sheet (iOS) vs destination swap (Android);
`aria-busy` web-only; Sign out placement in shell chrome.

## Out of scope here

- Conflict amber UI (`conflict-detection`).
- Vehicle / seats / nonplayers / trip planning.
- Redesigning Calendar onto full UI-token adoption (`ui-system-destination-adoption`).
- Per-coverage leave-from (`coverage-leave-from`).
