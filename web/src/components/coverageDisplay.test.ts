import { describe, expect, it } from "vitest"

import type {
  CalendarCoverageAssignment,
  CalendarItem,
  CarpoolRide,
  FamilyMember,
  Kid,
} from "@/api/types"
import {
  agendaItemNeedsAttention,
  agendaItemStatusTags,
  calendarItemKey,
  calendarSourceLabel,
  coverageAdultLabel,
  coverageKidNames,
  coverageStatusLabel,
  eventKidNames,
  insertOwnRideStatusChip,
  memberLabel,
  remainingCoverageGapKidIds,
  pendingOwnAskIdToCancelOnAssign,
} from "@/components/coverageDisplay"
import {
  AWAITING_CONFIRM,
  CONFIRM_COVERAGE,
  COVERAGE_CONFIRMED,
  NEEDS_COVERAGE,
  OVERLAPS_CHIP,
} from "@/components/coverageCopy"
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

function calendarItem(partial: Partial<CalendarItem> = {}): CalendarItem {
  return {
    source: "MANUAL",
    id: "e1",
    title: "Practice",
    startsAt: "2030-08-15T17:00:00.000Z",
    endsAt: null,
    location: null,
    kidIds: ["k1"],
    feedId: null,
    feedName: null,
    eventKey: null,
    leaveFromPlaceId: null,
    leaveFromPlaceName: null,
    leaveByAt: null,
    leaveByStatus: "PENDING",
    leaveByReason: null,
    coverages: [],
    uncoveredKidIds: [],
    conflicts: [],
    rsvps: [{ kidId: "k1", status: "YES" }],
    ...partial,
  }
}

