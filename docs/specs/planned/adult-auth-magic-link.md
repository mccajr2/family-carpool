# Spec stub: adult-auth-magic-link

Status: planned  
Parent: [docs/roadmap.md](../../roadmap.md)  
Created: 2026-08-07  
Added: 2026-08-07 · initial

Thin stub from `/roadmap`. **Not implementable yet.** Run `/spec adult-auth-magic-link`
to flesh out Approach, Acceptance Criteria, and Tasks before any code.

If fleshing out reveals more than one PR-sized slice, stop and `/roadmap` **split**
(`Added: … · re-rank split`) — do not grow this stub into a mega-spec.

## Problem

Caregivers need per-adult accounts with low-friction sign-in so later circle and
calendar features can be shared securely. Magic link / email code is the v1 path.

## Non-goals (sketch)

- Optional password (next: `adult-optional-password`)
- Sign in with Apple / Google (parking)
- Family circle, kids, or invites

## Notes

- Next up — unblocks all other product slices.
- Ship web + Android + iOS auth surfaces together when this lands.
- Keep greeting harness until a later real feature replaces the smoke demo.
