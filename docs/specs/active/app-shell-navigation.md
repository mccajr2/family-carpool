# Spec: app-shell-navigation

Status: approved  
Created: 2026-08-10  
Updated: 2026-08-10  
Parent: [docs/roadmap.md](../../roadmap.md)  
Branch: `app-shell-navigation`  
Added: 2026-08-10 · enhancement

## Problem

Signed-in adults land on one long scrolling **family surface** (members, kids,
places, agenda, feeds, leave/sign-out). Finding a use case means scrolling and
hunting. As calendar and carpool grow, that single screen will not scale — and
carpool (core to the product) has no visible home in the nav until a shell
reserves it.

## Non-goals

- Redesigning calendar agenda/grid data models or Agenda UX
  (`family-calendar-surface` / `family-calendar-grid`) beyond moving existing UI
  into the Calendar destination
- Implementing carpool product flows — Carpool tab is a **reserved placeholder**
  only; real flows stay in their own future specs
- Visual redesign / design-system overhaul (`cross-platform-ui-system`)
- Deep linking / universal links / URL-route restore beyond what each client
  already needs for in-app tab selection
- Backend / OpenAPI changes (client IA only)
- Changing auth OTP flows; signed-out and create/join-circle empty states stay
  outside the signed-in shell
- Infinite nesting under More beyond one push (Places / Feeds / Account detail
  screens are leaves)

## Approach

**Shared information architecture (identical labels, order, and grouping on
web + Android + iOS):**

| Order | Destination | Contents |
|-------|-------------|----------|
| 1 | **Calendar** | Existing Agenda (+ add/edit/delete manual events, kid filter, Load more) |
| 2 | **Carpool** | Reserved slot only — empty / “Coming soon” state; no flows |
| 3 | **Family** | Circle name, invite (Organizer), members/roles, kids, leave |
| 4 | **More** (mobile) / **Settings** section (web) | Grouped list — see below |

**More / Settings groups (same structure everywhere):**

1. **General**
   - **Places** — named places CRUD (navigable row)
   - **Feeds** — Organizer feed manage only; **row fully omitted for Caregivers**
     (not shown disabled)
2. **Account**
   - Email + role (non-navigable summary or detail as fits; not a dead chevron)
   - **Sign out** — action row: **no trailing chevron**; danger-role text/icon
     color only (not a full red row background)

Navigable rows: leading icon in a tinted rounded-square chip + trailing chevron.
Sign-out: leading danger-styled icon + danger text; no chevron.

**Platform chrome (adapts; IA does not):**

- **iOS / Android:** bottom tab bar with four tabs in order Calendar → Carpool →
  Family → More. Selecting More shows the grouped list as its own screen; Places
  and Feeds push secondary screens. Caregivers never see a Feeds row.
- **Web:** no bottom tab bar. Persistent sidebar: top-level links for Calendar,
  Carpool, Family; Places / Feeds / Account live under a **Settings** sidebar
  section (or account menu) using the **same two groups and row content** as
  mobile More. Feeds omitted for Caregivers.

**Signed-in shell vs empty states:** Tab/sidebar shell appears only when the
adult has a circle membership (`Ready`). Create/join-circle and signed-out auth
remain full-screen flows without the four destinations. After join/create,
default landing destination is **Calendar**.

**Layers:** web (`FamilyScreen` / app shell split), Android (`sharedUI`), iOS
(SwiftUI). No backend or contract work. Prefer extracting existing section UI
into destination screens rather than rewriting behavior.

## Acceptance criteria

- [ ] Web, Android, and iOS signed-in members see the same four destinations in
  the same order and grouping — **Calendar**, **Carpool**, **Family**, then
  **More** (mobile) / **Settings** (web) — using platform-conventional naming
  for the fourth destination, not identical labels.
- [ ] **Calendar** hosts the existing Agenda surface (list, kid filter, Load more,
  manual add/edit/delete; feed rows read-only) — no dedicated manage-events list
  reintroduced.
- [ ] **Carpool** is always visible for members and shows only an empty /
  “Coming soon” placeholder (no carpool APIs or flows).
- [ ] **Family** hosts circle name, invite (Organizer-only controls as today),
  members/roles, kids CRUD (Organizer rules unchanged), and leave.
- [ ] **More / Settings — General:** Places navigates to named-places CRUD;
  Feeds navigates to Organizer feed manage; **Caregivers do not see a Feeds row**.
- [ ] **More / Settings — Account:** shows email + role; **Sign out** has no
  chevron and uses danger text/icon styling only (not a solid red row).
- [ ] Mobile uses a **bottom tab bar** (4 tabs); More opens the grouped list;
  Places/Feeds are push destinations from More.
- [ ] Web uses a **persistent sidebar** (Calendar / Carpool / Family + Settings
  section or account menu) — not a cloned bottom tab bar — with the same groups
  and row content as mobile More.
- [ ] Shell appears only in the signed-in **Ready** (has circle) state; auth and
  create/join empty states remain outside it; first landing after ready is
  **Calendar**.
- [ ] No OpenAPI / backend changes; existing client tests updated or added for
  destination presence, Caregiver Feeds omission, and Carpool placeholder.

## Tasks

- [ ] **Web:** Split long `FamilyScreen` into shell + destination views; sidebar
  nav; Settings/More grouping; Carpool placeholder; preserve existing behaviors
  and tests.
- [ ] **Android (sharedUI):** Bottom tab shell; move sections into Calendar /
  Family / More→Places|Feeds|Account; Caregiver Feeds omission; Carpool
  placeholder; tests on navigation/visibility where practical.
- [ ] **iOS:** Same IA via SwiftUI `TabView` (or equivalent); More grouped list;
  push Places/Feeds; Caregiver Feeds omission; Carpool placeholder.
- [ ] **Docs:** Note signed-in shell IA in `docs/architecture.md` (brief);
  roadmap Active row.
- [ ] **Tests:** Client tests for tab/destination presence, Caregiver Feeds row
  omitted, Carpool placeholder visible; no contract/backend suite required.

## Open questions

*None blocking — defaults locked from `/spec` clarification:*

| Topic | Decision |
|-------|----------|
| Tab count / order | Calendar → Carpool → Family → More (4) |
| Carpool v1 | Reserved visible placeholder only |
| Places / Feeds / Account | Under More (mobile) / Settings (web), same groups |
| Feeds visibility | Organizer only; Caregiver row omitted |
| Web chrome | Sidebar, not bottom tabs |
| Default landing | Calendar after Ready |
| OpenAPI | No changes |

## Approval

Approved 2026-08-10 (AC #1 wording: More vs Settings allowed). Ready for `/implement`.
