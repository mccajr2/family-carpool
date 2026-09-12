import { describe, expect, it } from "vitest"

import type { CalendarItem, CarpoolRide, CarpoolRideEvent } from "@/api/types"
import { carpoolLeg, carpoolLegsBoth } from "@/api/carpoolLegs"
import {
  collapseMatchingLegChips,
  decidedAssigneeRevertLabel,
  decidedAssigneesFromLegs,
  inboundConfirmedCountByKind,
  inboundWithdrawLabel,
  inboundWithdrawLegs,
  ownRideStatusFromTransportPlan,
  ridePlaceLineKind,
  transportGapKidIds,
} from "@/components/transportPlan"
import { getQueue, mapCalendarItemToCoverageGames } from "@/components/coverageQueue"

function calendarItem(partial: Partial<CalendarItem> = {}): CalendarItem {
  const kidIds = partial.kidIds ?? ["k1"]
  return {
    source: "MANUAL",
    id: "e1",
    title: "Practice",
    startsAt: "2030-08-15T17:00:00.000Z",
    endsAt: null,
    location: null,
    kidIds,
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
    rsvps: kidIds.map((kidId) => ({ kidId, status: "YES" as const })),
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
    kidFirstNames: ["Kian"],
    seats: 1,
    pickupPlaceName: "Home",
    pickupAddress: "1 Main",
    pickupTown: "Huron Ave",
    detourMinutes: null,
    status: "PENDING",
    legs: carpoolLegsBoth("ASKED_TEAM"),
    passedByMe: false,
    passedByAdultNames: [],
    acceptedByAdultId: null,
    acceptingCircleId: null,
    acceptingCircleName: null,
    ...partial,
  }
}

const members = [
  { adultId: "a1", email: "jay@example.com", displayName: "Jay", role: "ORGANIZER" as const },
  { adultId: "a2", email: "katy@example.com", displayName: "Katy", role: "CAREGIVER" as const },
]

describe("transportPlan dogfood batch 2", () => {
  it("settled household CONFIRMED legs are not gaps even when uncoveredKidIds still lists the kid", () => {
    const legs = [
      carpoolLeg("TO", "CONFIRMED", {
        assigneeAdultId: "a1",
        assigneeDisplayName: "Jay",
      }),
      carpoolLeg("FROM", "CONFIRMED", {
        assigneeAdultId: "a2",
        assigneeDisplayName: "Katy",
      }),
    ]
    expect(transportGapKidIds(["k1"], null, legs)).toEqual([])

    const games = mapCalendarItemToCoverageGames(
      calendarItem({ uncoveredKidIds: ["k1"] }),
      {
        eventKey: "UID:game",
        title: "Practice",
        startsAt: "2030-08-15T17:00:00.000Z",
        endsAt: null,
        defaultKidIds: ["k1"],
        ownLegs: legs,
        ownRequest: null,
        otherRequests: [],
      } satisfies CarpoolRideEvent,
      { currentAdultId: "a1", members },
    )
    expect(games[0]?.ownRide).toEqual({ driver: "You", confirmed: true })
    expect(getQueue(games)).toEqual([])

    const assignees = decidedAssigneesFromLegs(legs, { currentAdultId: "a1" })
    expect(assignees).toHaveLength(2)
    expect(assignees.map((row) => decidedAssigneeRevertLabel(row))).toEqual([
      "Can't drive anymore for getting there? Reassign the ride",
      "Katy can't drive anymore for coming back? Reassign",
    ])
  })

  it("keeps sibling uncovered when another kid is on an ACCEPTED ride", () => {
    const legs = carpoolLegsBoth("CONFIRMED", {
      assigneeCircleId: "c-team",
      assigneeCircleName: "Sharks",
    })
    expect(
      transportGapKidIds(["k1", "k2"], ownRide({ status: "ACCEPTED", kidIds: ["k1"], legs }), legs),
    ).toEqual(["k2"])
  })

  it("mixed household TO + teammate FROM yields both revert targets", () => {
    const legs = [
      carpoolLeg("TO", "CONFIRMED", {
        assigneeAdultId: "a2",
        assigneeDisplayName: "Katy",
      }),
      carpoolLeg("FROM", "CONFIRMED", {
        assigneeAdultId: "guy",
        assigneeCircleId: "c-sharks",
        assigneeCircleName: "Sharks",
      }),
    ]
    const assignees = decidedAssigneesFromLegs(legs, { currentAdultId: "a1" })
    expect(assignees.map((row) => row.kind).sort()).toEqual(["household", "teammate"])
    expect(assignees.map((row) => decidedAssigneeRevertLabel(row))).toEqual(
      expect.arrayContaining([
        "Katy can't drive anymore for getting there? Reassign",
        "Sharks can't drive anymore for coming back? Find a new ride",
      ]),
    )
  })

  it("counts inbound +n per CONFIRMED kind only", () => {
    const counts = inboundConfirmedCountByKind(
      [
        ownRide({
          id: "in-from",
          status: "ACCEPTED",
          acceptingCircleId: "c-ours",
          legs: [
            carpoolLeg("TO", "NEEDS_RIDE"),
            carpoolLeg("FROM", "CONFIRMED", {
              assigneeCircleId: "c-ours",
              assigneeCircleName: "Ours",
            }),
          ],
        }),
      ],
      "c-ours",
    )
    expect(counts).toEqual({ TO: 0, FROM: 1 })
  })

  it("collapses matching chip bodies to one unprefixed label", () => {
    expect(
      collapseMatchingLegChips([
        { label: "Getting there: You're driving · +1", tone: "route" },
        { label: "Coming back: You're driving · +1", tone: "route" },
      ]),
    ).toEqual([{ label: "You're driving · +1", tone: "route" }])
    expect(
      collapseMatchingLegChips([
        { label: "Getting there: You're driving", tone: "mint" },
        { label: "Coming back: You're driving · +1", tone: "route" },
      ]),
    ).toHaveLength(2)
  })

  it("FROM-only place/withdraw copy is drop-off scoped", () => {
    const fromOnly = [
      carpoolLeg("TO", "NEEDS_RIDE"),
      carpoolLeg("FROM", "CONFIRMED", { assigneeCircleId: "c1" }),
    ]
    expect(ridePlaceLineKind(fromOnly)).toBe("dropoff")
    expect(inboundWithdrawLegs(fromOnly)).toEqual(["FROM"])
    expect(inboundWithdrawLabel(fromOnly)).toBe("Can't drive them home anymore?")
  })

  it("ownRideStatusFromTransportPlan prefers settled legs over uncovered", () => {
    const status = ownRideStatusFromTransportPlan({
      kidId: "k1",
      item: calendarItem({ uncoveredKidIds: ["k1"] }),
      ownRequest: null,
      ownLegs: carpoolLegsBoth("CONFIRMED", {
        assigneeAdultId: "a2",
        assigneeDisplayName: "Katy",
      }),
      currentAdultId: "a1",
      householdDriverLabel: (id, name) => name?.trim() || id,
    })
    expect(status).toEqual({ driver: "Katy", confirmed: true })
  })
})
