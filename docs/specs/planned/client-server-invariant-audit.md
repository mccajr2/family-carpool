# Spec stub: client-server-invariant-audit

Status: planned  
Parent: [docs/roadmap.md](../../roadmap.md)  
Created: 2026-08-31  
Added: 2026-08-31 · enhancement

Thin stub from `/roadmap`. **Not implementable yet.** Run
`/spec client-server-invariant-audit` to flesh out Approach, Acceptance
Criteria, and Tasks before any code.

If fleshing out reveals more than one PR-sized slice, stop and `/roadmap`
**split** (`Added: … · re-rank split`) — do not grow this stub into a
mega-spec. Expected split shape: audit doc/punch-list PR, then one PR per
server fence cluster.

## Problem

Hero & coverage work has shipped several “must not happen” product rules as
**web UI / session state only** (e.g. `autoDeclined`, sticky withdraw Undo).
Hiding a button does not stop another tab, reload edge, or a future Expo
client from calling the same OpenAPI successfully. Pre-beta needs a deliberate
pass that separates presentation from enforceable invariants.

## Non-goals (sketch)

- Rewriting Agenda UX or re-litigating ADR product decisions in the audit PR
- Implementing every fence in one mega-PR (audit produces a ranked punch-list;
  fences ship as follow-up ids or the same id split)
- Blocking dogfood of client-shaped slices already in flight

## Notes

- **Pre-beta gate** — run after hero/coverage client slices settle; **before**
  Expo push beta relies on a second client (`rn-expo-scaffold` /
  `push-notifications`).
- Inventory starting points: `autoDeclined` /
  [`auto-decline-unofferable`](../archive/auto-decline-unofferable.md);
  `recentlyWithdrawnRideIds` / [`ride-revert-undo`](../archive/ride-revert-undo.md);
  Pass soft-decline (`passedByMe` — already server-backed); ADR-0002
  remove-coverage auto-withdraw (already server); Assign→cancel open ask
  (client orchestration of existing `cancelRide`).
- Done looks like: a short punch-list of rules that need API 409 / transactional
  side effects / persisted flags, ranked for beta — not a vague “tech debt”
  cleanup.
