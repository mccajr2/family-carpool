# Agenda coverage — web behavior contract (reference client)

Status: **stable** (web dogfood complete — 2026-08-12; iOS + Android ported to this contract;
presentation hierarchy via [`calendar-ux-flow`](specs/archive/calendar-ux-flow.md);
conflict amber via [`conflict-detection`](specs/archive/conflict-detection.md);
DriverPicker default chrome via [`carpool-ride-coverage-card`](specs/archive/carpool-ride-coverage-card.md)
— 2026-09-11; split editor + per-leg hero gaps via
[`carpool-leg-split-plans`](specs/archive/carpool-leg-split-plans.md) — Done;
kid-split editor + per-kid gaps/chips via
[`carpool-kid-split-plans`](specs/archive/carpool-kid-split-plans.md) — Done;
per-leg family-side places via
[`carpool-leg-places`](specs/archive/carpool-leg-places.md) — Done;
Hero own-kid not-going escape via
[`hero-not-going`](specs/archive/hero-not-going.md) — Done;
player-conflict Hero slides via
[`player-conflict-hero`](specs/archive/player-conflict-hero.md) — Done)  
Parent: [coverage-confirm-decline](specs/archive/coverage-confirm-decline.md) ·
[conflict-detection](specs/archive/conflict-detection.md)

Web Agenda is the **source of truth** for coverage + leave-from **client UX**.
iOS and Android ports must match these rules and copy; do not invent parallel
patterns. Toolkit chrome may differ; **decisions and strings** must not.

Reference implementation: `web/src/components/FamilyScreen.tsx` (Agenda + Places
default leave-from + event compose).

Shared leave-by reason copy (all clients): `No leave-from place yet` /
`Add a location to estimate leave-by` / `Couldn't locate the destination` /
`Leave-by estimate unavailable`; estimate line
`Leave by ~{time} · estimate, not live traffic`.

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

## Loaded window (web)

- **Initial display:** local today through **+14 days** (`CALENDAR_INITIAL_DAYS`
  in `eventTimes.ts`). Session start always caps `calendarLoadedTo` here even
  when the calendar cache holds a longer range from prior **Load more** clicks.
- **Load more:** extends the displayed window by **+30 days**
  (`CALENDAR_PAGE_DAYS`) per click; may reveal cached rows before fetching.
- **Hero carousel** and **Week at a glance** use the **near-term horizon** only:
  local today through **+7 days** (`AGENDA_NEAR_TERM_DAYS` in
  `agendaDayGroups.ts`) — same window as the **This week** list bucket.
- Flat list rows, carousel slides, and the Context strip all derive from
  `agendaWindowItems` — kid-filtered items with `startsAt` in
  `[calendarLoadedFrom, calendarLoadedTo)`.

### Hero carousel queue

Build slides from `getQueue(mapCalendarItemsToCoverageGames(...))` inside the
near-term horizon only (`AGENDA_NEAR_TERM_DAYS` = 7). **Load more** / a longer
loaded calendar window does **not** add Hero slides (including
`playerConflict`) outside that horizon. A slide **leaves the carousel on the
next render** once the signed-in adult no longer has a decision on that kid
row (or, for player-conflict, once no household kid remains in-play on both
peers):

| Kid-row `ownRide` / kind | In carousel? |
| --- | --- |
| Unresolved **player conflict** (`playerConflict`) | Yes — keep A / keep B (or progressive per-kid split); see below |
| `unassigned` | Yes — pick a driver or ask the team |
| `{ driver: "You", confirmed: false }` | Yes — **Confirm coverage** / Decline (calendar coverage **or** split-plan `WAITING_HOUSEHOLD` assigned to you) |
| `{ driver: "<other>", confirmed: false }` | No — **Waiting on {driver}** (list chip only) |
| `"requested"` (asked the team) | No — waiting on teammates *(unless a per-leg / per-kid gap below, or waiting-on-you household leg)* |
| `{ driver, confirmed: true }` | No — covered *(unless a per-leg / per-kid gap below)* |
| Pending inbound carpool request (actionable) | Yes — Accept / Decline |

