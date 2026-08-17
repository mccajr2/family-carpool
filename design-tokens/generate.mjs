#!/usr/bin/env node
/**
 * Generates platform token files from design-tokens/tokens.json.
 * No npm dependencies — Node stdlib only.
 *
 * Usage:
 *   node design-tokens/generate.mjs          # write outputs
 *   node design-tokens/generate.mjs --check  # exit 1 if outputs drift
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs"
import { dirname, join, relative } from "node:path"
import { fileURLToPath } from "node:url"
import { createHash } from "node:crypto"

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, "..")
const tokensPath = join(__dirname, "tokens.json")
const checkOnly = process.argv.includes("--check")

const tokens = JSON.parse(readFileSync(tokensPath, "utf8"))

const GENERATED_BANNER =
  "Generated from design-tokens/tokens.json — do not edit by hand. Run: node design-tokens/generate.mjs"

function kebabToCamel(key) {
  return key.replace(/-([a-z])/g, (_, c) => c.toUpperCase()).replace(/^(\d)/, "_$1")
}

function iconConstName(name) {
  // icon.places -> places
  const leaf = name.includes(".") ? name.split(".").pop() : name
  return leaf.replace(/-([a-z])/g, (_, c) => c.toUpperCase())
}

function cssColorBlock(vars, indent = "  ") {
  const lines = []
  for (const [k, v] of Object.entries(vars)) {
    lines.push(
      `${indent}--fc-${k.replace(/([A-Z])/g, "-$1").toLowerCase()}: ${v};`,
    )
  }
  return lines
}

function cssFromTokens(t) {
  const light = t.color.light
  const dark = t.color.dark
  const shared = []
  for (const [k, v] of Object.entries(t.spacing)) {
    shared.push(`  --fc-space-${k}: ${v}px;`)
  }
  for (const [k, v] of Object.entries(t.radius)) {
    shared.push(`  --fc-radius-${k}: ${v}px;`)
  }
  for (const [k, scale] of Object.entries(t.typography.scale)) {
    shared.push(`  --fc-font-${k}-size: ${scale.size}px;`)
    shared.push(`  --fc-font-${k}-line: ${scale.lineHeight}px;`)
    shared.push(`  --fc-font-${k}-weight: ${scale.weight};`)
  }
  shared.push(
    `  --fc-font-family: ${t.typography.fontFamily}, system-ui, sans-serif;`,
    `  --fc-font-family-display: ${t.typography.displayFontFamily}, system-ui, sans-serif;`,
  )

  const lines = [
    `/* ${GENERATED_BANNER} */`,
    "",
    ":root {",
    ...cssColorBlock(light),
    ...shared,
    "}",
    "",
    '.dark, [data-theme="dark"] {',
    ...cssColorBlock(dark),
    "}",
    "",
    "@media (prefers-color-scheme: dark) {",
    '  :root:not([data-theme="light"]) {',
    ...cssColorBlock(dark, "    "),
    "  }",
    "}",
    "",
  ]
  return lines.join("\n")
}

function kotlinFromTokens(t) {
  const lines = [
    `// ${GENERATED_BANNER}`,
    "package org.example.project.ui",
    "",
    "/** Shared design tokens (light / dark color roles, spacing, radius, type, icons). */",
    "object UiTokens {",
    "    data class ColorRoles(",
  ]
  const colorKeys = Object.keys(t.color.light)
  for (const k of colorKeys) {
    const comma = k === colorKeys[colorKeys.length - 1] ? "" : ","
    lines.push(`        val ${k}: String${comma}`)
  }
  lines.push("    )")
  lines.push("")
  lines.push("    object Color {")
  lines.push("        val light = ColorRoles(")
  for (const k of colorKeys) {
    const comma = k === colorKeys[colorKeys.length - 1] ? "" : ","
    lines.push(`            ${k} = "${t.color.light[k]}"${comma}`)
  }
  lines.push("        )")
  lines.push("        val dark = ColorRoles(")
  for (const k of colorKeys) {
    const comma = k === colorKeys[colorKeys.length - 1] ? "" : ","
    lines.push(`            ${k} = "${t.color.dark[k]}"${comma}`)
  }
  lines.push("        )")
  lines.push("    }")
  lines.push("")
  lines.push("    object Space {")
  for (const [k, v] of Object.entries(t.spacing)) {
    lines.push(`        const val ${kebabToCamel(k)}: Int = ${v}`)
  }
  lines.push("    }")
  lines.push("")
  lines.push("    object Radius {")
  for (const [k, v] of Object.entries(t.radius)) {
    lines.push(`        const val ${kebabToCamel(k)}: Int = ${v}`)
  }
  lines.push("    }")
  lines.push("")
  lines.push("    data class TypeScale(val size: Int, val lineHeight: Int, val weight: String)")
  lines.push("")
  lines.push("    object Type {")
  for (const [k, scale] of Object.entries(t.typography.scale)) {
    lines.push(
      `        val ${k} = TypeScale(size = ${scale.size}, lineHeight = ${scale.lineHeight}, weight = "${scale.weight}")`,
    )
  }
  lines.push(`        const val fontFamily: String = "${t.typography.fontFamily}"`)
  lines.push("    }")
  lines.push("")
  lines.push("    /** Semantic icon names — map to Material Icons / Symbols in UI code. */")
  lines.push("    object Icon {")
  for (const name of t.icons) {
    lines.push(`        const val ${iconConstName(name)}: String = "${name}"`)
  }
  lines.push("    }")
  lines.push("}")
  lines.push("")
  return lines.join("\n")
}

