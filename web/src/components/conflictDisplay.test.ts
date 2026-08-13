import { describe, expect, it } from "vitest"

import type { CalendarConflict } from "@/api/types"
import {
  conflictDisplayLines,
  coverageDoubleBookMessage,
  formatConflictLine,
} from "@/components/conflictDisplay"

const kidConflict: CalendarConflict = {
  type: "KID_TIME_OVERLAP",
  kidId: "k1",
  adultId: null,
  adultDisplayName: null,
  otherSource: "MANUAL",
  otherItemId: "e2",
  otherTitle: "Game",
  otherStartsAt: "2026-08-15T17:30:00Z",
}

const adultConflict: CalendarConflict = {
  type: "ADULT_COVERAGE_OVERLAP",
  kidId: null,
  adultId: "a1",
  adultDisplayName: "Jordan",
  otherSource: "FEED",
  otherItemId: "e3",
  otherTitle: "Practice",
  otherStartsAt: "2026-08-15T17:00:00Z",
}

describe("formatConflictLine", () => {
  it("names the kid when known", () => {
    expect(
      formatConflictLine(kidConflict, [{ id: "k1", displayName: "Sam" }]),
    ).toBe("Sam overlaps Game")
  })

  it("falls back without kid name", () => {
    expect(formatConflictLine(kidConflict)).toBe("Kid schedule overlaps Game")
  })

  it("names the adult for coverage overlap", () => {
    expect(formatConflictLine(adultConflict)).toBe("Jordan also covering Practice")
  })
})

describe("conflictDisplayLines", () => {
  it("returns empty for no conflicts", () => {
    expect(conflictDisplayLines([])).toEqual([])
    expect(conflictDisplayLines(undefined)).toEqual([])
  })

  it("dedupes identical peer conflicts", () => {
    expect(conflictDisplayLines([kidConflict, kidConflict])).toEqual([
      "Kid schedule overlaps Game",
    ])
  })
})

describe("coverageDoubleBookMessage", () => {
  it("maps overlapping confirmed 409 copy", () => {
    expect(
      coverageDoubleBookMessage(
        "Adult is already confirmed on an overlapping calendar item",
      ),
    ).toBe("Already confirmed on an overlapping event — decline or reassign first.")
  })

  it("passes through unrelated messages", () => {
    expect(coverageDoubleBookMessage("Kid is already covered on this calendar item")).toBe(
      "Kid is already covered on this calendar item",
    )
  })
})
