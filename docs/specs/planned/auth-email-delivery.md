# Spec stub: auth-email-delivery

Status: planned  
Parent: [docs/roadmap.md](../../roadmap.md)  
Created: 2026-08-07  
Added: 2026-08-07 · enhancement

Thin stub from `/roadmap`. **Not implementable yet.** Run `/spec auth-email-delivery`
to flesh out Approach, Acceptance Criteria, and Tasks before any code.

If fleshing out reveals more than one PR-sized slice, stop and `/roadmap` **split**
(`Added: … · re-rank split`) — do not grow this stub into a mega-spec.

## Problem

Dev-only OTP delivery is enough for local three-client work, but shared staging
and production need real email so adults can sign in without reading server logs.

## Non-goals (sketch)

- Changing the email-code or Bearer auth UX from `adult-auth-magic-link`
- Optional password, OAuth providers
- Marketing / transactional email beyond the sign-in code

## Notes

- Depends on `adult-auth-magic-link` (mail port + OTP flow).
- **Beta gate, rank 5.** Real users cannot read the server log. Not a blocker
  for local smoke; keep dev log delivery until this ships.
- Ride Ask/Accept mail is the next id (`carpool-ask-accept-email`), not this
  slice. Package/bundle rename stays `app-identity-rename` (after beta). A
  From-address display name may land here if it is only a string.
- Wire provider (Resend/Postmark/SES/etc.), secrets, From-address, template;
  disable code-echo outside dev.
- Same pass: set production `GEOCODE_USER_AGENT` (real email or app URL) so
  Nominatim does not 403 — see Geocoding in `docs/architecture.md`.
