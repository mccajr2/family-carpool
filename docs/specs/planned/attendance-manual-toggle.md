# Spec stub: attendance-manual-toggle

Status: planned  
Parent: [docs/roadmap.md](../../roadmap.md)  
Created: 2026-08-28  
Added: 2026-08-28 · initial

Thin stub from hero & coverage flow redesign import. **Not implementable yet.**
Run `/spec attendance-manual-toggle` before any code.

**Depends on:** [`coverage-priority-engine`](../archive/coverage-priority-engine.md)  
**Governs:** [ADR-0003](../../decisions/ADR-0003-attendance-manual-default-going.md)

## Problem

Attendance must be representable without becoming a second nagging queue
alongside ride coverage.

## Non-goals (sketch)

- "Not sure" RSVP state or hero reminders for undecided attendance
- Team/coach RSVP rollup views

## Notes

- Two-state toggle only: default link "Mark {kid} as not going"; not-going state "{kid} is marked not going. Mark as going again."
- Uses **"going"** language only — never "make it" (distinct from ride revert copy).
- Never part of `getQueue` output.
- OpenAPI migration from `YES`/`NO`/`NO_RESPONSE` → going/not_going if `/spec` requires backend change; rank 1 may use client mapping until then.
