# Spec stub: typography-font-family

Status: planned  
Parent: [docs/roadmap.md](../../roadmap.md)  
Created: 2026-08-14  
Added: 2026-08-14 · enhancement

Thin stub from `/roadmap`. **Not implementable yet.** Run `/spec typography-font-family`
to flesh out Approach, Acceptance Criteria, and Tasks before any code.

If fleshing out reveals more than one PR-sized slice, stop and `/roadmap` **split**
(`Added: … · re-rank split`) — do not grow this stub into a mega-spec.

## Problem

`typography.fontFamily` is still `system-ui`. A distinctive typeface needs
font assets bundled on iOS and Android, not just a token string edit.

## Non-goals (sketch)

- Color / radius / spacing token churn
- Focus card chrome (`agenda-focus-card` / `agenda-focus-card-mobile`)
- Destination restyles (`feeds-page-redesign`, `family-places-garage-redesign`)

## Notes

- Token role stays; this slice is asset bundling + family value.
- Do not treat a `tokens.json` string change as done without iOS/Android
  bundled fonts.
