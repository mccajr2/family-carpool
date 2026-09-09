import { describe, expect, it } from "vitest"

import type { CarpoolRequest, CarpoolRide, CarpoolRideEvent } from "@/api/types"
import {
  canRoute,
  hasConfirmedToLeg,
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

describe("hasConfirmedToLeg", () => {
  it("is true only when the kid's need has TO CONFIRMED", () => {
    const row = game({ id: "g1" })
    expect(
      hasConfirmedToLeg(
        row,
        rideEvent({
          ownRequests: [
            ownNeed({
              status: "PARTIAL",
              legStatuses: [
                { leg: "TO", status: "CONFIRMED" },
                { leg: "FROM", status: "OPEN" },
              ],
            }),
          ],
        }),
      ),
    ).toBe(true)
    expect(
      hasConfirmedToLeg(
        row,
        rideEvent({
          ownRequests: [
            ownNeed({
              status: "PARTIAL",
              legStatuses: [
                { leg: "TO", status: "OPEN" },
                { leg: "FROM", status: "CONFIRMED" },
              ],
            }),
          ],
        }),
      ),
    ).toBe(false)
    expect(hasConfirmedToLeg(row, null)).toBe(false)
  })
})

describe("isTeammateOwnRide", () => {
  it("is true when a teammate Ride covers this kid on FULLY_COVERED or PARTIAL", () => {
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
        game({ id: "g-partial", ownRide: "partial" }),
        rideEvent({
          ownRequests: [
            ownNeed({
              status: "PARTIAL",
              legStatuses: [
                { leg: "TO", status: "CONFIRMED" },
                { leg: "FROM", status: "OPEN" },
              ],
            }),
          ],
          rides: [fulfillment({ passengerRequestIds: ["r1"] })],
        }),
      ),
    ).toBe(false)
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
  it("is true for household confirmed driver when going and no own need", () => {
    expect(
      canRoute(
        game({ id: "g1", ownRide: { driver: "You", confirmed: true } }),
        null,
      ),
    ).toBe(true)
  })

  it("is true for teammate FULLY_COVERED when TO is confirmed", () => {
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

  it("is true for PARTIAL when TO is confirmed even if FROM is still open", () => {
    expect(
      canRoute(
        game({ id: "g1", ownRide: "partial" }),
        rideEvent({
          ownRequests: [
            ownNeed({
              status: "PARTIAL",
              legStatuses: [
                { leg: "TO", status: "CONFIRMED" },
                { leg: "FROM", status: "OPEN" },
              ],
            }),
          ],
          rides: [fulfillment({ passengerRequestIds: ["r1"] })],
        }),
      ),
    ).toBe(true)
  })

  it("is false when only FROM is confirmed (no destination Route)", () => {
    expect(
      canRoute(
        game({ id: "g1", ownRide: "partial" }),
        rideEvent({
          ownRequests: [
            ownNeed({
              status: "PARTIAL",
              legsNeeded: ["FROM"],
              legStatuses: [{ leg: "FROM", status: "CONFIRMED" }],
            }),
          ],
          rides: [fulfillment({ leg: "FROM", passengerRequestIds: ["r1"] })],
        }),
      ),
    ).toBe(false)
    expect(
      canRoute(
        game({ id: "g2", ownRide: "partial" }),
        rideEvent({
          ownRequests: [
            ownNeed({
              status: "PARTIAL",
              legStatuses: [
                { leg: "TO", status: "OPEN" },
                { leg: "FROM", status: "CONFIRMED" },
              ],
            }),
          ],
        }),
      ),
    ).toBe(false)
  })

  it("is false while TO is still OPEN on an own need", () => {
    expect(
      canRoute(
        game({ id: "g1", ownRide: "requested" }),
        rideEvent({
          ownRequests: [
            ownNeed({
              status: "UNCOVERED",
              legStatuses: [
                { leg: "TO", status: "OPEN" },
                { leg: "FROM", status: "OPEN" },
              ],
            }),
          ],
        }),
      ),
    ).toBe(false)
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
  })

  it("is false when attendance is not_going even if TO is confirmed", () => {
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
