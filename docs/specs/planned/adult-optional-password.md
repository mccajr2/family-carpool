# Spec stub: adult-optional-password

Status: planned  
Parent: [docs/roadmap.md](../../roadmap.md)  
Created: 2026-08-07  
Added: 2026-08-07 · re-rank split

Thin stub from `/roadmap`. **Not implementable yet.** Run `/spec adult-optional-password`
to flesh out Approach, Acceptance Criteria, and Tasks before any code.

If fleshing out reveals more than one PR-sized slice, stop and `/roadmap` **split**
(`Added: … · re-rank split`) — do not grow this stub into a mega-spec.

## Problem

Frequent users want an optional password on top of email-OTP accounts so they
are not email-bound every session.

## Non-goals (sketch)

- Replacing email OTP as primary onboarding / recovery
- Apple / Google sign-in
- Password-only account creation

## Notes

- Depends on `adult-auth-magic-link` (done).
- Pre-beta convenience — do not block family/calendar/carpool slices.
- Ranked with `auth-email-delivery` and `web-auth-session-hardening` near beta.
