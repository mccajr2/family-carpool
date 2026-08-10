import { describe, expect, it } from "vitest"
import {
  coerceEndsAfterStart,
  calendarSourceLabel,
  defaultCalendarWindow,
  formatEventWhen,
  formatIsoForDisplay,
  validateManualEventTimes,
} from "./eventTimes"

describe("validateManualEventTimes", () => {
  const now = Date.parse("2026-08-15T12:00:00")

  it("rejects past start and end before start", () => {
    expect(validateManualEventTimes("2026-08-15T11:00", "", now)).toBe(
      "Start must be in the future",
    )
    expect(
      validateManualEventTimes("2026-08-15T13:00", "2026-08-15T12:30", now),
    ).toBe("End must be on or after start")
    expect(
      validateManualEventTimes("2026-08-15T13:00", "2026-08-15T14:00", now),
    ).toBeNull()
  })
})

describe("coerceEndsAfterStart", () => {
  it("clears ends when before start", () => {
    expect(coerceEndsAfterStart("2026-08-15T14:00", "2026-08-15T13:00")).toBe("")
    expect(coerceEndsAfterStart("2026-08-15T14:00", "2026-08-15T15:00")).toBe(
      "2026-08-15T15:00",
    )
  })
})

describe("formatIsoForDisplay", () => {
  it("formats ISO instants like iOS medium date and short time", () => {
    const label = formatIsoForDisplay("2026-08-12T16:30:00Z")
    expect(label).toMatch(/Aug 12, 2026 at /)
    expect(label).not.toMatch(/T16:30/)
  })

  it("joins start and end with an arrow", () => {
    expect(formatEventWhen("2026-08-12T16:30:00Z", "2026-08-12T21:30:00Z")).toMatch(
      /Aug 12, 2026 at .+ → Aug 12, 2026 at .+/,
    )
  })
})

describe("defaultCalendarWindow", () => {
  it("spans local midnight today through plus 30 days", () => {
    const now = new Date("2026-08-10T15:30:00")
    const { from, to } = defaultCalendarWindow(now)
    const fromDate = new Date(from)
    const toDate = new Date(to)
    expect(fromDate.getHours()).toBe(0)
    expect(fromDate.getMinutes()).toBe(0)
    expect((toDate.getTime() - fromDate.getTime()) / (24 * 60 * 60 * 1000)).toBe(30)
  })
})

describe("calendarSourceLabel", () => {
  it("labels feed and manual sources", () => {
    expect(calendarSourceLabel("MANUAL", null)).toBe("Manual")
    expect(calendarSourceLabel("FEED", "U12")).toBe("U12")
    expect(calendarSourceLabel("FEED", "  ")).toBe("Feed")
  })
})
