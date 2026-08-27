# Agenda coverage — web behavior contract (reference client)

Status: **stable** (web dogfood complete — 2026-08-12; iOS + Android ported to this contract;
presentation hierarchy via [`calendar-ux-flow`](specs/archive/calendar-ux-flow.md);
conflict amber via [`conflict-detection`](specs/archive/conflict-detection.md))  
Parent: [coverage-confirm-decline](specs/archive/coverage-confirm-decline.md) ·
[conflict-detection](specs/archive/conflict-detection.md)

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
  heading, kid filter chips (`All kids` + one chip per kid name — web:
  `AgendaKidFilterChip`, not shadcn Buttons), and the event
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

Agenda presentation hierarchy is now governed by
`docs/agenda-full-redesign-addendum.md` (flat rows) and
`docs/agenda-focus-card-addendum.md` (the promoted item). This section is
retired.

**Bands, situational primary CTA, and out-of-play rules below still apply**
inside the **expanded** `AgendaRow`. They do **not** apply to the Focus card
body — Focus is summary + one next action (see
[`docs/agenda-focus-card-addendum.md`](agenda-focus-card-addendum.md)).

### Bands (within one Agenda item)

Starting target for ports (adjust only with a written regroup outcome):

1. **Primary** — title + when (location with event identity when present);
   stronger type / weight than meta.
2. **Travel / origin** — leave-by + Leave from (+ **Open Places** when
   `NO_ORIGIN`). Keep travel together; not in the title band.
3. **People / source** — source label + **per-kid RSVP** field rows (name
   leading, Yes / No / No response trailing).
4. **Coverage / actions** — active coverage lines, needs-coverage,
   Confirm/Decline, Assign — one spacing-grouped region, no inner card/band.
5. **Manual actions** — Edit / Remove for manual rows only (outside coverage so
   they remain when the row is out of play).

**Out of play** (every kid on the item is RSVP **No**): deemphasize the item
(muted / reduced opacity); hide Travel, Coverage, and conflict amber; keep
Primary summary, People RSVP rows, and Manual Edit/Remove. Mixed Yes/No stays
in play; No kids are omitted from uncovered / Assign.

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
| Primary | title, when, location, **conflict status lines** (when `conflicts` non-empty) | Event identity first; amber conflict copy attaches here as a status affordance — not a new control dump |
| Travel / origin | leave-by, Leave from, Open Places (`NO_ORIGIN`) | Keep leave timing + origin together so adults answer “when do I leave / from where?” in one place; recovery stays with the gap |
| People / source | source label, **per-kid RSVP** field rows | Who is going (Yes / No / No response); attendance is separate from coverage |
| Coverage / actions | coverage lines, needs-coverage, Confirm/Decline, Assign | Responsibility + situational CTAs; Edit/Remove moved to Manual actions |
| Manual actions | Edit / Remove (manual only) | Stay available when out of play; never fake primary when Confirm/Assign exists |

### Conflict chrome (server-owned)

- Render from `CalendarItem.conflicts` only — do **not** re-derive overlap
  rules on the client for truth.
- Amber status lines under the primary band (`data-testid` /
  `agenda-conflicts-{source}-{id}` on web). Provisional warning color is OK
  until token adoption.
- Copy helpers (web reference: `conflictDisplay.ts`):
  - Kid: `{kidName} overlaps {otherTitle}` or `Kid schedule overlaps {otherTitle}`
  - Adult: `{adultDisplayName} also covering {otherTitle}`
- Confirm / self-assign **409** for overlapping double-CONFIRMED: keep prior
  Agenda state; show
  `Already confirmed on an overlapping event — decline or reassign first.`
  (web: `coverageDoubleBookMessage`) **on that Agenda item, immediately under
  the Confirm / Assign controls** — not in the top-of-Agenda status banner.
  Do not treat as success or retry as OK.
- No auto-resolve UI.

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

