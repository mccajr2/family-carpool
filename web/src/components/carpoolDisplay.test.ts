import { describe, expect, it } from "vitest"

import type {
  CarpoolRequest,
  CarpoolRide,
  CarpoolRideEvent,
  Garage,
  Vehicle,
} from "@/api/types"
import {
  acceptedByUsRequest,
  acceptedByUsRideDetailLine,
  callerDrives,
  cancelableRidesForRequest,
  carpoolFeedStatusLabel,
  circleDisplayName,
  eligiblePendingRideAccept,
  eligibleVehiclesForAccept,
  enableCarpoolConfirmMessage,
  agendaOwnRideStatusChip,
  isAcceptedByCircle,
  kidDisplayName,
  incomingRideAskSummary,
  openLegsNeeded,
  ownRideDetailLine,
  ownRideLegDetailLines,
  ownRideStatusLine,
  ownYesKidCount,
  partialRideStatusLabel,
  rideKidsSeatsPickup,
  rideLegActionLabel,
  rideSeatsLabel,
  vehicleCommittedForRequest,
  withdrawableRidesForRequest,
} from "@/components/carpoolDisplay"
import { ASKED_THE_TEAM, RIDING_WITH_TEAMMATE, ridingWithCircleLabel } from "@/components/coverageCopy"

