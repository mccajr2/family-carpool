# Spec: day-block-agenda

Status: draft  
Created: 2026-09-14  
Updated: 2026-09-16 (`/spec` amend — Focus stays single-decision)  
Parent: [docs/roadmap.md](../../roadmap.md)  
Added: 2026-09-14 · enhancement  
Branch: `day-block-agenda`

## Problem

Driving-block membership already ships
([`day-block-domain`](../archive/day-block-domain.md)), but the **Agenda day
list** still renders **one card per event**. When 2+ events share a confirmed
driver and contiguous window, parents still see separate rows and hunt for
“what’s on me tonight” vs what another adult already owns. We need **one
Agenda card per driving block** with per-leg breakdown inside and a quiet
“not your job tonight” band — matching the mockup’s perspective model, not a
new trip entity. Hero / Focus stays a separate concern: one decision per
card (see Approach).

## Non-goals

- Block domain / merge rule / override API
  ([`day-block-domain`](../archive/day-block-domain.md) — already done)
- Route tab multi-event stop sequence
  ([`day-block-route`](../planned/day-block-route.md))
- Extending stop-order optimize to block stops (same — `day-block-route`)
- Changing RideRequest / coverage / RSVP primitives
- Cross-family block merging (viewer’s own confirmed driving only, as domain)
- Expo / KMP / RN Agenda ports
- **Server contract stays event-shaped for this slice.** This is intentional,
  not an oversight — see follow-up dependency
  [`agenda-block-api`](../planned/agenda-block-api.md) on the roadmap. No
  OpenAPI change; no new block list endpoint; keep consuming per-item
  `driveBlockLinks` (+ existing calendar/ride/coverage fields).
- New visual language from the mockup’s dark/light or density choices — keep
  existing Hero dark / Agenda light treatments; compress copy via progressive
  disclosure rather than inventing tokens from mock hex
- Inventing a second coverage/ride copy stack — extend shared helpers
  (`coverageCopy` / ride-status chip patterns) so ADR-0004 stays one place
- Collapsing multiple Hero / Focus **decisions** into one multi-action block
  card — one-card-per-block is an **Agenda day-list** rule only

## Approach

**Web-only client chrome** over the existing event-shaped calendar payload.

1. **Group Agenda day lists by driving block** using `driveBlockLinks`
   (`combined: true` adjacency on the viewing adult’s confirmed-driving leg).
   A multi-item combined component collapses to **one card**; singleton /
   non-driving / non-combined events keep today’s per-event `AgendaRow`
   behavior (no forced new chrome for one-item blocks).
2. **Inside a multi-item block card**, render per-leg / per-run sections
   (drop-off run, pickup run, event time bands) from live item + ride +
   coverage data — wording and grouping follow
   [ADR-0004](../../decisions/ADR-0004-carpool-card-perspective-rules.md)
   and the mockups (perspective normalization, leg-scoping, “not your job”
   muted band, paired cancel/reassign when applicable). Compress wordy mock
   density (mute/collapse route line, drive-time delta, “driving separately”
   notes) but **never** collapse ADR-critical copy (round-trip banner,
   named/qualified address, paired cancel links).
3. **“Not your job tonight” / “Already covered”** rows are **client-derived**
   from existing coverage + ride state for kids/legs another adult owns —
   muted, non-actionable, grouped (ADR rule 6). Do not invent server fields.
4. **Focus / Hero stays one decision per card.** The attention carousel /
   Focus queue is **unchanged** in cardinality: if several queue items fall
   in the same driving block, they remain **separate slides**, each with a
   single primary action (Confirm / Accept / Request / Assign / etc.). A
   slide may show **supporting** block context (sibling run line, muted “not
   your job,” named place) so the decision isn’t orphaned from the night —
   but it must **not** present every actionable job for the merged block on
   one Hero. Agenda is where “one card per block” applies; Hero is where
   “one decision per card” wins.
5. **Merge/split override:** remove interim per-event `driveBlockLinks` plain
   links from `AgendaRow` (`driveBlockAgendaLinks`). Relocate the same
   combine/split affordance onto the **Agenda block card** (one place — no
   competing controls). Reuse existing override client + link styling. Do
   not put merge/split on Hero as a second decision surface.
6. **“View route”:** until `day-block-route`, link to the existing
   single-event Route for a representative item in the run (earliest event in
   the leg’s combined set). Do **not** build multi-stop Route chrome here.

**Contract:** none. Dogfood of this UI (plus domain override writes) feeds the
gated follow-up `agenda-block-api` before any RN Agenda consumes grouped data.

## Context

Allowlist for `/implement`:

- Decision: [`docs/decisions/ADR-0004-carpool-card-perspective-rules.md`](../../decisions/ADR-0004-carpool-card-perspective-rules.md)
  — apply all nine rules directly; do not re-derive from mockup prose
- Mockup SoT (wording / grouping / layout only — not color or raw density):
  [`docs/ui-system/day-block-grouping.mockup.html`](../../ui-system/day-block-grouping.mockup.html)
  + [`docs/ui-system/carpool-card-perspective-rules.mockup.html`](../../ui-system/carpool-card-perspective-rules.mockup.html)
