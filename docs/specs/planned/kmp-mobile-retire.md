# Spec stub: kmp-mobile-retire

Status: planned  
Parent: [docs/roadmap.md](../../roadmap.md)  
Created: 2026-08-25  
Added: 2026-08-25 · enhancement

Thin stub from `/roadmap`. **Not implementable yet.** Run `/spec kmp-mobile-retire`
to flesh out Approach, Acceptance Criteria, and Tasks before any code.

If fleshing out reveals more than one PR-sized slice, stop and `/roadmap` **split**
(`Added: … · re-rank split`) — do not grow this stub into a mega-spec.

## Problem

The `mobile/` KMP + Android Compose + iOS SwiftUI clients are frozen and will not
receive new product work, but they still imply a second stack (CI, docs, AGENTS
conventions). Retiring them cuts maintenance once Expo is the mobile path.

## Non-goals (sketch)

- Building Expo feature screens (see `rn-expo-scaffold` and later port slices)
- Rewriting OpenAPI or backend for a single client

## Notes

- Policy freeze is already a locked roadmap decision; this id is the **code/docs/CI
  removal** PR.
- Prefer after `rn-expo-scaffold` can sign in (so there is a replacement path), or
  promote earlier if CI cost outweighs keeping a read-only archive.
- Cancels KMP-specific parked ports (see Cancelled on the roadmap).
