# Spec stub: web-auth-session-hardening

Status: planned  
Parent: [docs/roadmap.md](../../roadmap.md)  
Created: 2026-08-07  
Added: 2026-08-07 · enhancement

Thin stub from `/roadmap`. **Not implementable yet.** Run
`/spec web-auth-session-hardening` to flesh out Approach, Acceptance Criteria,
and Tasks before any code.

If fleshing out reveals more than one PR-sized slice, stop and `/roadmap` **split**
(`Added: … · re-rank split`) — do not grow this stub into a mega-spec.

## Problem

The web session is an in-memory Bearer token. A reload signs the adult out,
and the next sign-in needs a new OTP. That cannot ship to parents. A
JS-readable token is also the wrong long-term web default.

## Non-goals (sketch)

- Replacing Bearer on Android/iOS
- Full XSS program / CSP overhaul beyond what session hardening needs
- Refresh-token / device-management redesign (unless required by the cookie model)

## Notes

- Depends on `adult-auth-magic-link`.
- **Beta gate, rank 4.** Parent-facing result: reload keeps the session.
  Likely HTTP-only cookie (or equivalent) + CSRF/`SameSite`. Not a blocker
  for local/dev smoke. Expo stays Bearer when revived.
