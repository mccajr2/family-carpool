# Addendum: Focus card (supersedes "Selection A — spacing only")

Status: proposed — apply after web smoke test, then port to iOS/Android.
Replaces the "Presentation hierarchy" → "Selection A" section of
`docs/agenda-coverage-web-contract.md`. All other sections of that doc
(Coverage, RSVP, Busy/loading indicators, Field rows, Port checklist) are
**unchanged** — this addendum is about visual chrome only, not business logic.

## Why this supersedes Selection A

Selection A ("spacing / proximity only, no card/bordered/muted-band chrome")
was a reasonable decision under its original constraint: minimize
three-platform maintenance cost. That constraint has changed — visual
distinctiveness is now a product priority, not a nice-to-have, and is worth
the added implementation cost on each client.

## New rule

**Exactly one Agenda item at a time** may use Focus card treatment: bordered/
raised container, larger type, and a status-color accent. Selection criteria,
in order:

1. The earliest item with `uncoveredKidIds.length > 0` OR non-empty `conflicts`
   (today's window first, then tomorrow, then this week).
2. If none qualify, the earliest upcoming item the signed-in adult is
   attending (see RSVP out-of-play rule — never promote an item where every
   kid is RSVP `NO`).
3. If the Agenda is empty, no Focus card renders — plain empty state.

All *other* Agenda items keep Selection A's spacing-only treatment
unchanged. Do not apply Focus card chrome to more than one item — repeated
cards fight the five-band content density this doc already documents, and
defeat the point of a focus treatment.

## Focus card content

Reuses the same five bands, same data, same handlers as a normal Agenda item
— this is a **visual promotion**, not new functionality:

- Primary: time range, title, one-line kid context.
- Status: a single status line — conflict/needs-coverage copy (accent =
  `danger` role) or "all set" copy (accent = `success` role) when the item is
  fully resolved.
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
determined. Do not present it as a precise estimate in copy or a11y labels.

## Port checklist addition

Add to the existing iOS/Android port checklist: "Focus card selection logic
(exactly one item, priority order above) and status-color mapping match
web." Card *chrome* may use native components (SwiftUI card modifiers /
Compose `Card`) — chrome differs, selection logic and copy must not.
