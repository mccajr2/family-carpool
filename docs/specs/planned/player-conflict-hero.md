# Spec: player-conflict-hero

Status: planned  
Created: 2026-09-16  
Parent: [docs/roadmap.md](../../roadmap.md)  
Branch: `player-conflict-hero`  
Added: 2026-09-16 · enhancement  
Depends on: [`hero-not-going`](../archive/hero-not-going.md), [`conflict-detection`](../archive/conflict-detection.md), [`hero-attention-carousel`](../archive/hero-attention-carousel.md), [`coverage-priority-same-event`](../archive/coverage-priority-same-event.md), [`attendance-manual-toggle`](../archive/attendance-manual-toggle.md)  
Governs: [ADR-0001](../../decisions/ADR-0001-coverage-priority-rule.md) (amend)

Fleshed during `/spec`; **demoted to planned** pending prerequisite
[`hero-not-going`](../archive/hero-not-going.md) (re-rank split). That
prerequisite is **Done** — re-promote with `/spec player-conflict-hero` when
it is Next up.

## Problem

When the same kid is on two overlapping events (e.g. two hockey teams), amber
Agenda chrome from [`conflict-detection`](../archive/conflict-detection.md) is
easy to miss. Adults need a **Hero card** that shows both events, **forces a
pick** (keep one → mark the other **not going**), then lets normal ride-assign
Hero slides cover the kept event — before coverage and carpool work piles up on
an impossible double-book. Households with **multiple kids** on the same
overlapping pair need a progressive flow (same decision for all by default,
split allowed).

## Non-goals

- Soft travel / leave-by “cutting it close” (`conflict-travel-margin`)
- Multi-kid household “family conflict” reporting when **different** kids’
  events overlap (`family-conflict-report`)
- Auto-pick which event to keep; push/email alerts
- Changing overlap math or server `KID_TIME_OVERLAP` enrichment (still event
  `startsAt`/`endsAt`; still based on calendar `kidIds`, not RSVP)
- Adult CONFIRMED double-book **409** / `ADULT_COVERAGE_OVERLAP` Hero promotion
- OpenAPI / backend / Expo / KMP changes
- Dedicated “Undo pick” control on the conflict slide
- Muting Agenda amber after not-going (server conflict truth unchanged; Hero
  alone filters by in-play attendance)
- Inventing Hero **not going** chrome — that is
  [`hero-not-going`](../archive/hero-not-going.md); this slice **reuses** that shared
  affordance for neither / escape

## Approach

**Client-only**, consistent with Hero queue slices and attendance writes.
**Prerequisite:** [`hero-not-going`](../archive/hero-not-going.md) so own-kid Hero slides
already expose not-going (no Agenda-only trap).

1. **Signal:** Reuse calendar `conflicts` with `type: KID_TIME_OVERLAP`. Do not
   re-derive overlap intervals in the client.
2. **Unresolved for Hero:** A player conflict is actionable only when the kid is
   still **in-play** (`attendance !== "not_going"`) on **both** peer events.
   Marking one side not-going clears that kid from the Hero conflict (even if
   amber `conflicts` remain on the items).
3. **Queue:** Extend shared `getQueue` with a new item kind (e.g.
   `playerConflict`) for each unresolved **event-pair** that has ≥1 household
   kid in that state. Horizon: same `filterQueueWithinHorizon` (today→+7) —
   Load more does not expand Hero (unchanged).
4. **Priority (amends ADR-0001):** Still walk events soonest-first. For an event
   that participates in an unresolved player-conflict pair, emit the
   **player-conflict slide for that pair before** that event’s own-ride gaps and
   inbound asks. Do not jump the conflict ahead of sooner events that are not
   part of the pair. Deduplicate so one pair yields **one** slide (not one per
   peer event).
5. **Hero UX:** One conflict slide shows **both** peers. Labels: **team + event**
   when linked (`feedName` · title via existing source/title helpers); title-only
   fallback for standalone/manual. Primary actions: keep A or keep B. **Neither /
   not going** uses the shared Hero not-going control from
   [`hero-not-going`](../archive/hero-not-going.md) (not a one-off conflict-only pattern).
6. **Multi-kid progressive:** If multiple circle kids are unresolved on the
   **same** pair, default is **one answer for all** (keep A / not-going B, or the
   reverse). Offer a progressive path to **split**: per-kid keep A, keep B, or
   **neither** (not-going on both). Valid splits include one kid each event, or
   one kid keeps / one neither.
7. **Writes:** Persist via existing `setCalendarRsvp` / attendance mapping
   (`NO` = not going, `YES` = going) — same as
   [`attendance-manual-toggle`](../archive/attendance-manual-toggle.md). No new
   resolve endpoint. After writes succeed, the conflict kind leaves the queue on
   the next render.
8. **Then ride assign:** Do not embed a special DriverPicker on the conflict
   slide. Once the conflict is gone, existing `ownRide` / ask slides for kept
   in-play kids appear under normal `getQueue` rules (including same-event
   ordering).
9. **Reverse later:** No conflict undo. Adult marks **not going** on the kept
   event via Agenda attendance or Hero not-going; may mark the other **going**
   again, or leave both not going. If both become in-play again while times still
   overlap, the Hero conflict can return.

