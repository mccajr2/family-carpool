import { describe, expect, it } from "vitest"

import type { CarpoolRequest, CarpoolRide, CarpoolRideEvent } from "@/api/types"
import {
  canRoute,
  isHouseholdConfirmedDriver,
  isTeammateOwnRide,
} from "@/components/canRoute"
import type { CoverageGameEvent } from "@/components/coverageQueue"

function game(
  partial: Partial<CoverageGameEvent> & Pick<CoverageGameEvent, "id">,
): CoverageGameEvent {
  return {
    kidId: "k1",
    title: "Game",
    startsAt: "2030-08-15T17:00:00.000Z",
    order: 1,
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
    legStatuses: [
      { leg: "TO", status: "CONFIRMED" },
      { leg: "FROM", status: "CONFIRMED" },
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

function fulfillment(partial: Partial<CarpoolRide> = {}): CarpoolRide {
  return {
    id: "ride-1",
    spaceId: "s1",
    eventKey: "UID:game",
    leg: "TO",
    driverAdultId: "a9",
    drivingCircleId: "c2",
    drivingCircleName: "The Patels",
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
    title: "Game",
    startsAt: "2030-08-15T17:00:00.000Z",
    endsAt: null,
    defaultKidIds: [],
    ownRequests: [],
    otherRequests: [],
    rides: [],
    ...partial,
  }
}

describe("isTeammateOwnRide", () => {
  it("is true only when own-request is FULLY_COVERED by a teammate ride for this kid", () => {
    const row = game({ id: "g1", ownRide: { driver: "The Patels", confirmed: true } })
    expect(
      isTeammateOwnRide(
        row,
        rideEvent({
          ownRequests: [ownNeed({ status: "FULLY_COVERED", kidId: "k1" })],
          rides: [fulfillment({ passengerRequestIds: ["r1"] })],
        }),
      ),
    ).toBe(true)
    expect(
      isTeammateOwnRide(
        row,
        rideEvent({
          ownRequests: [ownNeed({ status: "FULLY_COVERED", kidId: "k2", id: "r2" })],
          rides: [fulfillment({ passengerRequestIds: ["r2"] })],
        }),
      ),
    ).toBe(false)
    expect(
      isTeammateOwnRide(
        row,
        rideEvent({
          ownRequests: [ownNeed({ status: "UNCOVERED" })],
        }),
      ),
    ).toBe(false)
    expect(isTeammateOwnRide(row, null)).toBe(false)
  })
})

describe("isHouseholdConfirmedDriver", () => {
  it("is true for confirmed household driver, false for teammate FULLY_COVERED", () => {
    const household = game({
      id: "g1",
      ownRide: { driver: "You", confirmed: true },
    })
    expect(isHouseholdConfirmedDriver(household, null)).toBe(true)

    const teammate = game({
      id: "g2",
      ownRide: { driver: "The Patels", confirmed: true },
    })
    expect(
      isHouseholdConfirmedDriver(
        teammate,
        rideEvent({
          ownRequests: [ownNeed({ status: "FULLY_COVERED", kidId: "k1" })],
          rides: [fulfillment({ passengerRequestIds: ["r1"] })],
        }),
      ),
    ).toBe(false)
  })
})

describe("canRoute", () => {
  it("is true for household confirmed driver when going", () => {
    expect(
      canRoute(
        game({ id: "g1", ownRide: { driver: "You", confirmed: true } }),
        null,
      ),
    ).toBe(true)
  })

  it("is true for teammate-driving (FULLY_COVERED own-request) when going", () => {
    expect(
      canRoute(
        game({
          id: "g1",
          ownRide: { driver: "The Patels", confirmed: true },
        }),
        rideEvent({
          ownRequests: [ownNeed({ status: "FULLY_COVERED", kidId: "k1" })],
          rides: [fulfillment({ passengerRequestIds: ["r1"] })],
        }),
      ),
    ).toBe(true)
  })

  it("is false for unassigned, pending household confirm, and open team ask", () => {
    expect(canRoute(game({ id: "g1", ownRide: "unassigned" }), null)).toBe(false)
    expect(
      canRoute(
        game({ id: "g2", ownRide: { driver: "You", confirmed: false } }),
        null,
      ),
    ).toBe(false)
    expect(canRoute(game({ id: "g3", ownRide: "requested" }), null)).toBe(false)
    expect(
      canRoute(
        game({ id: "g4", ownRide: "requested" }),
        rideEvent({ ownRequests: [ownNeed({ status: "UNCOVERED" })] }),
      ),
    ).toBe(false)
  })

  it("is false when attendance is not_going even if ride is confirmed", () => {
    expect(
      canRoute(
        game({
          id: "g1",
          attendance: "not_going",
          ownRide: { driver: "You", confirmed: true },
        }),
        null,
      ),
    ).toBe(false)
    expect(
      canRoute(
        game({
          id: "g2",
          attendance: "not_going",
          ownRide: { driver: "The Patels", confirmed: true },
        }),
        rideEvent({
          ownRequests: [ownNeed({ status: "FULLY_COVERED", kidId: "k1" })],
          rides: [fulfillment({ passengerRequestIds: ["r1"] })],
        }),
      ),
    ).toBe(false)
  })
})
