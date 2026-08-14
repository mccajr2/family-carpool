#!/usr/bin/env node
import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")
const architecture = readFileSync(join(root, "docs/architecture.md"), "utf8")
const readme = readFileSync(join(root, "README.md"), "utf8")

test("architecture.md locks garage owner + driver list (not 1:1, place ≠ share)", () => {
  assert.match(architecture, /Circle garage \(detail\)/)
  assert.match(architecture, /FamilyGarageApi/)
  assert.match(architecture, /owner-only/i)
  assert.match(architecture, /not.*1:1 adult/)
  assert.match(architecture, /driverAdultIds/)
  assert.match(architecture, /does \*\*not\*\* imply sharing/)
  assert.match(architecture, /including the driver/)
  assert.match(architecture, /vPIC/)
  assert.match(architecture, /no VIN/i)
  assert.match(architecture, /More \/ Settings → \*\*Garage\*\*/)
})

test("README smoke adds a vehicle, a second driver, and don’t drive", () => {
  assert.match(readme, /Garage smoke/)
  assert.match(readme, /\/api\/family\/circle\/garage\/vehicles/)
  assert.match(readme, /driverAdultIds/)
  assert.match(readme, /\/api\/family\/circle\/garage\/me/)
  assert.match(readme, /"drives":false/)
  assert.match(readme, /never send a VIN/)
})
