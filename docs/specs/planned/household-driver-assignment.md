# Spec stub: household-driver-assignment

Status: planned  
Parent: [docs/roadmap.md](../../roadmap.md)  
Created: 2026-08-28  
Added: 2026-08-28 · initial

Thin stub from hero & coverage flow redesign import. **Not implementable yet.**
Run `/spec household-driver-assignment` before any code.

**Depends on:** [`coverage-priority-engine`](../active/coverage-priority-engine.md)

## Problem

A binary "I'll drive" / "ask the team" choice doesn't reflect real households —
often someone else in the family (a spouse, a grandparent) can drive instead,
and offering only "you" or "strangers" skips the obvious middle option.

## Non-goals (sketch)

- Full inbox view for the asked household member (state transition must exist; UI may be minimal)
- Wider carpool network ask UX beyond the separated "Ask the team" path
- Backend household entity changes unless `/spec` proves necessary

## Notes

- `DriverPicker`: household member chips (default "You"), confirm button ("Confirm I'll drive" / "Ask {name} to drive"), visually separated caption ("Nobody in the household free?") + "Ask the team for a ride" button.
- Other household member → `{ driver, confirmed: false }`; wider network → `"requested"`.
- Pending household confirm → "Waiting on {name}" chip.
- Assigning any real driver resets attendance to `"going"` ([ADR-0003](../../decisions/ADR-0003-attendance-manual-default-going.md)).
