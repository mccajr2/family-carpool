# Spec stub: calendar-conditional-get

Status: planned  
Parent: [docs/roadmap.md](../../roadmap.md)  
Created: 2026-08-12  
Added: 2026-08-12 · re-rank split

Thin stub from `/roadmap` split of `calendar-client-cache`. **Not implementable
yet.** Run `/spec calendar-conditional-get` after the client cache PR ships.

If fleshing out reveals more than one PR-sized slice, stop and `/roadmap`
**split** (`Added: … · re-rank split`) — do not grow this stub into a mega-spec.

## Problem

Client cache (`calendar-client-cache`) still **full-GETs** on every background
revalidate. When the circle schedule is unchanged, that wastes bandwidth and
can churn UI/state for no reason. Correct HTTP caching for this resource is
conditional GET: server `ETag`, client `If-None-Match`, **`304` keeps the
local snapshot**.

## Non-goals (sketch)

- Replacing local persist / SWR paint-first UX (owned by
  [`calendar-client-cache`](../active/calendar-client-cache.md))
- Offline write queue
- CDN / shared HTTP cache across users (calendar is Bearer-authenticated and
  adult-enriched)
- Changing conflict / coverage / leave-by semantics

## Notes

- **Depends on** shipped client cache so `ETag` is stored beside the snapshot
  and `304` is meaningful for “keep showing cache.”
- `/spec` should lock: how `ETag` is computed (payload hash vs circle revision),
  whether adult-specific enrichment forces per-adult ETags, OpenAPI
  `ETag` / `If-None-Match` / `304` documentation, and client wiring on web +
  Android + iOS.
- Prefer one vertical PR: backend + contract + all three clients.
