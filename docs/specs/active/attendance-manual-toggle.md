# Spec: attendance-manual-toggle

Status: approved  
Created: 2026-08-28  
Approved: 2026-08-31  
Parent: [docs/roadmap.md](../../roadmap.md)  
Added: 2026-08-28 · initial  
Branch: `attendance-manual-toggle`  
Depends on: [`coverage-priority-engine`](../archive/coverage-priority-engine.md), [`household-driver-assignment`](../archive/household-driver-assignment.md)  
Governs: [ADR-0003](../../decisions/ADR-0003-attendance-manual-default-going.md)

## Problem

Agenda still exposes a three-way RSVP chooser (Yes / No / No response) that
implies attendance is something parents must resolve. Product decision
([ADR-0003](../../decisions/ADR-0003-attendance-manual-default-going.md)): every
kid defaults to **going**; **not going** is the only deliberate signal; there is
no "not sure"; attendance never becomes a hero/queue task. The coverage queue
already maps RSVP → `going` / `not_going`, but the People band still ships the
old chooser and Yes/No vocabulary.

## Non-goals

- OpenAPI / backend rename of `YES` / `NO` / `NO_RESPONSE` → `going` /
  `not_going` (keep existing `setCalendarRsvp`; client maps). Enum cleanup is
  deferred; not an enforcement-fence concern.
- "Not sure" state, RSVP reminder / hero item for undecided attendance
- Team / coach RSVP rollup views
- Writing attendance back to iCal vendors or league apps
- Focus-card attendance controls (writes stay on expanded Agenda rows; Focus
  remains spotlight + next ride action)
- Changing assign → RSVP `YES` reset (already shipped in
  [`household-driver-assignment`](../archive/household-driver-assignment.md))
- Full copy / a11y / responsive polish pass
  ([`coverage-copy-a11y-polish`](../planned/coverage-copy-a11y-polish.md))
- Expo / iOS

## Approach

**Web-only UX swap on expanded Agenda rows.** Replace the per-kid three-way
`<select>` in the People band with the mock's two-state **AttendanceToggle**
links. Persist via existing `familyClient.setCalendarRsvp`:

| UI action | API write |
| --------- | --------- |
| Mark as not going | `NO` |
| Mark as going again | `YES` |

Read path: continue using `mapRsvpToAttendance` in `coverageQueue.ts`
(`NO` → `not_going`; `YES` and `NO_RESPONSE` / missing → `going`). Never offer
`NO_RESPONSE` in the UI.

**Copy (locked, mock):**

- Going: `Mark {kid} as not going` (text link)
- Not going: `{kid} is marked not going.` + link `Mark as going again`
- Always **"going" / "not going"** — never "make it" (ride-side revert copy
  keeps **"drive"** — see
  [`ride-revert-undo`](../archive/ride-revert-undo.md))

**Placement (mock `GameCard`):** under DriverPicker / RevertRideLink on the
expanded row; per kid on multi-kid items. When a kid is `not_going`, hide that
kid's driver/coverage chrome (existing `attendance !== "not_going"` gates) but
keep the toggle so they can reverse.

**Coverage release:** keep the existing confirm when setting not-going while the
kid has active PENDING/CONFIRMED coverage
(`rsvpCoverageReleaseMessage`). Cancel leaves attendance unchanged.

**Queue:** marking not going must not create a `getQueue` item. It may *remove*
a ride-needed gap (already true via `isInPlay`). Assert no attendance-only
queue entries.

**No OpenAPI / backend / contract client type changes** in this PR.

## Context

Allowlist for `/implement`:

- Decisions: [ADR-0003](../../decisions/ADR-0003-attendance-manual-default-going.md)
- Design mock: `docs/ui-system/carpool-hero-flow-mockup-v6.jsx` →
  `AttendanceToggle`, expanded `GameCard` placement (~lines 191–212, 418–458)
- Contract doc (update RSVP section): `docs/agenda-coverage-web-contract.md` →
  People / source band + RSVP
