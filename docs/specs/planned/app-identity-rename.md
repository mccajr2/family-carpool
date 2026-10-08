# Spec stub: app-identity-rename

Status: planned  
Parent: [docs/roadmap.md](../../roadmap.md)  
Created: 2026-08-07  
Added: 2026-08-07 · initial

Thin stub from `/roadmap`. **Not implementable yet.** Run `/spec app-identity-rename`
to flesh out Approach, Acceptance Criteria, and Tasks before any code.

If fleshing out reveals more than one PR-sized slice, stop and `/roadmap` **split**
(`Added: … · re-rank split`) — do not grow this stub into a mega-spec.

## Problem

Packages, bundle ids, and client chrome still say **quickapp** / template
identity. That must change before store listings and a public mobile build.
It does not block the web parent beta. OTP From-address copy can move with
`auth-email-delivery` if it is only a string.

## Non-goals (sketch)

- Visual redesign of destinations
- Auth protocol changes
- Inventing a new product name in this stub — lock the name at `/spec`

## Notes

- **After the beta gate** (Upcoming rank 15). Do not block Calendar or the
  web parent beta.
- Touches Gradle ids, iOS bundle id, Android applicationId, web title, and
  user-visible strings. One PR if the rename is mechanical; split if store
  listings / signing require a pause.
