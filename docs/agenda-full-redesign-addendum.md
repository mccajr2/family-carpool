# Addendum 2: full Agenda page redesign (retires Selection A entirely)

Status: adopted — this fully replaces the "Presentation hierarchy" section
of `docs/agenda-coverage-web-contract.md`, not just the Focus card carve-out
from `docs/agenda-focus-card-addendum.md`.

## What changed since addendum 1

Addendum 1 kept "Selection A — spacing only" as the rule for every item
*except* the one Focus card. That's no longer the constraint: visual
distinctiveness applies to the whole page, not one promoted item. Selection
A is retired outright — flat rows now use real card chrome
(`AgendaRow.tsx`), not spacing-only stacking.

**All business logic from the original contract is still unchanged** —
coverage rules, RSVP rules, busy/loading indicators, field-row conventions.
This addendum is entirely about visual presentation.

## New rules

1. **Day grouping.** Agenda items render under "Today" / "Tomorrow" / "This
   week" / "Later" headers (`agendaDayGroups.ts`), not one continuous list.
   Empty groups don't render a header with nothing under it.
2. **Every row is a card**, not a spacing-only stack: bordered, rounded
   (`radius.md`), `surfaceRaised` background — see `AgendaRow.tsx`.
3. **Rows are collapsed by default.** Summary only: status dot, title, time
   + location, up to a couple of status tags. Tap/click expands the same
   field-row bands the Focus card already uses (leave-from, per-kid RSVP,
   coverage, manual actions) — reusing the same coverage/RSVP/leave-by
   helpers, not new logic.
4. **Out-of-play items** (every kid RSVP `NO`) render at reduced opacity
   with a grey status dot and a single muted "Not going" tag — no other
   tags, no coverage/travel content even when expanded (same rule as
   before, just restyled).
5. **The accordion restriction from the old contract is lifted.** Rows may
   expand/collapse; this was previously explicitly disallowed ("no
   accordion... in this slice") and is now intentional.
6. **One deferred item, flagged rather than faked:** the original mockups
   showed a "N stops" tag for carpool events. `CalendarItem` has no
   per-event stop/pickup-order field in the current data model — there's
   nothing to bind that tag to. It is **not** included in `AgendaRow.tsx`.
   This is a real data-model dependency, tracked against the Carpool
   destination redesign (roadmap follow-up #2), not implemented here with
   placeholder data.

## Tokens used

All from the existing (already-shipped) `tokens.json` — no new roles needed
for this slice: `surfaceRaised`, `border`, `radius.md`, `danger`/`success`/
`accent` (themed, not `hero*` — flat rows follow the page theme normally;
only the Focus card uses the theme-independent `hero*` surface).

## Explicitly still out of scope

- Carpool multi-stop screen, Family/Places/Garage/Feeds redesign — separate
  roadmap items.
- iOS/Android — separate roadmap item.
- The "N stops" tag, pending the data-model dependency above.
