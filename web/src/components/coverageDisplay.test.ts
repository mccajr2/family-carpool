import { describe, expect, it } from "vitest"

import type {
  CalendarCoverageAssignment,
  CalendarItem,
  CarpoolRequest,
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
  pendingOwnAskIdsToCancelOnAssign,
} from "@/components/coverageDisplay"
import {
  AWAITING_CONFIRM,
  CONFIRM_COVERAGE,
  COVERAGE_CONFIRMED,
  NEEDS_COVERAGE,
  OVERLAPS_CHIP,
  RIDE_CONFLICT_CHIP,
  alsoDrivingKidLabel,
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
    leaveFromPlaceId: null,
    leaveFromPlaceName: null,
    leaveFromAddress: null,
    leaveByAt: null,
    leaveByStatus: null,
    leaveByReason: null,
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
    leaveFromAddress: null,
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

function ownNeed(partial: Partial<CarpoolRequest> = {}): CarpoolRequest {
  return {
    id: "r1",
    spaceId: "s1",
    eventKey: "UID:game",
    requestingCircleId: "c1",
    requestingCircleName: "Ours",
    requestedByAdultId: "a1",
    kidId: "k1",
    kidFirstName: "Maya",
    legsNeeded: ["TO", "FROM"],
    legStatuses: [
      { leg: "TO", status: "OPEN" },
      { leg: "FROM", status: "OPEN" },
    ],
    pickupPlaceName: "Home",
    pickupAddress: "1 Main",
    pickupTown: null,
    detourMinutes: null,
    status: "FULLY_COVERED",
    passedByMe: false,
    passedByAdultNames: [],
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

  it("subtracts only FULLY_COVERED own-need kids from the coverage gap", () => {
    expect(
      remainingCoverageGapKidIds(
        ["k1", "k2"],
        [ownNeed({ kidId: "k1", status: "FULLY_COVERED" })],
      ),
    ).toEqual(["k2"])
    expect(
      remainingCoverageGapKidIds(["k1"], [ownNeed({ kidId: "k1", status: "FULLY_COVERED" })]),
    ).toEqual([])
    expect(
      remainingCoverageGapKidIds(
        ["k1"],
        [ownNeed({ kidId: "k1", status: "UNCOVERED" })],
      ),
    ).toEqual(["k1"])
    expect(
      remainingCoverageGapKidIds(
        ["k1"],
        [
          ownNeed({
            kidId: "k1",
            status: "PARTIAL",
            legStatuses: [
              { leg: "TO", status: "CONFIRMED" },
              { leg: "FROM", status: "OPEN" },
            ],
          }),
        ],
      ),
    ).toEqual(["k1"])
    expect(remainingCoverageGapKidIds(["k1"], null)).toEqual(["k1"])
    expect(remainingCoverageGapKidIds(["k1"], [])).toEqual(["k1"])
  })

  it("cancels open own asks when Assign kid sets intersect", () => {
    expect(
      pendingOwnAskIdsToCancelOnAssign(
        [
          ownNeed({ id: "need-1", status: "UNCOVERED", kidId: "k1" }),
          ownNeed({ id: "need-2", status: "PARTIAL", kidId: "k2" }),
        ],
        ["k2"],
      ),
    ).toEqual(["need-2"])
    expect(
      pendingOwnAskIdToCancelOnAssign(
        [ownNeed({ status: "UNCOVERED", kidId: "k1" })],
        ["k2"],
      ),
    ).toBeNull()
    expect(
      pendingOwnAskIdToCancelOnAssign(
        [ownNeed({ status: "FULLY_COVERED", kidId: "k1" })],
        ["k1"],
      ),
    ).toBeNull()
    expect(pendingOwnAskIdToCancelOnAssign(null, ["k1"])).toBeNull()
  })

  it("omits Needs coverage when every uncovered kid is FULLY_COVERED", () => {
    const item = calendarItem({ uncoveredKidIds: ["k1"] })
    const covered = [ownNeed({ kidId: "k1", status: "FULLY_COVERED" })]
    expect(agendaItemStatusTags(item, "a1", { ownRequests: covered })).toEqual([])
    expect(agendaItemNeedsAttention(item, "a1", false, covered)).toBe(false)

    const mixed = calendarItem({ uncoveredKidIds: ["k1", "k2"] })
    expect(agendaItemStatusTags(mixed, "a1", { ownRequests: covered })).toEqual([
      { label: NEEDS_COVERAGE, tone: "amber" },
    ])
    expect(agendaItemNeedsAttention(mixed, "a1", false, covered)).toBe(true)

    const partial = [
      ownNeed({
        kidId: "k1",
        status: "PARTIAL",
        legStatuses: [
          { leg: "TO", status: "CONFIRMED" },
          { leg: "FROM", status: "OPEN" },
        ],
      }),
    ]
    expect(agendaItemStatusTags(item, "a1", { ownRequests: partial })).toEqual([
      { label: NEEDS_COVERAGE, tone: "amber" },
    ])
  })

  it("treats ride-commitment conflict as attention even when gaps are cleared", () => {
    const item = calendarItem({ uncoveredKidIds: [] })
    const covered = [ownNeed({ kidId: "k1", status: "FULLY_COVERED" })]
    expect(agendaItemNeedsAttention(item, "a1", false, covered)).toBe(false)
    expect(agendaItemNeedsAttention(item, "a1", false, covered, true)).toBe(true)
    expect(agendaItemNeedsAttention(item, "a1", true, covered, true)).toBe(false)
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
    const covered = [ownNeed({ kidId: "k1", status: "FULLY_COVERED" })]
    const tags = insertOwnRideStatusChip(
      agendaItemStatusTags(mixed, "a1", { ownRequests: covered }),
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

  it("inserts the own-ride chip after Overlaps and ride-commitment conflict", () => {
    const rideChip = { label: "Ride needed", tone: "amber" as const }
    expect(
      insertOwnRideStatusChip(
        [
          { label: OVERLAPS_CHIP, tone: "amber" },
          { label: alsoDrivingKidLabel("Sam"), tone: "amber" },
          { label: NEEDS_COVERAGE, tone: "amber" },
        ],
        rideChip,
      ),
    ).toEqual([
      { label: OVERLAPS_CHIP, tone: "amber" },
      { label: alsoDrivingKidLabel("Sam"), tone: "amber" },
      rideChip,
      { label: NEEDS_COVERAGE, tone: "amber" },
    ])
    expect(
      insertOwnRideStatusChip(
        [{ label: RIDE_CONFLICT_CHIP, tone: "amber" }, { label: NEEDS_COVERAGE, tone: "amber" }],
        rideChip,
      ),
    ).toEqual([
      { label: RIDE_CONFLICT_CHIP, tone: "amber" },
      rideChip,
      { label: NEEDS_COVERAGE, tone: "amber" },
    ])
  })
})