function ownRide(partial: Partial<CarpoolRide> = {}): CarpoolRide {
  return {
    id: "r1",
    spaceId: "s1",
    eventKey: "UID:game",
    requestingCircleId: "c1",
    requestingCircleName: "Ours",
    requestedByAdultId: "a1",
    kidIds: ["k1"],
    kidFirstNames: ["Maya"],
    seats: 1,
    pickupPlaceName: "Home",
    pickupAddress: "1 Main",
    pickupTown: null,
    detourMinutes: null,
    status: "ACCEPTED",
    passedByMe: false,
    passedByAdultNames: [],
    acceptedByAdultId: "a2",
    acceptingCircleId: "c2",
    acceptingCircleName: "Sharks Family",
    vehicleId: "v1",
    vehicleLabel: "Van",
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

  it("labels status tags for pending-for-self separately from uncovered", () => {
    const pendingSelf = calendarItem({
      coverages: [
        coverage({
          id: "c1",
          coveringAdultId: "a1",
          status: "PENDING",
        }),
      ],
    })
    expect(agendaItemStatusTags(pendingSelf, "a1")).toEqual([
      { label: CONFIRM_COVERAGE, tone: "amber" },
    ])
    expect(agendaItemNeedsAttention(pendingSelf, "a1")).toBe(true)

    const pendingOther = calendarItem({
      coverages: [
        coverage({
          id: "c1",
          coveringAdultId: "a2",
          status: "PENDING",
        }),
      ],
    })
    expect(agendaItemStatusTags(pendingOther, "a1")).toEqual([
      { label: AWAITING_CONFIRM, tone: "amber" },
    ])
    expect(agendaItemNeedsAttention(pendingOther, "a1")).toBe(false)

    const uncovered = calendarItem({ uncoveredKidIds: ["k1"] })
    expect(agendaItemStatusTags(uncovered, "a1")).toEqual([
      { label: NEEDS_COVERAGE, tone: "amber" },
    ])
  })

  it("subtracts ACCEPTED own-ride kids from the coverage gap", () => {
    expect(remainingCoverageGapKidIds(["k1", "k2"], ownRide({ kidIds: ["k1"] }))).toEqual([
      "k2",
    ])
    expect(remainingCoverageGapKidIds(["k1"], ownRide({ kidIds: ["k1"] }))).toEqual([])
    expect(
      remainingCoverageGapKidIds(["k1"], ownRide({ status: "PENDING", kidIds: ["k1"] })),
    ).toEqual(["k1"])
    expect(remainingCoverageGapKidIds(["k1"], null)).toEqual(["k1"])
  })

  it("cancels PENDING own ask when Assign kid sets intersect", () => {
    expect(
      pendingOwnAskIdToCancelOnAssign(ownRide({ status: "PENDING", kidIds: ["k1", "k2"] }), [
        "k2",
      ]),
    ).toBe("r1")
    expect(
      pendingOwnAskIdToCancelOnAssign(ownRide({ status: "PENDING", kidIds: ["k1"] }), ["k2"]),
    ).toBeNull()
    expect(
      pendingOwnAskIdToCancelOnAssign(ownRide({ status: "ACCEPTED", kidIds: ["k1"] }), ["k1"]),
    ).toBeNull()
    expect(pendingOwnAskIdToCancelOnAssign(null, ["k1"])).toBeNull()
  })

  it("omits Needs coverage when every uncovered kid is on an ACCEPTED ride", () => {
    const item = calendarItem({ uncoveredKidIds: ["k1"] })
    const accepted = ownRide({ kidIds: ["k1"] })
    expect(agendaItemStatusTags(item, "a1", { ownRequest: accepted })).toEqual([])
    expect(agendaItemNeedsAttention(item, "a1", false, accepted)).toBe(false)

    const mixed = calendarItem({ uncoveredKidIds: ["k1", "k2"] })
    expect(agendaItemStatusTags(mixed, "a1", { ownRequest: accepted })).toEqual([
      { label: NEEDS_COVERAGE, tone: "amber" },
    ])
    expect(agendaItemNeedsAttention(mixed, "a1", false, accepted)).toBe(true)

    const pending = ownRide({ status: "PENDING", kidIds: ["k1"] })
    expect(agendaItemStatusTags(item, "a1", { ownRequest: pending })).toEqual([
      { label: NEEDS_COVERAGE, tone: "amber" },
    ])
  })

  it("composes Overlaps, Riding with, and remaining Needs coverage in order", () => {
    const mixed = calendarItem({
      uncoveredKidIds: ["k1", "k2"],
      conflicts: [
        {
          type: "KID_TIME_OVERLAP",
          kidId: "k1",
          adultId: null,
          adultDisplayName: null,
          otherSource: "MANUAL",
          otherItemId: "other",
          otherTitle: "Other",
          otherStartsAt: "2030-08-15T18:00:00Z",
        },
      ],
    })
    const accepted = ownRide({ kidIds: ["k1"], acceptingCircleName: "House B" })
    const tags = insertOwnRideStatusChip(
      agendaItemStatusTags(mixed, "a1", { ownRequest: accepted }),
      {
        label: "Riding with House B",
        tone: "mint",
      },
    )
    expect(tags.map((tag) => tag.label)).toEqual([
      OVERLAPS_CHIP,
      "Riding with House B",
      NEEDS_COVERAGE,
    ])
  })

  it("inserts the own-ride chip after Overlaps (or first when none)", () => {
    const rideChip = { label: "Riding with House B", tone: "mint" as const }
    expect(insertOwnRideStatusChip([], rideChip)).toEqual([rideChip])
    expect(
      insertOwnRideStatusChip([{ label: NEEDS_COVERAGE, tone: "amber" }], rideChip),
    ).toEqual([rideChip, { label: NEEDS_COVERAGE, tone: "amber" }])
    expect(
      insertOwnRideStatusChip(
        [
          { label: OVERLAPS_CHIP, tone: "amber" },
          { label: NEEDS_COVERAGE, tone: "amber" },
        ],
        rideChip,
      ),
    ).toEqual([
      { label: OVERLAPS_CHIP, tone: "amber" },
      rideChip,
      { label: NEEDS_COVERAGE, tone: "amber" },
    ])
    expect(insertOwnRideStatusChip([{ label: COVERAGE_CONFIRMED, tone: "mint" }], null)).toEqual([
      { label: COVERAGE_CONFIRMED, tone: "mint" },
    ])
  })
})
