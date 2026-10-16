# Spec: agenda-card-expanded-bodies

Status: draft  
Parent: [docs/roadmap.md](../../roadmap.md)  
Created: 2026-10-14  
Added: 2026-10-14 · re-rank split  
Spec'd: 2026-10-16 · expanded slice 2 (PDF mock)  
Reviewed: 2026-10-16 · regression audit folded in (Functionality inventory, Decisions 5–11)  
Branch: `agenda-card-expanded-bodies`

**PR size:** One PR. Desktop web Agenda expanded bodies only. Collapsed header/kid-row language from [`agenda-card-one-language`](../archive/agenda-card-one-language.md) stays. This slice adds the shared expanded interior and puts the existing carpool and route handlers back on that interior for both single and combined cards.

Binding source: PDF *Carpool app redesign-selection* — page 2 *Agenda card · expanded language · slice 2* and page 3 frames K–M. Page 1 is the already-shipped collapsed slice; do not restyle it except where L/M change the combined title and multi-venue location line.

Colors, exact pixels, light theme, shadows, and fonts are **illustrative** (PDF: “Theme: light (illustrative)”). Map hierarchy onto existing tokens. Do not flip Calendar to the light mock palette.

## Problem

Collapsed Agenda cards share one language. Expanded still does not. A single event (`AgendaRow`) opens a DriverPicker, leave-from, confirm/post, and route. A drive block (`AgendaBlockCard`) opens read-only runs and links, with **no** resting DriverPicker, so the same evening cannot be planned from the combined card. Recent card restyles (`calendar-card-hierarchy`, `agenda-card-one-language`) also moved or dropped chrome around route, ask, and override actions. Phone layout cannot consume that mix.

## Non-goals

- Phone-width Calendar (`calendar-phone-frame`)
- Hero, Focus, Carpool tab, Family, Places, Feeds
- New ride states, coverage rules, or OpenAPI fields
- A new “one team ask per kid” protocol. Post still uses the existing create/save call with the kid ids in that picker block
- Per-leg standing ↻ (`agenda-standing-leg-marker`)
- Not-going uncombine (`agenda-not-going-uncombine`)
- Undo holes (`action-undo-parity`) — keep every reverse that exists today; do not invent the missing ones
- Visual redesign of the leg-split / kid-split editors (the PDF does not draw them). Entry links only
- Inbound Accept/Pass as a new surface. It is not in the mock; the existing row stays reachable
- Locking mock hexes or a light-theme pass into `design-tokens`

## Approach

Desktop web only. No OpenAPI change.

Expanded body order on **both** shells, top to bottom:

1. **Legs** — read-only table: kid, Getting there, Coming back (who, and existing leave / pickup lines when the app already has them)
2. **Decision** — only when a decision is waiting
3. **Plan locked** — only when the plan is settled and locked
4. **Quiet actions** — same weight on single and combined
5. **Caption** — locked scope line, when that section is showing

**Simple plan first.** Opening a card lands on one shared round-trip DriverPicker for the kids in that decision, not `legSplit` / `kidSplit`.

**Combined picker (PDF option 2).** `AgendaBlockCard` gains the same DriverPicker the single card already uses:

- Kids with the same open state share one block (`KIAN + DECLAN — ROUND TRIP`). One primary posts those kid ids together — one call per member event when the block spans events.
- A kid who still needs a decision while others do not gets their own block (frame F). A fully assigned kid gets no picker block. Combined-only; the single card keeps one picker for all going kids.
- “Different plans for each kid” appears on any picker whose scope has 2+ going kids (grouped block, or a single event with 2+ kids) and opens the existing kid-split editor.

**Primary vs quiet.** One primary when a decision is waiting (`focusAction`, larger than chips and links): Confirm for a household driver, `Post to team — …` when Ask the team is selected, `Save ride plan` when editing an existing plan or saving a split. Ask the team stays a driver chip; it does not send. Post/Save sends.

**Do not hide working actions.** The mock’s “I can’t drive” and “Take over driving” are placeholders for commitment and override reverses. Keep the real labels and handlers that exist today (cancel ask, remove coverage, withdraw, can’t make it, reconsider, pending Confirm/Decline, inbound Accept/Pass). Put them in the decision or quiet-action area at quiet-link weight. Do not delete a handler to match the two placeholder names. If a placeholder maps 1:1 onto one existing action, the mock label may be used for that action only.

