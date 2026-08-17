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

All *other* Agenda items keep Selection A's spacing-only treatment
unchanged. Do not apply Focus card chrome to more than one item — repeated
cards fight the five-band content density this doc already documents, and
defeat the point of a focus treatment.

## Focus card content

Reuses the same five bands, same data, same handlers as a normal Agenda item
— this is a **visual promotion**, not new functionality:

- Primary: time range, title, one-line kid context.
- Status: a single status line — conflict/needs-coverage copy (accent =
  `danger` role) when the item **needs a decision** (including pending confirm
  for self — use the urgent surface, not "All set"), or "all set" copy (accent =
  `success` role) when fully resolved.
- Travel/origin, People/RSVP, Coverage/actions: same field rows and controls
  as flat rows, just inside the card body.
- Manual actions: same Edit/Remove, inside the card.

No new business rules. No accordion. No card chrome on any other item.

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
including pending-for-self on the urgent surface." Card *chrome* may use native
components (SwiftUI card modifiers / Compose `Card`) — chrome differs,
selection logic and copy must not.
