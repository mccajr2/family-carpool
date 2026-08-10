# Spec stub: cross-platform-ui-system

Status: planned  
Parent: [docs/roadmap.md](../../roadmap.md)  
Created: 2026-08-10  
Added: 2026-08-10 · enhancement

Thin stub from `/roadmap`. **Not implementable yet.** Run `/spec cross-platform-ui-system`
to flesh out Approach, Acceptance Criteria, and Tasks before any code.

If fleshing out reveals more than one PR-sized slice, stop and `/roadmap` **split**
(`Added: … · re-rank split`) — do not grow this stub into a mega-spec.

## Problem

Web, Android, and iOS each use stock/default toolkit styling (and slightly
different patterns), so the product feels generic and inconsistent across
clients. Adults should recognize one family-carpool look and shared interaction
vocabulary on every platform.

## Non-goals (sketch)

- Rewriting product flows or OpenAPI (`app-shell-navigation` owns screen split)
- Forcing a single shared Compose Multiplatform UI on iOS (native SwiftUI stays
  allowed) — align **tokens + patterns**, not necessarily one UI codebase
- Full brand rename / package identity (`app-identity-rename` stays separate)
- Illustration / marketing site redesign

## Notes

- Likely: color/typography/spacing tokens, button/field/list row patterns, and a
  short “use this” guide applied to shell screens on web + Android + iOS.
- Best after `app-shell-navigation` so restyle lands on focused screens, not the
  mega-scroll.
- May split at `/spec` into tokens-first vs component-pass if AC grows.
