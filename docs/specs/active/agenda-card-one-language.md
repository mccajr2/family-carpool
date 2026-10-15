# Spec: agenda-card-one-language

Status: draft  
Parent: [docs/roadmap.md](../../roadmap.md)  
Created: 2026-10-09  
Added: 2026-10-09 · enhancement  
Spec'd: 2026-10-15 · collapsed slice 1 (PDF mock)

**PR size:** Fits one PR (desktop web Agenda collapsed shells only). Expanded
bodies stay in [`agenda-card-expanded-bodies`](../planned/agenda-card-expanded-bodies.md).

## Problem

`calendar-card-hierarchy` matched a four-frame mock for combined and locked
cards. Neighboring Agenda rows still use the previous language — compact
`RiderChips` on a single event beside kid + There/Back lines on a drive block —
so one week shows two card systems.

This slice is **one collapsed Agenda card language** on desktop web: shared
header (eyebrow, title, when, location, chip strip, chevron) and shared
collapsed body (kid row + There/Back). Binding source: PDF
*Agenda cards – collapsed language (slice 1)*. Colors, pixels, light theme,
shadows, and fonts are illustrative — map roles/tones to existing tokens;
do not restyle beyond structure and copy.

## Non-goals

Anything not drawn in the PDF, including:

- Expanded interiors; Getting there / Coming back blocks; DriverPicker;
  Confirm / Ask / Post / Save; Plan locked chrome; Edit plan; Remove
  recurring; not-going links — [`agenda-card-expanded-bodies`](../planned/agenda-card-expanded-bodies.md)
- Split into N events / Combine these
- Hero / Focus; inbound Accept/Pass rows (`AgendaInboundRequestRow`); undo
- Phone-width Calendar (`calendar-phone-frame`)
- Skipped / not-going kid un-combining a drive block —
  [`agenda-not-going-uncombine`](../planned/agenda-not-going-uncombine.md)
- Per-leg standing ↻ on There/Back —
  [`agenda-standing-leg-marker`](../planned/agenda-standing-leg-marker.md)
- Locked combined card; single event with 2+ kids; cancelled / rescheduled
  events
- New ride states, coverage rules, or OpenAPI fields
- Locking mock hexes / new type sizes into `design-tokens` (this mock is
  structure + copy; app stays on existing dark tokens)

