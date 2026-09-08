# Spec stub: push-notifications

Status: parking  
Parent: [docs/roadmap.md](../../roadmap.md)  
Created: 2026-08-07  
Added: 2026-08-07 · initial  
Promoted: 2026-08-25 · pre-beta (carpool)  
Parked: 2026-09-08 · carpool Beta (web first; revive with Expo)

Thin stub from `/roadmap`. **Not implementable yet.** Run `/spec push-notifications`
to flesh out Approach, Acceptance Criteria, and Tasks before any code.

If fleshing out reveals more than one PR-sized slice, stop and `/roadmap` **split**
(`Added: … · re-rank split`) — do not grow this stub into a mega-spec.

## Problem

Carpool is the differentiator vs sports management apps, but ride **requests**,
**accepts**, and **denials/passes** are easy to miss without a push. Beta needs
timely device alerts so teammates can respond without living in the web tab.

## Non-goals (sketch)

- Full in-app notification inbox (`in-app-notifications` — can follow)
- Coverage / rotation / other event types in v1 of this slice (carpool ride
  lifecycle only unless `/spec` explicitly widens)
- KMP APNs/FCM path (abandoned; Expo only)
- Full Expo Agenda/Carpool parity (tap may deep-link to a thin surface or web)

## Notes

- Depends on [`rn-expo-scaffold`](rn-expo-scaffold.md) (device + push token
  registration).
- Pre-beta gate alongside real OTP mail (`auth-email-delivery`).
- Does **not** require `in-app-notifications` first for carpool beta.
- Route-tab ready-by UI already calls
  [`web/src/components/rideNotify.ts`](../../../web/src/components/rideNotify.ts)
  (`deliverRideReadyByNotify`) — channel-agnostic, currently no-op / soft-success
  with no network. Wire real FCM/APNs (and optional SMS) there; keep the request
  shape (`channel`, `to`, `stopName`, `readyByLabel`).