describe("carpoolDisplay", () => {
  it("shows Your family when the circle name is blank", () => {
    expect(circleDisplayName(null)).toBe("Your family")
    expect(circleDisplayName("  ")).toBe("Your family")
    expect(circleDisplayName("House A")).toBe("House A")
  })

  it("labels feed carpool status", () => {
    expect(carpoolFeedStatusLabel("NONE")).toBe("No carpool")
    expect(carpoolFeedStatusLabel("AVAILABLE")).toBe("Carpool available")
    expect(carpoolFeedStatusLabel("REQUESTED")).toBe("Requested")
    expect(carpoolFeedStatusLabel("MEMBER")).toBe("Member")
    expect(carpoolFeedStatusLabel("OWNER")).toBe("Owned")
  })

  it("asks organizers to confirm ownership before Enable", () => {
    expect(enableCarpoolConfirmMessage("Soccer")).toContain("own the carpool for Soccer")
  })

  it("labels kids, seats, and drives", () => {
    expect(kidDisplayName([{ id: "k1", displayName: "Mia" }], "k1")).toBe("Mia")
    expect(kidDisplayName([], "k1")).toBe("Kid")
    expect(rideSeatsLabel(1)).toBe("1 seat")
    expect(rideSeatsLabel(2)).toBe("2 seats")
    expect(callerDrives(null, "a1")).toBe(false)
    expect(callerDrives({ members: [], vehicles: [] }, "a1")).toBe(true)
    expect(
      callerDrives(
        { members: [{ adultId: "a1", displayName: "Alex", drives: false }], vehicles: [] },
        "a1",
      ),
    ).toBe(false)
  })

  it("labels own ride chips and status lines for Agenda", () => {
    expect(agendaOwnRideStatusChip(null)).toBeNull()
    expect(agendaOwnRideStatusChip(request({ status: "UNCOVERED" }))).toEqual({
      label: ASKED_THE_TEAM,
      tone: "amber",
    })
    expect(
      agendaOwnRideStatusChip(
        request({ status: "FULLY_COVERED" }),
        [fulfillment({ drivingCircleName: "House B", passengerRequestIds: ["r1"] })],
      ),
    ).toEqual({ label: ridingWithCircleLabel("House B"), tone: "mint" })
    expect(
      agendaOwnRideStatusChip(request({ status: "FULLY_COVERED", acceptingCircleName: "  " })),
    ).toEqual({ label: RIDING_WITH_TEAMMATE, tone: "mint" })
    expect(
      agendaOwnRideStatusChip(
        request({
          status: "PARTIAL",
          legStatuses: [
            { leg: "TO", status: "CONFIRMED" },
            { leg: "FROM", status: "OPEN" },
          ],
        }),
      ),
    ).toEqual({
      label: "Round trip — to confirmed, from still needed",
      tone: "amber",
    })
    expect(ownRideStatusLine(request({ status: "UNCOVERED" }))).toBe("Requested")
    expect(
      ownRideStatusLine(
        request({ status: "UNCOVERED", passedByAdultNames: ["Sam", "Alex"] }),
      ),
    ).toBe("Passed by Sam, Alex")
    expect(
      ownRideStatusLine(request({ status: "FULLY_COVERED" }), [
        fulfillment({ drivingCircleName: "House B", passengerRequestIds: ["r1"] }),
      ]),
    ).toBe("Riding with House B")
    expect(ownRideStatusLine(request({ status: "FULLY_COVERED" }))).toBe(
      "Riding with a teammate",
    )
  })

  it("formats partial round-trip copy from leg statuses", () => {
    expect(
      partialRideStatusLabel(
        request({
          status: "PARTIAL",
          legStatuses: [
            { leg: "TO", status: "OPEN" },
            { leg: "FROM", status: "CONFIRMED" },
          ],
        }),
      ),
    ).toBe("Round trip — from confirmed, to still needed")
    expect(
      partialRideStatusLabel(
        request({
          status: "PARTIAL",
          legStatuses: [
            { leg: "TO", status: "CONFIRMED" },
            { leg: "FROM", status: "OPEN" },
          ],
        }),
      ),
    ).toBe("Round trip — to confirmed, from still needed")
    expect(
      openLegsNeeded(
        request({
          status: "PARTIAL",
          legStatuses: [
            { leg: "TO", status: "CONFIRMED" },
            { leg: "FROM", status: "OPEN" },
          ],
        }),
      ),
    ).toEqual(["FROM"])
    expect(openLegsNeeded(request({ status: "UNCOVERED" }))).toEqual(["TO", "FROM"])
  })

  it("formats kids · seats · pickup for shared ride detail tails", () => {
    expect(
      rideKidsSeatsPickup(
        request({
          kidFirstName: "Mia",
          pickupPlaceName: "Home",
          pickupAddress: "1 Main St",
        }),
      ),
    ).toBe("Mia · 1 seat · Home, 1 Main St")
  })

  it("summarizes an incoming ask with seats for Focus Accept/Pass", () => {
    expect(
      incomingRideAskSummary(
        request({
          requestingCircleName: "House B",
          kidFirstName: "Mia",
          pickupPlaceName: "Home",
          pickupAddress: "1 Main St",
        }),
      ),
    ).toBe("House B · Mia · 1 seat · Home, 1 Main St")
    expect(
      incomingRideAskSummary(
        request({
          requestingCircleName: "  ",
          kidFirstName: "Mia",
          pickupPlaceName: "School",
          pickupAddress: "2 Oak",
        }),
      ),
    ).toBe("Your family · Mia · 1 seat · School, 2 Oak")
  })

  it("builds own and accepted-by-us ride detail lines with Calendar field density", () => {
    expect(
      ownRideDetailLine(
        request({
          status: "UNCOVERED",
          kidFirstName: "Maya",
          pickupPlaceName: "Home",
          pickupAddress: "1 Main",
        }),
      ),
    ).toBe("Requested · Maya · 1 seat · Home, 1 Main")
    expect(
      ownRideDetailLine(
        request({
          status: "FULLY_COVERED",
          kidFirstName: "Maya",
          pickupPlaceName: "Home",
          pickupAddress: "1 Main",
        }),
        "Riding with House B",
      ),
    ).toBe("Riding with House B · Maya · 1 seat · Home, 1 Main")
    expect(
      acceptedByUsRideDetailLine(
        request({
          requestingCircleName: "House B",
          kidFirstName: "Mia",
          pickupPlaceName: "Home",
          pickupAddress: "1 Main",
        }),
      ),
    ).toBe("House B · Mia · 1 seat · Home, 1 Main")
  })

  it("emits per-leg fulfillment lines when TO and FROM rides differ", () => {
    expect(
      ownRideLegDetailLines(request({ id: "need-1" }), [
        fulfillment({
          id: "ride-to",
          leg: "TO",
          drivingCircleName: "House B",
          passengerRequestIds: ["need-1"],
        }),
        fulfillment({
          id: "ride-from",
          leg: "FROM",
          drivingCircleName: "Ours",
          passengerRequestIds: ["need-1"],
        }),
      ]),
    ).toEqual(["To: Riding with House B", "From: Riding with Ours"])
  })

  it("lists Cancel/Withdraw targets as active Ride ids (not request ids)", () => {
    const rideEvent = event({
      rides: [
        fulfillment({
          id: "ride-to",
          leg: "TO",
          drivingCircleId: "c1",
          passengerRequestIds: ["need-1"],
        }),
        fulfillment({
          id: "ride-from",
          leg: "FROM",
          drivingCircleId: "c9",
          passengerRequestIds: ["need-1"],
        }),
      ],
    })
    expect(cancelableRidesForRequest(rideEvent, "need-1").map((ride) => ride.id)).toEqual([
      "ride-to",
      "ride-from",
    ])
    expect(
      withdrawableRidesForRequest(rideEvent, "need-1", "c1").map((ride) => ride.id),
    ).toEqual(["ride-to"])
    expect(cancelableRidesForRequest(rideEvent, "missing")).toEqual([])
    expect(rideLegActionLabel("Cancel", "TO", 1)).toBe("Cancel")
    expect(rideLegActionLabel("Cancel", "FROM", 2)).toBe("Cancel from")
    expect(rideLegActionLabel("Withdraw", "TO", 2)).toBe("Withdraw to")
  })

  it("counts YES kids as still-need-a-ride plus FULLY_COVERED own needs", () => {
    expect(ownYesKidCount(event({ defaultKidIds: ["k1", "k2"] }))).toBe(2)
    expect(
      ownYesKidCount(
        event({
          defaultKidIds: ["k2"],
          ownRequests: [request({ status: "FULLY_COVERED", kidId: "k1" })],
        }),
      ),
    ).toBe(2)
    expect(
      ownYesKidCount(
        event({
          defaultKidIds: ["k2"],
          ownRequests: [request({ status: "PARTIAL", kidId: "k1" })],
        }),
      ),
    ).toBe(1)
  })

  it("defaults the only vehicle with remaining seats the caller may drive", () => {
    const van = vehicle({ id: "v1", seats: 8, driverAdultIds: ["a1"] })
    const compact = vehicle({ id: "v2", seats: 2, driverAdultIds: ["a1"] })
    const otherDriver = vehicle({ id: "v3", seats: 8, driverAdultIds: ["a2"] })
    const eventRow = event({ defaultKidIds: ["k1"] })
    const ask = request({ status: "UNCOVERED" })

    expect(
      eligibleVehiclesForAccept({
        drives: true,
        adultId: "a1",
        vehicles: [van, compact, otherDriver],
        event: eventRow,
        request: ask,
        passengerCount: 2,
      }).map((row) => row.id),
    ).toEqual(["v1"])
  })

  it("excludes vehicles already committed on an OPEN leg and when drives is false", () => {
    const van = vehicle({ id: "v1", seats: 8, driverAdultIds: ["a1"] })
    const ask = request({
      status: "UNCOVERED",
      legStatuses: [
        { leg: "TO", status: "OPEN" },
        { leg: "FROM", status: "OPEN" },
      ],
    })
    const eventRow = event({
      defaultKidIds: [],
      rides: [fulfillment({ vehicleId: "v1", leg: "TO", passengerRequestIds: ["other"] })],
    })
    expect(vehicleCommittedForRequest("v1", eventRow, ask)).toBe(true)
    expect(
      eligibleVehiclesForAccept({
        drives: true,
        adultId: "a1",
        vehicles: [van],
        event: eventRow,
        request: ask,
      }),
    ).toEqual([])
    // FROM-only commitment does not block a TO-only open ask on the same vehicle.
    const toOnlyAsk = request({
      status: "UNCOVERED",
      legsNeeded: ["TO"],
      legStatuses: [{ leg: "TO", status: "OPEN" }],
    })
    const fromCommitted = event({
      defaultKidIds: [],
      rides: [fulfillment({ vehicleId: "v1", leg: "FROM", passengerRequestIds: ["other"] })],
    })
    expect(vehicleCommittedForRequest("v1", fromCommitted, toOnlyAsk)).toBe(false)
    expect(
      eligibleVehiclesForAccept({
        drives: true,
        adultId: "a1",
        vehicles: [van],
        event: fromCommitted,
        request: toOnlyAsk,
      }).map((row) => row.id),
    ).toEqual(["v1"])
    expect(
      eligibleVehiclesForAccept({
        drives: false,
        adultId: "a1",
        vehicles: [van],
        event: event({ defaultKidIds: [] }),
        request: ask,
      }),
    ).toEqual([])
  })

  it("picks the first open otherRequest that can be accepted", () => {
    const garage: Garage = {
      members: [{ adultId: "a1", displayName: "Alex", drives: true }],
      vehicles: [vehicle()],
    }
    const pending = request({ id: "ask-1", status: "UNCOVERED", passedByMe: false })
    const eventRow = event({ otherRequests: [pending] })
    expect(eligiblePendingRideAccept(eventRow, { adultId: "a1", garage })?.id).toBe(
      "ask-1",
    )
  })

  it("skips passed asks and own requests for Focus accept eligibility", () => {
    const garage: Garage = {
      members: [{ adultId: "a1", displayName: "Alex", drives: true }],
      vehicles: [vehicle()],
    }
    expect(
      eligiblePendingRideAccept(
        event({
          ownRequests: [request({ id: "own", status: "UNCOVERED" })],
          otherRequests: [request({ id: "passed", passedByMe: true })],
        }),
        { adultId: "a1", garage },
      ),
    ).toBeNull()
  })

  it("detects teammate asks this circle is driving via active rides", () => {
    const ours = request({ id: "accepted-us" })
    const theirs = request({ id: "accepted-them" })
    const rides = [
      fulfillment({
        id: "ride-us",
        drivingCircleId: "c1",
        passengerRequestIds: ["accepted-us"],
      }),
      fulfillment({
        id: "ride-them",
        drivingCircleId: "c9",
        passengerRequestIds: ["accepted-them"],
      }),
    ]
    expect(isAcceptedByCircle(ours, "c1", rides)).toBe(true)
    expect(isAcceptedByCircle(theirs, "c1", rides)).toBe(false)
    expect(
      acceptedByUsRequest(event({ otherRequests: [theirs, ours], rides }), "c1")?.id,
    ).toBe("accepted-us")
    expect(acceptedByUsRequest(event({ otherRequests: [theirs], rides }), "c1")).toBeNull()
    expect(acceptedByUsRequest(null, "c1")).toBeNull()
  })
})

