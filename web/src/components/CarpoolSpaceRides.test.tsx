import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import type { CarpoolRideEvent, Garage, Kid } from "@/api/types"
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

function request(partial: Partial<import("@/api/types").CarpoolRequest> = {}): import("@/api/types").CarpoolRequest {
  return {
    id: "req-1",
    spaceId: "s1",
    eventKey: "UID:game",
    requestingCircleId: "c2",
    requestingCircleName: "House B",
    requestedByAdultId: "a2",
    kidId: "k2",
    kidFirstName: "Leo",
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
    defaultKidIds: [],
    ownRequests: [],
    otherRequests: [],
    rides: [],
    ...partial,
  }
}

const noop = {
  onCreateRide: vi.fn(),
  onAcceptRide: vi.fn(),
  onPassRide: vi.fn(),
  onCancelRide: vi.fn(),
  onWithdrawRide: vi.fn(),
}

describe("CarpoolSpaceRides pass", () => {
  it("offers Accept and Pass for a pending other ask the caller has not passed", async () => {
    const user = userEvent.setup()
    const onPassRide = vi.fn()
    render(
      <CarpoolSpaceRides
        events={[event({ otherRequests: [request()] })]}
        circleId="c1"
        adultId="a1"
        kids={kids}
        garage={garage}
        busy={false}
        {...noop}
        onPassRide={onPassRide}
      />,
    )
    expect(screen.getByText("Needs a ride")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Accept" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Pass" })).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Pass" }))
    expect(onPassRide).toHaveBeenCalledWith("req-1")
  })

  it("shows PickupLine before Accept/Pass when detour data is present", () => {
    render(
      <CarpoolSpaceRides
        events={[
          event({
            otherRequests: [
              request({
                pickupTown: "Cambridge, MA",
                detourMinutes: 4,
              }),
            ],
          }),
        ]}
        circleId="c1"
        adultId="a1"
        kids={kids}
        garage={garage}
        busy={false}
        {...noop}
      />,
    )

    const pickup = screen.getByTestId("pickup-line")
    expect(pickup).toHaveTextContent("Pickup in Cambridge, MA")
    expect(pickup).toHaveTextContent("~4 min out of your way")
    expect(screen.getByTestId("pickup-line-detour-pill")).toHaveStyle({
      color: "var(--fc-detour-on-way)",
    })
  })

  it("still offers Accept after the caller has passed, without Pass or un-pass", () => {
    render(
      <CarpoolSpaceRides
        events={[event({ otherRequests: [request({ passedByMe: true })] })]}
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
    expect(screen.getByRole("button", { name: "Accept" })).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Pass" })).not.toBeInTheDocument()
  })

  it("offers Pass without drives/vehicle when Accept is unavailable", () => {
    render(
      <CarpoolSpaceRides
        events={[event({ otherRequests: [request()] })]}
        circleId="c1"
        adultId="a1"
        kids={kids}
        garage={{
          members: [{ adultId: "a1", displayName: "Alex", drives: false }],
          vehicles: [],
        }}
        busy={false}
        {...noop}
      />,
    )
    expect(screen.queryByRole("button", { name: "Accept" })).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Pass" })).toBeInTheDocument()
  })

  it("shows Passed by names on own PENDING request", () => {
    render(
      <CarpoolSpaceRides
        events={[
          event({
            ownRequests: [
              request({
                id: "own-1",
                requestingCircleId: "c1",
                requestingCircleName: "Ours",
                kidId: "k1",
                kidFirstName: "Mia",
                status: "UNCOVERED",
                passedByAdultNames: ["Sam", "Alex"],
              }),
            ],
          }),
        ]}
        circleId="c1"
        adultId="a1"
        kids={kids}
        garage={garage}
        busy={false}
        {...noop}
      />,
    )
    expect(screen.getByText(/Passed by Sam, Alex/)).toBeInTheDocument()
    expect(screen.queryByText(/^Requested/)).not.toBeInTheDocument()
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
    expect(screen.getByTestId("ride-needed-legs")).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Request" }))
    expect(onCreateRide).toHaveBeenCalledWith("UID:game", ["k1"], "BOTH")
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