**View route** stays wired to the existing `onOpenRide`. Single event opens that event’s route. Combined card keeps **both** leg links — TO run (earliest member, There tab) and FROM run (latest member, Back tab) — one per routable leg, as `day-block-route` shipped. A multi-venue location line may show the route icon and “N stops” and open the TO link. Do not leave a route control that does nothing.

**Titles (frames L and M only).** Keep `combinedEventTitle` shared-word behavior. When member titles share no words, use the first stop’s venue, plus `+ N more stops` when later stops are other venues. One venue: pin + address. Several venues: route icon + `N stops`. Eyebrow: feeds joined with ` + `, up to 3, then `+ N MORE`.

## Functionality inventory (must survive)

Reviewed 2026-10-16 against `AgendaRow.tsx`, `AgendaBlockCard.tsx`, `DriverPicker.tsx`, and the archived carpool specs. Every row below is a working control today. The restyle may move a row to a new position in the fixed order; it may not remove it, rename its handler, or require a different gesture to reach it. Tests in Tasks name these rows.

### Single card (`AgendaRow`) — today

| Control | Source | Keep where |
| --- | --- | --- |
| DriverPicker simple / leg-split / kid-split, Confirm, `Post to team — round trip`, `Save ride plan`, `Back to simple view` | `AgendaRow.tsx` ~1035–1096, `DriverPicker.tsx` | Decision |
| `Confirm and lock for {weekdays}` checkbox + label; `Post standing Ask for {weekdays}` checkbox + label | `DriverPicker.tsx` ~1003–1055, ~607–614 | Decision (primary label variants) |
| `notGoingThisWeek` scope inside the locked-edit picker | `AgendaRow.tsx` ~1089–1095 | Decision |
| Pending-for-self **Confirm coverage / Decline**; household-plan **Confirm / Decline** (`onConfirmHouseholdPlan`) | `AgendaRow.tsx` ~1100–1144 | Decision |
| Decided-assignee revert links (`Cancel request to {Name}`, `{Name} can't drive anymore? Reassign the ride`), can’t-make-it, remove coverage | `AgendaRow.tsx` ~842–943 | Quiet actions |
| Own ask line + `No longer need a ride? Cancel this ask` | `AgendaRow.tsx` ~1014–1033 | Decision (status + cancel) |
| Inbound **Accept / Pass / Reconsider / Undo / Can't take them**, hero-queue hide, auto-decline chip | `AgendaInboundRequestRow.tsx` ~195–248, mounted `AgendaRow.tsx` ~1356–1384 | Below quiet actions (own `Carpool` group) |
| Standing ride series band: inbound “handle in Hero” hint, own `End standing Ask for {weekdays}`, primary status | `AgendaRow.tsx` ~645–725 (rendered outside `open`) | Unchanged position |
| Legacy **Request** carpool band with per-kid checkboxes (`showCarpoolBand`) | `AgendaRow.tsx` ~1297–1354 | Keep when `showAssign` is false and a gap exists |
| Per-coverage **Leave from** editor (`onSetCoverageLeaveFrom`) | `AgendaRow.tsx` ~1236–1262 | Below Legs; Legs is read-only, this is not |
| Item-level Leave from when nobody covers and picker is not mounted | `AgendaRow.tsx` ~1265–1283 | Same gating |
| **Open Places** for `UNAVAILABLE / NO_ORIGIN` | `AgendaRow.tsx` ~1277–1293 | Next to the Leave from it repairs |
| Family / danger conflict lines; ride-commitment conflict line | `AgendaRow.tsx` ~784–812 | Above Decision |
| `Needs coverage for {kids}` line + `coverageActionError` alert | `AgendaRow.tsx` ~1193–1213 | Under Decision |
| Mark {Kid} not going; all-kids not going; **Mark as going again** (`AttendanceToggle`) | `AgendaRow.tsx` ~956–1010, ~1177–1185 | Quiet actions |
| Out-of-play shell (muted, Not going tag, attendance only) | `AgendaRow.tsx` ~263, ~496–501, ~1162–1188 | Unchanged |
| **Combine these** drive-block links | `AgendaRow.tsx` ~814–834 | Quiet actions |
| Header route icon + expanded View route | `AgendaRow.tsx` ~552–574, ~1215–1228 | Header stays; expanded goes to quiet actions |
| Manual event **Edit / Remove event** | `AgendaRow.tsx` ~1386–1398 | Quiet actions (Remove quieter than Edit) |
| Plan locked summary: Edit plan, not going (week scope), Remove recurring, caption, action error | `LockedStandingPlanSummary` via `AgendaRow.tsx` ~739–782 | Plan locked section |

