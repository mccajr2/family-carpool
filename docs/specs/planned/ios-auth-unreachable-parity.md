# Spec stub: ios-auth-unreachable-parity

Status: cancelled — superseded by Expo (2026-08-25); do not /spec
Parent: [docs/roadmap.md](../../roadmap.md)  
Created: 2026-08-16  
Added: 2026-08-16 · enhancement

Thin stub from `/roadmap`. **Not implementable yet.** Run `/spec ios-auth-unreachable-parity`
to flesh out Approach, Acceptance Criteria, and Tasks before any code.

## Problem

Web and Android treat “backend not reachable” as distinct from “session
rejected”: they keep the stored token and show Retry. iOS still bounces to
sign-in on an unreachable `/api/auth/me` (token kept, no crash). That is a
parity hole called out in `docs/architecture.md`.

## Non-goals (sketch)

- Changing Bearer vs cookie session model (`web-auth-session-hardening`)
- Production mail (`auth-email-delivery`)
- Optional password

## Notes

- Carry-forward from `adult-auth-magic-link` follow-up, not a new product idea.
- Promote when iOS dogfood hits flaky networks; small enough to attach to
  another iOS PR if cheaper than its own slice.
