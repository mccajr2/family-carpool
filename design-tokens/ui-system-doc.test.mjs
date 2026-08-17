#!/usr/bin/env node
import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")
const doc = readFileSync(join(root, "docs/ui-system.md"), "utf8")

test("ui-system.md documents adopted palette and mock as visual source of truth", () => {
  assert.match(doc, /meta\.provisional/)
  assert.match(doc, /\bfalse\b/)
  assert.match(doc, /lagoon teal/)
  assert.match(doc, /not `hero\*`/)
  assert.match(doc, /source of truth/)
  assert.match(doc, /Do \*\*not\*\* snap/)
  assert.match(doc, /specs\/archive\/cross-platform-ui-system/)
  assert.doesNotMatch(doc, /specs\/active\/cross-platform-ui-system/)
  assert.doesNotMatch(doc, /expected to\s+churn/)
  assert.doesNotMatch(doc, /intake for layout/)
})

test("ui-system.md lists required component parity primitives", () => {
  for (const name of [
    "List row",
    "Grouped section",
    "Card",
    "Button",
    "Badge",
    "Empty state",
    "Modal",
    "Nav container",
  ]) {
    assert.match(doc, new RegExp(name, "i"), `missing primitive: ${name}`)
  }
  assert.match(doc, /primary/i)
  assert.match(doc, /secondary/i)
  assert.match(doc, /danger/i)
  assert.match(doc, /diverge/i)
})

test("ui-system.md documents semantic icons and native mapping", () => {
  for (const icon of [
    "icon.places",
    "icon.garage",
    "icon.feeds",
    "icon.signout",
    "icon.calendar",
    "icon.carpool",
  ]) {
    assert.match(doc, new RegExp(icon.replace(".", "\\.")))
  }
  assert.match(doc, /SF Symbol/i)
  assert.match(doc, /Material/i)
  assert.match(doc, /Lucide/i)
  assert.match(doc, /No\*\*|No shared|shared SVG/i)
})

test("ui-system.md names More as reference and destination follow-up", () => {
  assert.match(doc, /Reference screen:\s*More/i)
  assert.match(doc, /ui-system-destination-adoption/)
  assert.match(doc, /WCAG AA/)
  assert.match(doc, /4\.5:1/)
  assert.match(doc, /design-tokens\/tokens\.json/)
})
