import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import type { CarpoolRide } from "@/api/types"
import {
  AgendaInboundRequestRow,
  inboundRequestStatusChip,
} from "@/components/AgendaInboundRequestRow"
import {
  REVERT_INBOUND_CANT_TAKE_THEM,
  REVERT_INBOUND_RECONSIDER,
  REVERT_INBOUND_UNDO,
} from "@/components/revertRideCopy"
import { carpoolLegsBoth } from "@/api/carpoolLegs"


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
  legs: carpoolLegsBoth("ASKED_TEAM"),
}

const acceptedByUs: CarpoolRide = {
  ...pendingAsk,
  id: "ask-accepted",
  status: "ACCEPTED",
  acceptedByAdultId: "a1",
  acceptingCircleId: "c1",
  acceptingCircleName: "Ours",
}


describe("inboundRequestStatusChip", () => {
  it("defers pending asks to dual leg chips", () => {
    expect(inboundRequestStatusChip(pendingAsk, "c1")).toBeNull()
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
        onAcceptRide={onAcceptRide}
        onPassRide={onPassRide}
      />,
    )

    expect(screen.getByText("Round trip: Asked team")).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Accept" }))
    expect(onAcceptRide).toHaveBeenCalledWith("ask-1")
    await user.click(screen.getByRole("button", { name: "Pass" }))
    expect(onPassRide).toHaveBeenCalledWith("ask-1")
  })

  it("shows TO-only asks as distinct from round-trip", () => {
    render(
      <AgendaInboundRequestRow
        request={{
          ...pendingAsk,
          legs: [
            {
              kind: "TO",
              phase: "ASKED_TEAM",
              assigneeAdultId: null,
              assigneeDisplayName: null,
              assigneeCircleId: null,
              assigneeCircleName: null,
            },
            {
              kind: "FROM",
              phase: "NEEDS_RIDE",
              assigneeAdultId: null,
              assigneeDisplayName: null,
              assigneeCircleId: null,
              assigneeCircleName: null,
            },
          ],
        }}
        circleId="c1"
        onAcceptRide={vi.fn()}
        onPassRide={vi.fn()}
      />,
    )
    expect(screen.getByText("Getting there: Asked team")).toBeInTheDocument()
    expect(screen.getByText("Coming back: Needs ride")).toBeInTheDocument()
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
        onAcceptRide={vi.fn()}
        onPassRide={vi.fn()}
      />,
    )

    expect(screen.getByTestId("pickup-line")).toHaveTextContent("Pickup in Cambridge, MA")
    expect(screen.getByTestId("pickup-line-detour-pill")).toHaveTextContent(
      "~12 min out of your way",
    )
  })

  it("replaces Withdraw with Can't take them anymore underlined link", async () => {
    const user = userEvent.setup()
    const onWithdrawRide = vi.fn()

    render(
      <AgendaInboundRequestRow
        request={acceptedByUs}
        circleId="c1"
        onWithdrawRide={onWithdrawRide}
      />,
    )

    expect(screen.queryByRole("button", { name: "Withdraw" })).not.toBeInTheDocument()
    const link = screen.getByRole("button", { name: REVERT_INBOUND_CANT_TAKE_THEM })
    expect(link).toHaveClass("underline")
    await user.click(link)
    expect(onWithdrawRide).toHaveBeenCalledWith("ask-accepted", undefined)
  })

  it("uses Drop off copy and FROM-scoped withdraw for FROM-only accepted asks", async () => {
    const user = userEvent.setup()
    const onWithdrawRide = vi.fn()
    render(
      <AgendaInboundRequestRow
        request={{
          ...acceptedByUs,
          pickupTown: "Huron Ave",
          legs: [
            {
              kind: "TO",
              phase: "NEEDS_RIDE",
              assigneeAdultId: null,
              assigneeDisplayName: null,
              assigneeCircleId: null,
              assigneeCircleName: null,
            },
            {
              kind: "FROM",
              phase: "CONFIRMED",
              assigneeAdultId: "a1",
              assigneeDisplayName: "Alex",
              assigneeCircleId: "c1",
              assigneeCircleName: "Ours",
            },
          ],
        }}
        circleId="c1"
        onWithdrawRide={onWithdrawRide}
      />,
    )
    expect(screen.getByTestId("pickup-line")).toHaveTextContent("Drop off in Huron Ave")
    const link = screen.getByRole("button", { name: "Can't drive them home anymore?" })
    await user.click(link)
    expect(onWithdrawRide).toHaveBeenCalledWith("ask-accepted", ["FROM"])
  })

  it("shows Reconsider when autoDeclined and canOffer", async () => {
    const user = userEvent.setup()
    const onAcceptRide = vi.fn()

    render(
      <AgendaInboundRequestRow
        request={pendingAsk}
        circleId="c1"
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
    expect(onAcceptRide).toHaveBeenCalledWith("ask-1")
  })

  it("hides Reconsider when autoDeclined but canOffer is false", () => {
    render(
      <AgendaInboundRequestRow
        request={pendingAsk}
        circleId="c1"
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
        canOffer
        recentlyWithdrawn
        onAcceptRide={onAcceptRide}
        onPassRide={vi.fn()}
      />,
    )

    expect(screen.queryByRole("button", { name: "Accept" })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Pass" })).not.toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: REVERT_INBOUND_UNDO }))
    expect(onAcceptRide).toHaveBeenCalledWith("ask-1")
  })

  it("keeps Accept for passed asks without Reconsider/Undo", async () => {
    const user = userEvent.setup()
    const onAcceptRide = vi.fn()
    const passed = { ...pendingAsk, passedByMe: true }

    render(
      <AgendaInboundRequestRow
        request={passed}
        circleId="c1"
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
    expect(onAcceptRide).toHaveBeenCalledWith("ask-1")
  })
})
