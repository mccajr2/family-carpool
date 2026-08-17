# UI system (family-carpool)

Status: active  
Source of truth: [`design-tokens/tokens.json`](../design-tokens/tokens.json)  
Spec: [`cross-platform-ui-system`](specs/archive/cross-platform-ui-system.md)  
Follow-up: [`ui-system-destination-adoption`](specs/planned/ui-system-destination-adoption.md)

Shared look and interaction vocabulary for **web**, **Android**, and **iOS**.
Clients consume generated token outputs — they do not invent one-off hex or
spacing values for surfaces that have adopted this system.

## Palette

Brand hex landed with [`agenda-focus-card`](specs/archive/agenda-focus-card.md)
(`tokens.json` `meta.provisional` is **false**). Token **roles** (`accent`,
`surface`, `textPrimary`, `rail*`, `hero*`, …) are the stable contract. Screen
mocks (Claude Calendar / Feeds HTML) are **intake for layout and chrome** —
map mock px and hex to existing roles; do not add one-off type/spacing tokens
or raw hex in adopted UI. Parked
[`ui-palette-refresh`](specs/planned/ui-palette-refresh.md) is not a second
palette PR.

Visual direction: cream paper surface, ink text, route-blue accent — not
lagoon teal, not purple-on-white gradients. Always-dark web rail uses `rail*`
(not `hero*`). Focus urgent state uses `hero*` only.

When a destination restyles, re-check WCAG AA for **that** surface (see
destination-adoption). Remainder: Carpool, Family, Places, Garage. Agenda and
Feeds already adopt tokens.

## Tokens

| Category | Roles / keys |
|----------|----------------|
| Color (light + dark) | `accent`, `accentOn`, `danger`, `dangerOn`, `success`, `successOn`, `surface`, `surfaceRaised`, `border`, `textPrimary`, `textSecondary`, plus Focus-card urgent `heroSurface`, `heroOn`, `heroOnSecondary`, `heroDanger`, `heroSuccess`, `heroAccent`, plus web-shell always-dark `railSurface`, `railOn`, `railOnSecondary`, `railActive`, `railAccent`, `railDanger` |
| Spacing | `xs` … `2xl` (4 → 32 px) |
| Radius | `sm`, `md`, `lg` |
| Typography | `caption`, `body`, `title`, `headline` (size / lineHeight / weight) |
| Icons | Semantic names only (see below) |

### Generate / drift

```bash
node design-tokens/generate.mjs          # rewrite checked-in outputs
node design-tokens/generate.mjs --check  # fail if outputs drift
node --test design-tokens/generate.test.mjs
```

Outputs (do not edit by hand):

| Platform | Path |
|----------|------|
| Web | `web/src/styles/tokens.generated.css` (`--fc-*` custom properties; dark via `.dark` / `[data-theme="dark"]`) |
| Android | `mobile/sharedUI/.../ui/UiTokens.kt` |
| iOS | `mobile/iosApp/iosApp/UiTokens.swift` |

### Usage rules

1. Prefer token roles over raw hex / magic padding in adopted UI.
2. Pair text with surfaces intentionally (`textPrimary` / `textSecondary` on
   `surface` / `surfaceRaised`; `accentOn` on `accent`).
3. Light and dark values live in the JSON — avoid per-screen color overrides.
4. Shell **navigation chrome** may diverge by platform (tabs vs sidebar); content
   inside a destination should still use the same tokens.

## Component parity

Documented once; implement with **native** controls (SwiftUI / Compose / web).
Match platform interaction conventions; keep color, spacing, and type from
tokens.

| Primitive | Behavior / visual rules |
|-----------|-------------------------|
| List row | Title; optional subtitle/meta; optional trailing action; disclosure chevron when the row navigates. Leading glyphs use **semantic icon names** (below). |
| Grouped section | Section label + stacked rows (Settings-style). Prefer flat grouping over decorative cards. |
| Card | Use only when a bordered/raised container is needed for interaction or understanding; default is no card chrome. |
| Button | Variants: **primary** (`accent` / `accentOn`), **secondary** (bordered / muted surface), **danger** (`danger` / `dangerOn`). |
| Badge / chip | Compact status or filter label; small type (`caption`); quiet fill or border from tokens. |
| Empty state | Short message + optional action; body/secondary text roles. |
| Modal / sheet | Title, body, dismiss + primary actions; presentation may be dialog (web) vs sheet (mobile). |
| Nav container | **Allowed to diverge:** bottom tabs (iOS/Android) vs sidebar (web) per `app-shell-navigation`. Icons still use semantic names. |

## Icon mapping

Tokens/docs define **semantic names** only. Each platform maps those names to
its native set. **No** shared SVG/font icon pack across platforms.

| Semantic name | Intended use | Web (Lucide) | Android (Material) | iOS (SF Symbol) |
|---------------|--------------|--------------|--------------------|-----------------|
| `icon.calendar` | Calendar tab / calendar chrome | `Calendar` | `Icons.Default.DateRange` (or calendar) | `calendar` |
| `icon.carpool` | Carpool tab | `Car` | `Icons.Default.DirectionsCar` | `car` |
| `icon.family` | Family tab | `Users` | `Icons.Default.People` | `person.3` |
| `icon.more` | More tab | `Ellipsis` / `CircleEllipsis` | `Icons.Default.MoreHoriz` | `ellipsis.circle` |
| `icon.places` | Places row | `MapPin` | `Icons.Default.Place` | `mappin.and.ellipse` |
| `icon.garage` | Garage row | `Warehouse` | `Icons.Default.DirectionsCar` (car-side) | `door.garage.closed` |
| `icon.feeds` | Feeds row | `Rss` | `Icons.Default.RssFeed` | `dot.radiowaves.up.forward` |
| `icon.signout` | Sign out | `LogOut` | `Icons.Default.ExitToApp` | `rectangle.portrait.and.arrow.right` |
| `icon.add` | Add / create | `Plus` | `Icons.Default.Add` | `plus` |
| `icon.chevron` | Forward disclosure | `ChevronRight` | `Icons.Default.ChevronRight` | `chevron.right` |

Exact Material / SF Symbol identifiers may be adjusted for availability; keep
the **semantic name** stable in code (`UiTokens.Icon.places`, `UiTokens.Icon.garage`, etc.).

## Reference screen: More

`cross-platform-ui-system` applies tokens + parity primitives to the **More**
destination only (web Settings/More list, Android More tab, iOS More tab) as
the proof surface — including light and dark.

A pass on More does **not** certify other destinations. Agenda and Feeds
already adopt tokens. Remainder (Carpool, Family, Places, Garage) still
re-runs light/dark screenshots and WCAG AA for **that** surface
([`ui-system-destination-adoption`](specs/planned/ui-system-destination-adoption.md)).

### Contrast target (More and later adopters)

For text-on-surface pairings in use: **WCAG AA** — 4.5:1 body text, 3:1 large
text and icons — in both light and dark.
