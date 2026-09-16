# Spec: hero-not-going

Status: draft  
Created: 2026-09-16  
Parent: [docs/roadmap.md](../../roadmap.md)  
Branch: `hero-not-going`  
Added: 2026-09-16 · re-rank split  
Depends on: [`attendance-manual-toggle`](../archive/attendance-manual-toggle.md), [`hero-attention-carousel`](../archive/hero-attention-carousel.md), [`carpool-kid-split-plans`](../archive/carpool-kid-split-plans.md)  
Governs: [ADR-0003](../../decisions/ADR-0003-attendance-manual-default-going.md) (reuse; no amend)

## Problem

Hero attention slides (own-ride gap and pending household Confirm) only offer
ride actions (Assign / Confirm). If the kid is **not going**, the adult must
expand Agenda and use attendance there — or feel forced to Confirm/Assign just
to clear the carousel. That is inconsistent with Agenda and the wrong default
for a “needs your attention” surface. This shared escape is also a
**prerequisite** for a consistent
[`player-conflict-hero`](../planned/player-conflict-hero.md) (neither / escape
without inventing conflict-only chrome).

## Non-goals

- Changing Agenda attendance chrome (`attendance-manual-toggle` stays SoT for
  expanded rows; keep Agenda simple-view bulk “Mark A and B as not going” as-is)
- Making attendance itself a queue *reason* (still no “undecided RSVP” Hero
  item; ADR-0003)
- Inbound carpool **ask** slides (other family’s kids — not our attendance)
- Player-conflict keep A vs B UX (`player-conflict-hero` — **consumes** this
  shared not-going affordance after this ships)
- OpenAPI / backend rename of RSVP enums; Expo / KMP
- Hero “Mark as going again” reverse (Agenda keeps reverse; not-going kids
  leave the Hero queue / kid-split set)
- Redesigning Confirm primary (Confirm / Decline stay as the default for
  **both** kids on a multi-kid assignment)
- Opening a full kid-split **ride plan** editor on Confirm (Assign / Ask /
  Save) — Confirm progressive disclosure is **per-kid not-going only**

## Approach

**Web-only.** Reuse Agenda’s attendance write path — no new API.

| UI action | API write |
| --------- | --------- |
| Mark as not going | `setCalendarRsvp(..., NO)` |

Read path unchanged (`mapRsvpToAttendance`). Coverage-release confirm stays the
existing `rsvpCoverageReleaseMessage` gate in `FamilyScreen` when the kid has
active `PENDING` / `CONFIRMED` coverage; cancel leaves RSVP unchanged.

**Where it appears (own-kid Hero slides only):**

| Slide | Going kids | Not-going control |
| ----- | ---------- | ----------------- |
| Own-ride **gap** | 1 | Secondary text link under primary Assign / Save chrome: **Mark {firstName} as not going** |
| Own-ride **gap** | 2+ | **Collapsed:** one all-kids secondary link (`markKidsAsNotGoingLabel`). **Different plans for each kid.** → existing per-kid **ride** plans **plus** per-kid **Mark {firstName} as not going** |
| Pending **Confirm** | 1 | Secondary text link under Confirm / Decline |
| Pending **Confirm** | 2+ | **Collapsed:** Confirm / Decline still apply to **both**; one all-kids secondary not-going link. **Different plans for each kid.** → progressive **per-kid not-going only** (sick-kid escape). Do **not** mount Assign / Ask / Save ride-plan chrome on Confirm |

**Gap vs Confirm progressive (locked):** same disclosure **copy**
(`DIFFERENT_PLANS_FOR_EACH_KID`) so the pattern stays familiar. On **gap**,
opened sections are full kid-split (plans + not-going) via `DriverPicker`. On
**Confirm**, opened sections are per-kid not-going hosts only — no second plan
editor while an assignment is pending. Gap path: add all-kids secondary on
simple view + per-kid not-going inside kid-split. Confirm path: add all-kids
secondary + lightweight disclosure for per-kid not-going.

**Copy / weight:** reuse `markAsNotGoingLabel` / `markKidsAsNotGoingLabel`.
Secondary text link — never compete with Assign / Confirm as the primary CTA.
Going / not going vocabulary only (no “drive”). Hero inverse: style like other
hero secondary actions (`hero-on-secondary`), not Agenda light-surface tokens
blindly.

**Bulk write (2+ on simple view):** one activation marks **every** currently
going kid on the slide `NO` (same coverage-release confirm rules as Agenda
bulk / per-kid — confirm if any selected kid has active coverage; cancel
leaves all unchanged).

**After write:** calendar cache patch like other RSVP mutations; kid drops out
of `isInPlay` / `getQueue` for that game. Multi-kid: marking one kid not going
keeps the slide if another going kid still has a gap or pending confirm;
slide / carousel item clears when no own-kid attention remains for that event.

**No OpenAPI / backend / Expo.**

## Context

Allowlist for `/implement`:

- Decisions: [ADR-0003](../../decisions/ADR-0003-attendance-manual-default-going.md)
- Contract (extend Hero / RSVP write surfaces): `docs/agenda-coverage-web-contract.md`
  → Hero carousel queue; RSVP / attendance; DriverPicker / Different plans for
  each kid
