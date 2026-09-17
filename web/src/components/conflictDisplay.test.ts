import { describe, expect, it } from "vitest"

import type { CalendarConflict } from "@/api/types"
import {
  conflictDisplayLines,
  coverageDoubleBookMessage,
  formatConflictLine,
  hasAttentionConflicts,
  isFamilyOnlyConflicts,
} from "@/components/conflictDisplay"

const kidConflict: CalendarConflict = {
  type: "KID_TIME_OVERLAP",
  kidId: "k1",
  otherKidId: null,
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
  otherKidId: null,
  adultId: "a1",
  adultDisplayName: "Jordan",
  otherSource: "FEED",
  otherItemId: "e3",
  otherTitle: "Practice",
  otherStartsAt: "2026-08-15T17:00:00Z",
}

const familyConflict: CalendarConflict = {
  type: "FAMILY_TIME_OVERLAP",
  kidId: "k1",
  otherKidId: "k2",
  adultId: null,
  adultDisplayName: null,
  otherSource: "MANUAL",
  otherItemId: "e4",
  otherTitle: "Dance",
  otherStartsAt: "2026-08-15T17:30:00Z",
}

const kids = [
  { id: "k1", displayName: "Sam" },
  { id: "k2", displayName: "Alex" },
]

describe("formatConflictLine", () => {
  it("names the kid when known", () => {
    expect(formatConflictLine(kidConflict, kids)).toBe("Sam overlaps Game")
  })

  it("falls back without kid name", () => {
    expect(formatConflictLine(kidConflict)).toBe("Kid schedule overlaps Game")
  })

  it("names the adult for coverage overlap", () => {
    expect(formatConflictLine(adultConflict)).toBe("Jordan also covering Practice")
  })

  it("names both kids for family overlap", () => {
    expect(formatConflictLine(familyConflict, kids)).toBe("Sam overlaps Alex's Dance")
  })

  it("falls back family copy when peer kid name is missing", () => {
    expect(formatConflictLine(familyConflict, [{ id: "k1", displayName: "Sam" }])).toBe(
      "Sam overlaps Dance",
    )
  })

  it("falls back family copy when local kid name is missing", () => {
    expect(formatConflictLine(familyConflict, [{ id: "k2", displayName: "Alex" }])).toBe(
      "Kid overlaps Alex's Dance",
    )
  })
})

describe("conflictDisplayLines", () => {
  it("returns empty for no conflicts", () => {
    expect(conflictDisplayLines([])).toEqual([])
    expect(conflictDisplayLines(undefined)).toEqual([])
  })

  it("dedupes identical peer conflicts", () => {
    expect(conflictDisplayLines([kidConflict, kidConflict])).toEqual([
      { text: "Kid schedule overlaps Game", tone: "attention" },
    ])
  })

  it("marks family lines with quieter tone", () => {
    expect(conflictDisplayLines([familyConflict], kids)).toEqual([
      { text: "Sam overlaps Alex's Dance", tone: "family" },
    ])
  })
})

describe("conflict precedence helpers", () => {
  it("treats family-only as quieter and mixed as attention", () => {
    expect(isFamilyOnlyConflicts([familyConflict])).toBe(true)
    expect(hasAttentionConflicts([familyConflict])).toBe(false)
    expect(isFamilyOnlyConflicts([familyConflict, kidConflict])).toBe(false)
    expect(hasAttentionConflicts([familyConflict, kidConflict])).toBe(true)
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