**Player conflict (must):** emit one `playerConflict` queue item per unresolved
**event-pair** from calendar `conflicts` with `type: KID_TIME_OVERLAP` — do
**not** re-derive overlap intervals in the client. A pair is unresolved for
Hero only when ≥1 household kid is still **in-play**
(`attendance !== "not_going"`) on **both** peers. Marking one side not-going
clears that kid from the conflict even if amber Agenda `conflicts` remain.
Deduplicate so one pair yields **one** slide (not one per peer). Per
[ADR-0001](decisions/ADR-0001-coverage-priority-rule.md), while walking
events soonest-first, emit the pair’s conflict slide **before** that event’s
own-ride gaps and inbound asks; do not jump it ahead of sooner events that
are not part of the pair.

**Player-conflict slide (must):** present **both** peers. Labels: **team ·
event** when linked (`feedName` · title via existing source/title helpers);
title-only for standalone/manual. Primary actions: **keep A** or **keep B**.
**Neither / not going** reuses the shared **Hero not-going** secondary control
(below) — not conflict-only chrome — and writes not-going on **both** peers
for kids in scope. Do **not** embed DriverPicker on this slide; after resolve,
normal `ownRide` / ask slides for kept in-play kids appear under ordinary
`getQueue` rules. No dedicated Undo — reverse via Agenda attendance or Hero
not-going on the kept event (and optional going on the other).

**Multi-kid same pair (must):** when multiple circle kids are unresolved on
the same pair, default is **one answer for all** (keep A → not-going on B for
every unresolved kid, or the reverse). Offer progressive **Different plans
for each kid.** (same disclosure copy as gap / Confirm): per-kid keep A, keep
B, or **neither** (not-going on both). Valid splits include one kid each
event, or one kid keeps / one neither.

**Resolve writes (must):** persist via existing `setCalendarRsvp` /
attendance mapping (`NO` = not going, `YES` = going) — same path as Agenda
and Hero not-going. Keep A writes not-going on B (and ensures going on A as
needed); neither marks not-going on both peers. After successful writes, the
`playerConflict` item is **absent** from `getQueue` / carousel on the next
render.

**Waiting-on-you household leg (must):** when `ownLegs` has
`WAITING_HOUSEHOLD` with `assigneeAdultId` equal to the signed-in adult, treat
that as pending-confirm-for-self — Hero / Focus / Agenda show **Confirm
coverage** / **Decline coverage**, and the leg chip body is **Confirm you'll
drive** (not **Waiting on {your name}**). Confirm/decline writes flip only
those waiting legs (other legs and pickup stay). Do **not** dual-write calendar
coverage for this path (that would cancel a mixed Ask).

**Per-leg own-ride gap (must):** `getQueue` / `isOwnRideGap` (and Focus CTAs
that mirror gap detection) also treat a **mixed** plan with an in-play leg in
`NEEDS_RIDE` as an own-ride queue item — even when rollup `ownRide` looks
covered, requested, or confirmed on the other leg. Mixed plans (household on
one leg, Ask / Needs ride on the other) and cancelled/withdrawn teammate legs
must re-enter the hero. Blank plans where **every** leg is still `NEEDS_RIDE`
are **not** per-leg gaps (household coverage rollup still owns those — same as
ride-status chips). When `ownLegs` are **non-blank and settled** (no
`NEEDS_RIDE`, not waiting-on-me), they **win** over stale calendar
`uncoveredKidIds` — no Hero / Needs coverage / Assign / Request. ADR-0001
ordering is unchanged; only gap *detection* widens to divergent `ownLegs`.

**Per-kid own-ride gap (must):** when this circle has **multiple** active own
plans for the event (`ownRequests` / equivalent), treat any **going** kid with
an in-play `NEEDS_RIDE` (or blank plan) as a gap even when a sibling’s plan is
asked or confirmed. Read **all** own plans for gap / queue / chip helpers —
do not key only off singular `ownRequest` / event-level `ownLegs` once plans
diverge (those singular fields stay valid only when there is exactly one plan;
`null` when 0 or 2+). Waiting-on-you / per-assignee revert stay scoped to the
assignee’s plan(s), not every sibling’s plan.

