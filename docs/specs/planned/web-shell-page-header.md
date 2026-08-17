# Spec stub: web-shell-page-header

Status: planned  
Parent: [docs/roadmap.md](../../roadmap.md)  
Created: 2026-08-17  
Added: 2026-08-17 · enhancement

Thin stub from `/roadmap`. **Not implementable yet.** Run `/spec web-shell-page-header`
to flesh out Approach, Acceptance Criteria, and Tasks before any code.

If fleshing out reveals more than one PR-sized slice, stop and `/roadmap` **split**
(`Added: … · re-rank split`) — do not grow this stub into a mega-spec.

## Problem

After [`web-shell-page-frame`](../active/web-shell-page-frame.md) uncards the
destination column, the shared page header still looks like a shadcn
`CardTitle` (`text-2xl`, no token color). The Calendar mock uses a larger
display heading, ink/slate type, a date subtitle, and more space under the
header. Deferred from page-frame so that slice stayed column widths only.

## Non-goals (sketch)

- New type or spacing token roles for mock 34px / 36px / 44px / 26px —
  map to existing `headline` or `hero`, `textPrimary` / `textSecondary`,
  and nearest `--fc-space-*` (header↔content gap ≈ `space-xl`)
- Reopening page-frame column widths, `max-w-[820px]`, or main padding
  (page-frame already locked nearest tokens vs mock 36×44)
- Focus card, filter/status chips, section labels, week-glance, carpool
  stop card ([`agenda-focus-card-polish`](agenda-focus-card-polish.md),
  [`agenda-list-chips`](agenda-list-chips.md),
  [`agenda-week-glance`](agenda-week-glance.md),
  [`carpool-multi-stop`](carpool-multi-stop.md))
- Restyling the Add event button
- iOS / Android
- Changing destination set or handlers

## Notes

- Intake: Calendar mock HTML 2026-08-17 — `.main-header h1` 34px / 700 /
  Space Grotesk / ink; `p` 14px / 500 / slate (`#686F79` = `textSecondary`);
  copy **Today** + weekday date (e.g. Wednesday, August 13); header
  `margin-bottom: 26px`.
- Shared chrome: every destination heading uses token type +
  `textPrimary`. Calendar-only copy is the Today/date pair; other
  destinations keep their names (Family may keep email · role as
  `textSecondary` subtitle).
- Depends on shipped [`web-shell-page-frame`](../active/web-shell-page-frame.md).
