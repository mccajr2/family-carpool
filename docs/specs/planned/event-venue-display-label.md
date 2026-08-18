# Spec stub: event-venue-display-label

Status: planned  
Parent: [docs/roadmap.md](../../roadmap.md)  
Created: 2026-08-17  
Added: 2026-08-17 · enhancement

Thin stub from `/roadmap`. **Not implementable yet.** Run `/spec event-venue-display-label`
to flesh out Approach, Acceptance Criteria, and Tasks before any code.

## Problem

Agenda and Focus show event `location` verbatim. Street addresses are long and
ambiguous on the hero meta line (`Sam · 450 Huron Ave, Cambridge, MA · Leaving
from Mom's house`). Geocoding already runs for leave-by; we lack a **short
display label** (rink, park, field) when the coords resolve to a named POI.

## Non-goals (sketch)

- Live turn-by-turn navigation or in-app maps
- Replacing free-text `location` on manual events (still the source of truth)
- Feed-specific venue override UI (beyond what geocode/lookup returns)
- Paid POI providers in v1 — prefer Nominatim / OSM reuse with cache

## Notes

- Reuse `geocode_cache` and existing Nominatim integration where possible;
  add reverse-geocode or POI lookup only if forward geocode is insufficient.
- Clients: Focus meta line and collapsed `AgendaRow` when (same label field).
- Fallback: full trimmed `location` text (current behavior).
- Depends on leave-by geocode path ([`event-leave-by-estimate`](../archive/event-leave-by-estimate.md));
  can ship after [`agenda-focus-card-polish`](../archive/agenda-focus-card-polish.md).
