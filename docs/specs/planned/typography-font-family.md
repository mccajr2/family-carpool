# Spec stub: typography-font-family

Status: cancelled — superseded by Expo (2026-08-25); do not /spec
Parent: [docs/roadmap.md](../../roadmap.md)  
Created: 2026-08-14  
Added: 2026-08-14 · enhancement

Thin stub from `/roadmap`. **Not implementable yet.** Parked with mobile
design work until web carpool is dogfoodable. Promote with `/roadmap`, then
`/spec typography-font-family`.

If fleshing out reveals more than one PR-sized slice, stop and `/roadmap` **split**
(`Added: … · re-rank split`) — do not grow this stub into a mega-spec.

## Problem

Web display/body pairing shipped as [`typography-web`](../archive/typography-web.md)
(Space Grotesk + Plus Jakarta Sans). iOS and Android still use `system-ui`
because a distinctive typeface needs font assets bundled per platform, not
just a token string edit.

## Non-goals (sketch)

- Color / radius / spacing token churn
- Re-doing the web pairing (`typography-web`)
- Focus card chrome (`agenda-focus-card` / `agenda-focus-card-mobile`)
- Destination restyles (`feeds-page-redesign`, `family-places-garage-redesign`)

## Notes

- Token role stays; this remaining slice is iOS/Android asset bundling +
  applying the same families in native UI.
- Do not treat the generated Kotlin/Swift `fontFamily` string as done
  without bundled fonts actually used on screen.