function request(partial: Partial<CarpoolRequest> = {}): CarpoolRequest {
  return {
    id: "r1",
    spaceId: "s1",
    eventKey: "UID:game",
    requestingCircleId: "c2",
    requestingCircleName: "House B",
    requestedByAdultId: "a2",
    kidId: "k2",
    kidFirstName: "Mia",
    legsNeeded: ["TO", "FROM"],
    legStatuses: [
      { leg: "TO", status: "OPEN" },
      { leg: "FROM", status: "OPEN" },
    ],
    pickupPlaceName: "Home",
    pickupAddress: "1 Main St",
    pickupTown: null,
    detourMinutes: null,
    status: "UNCOVERED",
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
    driverAdultId: "a1",
    drivingCircleId: "c1",
    drivingCircleName: "Ours",
    vehicleId: "v1",
    vehicleLabel: "Van",
    passengerRequestIds: ["r1"],
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

function vehicle(partial: Partial<Vehicle> = {}): Vehicle {
  return {
    id: "v1",
    ownerAdultId: "a1",
    driverAdultIds: ["a1"],
    keptAtPlaceId: null,
    label: "Van",
    year: 2019,
    make: "HONDA",
    model: "Odyssey",
    seats: 8,
    suggestedSeats: 8,
    ...partial,
  }
}
