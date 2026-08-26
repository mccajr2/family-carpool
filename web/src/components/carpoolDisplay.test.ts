import { describe, expect, it } from "vitest"

import type { CarpoolRide, CarpoolRideEvent, Garage, Vehicle } from "@/api/types"
import {
  callerDrives,
  carpoolFeedStatusLabel,
  circleDisplayName,
  eligiblePendingRideAccept,
  eligibleVehiclesForAccept,
  enableCarpoolConfirmMessage,
  agendaOwnRideStatusChip,
  kidDisplayName,
  incomingRideAskSummary,
  ownRideStatusLine,
  ownYesKidCount,
  rideSeatsLabel,
} from "@/components/carpoolDisplay"

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
    expect(
      agendaOwnRideStatusChip(ride({ status: "PENDING", acceptingCircleName: null })),
    ).toEqual({ label: "Requested", tone: "amber" })
    expect(
      agendaOwnRideStatusChip(ride({ status: "ACCEPTED", acceptingCircleName: "House B" })),
    ).toEqual({ label: "Riding with House B", tone: "mint" })
    expect(
      agendaOwnRideStatusChip(ride({ status: "ACCEPTED", acceptingCircleName: "  " })),
    ).toEqual({ label: "Riding with a teammate", tone: "mint" })
    expect(ownRideStatusLine(ride({ status: "PENDING" }))).toBe("Requested")
    expect(
      ownRideStatusLine(ride({ status: "ACCEPTED", acceptingCircleName: "House B" })),
    ).toBe("Riding with House B")
    expect(ownRideStatusLine(ride({ status: "ACCEPTED", acceptingCircleName: null }))).toBe(
      "Riding with a teammate",
    )
  })

  it("summarizes an incoming ask for Focus Accept/Pass", () => {
    expect(
      incomingRideAskSummary(
        ride({
          requestingCircleName: "House B",
          kidFirstNames: ["Mia", "Leo"],
          pickupPlaceName: "Home",
          pickupAddress: "1 Main St",
        }),
      ),
    ).toBe("House B · Mia, Leo · Home, 1 Main St")
    expect(
      incomingRideAskSummary(
        ride({
          requestingCircleName: "  ",
          kidFirstNames: ["Mia"],
          pickupPlaceName: "School",
          pickupAddress: "2 Oak",
        }),
      ),
    ).toBe("Your family · Mia · School, 2 Oak")
  })

  it("counts YES kids as still-need-a-ride plus this circle's accepted request", () => {
    expect(ownYesKidCount(event({ defaultKidIds: ["k1", "k2"] }))).toBe(2)
    expect(
      ownYesKidCount(
        event({
          defaultKidIds: ["k2"],
          ownRequest: ride({ status: "ACCEPTED", kidIds: ["k1"] }),
        }),
      ),
    ).toBe(2)
  })

  it("defaults the only vehicle with remaining seats the caller may drive", () => {
    const van = vehicle({ id: "v1", seats: 8, driverAdultIds: ["a1"] })
    const compact = vehicle({ id: "v2", seats: 2, driverAdultIds: ["a1"] })
    const otherDriver = vehicle({ id: "v3", seats: 8, driverAdultIds: ["a2"] })
    const eventRow = event({ defaultKidIds: ["k1"] })
    const request = ride({ seats: 2, kidIds: ["k2", "k3"] })

    expect(
      eligibleVehiclesForAccept({
        drives: true,
        adultId: "a1",
        vehicles: [van, compact, otherDriver],
        event: eventRow,
        request,
      }).map((row) => row.id),
    ).toEqual(["v1"])
  })

  it("excludes vehicles already accepted on the event and when drives is false", () => {
    const van = vehicle({ id: "v1", seats: 8, driverAdultIds: ["a1"] })
    const eventRow = event({
      defaultKidIds: [],
      otherRequests: [ride({ status: "ACCEPTED", vehicleId: "v1", seats: 1 })],
    })
    expect(
      eligibleVehiclesForAccept({
        drives: true,
        adultId: "a1",
        vehicles: [van],
        event: eventRow,
        request: ride({ seats: 1 }),
      }),
    ).toEqual([])
    expect(
      eligibleVehiclesForAccept({
        drives: false,
        adultId: "a1",
        vehicles: [van],
        event: event({ defaultKidIds: [] }),
        request: ride({ seats: 1 }),
      }),
    ).toEqual([])
  })

  it("picks the first pending otherRequest that can be accepted", () => {
    const garage: Garage = {
      members: [{ adultId: "a1", displayName: "Alex", drives: true }],
      vehicles: [vehicle()],
    }
    const pending = ride({ id: "ask-1", status: "PENDING", passedByMe: false })
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
          ownRequest: ride({ id: "own", status: "PENDING" }),
          otherRequests: [ride({ id: "passed", passedByMe: true })],
        }),
        { adultId: "a1", garage },
      ),
    ).toBeNull()
  })
})

function ride(partial: Partial<CarpoolRide> = {}): CarpoolRide {
  return {
    id: "r1",
    spaceId: "s1",
    eventKey: "UID:game",
    requestingCircleId: "c2",
    requestingCircleName: "House B",
    requestedByAdultId: "a2",
    kidIds: ["k2"],
    kidFirstNames: ["Mia"],
    seats: 1,
    pickupPlaceName: "Home",
    pickupAddress: "1 Main St",
    status: "PENDING",
    passedByMe: false,
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
