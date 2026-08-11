# Spec: cross-platform-ui-system

Status: draft  
Created: 2026-08-10  
Updated: 2026-08-10  
Parent: [docs/roadmap.md](../../roadmap.md)  
Branch: `cross-platform-ui-system`  
Added: 2026-08-10 · enhancement

## Problem

Web, Android, and iOS each use stock/default toolkit styling (and slightly
different spacing/type/color habits), so the product feels generic and
inconsistent across clients. Adults should recognize one family-carpool look
and a shared interaction vocabulary on every platform — without waiting for a
full redesign of every screen.

## Non-goals

- OpenAPI / backend changes (client visual/token system only)
- Redesigning information architecture or shell destinations
  (`app-shell-navigation` already owns Calendar → Carpool → Family → More)
- Restyling **every** existing screen in this PR — Calendar, Family, auth, and
  compose flows stay on current styling until a follow-up (or later tasks)
  adopts the same tokens/primitives
- Forcing one shared Compose Multiplatform / React UI into iOS — align **tokens
  + patterns**; implement with **native** SwiftUI / Compose / web controls
- Adopting a third-party component library (shadcn expansion, Material themed
  kits, etc.) without a separate decision — use existing stack primitives
- Full brand rename / package identity (`app-identity-rename`)
- Illustration, marketing site, or logo system
- Introducing a heavy token toolchain (Style Dictionary, etc.) unless approved
  separately — prefer a single JSON source + small in-repo generator

## Approach

**Shared design tokens (source of truth).** One platform-agnostic token file
(JSON) defines light **and** dark values for: color roles (`accent`, `danger`,
`success`, surfaces/backgrounds/borders, text primary/secondary), spacing
scale, radius scale, and typography scale. No client hardcodes a hex / px / pt
that is not traced to this file.

**Platform outputs from that file.** A small in-repo generator (Node script
under `web/` or a repo `scripts/` folder — **no new package**) emits:

- Web: CSS custom properties (wired into existing Tailwind / CSS entry)
- Android (sharedUI Compose): Kotlin theme/token constants (or Material3
  color scheme built from tokens)
- iOS: Swift constants / `Color` + font helpers consumed by SwiftUI

CI or a unit check fails if generated outputs drift from the JSON (regenerate
checked in, or generate at build — pick one and document it; prefer
**checked-in generated files** so mobile builds stay offline-friendly).

**Visual direction.** Choose one clear, non-generic palette and type stack for
family-carpool (avoid common AI defaults: purple-on-white gradients; warm cream
+ terracotta broadsheet; glow-heavy dark-only). Document the choice in a short
`docs/ui-system.md` (or tokens README) so later screens do not reinvent it.

**Component parity list (document once).** Enumerate recurring primitives with
behavior + visual rules (tokens only — not pixel mocks per OS):

| Primitive | Notes |
|-----------|--------|
| List row | Title, optional subtitle/meta, optional trailing action; chevron where navigation |
| Grouped section | Section label + stacked rows (Settings-style) |
| Card | Interactive or content container only when needed; prefer flat sections |
| Button | Primary / secondary / danger |
| Badge / chip | Compact status or filter label |
| Empty state | Short message + optional action |
| Modal / sheet | Title, body, dismiss/primary actions (platform presentation may differ) |
| Nav container | **Allowed to diverge:** bottom tabs (iOS/Android) vs sidebar (web) per shell IA |

Implement with **native** controls per platform; keep color/spacing/type from
tokens. Do not force web card chrome onto SwiftUI list rows.

**Reference application: More destination.** Apply tokens + the primitives
needed for More (list / grouped sections / rows / account summary / empty if
any) on **web Settings sidebar area for More rows, Android More tab, iOS More
tab** so one destination proves cross-platform consistency. Light **and** dark
must work without per-screen color overrides.

**Verification.** Side-by-side screenshots (light + dark × web/Android/iOS) of
More attached to the PR for human review — not automated visual CI in this
slice.

## Acceptance criteria

- [ ] A documented token set (JSON source of truth) exists with light **and**
  dark values for color roles, spacing, radius, and type scale; web, Android,
  and iOS consume generated/adapted outputs from that file (no duplicated
  hardcoded hex/spacing for the More restyle path).
- [ ] `docs/ui-system.md` (or equivalent) lists the component parity table above
  (at least: list row, grouped section, card, button primary/secondary/danger,
  badge/chip, empty state) and states that shell nav chrome may diverge.
- [ ] More destination on web, Android, and iOS uses the token/component system
  and is visually consistent across platforms (spacing, type hierarchy, color
  roles) — verified by side-by-side screenshots in the PR (light + dark).
- [ ] Dark mode on the More reference screen works on all three platforms without
  additional per-screen color overrides.
- [ ] No OpenAPI or backend changes; no third-party component library added.
- [ ] Automated tests cover token sync (generator/drift) and any new UI helpers;
  More still has working navigation smoke coverage where it already exists.

## Tasks

- [ ] **Tokens:** Author `tokens` JSON (light + dark); in-repo generator;
  checked-in web CSS vars, Compose theme tokens, SwiftUI token helpers; drift
  check/test.
- [ ] **Docs:** `docs/ui-system.md` — visual direction, token usage rules,
  component parity list, More as reference screen.
- [ ] **Web:** Wire tokens into CSS/Tailwind; restyle More / Settings grouped
  list + rows using parity primitives; support dark mode for that surface.
- [ ] **Android (sharedUI):** Theme from tokens; restyle More destination with
  native Compose primitives.
- [ ] **iOS:** Token helpers; restyle More destination with native SwiftUI;
  honor system/light-dark.
- [ ] **Tests / review:** Generator/drift test; update client tests as needed;
  attach light+dark screenshots for More on all three platforms in the PR.

## Open questions

| Topic | Proposal (confirm on approve) |
|-------|-------------------------------|
| Token toolchain | In-repo generator only; no Style Dictionary / new Gradle/npm dep |
| Restyle scope | **More only** this PR; other destinations adopt tokens later |
| Screenshot gate | Manual PR attachments (not Percy/Chromatic) |
| Brand palette | First-pass invent in tokens (document in ui-system); amend if you lock brand colors before `/implement` |

## Approval

Draft from `/spec`. Approve to unlock `/implement`.
