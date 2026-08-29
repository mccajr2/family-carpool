import { describe, expect, it } from "vitest"

import {
  formatHeroDaysRing,
  formatRingCountdown,
  heroDaysRingFromStartsAt,
  heroDaysUntilEvent,
} from "@/components/agendaFocusRing"

describe("formatRingCountdown", () => {
  it("shows minutes under an hour", () => {
    expect(formatRingCountdown(0)).toEqual({ label: "0", unit: "min" })
    expect(formatRingCountdown(42)).toEqual({ label: "42", unit: "min" })
    expect(formatRingCountdown(59)).toEqual({ label: "59", unit: "min" })
  })

  it("shows hours under a day", () => {
    expect(formatRingCountdown(60)).toEqual({ label: "1", unit: "hr" })
    expect(formatRingCountdown(150)).toEqual({ label: "2h 30", unit: "hr" })
    expect(formatRingCountdown(1439)).toEqual({ label: "23h 59", unit: "hr" })
  })

  it("shows nearest whole day at 24h and beyond", () => {
    expect(formatRingCountdown(1440)).toEqual({ label: "1", unit: "day" })
    expect(formatRingCountdown(236 * 60 + 39)).toEqual({ label: "10", unit: "days" })
  })

  it("shows an em dash only when minutes are unknown", () => {
    expect(formatRingCountdown(null)).toEqual({ label: "—", unit: "" })
  })
})

describe("hero carousel days ring", () => {
  const now = new Date(2030, 7, 28, 12, 0, 0)

  it("counts whole local calendar days until the event", () => {
    const tomorrow = new Date(2030, 7, 29, 17, 0, 0).toISOString()
    expect(heroDaysUntilEvent(tomorrow, now)).toBe(1)
    const sameDay = new Date(2030, 7, 28, 20, 0, 0).toISOString()
    expect(heroDaysUntilEvent(sameDay, now)).toBe(0)
    expect(heroDaysUntilEvent("not-a-date", now)).toBe(0)
  })

  it("formats DAY vs DAYS labels per mock", () => {
    expect(formatHeroDaysRing(0)).toEqual({ label: "0", unit: "DAYS" })
    expect(formatHeroDaysRing(1)).toEqual({ label: "1", unit: "DAY" })
    expect(formatHeroDaysRing(3)).toEqual({ label: "3", unit: "DAYS" })
  })

  it("builds ring copy from startsAt", () => {
    const tomorrow = new Date(2030, 7, 29, 17, 0, 0).toISOString()
    expect(heroDaysRingFromStartsAt(tomorrow, now)).toEqual({ label: "1", unit: "DAY" })
  })
})
