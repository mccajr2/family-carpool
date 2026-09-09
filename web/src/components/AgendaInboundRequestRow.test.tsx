import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import type { CarpoolRequest, CarpoolRide, CarpoolRideEvent } from "@/api/types"
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

function ask(partial: Partial<CarpoolRequest> = {}): CarpoolRequest {
  return {
    id: "ask-1",
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
    pickupAddress: "1 Main",
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
    id: "fulfill-1",
    spaceId: "s1",
    eventKey: "UID:game",
    leg: "TO",
    driverAdultId: "a1",
    drivingCircleId: "c1",
    drivingCircleName: "Ours",
    vehicleId: "v1",
    vehicleLabel: "Van",
    passengerRequestIds: ["ask-accepted"],
    status: "ACTIVE",
    ...partial,
  }
}

const pendingAsk = ask()

const acceptedByUs = ask({
  id: "ask-accepted",
  status: "FULLY_COVERED",
  legStatuses: [
    { leg: "TO", status: "CONFIRMED" },
    { leg: "FROM", status: "CONFIRMED" },
  ],
})

function event(partial: Partial<CarpoolRideEvent> = {}): CarpoolRideEvent {
  return {
    eventKey: "UID:game",
    title: "Practice",
    startsAt: "2030-08-15T17:00:00.000Z",
    endsAt: null,
    defaultKidIds: ["k1"],
    ownRequests: [],
    otherRequests: [pendingAsk],
    rides: [],
    ...partial,
  }
}

const rideEvent = event()

describe("inboundRequestStatusChip", () => {
  it("labels open asks as Ride needed", () => {
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
    expect(within(row).getByTestId("agenda-inbound-request-ask-1-hero-handoff")).toBeInTheDocument()
    expect(within(row).queryByRole("button", { name: "Accept" })).not.toBeInTheDocument()
    expect(within(row).queryByRole("button", { name: "Pass" })).not.toBeInTheDocument()
  })

  it("shows PickupLine below summary when not in hero handoff", () => {
    render(
      <AgendaInboundRequestRow
        request={ask({ pickupTown: "Cambridge", detourMinutes: 4 })}
        circleId="c1"
        currentAdultId="a1"
        garage={garage}
        rideEvent={rideEvent}
        onAcceptRide={vi.fn()}
        onPassRide={vi.fn()}
      />,
    )
    expect(screen.getByText(/Pickup in Cambridge/)).toBeInTheDocument()
  })

  it("replaces Withdraw with Can't take them anymore and calls with Ride id", async () => {
    const user = userEvent.setup()
    const onWithdrawRide = vi.fn()
    render(
      <AgendaInboundRequestRow
        request={acceptedByUs}
        circleId="c1"
        currentAdultId="a1"
        garage={garage}
        rideEvent={event({
          otherRequests: [acceptedByUs],
          rides: [fulfillment()],
        })}
        onWithdrawRide={onWithdrawRide}
      />,
    )
    await user.click(screen.getByRole("button", { name: REVERT_INBOUND_CANT_TAKE_THEM }))
    expect(onWithdrawRide).toHaveBeenCalledWith("fulfill-1")
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
        autoDeclined
        canOffer
        onAcceptRide={onAcceptRide}
      />,
    )
    expect(screen.queryByRole("button", { name: "Accept" })).not.toBeInTheDocument()
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
        canOffer={false}
        onAcceptRide={vi.fn()}
      />,
    )
    expect(screen.queryByRole("button", { name: REVERT_INBOUND_RECONSIDER })).not.toBeInTheDocument()
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
        recentlyWithdrawn
        canOffer
        onAcceptRide={onAcceptRide}
      />,
    )
    expect(screen.queryByRole("button", { name: "Accept" })).not.toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: REVERT_INBOUND_UNDO }))
    expect(onAcceptRide).toHaveBeenCalledWith("ask-1", "v1")
  })

  it("keeps Accept for passed asks without Reconsider/Undo", async () => {
    const user = userEvent.setup()
    const onAcceptRide = vi.fn()
    render(
      <AgendaInboundRequestRow
        request={ask({ passedByMe: true })}
        circleId="c1"
        currentAdultId="a1"
        garage={garage}
        rideEvent={event({ otherRequests: [ask({ passedByMe: true })] })}
        onAcceptRide={onAcceptRide}
        onPassRide={vi.fn()}
      />,
    )
    expect(screen.queryByRole("button", { name: "Pass" })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: REVERT_INBOUND_RECONSIDER })).not.toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Accept" }))
    expect(onAcceptRide).toHaveBeenCalledWith("ask-1", "v1")
  })

  it("offers per-leg Withdraw when driving both TO and FROM", async () => {
    const user = userEvent.setup()
    const onWithdrawRide = vi.fn()
    render(
      <AgendaInboundRequestRow
        request={acceptedByUs}
        circleId="c1"
        currentAdultId="a1"
        garage={garage}
        rideEvent={event({
          otherRequests: [acceptedByUs],
          rides: [
            fulfillment({ id: "ride-to", leg: "TO" }),
            fulfillment({ id: "ride-from", leg: "FROM" }),
          ],
        })}
        onWithdrawRide={onWithdrawRide}
      />,
    )
    await user.click(screen.getByRole("button", { name: /Withdraw to/ }))
    expect(onWithdrawRide).toHaveBeenCalledWith("ride-to")
    await user.click(screen.getByRole("button", { name: /Withdraw from/ }))
    expect(onWithdrawRide).toHaveBeenCalledWith("ride-from")
  })
})
