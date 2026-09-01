import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import type { CarpoolRide, CarpoolRideEvent } from "@/api/types"
import {
  AgendaInboundRequestRow,
  inboundRequestStatusChip,
} from "@/components/AgendaInboundRequestRow"
import {
  REVERT_INBOUND_CANT_TAKE_THEM,
  REVERT_INBOUND_RECONSIDER,
  REVERT_INBOUND_UNDO,
} from "@/components/revertRideCopy"

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
}

const acceptedByUs: CarpoolRide = {
  ...pendingAsk,
  id: "ask-accepted",
  status: "ACCEPTED",
  acceptedByAdultId: "a1",
  acceptingCircleId: "c1",
  acceptingCircleName: "Ours",
  vehicleId: "v1",
  vehicleLabel: "Van",
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
  it("labels pending asks as Ride needed", () => {
    expect(inboundRequestStatusChip(pendingAsk, "c1")).toEqual({
      label: "Ride needed",
      tone: "amber",
    })
  })

  it("labels auto-declined asks with the mock Declined copy", () => {
    expect(
      inboundRequestStatusChip(pendingAsk, "c1", { autoDeclined: true }),
    ).toEqual({
      label: "Declined — you needed a ride too",
      tone: "muted",
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
        request={{
          ...pendingAsk,
          pickupTown: "Cambridge, MA",
          detourMinutes: 12,
        }}
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
    expect(within(row).queryByTestId("pickup-line")).not.toBeInTheDocument()
    expect(within(row).queryByRole("button", { name: "Accept" })).not.toBeInTheDocument()
    expect(within(row).queryByRole("button", { name: "Pass" })).not.toBeInTheDocument()
  })

  it("shows PickupLine below summary when not in hero handoff", () => {
    render(
      <AgendaInboundRequestRow
        request={{
          ...pendingAsk,
          pickupTown: "Cambridge, MA",
          detourMinutes: 12,
        }}
        circleId="c1"
        currentAdultId="a1"
        garage={garage}
        rideEvent={rideEvent}
        onAcceptRide={vi.fn()}
        onPassRide={vi.fn()}
      />,
    )

    expect(screen.getByTestId("pickup-line")).toHaveTextContent(
      "Pickup in Cambridge, MA · ~12 min out of your way (Bit of a detour)",
    )
  })

  it("replaces Withdraw with Can't take them anymore underlined link", async () => {
    const user = userEvent.setup()
    const onWithdrawRide = vi.fn()

    render(
      <AgendaInboundRequestRow
        request={acceptedByUs}
        circleId="c1"
        currentAdultId="a1"
        garage={garage}
        rideEvent={{ ...rideEvent, otherRequests: [acceptedByUs] }}
        onWithdrawRide={onWithdrawRide}
      />,
    )

    expect(screen.queryByRole("button", { name: "Withdraw" })).not.toBeInTheDocument()
    const link = screen.getByRole("button", { name: REVERT_INBOUND_CANT_TAKE_THEM })
    expect(link).toHaveClass("underline")
    await user.click(link)
    expect(onWithdrawRide).toHaveBeenCalledWith("ask-accepted")
  })

  it("shows Reconsider when autoDeclined and canOffer", async () => {
    const user = userEvent.setup()
    const onAcceptRide = vi.fn()

    render(
      <AgendaInboundRequestRow
        request={pendingAsk}
        circleId="c1"
        currentAdultId="a1"
        garage={garage}
        rideEvent={rideEvent}
        canOffer
        autoDeclined
        onAcceptRide={onAcceptRide}
        onPassRide={vi.fn()}
      />,
    )

    expect(screen.getByText("Declined — you needed a ride too")).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Accept" })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Pass" })).not.toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: REVERT_INBOUND_RECONSIDER }))
    expect(onAcceptRide).toHaveBeenCalledWith("ask-1", "v1")
  })

  it("hides Reconsider when autoDeclined but canOffer is false", () => {
    render(
      <AgendaInboundRequestRow
        request={pendingAsk}
        circleId="c1"
        currentAdultId="a1"
        garage={garage}
        rideEvent={rideEvent}
        autoDeclined
        onAcceptRide={vi.fn()}
      />,
    )

    expect(screen.getByText("Declined — you needed a ride too")).toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: REVERT_INBOUND_RECONSIDER }),
    ).not.toBeInTheDocument()
  })

  it("shows Undo when recentlyWithdrawn and canOffer", async () => {
    const user = userEvent.setup()
    const onAcceptRide = vi.fn()

    render(
      <AgendaInboundRequestRow
        request={pendingAsk}
        circleId="c1"
        currentAdultId="a1"
        garage={garage}
        rideEvent={rideEvent}
        canOffer
        recentlyWithdrawn
        onAcceptRide={onAcceptRide}
        onPassRide={vi.fn()}
      />,
    )

    expect(screen.queryByRole("button", { name: "Accept" })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Pass" })).not.toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: REVERT_INBOUND_UNDO }))
    expect(onAcceptRide).toHaveBeenCalledWith("ask-1", "v1")
  })

  it("keeps Accept for passed asks without Reconsider/Undo", async () => {
    const user = userEvent.setup()
    const onAcceptRide = vi.fn()
    const passed = { ...pendingAsk, passedByMe: true }

    render(
      <AgendaInboundRequestRow
        request={passed}
        circleId="c1"
        currentAdultId="a1"
        garage={garage}
        rideEvent={{ ...rideEvent, otherRequests: [passed] }}
        canOffer
        onAcceptRide={onAcceptRide}
        onPassRide={vi.fn()}
      />,
    )

    expect(screen.getByText("Passed")).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Pass" })).not.toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: REVERT_INBOUND_RECONSIDER }),
    ).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: REVERT_INBOUND_UNDO })).not.toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Accept" }))
    expect(onAcceptRide).toHaveBeenCalledWith("ask-1", "v1")
  })
})
