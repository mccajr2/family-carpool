# UI system (family-carpool)

Status: active  
Source of truth: [`design-tokens/tokens.json`](../design-tokens/tokens.json)  
Spec: [`cross-platform-ui-system`](specs/archive/cross-platform-ui-system.md)  
Follow-up: [`ui-system-destination-adoption`](specs/planned/ui-system-destination-adoption.md)

**Agents:** load this when the active spec's **Context** cites it (visual
restyle / tokens). Do not load it for backend-only work.

Shared look and interaction vocabulary for **web**, **Android**, and **iOS**.
Clients consume generated token outputs — they do not invent one-off hex or
spacing values in components. **Where those token values come from:**
destination mocks, not a frozen pre-mock scale.

## Visual source of truth

**Destination mocks** (Claude Calendar + Feeds HTML 2026-08-17, and later
per-destination mocks) are the source of truth for **size, weight, spacing,
and color** on surfaces we restyle. Put mock values into
[`design-tokens/tokens.json`](../design-tokens/tokens.json) as new or updated
roles in the **same PR**, then consume the generated `--fc-*` / Kotlin /
Swift outputs.

Do **not** snap a mock measurement to a nearby existing role (34px heading
→ `hero` 26px, 26px gap → `space-xl` 24px, 14px/500 subtitle → `body`
15px/400). That “nearest token” rule was premature — it predates the
mocks.

**Exception:** WCAG AA (4.5:1 body text, 3.0:1 icons). Mock hex that fails
contrast is adjusted (already done for several light-mode pairings). Do not
use that exception to ignore mock type size, weight, or spacing.

If a mock conflicts with an older lock, **ask** before implementing; the
expected answer is defer to the mock.

Parked [`ui-palette-refresh`](specs/planned/ui-palette-refresh.md) is not a
second palette PR — brand hex already landed
([`agenda-focus-card`](specs/archive/agenda-focus-card.md);
`tokens.json` `meta.provisional` is **false**).

Visual direction: cream paper surface, ink text, route-blue accent — not
lagoon teal, not purple-on-white gradients. Always-dark web rail uses `rail*`
(not `hero*`). Focus urgent state uses `hero*` **color** roles only (`hero`
type-scale is a size role and may differ from page titles).

When a destination restyles, re-check WCAG AA for **that** surface (see
destination-adoption). Remainder: Carpool, Family, Places, Garage. Agenda and
Feeds already adopt tokens.

## Tokens

| Category | Roles / keys |
|----------|----------------|
| Color (light + dark) | `accent`, `accentOn`, `danger`, `dangerOn`, `success`, `successOn`, `surface`, `surfaceRaised`, `border`, `textPrimary`, `textSecondary`, plus Focus-card urgent `heroSurface`, `heroOn`, `heroOnSecondary`, `heroDanger`, `heroSuccess`, `heroAccent`, plus web-shell always-dark `railSurface`, `railOn`, `railOnSecondary`, `railActive`, `railAccent`, `railDanger` |
| Spacing | `xs` … `2xl` (4 → 32 px) plus mock-named steps (`header` = 26, `mainY` = 36, `mainX` = 44, `railY` = 28, `railX` = 20, Feeds `feedCardPad*` 18×20, `feedChipPad*` 4×10, `feedFormPad` 22, and other `feed*` gaps; Calendar week-glance `weekGlancePadX` 28, `weekItemPadY` 10, `weekDayWidth` 38, `weekFlag` 7) |
| Radius | `sm`, `md`, `lg`, `xl` |
| Typography | `caption`, `body`, `subtitle`, `title`, `headline`, `hero`, `page` (size / lineHeight / weight), plus destination mock roles (`feedName` 16.5/700, `feedChip` 11/700, `feedSubmit` 14.5/700, week-glance `weekGlanceTitle` 16/700, `weekDay` 12/700, `weekCount` 13/600, `weekCountCalm` 13/500, …). Scale **grows** when a mock introduces a new size/weight. |
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

1. Mock size / weight / spacing / color → `tokens.json` (new or updated role)
   in the same PR as the surface. Then use the generated variable — no raw
   px or hex in adopted UI.
2. Do not snap to a nearby existing role because it is “close enough.”
3. Pair text with surfaces intentionally (`textPrimary` / `textSecondary` on
   `surface` / `surfaceRaised`; `accentOn` on `accent`).
4. Light and dark values live in the JSON — avoid per-screen color overrides
   except WCAG AA adjustments recorded in tokens.
5. Shell **navigation chrome** may diverge by platform (tabs vs sidebar); content
   inside a destination should still use the same tokens.

## Component parity

Documented once; implement with **native** controls (SwiftUI / Compose / web).
Match platform interaction conventions; keep color, spacing, and type from
tokens.

| Primitive | Behavior / visual rules |
|-----------|-------------------------|
| List row | Title; optional subtitle/meta; optional trailing action; disclosure chevron when the row navigates. Leading glyphs use **semantic icon names** (below). |
| Grouped section | Section label + stacked rows. Agenda list uses Feeds section-label chrome (`feedSectionLabel*`, all-caps slate) for **NEEDS YOUR ATTENTION** / **REST OF TODAY** / **TOMORROW** / **THIS WEEK** / **LATER** — not sentence-case primary headings. Prefer flat grouping over decorative cards. |
| Card | Use only when a bordered/raised container is needed for interaction or understanding; default is no card chrome. |
| Button | Variants: **primary** (`accent` / `accentOn`), **secondary** (bordered / muted surface), **danger** (`danger` / `dangerOn`). |
| Badge / chip | Compact status or filter label. **Agenda + Feeds status chips** share `feedChip*` (11/700, pad 4×10), uppercase via CSS, no leading bullet — Title Case pills with a status dot are retired on Agenda (`AgendaStatusChip` tag / `CarpoolFeedStatusChip`). Filter chips may use other roles (`filterChip*`). Quiet fill or border from tone tokens. |
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
