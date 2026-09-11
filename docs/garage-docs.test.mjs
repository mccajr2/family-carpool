#!/usr/bin/env node
/**
 * Fence until garage-capacity (or successor) revive: living docs must not
 * describe garage / FamilyGarageApi / NHTSA-as-current or ship Garage smoke.
 * A dedicated revive slice owns re-adding product docs and replacing these
 * asserts.
 */
import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")
const architecture = readFileSync(join(root, "docs/architecture.md"), "utf8")
const readme = readFileSync(join(root, "README.md"), "utf8")

test("architecture.md does not lock live garage / FamilyGarageApi / NHTSA", () => {
  assert.doesNotMatch(architecture, /FamilyGarageApi/)
  assert.doesNotMatch(architecture, /Circle garage \(detail\)/)
  assert.doesNotMatch(architecture, /More \/ Settings → \*\*Garage\*\*/)
  assert.doesNotMatch(architecture, /\/api\/family\/circle\/garage/)
  // NHTSA / vPIC must not appear as current product wiring
  assert.doesNotMatch(architecture, /VpicPort/)
  assert.doesNotMatch(architecture, /clients never call NHTSA/)
  assert.doesNotMatch(architecture, /server-side vPIC/)
  assert.match(architecture, /garage-capacity/)
  assert.match(architecture, /Circle garage \(retired\)/)
})

test("architecture.md locks empty-body Accept without drives/vehicle gates", () => {
  assert.match(architecture, /empty.?body/i)
  assert.doesNotMatch(architecture, /Accept needs `drives=true`/)
  assert.doesNotMatch(
    architecture,
    /remaining = vehicle\.seats|vehicle with enough remaining seats/,
  )
})

test("README has no Garage / garage-API smoke", () => {
  assert.doesNotMatch(readme, /Garage smoke/)
  assert.doesNotMatch(readme, /\/api\/family\/circle\/garage/)
  assert.doesNotMatch(readme, /More \/ Settings → Garage/)
  assert.doesNotMatch(readme, /"drives":false/)
  assert.doesNotMatch(readme, /vehicleId/)
})