- Manual rows: **Edit** and **Remove event** only (adjacent), in the **Manual
  actions** band — not inside Coverage — so they remain when the row is out of
  play.
- Destination / location **and per-item leave-from** fixes go through **Edit**
  (same compose dialog). Leave-from chooser follows the Agenda contract (2+
  located places); sole located place shows a label only.
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
- Uncovered kids (API `uncoveredKidIds`): **Needs coverage** /
  **Needs coverage: {names}** (in-play only — RSVP No kids are never
  uncovered). Calendar chrome uses **remaining gap kids** =
  `uncoveredKidIds` minus kids on this circle’s **`ACCEPTED` `ownRequest`**
  (PENDING ride does not clear the gap). Names on the row copy are remaining
  gap kids only.
- Pending for signed-in adult: **Confirm coverage** and **Decline coverage**.
- **Collapsed status tags** (Focus + collapsed `AgendaRow`) share
  one precedence via `agendaItemStatusTags` + `insertOwnRideStatusChip`
  (`coverageDisplay.ts` / `carpoolDisplay.ts`):
  `Overlaps` → own-ride chip (if any) → `Needs coverage` (remaining gap) →
  **Confirm coverage** (pending-for-self) → **Awaiting confirm** (pending for
  someone else) → `Confirmed` → `All set` (Focus only, and only when there is
  **no** own-ride chip). Own-ride chip: **Riding with {acceptingCircleName}**
  (mint; blank name → **Riding with a teammate**) when `ACCEPTED`; **Requested**
  (amber) when `PENDING`. Do not use “Accepted ·” / “Accepted:”.
  **Presentation:** Feeds-aligned uppercase chips (`AgendaStatusChip`
  default/`tag`, `feedChip*` tokens) — **no** leading dot, **no** Title Case
  pills (`appearance="pill"` retired on Agenda surfaces). Canonical label
  strings stay Title Case in helpers; uppercase is CSS. Pending-for-self drives
  Focus urgent surface (no standalone list-row status dot).

### Assign

- Show assign UI only when there are **remaining gap kids** and at least one
  member (not raw `uncoveredKidIds` alone — ACCEPTED own-ride kids are out of
  the gap).
- **Sole remaining gap kid** → no kid checkboxes; that kid is implicit on
  Assign.
- **Sole circle adult** → no covering-adult picker; that adult is implicit.
- Otherwise covering adult **defaults to the signed-in member** when they are
  in the circle (do not wipe that default when toggling kids).
- Multiple remaining gap kids → checkboxes **pre-checked for all remaining
  gap kids**; Assign enabled when ≥1 kid remains selected (and a covering
  adult is set). Adults can deselect kids before assigning.
- Button label: **Assign coverage**.
- Self-assign (covering adult === signed-in adult) → API returns `CONFIRMED`;
  UI must not imply a confirm step is still required for that assignment.
- Assign / confirm also set those kids’ RSVP to **Yes** (server); assigning a
  **No** kid fails.

## RSVP

- People band: each kid is a **field row** (name leading, chooser trailing:
  No response / Yes / No). `data-testid` / a11y id `rsvp-{source}-{id}-{kidId}`.
- Client confirm only when setting No or No response while the kid has active
  coverage: `This will remove coverage for {kidName}.` Cancel leaves RSVP
  unchanged. No confirm when uncovered.
- Patch the calendar cache on RSVP writes like other single-item mutations.

## Week at a glance

Calendar **Context** aside only (web: `AgendaWeekGlance` in
`FamilyScreen.tsx`; rollup in `agendaWeekGlanceDays.ts`). Heading **Week at
a glance**. Ports must match the window, counts, and strings below
([`agenda-week-glance-mobile`](specs/planned/agenda-week-glance-mobile.md)).
Toolkit chrome may differ; **decisions and strings** must not.

### Window

- Always **today + the next four local days** (five rows; never omit a day).
  Same local-day math as Agenda grouping (`startOfLocalDay` / `addDays`).
