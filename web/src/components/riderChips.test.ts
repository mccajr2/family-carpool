import { describe, expect, it } from "vitest"

import type { CarpoolRequest, CarpoolRide, CarpoolRideEvent, Kid } from "@/api/types"
import {
  riderChipsAriaLabel,
  riderInitial,
  ridersForGameRow,
  ridersForItem,
} from "@/components/riderChips"
import type { CarpoolRequest as QueueCarpoolRequest, CoverageGameEvent } from "@/components/coverageQueue"

const kids: Kid[] = [
  { id: "k1", displayName: "Declan McCarthy" },
  { id: "k2", displayName: "Ben Rivera" },
  { id: "k3", displayName: "Maya" },
]

const confirmedLegs = [
  { leg: "TO" as const, status: "CONFIRMED" as const },
  { leg: "FROM" as const, status: "CONFIRMED" as const },
]

function request(partial: Partial<QueueCarpoolRequest> & Pick<QueueCarpoolRequest, "id">): QueueCarpoolRequest {
  return {
    requestingCircleName: "House B",
    kidFirstNames: ["Mia"],
    seats: 1,
    pickupPlaceName: "Home",
    pickupAddress: "1 Main",
    pickupTown: null,
    detourMinutes: null,
    status: "pending",
    ...partial,
  }
}

