import { describe, expect, it, vi } from "vitest"

import type { CarpoolRequest, CarpoolRideEvent, Garage } from "@/api/types"
import {
  createHouseholdLegRides,
  vehicleIdForDriver,
} from "@/components/householdLegRides"

function request(partial: Partial<CarpoolRequest> = {}): CarpoolRequest {
  return {
    id: "need-1",
    spaceId: "s1",
    eventKey: "UID:game",
    requestingCircleId: "c1",
    requestingCircleName: "Ours",
    requestedByAdultId: "a1",
    kidId: "k1",
    kidFirstName: "Sam",
    legsNeeded: ["TO", "FROM"],
    legStatuses: [
      { leg: "TO", status: "OPEN" },
      { leg: "FROM", status: "OPEN" },
    ],
    pickupPlaceName: "Home",
    pickupAddress: "1 Main",
    pickupTown: null,
    detourMinutes: null,
    status: "UNCOVERED",
    passedByMe: false,
    passedByAdultNames: [],
    ...partial,
  }
}

function event(partial: Partial<CarpoolRideEvent> = {}): CarpoolRideEvent {
  return {
    eventKey: "UID:game",
    title: "Practice",
    startsAt: "2030-08-15T17:00:00.000Z",
    endsAt: null,
    defaultKidIds: ["k1"],
    ownRequests: [],
    otherRequests: [],
    rides: [],
    ...partial,
  }
}

const garage: Garage = {
  members: [{ adultId: "a1", displayName: "Alex", drives: true }],
  vehicles: [
    {
      id: "v1",
      ownerAdultId: "a1",
      driverAdultIds: ["a1"],
      keptAtPlaceId: null,
      label: "Van",
      year: 2019,
      make: "Honda",
      model: "Odyssey",
      seats: 8,
      suggestedSeats: 8,
    },
    {
      id: "v2",
      ownerAdultId: "a2",
      driverAdultIds: ["a2"],
      keptAtPlaceId: null,
      label: "SUV",
      year: 2021,
      make: "Toyota",
      model: "Highlander",
      seats: 7,
      suggestedSeats: 7,
    },
  ],
}

describe("vehicleIdForDriver", () => {
  it("returns the first vehicle the adult may drive", () => {
    expect(vehicleIdForDriver(garage, "a1")).toBe("v1")
    expect(vehicleIdForDriver(garage, "a2")).toBe("v2")
    expect(vehicleIdForDriver(garage, "missing")).toBeNull()
    expect(vehicleIdForDriver(null, "a1")).toBeNull()
  })
})

describe("createHouseholdLegRides", () => {
  it("creates TO and FROM rides for an existing uncovered round-trip need", async () => {
    const createCarpoolRequest = vi.fn()
    const createRide = vi.fn().mockResolvedValue({})
    await createHouseholdLegRides({
      client: { createCarpoolRequest, createRide } as never,
      accessToken: "tok",
      spaceId: "s1",
      eventKey: "UID:game",
      kidIds: ["k1"],
      rideEvent: event({ ownRequests: [request()] }),
      vehicleId: "v1",
    })
    expect(createCarpoolRequest).not.toHaveBeenCalled()
    expect(createRide).toHaveBeenCalledTimes(2)
    expect(createRide).toHaveBeenNthCalledWith(1, "tok", "s1", {
      eventKey: "UID:game",
      leg: "TO",
      vehicleId: "v1",
      passengerRequestIds: ["need-1"],
    })
    expect(createRide).toHaveBeenNthCalledWith(2, "tok", "s1", {
      eventKey: "UID:game",
      leg: "FROM",
      vehicleId: "v1",
      passengerRequestIds: ["need-1"],
    })
  })

  it("creates a need then one Ride when PARTIAL only has FROM open", async () => {
    const createCarpoolRequest = vi.fn()
    const createRide = vi.fn().mockResolvedValue({})
    await createHouseholdLegRides({
      client: { createCarpoolRequest, createRide } as never,
      accessToken: "tok",
      spaceId: "s1",
      eventKey: "UID:game",
      kidIds: ["k1"],
      rideEvent: event({
        ownRequests: [
          request({
            status: "PARTIAL",
            legStatuses: [
              { leg: "TO", status: "CONFIRMED" },
              { leg: "FROM", status: "OPEN" },
            ],
          }),
        ],
      }),
      vehicleId: "v1",
    })
    expect(createRide).toHaveBeenCalledTimes(1)
    expect(createRide).toHaveBeenCalledWith("tok", "s1", {
      eventKey: "UID:game",
      leg: "FROM",
      vehicleId: "v1",
      passengerRequestIds: ["need-1"],
    })
  })

  it("creates missing needs then batches same-leg passengers on one Ride per leg", async () => {
    const createCarpoolRequest = vi
      .fn()
      .mockResolvedValueOnce(request({ id: "need-a", kidId: "k1" }))
      .mockResolvedValueOnce(request({ id: "need-b", kidId: "k2", kidFirstName: "Riley" }))
    const createRide = vi.fn().mockResolvedValue({})
    await createHouseholdLegRides({
      client: { createCarpoolRequest, createRide } as never,
      accessToken: "tok",
      spaceId: "s1",
      eventKey: "UID:game",
      kidIds: ["k1", "k2"],
      rideEvent: event({ ownRequests: [], defaultKidIds: ["k1", "k2"] }),
      vehicleId: "v1",
      legs: "BOTH",
    })
    expect(createCarpoolRequest).toHaveBeenCalledTimes(2)
    expect(createRide).toHaveBeenCalledTimes(2)
    expect(createRide.mock.calls[0]![2].passengerRequestIds).toEqual(["need-a", "need-b"])
    expect(createRide.mock.calls[0]![2].leg).toBe("TO")
    expect(createRide.mock.calls[1]![2].passengerRequestIds).toEqual(["need-a", "need-b"])
    expect(createRide.mock.calls[1]![2].leg).toBe("FROM")
  })

  it("no-ops when kidIds is empty", async () => {
    const createRide = vi.fn()
    await createHouseholdLegRides({
      client: { createCarpoolRequest: vi.fn(), createRide } as never,
      accessToken: "tok",
      spaceId: "s1",
      eventKey: "UID:game",
      kidIds: [],
      rideEvent: event(),
      vehicleId: "v1",
    })
    expect(createRide).not.toHaveBeenCalled()
  })
})