- Prior slice (assign resets going): [`household-driver-assignment`](../archive/household-driver-assignment.md)
  → ADR-0003 side effect only
- Source:
  - `web/src/components/AgendaRow.tsx` (People band RSVP `<select>`)
  - `web/src/components/FamilyScreen.tsx` (`onSetRsvp` / `setCalendarRsvp` +
    coverage-release confirm)
  - `web/src/components/rsvpDisplay.ts` / `rsvpDisplay.test.ts`
  - `web/src/components/coverageQueue.ts` (`Attendance`, `mapRsvpToAttendance`,
    `isInPlay`, `getQueue`)
  - `web/src/api/familyClient.ts` → `setCalendarRsvp` (call only; no signature
    change)

## Acceptance criteria

- [ ] Expanded Agenda People band has **no** Yes / No / No response `<select>`
      (or equivalent three-way control).
- [ ] Per kid on the item: when mapped attendance is **going**, show link
      **Mark {displayName} as not going**; when **not going**, show
      **{displayName} is marked not going.** with link **Mark as going again**.
- [ ] "Mark as not going" calls `setCalendarRsvp(..., NO)`; "Mark as going
      again" calls `setCalendarRsvp(..., YES)`.
- [ ] `NO_RESPONSE` / missing RSVP row still reads as **going** in UI and
      queue mapping; UI never offers setting `NO_RESPONSE`.
- [ ] Copy uses **going** / **not going** only — no "make it", no ride-side
      **drive** wording on this control.
- [ ] Marking not going while the kid has active coverage shows the existing
      coverage-release confirm; cancel leaves RSVP unchanged.
- [ ] A kid marked not going is out of `getQueue` for that game (no new
      attendance hero/queue item ever appears).
- [ ] When every kid on the item is not going, the row stays out-of-play
      (deemphasized; existing `isAgendaItemOutOfPlay` / Not going chip behavior
      unchanged).
- [ ] Assigning a real household driver still resets that kid to going (RSVP
      `YES`) — regression covered by existing assign tests; do not break.
- [ ] Calendar cache patches on attendance writes like other single-item
      mutations.
- [x] `docs/agenda-coverage-web-contract.md` People / RSVP sections describe the
      toggle (not three-way Yes/No/No response).
- [ ] No OpenAPI, backend, or `RsvpStatus` type rename in this PR.
- [ ] Component/unit tests cover toggle copy, API mapping (`going`↔`YES`,
      `not_going`↔`NO`), and "does not enqueue attendance" behavior.

## Tasks

- [x] Docs: update `docs/agenda-coverage-web-contract.md` People / RSVP to the
      two-state going / not-going toggle + API mapping note
- [ ] Web: add small attendance helpers/copy (e.g. extend `rsvpDisplay.ts` or
      colocated `attendanceToggle.ts`) — labels, `going`/`not_going` ↔ RSVP
      write targets; keep `mapRsvpToAttendance` as single read mapper
- [ ] Web: replace AgendaRow People-band `<select>` with per-kid
      AttendanceToggle links (mock placement relative to coverage/revert)
- [ ] Web: wire FamilyScreen handler — confirm-on-coverage-release for not
      going; write `NO` / `YES`; patch cache; busy/disabled while loading
- [ ] Web: hide per-kid driver/coverage chrome when that kid is not going
      (reuse existing `attendance !== "not_going"` gates; ensure multi-kid
      items only hide the not-going kid's controls)
- [ ] Tests: AgendaRow / FamilyScreen — toggle copy, `setCalendarRsvp` args,
      confirm cancel, out-of-play when all not going, queue exclusion
      regression via `coverageQueue` / existing helpers
- [ ] Tests: ensure no regression on assign → RSVP `YES` reset

## Open questions

_None blocking._ API enum rename deferred by product choice (2026-08-31);
inventory later if a second client needs shared vocabulary — not this PR.