**Visual:** Reuse existing Hero attention chrome / `hero*` color roles. No new
destination mock required for this slice; do not invent a restyle. If implement
needs a new spacing/type role, lock it from measured Hero patterns into
`design-tokens/tokens.json` (do not snap to a nearby role).

## Context

Allowlist for `/implement`. Paths and **headings**, not whole-doc dumps.

- Architecture: [`docs/architecture.md`](../../architecture.md) → **Conflict detection (detail)**
- Decisions: [`docs/decisions/ADR-0001-coverage-priority-rule.md`](../../decisions/ADR-0001-coverage-priority-rule.md)
- Contract doc: [`docs/agenda-coverage-web-contract.md`](../../agenda-coverage-web-contract.md) → **Hero carousel queue**; **RSVP / attendance**; conflict chrome notes
- Prior slices: [`hero-not-going`](../archive/hero-not-going.md); [`conflict-detection`](../archive/conflict-detection.md); [`coverage-priority-same-event`](../archive/coverage-priority-same-event.md); [`hero-attention-carousel`](../archive/hero-attention-carousel.md); [`attendance-manual-toggle`](../archive/attendance-manual-toggle.md)
- Source: `web/src/components/coverageQueue.ts` → `QueueItem`, `getQueue`, `filterQueueWithinHorizon`, `isInPlay` / attendance mapping; `web/src/components/conflictDisplay.ts`; `web/src/components/heroAttentionCopy.ts`; `web/src/components/HeroAttentionSlide.tsx` / `HeroAttentionCarousel.tsx`; FamilyScreen wiring that builds `attentionQueue`
- Tests: `web/src/components/coverageQueue.test.ts`; Hero carousel / FamilyScreen attention tests as needed for the new kind

## Acceptance criteria

- [ ] Unresolved same-kid overlap (`KID_TIME_OVERLAP` + kid in-play on both peers)
      in the near-term Hero horizon produces **one** Hero slide that presents
      both events with **team · event** labels when `feedName` is present, else
      title-only.
- [ ] Primary resolve path: keep A or keep B (default all-kids); choosing keep A
      writes not-going on B (and ensures going on A as needed) via existing RSVP
      APIs. Escape / neither uses the shared [`hero-not-going`](../archive/hero-not-going.md)
      control (not conflict-only chrome).
- [ ] After successful resolve writes, the player-conflict item is **absent**
      from `getQueue` / carousel on the next render (even if server amber
      `conflicts` remain).
- [ ] For events in that pair, the player-conflict slide ranks **above** that
      event’s own-ride gaps and inbound asks; a sooner unrelated event’s gaps/asks
      still rank ahead of a later conflict pair.
- [ ] Multi-kid same pair: default applies one keep/not-going choice to **all**
      unresolved kids; progressive split allows per-kid keep A, keep B, or
      neither; after resolve, normal own-ride Hero slides can surface for kept
      going kids (no special conflict→DriverPicker chrome).
- [ ] Load more / loaded calendar beyond +7 does **not** add player-conflict
      slides outside `filterQueueWithinHorizon` (same as other Hero items).
- [ ] Reversing a pick uses attendance (Agenda or Hero not-going on the kept
      event; optional going on the other); no dedicated Undo on the conflict slide.
- [ ] No OpenAPI / backend / Expo changes. ADR-0001 and
      `docs/agenda-coverage-web-contract.md` document the new queue kind and
      precedence.
- [ ] Unit/component tests would fail if conflict queue emission, in-play
      filtering, multi-kid default vs split writes, or priority ordering were
      reverted.

## Tasks

- [ ] Docs: amend ADR-0001 for player-conflict precedence within event-grouped
      `getQueue` (one slide per unresolved pair; before own gaps/asks for those
      events)
- [ ] Docs: update `docs/agenda-coverage-web-contract.md` Hero carousel queue —
      player-conflict kind, in-play-both-peers rule, multi-kid progressive
      resolve, horizon unchanged
- [ ] Web: extend `QueueItem` + `getQueue` to emit deduped `playerConflict`
      items from calendar conflicts + attendance; cover with
      `coverageQueue.test.ts`
- [ ] Web: Hero slide UI — both peers labeled; keep A / keep B; reuse shared
      Hero not-going for neither; multi-kid default + split; wire RSVP writes;
      slide drops after success
- [ ] Web: FamilyScreen / carousel wiring — map calendar peers for the new
      kind; ensure post-resolve ownRide/ask slides continue to work
- [ ] Tests: component coverage for slide resolve paths (single kid, multi-kid
      default, split including neither); priority vs gap/ask; horizon exclusion
- [ ] Visual: reuse `hero*` chrome; add token roles only if measured values need
      a new lock (no snap-to-nearby)

## Open questions

- None blocking — locks from `/spec` discussion:
  - Priority: conflict above gaps/asks for the overlapping events only
  - Horizon: same as other Hero items (Load more irrelevant)
  - Resolve: keep A / keep B; neither via shared `hero-not-going`; reverse via
    attendance
  - Copy: team · event when linked
  - Multi-kid: progressive default-same / allow split / neither
  - Contract: client-only
  - Split: `hero-not-going` ships first for consistent Hero escape
