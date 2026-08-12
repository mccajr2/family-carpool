# Spec: calendar-ux-flow

Status: done  
Created: 2026-08-12  
Updated: 2026-08-12  
Parent: [docs/roadmap.md](../../roadmap.md)  
Branch: `calendar-ux-flow`  
Added: 2026-08-12 · enhancement

## Problem

Calendar/Agenda and the shell work, but the look-and-feel still feels provisional.
As coverage, leave-by, and more features land, it is hard to imagine how flows
should feel together. Adults need a **simple, intuitive** primary surface —
distinct and custom, not an Uber clone — guided by UX-law tenets that make task
apps feel effortless (few choices, clear primary action, fast feedback,
reachable targets, grouped related controls, familiar patterns).

Without locking those tenets and applying them to Agenda now, later slices
(conflicts, carpool, grid) will stack more chrome onto a surface that already
reads as a flat control dump.

## Non-goals

- Cloning Uber’s visual brand, map-first home, or ride-booking IA
- Full brand palette hex swap (`ui-palette-refresh`)
- Token adoption on every destination (`ui-system-destination-adoption`) —
  Calendar may consume existing tokens more consistently, but this is not a
  full destination-adoption + screenshot/AA campaign for every shell tab
- Month/week grid (`family-calendar-grid`)
- Progressive disclosure / collapsing panels that **hide** leave-from,
  leave-by, or coverage behind accordions (deferred if still needed)
- New card / muted band / bordered subsection chrome inside Agenda items
  (selection **A** = spacing and proximity only)
- Changing coverage / leave-from / compose **behavior or copy** from
  [`agenda-coverage-web-contract.md`](../../agenda-coverage-web-contract.md)
  (decisions and strings stay; presentation hierarchy and attribute **order /
  proximity** may change after critical regroup)
- Conflict amber UI, carpool product, OpenAPI, or backend changes
- Auth, Family, More/Places restyles beyond what Calendar compose already owns
- New illustration, logo, or marketing system

## Approach

**Locked presentation choice — A (spacing / proximity only).** No new card,
muted band, or bordered “coverage section” chrome inside Agenda items. Grouping
is done with hierarchy, type weight, and spacing. (Selection A locked
2026-08-12.)

**A does not freeze today’s attribute clusters.** Critically review current
groupings against intuition and roadmap seams; regroup attributes within the
item when today’s layout misleads (e.g. travel mixed into title, coverage mixed
with leave-by, Edit/Remove competing with Confirm). Same features and contract
**strings/behavior**; presentation order and proximity may change.

**Forward-looking (structure only — do not ship unbuilt UI):**
- Agenda remains home for schedule + coverage responsibility + leave-by.
- Leave a clear seam for later conflict chrome on the **item** (not a new dump
  of controls).
- Per-coverage leave-from stays a later product slice; don’t invent its chrome
  here, but don’t bury leave-from in a place that can’t grow.
- Carpool stays the **Carpool** destination (request/accept); do not absorb
  ride-share actions into every Agenda row.

**Busy ladder (this product):**
1. Regroup + hierarchy (proximity, type weight, one primary CTA) — **this PR**
2. Slight type/spacing tuning within existing tokens — **this PR** if needed
3. Expand/collapse dense blocks — **not this PR** (dogfood → possible
   `calendar-ux-disclosure`)
4. Navigate away — only for real destination jobs already established (event
   compose; Open Places for `NO_ORIGIN`; carpool tab later) — no new nested
   Agenda attribute screens in this slice

**Scope shape:** visual + action hierarchy on Agenda IA — not progressive
disclosure. Hick/Fitts: when Confirm coverage or Assign coverage is the
situational job, it is the **emphasized** control; secondary actions stay
quieter (outline / lower emphasis).

**1. Lock Interaction UX tenets (docs).** Expand the roadmap locked row into
`docs/architecture.md` (short durable section) with our wording for:

| Tenet | Meaning for this product |
|--------|---------------------------|
| Aesthetic-Usability | Clear hierarchy and spacing make Agenda feel usable, not sparse chrome |
| Doherty | Focused busy feedback (Save → Saving…, Load more → Loading…) feels instant; no Sign out hijack |
| Fitts | Primary actions are large enough and easy to hit (especially mobile) |
| Hick | Few choices per step; keep sole-option defaults / field rows; one emphasized CTA when present |
| Proximity / Similarity | Critically grouped bands (see below); consistent control patterns |