**Request CTA (must):** show **Request** only when `canAskTeam` and some
in-play kid is still an own-ride gap. Hide when every in-play kid's transport
is settled (CONFIRMED / ASKED_TEAM / waiting-on-someone-else). After can't-drive
clears a leg to `NEEDS_RIDE`, Request (and DriverPicker) return.

**Per-assignee revert (must):** emit one can't-drive / cancel-request link per
distinct decided assignee from `ownLegs` / each own plan (dedupe by assignee,
not by kid). Include the leg when they only own one (`… for getting there` /
`… for coming back`). Writes clear those legs only (`cancel` / `withdraw` with
`legs`, or `…/ride-plans/clear-legs` for PLAN / circle-local) — do not rewrite
remaining CONFIRMED household legs to WAITING.

**Matching-leg chip collapse (must):** when both slot bodies match, one
**unprefixed** chip with that body (e.g. `Asked team`, `You're driving · +1`,
even matching `Needs ride`) — never `Round trip: …`. When they differ, keep
dual Getting there / Coming back. True single-leg plans keep one prefixed chip.
Inbound `· +n` overlays household CONFIRMED bodies per leg kind, then collapse.

**Per-plan chip groups (must):** while every going kid shares the same
TO/FROM outcome, collapsed chips stay **shared** (no per-kid prefix) — same
as today’s single-plan chrome. When plans diverge, render **one chip group
per distinct plan** (kid first names joined like coverage copy), then reuse
matching-leg collapse **inside** that group. Do not render N kids × 2 legs as
six chips.

**FROM-only place copy (must):** inbound accepted FROM-only rows say **Drop off
in {town}** (display-only); withdraw passes `{ legs: ["FROM"] }` with
leg-scoped copy.

**Hero pending-confirm title (must):** `{Assigner} assigned you to drive {Kid}`
(coverage `assignedByAdultId` or plan `requestedByAdultId`); fallback
`Confirm you'll drive {Kid}`. True gaps keep `{Kid} needs a ride`. Buttons stay
Confirm coverage / Decline coverage.

**Hero not-going (own-kid slides only — must):** reuse Agenda’s attendance
write path (`setCalendarRsvp` → `NO`); no new API. Product copy is **going** /
**not going** only (same helpers as Agenda: `markAsNotGoingLabel` /
`markKidsAsNotGoingLabel`). Control is a **secondary text link** under the
primary Assign / Confirm chrome — never a competing primary CTA; style like
other hero secondary actions (`hero-on-secondary`). **Inbound ask** slides omit
this control entirely. Hero does **not** offer **Mark as going again** (Agenda
keeps reverse); not-going kids leave the Hero queue / kid-split set for that
game.

| Slide | Going kids | Not-going control |
| --- | --- | --- |
| **Player conflict** | 1+ unresolved on the pair | Secondary shared Hero not-going under keep A / keep B — marks **both** peers not-going for kids in scope (collapsed all-kids, or per-kid **neither** inside Different plans) |
| Own-ride **gap** | 1 | Secondary **Mark {firstName} as not going** under Assign / Save |
| Own-ride **gap** | 2+ | **Collapsed:** one all-kids secondary (`markKidsAsNotGoingLabel`). **Different plans for each kid.** → per-kid **ride** plans **plus** per-kid **Mark {firstName} as not going** (no per-kid stack on collapsed surface) |
| Pending **Confirm** | 1 | Secondary **Mark {firstName} as not going** under Confirm / Decline |
| Pending **Confirm** | 2+ | Confirm / Decline still apply to **both**; one all-kids secondary not-going link. **Different plans for each kid.** → **per-kid not-going only** — do **not** mount Assign / Ask / Save on Confirm |

Same disclosure copy (`DIFFERENT_PLANS_FOR_EACH_KID`) on gap and Confirm so the
pattern stays familiar. Gap opened sections are full kid-split via
`DriverPicker`; Confirm opened sections are per-kid not-going hosts only.

