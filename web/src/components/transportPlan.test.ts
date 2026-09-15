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
  hasRequesterPickupStop,
  ownPlansCoveringKids,
  ownPlansMatchingAssignee,
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
        ownRequests: [],
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
          kidIds: ["k1"],
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

  it("counts inbound +n as kids not requests (siblings on one ask)", () => {
    const counts = inboundConfirmedCountByKind(
      [
        ownRide({
          id: "edelman",
          status: "ACCEPTED",
          acceptingCircleId: "c-ours",
          kidIds: ["luke", "graham"],
          legs: [
            carpoolLeg("TO", "CONFIRMED", {
              assigneeCircleId: "c-ours",
              assigneeCircleName: "Ours",
            }),
            carpoolLeg("FROM", "CONFIRMED", {
              assigneeCircleId: "c-ours",
              assigneeCircleName: "Ours",
            }),
          ],
        }),
        ownRide({
          id: "sharks",
          status: "ACCEPTED",
          acceptingCircleId: "c-ours",
          kidIds: ["apollo"],
          legs: [
            carpoolLeg("TO", "CONFIRMED", {
              assigneeCircleId: "c-ours",
              assigneeCircleName: "Ours",
            }),
            carpoolLeg("FROM", "CONFIRMED", {
              assigneeCircleId: "c-ours",
              assigneeCircleName: "Ours",
            }),
          ],
        }),
      ],
      "c-ours",
    )
    expect(counts).toEqual({ TO: 3, FROM: 3 })
  })

  it("ignores requester household CONFIRMED legs on a mixed Accept", () => {
    const counts = inboundConfirmedCountByKind(
      [
        ownRide({
          id: "mixed",
          status: "ACCEPTED",
          acceptingCircleId: "c-chris",
          legs: [
            carpoolLeg("TO", "CONFIRMED", {
              assigneeAdultId: "a-jason",
              assigneeDisplayName: "Jason",
            }),
            carpoolLeg("FROM", "CONFIRMED", {
              assigneeAdultId: "a-chris",
              assigneeCircleId: "c-chris",
              assigneeCircleName: "Chris house",
            }),
          ],
        }),
      ],
      "c-chris",
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
    expect(inboundWithdrawLegs(fromOnly, "c1")).toEqual(["FROM"])
    expect(inboundWithdrawLabel(fromOnly, "c1")).toBe("Can't drive them home anymore?")
  })

  it("scopes mixed household TO + team FROM withdraw to the owned return leg", () => {
    const mixed = [
      carpoolLeg("TO", "CONFIRMED", {
        assigneeAdultId: "a-jason",
        assigneeDisplayName: "Jason",
      }),
      carpoolLeg("FROM", "CONFIRMED", {
        assigneeAdultId: "a-chris",
        assigneeCircleId: "c-chris",
        assigneeCircleName: "Chris house",
      }),
    ]
    expect(inboundWithdrawLegs(mixed, "c-chris")).toEqual(["FROM"])
    expect(inboundWithdrawLabel(mixed, "c-chris")).toBe("Can't drive them home anymore?")
    expect(inboundWithdrawLegs(mixed, "c-other")).toBeUndefined()
    const roundTrip = carpoolLegsBoth("CONFIRMED", {
      assigneeCircleId: "c-chris",
    })
    expect(inboundWithdrawLegs(roundTrip, "c-chris")).toBeUndefined()
    expect(inboundWithdrawLabel(roundTrip, "c-chris")).toBe("Can't take them anymore")
    const toOnly = [
      carpoolLeg("TO", "CONFIRMED", {
        assigneeAdultId: "a-chris",
        assigneeCircleId: "c-chris",
      }),
      carpoolLeg("FROM", "CONFIRMED", {
        assigneeAdultId: "a-jason",
        assigneeDisplayName: "Jason",
      }),
    ]
    expect(inboundWithdrawLegs(toOnly, "c-chris")).toEqual(["TO"])
    expect(inboundWithdrawLabel(toOnly, "c-chris")).toBe("Can't take them there anymore?")
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

  it("treats a sibling NEEDS_RIDE plan as a gap when another ownRequest is settled", () => {
    const household = ownRide({
      id: "plan-a",
      status: "PLAN",
      kidIds: ["k1"],
      kidFirstNames: ["Sam"],
      legs: carpoolLegsBoth("CONFIRMED", {
        assigneeAdultId: "a1",
        assigneeDisplayName: "Jay",
      }),
    })
    const open = ownRide({
      id: "plan-b",
      status: "PLAN",
      kidIds: ["k2"],
      kidFirstNames: ["Mia"],
      legs: [
        carpoolLeg("TO", "CONFIRMED", {
          assigneeAdultId: "a1",
          assigneeDisplayName: "Jay",
        }),
        carpoolLeg("FROM", "NEEDS_RIDE"),
      ],
    })
    expect(
      transportGapKidIds(["k1", "k2"], null, null, [household, open]),
    ).toEqual(["k2"])

    const games = mapCalendarItemToCoverageGames(
      calendarItem({ kidIds: ["k1", "k2"], uncoveredKidIds: [] }),
      {
        eventKey: "UID:game",
        title: "Practice",
        startsAt: "2030-08-15T17:00:00.000Z",
        endsAt: null,
        defaultKidIds: ["k1", "k2"],
        ownRequests: [household, open],
        ownLegs: null,
        ownRequest: null,
        otherRequests: [],
      },
      { currentAdultId: "a1", members },
    )
    expect(games.find((row) => row.kidId === "k1")?.ownRide).toEqual({
      driver: "You",
      confirmed: true,
    })
    expect(games.find((row) => row.kidId === "k2")?.ownRide).toBe("unassigned")
    expect(getQueue(games).map((item) => item.game.kidId)).toEqual(["k2"])
  })

  it("queues a blank-plan kid even when a sibling ask is PENDING", () => {
    const asked = ownRide({
      id: "ask-b",
      status: "PENDING",
      kidIds: ["k2"],
      kidFirstNames: ["Mia"],
      legs: carpoolLegsBoth("ASKED_TEAM"),
    })
    const blank = ownRide({
      id: "blank-a",
      status: "PLAN",
      kidIds: ["k1"],
      kidFirstNames: ["Sam"],
      legs: carpoolLegsBoth("NEEDS_RIDE"),
    })
    expect(transportGapKidIds([], null, null, [blank, asked])).toEqual(["k1"])

    const games = mapCalendarItemToCoverageGames(
      calendarItem({ kidIds: ["k1", "k2"], uncoveredKidIds: [] }),
      {
        eventKey: "UID:game",
        title: "Practice",
        startsAt: "2030-08-15T17:00:00.000Z",
        endsAt: null,
        defaultKidIds: ["k1", "k2"],
        ownRequests: [blank, asked],
        ownLegs: null,
        ownRequest: null,
        otherRequests: [],
      },
      { currentAdultId: "a1", members },
    )
    expect(getQueue(games).map((item) => item.game.kidId)).toEqual(["k1"])
  })

  it("ownPlansCoveringKids selects the shared bag and ownPlansMatchingAssignee stays per assignee", () => {
    const household = ownRide({
      id: "plan-you",
      status: "PLAN",
      kidIds: ["k1", "k2"],
      kidFirstNames: ["Graham", "Luke"],
      legs: carpoolLegsBoth("CONFIRMED", {
        assigneeAdultId: "a1",
        assigneeDisplayName: "Jay",
      }),
    })
    const ask = ownRide({
      id: "plan-ask",
      status: "PENDING",
      kidIds: ["k3"],
      kidFirstNames: ["Mia"],
      legs: carpoolLegsBoth("ASKED_TEAM"),
    })
    expect(ownPlansCoveringKids([household, ask], ["k1", "k2"]).map((row) => row.id)).toEqual([
      "plan-you",
    ])
    expect(ownPlansCoveringKids([household, ask], ["k3"]).map((row) => row.id)).toEqual([
      "plan-ask",
    ])
    expect(
      ownPlansMatchingAssignee([household, ask], {
        key: "adult:a1",
        kind: "household",
        label: "You",
        adultId: "a1",
        circleId: null,
        legKinds: ["TO", "FROM"],
        waiting: false,
      }).map((row) => row.id),
    ).toEqual(["plan-you"])
    expect(
      ownPlansMatchingAssignee([household, ask], {
        key: "ask-team",
        kind: "team_ask",
        label: "the team",
        adultId: null,
        circleId: null,
        legKinds: ["TO", "FROM"],
        waiting: false,
      }).map((row) => row.id),
    ).toEqual(["plan-ask"])
  })
})

describe("hasRequesterPickupStop", () => {
  it("is true for REQUESTER TO ask and false for ACCEPTOR", () => {
    expect(
      hasRequesterPickupStop({
        legs: carpoolLegsBoth("ASKED_TEAM"),
      }),
    ).toBe(true)
    expect(
      hasRequesterPickupStop({
        legs: [
          carpoolLeg("TO", "ASKED_TEAM", { meetSide: "ACCEPTOR" }),
          carpoolLeg("FROM", "ASKED_TEAM"),
        ],
      }),
    ).toBe(false)
  })

  it("is true for FROM-only REQUESTER drop-off", () => {
    expect(
      hasRequesterPickupStop({
        legs: [
          carpoolLeg("TO", "NEEDS_RIDE"),
          carpoolLeg("FROM", "CONFIRMED"),
        ],
      }),
    ).toBe(true)
  })

  it("is false when ride or legs are missing", () => {
    expect(hasRequesterPickupStop(null)).toBe(false)
    expect(hasRequesterPickupStop(undefined)).toBe(false)
    expect(hasRequesterPickupStop({})).toBe(false)
    expect(hasRequesterPickupStop({ legs: undefined })).toBe(false)
    expect(hasRequesterPickupStop({ legs: null })).toBe(false)
  })

  it("treats omitted meetSide as requester pickup", () => {
    const to = { ...carpoolLeg("TO", "ASKED_TEAM") }
    delete (to as { meetSide?: string }).meetSide
    expect(
      hasRequesterPickupStop({
        legs: [to, carpoolLeg("FROM", "ASKED_TEAM")],
      }),
    ).toBe(true)
  })
})
