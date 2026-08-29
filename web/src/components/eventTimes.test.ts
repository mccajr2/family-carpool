import { describe, expect, it } from "vitest"
import {
  advanceCalendarWindow,
  coerceEndsAfterStart,
  calendarSourceLabel,
  calendarWindowThrough,
  defaultCalendarWindow,
  ensureCalendarWindowCovers,
  formatEventWhen,
  filterCalendarItemsInWindow,
  formatFocusEventWhen,
  formatIsoForDisplay,
  formatLocalTodayLabel,
  LEAVE_BY_NEAR_TERM_DAYS,
  mergeCalendarItems,
  nearTermLeaveByWindow,
  remainderAfterNearTermLeaveByWindow,
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

describe("formatFocusEventWhen", () => {
  const now = new Date(2026, 7, 17, 12, 0, 0)

  it("uses a compact time range with no date when the event is today", () => {
    const start = new Date(2026, 7, 17, 12, 20).toISOString()
    const end = new Date(2026, 7, 17, 18, 20).toISOString()
    expect(formatFocusEventWhen(start, end, now)).toMatch(/^\d{1,2}:\d{2} [AP]M – \d{1,2}:\d{2} [AP]M$/)
    expect(formatFocusEventWhen(start, end, now)).not.toMatch(/2026/)
    expect(formatFocusEventWhen(start, end, now)).not.toContain("→")
  })

  it("prefixes a short date when the event is not today", () => {
    const start = new Date(2026, 7, 21, 17, 30).toISOString()
    const end = new Date(2026, 7, 21, 18, 30).toISOString()
    expect(formatFocusEventWhen(start, end, now)).toMatch(/Aug 21, \d{1,2}:\d{2} [AP]M – \d{1,2}:\d{2} [AP]M/)
  })
})

describe("formatLocalTodayLabel", () => {
  it("uses weekday long, month long, and day numeric with no year", () => {
    const now = new Date(2026, 7, 13)
    const label = formatLocalTodayLabel(now)
    expect(label).toBe(
      now.toLocaleDateString(undefined, {
        weekday: "long",
        month: "long",
        day: "numeric",
      }),
    )
    expect(label).not.toMatch(/\d{4}/)
  })
})

describe("defaultCalendarWindow", () => {
  it("spans local midnight today through plus 14 days", () => {
    const now = new Date("2026-08-10T15:30:00")
    const { from, to } = defaultCalendarWindow(now)
    const fromDate = new Date(from)
    const toDate = new Date(to)
    expect(fromDate.getHours()).toBe(0)
    expect(fromDate.getMinutes()).toBe(0)
    expect((toDate.getTime() - fromDate.getTime()) / (24 * 60 * 60 * 1000)).toBe(14)
  })
})

describe("advanceCalendarWindow", () => {
  it("pages forward from the previous exclusive end", () => {
    const first = defaultCalendarWindow(new Date("2026-08-10T15:30:00"))
    const second = advanceCalendarWindow(first.to)
    expect(second.from).toBe(first.to)
    expect(
      (new Date(second.to).getTime() - new Date(second.from).getTime()) / (24 * 60 * 60 * 1000),
    ).toBe(30)
  })
})

describe("calendarWindowThrough", () => {
  it("keeps loaded to and resets from to local today", () => {
    const loadedTo = defaultCalendarWindow(new Date("2026-08-10T15:30:00")).to
    const window = calendarWindowThrough(loadedTo, new Date("2026-08-12T18:00:00"))
    expect(window.to).toBe(loadedTo)
    expect(new Date(window.from).getHours()).toBe(0)
  })
})

describe("near-term leave-by windows", () => {
  it("slices local today plus two days then the remainder of the loaded window", () => {
    const now = new Date("2026-08-13T18:00:00")
    const loaded = defaultCalendarWindow(now)
    const near = nearTermLeaveByWindow(loaded.from, loaded.to, now)!
    const rest = remainderAfterNearTermLeaveByWindow(loaded.from, loaded.to, now)!
    expect(near.from).toBe(loaded.from)
    expect(
      (new Date(near.to).getTime() - new Date(near.from).getTime()) /
        (24 * 60 * 60 * 1000),
    ).toBe(LEAVE_BY_NEAR_TERM_DAYS)
    expect(rest.from).toBe(near.to)
    expect(rest.to).toBe(loaded.to)
  })

  it("returns null remainder when the loaded window is only near-term", () => {
    const now = new Date("2026-08-13T18:00:00")
    const near = advanceCalendarWindow(
      defaultCalendarWindow(now).from,
      LEAVE_BY_NEAR_TERM_DAYS,
    )
    expect(nearTermLeaveByWindow(near.from, near.to, now)).toEqual(near)
    expect(remainderAfterNearTermLeaveByWindow(near.from, near.to, now)).toBeNull()
  })
})

describe("ensureCalendarWindowCovers", () => {
  it("extends loaded to until the instant is inside the window", () => {
    const first = defaultCalendarWindow(new Date("2026-08-10T12:00:00"))
    const far = "2026-11-01T17:00:00.000Z"
    const covered = ensureCalendarWindowCovers(first.to, far)
    expect(far < covered).toBe(true)
    expect(covered > first.to).toBe(true)
  })
})

describe("filterCalendarItemsInWindow", () => {
  it("keeps items in the half-open [from, to) window", () => {
    const items = [
      { startsAt: "2026-08-14T12:00:00Z" },
      { startsAt: "2026-08-15T12:00:00Z" },
      { startsAt: "2026-08-28T12:00:00Z" },
    ]
    const filtered = filterCalendarItemsInWindow(
      items,
      "2026-08-14T00:00:00.000Z",
      "2026-08-28T00:00:00.000Z",
    )
    expect(filtered.map((item) => item.startsAt)).toEqual([
      "2026-08-14T12:00:00Z",
      "2026-08-15T12:00:00Z",
    ])
  })
})

describe("mergeCalendarItems", () => {
  it("appends and sorts without duplicating ids", () => {
    const merged = mergeCalendarItems(
      [
        { id: "a", source: "MANUAL", startsAt: "2026-08-15T12:00:00Z" },
        { id: "b", source: "FEED", startsAt: "2026-08-16T12:00:00Z" },
      ],
      [
        { id: "b", source: "FEED", startsAt: "2026-08-16T12:00:00Z" },
        { id: "c", source: "MANUAL", startsAt: "2026-08-14T12:00:00Z" },
      ],
    )
    expect(merged.map((item) => item.id)).toEqual(["c", "a", "b"])
  })
})

describe("calendarSourceLabel", () => {
  it("labels feed and manual sources", () => {
    expect(calendarSourceLabel("MANUAL", null)).toBe("Manual")
    expect(calendarSourceLabel("FEED", "U12")).toBe("U12")
    expect(calendarSourceLabel("FEED", "  ")).toBe("Feed")
  })
})