- Prior slices: [`attendance-manual-toggle`](../archive/attendance-manual-toggle.md)
  (Agenda SoT + write mapping); [`carpool-kid-split-plans`](../archive/carpool-kid-split-plans.md)
  (progressive **Different plans for each kid.**); [`hero-attention-carousel`](../archive/hero-attention-carousel.md)
  (reverses its deferral of carousel not-going)
- Downstream consumer (do not implement): [`player-conflict-hero`](../planned/player-conflict-hero.md)
- Source:
  - `web/src/components/HeroAttentionSlide.tsx` (gap `DriverPicker` vs Confirm chrome)
  - `web/src/components/DriverPicker.tsx` (kid-split sections; `DIFFERENT_PLANS_FOR_EACH_KID`)
  - `web/src/components/FamilyScreen.tsx` (`setCalendarRsvp` + coverage-release confirm)
  - `web/src/components/AttendanceToggle.tsx` / `coverageCopy.ts`
    (`markAsNotGoingLabel`, `markKidsAsNotGoingLabel`)
  - `web/src/components/coverageQueue.ts` (`isInPlay`, `getQueue` — no attendance enqueue)

## Acceptance criteria

- [ ] On an own-ride **gap** Hero slide with **one** going kid, a secondary
      text link **Mark {firstName} as not going** appears under the primary
      Assign / Save chrome (not as the primary button).
- [ ] On an own-ride **gap** Hero slide with **2+** going kids, collapsed
      simple view shows **one** secondary all-kids link
      (`markKidsAsNotGoingLabel`); after **Different plans for each kid.**,
      each kid section has **Mark {firstName} as not going** (no stack of
      per-kid links on the collapsed surface).
- [ ] On a pending **Confirm** Hero slide with **one** going kid, the same
      secondary **Mark {firstName} as not going** link appears under Confirm /
      Decline.
- [ ] On a pending **Confirm** Hero slide with **2+** going kids: Confirm /
      Decline remain the default for **both**; one all-kids secondary
      not-going link; **Different plans for each kid.** reveals **per-kid
      not-going only** (no Assign / Ask / Save ride-plan chrome on Confirm).
- [ ] Activating the all-kids simple-view link writes `NO` for every currently
      going kid on the slide; cancel on coverage-release leaves all unchanged.
- [ ] Activating a per-kid not-going link (1-kid surface or inside Different
      plans) calls `setCalendarRsvp(..., NO)` for that kid; coverage-release
      confirm runs when that kid has active PENDING/CONFIRMED coverage; cancel
      leaves RSVP unchanged.
- [ ] After a successful not-going write, that kid is out of `getQueue` for
      the game; the slide drops when no own-kid gap/confirm remains for the
      event; no attendance-only queue item ever appears (ADR-0003).
- [ ] Inbound **ask** slides are unchanged (no attendance control).
- [ ] Copy uses **going** / **not going** only; control is visually secondary
      to Assign / Confirm on hero glow.
- [ ] `docs/agenda-coverage-web-contract.md` documents Hero not-going
      (1-kid secondary; 2+ all-kids secondary; gap Different plans = plans +
      per-kid not-going; Confirm Different plans = per-kid not-going only) and
      write mapping matching Agenda (`NO` = not going).
- [ ] No OpenAPI, backend, or Expo changes in this PR.
- [ ] Component/unit tests cover: single-kid gap + Confirm → `NO`; multi-kid
      all-kids bulk; gap Different-plans per-kid not-going; Confirm
      Different-plans per-kid not-going **without** ride-plan chrome;
      coverage-release cancel; ask slides omit control; queue exclusion after
      not-going.

## Tasks

- [ ] Docs: update `docs/agenda-coverage-web-contract.md` Hero + RSVP sections
      for Hero not-going (gap + Confirm; all-kids secondary + progressive
      per-kid)
- [ ] Web: wire Hero secondary not-going on gap and Confirm — 1 kid
      `markAsNotGoingLabel`; 2+ simple view `markKidsAsNotGoingLabel` bulk
      write (reuse FamilyScreen RSVP / coverage-release gate)
- [ ] Web: extend `DriverPicker` kid-split (**gap**) with per-kid not-going
- [ ] Web: Confirm 2+ — same **Different plans for each kid.** copy + per-kid
      not-going sections only (no Assign / Ask / Save); alongside collapsed
      all-kids not-going link
- [ ] Web: HeroAttentionSlide / FamilyScreen props — pass `onSetRsvp` /
      bulk-not-going (or equivalent) into gap + Confirm paths; busy/disabled
      while loading
- [ ] Tests: `HeroAttentionSlide` / carousel / FamilyScreen — single-kid write,
      multi-kid all-kids bulk, gap vs Confirm progressive (Confirm has no
      ride-plan chrome), coverage-release cancel, ask exclusion, queue drop
- [ ] Tests: no regression on Agenda AttendanceToggle / assign → RSVP `YES`
      reset

## Open questions

_None blocking._ Locked: 1-kid secondary link; 2+ collapsed all-kids not-going;
**Different plans** on gap = plans + per-kid not-going; on Confirm = per-kid
not-going only (Confirm/Decline still both); not inbound asks.
