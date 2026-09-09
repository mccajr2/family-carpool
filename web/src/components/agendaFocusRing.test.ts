import { describe, expect, it } from "vitest"

import {
  formatHeroCountdownRing,
  formatHeroDaysRing,
  formatRingCountdown,
  heroDaysRingFromStartsAt,
  heroDaysUntilEvent,
  minutesUntilEvent,
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

describe("minutesUntilEvent", () => {
  const now = new Date(2030, 7, 28, 12, 0, 0)

  it("returns whole minutes until start", () => {
    const in45 = new Date(2030, 7, 28, 12, 45, 0).toISOString()
    expect(minutesUntilEvent(in45, now)).toBe(45)
    const in3h = new Date(2030, 7, 28, 15, 0, 0).toISOString()
    expect(minutesUntilEvent(in3h, now)).toBe(180)
  })

  it("floors at zero and returns null for invalid ISO", () => {
    const past = new Date(2030, 7, 28, 11, 0, 0).toISOString()
    expect(minutesUntilEvent(past, now)).toBe(0)
    expect(minutesUntilEvent("not-a-date", now)).toBeNull()
  })
})

describe("formatHeroCountdownRing", () => {
  const now = new Date(2030, 7, 28, 12, 0, 0)

  it("steps down from days to hours to minutes", () => {
    const in2Days = new Date(2030, 7, 30, 12, 0, 0).toISOString()
    expect(formatHeroCountdownRing(in2Days, now)).toEqual({ label: "2", unit: "DAYS" })

    const in5Hours = new Date(2030, 7, 28, 17, 0, 0).toISOString()
    expect(formatHeroCountdownRing(in5Hours, now)).toEqual({ label: "5", unit: "HR" })

    const in20Min = new Date(2030, 7, 28, 12, 20, 0).toISOString()
    expect(formatHeroCountdownRing(in20Min, now)).toEqual({ label: "20", unit: "MIN" })
  })

  it("does not show 0 DAYS for a same-day event still hours away", () => {
    const laterToday = new Date(2030, 7, 28, 20, 0, 0).toISOString()
    const ring = formatHeroCountdownRing(laterToday, now)
    expect(ring.unit).toBe("HR")
    expect(ring.label).toBe("8")
  })
})

describe("hero carousel days ring (legacy calendar-day helpers)", () => {
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