### Combined card (`AgendaBlockCard`) — today

| Control | Source | Keep where |
| --- | --- | --- |
| Commitment actions (revert decided, can’t make it, remove coverage, not going, **withdraw ACCEPTED inbound**) via `agendaCommitmentActions.ts` | `AgendaBlockCard.tsx` ~615–643 | Quiet actions; withdraw stays its own link (ADR-0004 rule 7) |
| **Two** View route links: TO run → earliest member, There tab; FROM run → latest member, Back tab (`onOpenRide(item, leg)`) | `AgendaBlockCard.tsx` ~503–532, `agendaBlockSections.ts` ~248–257 | Legs table, one per routable leg |
| Departure-item Leave from (`blockDepartureItem`) | `AgendaBlockCard.tsx` ~537–554 | Below Legs when the viewer owns a TO leg and not settled-locked |
| Split into N events (unlocked list and inside locked summary) | `AgendaBlockCard.tsx` ~564–580, ~645–667 | Quiet actions |
| Plan locked summary: Edit plan, per-kid not going (`name` scope), Remove recurring, caption | `AgendaBlockCard.tsx` ~556–613 | Plan locked |
| `actionError` — today rendered **only** inside the locked summary (`~595`) | `AgendaBlockCard.tsx` | Must render whether or not locked (pre-existing hole) |

### Combined card — new in this slice

`AgendaBlockCardProps` (`~54–101`) has **none** of the decision callbacks. Adding the picker means adding item-scoped versions of: `assignDraft` / `onUpdateAssignDraft`, `onAssignCoverage`, `onCreateRide`, `onSaveRidePlan`, `onSaveKidPlans`, `onCancelRide`, `canAskTeam` (feed has carpool space), `hasPickupPlace`, per-item `coverageActionError`, and the standing lock weekday props from `standingBlockChrome(items)`. `FamilyScreen.tsx` (~4298–4343) wires none of these to the block today and keys `assignDraft` per item (~4367). That plumbing is a Task, not an assumption.

**Grouped block spans events.** `KIAN + DECLAN — ROUND TRIP` on a drive block is two member events. `onCreateRide`, `onSaveRidePlan`, and `onAssignCoverage` are per event key. One primary → **one call per member event**, same adult / meet / place choice, errors surfaced per item. No new batch API.

## Context

- Mock: PDF *Carpool app redesign-selection* (user-supplied) — slice 2, frames E–I and K–M. Frame J is a heading only; behavior is specified below.
- Collapsed language (do not re-litigate): `docs/specs/archive/agenda-card-one-language.md`
- Card hierarchy this slice extends: `docs/specs/archive/calendar-card-hierarchy.md` (simple plan first, Plan locked expanded-only, primary vs quiet)
- Source: `web/src/components/AgendaRow.tsx`, `web/src/components/AgendaBlockCard.tsx`
- Picker / places: `web/src/components/DriverPicker.tsx`, `web/src/components/LeaveFromControls.tsx`, `web/src/components/coverageCopy.ts`
- Layout / chips: `web/src/components/combinedEventLayout.ts`, `web/src/components/rideStatusChip.ts`
- Route + inbound: `onOpenRide` on both cards; `web/src/components/agendaBlockSections.ts` (TO/FROM representative items); `web/src/components/AgendaInboundRequestRow.tsx`
- Commitment / standing: `web/src/components/agendaCommitmentActions.ts`, `web/src/components/standingBlockChrome.ts`, `web/src/components/standingRideChrome.ts`, `LockedStandingPlanSummary` (grep)
- Page wiring: `web/src/components/FamilyScreen.tsx` → the Agenda list where `AgendaRow` / `AgendaBlockCard` are mounted (block props, `assignDrafts`)
- Rules this slice must not break: `docs/decisions/ADR-0002-automatic-non-blocking-cancellation.md`, `docs/decisions/ADR-0004-carpool-card-perspective-rules.md` (rules 1, 6, 7)
- Behavior that must survive (AC sections only): `docs/specs/archive/carpool-leg-split-plans.md`, `docs/specs/archive/carpool-kid-split-plans.md`, `docs/specs/archive/carpool-recurring-locked-plan.md`, `docs/specs/archive/carpool-recurring-standing.md`, `docs/specs/archive/carpool-meet-at.md`, `docs/specs/archive/day-block-route.md`
- Tokens (consume existing): `design-tokens/tokens.json` → `focusAction`, `listRow*`, `statusChip`, danger for Remove recurring

