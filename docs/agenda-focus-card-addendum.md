# Addendum: Focus card (supersedes "Selection A — spacing only")

Status: active on web — port to iOS/Android with
[`agenda-focus-card-mobile`](specs/planned/agenda-focus-card-mobile.md).
Replaces the "Presentation hierarchy" → "Selection A" section of
`docs/agenda-coverage-web-contract.md`. All other sections of that doc
(Coverage, RSVP, Busy/loading indicators, Field rows, Port checklist) are
**unchanged** — selection + urgent/calm surface mapping live here and in
`web/src/components/agendaFocusSelection.ts`.

## Why this supersedes Selection A

Selection A ("spacing / proximity only, no card/bordered/muted-band chrome")
was a reasonable decision under its original constraint: minimize
three-platform maintenance cost. That constraint has changed — visual
distinctiveness is now a product priority, not a nice-to-have, and is worth
the added implementation cost on each client.

## New rule

**Exactly one Agenda item at a time** may use Focus card treatment: bordered/
raised container, larger type, and a status-color accent. Selection criteria,
in order (in-play items only — never promote all-RSVP-`NO` rows):

1. The earliest item **today** that **needs a decision** (see below).
2. Else the earliest item **tomorrow** that **needs a decision**.
3. Else the **earliest in-play item** — the next event to leave for / attend,
   even when fully resolved (all-set).
4. If the Agenda is empty or every item is out-of-play, no Focus card renders
   — plain empty state.

**Needs a decision** (shared predicate for selection **and** urgent vs calm
surface on the Focus card):

- `uncoveredKidIds.length > 0` (RSVP no-response kids count as uncovered), or
- non-empty `conflicts`, or
- a **pending coverage confirm for the signed-in adult** (`PENDING` row where
  `coveringAdultId` is the viewer).

**Rest-of-week** uncovered/conflict/pending items (This week bucket, days 3–6)
do **not** steal Focus from a sooner all-set event — being on time today beats
planning Friday coverage. Those gaps stay in the flat list and will surface in
the week-at-a-glance strip ([`agenda-week-glance`](specs/planned/agenda-week-glance.md)).
Far-future items (Later bucket) likewise never beat a sooner in-play event.

**Examples**

- All-set tonight + uncovered Friday → tonight Focus; Friday is a flat row.
- All-set tonight + uncovered tomorrow → tomorrow Focus.
- All-set tonight + uncovered in 3 weeks → tonight Focus.
- Only in-play item is Friday uncovered → Friday Focus.

Carpool ride accept/decline as a Focus candidate is a follow-up
([`agenda-focus-carpool-actions`](specs/planned/agenda-focus-carpool-actions.md))
after request/accept ships — do not fold into the ranking above yet.

All *other* Agenda items are day-grouped collapsed `AgendaRow`s (expand for
write bands). Do not apply Focus card chrome to more than one item.

## Focus card content

Focus is a **spotlight summary + one next action**, not an always-expanded
copy of `AgendaRow`. Same data and the same assign/confirm/edit **handlers**
— fewer controls on the card.

**On the card**

- Compact when (`5:30 PM – 6:30 PM` today; short date prefix when not today)
  — display / `focusWhen` (15/600).
- Title (display / `focusTitle` 30/700).
- One secondary line: **`{kids} · {destination} · Leaving from {place}`** — each
  segment optional; subtitle 14/500, wraps naturally (no truncate). Event
  `location` is shown verbatim (full address until a venue lookup exists).
  Leave-from uses the **place name**, not the street address. No form labels
  (`Leave from`, `Manual`).
- Status **pills** on Focus (`Overlaps`, `Needs coverage`, `Awaiting confirm`,
  `Confirmed` / `All set`): Title Case with a leading status dot (`focusStatusPill`
  12.5/600). Collapsed `AgendaRow` tags stay uppercase compact chips
  (`statusChip` 11/700) via the same `agendaStatusChip.tsx` helper
  (`appearance="tag"` vs `"pill"`). Conflict **detail** lines are not on
  Focus; they stay in the expanded row.
- Isolated countdown ring. Under the ring (`focusRingCoveringGap` 10), one
  horizontal row in both uncovered and covered states: **Covering** label
  (left, `focusCovering`) then the control (right).
  - **More than one adult** → combobox of member names. Uncovered: defaults
    to the **signed-in adult** (`coverageAssignState`); Assign uses the
    selected adult. Covered: current covering adult selected; changing it
    **reassigns**. Sole adult uncovered: no combobox (assign is implied).
  - **Sole adult** with active coverage → static name (same row, no picker).
