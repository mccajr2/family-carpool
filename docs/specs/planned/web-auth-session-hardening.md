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

v1 uses Bearer tokens on web for parity with Android/iOS. A JS-readable token is
an XSS risk that should not ship as the long-term web default for beta.

## Non-goals (sketch)

- Replacing Bearer on Android/iOS
- Full XSS program / CSP overhaul beyond what session hardening needs
- Refresh-token / device-management redesign (unless required by the cookie model)

## Notes

- Depends on `adult-auth-magic-link`.
- **Pre-beta gate** for web with real users — not a blocker for local/dev smoke
  (Bearer is fine until then); mobile stays Bearer.
- Likely HTTP-only cookie (or equivalent) + CSRF/`SameSite`.