**Bulk write (2+ simple view):** one activation marks **every** currently going
kid on the slide `NO`. Coverage-release confirm (`rsvpCoverageReleaseMessage`)
runs when any selected kid has active `PENDING` / `CONFIRMED` coverage — same
gate as Agenda bulk / per-kid; cancel leaves **all** RSVPs unchanged.

**After write:** calendar cache patch like other RSVP mutations; that kid drops
out of `isInPlay` / `getQueue` for the game. Multi-kid: marking one kid not
going keeps the slide if another going kid still has a gap or pending confirm;
slide / carousel item clears when no own-kid attention remains for that event.
Attendance never enqueues a Hero item (ADR-0003).

When the filtered queue is empty, render the **All caught up** hero
(`heroGlow`, `CheckCircle2` 28px in `heroSuccess`, uppercase **All caught up**,
title **Nothing needs you right now**, body copy per
`docs/ui-system/carpool-hero-flow-mockup-v6.jsx`) — not carousel dots/arrows.
Section label **Needs your attention** stays above the hero in both states.

Resolving the last slide must land on that empty hero without a full-page
refresh. List rows for queued events stay excluded until they leave the queue.

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
3. **People / source** — source label + **per-kid attendance toggle** (two-state
   going / not going text links — not a field-row chooser).
4. **Coverage / actions** — active coverage lines, needs-coverage,
   Confirm/Decline, Assign — one spacing-grouped region, no inner card/band.
5. **Manual actions** — Edit / Remove for manual rows only (outside coverage so
   they remain when the row is out of play).

**Out of play** (every kid on the item is **not going**): deemphasize the item
(muted / reduced opacity); hide Travel, Coverage, and conflict amber; keep
Primary summary, People attendance toggles, and Manual Edit/Remove. Mixed
going / not going stays in play; not-going kids are omitted from uncovered /
Assign.

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
| People / source | source label, **per-kid attendance toggle** | Who is going / not going; attendance is separate from coverage |
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

- **Leave from** (Agenda item fallback and per-coverage band)
- **Covering adult** (Assign coverage)
- **My default leave-from** (Places)

Rules:

- Interactive: platform-native chooser (web `<select>`, iOS `Menu`, Android
  dropdown) showing the **current value** on the trailing side, with a clear
  affordance (chevron / control chrome). Leave-from also exposes Default /
  named place / one-time modes (see Leave-from below).
- Sole / read-only (≤1 option): same row layout; trailing side is plain text
  (no chooser, no chevron). Applies to **Covering adult**; Leave from still
  offers Default / one-time when only one located place exists.
- **My default leave-from** is always a chooser: **None** is always an option
  (plus located places). Trailing side stays interactive even when there are
  zero located places (value may read `None` / `No located places yet`).
- Does **not** apply to multi-select **Uncovered kids** (checkbox list) or to
  action buttons (Assign / Confirm / Open Places / etc.).
- Focus / hero leave-from uses a **subtle** disclosure, not this field-row.

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

## Leave-from (per item and per coverage)

Origin modes (locked with `coverage-leave-from`):

| Mode | UI | Stored |
| ---- | -- | ------ |
| **Default** | Show resolved place name (membership default → first located by name) | null place + null address |
| **Named place** | Located circle place only | `leaveFromPlaceId` |
| **One-time** | Free-text address (estimate only; never creates a Place) | `leaveFromAddress` |

- **Expanded Agenda — active coverage bands:** each `PENDING`/`CONFIRMED`
  coverage shows adult · kids · status, that row’s leave-by estimate, and a
  **Leave from** combobox (located places; membership default **preselected**
  and stored as Default/null; permanent **One-time address…** option). Any
  circle member may edit. Other adults’ origins stay visible.
- **Expanded Agenda — item-level Leave from:** only when the signed-in adult
  is **not** covering that item (no duplicate when they are). Same combobox;
  leave-by line + **Open Places** on `NO_ORIGIN` as before.
