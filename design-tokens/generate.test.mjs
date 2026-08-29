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
  assert.match(css, /--fc-space-rail-x: 20px;/)
  assert.match(css, /--fc-space-rail-y: 28px;/)
  assert.match(css, /--fc-space-main-x: 44px;/)
  assert.match(css, /--fc-space-main-y: 36px;/)
  assert.match(css, /--fc-space-focus-ring: 88px;/)
  assert.match(css, /--fc-space-focus-ring-covering-gap: 10px;/)
  assert.match(css, /--fc-font-focus-title-size: 30px;/)
  assert.match(css, /--fc-font-focus-title-weight: 700;/)
  assert.match(css, /--fc-font-focus-when-weight: 600;/)
  assert.match(css, /--fc-font-focus-status-pill-size: 12.5px;/)
  assert.match(css, /--fc-font-filter-chip-size: 13.5px;/)
  assert.match(css, /--fc-space-filter-chip-gap: 8px;/)
  assert.match(css, /--fc-space-list-row-avatar: 26px;/)
  assert.match(css, /--fc-font-list-row-chevron-size: 18px;/)
  assert.match(css, /--fc-font-focus-ring-unit-weight: 600;/)
  assert.match(css, /--fc-font-feed-name-size: 16.5px;/)
  assert.match(css, /--fc-font-feed-chip-size: 11px;/)
  assert.match(css, /--fc-font-feed-submit-size: 14.5px;/)
  assert.match(css, /--fc-space-feed-card-pad-y: 18px;/)
  assert.match(css, /--fc-space-feed-card-pad-x: 20px;/)
  assert.match(css, /--fc-space-feed-chip-pad-y: 4px;/)
  assert.match(css, /--fc-space-feed-chip-pad-x: 10px;/)
  assert.match(css, /--fc-space-feed-form-pad: 22px;/)
  assert.match(css, /--fc-space-feed-meta-gap: 3px;/)
  assert.match(css, /--fc-font-week-glance-title-size: 16px;/)
  assert.match(css, /--fc-font-week-glance-title-weight: 700;/)
  assert.match(css, /--fc-font-week-day-size: 12px;/)
  assert.match(css, /--fc-font-week-day-weight: 700;/)
  assert.match(css, /--fc-font-week-count-size: 13px;/)
  assert.match(css, /--fc-font-week-count-weight: 600;/)
  assert.match(css, /--fc-font-week-count-calm-size: 13px;/)
  assert.match(css, /--fc-font-week-count-calm-weight: 500;/)
  assert.match(css, /--fc-space-week-glance-pad-x: 28px;/)
  assert.match(css, /--fc-space-week-item-pad-y: 10px;/)
  assert.match(css, /--fc-space-week-day-width: 38px;/)
  assert.match(css, /--fc-space-week-flag: 7px;/)
  assert.match(css, /--fc-hero-glow: radial-gradient\(120% 140% at 85% 0%, #2A2E63 0%, #11131C 55%\);/)
  assert.match(css, /--fc-hero-ring: #E3A15B;/)
  assert.match(css, /--fc-hero-most-urgent-badge: rgba\(227,161,91,0.18\);/)
  assert.match(css, /--fc-hero-carousel-dot-inactive: #C9C6BC;/)
  assert.match(css, /--fc-hero-carousel-control-bg: #ECEBE6;/)
  assert.match(css, /--fc-hero-decline-bg: rgba\(255,255,255,0.12\);/)
  assert.match(css, /--fc-space-hero-carousel-gap: 16px;/)
  assert.match(css, /--fc-space-hero-carousel-slide-max: 640px;/)
  assert.match(css, /--fc-space-hero-carousel-slide-vw: 84px;/)
  assert.match(css, /--fc-space-hero-slide-pad: 28px;/)
  assert.match(css, /--fc-space-hero-empty-pad: 32px;/)
  assert.match(css, /--fc-space-hero-carousel-dot-active-w: 18px;/)
  assert.match(css, /--fc-space-hero-carousel-dot-h: 7px;/)
  assert.doesNotMatch(css, /--fc-space-railX:/)
  assert.doesNotMatch(css, /--fc-font-focusTitle-size/)
  const kotlin = readFileSync(
    join(__dirname, "..", "mobile/sharedUI/src/commonMain/kotlin/org/example/project/ui/UiTokens.kt"),
    "utf8",
  )
  assert.match(kotlin, /data class TypeScale\(val size: Float/)
  assert.match(kotlin, /val focusTitle = TypeScale\(size = 30f/)
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
    "heroGlow",
    "heroRing",
    "heroMostUrgentBadge",
    "heroCarouselDotInactive",
    "heroCarouselControlBg",
    "heroDeclineBg",
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
  assert.ok(tokens.typography.scale.page)
  assert.equal(tokens.typography.scale.page.size, 34)
  assert.ok(tokens.typography.scale.subtitle)
  assert.equal(tokens.typography.scale.subtitle.size, 14)
  assert.equal(tokens.typography.scale.subtitle.weight, "500")
  assert.equal(tokens.spacing.header, 26)
  assert.equal(tokens.spacing.mainY, 36)
  assert.equal(tokens.spacing.mainX, 44)
  assert.equal(tokens.spacing.railY, 28)
  assert.equal(tokens.spacing.railX, 20)
  assert.equal(tokens.spacing.focusRing, 88)
  assert.equal(tokens.spacing.focusRingStroke, 6)
  assert.equal(tokens.spacing.focusRingCoveringGap, 10)
  assert.equal(tokens.spacing.focusTitleGap, 6)
  assert.equal(tokens.spacing.focusStatusDot, 6)
  assert.equal(tokens.typography.scale.focusWhen.size, 15)
  assert.equal(tokens.typography.scale.focusWhen.weight, "600")
  assert.equal(tokens.typography.scale.focusTitle.size, 30)
  assert.equal(tokens.typography.scale.focusTitle.weight, "700")
  assert.equal(tokens.typography.scale.focusRingLabel.size, 16)
  assert.equal(tokens.typography.scale.focusRingUnit.size, 9.5)
  assert.equal(tokens.typography.scale.focusRingUnit.weight, "600")
  assert.equal(tokens.typography.scale.focusStatusPill.size, 12.5)
  assert.equal(tokens.typography.scale.focusStatusPill.weight, "600")
  assert.equal(tokens.typography.scale.focusCovering.weight, "600")
  assert.equal(tokens.typography.scale.focusAction.weight, "700")
  assert.equal(tokens.typography.scale.focusActionGhost.weight, "600")
  assert.equal(tokens.typography.scale.statusChip.size, 11)
  assert.equal(tokens.typography.scale.feedName.size, 16.5)
  assert.equal(tokens.typography.scale.feedName.weight, "700")
  assert.equal(tokens.typography.scale.feedMeta.size, 12.5)
  assert.equal(tokens.typography.scale.feedSectionLabel.size, 12)
  assert.equal(tokens.typography.scale.feedSectionLabel.weight, "700")
  assert.equal(tokens.typography.scale.feedChip.size, 11)
  assert.equal(tokens.typography.scale.feedChip.weight, "700")
  assert.equal(tokens.typography.scale.feedAction.size, 13.5)
  assert.equal(tokens.typography.scale.feedAction.weight, "700")
  assert.equal(tokens.typography.scale.feedFieldLabel.weight, "600")
  assert.equal(tokens.typography.scale.feedInput.size, 14)
  assert.equal(tokens.typography.scale.feedKidChip.size, 13.5)
  assert.equal(tokens.typography.scale.feedSubmit.size, 14.5)
  assert.equal(tokens.spacing.feedCardPadY, 18)
  assert.equal(tokens.spacing.feedCardPadX, 20)
  assert.equal(tokens.spacing.feedListGap, 12)
  assert.equal(tokens.spacing.feedListMarginBottom, 28)
  assert.equal(tokens.spacing.feedMetaGap, 3)
  assert.equal(tokens.spacing.feedChipPadY, 4)
  assert.equal(tokens.spacing.feedChipPadX, 10)
  assert.equal(tokens.spacing.feedActionsPadTop, 14)
  assert.equal(tokens.spacing.feedCtaGap, 10)
  assert.equal(tokens.spacing.feedActionPadY, 10)
  assert.equal(tokens.spacing.feedFormPad, 22)
  assert.equal(tokens.spacing.feedInputPadY, 11)
  assert.equal(tokens.spacing.feedKidChipGap, 7)
  assert.equal(tokens.spacing.feedSubmitPadY, 13)
  assert.equal(tokens.typography.scale.weekGlanceTitle.size, 16)
  assert.equal(tokens.typography.scale.weekGlanceTitle.weight, "700")
  assert.equal(tokens.typography.scale.weekDay.size, 12)
  assert.equal(tokens.typography.scale.weekDay.weight, "700")
  assert.equal(tokens.typography.scale.weekCount.size, 13)
  assert.equal(tokens.typography.scale.weekCount.weight, "600")
  assert.equal(tokens.typography.scale.weekCountCalm.size, 13)
  assert.equal(tokens.typography.scale.weekCountCalm.weight, "500")
  assert.equal(tokens.spacing.weekGlancePadX, 28)
  assert.equal(tokens.spacing.weekItemPadY, 10)
  assert.equal(tokens.spacing.weekDayWidth, 38)
  assert.equal(tokens.spacing.weekFlag, 7)
  assert.equal(tokens.spacing.heroCarouselGap, 16)
  assert.equal(tokens.spacing.heroCarouselSlideMax, 640)
  assert.equal(tokens.spacing.heroCarouselSlideVw, 84)
  assert.equal(tokens.spacing.heroSlidePad, 28)
  assert.equal(tokens.spacing.heroEmptyPad, 32)
  assert.equal(tokens.spacing.heroCarouselDotActiveW, 18)
  assert.equal(tokens.spacing.heroCarouselDotH, 7)
  assert.equal(
    tokens.color.light.heroGlow,
    "radial-gradient(120% 140% at 85% 0%, #2A2E63 0%, #11131C 55%)",
  )
  assert.equal(tokens.color.light.heroRing, "#E3A15B")
  assert.equal(tokens.color.light.heroCarouselControlBg, "#ECEBE6")
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
  for (const role of [
    "heroGlow",
    "heroRing",
    "heroMostUrgentBadge",
    "heroCarouselDotInactive",
    "heroCarouselControlBg",
    "heroDeclineBg",
  ]) {
    assert.equal(
      tokens.color.light[role],
      tokens.color.dark[role],
      `hero carousel* must be theme-independent (${role})`,
    )
  }
})

test("agenda-coverage-web-contract records Week at a glance copy", () => {
  const contract = readFileSync(
    join(__dirname, "..", "docs/agenda-coverage-web-contract.md"),
    "utf8",
  )
  assert.match(contract, /^## Week at a glance$/m)
  assert.match(contract, /today \+ the next six local days/)
  assert.match(contract, /1 needs coverage/)
  assert.match(contract, /\{n\} need coverage/)
  assert.match(contract, /1 overlaps/)
  assert.match(contract, /\{n\} overlap/)
  assert.match(contract, /1 to confirm/)
  assert.match(contract, /\{n\} to confirm/)
  assert.match(contract, /in-play events/)
  assert.match(contract, /Do \*\*not\*\* emit \*\*need drivers\*\*/)
})