Inspired by [Laws of UX that Uber follows](https://medium.com/design-bootcamp/laws-of-ux-that-uber-follows-fa7c6619748b) — tenets only, not a clone.

**2. Apply on Calendar / Agenda (+ event compose chrome) on web, Android, iOS.**

During implement: audit web Agenda (reference client) and document the chosen
bands in the coverage contract. Starting target (adjust if review finds better
proximity — still selection A):

1. **Primary** — title + when (location with event identity if present)
2. **Travel / origin** — leave-by + Leave from (+ Open Places when `NO_ORIGIN`)
3. **People / source** — source label, kids on the event
4. **Coverage / actions** — coverage lines, needs-coverage, Confirm/Decline,
   Assign, Edit/Remove — spacing-grouped, **no** inner card/band; **one filled
   primary** when Confirm or Assign is the situational job

Calendar chrome: Agenda heading / kid filters / list / Load more keep contract
spacing; Add / compose Save remain the clear primary for create/edit.

**3. Contract note.** Add a short **Presentation hierarchy** subsection to
`docs/agenda-coverage-web-contract.md` (selection A + bands + CTA emphasis +
busy ladder pointer) without changing behavior strings.

**No OpenAPI / backend.** Client + docs only.

## Acceptance criteria

- [x] `docs/architecture.md` documents Interaction UX tenets (table above),
      selection A, the busy ladder, and Agenda as the living reference surface.
- [x] `docs/agenda-coverage-web-contract.md` includes **Presentation hierarchy**
      (selection A: spacing/proximity only; critical regroup allowed; bands +
      one emphasized situational CTA; no accordion in this slice) without
      changing behavior/copy rules.
- [x] Implement includes a short written regroup outcome (in contract or PR):
      what moved vs today’s flat stack and why (forward-looking seams noted).
- [x] On **web, Android, and iOS** Agenda items:
  - Title + when read as the primary band (stronger type / weight than meta).
  - Leave-by and Leave from sit in a travel/origin proximity group (not in the
    title band); Open Places stays with that recovery path.
  - Coverage + situational actions read as one spacing-grouped region (**no**
    new card/muted band/bordered subsection chrome).
  - When **Confirm coverage** is shown for the signed-in adult, it is the
    filled/emphasized primary among that item’s action buttons; Decline stays
    secondary.
  - When **Assign coverage** is shown (and Confirm is not), Assign is the
    filled/emphasized primary among that item’s action buttons; Edit / Remove /
    Open Places stay secondary.
  - When neither Confirm nor Assign is shown, no fake primary — Edit/Remove
    remain secondary peers.
- [x] Event compose Save remains the primary action in the compose surface
      (Saving… busy rule unchanged).
- [x] Sign out never becomes Working…; Load more / Save busy labels unchanged
      per coverage contract.
- [x] Behavior and strings from the coverage contract still hold (sole options,
      field rows, empty-while-busy, Edit+Remove only, Open Places for
      `NO_ORIGIN`, etc.).
- [x] No new navigable Agenda subsections or expand/collapse for attributes in
      this PR.
- [x] Light + dark (or equivalent) smoke: Calendar Agenda still readable on
      web + both mobile clients (screenshot or manual check noted in PR) —
      full WCAG destination-adoption campaign is **not** required here.
      Checklist: see **Visual smoke (PR)** below.

## Tasks

- [x] Docs: Interaction UX section in `docs/architecture.md` (tenets, A, ladder)
- [x] Docs: Presentation hierarchy in `docs/agenda-coverage-web-contract.md`
- [x] Docs/PR: regroup outcome vs today’s flat Agenda stack
- [x] Web: Agenda item hierarchy + regroup + primary CTA emphasis
      (`FamilyScreen.tsx`)
- [x] Android: same in sharedUI `FamilyScreen.kt` / related
- [x] iOS: same in `ContentView.swift` / related
- [x] Web: tests for primary CTA emphasis / hierarchy hooks (or contract-style
      asserts that fail if emphasis regresses)
- [x] iOS: script assert(s) for hierarchy / primary CTA markers
- [x] Android: host test assert(s) for hierarchy / primary CTA markers
- [x] PR note: brief visual smoke (Agenda with pending confirm + assign cases)

## Visual smoke (PR)

Manual check before merge (`/pr`). No screenshots required in-repo; note results
in the PR body.

On **web, Android, and iOS** Calendar Agenda (light; dark if the client theme
supports it):

1. **Pending for me** — Confirm is the filled primary; Decline secondary; Edit /
   Remove (manual) secondary; bands read Primary → Travel → People → Coverage.
2. **Needs assign (no pending Confirm)** — Assign is the filled primary; Edit /
   Remove secondary.
3. **Covered / no assign** — no fake primary; Edit/Remove stay quiet peers.
4. Compose **Save** still primary; Sign out still “Sign out”; Load more busy
   label unchanged.
5. Spot-check: leave-by sits with Leave from (not under the title); no new
   card/band chrome inside the item.

## Open questions

- None blocking. Selection **A** locked; progressive disclosure deferred to
  dogfood → possible follow-up id.
- Palette hex remaining provisional until `ui-palette-refresh`.

## Possible follow-up

After dogfood on this slice: if Agenda still feels like a control dump, `/roadmap`
add a thin planned id (e.g. `calendar-ux-disclosure`) for progressive disclosure —
do not invent that stub until hierarchy + regroup (A) have been tried. A light
visual band (former option B) is also a dogfood upgrade, not in this PR.
