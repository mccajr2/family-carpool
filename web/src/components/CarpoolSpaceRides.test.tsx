import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import type { CarpoolRide, CarpoolRideEvent, Garage, Kid } from "@/api/types"
import { CarpoolSpaceRides } from "@/components/CarpoolSpaceRides"

const kids: Kid[] = [{ id: "k1", displayName: "Mia" }]

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
      make: "HONDA",
      model: "Odyssey",
      seats: 8,
      suggestedSeats: 8,
    },
  ],
}

function ride(partial: Partial<CarpoolRide> = {}): CarpoolRide {
  return {
    id: "ride-1",
    spaceId: "s1",
    eventKey: "UID:game",
    requestingCircleId: "c2",
    requestingCircleName: "House B",
    requestedByAdultId: "a2",
    kidIds: ["k2"],
    kidFirstNames: ["Leo"],
    seats: 1,
    pickupPlaceName: "Home",
    pickupAddress: "1 Main",
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
    startsAt: "2030-08-15T17:00:00.000Z",
    endsAt: null,
    defaultKidIds: [],
    ownRequest: null,
    otherRequests: [],
    ...partial,
  }
}

const noop = {
  onCreateRide: vi.fn(),
  onAcceptRide: vi.fn(),
  onCancelRide: vi.fn(),
  onWithdrawRide: vi.fn(),
}

describe("CarpoolSpaceRides pass", () => {
  it("offers Accept for a pending other ask the caller has not passed", () => {
    render(
      <CarpoolSpaceRides
        events={[event({ otherRequests: [ride()] })]}
        circleId="c1"
        adultId="a1"
        kids={kids}
        garage={garage}
        busy={false}
        {...noop}
      />,
    )
    expect(screen.getByText("Needs a ride")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Accept" })).toBeInTheDocument()
  })

  it("does not offer Accept after the caller has passed", () => {
    render(
      <CarpoolSpaceRides
        events={[event({ otherRequests: [ride({ passedByMe: true })] })]}
        circleId="c1"
        adultId="a1"
        kids={kids}
        garage={garage}
        busy={false}
        {...noop}
      />,
    )
    expect(screen.getByText("Practice")).toBeInTheDocument()
    expect(screen.getByText("Passed")).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Accept" })).not.toBeInTheDocument()
    expect(screen.queryByLabelText("Vehicle")).not.toBeInTheDocument()
  })
})
