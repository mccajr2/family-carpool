#!/usr/bin/env node
import { spawnSync } from "node:child_process"
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
})

test("tokens.json declares light and dark color roles and icons", async () => {
  const { readFileSync } = await import("node:fs")
  const tokens = JSON.parse(readFileSync(join(__dirname, "tokens.json"), "utf8"))
  assert.equal(tokens.meta.provisional, true)
  for (const role of [
    "accent",
    "danger",
    "success",
    "surface",
    "surfaceRaised",
    "border",
    "textPrimary",
    "textSecondary",
  ]) {
    assert.ok(tokens.color.light[role], `missing light.${role}`)
    assert.ok(tokens.color.dark[role], `missing dark.${role}`)
  }
  assert.ok(tokens.spacing.md)
  assert.ok(tokens.radius.md)
  assert.ok(tokens.typography.scale.body)
  assert.ok(tokens.icons.includes("icon.places"))
  assert.ok(tokens.icons.includes("icon.feeds"))
  assert.ok(tokens.icons.includes("icon.signout"))
})
