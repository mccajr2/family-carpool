import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
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

describe("CarpoolSpaceRides request defaults", () => {
  it("shows Request when defaultKidIds is non-empty (Yes or No response)", async () => {
    const user = userEvent.setup()
    const onCreateRide = vi.fn()
    render(
      <CarpoolSpaceRides
        events={[event({ defaultKidIds: ["k1"] })]}
        circleId="c1"
        adultId="a1"
        kids={kids}
        garage={garage}
        busy={false}
        {...noop}
        onCreateRide={onCreateRide}
      />,
    )
    expect(
      screen.queryByText("Mark who's going on Calendar to request a ride."),
    ).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Request" })).toBeEnabled()
    await user.click(screen.getByRole("button", { name: "Request" }))
    expect(onCreateRide).toHaveBeenCalledWith("UID:game", undefined)
  })

  it("does not tell adults to RSVP Yes first when defaults are empty", () => {
    render(
      <CarpoolSpaceRides
        events={[event({ defaultKidIds: [] })]}
        circleId="c1"
        adultId="a1"
        kids={kids}
        garage={garage}
        busy={false}
        {...noop}
      />,
    )
    expect(
      screen.queryByText("Mark who's going on Calendar to request a ride."),
    ).not.toBeInTheDocument()
    expect(screen.getByText("No kids need a ride for this event.")).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Request" })).not.toBeInTheDocument()
  })
})
