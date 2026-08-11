# Spec: agenda-event-compose

Status: done  
Created: 2026-08-10  
Updated: 2026-08-10  
Approved: 2026-08-10  
Parent: [docs/roadmap.md](../../roadmap.md)  
Branch: `agenda-event-compose`  
Added: 2026-08-10 · enhancement

## Problem

On Calendar, **Add event** is an inline form at the bottom of the Agenda list
(after events and Load more). Once the agenda has content, create is easy to
miss and competes with the list for scroll space. Manual event create/edit needs
a clear entry point and a dedicated compose surface so Agenda stays agenda-first.

## Non-goals

- Changing manual-event API fields, validation rules, or OpenAPI
- Redesigning Agenda list/filter/Load more beyond removing the inline create form
- Month/week grid (`family-calendar-grid`)
- Carpool flows or shell IA changes (`app-shell-navigation`)
- Visual design-system overhaul (`cross-platform-ui-system`)
- Creating events without kids already on the circle (same rule as today: need
  1+ kids assigned)

## Approach

**Client UX only** (web + Android/sharedUI + iOS). Reuse existing manual event
create/update/delete clients.

**Calendar chrome:** Prominent **Add** control on the Calendar destination
(toolbar `+` / labeled Add — same affordance on web, Android, and iOS). Not
buried under the list.

**Compose surface:** Tapping Add opens a dedicated create flow (mobile:
push/sheet; web: modal or full compose panel) with the same fields as today’s
inline form: title, start, optional end, optional location, 1+ kids, save/cancel.
On success, dismiss compose and refresh/keep Agenda in sync (same reload
behavior as today).

**Edit:** Manual events open the **same** compose surface prefilled (tap Edit
on a manual row). Feed rows stay read-only. Delete remains available from the
manual row or compose (keep current destructive affordance; do not invent a
new confirm pattern unless one already exists).

**Remove** the inline create form (and inline edit form if present) from the
Agenda scroll so the list is the primary content.

## Acceptance criteria

- [x] Calendar shows a persistent, visible **Add** control in destination chrome
  (not below the agenda list) on web, Android, and iOS.
- [x] Add opens a dedicated compose surface (not an inline form under the list)
  with title, start, optional end/location, kid multi-select (1+ required),
  save/cancel — same validation as current manual create.
- [x] Successful create dismisses compose and shows the new event on Agenda
  (within the loaded window rules already shipped).
- [x] Editing a **manual** event opens the same compose surface prefilled;
  save updates; cancel discards; feed rows remain non-editable.
- [x] Agenda no longer hosts the long inline create (or inline edit) form under
  the list; Load more / kid filter / list behavior unchanged.
- [x] No OpenAPI or backend changes; client tests cover Add entry → compose →
  create, and edit via compose (plus Caregiver can still create).

## Tasks

- [x] **Web:** Calendar Add control; modal/panel compose for create + edit;
  remove inline forms from Agenda; update tests.
- [x] **Android (sharedUI):** Calendar Add control; sheet/push compose for
  create + edit; remove inline forms; update `FamilyUiModel` / UI tests.
- [x] **iOS:** Calendar Add control; sheet/push compose for create + edit;
  remove inline forms; keep AuthViewModel write paths.
- [x] **Tests:** Client coverage for Add → create and Edit → update via compose;
  assert inline create form is gone from Agenda.

## Open questions

*None blocking — locked from prior UX discussion:*

| Topic | Decision |
|-------|----------|
| Entry point | Prominent Add in Calendar chrome |
| Create UX | Dedicated compose (sheet/page/modal), not inline under list |
| Edit UX | Same compose surface for manual events |
| API | No contract/backend changes |
| Branch base | Off `app-shell-navigation` until that PR merges to `main` |

## Approval

Approved 2026-08-10. Shipped via `/pr`.
