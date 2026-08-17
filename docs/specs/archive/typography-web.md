# Spec: Display/body typography pairing (web only)

Status: done
Created: 2026-08-16
Updated: 2026-08-16 (`/pr`)
Parent: [docs/roadmap.md](../../roadmap.md)
Branch: `typography-web`
Added: 2026-08-16 · re-rank split
Scope: web client only. Mobile explicitly untouched — see rationale below.

## Objective

Replace `system-ui` with a real display/body font pairing on web: **Space
Grotesk** for headlines/large numbers, **Plus Jakarta Sans** for body text.
This was previously deferred because a font change needs assets bundled
per-platform for iOS/Android — that constraint doesn't apply to web, and
mobile is currently parked anyway, so there's no synchronization reason left
to hold web back. This is purely visual — no behavior changes.

## Tasks

- [x] Task 1 — Token update
- [x] Task 2 — Emit `--fc-font-family-display`
- [x] Task 3 — Load the fonts
- [x] Task 4 — Apply `fc-display` to headline-level text

## Task 1 — Token update (verbatim, already applied to the source file)

`design-tokens/tokens.json`'s `typography` block should read:

```json
"typography": {
  "fontFamily": "Plus Jakarta Sans",
  "displayFontFamily": "Space Grotesk",
  "scale": { ...unchanged... }
}
```

If your repo's `tokens.json` doesn't already have this, apply it exactly
(only the two `fontFamily`/`displayFontFamily` lines change — `scale` is
untouched). Also update `meta.description` to note the change, matching the
pattern of prior entries (palette adoption, WCAG AA fix, `hero*` roles are
each noted there — add one more sentence for this).

## Task 2 — `design-tokens/generate.mjs`: emit a second CSS variable

**This is a described change, not a verbatim file — read the actual current
file before editing; don't guess at exact current syntax.**

In `cssFromTokens()`, there's an existing line that emits the body font as
`--fc-font-family` from `t.typography.fontFamily` (with a `system-ui,
sans-serif` fallback chain). Add a sibling line immediately after it that
emits `--fc-font-family-display` from `t.typography.displayFontFamily`,
using the same fallback pattern. Do not change the existing
`--fc-font-family` line's structure — only add the new one alongside it.

The Kotlin/Swift generator functions (`kotlinFromTokens`, `swiftFromTokens`)
do **not** need changes for this slice — `displayFontFamily` being an unused
extra key in the JSON is harmless; mobile font work is separate, parked
work, not part of this spec.

After editing, run:
```bash
node design-tokens/generate.mjs
node design-tokens/generate.mjs --check
```
Confirm `web/src/styles/tokens.generated.css` now has both
`--fc-font-family` (Plus Jakarta Sans) and `--fc-font-family-display`
(Space Grotesk) in `:root`, and that `--check` passes clean.

## Task 3 — Load the fonts

Self-host latin static `.woff2` files under `web/src/fonts/` and declare
`@font-face` in `web/src/index.css`. Do **not** load from Google Fonts —
the CSS2 API 404s Plus Jakarta Sans italic/variable subset files
(`LDIWaom-*.woff2` on `fonts.gstatic.com`).

The existing `body { font-family: var(--fc-font-family); }` rule in
`index.css` needs **no change** — it already references the token variable,
so it picks up Plus Jakarta Sans automatically once Task 2 lands. Verify
this is true by inspection rather than assuming; if `index.css` has since
diverged from that pattern, adjust minimally to restore it.

## Task 4 — Apply the display font to headline-level text

Add one new utility rule to `web/src/index.css`:

```css
.fc-display {
  font-family: var(--fc-font-family-display);
}
```

Apply the `fc-display` class to headline-scale text in the files this
project has already shipped or specced — **scoped to these specific
elements, not a codebase-wide sweep**:

- `AgendaFocusCard.tsx` — the hero title span (the element using
  `--fc-font-hero-size`).
- `AgendaRow.tsx` — the row title span.
- `FamilyScreen.tsx` — the main page headers (e.g. "Calendar", "Feeds" —
  wherever `<CardTitle>` or an equivalent top-level heading renders per
  destination).

If you find other clearly headline-scale text while implementing (e.g. a
modal title, a section header using the `headline` type-scale token) and
it's a small, obvious addition, use your judgment to include it — but don't
go hunting through unrelated destinations (Places, Garage, Carpool) for
this slice; those weren't part of the design pass that produced this token
system and may not want the same treatment yet.

## Explicitly out of scope

- Mobile (iOS/Android) font changes — needs asset bundling, separate
  future work.
- Any destination not already touched by prior specs (Places, Garage,
  Carpool, Family) — don't apply `fc-display` there speculatively.

## Manual smoke test

- Load Agenda (both Focus card and flat rows) — headline text should
  visibly use Space Grotesk (distinct letterforms — notably the lowercase
  "g" and the numerals — from the body text around it), body text should
  be Plus Jakarta Sans, not system-ui.
- Load Feeds — page header should use the display font if `FamilyScreen.tsx`
  headers were updated per Task 4.
- Confirm no layout breakage — different font metrics can shift line
  wrapping; check the hero title and agenda row titles at a few different
  content lengths (short title, long title that wraps).
- Confirm generated Kotlin/Swift `fontFamily` strings updated with tokens
  (required for `--check`); no native UI font loading or asset bundling.

## Acceptance criteria

- [x] `tokens.json` has both `fontFamily` and `displayFontFamily`.
- [x] `generate.mjs` emits both `--fc-font-family` and
      `--fc-font-family-display`; `--check` passes.
- [x] Fonts load from self-hosted `web/src/fonts/*.woff2` (no Google Fonts 404s).
- [x] Body text uses `--fc-font-family` (Plus Jakarta Sans); Task 4
      headline-scope elements use `fc-display` (Space Grotesk).
- [x] No mobile UI or font-asset changes. Generated `UiTokens.kt` /
      `UiTokens.swift` `fontFamily` string mirrors `tokens.json` so
      `--check` passes; native UI still uses platform defaults.
- [x] Manual smoke test completed, no layout regressions.
