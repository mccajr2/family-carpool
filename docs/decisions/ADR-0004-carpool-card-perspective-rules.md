# ADR-0004: Perspective, leg-scoping, and grouping rules for carpool/coverage cards

**Status:** Accepted  
**Date:** 2026-09-14  
**Governs:** [`day-block-domain`](../specs/planned/day-block-domain.md), [`day-block-agenda`](../specs/planned/day-block-agenda.md), [`day-block-route`](../specs/planned/day-block-route.md) — and any later spec that touches Hero, Agenda rows, DriverPicker, or Route stops

## Context

Working through a specific multi-family, multi-leg scenario (see day-block
roadmap intake / [`day-block-grouping.mockup.html`](../ui-system/day-block-grouping.mockup.html))
surfaced several wording and grouping bugs that are easy to reintroduce
piecemeal if each spec re-derives them from scratch. These rules are
**card-agnostic** — they apply to Hero, Agenda rows, DriverPicker, and Route
stop lists alike, on any surface where more than one household's rider/driver
state is shown together.

Mockup SoT: [`docs/ui-system/carpool-card-perspective-rules.mockup.html`](../ui-system/carpool-card-perspective-rules.mockup.html)
(standalone, opens directly in a browser — no build step). Each section is
labeled with which rule(s) it demonstrates.

These nine rules were validated against real bugs (e.g. a leg-direction label
bug), not style preference. Specs that touch the surfaces above must **list
this ADR in Context and apply the nine decisions directly** — do not re-derive
or paraphrase them from a feature summary.

## Decision

**1. Perspective normalization.** Every card renders from the *viewing*
adult's point of view. Never surface another party's raw status language to
a different viewer unmodified — e.g. don't show "Jay confirmed" to Chris;
show what it means to Chris ("Coming back: you confirmed" / "Jay is driving
Declan there himself"). The same event's card looks different to each adult
who sees it, by design.

**2. Kid-first framing.** Lead asks and status lines with the kid's name and
need, not the requesting parent's name. "McCarthy need a ride for Declan" →
"Declan needs a ride home." A parent's name appears as an attribution
("Requested by Jay McCarthy"), never as the subject of the sentence.

**3. Leg-scoped asks and commitments.** Every ask or status chip is scoped to
exactly one leg (to the event, or from it) — never bundle both directions
into one ambiguous label. A round-trip commitment the viewer already owns
renders as a plain informational banner ("You're already driving Luke and
Graham round trip"), not as a chip requiring decoding.

**4. Direction-correct pickup/drop-off.** On a *from-event* leg, a rider's
house is a **drop-off**; the event venue is the only **pickup** point for
that leg. Reverse for a *to-event* leg. Never label a home-side stop
"pickup" on the way back — this was an actual bug, not just an unclear
label.

**5. Named, qualified addresses.** Never render a bare place name (e.g.
"Home") across a household boundary — pair it with whose it is: "390 Huron
Ave, Cambridge, MA (Declan's home)" to a third party, or "your home" when
the card belongs to that same family. "Home" alone is only valid on a card
where there's exactly one possible home it could mean.

**6. "Not your job tonight" grouping.** Legs or kids another adult already
owns render as a single muted, non-actionable info block, grouped together
and visually distinct from the viewer's own action items — never as loose
chips interleaved with things the viewer actually has to do.

**7. Paired, independently-scoped cancel/reassign links.** When a leg
carries both the viewer's own kids and an added rider from another
household, offer two separate links: one that reassigns the whole leg
(their own kids included), and one narrower link that only hands back the
added rider. Never collapse these into a single "can't drive?" link — the
blast radius is different and the viewer needs to pick which one they mean.

**8. Single-stop multi-kid grouping.** When one stop serves more than one
kid from the same address (siblings, etc.), render **one** stop with both
kids' initials/avatars and names together, not duplicate stops at the same
address.

**9. Card-component parity.** Any pending ask — kid coverage or an incoming
carpool request — uses the same inline, expandable card with Accept/Decline
in place. Never route one kind of pending item to a separate full-page
"hero" screen while the other expands inline; if the "needs attention"
entry point differs (banner vs. list row), it should scroll to and highlight
the same underlying card, not open a different component.

## Consequences

- Copy and grouping logic for cards should live in one shared place per
  surface (mirrors the existing `coverageCopy` / `unified-ride-status-chip`
  pattern) so these nine rules are enforced once, not per-card.
- Any new spec that touches Hero, Agenda rows, DriverPicker, or Route stops
  should list this ADR in its Context and apply it directly — it is not
  something `/spec` should re-derive from the feature description alone.
- If a future design decision conflicts with one of these, amend this ADR
  explicitly (same pattern as ADR-0001's amendment) rather than quietly
  drifting on one surface.
- Mockups prove the wording model; they do **not** lock surface color
  (keep existing Hero dark / Agenda light treatments) or raw text density
  (compress via progressive disclosure, but never collapse copy that
  resolves one of these nine rules — e.g. round-trip banner, named/qualified
  address, paired cancel links).

## Alternatives considered

- **Re-derive per-spec from feature summaries** — rejected; caused the
  original bugs to recur when each surface invented its own wording.
- **Collapse cancel/reassign into one "can't drive?" link** — rejected;
  blast radius differs when own kids and added riders share a leg.
