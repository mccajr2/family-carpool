# Spec: agenda-focus-card-polish

Status: archived  
Completed: 2026-08-17  
Created: 2026-08-17  
Parent: [docs/roadmap.md](../../roadmap.md)  
Branch: `agenda-focus-card-polish`  
Added: 2026-08-17 · enhancement

Scope: **web `AgendaFocusCard`** — layout, type, ring, chips, covering under
the ring, **then slim body** (summary + CTA; write bands stay on expanded
rows). No OpenAPI, backend, iOS, or Android. Selection logic is done
([`agenda-focus-next-action`](../archive/agenda-focus-next-action.md)).

## Problem

The shipped web Focus card is denser and flatter than the Calendar light mock
(Focus fixture: “Hang with Arthur”, **72 MIN** ring, **Covering: Jay** under the
ring, **Overlaps** chip, Assign coverage + Edit). Today the countdown ring
shares the title row at 64×64px; covering reads only in the lower coverage band;
conflicts render as prose in a status pill instead of a chip; the hero title
does not match the mock’s weight/size hierarchy. Same data and handlers — this
is presentation only.

## Non-goals

- Changing `selectFocusItem` / `focusItemNeedsDecision`
  ([`agenda-focus-next-action`](../archive/agenda-focus-next-action.md))
- Coverage, RSVP, leave-by **write** rules or API calls
- `formatRingCountdown` unit rules or `RING_MAX_MINUTES` fill cap
  ([`agenda-focus-card-bugs`](../archive/agenda-focus-card-bugs.md))
- Collapsing Focus into an accordion (Focus stays fully expanded **and slim**)
- Moving leave-from / RSVP / kid-subset onto event compose (those stay on
  expanded `AgendaRow`; manual **Remove** moves to the Edit dialog)
- Kid-filter chips, flat `AgendaRow` chips
  ([`agenda-list-chips`](../planned/agenda-list-chips.md))
- Week-at-a-glance rail ([`agenda-week-glance`](../planned/agenda-week-glance.md))
- Carpool stop card / “N stops” ([`carpool-multi-stop`](../planned/carpool-multi-stop.md))
- Destination page header ([`web-shell-page-header`](../archive/web-shell-page-header.md))
- iOS / Android ([`agenda-focus-card-mobile`](../planned/agenda-focus-card-mobile.md)
  ports this polish after web lands)
- Reconstructing `coverageDisplay.ts` business logic

## Approach

**No contract change.**

**Visual source:** Calendar light screenshot, Focus card region only. Measure
size, weight, spacing, and color from the mock; add or update roles in
`design-tokens/tokens.json` in the same PR (`docs/ui-system.md`). Do **not**
snap ring diameter, title size, or gaps to nearby existing roles.

**Target layout (urgent + calm share structure; tokens swap by state):**

1. **Primary block (left / fluid):** event when (secondary), title (display,
   mock-weighted), optional location — **no ring in this row**.
2. **Ring column (right, isolated):** mock-sized countdown ring + numeric label
   (`formatRingCountdown` unchanged). Ring diameter, stroke, and label type come
   from new token roles (shipped 64×64 / `text-xs` is too small).
3. **Under the ring:** when the item has at least one **CONFIRMED** coverage row,
   a single secondary line **`Covering: {name}`** using
   `coverageAdultLabel` (first confirmed row is enough for v1; mock shows one name).
   Omit when no confirmed coverage.
4. **Status chips (below primary block, mock-aligned):** reuse the **same chip
   visual language as the Calendar mock’s hero `.status-pill` — Title Case
   with a leading status dot, not uppercase row tags and not a lone prose
   sentence. When `item.conflicts.length > 0`, show an **Overlaps** chip; when
   uncovered, **Needs coverage** (or mock-equivalent); when resolved/all-set,
   mock-aligned calm chip (e.g. **Confirmed** / **All set** — match screenshot).
   Detailed conflict lines stay in the expanded body (as today), not duplicated
   as the only header status.
