# ADR-0002: Ride cancellations are automatic and non-blocking

**Status:** Accepted  
**Date:** 2026-08-28  
**Governs:** [`ride-revert-undo`](../specs/archive/ride-revert-undo.md), [`auto-decline-unofferable`](../specs/archive/auto-decline-unofferable.md)

## Context

An earlier iteration handled a driver backing out of an already-accepted carpool commitment with a dedicated "stranded rider" panel: three options (resume driving, reassign a driver, or individually notify each affected family), surfaced as its own high-priority hero tier above ordinary coverage gaps.

This was rejected as over-engineered for a rare, low-stakes event.

## Decision

Canceling a ride commitment is a **single action with no confirmation step and no dialog**:

- **Canceling your own driving assignment** atomically reverts your ride to unassigned *and* auto-withdraws any carpool rider who'd already been accepted onto that ride, in the same update.
- **Canceling one rider without dropping your own kid** withdraws just that one request, leaving your own ride status untouched.
- **Assigning household coverage** while an open PENDING team ask covers any of the assigned kids cancels that ask in the same action ([`auto-decline-unofferable`](../specs/archive/auto-decline-unofferable.md)).
- These cases surface as factual chip copy — not an apology, not a warning.
- No dialog asks the canceling parent to explain, confirm, or choose between remediation options.

From the affected family's account, a carpool ride falling through is simply their own child's ride reverting to "unassigned" — which ADR-0001 already puts at the top of *their* queue.

## Consequences

- Implementers should resist re-adding confirmation dialogs "just in case."
- A future optional reason/apology note is explicitly deferred — must not block cancellation from completing immediately.
- Any new "something fell through" scenario should be checked against this ADR before building bespoke UI.
- Forward coupling (ask-team auto-decline inbound; Assign→cancel open ask) is Done: [`auto-decline-unofferable`](../specs/archive/auto-decline-unofferable.md).

## Alternatives considered

- **Guided multi-option panel with per-rider notify actions** — built, then rejected.
- **Confirmation dialog before canceling** — rejected.