## Acceptance criteria

### Shared expanded order

- [ ] Expanded single and combined cards use the same order: Legs table, then decision blocks if any, then Plan locked if locked, then quiet actions, then the scope caption when locked.
- [ ] The Legs table is read-only. It does not replace the collapsed kid rows above the chevron.
- [ ] Opening the card does not land in the leg-split or kid-split editor.
- [ ] Collapsed header, chip strip, chevron, and kid rows stay the slice-1 language.

### Decision picker

- [ ] When a decision is waiting, the resting control is the existing simple DriverPicker: Driver chips (`You`, other household adults, `Ask the team` when a carpool space exists), one shared Leave from for the round trip, and one primary.
- [ ] Household selected: Leave from visible, Meet where? hidden. Primary is the existing Confirm label (`Confirm — You'll drive round trip from {place}` or `{Name}'ll drive…`). Confirm assigns in-circle coverage and does not post to the team.
- [ ] Ask the team selected: Meet where? for Getting there and for Coming back (`Our place` default, `Driver's place`). Leave from shows unless both legs are Driver's place. Driver's place shows “Address appears after someone accepts.” Primary is `Post to team — round trip`, or `Post to team — {Kid}, round trip` / `Post to team — {Kid} + {Kid}, round trip` when the block is named. Selecting the chip does not send; the primary does, via the existing ask/save handler and that block’s kid ids.
- [ ] After a successful post, that kid’s who line can show `Asked team` and the header can show `ASKED THE TEAM`. A posted open leg may show the status plus the existing cancel-ask control instead of a second live picker.
- [ ] Combined cards show a picker block per kid (or identical-kid group) that still needs a decision. Fully assigned kids get legs in the table and no picker block. **This rule is combined-only.** The single card keeps today’s behavior: one picker for all going kids on the event.
- [ ] A grouped block that spans member events issues one call per member event (same choices) when its primary is pressed; a failure on one member shows that item’s error without hiding the others.
- [ ] `Different plans for each leg` stays a quiet link into the existing split editor. `Different plans for each kid` shows on any picker whose scope has 2+ going kids — a grouped block on a combined card **and** a single event with 2+ kids (`carpool-kid-split-plans`). It is not removed from the single card.
- [ ] The primary label may also read `Confirm and lock for {weekdays}` or `Post standing Ask for {weekdays}` when the matching checkbox is checked. Both checkboxes and their gates survive on the single card and are passed to the combined picker from `standingBlockChrome(items)`.
- [ ] Pending-for-self Confirm coverage / Decline and household-plan Confirm / Decline keep rendering as primary + outline pair on the single card and keep their current precedence (hidden while revert/override links show). Combined cards do **not** gain these; pending confirms on a block stay Hero-only. State this in a Decision.
- [ ] Own ask status with `Cancel this ask` renders on the single card as today. The combined card gains `onCancelRide(item, rideId)` so Frame F’s cancel works for the member whose leg was posted.
- [ ] Legacy Request band (`showCarpoolBand`) still renders on the single card when the picker is not mounted and a gap exists. Do not delete it in this PR.

### Quiet actions and route

