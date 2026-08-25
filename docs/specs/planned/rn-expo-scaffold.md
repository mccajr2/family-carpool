# Spec stub: rn-expo-scaffold

Status: planned  
Parent: [docs/roadmap.md](../../roadmap.md)  
Created: 2026-08-25  
Added: 2026-08-25 · enhancement

Thin stub from `/roadmap`. **Not implementable yet.** Run `/spec rn-expo-scaffold`
to flesh out Approach, Acceptance Criteria, and Tasks before any code.

If fleshing out reveals more than one PR-sized slice, stop and `/roadmap` **split**
(`Added: … · re-rank split`) — do not grow this stub into a mega-spec.

## Problem

Supporting KMP + Compose + SwiftUI alongside web is unsustainable. The mobile
target is Expo (React Native). Carpool **push** for beta needs a real device
client that can authenticate and register a push token — that app does not
exist yet.

## Non-goals (sketch)

- Feature parity with web Agenda/Carpool/Family (later dogfood-port slices)
- Deleting the KMP tree (see `kmp-mobile-retire`)
- Sharing Vite React UI components 1:1 with native (shared packages only where cheap)
- Emitting push payloads (see `push-notifications`)

## Notes

- Promoted for **carpool push pre-beta** (after `auth-email-delivery`, before
  `push-notifications`) — infra (auth + shell + token registration hook), not
  lockstep product delivery with web.
- OpenAPI remains the contract; Expo clients align with `contracts/openapi.yaml`
  like web. Frozen KMP is not updated on contract changes.
- Depends on locked Client ship order (web reference + Expo for push gate).
