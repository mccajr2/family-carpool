import { describe, expect, it } from "vitest"

import type { CalendarItem, CarpoolRide, CarpoolRideEvent } from "@/api/types"
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

function ride(partial: Partial<CarpoolRide> = {}): CarpoolRide {
  return {
    id: "r1",
    spaceId: "s1",
    eventKey: "UID:game",
    requestingCircleId: "c2",
    requestingCircleName: "House B",
    requestedByAdultId: "a2",
    kidIds: ["k-them"],
    kidFirstNames: ["Sam"],
    seats: 1,
    pickupPlaceName: "Home",
    pickupAddress: "1 Main St",
    pickupTown: null,
    detourMinutes: null,
    status: "PENDING",
    passedByMe: false,
    passedByAdultNames: [],
    acceptedByAdultId: null,
    acceptingCircleId: null,
    acceptingCircleName: null,
    vehicleId: null,
    vehicleLabel: null,
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
    ownRequest: null,
    otherRequests: [],
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

function acceptedInbound(partial: Partial<CarpoolRide> = {}): CarpoolRide {
  return ride({
    id: "inbound-accepted",
    status: "ACCEPTED",
    acceptingCircleId: circleId,
    acceptingCircleName: "Ours",
    acceptedByAdultId: "a1",
    kidIds: ["k-them"],
    kidFirstNames: ["Sam"],
    ...partial,
  })
}

describe("rideCommitmentConflict", () => {
  it("returns Type A when ACCEPTED inbound coexists with an in-play unassigned kid", () => {
    const inbound = acceptedInbound()
    const conflict = rideCommitmentConflict(
      event({ otherRequests: [inbound] }),
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
    const ownPending = ride({
      id: "own-pending",
      requestingCircleId: circleId,
      requestingCircleName: "Ours",
      requestedByAdultId: "a1",
      status: "PENDING",
      kidIds: ["k1"],
      kidFirstNames: ["Maya"],
    })
    const conflict = rideCommitmentConflict(
      event({ ownRequest: ownPending, otherRequests: [inbound] }),
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
      kidIds: ["k-them"],
      kidFirstNames: ["Sam"],
    })
    const ownAccepted = ride({
      id: "own-accepted",
      requestingCircleId: circleId,
      requestingCircleName: "Ours",
      requestedByAdultId: "a1",
      status: "ACCEPTED",
      acceptingCircleId: "c2",
      acceptingCircleName: "House B",
      acceptedByAdultId: "a2",
      kidIds: ["k1"],
      kidFirstNames: ["Maya"],
    })
    const conflict = rideCommitmentConflict(
      event({ ownRequest: ownAccepted, otherRequests: [inbound] }),
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
    const ownAccepted = ride({
      id: "own-accepted",
      requestingCircleId: circleId,
      status: "ACCEPTED",
      acceptingCircleId: "c2",
      acceptingCircleName: "House B",
      kidIds: ["k1"],
      kidFirstNames: ["Maya"],
    })
    expect(
      rideCommitmentConflict(
        event({ ownRequest: ownAccepted, otherRequests: [] }),
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
        event({ otherRequests: [inbound] }),
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
        event({ otherRequests: [inbound] }),
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
      kidIds: [sharedKid],
      kidFirstNames: ["Maya"],
    })
    const ownAccepted = ride({
      id: "own-accepted",
      requestingCircleId: circleId,
      status: "ACCEPTED",
      acceptingCircleId: "c2",
      acceptingCircleName: "House B",
      kidIds: [sharedKid],
      kidFirstNames: ["Maya"],
    })
    expect(
      rideCommitmentConflict(
        event({ ownRequest: ownAccepted, otherRequests: [inbound] }),
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
    const inbound = acceptedInbound({ kidIds: ["k-them"], kidFirstNames: ["Sam"] })
    const ownAccepted = ride({
      id: "own-accepted",
      requestingCircleId: circleId,
      status: "ACCEPTED",
      acceptingCircleId: "c2",
      acceptingCircleName: "House B",
      kidIds: ["k1"],
      kidFirstNames: ["Maya"],
    })
    const conflict = rideCommitmentConflict(
      event({ ownRequest: ownAccepted, otherRequests: [inbound] }),
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
      kidIds: ["k-them"],
      kidFirstNames: ["Sam"],
    })
    expect(
      rideCommitmentConflictChipLabel({
        kind: "needRideAndDriving",
        inbound,
        gapKidNames: ["Maya"],
      }),
    ).toBe(alsoDrivingKidLabel("Sam"))
  })

  it("uses Ride conflict for Type A multi inbound and Type B", () => {
    const multiInbound = acceptedInbound({
      kidIds: ["k-a", "k-b"],
      kidFirstNames: ["Sam", "Lee"],
    })
    expect(
      rideCommitmentConflictChipLabel({
        kind: "needRideAndDriving",
        inbound: multiInbound,
        gapKidNames: ["Maya"],
      }),
    ).toBe(RIDE_CONFLICT_CHIP)

    const inbound = acceptedInbound()
    const ownRequest = ride({
      id: "own",
      status: "ACCEPTED",
      kidIds: ["k1"],
      kidFirstNames: ["Maya"],
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
          kidIds: ["k-them"],
          kidFirstNames: ["Sam"],
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
          kidIds: ["k-them"],
          kidFirstNames: ["Sam"],
        }),
        ownRequest: ride({
          id: "own",
          status: "ACCEPTED",
          kidIds: ["k1"],
          kidFirstNames: ["Maya"],
        }),
      }),
    ).toBe(
      "You're driving Sam and Maya rides with them — pick one plan.",
    )
  })
})
