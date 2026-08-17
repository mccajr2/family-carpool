# Spec stub: agenda-full-page-redesign-mobile

Status: planned  
Parent: [docs/roadmap.md](../../roadmap.md)  
Created: 2026-08-15  
Added: 2026-08-15 · enhancement

Thin stub from `/roadmap`. **Not implementable yet.** Run `/spec agenda-full-page-redesign-mobile`
to flesh out Approach, Acceptance Criteria, and Tasks before any code.

If fleshing out reveals more than one PR-sized slice, stop and `/roadmap` **split**
(`Added: … · re-rank split`) — do not grow this stub into a mega-spec.

## Problem

After web Agenda is day-grouped card rows, iOS and Android still need the
same grouping, collapsed rows, and expand/collapse — selection logic and
copy matching web; native chrome OK.

## Non-goals (sketch)

- Web Agenda (`agenda-full-page-redesign`)
- Changing coverage / RSVP / leave-by rules
- Font family swap (`typography-font-family`)

## Notes

- Depends on shipped web [`agenda-full-page-redesign`](../archive/agenda-full-page-redesign.md).
- Focus card mobile port is a separate id:
  [`agenda-focus-card-mobile`](agenda-focus-card-mobile.md). Combine at
  `/spec` time if doing both in one PR would be cheaper than two.