- Subset of the seven-day **This week** list bucket (`weekEnd` = today+7).
  Days today+5 and today+6 can still appear under **This week**; they are not
  in the strip.
- Bucket an item onto the local calendar day of `startsAt`. Unparseable
  `startsAt` is skipped (no throw). Overnight events count on the start day
  only.
- Derive from the kid-filtered loaded Agenda window (web:
  `visibleCalendarItems`) — the same list as Focus + rows, **including** the
  Focus item. Do not fetch a wider range.

### Per-day status (one line)

Count **in-play events**, not kids. Out-of-play items
(`isAgendaItemOutOfPlay`) never increment uncovered / overlap / confirm
counts. A day whose only items are out-of-play is **All set**, not **No
events**. Pending-for-self uses the same `pendingCoverageForAdult` predicate
as Focus.

First match:

| Condition | Copy | Flag |
|-----------|------|------|
| Zero items that local day | **No events** | none |
| `n` in-play with **remaining gap kids** > 0 (`uncoveredKidIds` minus kids on this circle’s **ACCEPTED** `ownRequest`; PENDING does not clear) | **1 needs coverage** / **{n} need coverage** | amber |
| else `n` in-play with `conflicts.length > 0` | **1 overlaps** / **{n} overlap** | amber |
| else `n` in-play pending-for-self | **1 to confirm** / **{n} to confirm** | amber |
| else (in-play all-set, pending-for-others, out-of-play only) | **All set** | none |

Wire the same ride join as Agenda rows (`ownRequestForItem` from
`calendarRideByItemKey`). API `uncoveredKidIds` stays orthogonal; the strip
must not flag events that Focus/rows treat as covered by an ACCEPTED ride.

Two uncovered kids on **one** event still **1 needs coverage**. Pending for
someone else without uncovered / conflict is calm (**All set**) — same as
Focus `focusItemNeedsDecision` (list chip **Awaiting confirm** is not a
week-glance line).

Do **not** emit **need drivers** / **Needs driver**. Rows are not buttons or
links and must not scroll or filter the Agenda (jump-to-day stays the
calendar grid). No carpool card or **Open in Maps** in this aside.

## Port checklist (iOS + Android)

Match this contract for each item before calling the port done:

1. Layout spacing (section / filters / items).
2. Busy labels on Save / Load more; Sign out label stable; no Agenda banner.
3. Manual: Edit + Remove in Manual actions band; Open Places for `NO_ORIGIN`.
4. Sole-option rules for adult / kid / leave-from (Agenda); Places default
   always chooser with None.
5. Coverage lines, needs-coverage, confirm/decline, assign defaults + self-confirm.
6. Default leave-from on Places.
7. Field rows: Leave from / Covering adult / My default leave-from / per-kid
   RSVP are horizontal (label leading, value/picker trailing).
8. Presentation hierarchy: bands + one situational primary CTA;
   out-of-play chrome when all kids RSVP No; coverage-release confirm copy.
   Flat-row chrome is `docs/agenda-full-redesign-addendum.md` (web).
9. Tests covering the matrix above (especially sole kid, kid-toggle without
   clearing adult, Save → Saving… without Sign out → Working…).
10. Focus card selection + rendering — web only — not yet ported.
11. Full Agenda row redesign (day-grouping, card rows, expand/collapse) — web only — not yet ported.
12. Week at a glance (five-day Context strip) — web only — not yet ported.

## Toolkit differences (OK)

Compose as dialog (web) vs sheet (iOS) vs destination swap (Android);
`aria-busy` web-only; Sign out placement in shell chrome.

## Out of scope here

- Vehicle / seats / nonplayers / trip planning.
- Redesigning Calendar onto full UI-token adoption (`ui-system-destination-adoption`).
- Per-coverage leave-from (`coverage-leave-from`).
- Travel / leave-by “cutting it close” soft warn (`conflict-travel-margin`).