- **Focus / hero + expanded Agenda — uncovered own-ride (`DriverPicker`):**
  same assign stack on Focus card, hero attention slide, and expanded Agenda
  rows that already mount `DriverPicker`. Layout top → bottom:

  1. **Driver row** — one chip per household/circle adult (dynamic count),
     default selection = signed-in adult (**You**), plus exactly one trailing
     **Ask the team** chip in the **same** row. Do **not** use a separate
     team footer band (“Nobody in the household free?” + outline **Ask the
     team for a ride** button) on these surfaces.
  2. **Leave from** — single combobox (`LeaveFromControls`): membership
     default pre-selected; other located saved places as options; keep the
     existing **One-time address…** option inside the same combobox (no
     separate “other location” control outside it). Confirm / Post / Save
     that writes both legs applies this place to **both** TO pickup and
     FROM drop-off when those legs meet at **Our place**. When **Ask the
     team** is selected, show **Meet where?** first (Getting there and
     Coming back independently: **Our place** / **Driver’s place**, default
     **Our place**); hide Leave from when both legs are **Driver’s place**
     (short helper: address appears after someone accepts).
  3. **Primary button** — label updates live from Driver + Leave-from:
     - Household self / other adult →  
       `Confirm — You'll drive round trip from {origin}` /  
       `Confirm — {First}'ll drive round trip from {origin}`  
       (origin = resolved place name, or live one-time draft / empty
       placeholder). Pressing confirms coverage and commits leave-from draft
       when needed (same write path as today).
     - **Ask the team** selected → `Post to team — round trip`. Pressing
       posts a round-trip team ask for all **going** siblings together,
       persisting per-leg meet side (`REQUESTER` = Our place /
       `ACCEPTOR` = Driver’s place). Ask with TO **Our place** and no
       resolvable pickup still **400**; both legs **Driver’s place** may
       post without a requester place. Radius / distance matching stays
       out of this surface.
  4. **“Different plans for each leg.”** — plain text link **below** the
     primary button. Available whenever the circle has **2+ adults** (family-
     only split) **or** a carpool space/`rideEvent` exists. Ask chips stay
     hidden until a space exists (`showTeamSection`). Activating the link
     replaces the collapsed round-trip form with the **shared leg-split
     editor** (same Focus / hero / expanded Agenda surfaces):

     1. **Getting there** — independent driver row (household adults +
        trailing **Ask the team** when a space exists), same chip rules as
        the default row.
     2. **Coming back** — same, independently selected.
     3. **Per-leg meet side + family-side place** (`LeaveFromControls`, same
        Default / named located place / one-time triad as coverage
        leave-from):
        - When a leg is **Ask the team**: **Meet where?** (**Our place** /
          **Driver’s place**, default Our place) under that leg
        - **Picking up from** under Getting there when that leg is household
          or Ask with **Our place**
        - **Dropping off at** under Coming back when that leg is household
          or Ask with **Our place**
        - Omit the place control when a leg is open **Needs ride** or Ask
          with **Driver’s place** (helper: address appears after Accept)
        Radius / distance matching stays out.
     4. Primary button: **Save ride plan** — applies **both** legs in one
        user action (household and/or Ask combinations; open **Needs ride**
        on a leg is allowed and must re-enter the hero queue). Without a
        space, Save persists a circle-local `PLAN` (`space_id` null; Ask is
        rejected). With a space, Save uses the space ride-plan write.
     5. **Back to simple view** — restores collapsed round-trip DriverPicker
        chrome without forcing legs to re-sync; Confirm / Post round-trip
        from simple view still work as above.
     6. While the shared leg-split editor is open and the event has **2+
        going** kids, also show **“Different plans for each kid.”** so the
        adult can jump to per-kid without going back first. Jumping
        pre-fills each kid from the current shared TO/FROM selection (or
        the saved shared plan).

     Ask-the-team + Ask-the-team may stay on the simple Post path. Matching-leg
     chip collapse is display-only (`carpool-leg-chip-collapse`) — not required
     for this editor.

  5. **“Different plans for each kid.”** — plain text link on simple view
     (below the leg link when both are eligible) **only** when the event has
     **2+ going** kids (feed-linked / on the item, not RSVP NO). One going
     kid → omit the link. Do **not** run the shared leg-split editor and the
     kid-split editor at once — opening kid-split **replaces** simple (or
     shared leg-split) chrome. Activating the link shows **one nested
     DriverPicker section per going kid** (first-name header):

     1. Default per kid: collapsed round-trip driver row (household + trailing
        Ask the team when a space exists).
     2. Nested **“Different plans for each leg.”** per kid — same Getting
        there / Coming back editor already shipped (independent household /
        Ask / Needs ride per leg).
     3. **Per-kid / per-leg meet side + family-side places** — not one Leave
        from for the whole editor. Collapsed round-trip per kid: **Meet
        where?** for Getting there and Coming back when Ask; one **Leave
        from** combobox when any of that kid’s Ask legs is **Our place**
        (or household) — applied to those Our-place / household legs.
        Nested Getting there / Coming back: **Meet where?** under each Ask
        leg; **Picking up from** / **Dropping off at** independently when
        that nested leg is household or Ask with **Our place**; omit for
        **Needs ride** or Ask with **Driver’s place**.
     4. Primary **Save ride plan** applies **every** going kid in one user
        action. Server groups kids with identical TO/FROM **driver outcomes,
        family-side places, and meet sides** onto one RideRequest (seats =
        grouped kid count); divergent outcomes persist as separate requests. A
        kid appears on at most one non-cancelled plan per circle+event.
     5. **Back to simple view** restores collapsed shared round-trip chrome
        without forcing plans to re-merge. Confirm / Post round-trip from
        simple view still writes **one shared plan for all going kids**
        (merge).

  **Settled driver + inbound Accept:** when the signed-in adult is a confirmed
  household driver and has accepted an inbound ask, collapsed chips are dual
  **Getting there** / **Coming back** with `You're driving` (or `{name}
  driving`) and `· +n` only on legs that inbound request confirmed — not a
  single `You're driving · +n` that looks like a round-trip extra rider.
  `+n` remains inbound **request** count on that leg.

  **Pending for you:** leave-from combobox + Confirm / Decline only (no
  changeable driver). Confirm commits leave-from draft with confirm. After
  **CONFIRMED** covering, combobox writes immediately. Calm estimate copy
  when covering. Do not redesign pending-for-you or settled covering chrome
  in the ride-coverage-card / split-plans slices.