Chips that appear in the legend but have no frame (Not going, Overlaps, Ride
conflict, 1 carpool ask, Confirm you'll drive, Waiting on {Name}, {Name}
confirmed, You're driving, You · N of M legs): vocabulary only — swap text
and tone with no layout change; do not invent new chrome to showcase them.

## Code confirmation (2026-10-15)

Checked before AC. Do not invent patterns for the gaps below.

| Question | Finding |
| -------- | ------- |
| Per-leg standing / ↻ | **Not on the wire today.** `CalendarItem` has event-level `standingLocked` + `standingBlockTemplateId` only. `CarpoolRideLeg` has phase/assignee, no standing bit. AgendaRow today shows card-level `↻ Every {weekday}` beside RiderChips, not per-leg. Standing templates *do* store per-leg ride plans server-side, but Agenda collapsed UI does not expose which legs are on the template. **Frame D’s asymmetric ↻ (There marked, Back open) cannot be proven from current calendar fields alone.** |
| Legend chips ↔ code | All legend labels exist (sentence case in source; `AgendaStatusChip` uppercases). Emitters: `rideStatusChipsForItem`, `combinedPlanChip`, plus ask chip appended by callers. |
| Legend misses (real states) | `Also driving {Kid}`; `Riding with {circle}` / teammate; `{Name} driving` / `{Name} driving · +n`; `{Name} confirmed · +n`; prefixed dual chips (`Getting there:` / `Coming back:`); kid-prefixed plan groups (`{Kid} · …`); block-run `You're driving · N rider(s)` (different from `· +n`); nameless `Confirmed`. Out of scope to add frames for these; do not delete emitters used elsewhere. |
| Combined title | **Supported.** `combinedEventTitle` already derives shared prefix+suffix words (`CYH Mite 3 Practice` + `CYH Squirt 1 Practice` → `CYH Practice`); identical titles kept; unrelated titles join with ` + `; empty → `Events`. Eyebrow: `combinedEventEyebrow` joins feeds with ` + `. |
| Per-leg `Asked team` / `Needs ride` | **Both exist** via `faceFromLeg` / `LEG_ASKED_TEAM` / `LEG_NEEDS_RIDE` → who values `Asked team` / `Needs ride`. Chip rollup uses longer `Asked the team` / `Ride needed`. |
| `You're driving · +1` | **`+n` = count of inbound accepted carpool kids** (teammate kids this circle is also driving), not household kids and not request count. One ask for two siblings → `· +2`. Tone `route` when n > 0, else `mint`. |

**Tone map (mock → existing `AgendaStatusChipTone`):** You / calm you-driving → `mint`; someone else / `· +n` / other-driver plan chip → `route` (no separate slate tone); needs action → `amber`; attendance → `muted`. Keep existing `family` for family-only Overlaps.

**Type role map (mock → existing tokens):** eyebrow → `listRowTeam`; title → `listRowTitle`; when → `listRowMeta`; location → `locationLine`; chip → `statusChip`; kid name / event·clock / There·Back → `listRowMeta` (name weight may match current block kid-row title weight). Relative AC only — same role on single and combined.

## Approach

Desktop web only. Unify collapsed `AgendaRow` onto the same header + kid-row
body `AgendaBlockCard` already uses (`buildCombinedEventLayout` /
`collapsedAssignmentLine`). Retire compact `RiderChips` as the resting
single-event body. Reuse `rideStatusChipsForItem` + `combinedPlanChip`
(plan chip only when every There/Back who is assigned; else urgent chips).
No OpenAPI change. No token restyle pass.

**Chip count:** Calm combined plan is at most one chip. Urgent path may show
more than one chip (Frame B: Ride needed + Asked the team). Every chip uses
the same size and weight (`statusChip` / `AgendaStatusChip`). Middle-dot `·`
in labels stays; do not add a separate status-dot decoration on the chip.

**Standing ↻ (Frame D):** Ship Frame D’s who line and urgent chip only.
Per-leg ↻ is **deferred** to
[`agenda-standing-leg-marker`](../planned/agenda-standing-leg-marker.md)
(decision 2026-10-15). Do not client-match standing templates or invent a
fake per-leg marker in this PR.

## Context

- Source: `web/src/components/AgendaRow.tsx`, `web/src/components/AgendaBlockCard.tsx`
- Layout / chips: `web/src/components/combinedEventLayout.ts`,
  `web/src/components/rideStatusChip.ts`, `web/src/components/coverageCopy.ts`,
  `web/src/components/agendaStatusChip.tsx`
- Standing (event-level only): `web/src/components/standingBlockChrome.ts`,
  `web/src/api/types.ts` (`standingLocked`, `standingBlockTemplateId`)
- Tokens (consume existing): `design-tokens/tokens.json` → typography
  `listRowTeam` / `listRowTitle` / `listRowMeta` / `locationLine` / `statusChip`
- Prior slice (reuse, do not re-litigate): `docs/specs/archive/calendar-card-hierarchy.md`
- Follow-on (do not implement):
  `docs/specs/planned/agenda-card-expanded-bodies.md`,
  `docs/specs/planned/agenda-not-going-uncombine.md`,
  `docs/specs/planned/agenda-standing-leg-marker.md`
- Mock: PDF *Agenda cards – collapsed language (slice 1)* (user-supplied)

## Acceptance criteria

### Shared collapsed language

- [ ] Collapsed single (`AgendaRow`) and combined (`AgendaBlockCard`) cards
      share the same header structure: eyebrow (when present), title, when,
      location (when present), chip strip, chevron.
- [ ] Collapsed body on both shells is a kid row: avatar initial, first name,
      `{event} · {clock}`, and right-aligned `There {who} · Back {who}`.
- [ ] `{who}` is only one of: `You` | `{FirstName}` | `Needs ride` | `Asked team`
      (existing `faceFromLeg` / `collapsedAssignmentLine`).
- [ ] Single collapsed cards do **not** use compact `RiderChips` as the
      resting body.
- [ ] Combined titles are not `N events tonight` (or similar count titles);
      use `combinedEventTitle` (shared words / join / `Events` fallback).
- [ ] Collapsed cards do not show run/timeline bands.
- [ ] Title role (`listRowTitle`) is the same size/weight on single and
      combined; chip role (`statusChip`) is the same size and weight on every
      card in this slice; eyebrow/when/location/meta roles match across shells.
- [ ] Urgent cards keep the existing amber outline behavior (no new outline
      system).

### Header identity (combined)

- [ ] Eyebrow is feed names joined with ` + ` (`combinedEventEyebrow`).
- [ ] Title is shared words of member event titles in order
      (`combinedEventTitle`); e.g. titles that only share `Practice` →
      `Practice`.
- [ ] When line is one compact span across all member events
      (`combinedEventWhen`).
- [ ] When locations differ, one primary location line is shown (existing
      block location behavior — do not invent multi-venue chrome).

### Chips

- [ ] Chip labels render uppercase via existing `AgendaStatusChip` (source
      stays sentence case).
- [ ] Allowed collapsed vocabulary for this slice is the PDF legend (urgent /
      calm single / combined plan / attendance). Frames A–D must match the
      labels and tones below; legend-only chips need no new showcase frames.
- [ ] `combinedPlanChip` appears only when every There/Back who is assigned
      (no `Needs ride` / `Asked team`). Labels:
      `{Who} · round trip` | `You · N of M legs` | `{Other} · N of M legs`.
- [ ] With any open leg, do **not** show a combined plan chip; show urgent
      chips from `rideStatusChipsForItem` (and existing ask append) instead
      (Frame B may show more than one).
- [ ] Tone follows who: You → `mint`; someone else / inbound `· +n` → `route`;
      needs action → `amber`; attendance → `muted`.
- [ ] `You're driving · +n`: `n` is inbound accepted carpool kid count
      (existing `drivingChipLabel` / inbound overlay). Unchanged meaning.

### Frame composites (collapsed)

- [ ] **A — Single, one kid, ride needed:** header + one kid row with
      `There Needs ride · Back Needs ride`; header chip `Ride needed`
      (amber); no RiderChips body.
- [ ] **B — Combined, 3 events, mixed coverage:** eyebrow feeds with ` + `;
      shared title; one when span; open legs → urgent chips (e.g. Ride needed
      and/or Asked the team), not a plan chip; kid rows show You / FirstName /
      Needs ride / Asked team as applicable; no row invents a fifth who value.
- [ ] **C — Combined, fully assigned, viewer drives nothing:** one combined
      plan chip naming the other parent (e.g. `Katy · 4 of 4 legs`); no kid
      row says `You`; chip same size/weight as A/B/D; tone `route` (someone
      else).
- [ ] **D — Single, standing + open leg:** who line `There You · Back Needs ride`
      (or equivalent assigned There + open Back) with `Ride needed` chip.
      **No per-leg ↻** in this PR (`agenda-standing-leg-marker`); do not show a
      fake per-leg marker and do not keep the old RiderChips +
      `↻ Every {weekday}` resting pair as the collapsed body.

### Out of scope regressions

- [ ] Expanded interiors, DriverPicker, Plan locked chrome, Split/Combine,
      Hero/Focus, inbound Accept/Pass, and undo links are unchanged by this
      PR’s collapsed restyle (no drive-by restyle).

## Tasks

- [x] Web: Collapsed `AgendaRow` body → kid row + `There`/`Back` via
      `buildCombinedEventLayout` (or shared helper extracted for one item);
      remove compact `RiderChips` from collapsed resting state.
- [x] Web: Ensure single-event header chip strip + chevron parity with
      `AgendaBlockCard` (same roles; urgent outline unchanged).
- [ ] Web: Confirm combined path still prefers `layout.planChip` when fully
      assigned, else deduped `rideStatusChipsForItem` (Frame B/C).
- [ ] Web: Remove or relocate card-level `↻ Every {weekday}` from collapsed
      single resting body so it does not reintroduce a second body language;
      do not invent per-leg ↻ (owned by `agenda-standing-leg-marker`).
- [ ] Web: No OpenAPI / backend changes.
- [ ] Tests: `AgendaRow` — Frame A (kid row + Ride needed, no RiderChips);
      Frame D who line without RiderChips resting body.
- [ ] Tests: `AgendaBlockCard` / `combinedEventLayout` — Frame B open legs →
      no plan chip + urgent chips; Frame C viewer drives nothing → other-parent
      plan chip, no `You` in rows.
- [ ] Tests: Assert chip size/weight parity only via shared component
      (`AgendaStatusChip` / `statusChip` tokens), not pixel snapshots of the
      light PDF.
- [ ] Tests: Run focused Agenda row/block/layout/chip suites; report results
      before calling the slice done.

## Decisions

1. **Per-leg ↻ (Frame D) — deferred (2026-10-15).** Ship Frame D assignment +
   urgent chip only. Follow-up:
   [`agenda-standing-leg-marker`](../planned/agenda-standing-leg-marker.md).

## Follow-ups (captured on roadmap)

| Id | Why |
| -- | --- |
| [`agenda-not-going-uncombine`](../planned/agenda-not-going-uncombine.md) | Kid **not going** must pull their event out of same-day / similar-time drive-block combinations so remaining going kids are not carded with a skipped kid. |
| [`agenda-standing-leg-marker`](../planned/agenda-standing-leg-marker.md) | Honest per-leg ↻ when a There/Back leg is on the standing plan (Frame D). |
| [`agenda-card-expanded-bodies`](../planned/agenda-card-expanded-bodies.md) | Expanded interiors (already ranked). |

## Open questions

None — implementable with current data.
