#!/usr/bin/env node
/**
 * WCAG AA contrast for More reference surface pairings (cross-platform-ui-system).
 * Body text ≥ 4.5:1; large text / icons ≥ 3:1.
 */
import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import test from "node:test"
import assert from "node:assert/strict"

const __dirname = dirname(fileURLToPath(import.meta.url))
const tokens = JSON.parse(readFileSync(join(__dirname, "tokens.json"), "utf8"))

function srgbChannel(c) {
  const v = c / 255
  return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)
}

function relativeLuminance(hex) {
  const cleaned = hex.replace("#", "")
  const n = Number.parseInt(cleaned, 16)
  const r = (n >> 16) & 0xff
  const g = (n >> 8) & 0xff
  const b = n & 0xff
  return 0.2126 * srgbChannel(r) + 0.7152 * srgbChannel(g) + 0.0722 * srgbChannel(b)
}

function contrastRatio(fg, bg) {
  const L1 = relativeLuminance(fg)
  const L2 = relativeLuminance(bg)
  const lighter = Math.max(L1, L2)
  const darker = Math.min(L1, L2)
  return (lighter + 0.05) / (darker + 0.05)
}

/** Pairings used on More: body/caption on surface; danger on surface; accent chip icon on tinted chip approx accent-on-surface. */
function morePairings(scheme) {
  const c = tokens.color[scheme]
  return [
    { name: "textPrimary on surface", fg: c.textPrimary, bg: c.surface, min: 4.5 },
    { name: "textSecondary on surface", fg: c.textSecondary, bg: c.surface, min: 4.5 },
    { name: "textPrimary on surfaceRaised", fg: c.textPrimary, bg: c.surfaceRaised, min: 4.5 },
    { name: "textSecondary on surfaceRaised", fg: c.textSecondary, bg: c.surfaceRaised, min: 4.5 },
    { name: "danger on surface", fg: c.danger, bg: c.surface, min: 4.5 },
    { name: "danger on surfaceRaised", fg: c.danger, bg: c.surfaceRaised, min: 4.5 },
    // Large text / icons (≥3:1): accent icon on surface
    { name: "accent on surface (icon)", fg: c.accent, bg: c.surface, min: 3 },
    { name: "accent on surfaceRaised (icon)", fg: c.accent, bg: c.surfaceRaised, min: 3 },
  ]
}

for (const scheme of ["light", "dark"]) {
  test(`More WCAG AA pairings (${scheme})`, () => {
    for (const p of morePairings(scheme)) {
      const ratio = contrastRatio(p.fg, p.bg)
      assert.ok(
        ratio >= p.min,
        `${scheme} ${p.name}: ${ratio.toFixed(2)}:1 < ${p.min}:1 (${p.fg} on ${p.bg})`,
      )
    }
  })
}
