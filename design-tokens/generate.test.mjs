#!/usr/bin/env node
import { spawnSync } from "node:child_process"
import { existsSync, readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import test from "node:test"
import assert from "node:assert/strict"

const __dirname = dirname(fileURLToPath(import.meta.url))
const generate = join(__dirname, "generate.mjs")

test("generated token outputs match tokens.json (no drift)", () => {
  const write = spawnSync(process.execPath, [generate], {
    encoding: "utf8",
  })
  assert.equal(write.status, 0, write.stderr || write.stdout)

  const check = spawnSync(process.execPath, [generate, "--check"], {
    encoding: "utf8",
  })
  assert.equal(check.status, 0, check.stderr || check.stdout)
  assert.match(check.stdout, /Token outputs match/)

  const css = readFileSync(join(__dirname, "..", "web/src/styles/tokens.generated.css"), "utf8")
  assert.match(css, /--fc-font-family: Plus Jakarta Sans, system-ui, sans-serif;/)
  assert.match(css, /--fc-font-family-display: Space Grotesk, system-ui, sans-serif;/)
  assert.match(css, /:root \{[\s\S]*--fc-rail-surface: #16181A;/)
  assert.match(css, /\.dark, \[data-theme="dark"\] \{[\s\S]*--fc-rail-surface: #16181A;/)
  assert.match(css, /--fc-rail-on: #FFFFFF;/)
  assert.match(css, /--fc-rail-active: #242832;/)
  assert.match(css, /--fc-rail-accent: #5E6DFF;/)
  assert.match(css, /--fc-rail-danger: #F2994A;/)
})

test("web self-hosts the pairing and defines fc-display", () => {
  const html = readFileSync(join(__dirname, "..", "web/index.html"), "utf8")
  assert.doesNotMatch(html, /fonts\.googleapis\.com|fonts\.gstatic\.com/)
  const css = readFileSync(join(__dirname, "..", "web/src/index.css"), "utf8")
  assert.doesNotMatch(css, /fonts\.googleapis\.com/)
  assert.match(css, /font-family: "Plus Jakarta Sans"/)
  assert.match(css, /font-family: "Space Grotesk"/)
  assert.match(css, /plus-jakarta-sans-latin-400-normal\.woff2/)
  assert.match(css, /space-grotesk-latin-700-normal\.woff2/)
  assert.match(css, /body\s*\{[\s\S]*font-family:\s*var\(--fc-font-family\);/)
  assert.match(css, /\.fc-display\s*\{[\s\S]*font-family:\s*var\(--fc-font-family-display\);/)
  const fontsDir = join(__dirname, "..", "web/src/fonts")
  for (const file of [
    "plus-jakarta-sans-latin-400-normal.woff2",
    "plus-jakarta-sans-latin-700-normal.woff2",
    "space-grotesk-latin-700-normal.woff2",
    "OFL-PlusJakartaSans.txt",
    "OFL-SpaceGrotesk.txt",
  ]) {
    assert.ok(existsSync(join(fontsDir, file)), `missing ${file}`)
  }
})

test("tokens.json declares light and dark color roles and icons", () => {
  const tokens = JSON.parse(readFileSync(join(__dirname, "tokens.json"), "utf8"))
  assert.equal(tokens.meta.provisional, false)
  assert.equal(tokens.color.light.textSecondary, "#686F79")
  assert.equal(tokens.color.light.danger, "#A9590C")
  assert.equal(tokens.color.light.success, "#187D58")
  assert.equal(tokens.color.dark.danger, "#F2994A")
  for (const role of [
    "accent",
    "danger",
    "success",
    "surface",
    "surfaceRaised",
    "border",
    "textPrimary",
    "textSecondary",
    "heroSurface",
    "heroOn",
    "heroOnSecondary",
    "heroDanger",
    "heroSuccess",
    "heroAccent",
    "railSurface",
    "railOn",
    "railOnSecondary",
    "railActive",
    "railAccent",
    "railDanger",
  ]) {
    assert.ok(tokens.color.light[role], `missing light.${role}`)
    assert.ok(tokens.color.dark[role], `missing dark.${role}`)
  }
  assert.ok(tokens.spacing.md)
  assert.ok(tokens.radius.md)
  assert.ok(tokens.radius.xl)
  assert.ok(tokens.typography.scale.body)
  assert.ok(tokens.typography.scale.hero)
  assert.equal(tokens.typography.fontFamily, "Plus Jakarta Sans")
  assert.equal(tokens.typography.displayFontFamily, "Space Grotesk")
  assert.ok(tokens.icons.includes("icon.places"))
  assert.ok(tokens.icons.includes("icon.garage"))
  assert.ok(tokens.icons.includes("icon.feeds"))
  assert.ok(tokens.icons.includes("icon.signout"))
  for (const role of [
    "railSurface",
    "railOn",
    "railOnSecondary",
    "railActive",
    "railAccent",
    "railDanger",
  ]) {
    assert.equal(
      tokens.color.light[role],
      tokens.color.dark[role],
      `rail* must be theme-independent (${role})`,
    )
  }
})
