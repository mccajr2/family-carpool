# Spec: carpool-recurring-locked-plan

Status: draft  
Created: 2026-09-21  
Promoted: 2026-09-23 · `/spec`  
Parent: [docs/roadmap.md](../../roadmap.md)  
Added: 2026-09-21 · re-rank split  
Branch: `carpool-recurring-locked-plan`

## Problem

Families repeat the same weekday logistics every week — e.g. dad leaves the
home office, picks kid 1 up at the community center and kid 2 at school, drives
both to the rink for kid 2’s practice (kid 1 waits), mom leaves her office and
takes kid 2 home after that practice, dad stays for kid 1’s later practice and
brings kid 1 home. Today each week’s FEED occurrences still need fresh
coverage confirm, Save ride plan, and leave-from / return-to setup even when
nothing changed. Adults need an **explicit locked standing household plan** on
the drive block that applies week over week until they remove it — no ritual
re-confirm when the pattern is unchanged.

## Non-goals

- Teammate Ask/Accept standing or rotation
  (`carpool-recurring-standing`, `carpool-recurring-rotation`)
- Neighborhood proximity discovery (`neighborhood-carpool`)
- Gap-fill when a locked driver can’t cover that week
  (`carpool-driver-gap-fill`)
- Hybrid “Use last Tuesday’s plan?” prompt (future enhancement after this
  explicit Lock ships)
- iCal `RRULE` / `RECURRENCE-ID` series identity as the primary matcher (sports
  feeds are expanded one-off UIDs; series parsing is a later upgrade if feeds
  start shipping real recurrence)
- Inventing new drive-block merge rules (reuse existing day-block membership;
  no FORCE_MERGE/SPLIT changes)
- Linked MANUAL members in the locked pattern
  (`drive-block-linked-manual` stays parked)
- Auto-copy without an explicit Lock
- Expo / KMP / RN
- Changing teammate ride Accept / Pass semantics

## Approach

**Web-first. Explicit Lock on an Agenda drive block; server-persisted circle
template; fingerprint match + forward recurrence gate; apply coverage + ride
plans + route home-side to blank future weeks; one-off edits stick; Remove
recurring or schedule-ended auto-clear deletes the template (never orphan
locked chrome).**

**Fingerprint (series substitute).** For a FEED calendar item:
`feedId` + local weekday + local start time-of-day (minute) + normalized
location string. Do **not** key locks on per-occurrence iCal UID / item UUID
(those change every week on typical sports feeds).

**Forward recurrence gate (Lock CTA).** Show Lock only when the signed-in
adult’s **current drive block** has ≥1 FEED member, and **every** FEED member
of that block has **≥3 other upcoming** FEED rows in the synced horizon
(`[localToday, loaded/synced to)`) that share that member’s fingerprint
(excluding the member itself). Irregular games (varying time/destination) fail
the gate — no accidental Lock on a short coincidence of 8am home games unless
the same fingerprint truly repeats ≥4 times upcoming (current + 3 others).
Singleton blocks (one event) are allowed when that one event passes the gate.

**What Lock stores.** Circle-scoped standing template keyed by an ordered set
of member fingerprints (the block’s FEED members at lock time) plus, for each
member fingerprint, a snapshot of **all household state on that calendar
item** — not only the viewing adult’s TO/FROM leg:

- Active coverage rows (adult + kids + `CONFIRMED` / `PENDING` as set)
- Active circle ride plan(s) (per-kid / per-leg phases, assignees, family-side
  places, meet sides — same shape as Save ride plan)
- Per-adult itinerary home-side overrides for TO Leaving from / FROM Returning
  to on the member-set route when present (`block-route-origin`)

Drive blocks remain **computed** (no new trip entity). The template is the
new persisted artifact. Lock is available to any circle member adult; storing
other adults’ coverage/legs is intentional (mom’s FROM on kid 2 is part of
dad’s Tuesday block pattern).

**Apply.** On feed sync and calendar read enrichment for the circle, for each
active template: find future FEED items matching each member fingerprint on
the same local calendar day (same weekday instance), and when those items
would form the same block membership for the template’s drivers, copy the
snapshot onto items that are still **blank for the circle** — no active
coverage rows and no active ride plans yet. **Never overwrite** an item that
already has household coverage or plans (one-off edits and manual setup
stick). Re-apply only fills newly appeared blank matches.

**One-off vs pattern change.** Adults may edit any single week’s coverage /
plans / places at any time; that does not clear the lock. To change the
standing pattern going forward: **Remove recurring coverage** (exact chrome
copy ok to tune) deletes the template; already-applied weeks keep their data;
future weeks stop receiving auto-apply until the household replans a week and
Locks again.

**Schedule ended (mid-season shift).** When youth ice time / half-season
schedules wipe the standing practices (e.g. Tuesdays vanish from the feed),
do **not** leave the template orphaned. On feed sync / calendar enrich: if
**every** fingerprint in an active template has **zero upcoming** FEED matches
in the synced horizon, **auto-clear** the template with the same effect as
Remove recurring (stop apply; keep already-written weeks; locked chrome
goes away). Optionally surface a **one-time dismissible** Agenda note the
first time this happens (“Recurring coverage ended — schedule changed”);
copy may be toned down or omitted if block density makes it noisy — auto-clear
itself is required.

**Contract.** OpenAPI changes: Lock / Remove recurring endpoints (or calendar
sub-resource), calendar/block response fields for lock eligibility + locked
state (+ optional schedule-ended signal for the dismissible note), web clients
updated in the same change. No KMP `sharedLogic` updates.

## Context

Allowlist for `/implement`. Paths and **headings**, not whole-doc dumps.