- **Route:** starting stop + leave-by come from `GET …/route`, which uses the
  same origin resolution (coverage → item override → default → first located).
  Changing leave-from refreshes Route via calendar item replace.
- Unlocated named places stay disabled in place choosers.
- One-time copy: leave-by is an **estimate**, never live traffic.

## Default leave-from (Places)

- **My default leave-from** control on Places: always a field-row chooser with
  **None** + located places (see field-row rules above).
- Used by leave-by origin order (coverage → override → default → first located
  by name); not shown as a second chooser on every Agenda row when unnecessary.

## Coverage

### Display

- Active rows (`PENDING` / `CONFIRMED`):  
  `{adult} · {kids} · {Pending|Confirmed}` (+ leave-from / leave-by on
  expanded Agenda travel band; DriverPicker / Revert for own-ride chrome).
- Declined rows are not shown as active coverage.
- Uncovered kids (API `uncoveredKidIds`): **Needs coverage** /
  **Needs coverage: {names}** (in-play only — not-going kids are never
  uncovered). Calendar chrome uses **remaining gap kids** =
  `uncoveredKidIds` minus kids on this circle’s **`ACCEPTED` own plan(s)**
  (`ownRequest` when singular, or all `ownRequests` when split — PENDING does
  not clear the gap). Names on the row copy are remaining gap kids only.