- [ ] Quiet actions share one link weight on single and combined, smaller than the primary: Edit plan (when a plan exists), Mark {Kid} not going, Split into N events on a combined card, Combine events on a single card that can recombine, View route when a route exists, Remove recurring on a locked plan (danger, quieter than Edit).
- [ ] View route calls the existing route opener. Single → that event. Combined → **both** existing leg links survive: TO run opens `onOpenRide(earliestMember, "TO")`, FROM run opens `onOpenRide(latestMember, "FROM")`. They may sit in the Legs table column headers or quiet row, but there is one per routable leg, not one for the block. Multi-venue “N stops” in the location line opens the TO link.
- [ ] Existing reverses stay reachable from the expanded card with their current labels and handlers: `Cancel this ask`; `Cancel request to {Name}`; `{Name} can't drive anymore? Reassign the ride`; can’t-make-it; remove coverage; withdraw ACCEPTED inbound (its own link, never merged with reassign); inbound Accept / Pass / Reconsider / Undo / Can't take them; pending Confirm coverage / Decline. The mock’s “I can’t drive” and “Take over driving” placeholders do not replace or rename them. Frame G’s override is the existing reassign / cancel-request pair.
- [ ] Inbound `AgendaInboundRequestRow` (Accept / Pass / Reconsider / Undo, hero-queue hide, auto-decline chip) stays mounted on the single card below the quiet actions. Combined cards do not mount it (Hero handles inbound on blocks; ACCEPTED withdraw keeps working through commitment actions). State this in a Decision.
- [ ] No confirmation dialog on those reverses (ADR-0002).

### Places, conflicts, errors, attendance (single card)

- [ ] Each active coverage keeps its own editable Leave from (`coverage-leave-from-{id}`, `onSetCoverageLeaveFrom`) in the expanded body. The Legs table does not replace it.
- [ ] Item-level Leave from (`leave-from-{source}-{id}`) still renders when no coverage is active and the picker is not mounted.
- [ ] Open Places still renders for `leaveByStatus === "UNAVAILABLE"` + `NO_ORIGIN` (item or self coverage) and calls `onOpenPlaces`.
- [ ] Family / danger conflict lines and the ride-commitment conflict line render above the decision area when not out of play.
- [ ] `Needs coverage for {kids}` and the `coverageActionError` alert render under the decision area.
- [ ] Not-going kids keep **Mark as going again** (`AttendanceToggle`, writes `YES`). Out-of-play items keep the muted shell with attendance controls only.
- [ ] Standing ride series band (`End standing Ask for {weekdays}`, hero hint, primary status) and `onEndStandingRide` stay reachable in their current position.
- [ ] Manual events keep Edit and Remove event (`onEdit` / `onRemoveEvent`) in the quiet-action area, Remove quieter than Edit.

### Combined card errors and places

- [ ] `actionError` on the block card renders whether or not the plan is locked (today it renders only inside the locked summary).
- [ ] Departure-item Leave from on the block keeps its current gating (viewer owns a TO leg, not settled-locked).

### Recurrence visibility (pre-existing hole)

- [ ] A collapsed locked/recurring card shows one card-level recurrence marker (text `Every {weekday}` from `recurrenceHintLabel`, or a `↻` prefix on that text) in the header meta line, same role as the when line. This is **not** per-leg; per-leg ↻ stays in `agenda-standing-leg-marker`. Collapsed body height unchanged. Reason: `calendar-card-hierarchy` moved Plan locked expanded-only and `agenda-card-one-language` deleted the `↻ Every {weekday}` stand-in, so a locked card is currently indistinguishable from a one-off when collapsed.

### Plan locked

- [ ] Plan locked chrome (title `Plan locked · repeats every {weekday}`, Edit plan, not going, Remove recurring, scope caption) is expanded-only on single and combined cards.
- [ ] Edit on a locked card reveals the same simple round-trip picker (not the split editor). Saving an existing plan uses `Save ride plan`.

### Frames

- [ ] **E** — Single, ride needed, You selected: Legs + shared Leave from + Confirm primary + Mark {Kid} not going. No Meet where?.
- [ ] **F** — Combined, mixed: Legs for every kid; a status/cancel block for a kid already asked; a live picker only for the kid still open; no picker for a fully assigned kid; Split and View route present.
- [ ] **G** — Combined, other parent drives every leg: Legs name that parent, not You; no picker and no primary; quiet Edit plan, not going, Split, and the existing `{Name} can't drive anymore? Reassign the ride` / `Cancel request to {Name}` links from `agendaCommitmentActions`.
- [ ] **H / I** — Plan locked single and combined share the locked section. Combined uses Split into N events where the single card uses Combine events.
- [ ] **K** — Two kids, identical open legs: one picker titled `{Kid} + {Kid} — ROUND TRIP`, one primary for both (one call per member event carrying both kid ids when they share an event, else one call per event), plus Different plans for each kid.
- [ ] **L** — Same kid, back-to-back, one venue, titles share no words: one kid row with a line per event; one Getting there before the first and one Coming back after the last; title falls back to the venue.
- [ ] **M** — Several venues, no shared title words: title `{first venue} + N more stops`; location line `N stops` with the route icon; calm plan chip when every leg is assigned.

