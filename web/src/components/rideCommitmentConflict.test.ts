import { describe, expect, it } from "vitest"

import type { CalendarItem, CarpoolRequest, CarpoolRide, CarpoolRideEvent } from "@/api/types"
import {
  rideCommitmentConflict,
  rideCommitmentConflictChipLabel,
  rideCommitmentConflictLine,
} from "@/components/rideCommitmentConflict"
import {
  RIDE_CONFLICT_CHIP,
  alsoDrivingKidLabel,
} from "@/components/coverageCopy"
import type { CoverageGameEvent } from "@/components/coverageQueue"

const confirmedLegs = [
  { leg: "TO" as const, status: "CONFIRMED" as const },
  { leg: "FROM" as const, status: "CONFIRMED" as const },
]

function need(partial: Partial<CarpoolRequest> = {}): CarpoolRequest {
  return {
    id: "r1",
    spaceId: "s1",
    eventKey: "UID:game",
    requestingCircleId: "c2",
    requestingCircleName: "House B",
    requestedByAdultId: "a2",
    kidId: "k-them",
    kidFirstName: "Sam",
    legsNeeded: ["TO", "FROM"],
    legStatuses: confirmedLegs,
    pickupPlaceName: "Home",
    pickupAddress: "1 Main St",
    pickupTown: null,
    detourMinutes: null,
    status: "FULLY_COVERED",
    passedByMe: false,
    passedByAdultNames: [],
    ...partial,
  }
}

function fulfillment(partial: Partial<CarpoolRide> = {}): CarpoolRide {
  return {
    id: "fulfill-1",
    spaceId: "s1",
    eventKey: "UID:game",
    leg: "TO",
    driverAdultId: "a1",
    drivingCircleId: "c1",
    drivingCircleName: "Ours",
    vehicleId: "v1",
    vehicleLabel: "Van",
    passengerRequestIds: ["inbound-accepted"],
    status: "ACTIVE",
    ...partial,
  }
}

function event(partial: Partial<CarpoolRideEvent> = {}): CarpoolRideEvent {
  return {
    eventKey: "UID:game",
    title: "Practice",
    startsAt: "2026-08-21T16:00:00Z",
    endsAt: null,
    defaultKidIds: [],
    ownRequests: [],
    otherRequests: [],
    rides: [],
    ...partial,
  }
}

