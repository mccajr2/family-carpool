import { describe, expect, it } from "vitest"
import { coerceEndsAfterStart, validateManualEventTimes } from "./eventTimes"

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