### Regressions

- [ ] Ask, Post, Confirm, Save ride plan, Confirm-and-lock, standing Ask, Leave from, Meet where, leg-split, kid-split, Split/Combine, not going / going again, standing remove, End standing Ask, inbound Accept/Pass/Reconsider, and route navigation still perform the same operations they did before this restyle.
- [ ] No handler prop on `AgendaRow` loses its JSX consumer. Add a test that enumerates the callback props and asserts each is reachable in some rendered state (or list the exact exceptions in a Decision).
- [ ] ADR-0004 rules 1, 6, 7 hold on the block card: viewer-owned legs read `You`; the Legs table is the single grouped place that shows every kid’s plan (rule 6 grouping); cancel and withdraw stay independent links (rule 7). Record in Decisions that the Legs table is the rule-6 grouping now that the muted band and round-trip banner are gone.
- [ ] Hero and Focus are unchanged.

## Tasks

Order: lock the regression net first, then restyle.

- [x] Tests (before restyle): add the missing single-card nets listed under **Tests: AgendaRow** so they are green on `main` before any layout change.
- [x] Web: Shared expanded Legs table used by `AgendaRow` and `AgendaBlockCard`. Read-only. Block card keeps both TO/FROM View route links (one per routable leg) with the current representative items and `leg` argument.
- [x] Web: Extend `AgendaBlockCardProps` with item-scoped decision callbacks (`assignDraft` / `onUpdateAssignDraft`, `onAssignCoverage`, `onCreateRide`, `onSaveRidePlan`, `onSaveKidPlans`, `onCancelRide`, `canAskTeam`, `hasPickupPlace`, `coverageActionError`, standing lock weekday props). Wire them in `FamilyScreen` next to the existing `AgendaRow` wiring; grouped blocks share one adult draft and fan out one call per member event.
- [x] Web: Mount the existing simple DriverPicker on combined cards for kids (or identical-kid groups) that still need a decision. Titled block. Post / Confirm / Save labels name the kid(s). Posted open leg → status + `Cancel this ask` via `onCancelRide`.
- [x] Web: Single card — reorder into Legs → decision → Plan locked → quiet actions → caption **without removing** any row in the Functionality inventory. Inbound `AgendaInboundRequestRow`, standing ride series band, Request band, coverage Leave from editors, Open Places, conflict lines, needs-coverage line, going-again, manual Edit/Remove stay mounted.
- [x] Web: Quiet-action row on both shells; real reverse labels from `agendaCommitmentActions` / `decidedAssigneeRevertLabel`; withdraw separate from reassign; Remove recurring danger.
- [ ] Web: Plan locked section matches H/I; Edit returns to the simple picker with `Save ride plan` and `notGoingThisWeek`.
- [ ] Web: Block card renders `actionError` when unlocked.
- [ ] Web: Collapsed recurrence marker (`Every {weekday}`) back in the header meta on locked cards, single and combined. Not per-leg.
- [ ] Web: Combined title/location fallbacks for L and M (`combinedEventTitle` / location line). No token palette change.
- [ ] Web: No OpenAPI / backend changes.
- [ ] Tests: AgendaRow — `keeps End standing Ask and standing series hints when expanded`; `pending self Confirm/Decline call onConfirmCoverage/onDeclineCoverage`; `household-plan Confirm/Decline call onConfirmHouseholdPlan/onDeclineHouseholdPlan`; `Reconsider and Undo call onAcceptRide`; `Open Places renders for NO_ORIGIN`; `manual Edit and Remove event stay in quiet actions`; `Confirm and lock label when Lock checked`; `coverage leave-from editor survives next to Legs table`; `item-level leave-from renders when no coverage and no picker`; `Request band renders when picker not mounted and gap exists`; `collapsed locked card shows Every {weekday}` (restore the intent of the test at ~3639 that was weakened to expand first); `every callback prop is reachable in some rendered state`.
- [ ] Tests: AgendaBlockCard — `Frame F: posts only the open kid’s ids via onCreateRide for that member`; `Frame K: one primary issues one call per member event with grouped kid ids`; `Frame F cancel-ask calls onCancelRide with the member ride id`; `shows actionError when not locked`; `keeps both TO and FROM View route links passing leg`; `does not mount inbound Accept/Pass (decision)`; `Frame G shows reassign / cancel-request links and no primary`; `Frame H/I Edit reveals picker; Remove recurring calls onRemoveStandingBlock`.
- [ ] Tests: DriverPicker — `block title {Kid} + {Kid} — ROUND TRIP and Post label with names`; existing leg-split / kid-split / Meet where / Lock / standing Ask suites stay green untouched (no assertion loosened).
- [ ] Tests: Run `AgendaRow`, `AgendaBlockCard`, `DriverPicker`, `combinedEventLayout`, `agendaCollapsedChipParity`, **and the Agenda section of `FamilyScreen.test.tsx`**; then `npm run lint`, `npm test`, `npm run build` from `web/`. Report actual results.

