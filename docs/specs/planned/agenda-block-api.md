# Spec stub: agenda-block-api

Status: planned  
Parent: [docs/roadmap.md](../../roadmap.md)  
Created: 2026-09-16  
Added: 2026-09-16 · enhancement

Thin stub from `/spec day-block-agenda`. **Not implementable yet.** Run
`/spec agenda-block-api` to flesh out Approach, Acceptance Criteria, and Tasks
before any code.

If fleshing out reveals more than one PR-sized slice, stop and `/roadmap`
**split** (`Added: … · re-rank split`) — do not grow this stub into a
mega-spec.

## Problem

[`day-block-agenda`](../active/day-block-agenda.md) ships **web-only** block
chrome over an event-shaped calendar payload (`driveBlockLinks` + client
perspective / “not your job” derivation). A second client (Expo / RN Agenda)
must not re-implement block grouping, ADR-0004 perspective normalization, and
muted “not your job” rows. Those need a **server block-shaped contract**
implemented once.

## Non-goals (sketch)

- Web Agenda/Focus chrome (`day-block-agenda`)
- Block Route multi-stop UI (`day-block-route`)
- Changing RideRequest / coverage primitives beyond what’s needed to expose
  block-shaped reads
- Locking the block contract **before** the merge rule is dogfood-stable
  (see Gate)

## Gate (hard)

Do **not** promote / implement until the driving-block **merge-rule buffer**
has enough real usage data to treat as stable — from:

1. Interim / block-card merge-split **override** frequency vs auto merges
   (`day-block-domain` override table + Agenda override UX), and
2. Live usage of [`day-block-agenda`](../active/day-block-agenda.md) one-card
   grouping.

Locking a block-shaped OpenAPI shape before that validation makes any later
merge-rule retune a **breaking change for two clients** instead of a web-only
redeploy.

## Sequencing

**Hard dependency** of whichever RN / Expo spec first needs Agenda **block**
rendering (not merely “before RN ships”). Scaffold / auth / shell may proceed;
Agenda grouped-card consumption must wait for this slice.

## Notes

- Must list [ADR-0004](../../decisions/ADR-0004-carpool-card-perspective-rules.md)
  in Context at `/spec`.
- Builds on archived [`day-block-domain`](../archive/day-block-domain.md) and
  web lessons from `day-block-agenda`.