function item(partial: Partial<CalendarItem> = {}): CalendarItem {
  const kidIds = partial.kidIds ?? ["k1"]
  return {
    source: "MANUAL",
    id: "e1",
    title: "Practice",
    startsAt: "2026-08-21T16:00:00Z",
    endsAt: null,
    location: null,
    kidIds,
    feedId: null,
    feedName: null,
    eventKey: "UID:game",
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

function game(
  partial: Partial<CoverageGameEvent> & Pick<CoverageGameEvent, "kidId">,
): CoverageGameEvent {
  return {
    id: `UID:game:${partial.kidId}`,
    title: "Practice",
    startsAt: "2026-08-21T16:00:00Z",
    order: Date.parse("2026-08-21T16:00:00Z"),
    attendance: "going",
    ownRide: "unassigned",
    requests: [],
    ...partial,
  }
}

const circleId = "c1"

function acceptedInbound(partial: Partial<CarpoolRequest> = {}): CarpoolRequest {
  return need({
    id: "inbound-accepted",
    requestingCircleId: "c2",
    kidId: "k-them",
    kidFirstName: "Sam",
    status: "FULLY_COVERED",
    legStatuses: confirmedLegs,
    ...partial,
  })
}

function inboundEvent(inbound: CarpoolRequest): CarpoolRideEvent {
  return event({
    otherRequests: [inbound],
    rides: [
      fulfillment({
        id: "inbound-ride",
        drivingCircleId: circleId,
        passengerRequestIds: [inbound.id],
      }),
    ],
  })
}

describe("rideCommitmentConflict", () => {
  it("returns Type A when ACCEPTED inbound coexists with an in-play unassigned kid", () => {
    const inbound = acceptedInbound()
    const conflict = rideCommitmentConflict(
      inboundEvent(inbound),
      item({ kidIds: ["k1"], uncoveredKidIds: ["k1"] }),
      [game({ kidId: "k1", ownRide: "unassigned" })],
      circleId,
    )
    expect(conflict).toEqual({
      kind: "needRideAndDriving",
      inbound,
      gapKidNames: ["Kid"],
    })
  })

  it("returns Type A when ACCEPTED inbound coexists with an in-play requested kid", () => {
    const inbound = acceptedInbound()
    const ownPending = need({
      id: "own-pending",
      requestingCircleId: circleId,
      requestingCircleName: "Ours",
      requestedByAdultId: "a1",
      status: "UNCOVERED",
      kidId: "k1",
      kidFirstName: "Maya",
      legStatuses: [
        { leg: "TO", status: "OPEN" },
        { leg: "FROM", status: "OPEN" },
      ],
    })
    const conflict = rideCommitmentConflict(
      event({
        ownRequests: [ownPending],
        otherRequests: [inbound],
        rides: [
          fulfillment({
            id: "inbound-ride",
            drivingCircleId: circleId,
            passengerRequestIds: [inbound.id],
          }),
        ],
      }),
      item({ kidIds: ["k1"], uncoveredKidIds: ["k1"] }),
      [game({ kidId: "k1", ownRide: "requested" })],
      circleId,
    )
    expect(conflict).toEqual({
      kind: "needRideAndDriving",
      inbound,
      gapKidNames: ["Maya"],
    })
  })

  it("returns Type B for mutual ACCEPTED swap with different kid sets", () => {
    const inbound = acceptedInbound({
      kidId: "k-them",
      kidFirstName: "Sam",
    })
    const ownAccepted = need({
      id: "own-accepted",
      requestingCircleId: circleId,
      requestingCircleName: "Ours",
      requestedByAdultId: "a1",
      status: "FULLY_COVERED",
      kidId: "k1",
      kidFirstName: "Maya",
      legStatuses: confirmedLegs,
    })
    const conflict = rideCommitmentConflict(
      event({
        ownRequests: [ownAccepted],
        otherRequests: [inbound],
        rides: [
          fulfillment({
            id: "inbound-ride",
            drivingCircleId: circleId,
            passengerRequestIds: [inbound.id],
          }),
          fulfillment({
            id: "own-ride",
            drivingCircleId: "c2",
            drivingCircleName: "House B",
            passengerRequestIds: [ownAccepted.id],
          }),
        ],
      }),
      item({ kidIds: ["k1"] }),
      [
        game({
          kidId: "k1",
          ownRide: { driver: "House B", confirmed: true },
        }),
      ],
      circleId,
    )
    expect(conflict).toEqual({
      kind: "mutualSwap",
      inbound,
      ownRequest: ownAccepted,
    })
  })

  it("returns null when only riding-with is set and there is no accepted inbound", () => {
    const ownAccepted = need({
      id: "own-accepted",
      requestingCircleId: circleId,
      status: "FULLY_COVERED",
      kidId: "k1",
      kidFirstName: "Maya",
      legStatuses: confirmedLegs,
    })
    expect(
      rideCommitmentConflict(
        event({
          ownRequests: [ownAccepted],
          rides: [
            fulfillment({
              id: "own-ride",
              drivingCircleId: "c2",
              drivingCircleName: "House B",
              passengerRequestIds: [ownAccepted.id],
            }),
          ],
        }),
        item({ kidIds: ["k1"] }),
        [
          game({
            kidId: "k1",
            ownRide: { driver: "House B", confirmed: true },
          }),
        ],
        circleId,
      ),
    ).toBeNull()
  })

  it("returns null when ACCEPTED inbound coexists with household CONFIRMED for every own kid", () => {
    const inbound = acceptedInbound()
    expect(
      rideCommitmentConflict(
        inboundEvent(inbound),
        item({ kidIds: ["k1", "k2"] }),
        [
          game({
            kidId: "k1",
            ownRide: { driver: "You", confirmed: true },
          }),
          game({
            kidId: "k2",
            ownRide: { driver: "You", confirmed: true },
          }),
        ],
        circleId,
      ),
    ).toBeNull()
  })

  it("skips not_going kids when detecting Type A gaps", () => {
    const inbound = acceptedInbound()
    expect(
      rideCommitmentConflict(
        inboundEvent(inbound),
        item({ kidIds: ["k1", "k2"] }),
        [
          game({ kidId: "k1", attendance: "not_going", ownRide: "unassigned" }),
          game({
            kidId: "k2",
            ownRide: { driver: "You", confirmed: true },
          }),
        ],
        circleId,
      ),
    ).toBeNull()
  })

  it("does not treat matching kid sets as Type B", () => {
    const sharedKid = "k1"
    const inbound = acceptedInbound({
      kidId: sharedKid,
      kidFirstName: "Maya",
    })
    const ownAccepted = need({
      id: "own-accepted",
      requestingCircleId: circleId,
      status: "FULLY_COVERED",
      kidId: sharedKid,
      kidFirstName: "Maya",
      legStatuses: confirmedLegs,
    })
    expect(
      rideCommitmentConflict(
        event({
          ownRequests: [ownAccepted],
          otherRequests: [inbound],
          rides: [
            fulfillment({
              id: "inbound-ride",
              drivingCircleId: circleId,
              passengerRequestIds: [inbound.id],
            }),
            fulfillment({
              id: "own-ride",
              drivingCircleId: "c2",
              drivingCircleName: "House B",
              passengerRequestIds: [ownAccepted.id],
            }),
          ],
        }),
        item({ kidIds: [sharedKid] }),
        [
          game({
            kidId: sharedKid,
            ownRide: { driver: "House B", confirmed: true },
          }),
        ],
        circleId,
      ),
    ).toBeNull()
  })

  it("prefers Type B over Type A when mutual swap and a remaining gap coexist", () => {
    const inbound = acceptedInbound({ kidId: "k-them", kidFirstName: "Sam" })
    const ownAccepted = need({
      id: "own-accepted",
      requestingCircleId: circleId,
      status: "FULLY_COVERED",
      kidId: "k1",
      kidFirstName: "Maya",
      legStatuses: confirmedLegs,
    })
    const conflict = rideCommitmentConflict(
      event({
        ownRequests: [ownAccepted],
        otherRequests: [inbound],
        rides: [
          fulfillment({
            id: "inbound-ride",
            drivingCircleId: circleId,
            passengerRequestIds: [inbound.id],
          }),
          fulfillment({
            id: "own-ride",
            drivingCircleId: "c2",
            drivingCircleName: "House B",
            passengerRequestIds: [ownAccepted.id],
          }),
        ],
      }),
      item({ kidIds: ["k1", "k2"], uncoveredKidIds: ["k2"] }),
      [
        game({
          kidId: "k1",
          ownRide: { driver: "House B", confirmed: true },
        }),
        game({ kidId: "k2", ownRide: "unassigned" }),
      ],
      circleId,
    )
    expect(conflict?.kind).toBe("mutualSwap")
  })
})

describe("rideCommitmentConflictChipLabel", () => {
  it("uses Also driving {name} for Type A with one inbound kid", () => {
    const inbound = acceptedInbound({
      kidId: "k-them",
      kidFirstName: "Sam",
    })
    expect(
      rideCommitmentConflictChipLabel({
        kind: "needRideAndDriving",
        inbound,
        gapKidNames: ["Maya"],
      }),
    ).toBe(alsoDrivingKidLabel("Sam"))
  })

  it("uses Ride conflict for Type A without inbound name and Type B", () => {
    const unnamedInbound = acceptedInbound({
      kidId: "k-a",
      kidFirstName: "  ",
    })
    expect(
      rideCommitmentConflictChipLabel({
        kind: "needRideAndDriving",
        inbound: unnamedInbound,
        gapKidNames: ["Maya"],
      }),
    ).toBe(RIDE_CONFLICT_CHIP)

    const inbound = acceptedInbound()
    const ownRequest = need({
      id: "own",
      status: "FULLY_COVERED",
      kidId: "k1",
      kidFirstName: "Maya",
      legStatuses: confirmedLegs,
    })
    expect(
      rideCommitmentConflictChipLabel({
        kind: "mutualSwap",
        inbound,
        ownRequest,
      }),
    ).toBe(RIDE_CONFLICT_CHIP)
  })
})

describe("rideCommitmentConflictLine", () => {
  it("names both commitments for Type A", () => {
    expect(
      rideCommitmentConflictLine({
        kind: "needRideAndDriving",
        inbound: acceptedInbound({
          kidId: "k-them",
          kidFirstName: "Sam",
        }),
        gapKidNames: ["Maya"],
      }),
    ).toBe("You're driving Sam but Maya still need a ride.")
  })

  it("names both commitments for Type B mutual swap", () => {
    expect(
      rideCommitmentConflictLine({
        kind: "mutualSwap",
        inbound: acceptedInbound({
          kidId: "k-them",
          kidFirstName: "Sam",
        }),
        ownRequest: need({
          id: "own",
          status: "FULLY_COVERED",
          kidId: "k1",
          kidFirstName: "Maya",
          legStatuses: confirmedLegs,
        }),
      }),
    ).toBe(
      "You're driving Sam and Maya rides with them — pick one plan.",
    )
  })
})