## Decisions

1. **Illustrative color (2026-10-16).** Structure, order, and copy bind. Stay on existing dark tokens. Same call as slice 1.
2. **Placeholders are not a feature cut (2026-10-16).** “I can’t drive” / “Take over driving” do not replace a longer set of working reverses. Keep every handler that exists on the card today.
3. **Ask cardinality unchanged (2026-10-16).** A picker block posts the kid ids in that block through the current per-event API — one call per member event when the block spans events. No new per-kid request model and no batch endpoint. The mock’s “one post is one ask for one kid” is a visual framing, not a protocol change.
4. **Frame J undrawn (2026-10-16).** Edit locked → simple picker + `Save ride plan`. Do not invent the missing picture.
5. **Inbound stays single-card (2026-10-16).** `AgendaInboundRequestRow` (Accept / Pass / Reconsider / Undo) stays on `AgendaRow`. Combined cards do not mount it; Hero handles inbound asks on blocks; ACCEPTED withdraw keeps working via commitment actions. Revisit with `calendar-phone-frame` if blocks need inline Accept.
6. **Pending Confirm/Decline stays single-card (2026-10-16).** Combined cards do not gain `onConfirmCoverage` / `onDeclineCoverage`; pending confirms on a block stay Hero-only.
7. **Per-leg View route survives (2026-10-16).** The block card keeps TO and FROM links with their representative items (`day-block-route` AC). A single “block route” control would lose the Back deep link.
8. **Kid-split link scope (2026-10-16).** `Different plans for each kid` shows on any picker with 2+ going kids, including a single event. The mock’s “only on a grouped block” is read as “only when the picker scope has 2+ kids”.
9. **Picker scope (2026-10-16).** “Fully assigned kids get no picker block” applies to combined cards only. The single card keeps one picker for all going kids.
10. **ADR-0004 rule 6 (2026-10-16).** The Legs table is the grouped place that shows every kid’s plan now that the muted band and round-trip banner from `calendar-card-hierarchy` are gone. Rule 7 keeps cancel and withdraw as separate links.
11. **Collapsed recurrence marker restored (2026-10-16).** Card-level `Every {weekday}` in the header meta. Per-leg ↻ still belongs to `agenda-standing-leg-marker`.
12. **Callback reachability exception (2026-10-16).** `onLockStandingBlock` is deprecated and intentionally unused in `AgendaRow` (voided). The “every callback prop is reachable” net lists it as the only exception.
13. **Household-plan Confirm vs self cancel-request (2026-10-16).** Self `WAITING_HOUSEHOLD` no longer hides Confirm/Decline behind “Cancel request to You”; Confirm/Decline is the primary for that state (same precedence as Focus). Override links still hide Confirm when waiting on another adult or when a decided assignee/reassign link applies.

## Known stale references

- `agenda-carpool-action-parity` AC “no Accept or Pass buttons on the row” is superseded by current code (`AgendaInboundRequestRow`). Do not “fix” the row back to that AC.

## Open questions

None — implementable with current handlers and fields. Per-leg ↻ stays out.