- **Primary CTA:** Assign coverage (uncovered), Confirm/Decline (pending for
  self), or **Remove coverage** (active coverage that is not pending-for-self).
  **Edit** (manual) opens the existing compose dialog, including **Leave from**
  when the circle has more than one located place (needed because the Focus
  item is not duplicated in the day list).
- **Open Places** only when leave-by is `NO_ORIGIN` (recovery; otherwise
  origin is display-only on Focus).

**Not on the card** (expanded `AgendaRow` unless noted)

- Leave-from dropdown, leave-by estimate line, per-kid RSVP, covering
  kid-subset checkboxes, conflict detail list.
- **Remove event** — manual compose dialog (**Edit**), not Focus and not a
  second destructive next to Edit on the hero. Expanded manual rows still
  show Remove.

The Focus item is **not** duplicated in the day list (existing rule). So
leave-from / RSVP / kid-subset for the *promoted* item are not on-screen
until a later disclosure slice — do **not** put the five-band form back on
Focus to close that gap. **Change covering adult** and **Remove coverage**
do stay on Focus, because those writes would otherwise be unreachable.
`agenda-list-chips` restyles **collapsed** rows only and must not change
expand bands. `coverage-leave-from` belongs on expanded coverage rows, not
Focus. `agenda-focus-carpool-actions` reuses the CTA row (Accept/Decline
ride later). Mobile (`agenda-focus-card-mobile`) ports this slim card, not
the old form-hero.

No accordion on Focus. No card chrome on any other item.

## Tokens used (from `design-tokens/tokens.json`)

The Focus card has two visual states that use **different token families** —
this is deliberate, not an inconsistency:

- **Resolved / "all set" state** — normal theme-following tokens:
  `surfaceRaised` (card fill), `border`, `accent`/`success` per status.
  Looks like an elevated card in whichever theme the page is in.
- **Needs-decision / urgent state** — the `hero*` role family:
  `heroSurface`, `heroOn`, `heroOnSecondary`, `heroDanger`, `heroSuccess`,
  `heroAccent`. These are **intentionally not the same as the page's
  light/dark surface** — they define a fixed "spotlight" surface so the
  urgent item reads as urgent regardless of site theme. In light mode this
  produces the dramatic dark-card-on-light-page effect; in dark mode it's a
  deliberately lighter/more saturated card than an ordinary dark-mode
  surface, so it still visibly pops rather than blending into an
  already-dark page. Do not substitute plain `surface`/`textPrimary` for
  `hero*` roles in this state, and do not use `hero*` roles anywhere outside
  the Focus card's urgent state — they exist for this one purpose.

Every `hero*` pairing is WCAG AA verified the same way as the base palette
(4.5:1 text, 3.0:1 for `heroAccent` as an icon/ring color) — see the
`meta.description` note in `tokens.json` for when these were added.

Also: `radius.xl` (added for this pattern; existing `sm/md/lg` unchanged for
everything else), `spacing.xl`/`spacing.lg` for card padding, and the new
`typography.scale.hero` entry for the card's title size.

The countdown ring is a **decorative urgency cue**, not a literal
minutes-remaining guarantee — it fills based on time until `leaveByAt` (or
`startsAt` if leave-by is unavailable), capped at a 3-hour window, and reads
as visually "full" for anything further out or when the time can't be
determined. The numeric label uses an adaptive unit (minutes, hours, or
nearest whole day) so far-future events stay glanceable; `"—"` only when the
time can't be determined. Do not present it as a precise estimate in copy or
a11y labels.

## Port checklist addition

Add to the existing iOS/Android port checklist: "Focus card selection logic
(exactly one item, today/tomorrow decisions else next in-play; rest-of-week
via list + week glance) and urgent/calm status-color mapping match web —
including pending-for-self on the urgent surface." Slim body (summary +
Assign/Confirm/Remove + Edit; covering combobox defaults to signed-in adult
on assign and reassigns when coverage is already active; write bands on
expanded rows only) must match web — do not port the old five-band
form-hero. Card *chrome* may use native
components (SwiftUI card modifiers / Compose `Card`) — chrome differs,
selection logic and copy must not.