5. **Slim body (Calendar mock):** no leave-from dropdown, RSVP, covering
   kid-subset, leave-by estimate band, or Remove event on the card. Primary
   CTA row: Assign (or Confirm/Decline) + **Remove coverage** when coverage
   is active + Edit. Covering combobox under the ring when uncovered and
   **not** `soleAdult`, **or** when coverage is active and there is more
   than one adult (change reassigns). Confirmed sole-adult coverage stays a
   static `Covering: {name}` line. Open Places only for `NO_ORIGIN`.

Extract a small shared **status chip** helper or component used by Focus (and
optionally refactor `AgendaRow` tags to call it — only if zero behavior change;
otherwise duplicate styles with a comment pointing at `AgendaRow`).

Regenerate tokens (`node design-tokens/generate.mjs` + `--check`).

## Acceptance criteria

- [x] Focus card header matches mock structure: title column and ring column are
      separate; ring is visibly **larger** than shipped 64×64 (token-driven size).
- [x] With a confirmed coverage row, **Covering** + the covering adult render
      under the ring (combobox when several adults; static name when sole),
      not only in the lower coverage band.
- [x] With conflicts, an **Overlaps** status chip renders in the header chip row
      (Title Case + leading dot, matching the Calendar mock `.status-pill`);
      conflict detail lines stay on the **expanded row**, not Focus.
- [x] Mock-measured title type/weight/spacing are locked in `tokens.json` and used
      via generated `--fc-*` vars (no raw px/hex in `AgendaFocusCard.tsx`).
- [x] Urgent vs calm surfaces still use `hero*` vs plain tokens per
      `docs/agenda-focus-card-addendum.md`; chip colors respect state (urgent uses
      `heroDanger` / `heroSuccess` where the mock does on the dark card).
- [x] Focus body is slim: kid · Leaving from {place}; no RSVP, leave-from
      dropdown, leave-by estimate, Remove event, or covering kid-subset on the
      card. Assign/Confirm/Decline + **Remove coverage** + Edit remain. Remove
      event is on the Edit dialog (manual). Changing the covering combobox on
      an active assignment reassigns.
- [x] Multi-adult Assign: covering combobox defaults to the signed-in adult;
      Assign without changing it assigns self; changing it then Assign uses that
      adult (same `coverageAssignState` as a row).
- [x] Expanded `AgendaRow` bands unchanged. `FamilyScreen` still wires the same
      list-row handlers.
- [x] `cd web && npm test`, `npm run lint`, and `node design-tokens/generate.mjs --check`
      pass.

## Tasks

- [x] Tokens: measure Calendar light Focus card; add/update roles (ring box,
      ring label type, focus title if mock ≠ `hero`, chip spacing if needed);
      regenerate + contrast check for any new `hero*` pairings.
- [x] Web: restructure `AgendaFocusCard.tsx` header (primary / ring column /
      covering-under-ring / chip row); keep body bands and handlers.
- [x] Web: shared status-chip styling (extract or mirror `AgendaRow` tag classes).
- [x] Tests: update `AgendaFocusCard.test.tsx` for ring size testid/dimensions,
      covering-under-ring copy, Overlaps chip; adjust `FamilyScreen.test.tsx` only
      if selectors/copy change.
- [x] Docs: addendum — Focus is summary + CTA; expanded rows keep write bands;
      covering combobox defaults to signed-in adult; remaining Agenda specs
      (`agenda-list-chips`, `agenda-focus-card-mobile`, `coverage-leave-from`,
      `agenda-focus-carpool-actions`) noted so they do not put the form back
      on Focus.
- [x] Web: slim `AgendaFocusCard` body; Remove event on Edit compose; covering
      combobox under ring for multi-adult assign.
- [x] Tests: Focus unit tests for slim chrome + default-self assign; move
      leave-from/RSVP FamilyScreen cases onto expanded rows; `npm test`, lint,
      token `--check`.

## Open questions

None — mock is the Calendar light screenshot referenced in roadmap intake
(2026-08-17). If mock px conflict with an older token lock, defer to the mock
per `docs/ui-system.md`.
