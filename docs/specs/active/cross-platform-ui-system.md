# Spec: cross-platform-ui-system

Status: approved  
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
- A shared cross-platform icon **asset** library (SVGs/fonts forced on all
  clients) — semantic names only; each OS maps to its native set

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

**Visual direction (provisional palette).** Choose one clear, non-generic
palette and type stack for family-carpool (avoid common AI defaults:
purple-on-white gradients; warm cream + terracotta broadsheet; glow-heavy
dark-only). Document the choice in `docs/ui-system.md`. **Explicitly flag the
palette as provisional / expected to churn** — later adopters (Calendar,
Family, etc.) must not treat first-pass hex values as final brand; token
*roles* are stable, concrete colors may revise.

**Component parity list (document once).** Enumerate recurring primitives with
behavior + visual rules (tokens only — not pixel mocks per OS):

| Primitive | Notes |
|-----------|--------|
| List row | Title, optional subtitle/meta, optional trailing action; chevron where navigation. **Icons:** use semantic names from tokens/docs (e.g. `icon.places`, `icon.feeds`, `icon.signout`); platform maps each name to its native set — no shared icon assets. |
| Grouped section | Section label + stacked rows (Settings-style) |
| Card | Interactive or content container only when needed; prefer flat sections |
| Button | Primary / secondary / danger |
| Badge / chip | Compact status or filter label |
| Empty state | Short message + optional action |
| Modal / sheet | Title, body, dismiss/primary actions (platform presentation may differ) |
| Nav container | **Allowed to diverge:** bottom tabs (iOS/Android) vs sidebar (web) per shell IA. **Icons:** same semantic-name → native-set mapping as list rows (SF Symbols / Material Symbols / existing web icon font). |

**Icon mapping rule.** Tokens/docs define semantic icon names only. Each
platform maps those names to its idiomatic icon set (SF Symbols on iOS,
Material Symbols / Material Icons on Android, existing web icon font e.g.
Lucide). Do **not** force a shared icon asset library across platforms.

Implement with **native** controls per platform; keep color/spacing/type from
tokens. Do not force web card chrome onto SwiftUI list rows.

**Reference application: More destination.** Apply tokens + the primitives
needed for More (list / grouped sections / rows / account summary / empty if
any) on **web Settings sidebar area for More rows, Android More tab, iOS More
tab** so one destination proves cross-platform consistency. Light **and** dark
must work without per-screen color overrides.

**Verification.** Side-by-side screenshots (light + dark × web/Android/iOS) of
More attached to the PR for human review — not automated visual CI in this
slice. Contrast for text-on-surface pairings used on More is checked against
WCAG AA alongside that review.

**Carry-forward:** A pass on More does **not** certify other destinations.
When Calendar / Family / Carpool / etc. adopt tokens later, that work must
independently re-run screenshots + WCAG AA — see roadmap parking
[`ui-system-destination-adoption`](../planned/ui-system-destination-adoption.md).

## Acceptance criteria

- [ ] A documented token set (JSON source of truth) exists with light **and**
  dark values for color roles, spacing, radius, and type scale; web, Android,
  and iOS consume generated/adapted outputs from that file (no duplicated
  hardcoded hex/spacing for the More restyle path).
- [ ] `docs/ui-system.md` lists the component parity table above (at least:
  list row, grouped section, card, button primary/secondary/danger, badge/chip,
  empty state), states that shell nav chrome may diverge, documents semantic
  icon names + per-platform mapping, and **flags the palette as provisional**
  (roles stable; hex values may revise before Calendar/Family adopt).
- [ ] More destination on web, Android, and iOS uses the token/component system
  and is visually consistent across platforms (spacing, type hierarchy, color
  roles) — verified by side-by-side screenshots in the PR (light + dark).
- [ ] Dark mode on the More reference screen works on all three platforms without
  additional per-screen color overrides.
- [ ] Color role tokens (text-on-surface pairings used on the More reference
  screen) meet WCAG AA contrast — **4.5:1** body text, **3:1** large text/icons
  — in both light and dark, verified alongside the screenshot review.
- [ ] No OpenAPI or backend changes; no third-party component library added; no
  shared cross-platform icon asset pack.
- [ ] Automated tests cover token sync (generator/drift) and any new UI helpers;
  More still has working navigation smoke coverage where it already exists.

## Tasks

- [x] **Tokens:** Author `tokens` JSON (light + dark); semantic icon name list;
  in-repo generator; checked-in web CSS vars, Compose theme tokens, SwiftUI
  token helpers; drift check/test.
- [x] **Docs:** `docs/ui-system.md` — visual direction with **provisional
  palette** warning, token usage rules, component parity list, icon-mapping
  rule, More as reference screen.
- [ ] **Web:** Wire tokens into CSS/Tailwind; restyle More / Settings grouped
  list + rows using parity primitives; map semantic icons → existing web icon
  font; support dark mode for that surface.
- [ ] **Android (sharedUI):** Theme from tokens; restyle More destination with
  native Compose primitives; map semantic icons → Material Symbols / Icons.
- [ ] **iOS:** Token helpers; restyle More destination with native SwiftUI;
  map semantic icons → SF Symbols; honor system light/dark.
- [ ] **Tests / review:** Generator/drift test; update client tests as needed;
  attach light+dark screenshots for More on all three platforms; record WCAG AA
  contrast check for More text-on-surface pairings (light + dark).

## Open questions

*Resolved on approve:*

| Topic | Decision |
|-------|----------|
| Token toolchain | In-repo generator only; no Style Dictionary / new Gradle/npm dep |
| Restyle scope | **More only** this PR; other destinations adopt tokens later |
| Screenshot gate | Manual PR attachments (not Percy/Chromatic) |
| Brand palette | First-pass invent OK and **expected to churn**; `docs/ui-system.md` must say palette is provisional |
| Icons | Semantic names in tokens/docs; native mapping per platform — no shared asset library |
| Contrast | WCAG AA on More pairings (4.5:1 body / 3:1 large text & icons), light + dark |

## Approval

Approved 2026-08-10 (amendments: icon mapping, WCAG AA, provisional palette).
Ready for `/implement`.