- Prior slice (payload + interim links to remove):
  [`docs/specs/archive/day-block-domain.md`](../archive/day-block-domain.md)
- Architecture: [`docs/architecture.md`](../../architecture.md) → **Calendar
  agenda**, **Team carpool space (detail)** → Clients (Agenda / Focus ride
  chrome)
- Web contract (coverage / Focus / expanded-row behaviors to preserve):
  [`docs/agenda-coverage-web-contract.md`](../../agenda-coverage-web-contract.md)
  — headings for Focus CTA / collapsed chips / expanded row actions as needed
- Source:
  - `web/src/components/AgendaRow.tsx`, `AgendaFocusCard.tsx`,
    `HeroAttentionCarousel.tsx` / `HeroAttentionSlide.tsx`,
    `FamilyScreen.tsx` (day list grouping)
  - `web/src/components/driveBlockAgendaLinks.ts` (+ tests) — relocate then
    delete interim row wiring
  - `web/src/components/coverageCopy.ts`, `rideStatusChip.ts`,
    `coverageQueue.ts`, `transportPlan.ts`
  - `web/src/api/types.ts` — `CalendarItem.driveBlockLinks`,
    `CalendarDriveBlockLink` (read-only for this slice)
  - `web/src/api/familyClient.ts` — existing override put/delete only

Do not list `docs/roadmap.md`. Cite
[`day-block-route`](../planned/day-block-route.md) and
[`agenda-block-api`](../planned/agenda-block-api.md) only as out-of-scope /
follow-up siblings.

## Acceptance criteria

- [ ] When two (or more) Agenda items are auto- or FORCE-combined via
      `driveBlockLinks` for the viewing adult, the day list shows **one**
      block card (not one `AgendaRow` per event).
- [ ] Singleton / non-combined events still render as today’s per-event
      Agenda rows (no mandatory new block chrome).
- [ ] Multi-item block card shows per-leg / per-run breakdown and event time
      bands consistent with
      [`day-block-grouping.mockup.html`](../../ui-system/day-block-grouping.mockup.html)
      grouping (drop-off vs pickup vs hang/practice windows) — compressed, not
      a verbatim mock dump.
- [ ] Legs/kids another adult already owns appear in a single muted
      non-actionable “Not your job tonight” / “Already covered” band (ADR
      rule 6), not interleaved as actionable chips with the viewer’s jobs.
- [ ] Card copy obeys ADR-0004 rules 1–5 and 7–9 where those surfaces appear
      (perspective, kid-first, leg-scoped chips/banners, direction-correct
      pickup/drop-off labels, named/qualified addresses, paired
      cancel/reassign when own kids + added rider share a leg, single-stop
      multi-kid grouping, pending-ask card parity).
- [ ] Focus / Hero: queue **cardinality unchanged** — N attention items in
      one driving block ⇒ N separate decision slides (not one multi-action
      Hero). Each slide keeps a single primary CTA for that queue item.
- [ ] Focus / Hero: optional supporting block context on a slide is allowed
      (sibling run / muted “not your job”); it must not add a second primary
      decision for another block member on the same card.
- [ ] Interim per-event AgendaRow `driveBlockLinks` merge/split plain links
      are **gone**; combine/split lives only on the **Agenda** block card and
      still calls existing override APIs (not on Hero).
- [ ] “View route” (if shown on the Agenda block card) opens existing
      single-event Route for a representative block member — no multi-event
      stop list UI.
- [ ] **No** OpenAPI / `contracts/openapi.yaml` / server DTO changes in this
      PR; web types stay event-shaped.
- [ ] Component/unit tests cover: multi-item Agenda collapse to one card;
      singleton unchanged; “not your job” band on Agenda block card; interim
      row links removed; Focus queue still emits separate slides for two
      attention items that share a combined block (each with one primary
      CTA). Relevant web suite passes.

## Tasks

- [x] Web: group day-list items into driving blocks from `driveBlockLinks`;
      render one multi-item **Agenda** block card component; keep singleton
      `AgendaRow`
- [x] Web: Agenda block card sections — per-leg runs, event bands, muted
      “not your job” / “already covered”, progressive disclosure for non-ADR
      detail
- [x] Web: wire ADR-critical copy through shared `coverageCopy` /
      ride-status helpers (extend, don’t fork)
- [ ] Web: Focus / Hero — keep one-decision-per-card queue; do **not** merge
      attention items into a multi-decision block Hero; optional supporting
      block context only
- [ ] Web: move merge/split override affordance onto the Agenda block card;
      remove interim `AgendaRow` + `driveBlockAgendaLinks` row wiring (keep
      override helpers/client); leave Hero free of merge/split
- [ ] Web: optional “View route” on Agenda block card → existing
      single-event Route only
- [ ] Tests: Agenda block grouping + card chrome + Focus single-decision
      cardinality + link removal; no contract/backend tasks

## Open questions

- Contiguity buffer / merge-rule retune stays a domain concern; this UI’s
  override usage is input to the `agenda-block-api` **stability gate**, not a
  reason to change OpenAPI here.
- Exact progressive-disclosure defaults (which lines start collapsed) can be
  tuned in implementation against the mockups as long as ADR-critical copy
  stays visible.
