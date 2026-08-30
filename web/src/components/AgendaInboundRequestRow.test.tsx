import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import type { CarpoolRide, CarpoolRideEvent } from "@/api/types"
import {
  AgendaInboundRequestRow,
  inboundRequestStatusChip,
} from "@/components/AgendaInboundRequestRow"

const garage = {
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

const pendingAsk: CarpoolRide = {
  id: "ask-1",
  spaceId: "s1",
  eventKey: "UID:game",
  requestingCircleId: "c2",
  requestingCircleName: "House B",
  requestedByAdultId: "a2",
  kidIds: ["k2"],
  kidFirstNames: ["Mia"],
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
}

const rideEvent: CarpoolRideEvent = {
  eventKey: "UID:game",
  title: "Practice",
  startsAt: "2030-08-15T17:00:00.000Z",
  endsAt: null,
  defaultKidIds: ["k1"],
  ownRequest: null,
  otherRequests: [pendingAsk],
}

describe("inboundRequestStatusChip", () => {
  it("labels pending asks as Needs a ride", () => {
    expect(inboundRequestStatusChip(pendingAsk, "c1")).toEqual({
      label: "Needs a ride",
      tone: "amber",
    })
  })
})

describe("AgendaInboundRequestRow", () => {
  it("shows Accept and Pass when the ask is not in the hero queue", async () => {
    const user = userEvent.setup()
    const onAcceptRide = vi.fn()
    const onPassRide = vi.fn()

    render(
      <AgendaInboundRequestRow
        request={pendingAsk}
        circleId="c1"
        currentAdultId="a1"
        garage={garage}
        rideEvent={rideEvent}
        onAcceptRide={onAcceptRide}
        onPassRide={onPassRide}
      />,
    )

    await user.click(screen.getByRole("button", { name: "Accept" }))
    expect(onAcceptRide).toHaveBeenCalledWith("ask-1", "v1")
    await user.click(screen.getByRole("button", { name: "Pass" }))
    expect(onPassRide).toHaveBeenCalledWith("ask-1")
  })

  it("shows hero handoff copy instead of Accept/Pass when queued above", () => {
    render(
      <AgendaInboundRequestRow
        request={pendingAsk}
        circleId="c1"
        currentAdultId="a1"
        garage={garage}
        rideEvent={rideEvent}
        inHeroQueue
        onAcceptRide={vi.fn()}
        onPassRide={vi.fn()}
      />,
    )

    const row = screen.getByTestId("agenda-inbound-request-ask-1")
    expect(
      within(row).getByText("Handle in Needs your attention above"),
    ).toBeInTheDocument()
    expect(within(row).queryByRole("button", { name: "Accept" })).not.toBeInTheDocument()
    expect(within(row).queryByRole("button", { name: "Pass" })).not.toBeInTheDocument()
  })
})
