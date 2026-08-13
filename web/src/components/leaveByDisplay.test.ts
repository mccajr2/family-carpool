import { describe, expect, it } from "vitest"
import {
  agendaLeaveByLine,
  formatLeaveByEstimateLine,
  formatLeaveByTime,
  LEAVE_BY_PENDING_LABEL,
  leaveByUnavailableLabel,
} from "./leaveByDisplay"

describe("formatLeaveByEstimateLine", () => {
  it("labels leave-by as an estimate with a tilde time", () => {
    const line = formatLeaveByEstimateLine("2026-08-15T15:25:00Z")
    expect(line).toMatch(/^Leave by ~/)
    expect(line).toMatch(/ · estimate$/)
    expect(line.toLowerCase()).not.toMatch(/\beta\b/)
    expect(line.toLowerCase()).not.toContain("live traffic")
    expect(line.toLowerCase()).not.toContain("live-traffic")
    expect(formatLeaveByTime("2026-08-15T15:25:00Z")).not.toMatch(/T15:25/)
  })
})

describe("leaveByUnavailableLabel", () => {
  it("maps machine reasons to short copy", () => {
    expect(leaveByUnavailableLabel("NO_ORIGIN")).toBe("No leave-from place yet")
    expect(leaveByUnavailableLabel("NO_DESTINATION")).toBe(
      "Add a location to estimate leave-by",
    )
    expect(leaveByUnavailableLabel("GEOCODE_FAILED")).toBe(
      "Couldn't locate the destination",
    )
    expect(leaveByUnavailableLabel(null)).toBe("Leave-by estimate unavailable")
  })
})

describe("agendaLeaveByLine", () => {
  it("shows focused pending copy without blanking other leave-by states", () => {
    expect(
      agendaLeaveByLine({
        leaveByStatus: "PENDING",
        leaveByAt: null,
        leaveByReason: null,
      }),
    ).toBe(LEAVE_BY_PENDING_LABEL)
    expect(LEAVE_BY_PENDING_LABEL).toBe("Estimating leave-by…")
    expect(
      agendaLeaveByLine({
        leaveByStatus: "OK",
        leaveByAt: "2026-08-15T15:25:00Z",
        leaveByReason: null,
      }),
    ).toMatch(/^Leave by ~/)
    expect(
      agendaLeaveByLine({
        leaveByStatus: "UNAVAILABLE",
        leaveByAt: null,
        leaveByReason: "NO_DESTINATION",
      }),
    ).toBe("Add a location to estimate leave-by")
  })
})
