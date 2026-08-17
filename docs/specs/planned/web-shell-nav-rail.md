# Spec stub: web-shell-nav-rail

Status: planned  
Parent: [docs/roadmap.md](../../roadmap.md)  
Created: 2026-08-17  
Added: 2026-08-17 · enhancement

Thin stub from `/roadmap`. **Not implementable yet.** Run `/spec web-shell-nav-rail`
to flesh out Approach, Acceptance Criteria, and Tasks before any code.

If fleshing out reveals more than one PR-sized slice, stop and `/roadmap` **split**
(`Added: … · re-rank split`) — do not grow this stub into a mega-spec.

## Problem

The web sidebar already has the right destinations (Calendar / Carpool /
Family, Settings: Places / Garage / Feeds, Account + Sign out) but it is a
theme-following raised card, not the always-dark docked rail in the Claude
Calendar + Feeds mockups. Primary items lack icons; Account is not pinned
to the footer as its own subsection.

## Non-goals (sketch)

- Changing destination set, order, or handlers (Caregiver still omits Feeds)
- iOS / Android bottom tabs (chrome differs; IA already matches)
- Agenda / Feeds page restyles
- Renaming packages (`app-identity-rename`); rail wordmark may say “Fam.”
  as display chrome only

## Notes

- Intake: Calendar light + Feeds dark screenshots (2026-08-17). Prefer the
  Feeds shot’s **ACCOUNT** footer (avatar, email, role) over a floating
  logout-only control.
- Same handlers as [`app-shell-navigation`](../archive/app-shell-navigation.md).