- Pending for signed-in adult: **Confirm coverage** and **Decline coverage**.
- **Collapsed status tags** (Focus + collapsed `AgendaRow`) share
  one precedence via `rideStatusChipsForItem` + `insertOwnRideStatusChip`
  (`rideStatusChip.ts` / `coverageDisplay.ts` / `rideCommitmentConflict.ts`):
  `Overlaps` → ride-commitment conflict chip (if any) → own-ride chip (if any)
  → `Needs coverage` (remaining gap) → **Confirm coverage** (pending-for-self)
  → **Awaiting confirm** (pending for someone else) → `Confirmed` → `All set`
  (Focus only, and only when there is **no** own-ride chip). Conflict chip
  (amber; from `rideCommitmentConflict`): **Also driving {inbound kid
  first-name}** when Type A with exactly one inbound kid name; else **Ride
  conflict** (Type A multi-kid or Type B mutual swap). Shown **alongside** the
  own-ride / gap chip — not instead of it. Own-ride chip: **Riding with
  {acceptingCircleName}** (mint; blank name → **Riding with a teammate**) when
  `ACCEPTED`; **Requested** (amber) when `PENDING`. Do not use “Accepted ·” /
  “Accepted:”.
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
- Assign / confirm also set those kids’ RSVP to **Yes** / going (server);
  assigning a **not going** kid fails.

### Coverage assign / Ask the team (`DriverPicker`)

Own-ride **uncovered** gaps on Focus / hero and expanded Agenda use shared
`DriverPicker` + `LeaveFromControls` + `coverageCopy` (web reference; no
second stack). Rules and strings live under **Leave-from → Focus / hero +
expanded Agenda — uncovered own-ride** above. Summary:

- Household adult chips + trailing **Ask the team** chip in one driver row;
  default = signed-in adult.
- Leave-from combobox under the driver row when household is selected, or
  when Ask legs meet at **Our place** (Confirm / Post / Save writes that
  place to Our-place / household legs); primary CTA under leave-from / meet
  controls.