function swiftFromTokens(t) {
  const lines = [
    `// ${GENERATED_BANNER}`,
    "import Foundation",
    "import CoreGraphics",
    "#if canImport(SwiftUI)",
    "import SwiftUI",
    "#endif",
    "",
    "enum UiTokens {",
    "    struct ColorRoles: Equatable {",
  ]
  const colorKeys = Object.keys(t.color.light)
  for (const k of colorKeys) {
    lines.push(`        let ${k}: String`)
  }
  lines.push("    }")
  lines.push("")
  lines.push("    enum Color {")
  lines.push("        static let light = ColorRoles(")
  for (let i = 0; i < colorKeys.length; i++) {
    const k = colorKeys[i]
    const comma = i === colorKeys.length - 1 ? "" : ","
    lines.push(`            ${k}: "${t.color.light[k]}"${comma}`)
  }
  lines.push("        )")
  lines.push("        static let dark = ColorRoles(")
  for (let i = 0; i < colorKeys.length; i++) {
    const k = colorKeys[i]
    const comma = i === colorKeys.length - 1 ? "" : ","
    lines.push(`            ${k}: "${t.color.dark[k]}"${comma}`)
  }
  lines.push("        )")
  lines.push("    }")
  lines.push("")
  lines.push("    enum Space {")
  for (const [k, v] of Object.entries(t.spacing)) {
    lines.push(`        static let ${kebabToCamel(k)}: CGFloat = ${v}`)
  }
  lines.push("    }")
  lines.push("")
  lines.push("    enum Radius {")
  for (const [k, v] of Object.entries(t.radius)) {
    lines.push(`        static let ${kebabToCamel(k)}: CGFloat = ${v}`)
  }
  lines.push("    }")
  lines.push("")
  lines.push("    struct TypeScale: Equatable {")
  lines.push("        let size: CGFloat")
  lines.push("        let lineHeight: CGFloat")
  lines.push("        let weight: String")
  lines.push("    }")
  lines.push("")
    lines.push("    enum Typography {")
  for (const [k, scale] of Object.entries(t.typography.scale)) {
    lines.push(
      `        static let ${k} = TypeScale(size: ${scale.size}, lineHeight: ${scale.lineHeight}, weight: "${scale.weight}")`,
    )
  }
  lines.push(`        static let fontFamily: String = "${t.typography.fontFamily}"`)
  lines.push("    }")
  lines.push("")
  lines.push("    /// Semantic icon names — map to SF Symbols in UI code.")
  lines.push("    enum Icon {")
  for (const name of t.icons) {
    lines.push(`        static let ${iconConstName(name)}: String = "${name}"`)
  }
  lines.push("    }")
  lines.push("}")
  lines.push("")
  lines.push("#if canImport(SwiftUI)")
  lines.push("extension UiTokens {")
  lines.push("    static func swiftUIColor(hex: String) -> SwiftUI.Color {")
  lines.push("        let cleaned = hex.trimmingCharacters(in: CharacterSet(charactersIn: \"#\"))")
  lines.push("        var value: UInt64 = 0")
  lines.push("        Scanner(string: cleaned).scanHexInt64(&value)")
  lines.push("        let r = Double((value >> 16) & 0xFF) / 255.0")
  lines.push("        let g = Double((value >> 8) & 0xFF) / 255.0")
  lines.push("        let b = Double(value & 0xFF) / 255.0")
  lines.push("        return SwiftUI.Color(red: r, green: g, blue: b)")
  lines.push("    }")
  lines.push("}")
  lines.push("#endif")
  lines.push("")
  return lines.join("\n")
}

const outputs = [
  {
    path: join(root, "web/src/styles/tokens.generated.css"),
    content: cssFromTokens(tokens),
  },
  {
    path: join(
      root,
      "mobile/sharedUI/src/commonMain/kotlin/org/example/project/ui/UiTokens.kt",
    ),
    content: kotlinFromTokens(tokens),
  },
  {
    path: join(root, "mobile/iosApp/iosApp/UiTokens.swift"),
    content: swiftFromTokens(tokens),
  },
]

function hash(text) {
  return createHash("sha256").update(text).digest("hex")
}

let drifted = false
for (const out of outputs) {
  const rel = relative(root, out.path)
  let existing = null
  try {
    existing = readFileSync(out.path, "utf8")
  } catch {
    existing = null
  }
  if (checkOnly) {
    if (existing === null || hash(existing) !== hash(out.content)) {
      console.error(`DRIFT: ${rel}`)
      drifted = true
    } else {
      console.log(`OK: ${rel}`)
    }
    continue
  }
  mkdirSync(dirname(out.path), { recursive: true })
  writeFileSync(out.path, out.content, "utf8")
  console.log(`Wrote ${rel}`)
}

if (checkOnly && drifted) {
  console.error("Token outputs are out of date. Run: node design-tokens/generate.mjs")
  process.exit(1)
}

if (checkOnly) {
  console.log("Token outputs match design-tokens/tokens.json")
}
