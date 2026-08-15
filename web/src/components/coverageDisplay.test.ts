import { describe, expect, it } from "vitest"

import type { CalendarCoverageAssignment, CalendarItem, FamilyMember, Kid } from "@/api/types"
import {
  calendarItemKey,
  calendarSourceLabel,
  coverageAdultLabel,
  coverageKidNames,
  coverageStatusLabel,
  eventKidNames,
  memberLabel,
} from "@/components/coverageDisplay"
import { calendarSourceLabel as eventTimesSourceLabel } from "@/components/eventTimes"

const kids: Kid[] = [
  { id: "k1", displayName: "Maya" },
  { id: "k2", displayName: "Leo" },
]

const members: FamilyMember[] = [
  { adultId: "a1", email: "alex@example.com", displayName: "Alex", role: "ORGANIZER" },
  { adultId: "a2", email: "jordan@example.com", displayName: null, role: "CAREGIVER" },
]

function coverage(
  partial: Partial<CalendarCoverageAssignment> & Pick<CalendarCoverageAssignment, "id">,
): CalendarCoverageAssignment {
  return {
    coveringAdultId: "a1",
    coveringAdultDisplayName: null,
    assignedByAdultId: "a1",
    kidIds: ["k1"],
    status: "PENDING",
    ...partial,
  }
}

describe("coverageDisplay", () => {
  it("builds a calendar item key from source and id", () => {
    expect(calendarItemKey({ source: "MANUAL", id: "e1" } as CalendarItem)).toBe("MANUAL-e1")
    expect(calendarItemKey({ source: "FEED", id: "evt-9" } as CalendarItem)).toBe("FEED-evt-9")
  })

  it("labels coverage statuses", () => {
    expect(coverageStatusLabel("PENDING")).toBe("Pending")
    expect(coverageStatusLabel("CONFIRMED")).toBe("Confirmed")
    expect(coverageStatusLabel("DECLINED")).toBe("Declined")
  })

  it("prefers display name, then email", () => {
    expect(memberLabel(members[0])).toBe("Alex")
    expect(memberLabel(members[1])).toBe("jordan@example.com")
  })

  it("labels covering adult from snapshot, then circle member", () => {
    expect(
      coverageAdultLabel(
        coverage({ id: "c1", coveringAdultDisplayName: "  Jordan  " }),
        members,
      ),
    ).toBe("Jordan")
    expect(
      coverageAdultLabel(coverage({ id: "c2", coveringAdultId: "a2" }), members),
    ).toBe("jordan@example.com")
    expect(
      coverageAdultLabel(coverage({ id: "c3", coveringAdultId: "missing" }), members),
    ).toBe("Adult")
  })

  it("joins kid display names in id order and skips blanks", () => {
    expect(eventKidNames(["k2", "k1", "gone"], kids)).toBe("Leo, Maya")
    expect(coverageKidNames(coverage({ id: "c1", kidIds: ["k1", "k2"] }), kids)).toBe(
      "Maya, Leo",
    )
  })

  it("matches eventTimes calendarSourceLabel", () => {
    const cases: Array<["MANUAL" | "FEED", string | null]> = [
      ["MANUAL", null],
      ["FEED", "U12"],
      ["FEED", "  "],
      ["FEED", null],
    ]
    for (const [source, feedName] of cases) {
      expect(calendarSourceLabel(source, feedName)).toBe(
        eventTimesSourceLabel(source, feedName),
      )
    }
  })
})
