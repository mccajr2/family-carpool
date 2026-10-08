# Spec stub: carpool-ask-accept-email

Status: planned  
Parent: [docs/roadmap.md](../../roadmap.md)  
Created: 2026-10-08  
Added: 2026-10-08 · enhancement

Thin stub from `/roadmap`. **Not implementable yet.** Run
`/spec carpool-ask-accept-email` to flesh out Approach, Acceptance Criteria,
and Tasks before any code.

If fleshing out reveals more than one PR-sized slice, stop and `/roadmap`
**split** (`Added: … · re-rank split`) — do not grow this stub into a
mega-spec.

## Problem

Request and Accept already work when the other adult has Calendar open.
They do not hear about it otherwise. A parent beta cannot depend on someone
already being in the app. Email is enough; push can wait for Expo.

## Non-goals (sketch)

- Mail on Pass, Cancel, Withdraw, or coverage assign
- Digests, per-person preferences, or an inbox
  (`in-app-notifications`, `push-notifications`)
- Emailing adults who are not in the team space
- OTP delivery itself (`auth-email-delivery`)

## Notes

- **Beta gate, rank 6.** Depends on `auth-email-delivery` for a real mail
  port. Dev log delivery is not this slice.
- Ask (one-off or standing): email adults in the other member circles.
- Accept: email adults in the requesting circle.
- A team of two to four households is the beta. `/spec` should say what a
  larger space does (still mail every other circle, or cap) without adding
  preference UI.
- Web product. No Expo token.