- Architecture: `docs/architecture.md` → Team carpool space (detail) **Rides**;
  Leave-by (detail) **Multi-stop itinerary** / home-side override; Coverage
  (detail); Activity feeds upsert-by-UID note
- ADR: `docs/decisions/ADR-0004-carpool-card-perspective-rules.md` (block /
  perspective chrome)
- Archived reuse: `docs/specs/archive/day-block-domain.md` (membership rule —
  do not change); `docs/specs/archive/day-block-agenda.md` (block card
  surface); `docs/specs/archive/day-block-route.md` +
  `docs/specs/archive/block-route-origin.md` (route member-set + Leaving from /
  Returning to)
- Sibling stubs (boundaries only): `docs/specs/planned/carpool-recurring-standing.md`,
  `docs/specs/planned/carpool-recurring-rotation.md`
- Source: `backend/modules/calendar/internal/DriveBlockEnricher.java`,
  `DriveBlockRouteResolver.java`; `backend/modules/coverage/`;
  `backend/modules/carpool/internal/CarpoolRideService.java` (Save ride plan /
  confirm-household); `backend/modules/feeds/FeedEventKey.java`,
  `internal/FeedsService.java` (sync upsert); `web/src/components/AgendaBlockCard.tsx`,
  `agendaBlockSections.ts`; `web/src/api/carpoolClient.ts`, `familyClient.ts`;
  `contracts/openapi.yaml` (calendar + carpool ride-plan paths)

## Acceptance criteria

- [ ] **Lock CTA gated:** Web Agenda drive-block chrome shows Lock only when
      every FEED member of that block has ≥3 other upcoming fingerprint matches
      in the synced horizon; otherwise Lock is hidden (one-off Confirm / Save
      unchanged).
- [ ] **Lock persists household block pattern:** With Lock on a multi-member
      block whose items already have CONFIRMED split coverage (e.g. adult A TO
      both kids, adult B FROM kid 2, adult A FROM kid 1) and matching ride plans
      + route home-side places, the server stores a circle template for that
      ordered fingerprint set and returns locked state on subsequent reads.
- [ ] **Apply to blank future weeks:** After Lock, when later weeks’ matching
      FEED rows exist and are blank for the circle, calendar/sync apply creates
      the same coverage + ride plans (+ home-side overrides when snapshotted)
      so Agenda/Hero do not treat those kids as coverage gaps and Route reflects
      the locked places without Confirm / Assign / Save that week.
- [ ] **One-off edit sticks:** Editing coverage or plan on one applied future
      week does not clear the template; later blank weeks still receive the
      original locked pattern; the edited week is not overwritten on re-apply.
- [ ] **Remove recurring:** Explicit Remove recurring coverage deletes the
      template; stops further apply; does not wipe already-written weeks;
      Lock can be used again only after a week is fully planned and the gate
      still passes.
- [ ] **Schedule-ended auto-clear:** After Lock, when the feed no longer has
      any upcoming match for every template fingerprint (half-season ice-time
      shift), the next sync/enrich deletes the template (same effect as Remove);
      locked chrome is gone; already-applied weeks are untouched; template is
      not left orphaned.
- [ ] **No teammate standing:** Lock never creates or repeats Ask-the-team /
      Accept rides for other circles (household / circle-local plans + coverage
      only).
- [ ] **Fingerprint, not UID:** Two FEED rows with different iCal UIDs but the
      same feed + weekday + time-of-day + location match for gate and apply;
      a row that only shares time but differs in location does not match.
- [ ] **OpenAPI + web clients:** Contract documents Lock / Remove + eligibility
      / locked fields; `web/src/api/` clients updated in the same change.
- [ ] **Tests:** Backend unit + integration cover gate, lock snapshot, apply to
      blank match, skip non-blank (one-off), remove template, and schedule-ended
      auto-clear; web component/unit tests cover Lock visibility and Remove; at
      least one e2e or integration path covers multi-member block lock →
      next-week blank apply.

## Tasks

- [x] Backend: Fingerprint helper + forward “≥3 other upcoming matches” gate
      over synced FEED events
- [ ] Backend: Persist circle standing-block template (member fingerprints +
      per-member coverage / ride-plan / route-origin snapshots); Flyway
- [ ] Backend: Lock / Remove recurring APIs; apply-on-sync and/or calendar
      enrich for blank matching future items (never overwrite non-blank);
      auto-clear template when every fingerprint has zero upcoming matches
- [ ] Backend: Reuse existing coverage + Save ride plan + route-origin write
      paths for apply (no parallel mute semantics)
- [ ] Contract: OpenAPI Lock / Remove + calendar/block eligibility & locked
      state fields
- [ ] Web: API client updates for new contract fields/endpoints
- [ ] Web: Agenda drive-block Lock CTA (gated) + Remove recurring coverage
      when locked; copy for one-off vs remove-pattern
- [ ] Tests: Module unit + controller/integration for gate/lock/apply/remove
      + schedule-ended auto-clear; web tests for CTA gating; multi-member block
      apply path that would fail if overwrite-on-edit or UID-only matching
      were used

## Open questions

- Exact chrome strings (“Lock this plan” vs “Repeat weekly” / “Remove
  recurring coverage”) — tune at implement against Agenda block density;
  behavior above is fixed.
- Schedule-ended dismissible Agenda note — ship if cheap; omit in v1 if it
  fights block density (auto-clear remains mandatory either way).
- Whether apply / auto-clear runs primarily on feed sync, calendar GET, or
  both — implement whichever keeps blank future weeks filled and orphaned
  locks cleared before the adult opens Agenda; must remain idempotent and
  non-overwriting.
- Circle timezone for “local weekday / time-of-day” — use the same zone the
  calendar Agenda already uses for day grouping (do not invent a second zone
  rule).