- When **Ask the team** is selected: **Meet where?** for Getting there and
  Coming back (**Our place** / **Driver's place**, default Our place); hide
  Leave from when both are Driver's place.
- Household selection → live **Confirm — … round trip from {origin}**
  (assigns / confirms coverage + leave-from draft).
- Ask the team → live **Post to team — round trip** (persists per-leg meet
  side; radius / distance match still out).
- **Different plans for each leg.** under the primary button opens the shared
  leg-split editor (Getting there / Coming back, **Meet where?** under each
  Ask leg, **Picking up from** / **Dropping off at** when that leg needs Our
  place / household place, **Save ride plan**, **Back to simple view**) —
  see Leave-from → uncovered own-ride above. Hero void treats in-play
  `NEEDS_RIDE` legs as gaps (see Hero carousel void).
- **Different plans for each kid.** under the leg link (2+ going kids only)
  opens the kid-split editor (one nested DriverPicker per kid, nested
  leg-split, per-kid / per-leg meet side + places, atomic **Save ride plan**
  with identical-outcome grouping including places and meet sides, **Back to
  simple view**) — see Leave-from → uncovered own-ride above. Hero void /
  chips read all own plans (per-kid gaps + per-plan chip groups).
- Inbound **PickupLine** / detour only when there is a requester family-side
  stop (TO meet **Our place**, or FROM-only **Our place** drop-off); Driver's
  place asks omit a fake pickup detour.
- No separate “Nobody in the household free?” / outline Ask-the-team footer
  on these surfaces.

## RSVP / attendance

Web Agenda (and Hero own-kid slides) use a **two-state attendance** model
(ADR-0003). Product copy is always **going** / **not going** — never "make
it", and never ride-side **drive** wording on this control. OpenAPI still uses
`YES` / `NO` / `NO_RESPONSE`; the client maps — no enum rename in this surface.

### Read mapping

| API `RsvpStatus` (or missing row) | UI / queue attendance |
| --- | --- |
| `YES` | `going` |
| `NO_RESPONSE` / missing | `going` (default; no action required) |
| `NO` | `not_going` |

### Write mapping

| UI action | Surface | API write |
| --- | --- | --- |
| **Mark {displayName} as not going** | Agenda People band; Hero gap / Confirm (1 kid or per-kid inside Different plans) | `NO` |
| **Mark {names} as not going** (`markKidsAsNotGoingLabel`) | Agenda simple-view bulk; Hero gap / Confirm simple view (2+ going) | `NO` for **every** currently going kid on that item / slide |
| **Mark as going again** | Agenda People band only | `YES` |

UI never offers setting `NO_RESPONSE`. Attendance never creates a hero / queue
item; marking not going may *remove* a ride-needed gap (`isInPlay` /
`getQueue`). Hero surfaces omit reverse (**Mark as going again**).

Shared coverage-release gate (Agenda + Hero): client confirm only when marking
**not going** while the kid (or any kid in a bulk selection) has active
(`PENDING` / `CONFIRMED`) coverage — `rsvpCoverageReleaseMessage` / `This will
remove coverage for {kidName}.` Cancel leaves attendance unchanged (bulk:
**all** unchanged). No confirm when uncovered or when marking going again.
Patch the calendar cache on attendance writes like other single-item
mutations.

### Control (expanded Agenda row)

- Per kid on the item (under DriverPicker / RevertRideLink on the expanded
  row; multi-kid items get one toggle each):
  - **going:** text link **Mark {displayName} as not going**
  - **not going:** `{displayName} is marked not going.` + link **Mark as going
    again**
- When a kid is not going, hide that kid’s driver / coverage chrome; keep the
  toggle so they can reverse.
- `data-testid` / a11y id `rsvp-{source}-{id}-{kidId}` (stable id; control is
  no longer a `<select>`).

### Control (Hero own-kid gap + Confirm)

See **Hero not-going** under Hero carousel queue. Summary: 1-kid secondary
`markAsNotGoingLabel`; 2+ collapsed all-kids `markKidsAsNotGoingLabel`; gap
**Different plans for each kid.** = plans + per-kid not-going; Confirm
**Different plans for each kid.** = per-kid not-going only (no ride-plan
editor). Inbound asks unchanged.

## Week at a glance

Calendar **Context** aside only (web: `AgendaWeekGlance` in
`FamilyScreen.tsx`; rollup in `agendaWeekGlanceDays.ts`). Heading **Week at
a glance**. Ports must match the window, counts, and strings below
([`agenda-week-glance-mobile`](specs/planned/agenda-week-glance-mobile.md)).
Toolkit chrome may differ; **decisions and strings** must not.

### Window

- Always **today + the next six local days** (seven rows; never omit a day).
  Same local-day math as Agenda grouping (`startOfLocalDay` / `addDays`) and
  the hero carousel horizon (`AGENDA_NEAR_TERM_DAYS` = 7).
- Aligns with the full **This week** list bucket (`weekEnd` = today+7).
- Bucket an item onto the local calendar day of `startsAt`. Unparseable
  `startsAt` is skipped (no throw). Overnight events count on the start day
  only.
- Derive from the kid-filtered **display** window (web: `agendaWindowItems`) —
  the same near-term slice as the hero carousel + flat list rows. Do not fetch
  a wider range.

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
| `n` in-play with **remaining gap kids** > 0 (`uncoveredKidIds` minus kids on this circle’s **ACCEPTED** own plan(s); PENDING does not clear) | **1 needs coverage** / **{n} need coverage** | amber |
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
7. Field rows: Leave from / Covering adult / My default leave-from are
   horizontal (label leading, value/picker trailing). Per-kid attendance is
   the two-state toggle (not a field-row chooser).
8. Presentation hierarchy: bands + one situational primary CTA;
   out-of-play chrome when all kids are not going; coverage-release confirm
   when marking not going with active coverage. Flat-row chrome is
   `docs/agenda-full-redesign-addendum.md` (web).
9. Tests covering the matrix above (especially sole kid, kid-toggle without
   clearing adult, Save → Saving… without Sign out → Working…).
10. Focus card selection + rendering — web only — not yet ported.
11. Full Agenda row redesign (day-grouping, card rows, expand/collapse) — web only — not yet ported.
12. Week at a glance (seven-day Context strip) — web only — not yet ported.

## Toolkit differences (OK)

Compose as dialog (web) vs sheet (iOS) vs destination swap (Android);
`aria-busy` web-only; Sign out placement in shell chrome.

## Out of scope here

- Vehicle / seats / nonplayers / trip planning.
- Redesigning Calendar onto full UI-token adoption (`ui-system-destination-adoption`).
- Travel / leave-by “cutting it close” soft warn (`conflict-travel-margin`).
