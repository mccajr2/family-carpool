import { describe, expect, it } from "vitest"

import type { CarpoolRide, Kid } from "@/api/types"
import {
  riderChipsAriaLabel,
  riderInitial,
  ridersForGameRow,
  ridersForItem,
} from "@/components/riderChips"
import type { CarpoolRequest, CoverageGameEvent } from "@/components/coverageQueue"

const kids: Kid[] = [
  { id: "k1", displayName: "Declan McCarthy" },
  { id: "k2", displayName: "Ben Rivera" },
  { id: "k3", displayName: "Maya" },
]

function request(partial: Partial<CarpoolRequest> & Pick<CarpoolRequest, "id">): CarpoolRequest {
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

    expect(ridersForItem(games, null, kids)).toEqual([
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
    const accepted = ownRide({
      status: "ACCEPTED",
      acceptingCircleName: "Sharks",
      kidIds: ["k1", "k2"],
    })

    expect(ridersForItem(games, accepted, kids)).toEqual([
      { firstName: "Declan", initial: "D" },
      { firstName: "Ben", initial: "B" },
    ])
  })

  it("returns empty for ride-needed, asked-team, pending-confirm, and not-going rows", () => {
    expect(
      ridersForItem([game({ id: "gap", order: 1, ownRide: "unassigned" })], null, kids),
    ).toEqual([])
    expect(
      ridersForItem([game({ id: "asked", order: 1, ownRide: "requested" })], null, kids),
    ).toEqual([])
    expect(
      ridersForItem(
        [game({ id: "pending", order: 1, ownRide: { driver: "You", confirmed: false } })],
        null,
        kids,
      ),
    ).toEqual([])
    expect(
      ridersForItem(
        [game({ id: "out", order: 1, attendance: "not_going" })],
        null,
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

    expect(ridersForItem(games, null, kids)).toEqual([
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

    expect(ridersForItem(games, null, kids)).toEqual([
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

    expect(ridersForItem(games, null, kids)).toEqual([])
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

    expect(ridersForGameRow(row, [row], null, kids)).toEqual([
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
    const accepted = ownRide({
      status: "ACCEPTED",
      acceptingCircleName: "Sharks",
      kidIds: ["k1"],
    })

    expect(ridersForGameRow(row, [row], accepted, kids)).toEqual([
      { firstName: "Declan", initial: "D" },
    ])
  })

  it("returns empty for unresolved or out-of-play rows", () => {
    const gap = game({ id: "gap", order: 1, ownRide: "unassigned" })
    const out = game({ id: "out", order: 1, attendance: "not_going" })

    expect(ridersForGameRow(gap, [gap], null, kids)).toEqual([])
    expect(ridersForGameRow(out, [out], null, kids)).toEqual([])
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