function game(
  partial: Partial<CoverageGameEvent> & Pick<CoverageGameEvent, "id" | "order">,
): CoverageGameEvent {
  return {
    kidId: "k1",
    title: partial.id,
    startsAt: new Date(partial.order).toISOString(),
    attendance: "going",
    ownRide: "unassigned",
    requests: [],
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
    legStatuses: confirmedLegs,
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

function fulfillment(partial: Partial<CarpoolRide> = {}): CarpoolRide {
  return {
    id: "fulfill-1",
    spaceId: "s1",
    eventKey: "UID:game",
    leg: "TO",
    driverAdultId: "a9",
    drivingCircleId: "c2",
    drivingCircleName: "Sharks",
    vehicleId: "v1",
    vehicleLabel: "Van",
    passengerRequestIds: ["r1"],
    status: "ACTIVE",
    ...partial,
  }
}

function rideEvent(partial: Partial<CarpoolRideEvent> = {}): CarpoolRideEvent {
  return {
    eventKey: "UID:game",
    title: "Practice",
    startsAt: "2030-08-15T17:00:00.000Z",
    endsAt: null,
    defaultKidIds: [],
    ownRequests: [],
    otherRequests: [],
    rides: [],
    ...partial,
  }
}

describe("riderInitial", () => {
  it("uppercases the first grapheme and uses ? when blank", () => {
    expect(riderInitial("declan")).toBe("D")
    expect(riderInitial("  ben  ")).toBe("B")
    expect(riderInitial("")).toBe("?")
    expect(riderInitial("   ")).toBe("?")
  })
})

describe("ridersForItem", () => {
  it("lists in-play confirmed-driver circle kids plus accepted teammate first names", () => {
    const games = [
      game({
        id: "g1",
        kidId: "k1",
        order: 100,
        ownRide: { driver: "You", confirmed: true },
        requests: [
          request({ id: "a1", status: "accepted", kidFirstNames: ["Sam Torres"] }),
          request({ id: "a2", status: "accepted", kidFirstNames: ["Leo"] }),
        ],
      }),
    ]

    expect(ridersForItem(games, kids)).toEqual([
      { firstName: "Declan", initial: "D" },
      { firstName: "Sam", initial: "S" },
      { firstName: "Leo", initial: "L" },
    ])
  })

  it("lists every in-play circle kid on a teammate ride", () => {
    const games = [
      game({
        id: "g1",
        kidId: "k1",
        order: 100,
        ownRide: { driver: "Sharks", confirmed: true },
      }),
      game({
        id: "g2",
        kidId: "k2",
        order: 200,
        ownRide: { driver: "Sharks", confirmed: true },
      }),
      game({
        id: "g3",
        kidId: "k3",
        order: 300,
        attendance: "not_going",
        ownRide: { driver: "Sharks", confirmed: true },
      }),
    ]
    const ownRequests = [
      ownNeed({ id: "r1", kidId: "k1" }),
      ownNeed({ id: "r2", kidId: "k2" }),
    ]
    const event = rideEvent({
      ownRequests,
      rides: [
        fulfillment({
          id: "f1",
          passengerRequestIds: ["r1"],
          drivingCircleId: "c2",
          drivingCircleName: "Sharks",
        }),
        fulfillment({
          id: "f2",
          passengerRequestIds: ["r2"],
          drivingCircleId: "c2",
          drivingCircleName: "Sharks",
        }),
      ],
    })

    expect(ridersForItem(games, kids, event)).toEqual([
      { firstName: "Declan", initial: "D" },
      { firstName: "Ben", initial: "B" },
    ])
  })

  it("returns empty for ride-needed, asked-team, pending-confirm, and not-going rows", () => {
    expect(
      ridersForItem([game({ id: "gap", order: 1, ownRide: "unassigned" })], kids),
    ).toEqual([])
    expect(
      ridersForItem([game({ id: "asked", order: 1, ownRide: "requested" })], kids),
    ).toEqual([])
    expect(
      ridersForItem(
        [game({ id: "pending", order: 1, ownRide: { driver: "You", confirmed: false } })],
        kids,
      ),
    ).toEqual([])
    expect(
      ridersForItem(
        [game({ id: "out", order: 1, attendance: "not_going" })],
        kids,
      ),
    ).toEqual([])
  })

  it("dedupes accepted teammate names and skips blank entries", () => {
    const games = [
      game({
        id: "g1",
        order: 1,
        ownRide: { driver: "You", confirmed: true },
        requests: [
          request({
            id: "a1",
            status: "accepted",
            kidFirstNames: ["Sam", "Sam", "  "],
          }),
          request({
            id: "a2",
            status: "accepted",
            kidFirstNames: ["sam"],
          }),
        ],
      }),
    ]

    expect(ridersForItem(games, kids)).toEqual([
      { firstName: "Declan", initial: "D" },
      { firstName: "Sam", initial: "S" },
    ])
  })

  it("shows both circle kids when they share a confirmed driver", () => {
    const games = [
      game({
        id: "g1",
        kidId: "k1",
        order: 100,
        ownRide: { driver: "You", confirmed: true },
      }),
      game({
        id: "g2",
        kidId: "k2",
        order: 200,
        ownRide: { driver: "You", confirmed: true },
      }),
    ]

    expect(ridersForItem(games, kids)).toEqual([
      { firstName: "Declan", initial: "D" },
      { firstName: "Ben", initial: "B" },
    ])
  })

  it("returns empty when an own-ride gap outranks a confirmed-driver kid", () => {
    const games = [
      game({
        id: "confirmed",
        kidId: "k2",
        order: 200,
        ownRide: { driver: "You", confirmed: true },
      }),
      game({
        id: "gap",
        kidId: "k1",
        order: 100,
        ownRide: "unassigned",
      }),
    ]

    expect(ridersForItem(games, kids)).toEqual([])
  })
})

describe("ridersForGameRow", () => {
  it("returns the circle kid for a confirmed-driver row", () => {
    const row = game({
      id: "g1",
      kidId: "k2",
      order: 1,
      ownRide: { driver: "You", confirmed: true },
    })

    expect(ridersForGameRow(row, [row], kids)).toEqual([
      { firstName: "Ben", initial: "B" },
    ])
  })

  it("returns the circle kid for a teammate-ride row", () => {
    const row = game({
      id: "g1",
      kidId: "k1",
      order: 1,
      ownRide: { driver: "Sharks", confirmed: true },
    })
    const ownRequests = [ownNeed({ id: "r1", kidId: "k1" })]
    const event = rideEvent({
      ownRequests,
      rides: [
        fulfillment({
          passengerRequestIds: ["r1"],
          drivingCircleId: "c2",
          drivingCircleName: "Sharks",
        }),
      ],
    })

    expect(ridersForGameRow(row, [row], kids, event)).toEqual([
      { firstName: "Declan", initial: "D" },
    ])
  })

  it("returns empty for unresolved or out-of-play rows", () => {
    const gap = game({ id: "gap", order: 1, ownRide: "unassigned" })
    const out = game({ id: "out", order: 1, attendance: "not_going" })

    expect(ridersForGameRow(gap, [gap], kids)).toEqual([])
    expect(ridersForGameRow(out, [out], kids)).toEqual([])
  })
})

describe("riderChipsAriaLabel", () => {
  it("names every rider for screen readers", () => {
    expect(
      riderChipsAriaLabel([
        { firstName: "Declan", initial: "D" },
        { firstName: "Ben", initial: "B" },
      ]),
    ).toBe("Riding: Declan, Ben")
    expect(riderChipsAriaLabel([])).toBe("")
  })
})
