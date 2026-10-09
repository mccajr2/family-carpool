import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import type {
  CalendarItem,
  CarpoolRide,
  CarpoolRideEvent,
  CarpoolRideLeg,
  FamilyCircle,
} from "@/api/types"
import { AgendaBlockCard } from "@/components/AgendaBlockCard"

const circle: FamilyCircle = {
  id: "c1",
  name: "House",
  role: "ORGANIZER",
  members: [
    {
      adultId: "a1",
      email: "chris@example.com",
      displayName: "Chris",
      role: "ORGANIZER",
    },
    {
      adultId: "a2",
      email: "mom@example.com",
      displayName: "Mom",
      role: "CAREGIVER",
    },
  ],
  kids: [
    { id: "k1", displayName: "Declan" },
    { id: "k2", displayName: "Kian" },
  ],
  places: [],
  defaultLeaveFromPlaceId: null,
  defaultLeaveFromPlaceName: null,
}

function item(
  id: string,
  startsAt: string,
  overrides: Partial<CalendarItem> = {},
): CalendarItem {
  return {
    id,
    source: "FEED",
    title: id === "a" ? "Practice A" : id === "b" ? "Practice B" : id,
    startsAt,
    endsAt: null,
    location: "Simoni Rink",
    kidIds: ["k1"],
    feedId: "f1",
    feedName: "U12",
    eventKey: `UID:${id}`,
    leaveFromPlaceId: null,
    leaveFromPlaceName: null,
    leaveFromAddress: null,
    leaveByAt: null,
    leaveByStatus: "UNAVAILABLE",
    leaveByReason: "NO_ORIGIN",
    coverages: [],
    uncoveredKidIds: [],
    conflicts: [],
    rsvps: [{ kidId: "k1", status: "YES" }],
    driveBlockLinks: [],
    ...overrides,
  }
}

function confirmedLeg(
  kind: "TO" | "FROM",
  adultId: string,
  name: string,
): CarpoolRideLeg {
  return {
    kind,
    phase: "CONFIRMED",
    assigneeAdultId: adultId,
    assigneeDisplayName: name,
    assigneeCircleId: "c1",
    assigneeCircleName: "House",
    placeId: null,
    placeName: null,
    placeAddress: null,
    meetSide: "REQUESTER",
  }
}

function rideEventForMap(
  byId: Record<string, CarpoolRideEvent>,
): (row: CalendarItem) => CarpoolRideEvent | null {
  return (row) => byId[row.id] ?? null
}

async function expandBlock(
  user: ReturnType<typeof userEvent.setup>,
  card: HTMLElement = screen.getByTestId("agenda-block-card"),
) {
  await user.click(within(card).getByTestId("agenda-block-header"))
}

describe("AgendaBlockCard", () => {
  it("renders one card with runs, event bands, and muted not-your-job band", async () => {
    const user = userEvent.setup()
    const members = [
      item("a", "2030-08-15T18:00:00.000Z", {
        endsAt: "2030-08-15T19:00:00.000Z",
        leaveByAt: "2030-08-15T17:40:00.000Z",
        kidIds: ["k1", "k2"],
        rsvps: [
          { kidId: "k1", status: "YES" },
          { kidId: "k2", status: "YES" },
        ],
        driveBlockLinks: [
          {
            leg: "TO",
            otherSource: "FEED",
            otherId: "b",
            otherTitle: "Practice B",
            otherStartsAt: "2030-08-15T19:00:00.000Z",
            combined: true,
            overrideAction: null,
          },
        ],
      }),
      item("b", "2030-08-15T19:00:00.000Z", {
        endsAt: "2030-08-15T20:00:00.000Z",
        driveBlockLinks: [
          {
            leg: "TO",
            otherSource: "FEED",
            otherId: "a",
            otherTitle: "Practice A",
            otherStartsAt: "2030-08-15T18:00:00.000Z",
            combined: true,
            overrideAction: null,
          },
        ],
      }),
    ]

    const rideA: CarpoolRide = {
      id: "r-a",
      spaceId: "s1",
      eventKey: "UID:a",
      requestingCircleId: "c1",
      requestingCircleName: "House",
      requestedByAdultId: "a1",
      kidIds: ["k1", "k2"],
      kidFirstNames: ["Declan", "Kian"],
      seats: 2,
      pickupPlaceName: "Home",
      pickupAddress: "1 Main",
      pickupTown: null,
      detourMinutes: null,
      status: "PENDING",
      legs: [
        confirmedLeg("TO", "a1", "Chris"),
        confirmedLeg("FROM", "a2", "Mom"),
      ],
      passedByMe: false,
      passedByAdultNames: [],
      acceptedByAdultId: null,
      acceptingCircleId: null,
      acceptingCircleName: null,
    }
    const rideB: CarpoolRide = {
      ...rideA,
      id: "r-b",
      eventKey: "UID:b",
      kidIds: ["k1"],
      kidFirstNames: ["Declan"],
      seats: 1,
      legs: [confirmedLeg("FROM", "a1", "Chris")],
    }

    const onDriveBlockLink = vi.fn()
    render(
      <AgendaBlockCard
        items={members}
        circle={circle}
        currentAdultId="a1"
        rideEventFor={rideEventForMap({
          a: {
            eventKey: "UID:a",
            title: "Practice A",
            startsAt: members[0]!.startsAt,
            endsAt: members[0]!.endsAt,
            defaultKidIds: ["k1", "k2"],
            ownRequests: [rideA],
            ownLegs: rideA.legs,
            ownRequest: rideA,
            otherRequests: [],
          },
          b: {
            eventKey: "UID:b",
            title: "Practice B",
            startsAt: members[1]!.startsAt,
            endsAt: members[1]!.endsAt,
            defaultKidIds: ["k1"],
            ownRequests: [rideB],
            ownLegs: rideB.legs,
            ownRequest: rideB,
            otherRequests: [],
          },
        })}
        onDriveBlockLink={onDriveBlockLink}
      />,
    )

    const card = screen.getByTestId("agenda-block-card")
    expect(within(card).getByTestId("agenda-block-title")).toHaveTextContent(
      "Practice A + Practice B",
    )
    expect(within(card).getByTestId("agenda-block-title").className).toContain(
      "--fc-font-list-row-title-size",
    )
    expect(within(card).getByTestId("agenda-block-eyebrow")).toHaveTextContent("U12")
    expect(within(card).getByTestId("agenda-block-when").textContent).toMatch(
      /Aug|Sep/,
    )
    expect(card.textContent).not.toMatch(/Two events tonight|\d+ events tonight/)
    expect(within(card).getByTestId("agenda-block-chevron")).toHaveAttribute(
      "aria-label",
      "Expand Practice A + Practice B",
    )
    expect(within(card).getByTestId("agenda-block-header")).toHaveAttribute(
      "aria-expanded",
      "false",
    )
    expect(within(card).getByTestId("agenda-block-kid-rows").children).toHaveLength(3)
    expect(within(card).getByTestId("agenda-block-kid-FEED-a-k1")).toHaveTextContent(
      /Declan/,
    )
    expect(within(card).getByTestId("agenda-block-kid-FEED-a-k2")).toHaveTextContent(
      /There You · Back Mom/,
    )
    expect(within(card).getByTestId("agenda-block-kid-FEED-b-k1")).toHaveTextContent(
      /Declan/,
    )
    expect(within(card).queryByText(/Plan locked/)).not.toBeInTheDocument()
    expect(screen.queryByText("Show details")).not.toBeInTheDocument()
    expect(screen.queryByText("Hide details")).not.toBeInTheDocument()

    await expandBlock(user, card)
    expect(within(card).getByTestId("agenda-block-header")).toHaveAttribute(
      "aria-expanded",
      "true",
    )
    expect(within(card).queryByTestId("agenda-block-kid-rows")).not.toBeInTheDocument()
    expect(within(card).getByTestId("agenda-block-kid-plan-FEED-a-k2")).toHaveTextContent(
      /Getting there/,
    )
    expect(within(card).getByTestId("agenda-block-kid-plan-FEED-a-k2")).toHaveTextContent(
      /Coming back/,
    )
    expect(within(card).getByTestId("agenda-block-kid-plan-FEED-a-k2")).toHaveTextContent(
      /Mom/,
    )
    const links = within(card).getByTestId("agenda-block-drive-block-links")
    expect(within(links).getAllByRole("button")).toHaveLength(1)
    expect(within(links).getByRole("button", { name: "Split into 2 events" })).toBeInTheDocument()
    expect(screen.queryByTestId("agenda-row-FEED-a")).not.toBeInTheDocument()
    // No handler → no View route (same gate as AgendaRow).
    expect(screen.queryByTestId("agenda-block-run-to-view-route")).not.toBeInTheDocument()
    expect(screen.queryByTestId("agenda-block-run-from-view-route")).not.toBeInTheDocument()
  })

  it("omits shared team eyebrow when members have mixed feeds", () => {
    render(
      <AgendaBlockCard
        items={[
          item("a", "2030-08-15T18:00:00.000Z", {
            feedName: "U10 Soccer",
            title: "Practice",
            kidIds: ["k1"],
            rsvps: [{ kidId: "k1", status: "YES" }],
          }),
          item("b", "2030-08-15T19:15:00.000Z", {
            feedName: "U12 Soccer",
            title: "Practice",
            kidIds: ["k2"],
            rsvps: [{ kidId: "k2", status: "YES" }],
          }),
        ]}
        circle={circle}
        currentAdultId="a1"
        rideEventFor={() => null}
      />,
    )

    const card = screen.getByTestId("agenda-block-card")
    expect(within(card).getByTestId("agenda-block-title")).toHaveTextContent("Practice")
    expect(within(card).getByTestId("agenda-block-eyebrow")).toHaveTextContent(
      "U10 Soccer + U12 Soccer",
    )
    expect(within(card).getByTestId("agenda-block-kid-FEED-a-k1")).toHaveTextContent(
      /Declan/,
    )
    expect(within(card).getByTestId("agenda-block-kid-FEED-a-k1")).toHaveTextContent(
      /U10 Soccer/,
    )
    expect(within(card).getByTestId("agenda-block-kid-FEED-b-k2")).toHaveTextContent(
      /Kian/,
    )
    expect(within(card).getByTestId("agenda-block-kid-FEED-b-k2")).toHaveTextContent(
      /U12 Soccer/,
    )
  })

  it("uses title in band lines when feedName is absent", () => {
    render(
      <AgendaBlockCard
        items={[
          item("a", "2030-08-15T18:00:00.000Z", {
            feedName: null,
            title: "Piano lesson",
            kidIds: ["k1"],
            rsvps: [{ kidId: "k1", status: "YES" }],
          }),
          item("b", "2030-08-15T19:15:00.000Z", {
            feedName: null,
            title: "Swim practice",
            kidIds: ["k2"],
            rsvps: [{ kidId: "k2", status: "YES" }],
          }),
        ]}
        circle={circle}
        currentAdultId="a1"
        rideEventFor={() => null}
      />,
    )

    const card = screen.getByTestId("agenda-block-card")
    expect(within(card).queryByTestId("agenda-block-eyebrow")).not.toBeInTheDocument()
    expect(within(card).getByTestId("agenda-block-title")).toHaveTextContent(
      "Piano lesson + Swim practice",
    )
    expect(within(card).getByTestId("agenda-block-kid-FEED-a-k1")).toHaveTextContent(
      /Piano lesson/,
    )
    expect(within(card).getByTestId("agenda-block-kid-FEED-b-k2")).toHaveTextContent(
      /Swim practice/,
    )
  })

  it("keeps status chips visible on the collapsed header when plans diverge", () => {
    render(
      <AgendaBlockCard
        items={[
          item("a", "2030-08-15T18:00:00.000Z", {
            uncoveredKidIds: ["k1"],
            kidIds: ["k1"],
            rsvps: [{ kidId: "k1", status: "YES" }],
          }),
          item("b", "2030-08-15T19:15:00.000Z", {
            uncoveredKidIds: ["k2"],
            kidIds: ["k2"],
            rsvps: [{ kidId: "k2", status: "YES" }],
          }),
        ]}
        circle={circle}
        currentAdultId="a1"
        rideEventFor={() => null}
      />,
    )

    const card = screen.getByTestId("agenda-block-card")
    expect(within(card).getByTestId("agenda-block-header")).toHaveAttribute(
      "aria-expanded",
      "false",
    )
    expect(within(card).getByTestId("agenda-block-chevron")).toBeInTheDocument()
    expect(within(card).getByTestId("agenda-block-chip-strip").textContent).toMatch(
      /Ride needed/i,
    )
    expect(within(card).queryByText(/Plan locked/)).not.toBeInTheDocument()
  })

  it("opens dual-leg Route for the earliest member via View route on a TO run", async () => {
    const user = userEvent.setup()
    const onOpenRide = vi.fn()
    const members = [
      item("a", "2030-08-15T18:00:00.000Z", {
        endsAt: "2030-08-15T19:00:00.000Z",
        leaveByAt: "2030-08-15T17:40:00.000Z",
        kidIds: ["k1"],
        driveBlockLinks: [
          {
            leg: "TO",
            otherSource: "FEED",
            otherId: "b",
            otherTitle: "Practice B",
            otherStartsAt: "2030-08-15T19:00:00.000Z",
            combined: true,
            overrideAction: null,
          },
        ],
      }),
      item("b", "2030-08-15T19:00:00.000Z", {
        endsAt: "2030-08-15T20:00:00.000Z",
        leaveByAt: "2030-08-15T18:40:00.000Z",
        kidIds: ["k1"],
        driveBlockLinks: [
          {
            leg: "TO",
            otherSource: "FEED",
            otherId: "a",
            otherTitle: "Practice A",
            otherStartsAt: "2030-08-15T18:00:00.000Z",
            combined: true,
            overrideAction: null,
          },
        ],
      }),
    ]

    const rideA: CarpoolRide = {
      id: "r-a",
      spaceId: "s1",
      eventKey: "UID:a",
      requestingCircleId: "c1",
      requestingCircleName: "House",
      requestedByAdultId: "a1",
      kidIds: ["k1"],
      kidFirstNames: ["Declan"],
      seats: 1,
      pickupPlaceName: "Home",
      pickupAddress: "1 Main",
      pickupTown: null,
      detourMinutes: null,
      status: "PENDING",
      legs: [confirmedLeg("TO", "a1", "Chris")],
      passedByMe: false,
      passedByAdultNames: [],
      acceptedByAdultId: null,
      acceptingCircleId: null,
      acceptingCircleName: null,
    }
    const rideB: CarpoolRide = {
      ...rideA,
      id: "r-b",
      eventKey: "UID:b",
      legs: [confirmedLeg("TO", "a1", "Chris")],
    }

    render(
      <AgendaBlockCard
        items={members}
        circle={circle}
        currentAdultId="a1"
        rideEventFor={rideEventForMap({
          a: {
            eventKey: "UID:a",
            title: "Practice A",
            startsAt: members[0]!.startsAt,
            endsAt: members[0]!.endsAt,
            defaultKidIds: ["k1"],
            ownRequests: [rideA],
            ownLegs: rideA.legs,
            ownRequest: rideA,
            otherRequests: [],
          },
          b: {
            eventKey: "UID:b",
            title: "Practice B",
            startsAt: members[1]!.startsAt,
            endsAt: members[1]!.endsAt,
            defaultKidIds: ["k1"],
            ownRequests: [rideB],
            ownLegs: rideB.legs,
            ownRequest: rideB,
            otherRequests: [],
          },
        })}
        onOpenRide={onOpenRide}
      />,
    )

    await expandBlock(user)
    const viewRoute = screen.getByTestId("agenda-block-run-to-view-route")
    expect(viewRoute).toHaveTextContent("View route")
    await user.click(viewRoute)
    expect(onOpenRide).toHaveBeenCalledTimes(1)
    expect(onOpenRide).toHaveBeenCalledWith(
      expect.objectContaining({ id: "a", source: "FEED" }),
      "TO",
    )
  })

  it("opens dual-leg Route on Back via View route on a FROM run", async () => {
    const user = userEvent.setup()
    const onOpenRide = vi.fn()
    const members = [
      item("a", "2030-08-15T18:00:00.000Z", {
        endsAt: "2030-08-15T19:00:00.000Z",
        leaveByAt: "2030-08-15T17:40:00.000Z",
        kidIds: ["k1"],
        driveBlockLinks: [
          {
            leg: "FROM",
            otherSource: "FEED",
            otherId: "b",
            otherTitle: "Practice B",
            otherStartsAt: "2030-08-15T19:00:00.000Z",
            combined: true,
            overrideAction: null,
          },
        ],
      }),
      item("b", "2030-08-15T19:00:00.000Z", {
        endsAt: "2030-08-15T20:00:00.000Z",
        leaveByAt: "2030-08-15T18:40:00.000Z",
        kidIds: ["k1"],
        driveBlockLinks: [
          {
            leg: "FROM",
            otherSource: "FEED",
            otherId: "a",
            otherTitle: "Practice A",
            otherStartsAt: "2030-08-15T18:00:00.000Z",
            combined: true,
            overrideAction: null,
          },
        ],
      }),
    ]

    const rideA: CarpoolRide = {
      id: "r-a",
      spaceId: "s1",
      eventKey: "UID:a",
      requestingCircleId: "c1",
      requestingCircleName: "House",
      requestedByAdultId: "a1",
      kidIds: ["k1"],
      kidFirstNames: ["Declan"],
      seats: 1,
      pickupPlaceName: "Home",
      pickupAddress: "1 Main",
      pickupTown: null,
      detourMinutes: null,
      status: "PENDING",
      legs: [confirmedLeg("FROM", "a1", "Chris")],
      passedByMe: false,
      passedByAdultNames: [],
      acceptedByAdultId: null,
      acceptingCircleId: null,
      acceptingCircleName: null,
    }
    const rideB: CarpoolRide = {
      ...rideA,
      id: "r-b",
      eventKey: "UID:b",
    }

    render(
      <AgendaBlockCard
        items={members}
        circle={circle}
        currentAdultId="a1"
        rideEventFor={rideEventForMap({
          a: {
            eventKey: "UID:a",
            title: "Practice A",
            startsAt: members[0]!.startsAt,
            endsAt: members[0]!.endsAt,
            defaultKidIds: ["k1"],
            ownRequests: [rideA],
            ownLegs: rideA.legs,
            ownRequest: rideA,
            otherRequests: [],
          },
          b: {
            eventKey: "UID:b",
            title: "Practice B",
            startsAt: members[1]!.startsAt,
            endsAt: members[1]!.endsAt,
            defaultKidIds: ["k1"],
            ownRequests: [rideB],
            ownLegs: rideB.legs,
            ownRequest: rideB,
            otherRequests: [],
          },
        })}
        onOpenRide={onOpenRide}
      />,
    )

    await expandBlock(user)
    const viewRoute = screen.getByTestId("agenda-block-run-from-view-route")
    expect(viewRoute).toHaveTextContent("View route")
    await user.click(viewRoute)
    expect(onOpenRide).toHaveBeenCalledTimes(1)
    expect(onOpenRide).toHaveBeenCalledWith(
      expect.objectContaining({ id: "b", source: "FEED" }),
      "FROM",
    )
  })

  it("invokes combine/split handler from the block card (not Hero)", async () => {
    const user = userEvent.setup()
    const onDriveBlockLink = vi.fn()
    const members = [
      item("a", "2030-08-15T17:00:00.000Z", {
        driveBlockLinks: [
          {
            leg: "TO",
            otherSource: "FEED",
            otherId: "b",
            otherTitle: "Practice B",
            otherStartsAt: "2030-08-15T18:00:00.000Z",
            combined: true,
            overrideAction: null,
          },
        ],
      }),
      item("b", "2030-08-15T18:00:00.000Z", {
        driveBlockLinks: [
          {
            leg: "TO",
            otherSource: "FEED",
            otherId: "a",
            otherTitle: "Practice A",
            otherStartsAt: "2030-08-15T17:00:00.000Z",
            combined: true,
            overrideAction: null,
          },
        ],
      }),
    ]

    render(
      <AgendaBlockCard
        items={members}
        circle={circle}
        currentAdultId="a1"
        rideEventFor={() => null}
        onDriveBlockLink={onDriveBlockLink}
      />,
    )

    await expandBlock(user)
    await user.click(
      screen.getByTestId("agenda-block-drive-block-link-TO-b"),
    )
    expect(onDriveBlockLink).toHaveBeenCalledWith(
      expect.objectContaining({ id: "a", source: "FEED" }),
      expect.objectContaining({ otherId: "b", combined: true }),
    )
  })

  it("applies focus chrome when isFocused", () => {
    render(
      <AgendaBlockCard
        items={[
          item("a", "2030-08-15T17:00:00.000Z"),
          item("b", "2030-08-15T18:00:00.000Z"),
        ]}
        circle={circle}
        currentAdultId="a1"
        rideEventFor={() => null}
        isFocused
      />,
    )
    const card = screen.getByTestId("agenda-block-card")
    expect(card).toHaveAttribute("data-focused", "true")
    expect(card.className).toMatch(/--fc-list-row-focus-border/)
  })

  it("surfaces per-commitment reassign, not-going, and hang departure leave-from", async () => {
    const user = userEvent.setup()
    const onCantMakeIt = vi.fn()
    const onSetNotGoing = vi.fn()
    const onSetLeaveFrom = vi.fn()

    const members = [
      item("a", "2030-08-15T18:00:00.000Z", {
        title: "Mite Practice",
        endsAt: "2030-08-15T19:00:00.000Z",
        leaveByAt: "2030-08-15T17:41:00.000Z",
        leaveByStatus: "OK",
        leaveFromPlaceId: "p-hag",
        leaveFromPlaceName: "Haggerty",
        kidIds: ["k2"],
        rsvps: [{ kidId: "k2", status: "YES" }],
        coverages: [
          {
            id: "cov-k",
            coveringAdultId: "a1",
            coveringAdultDisplayName: "Chris",
            assignedByAdultId: "a1",
            kidIds: ["k2"],
            status: "CONFIRMED",
            leaveFromPlaceId: "p-hag",
            leaveFromPlaceName: "Haggerty",
            leaveFromAddress: null,
            leaveByAt: null,
            leaveByStatus: null,
            leaveByReason: null,
          },
        ],
        driveBlockLinks: [
          {
            leg: "TO",
            otherSource: "FEED",
            otherId: "b",
            otherTitle: "Squirt Practice",
            otherStartsAt: "2030-08-15T19:00:00.000Z",
            combined: true,
            overrideAction: null,
          },
        ],
      }),
      item("b", "2030-08-15T19:00:00.000Z", {
        title: "Squirt Practice",
        endsAt: "2030-08-15T20:00:00.000Z",
        leaveByAt: "2030-08-15T18:43:00.000Z",
        leaveByStatus: "OK",
        leaveFromPlaceName: "Home",
        kidIds: ["k1"],
        rsvps: [{ kidId: "k1", status: "YES" }],
        coverages: [
          {
            id: "cov-d",
            coveringAdultId: "a1",
            coveringAdultDisplayName: "Chris",
            assignedByAdultId: "a1",
            kidIds: ["k1"],
            status: "CONFIRMED",
            leaveFromPlaceId: null,
            leaveFromPlaceName: "Home",
            leaveFromAddress: null,
            leaveByAt: null,
            leaveByStatus: null,
            leaveByReason: null,
          },
        ],
        driveBlockLinks: [
          {
            leg: "TO",
            otherSource: "FEED",
            otherId: "a",
            otherTitle: "Mite Practice",
            otherStartsAt: "2030-08-15T18:00:00.000Z",
            combined: true,
            overrideAction: null,
          },
        ],
      }),
    ]

    const circleWithPlace: FamilyCircle = {
      ...circle,
      places: [
        {
          id: "p-hag",
          name: "Haggerty",
          address: "1 School",
          latitude: 42,
          longitude: -71,
        },
      ],
    }

    render(
      <AgendaBlockCard
        items={members}
        circle={circleWithPlace}
        currentAdultId="a1"
        rideEventFor={() => null}
        onCantMakeIt={onCantMakeIt}
        onSetNotGoing={onSetNotGoing}
        onSetLeaveFrom={onSetLeaveFrom}
      />,
    )

    await expandBlock(user)
    const actions = screen.getByTestId("agenda-block-commitment-actions")
    expect(within(actions).getAllByTestId("agenda-reassign-link")).toHaveLength(2)
    expect(within(actions).getByText(/Mark Kian as not going/)).toBeInTheDocument()
    expect(within(actions).getByText(/Mark Declan as not going/)).toBeInTheDocument()

    await user.click(within(actions).getAllByTestId("agenda-reassign-link")[0]!)
    expect(onCantMakeIt).toHaveBeenCalled()

    expect(screen.getByTestId("agenda-block-leave-from")).toBeInTheDocument()
    expect(
      screen.getByTestId("leave-from-block-FEED-a-place-select"),
    ).toBeInTheDocument()
    expect(screen.getByTestId("leave-from-block-FEED-a-helper")).toHaveTextContent(
      /Leave by ~/,
    )
  })

  it("lists ACCEPTED inbound riders on combined run summaries", async () => {
    const user = userEvent.setup()
    const onWithdrawRide = vi.fn()
    const members = [
      item("mite", "2030-09-22T22:00:00.000Z", {
        title: "CYH Mite Practice",
        endsAt: "2030-09-22T22:50:00.000Z",
        leaveByAt: "2030-09-22T21:41:00.000Z",
        kidIds: ["k2"],
        rsvps: [{ kidId: "k2", status: "YES" }],
        coverages: [
          {
            id: "cov-kian",
            coveringAdultId: "a1",
            coveringAdultDisplayName: "Chris",
            assignedByAdultId: "a1",
            kidIds: ["k2"],
            status: "CONFIRMED",
            leaveFromPlaceId: null,
            leaveFromPlaceName: null,
            leaveFromAddress: null,
            leaveByAt: null,
            leaveByStatus: null,
            leaveByReason: null,
          },
        ],
        driveBlockLinks: [
          {
            leg: "TO",
            otherSource: "FEED",
            otherId: "squirt",
            otherTitle: "CYH Squirt 1 Practice",
            otherStartsAt: "2030-09-22T23:00:00.000Z",
            combined: true,
            overrideAction: null,
          },
        ],
      }),
      item("squirt", "2030-09-22T23:00:00.000Z", {
        title: "CYH Squirt 1 Practice",
        endsAt: "2030-09-22T23:50:00.000Z",
        leaveByAt: "2030-09-22T22:43:00.000Z",
        kidIds: ["k1"],
        rsvps: [{ kidId: "k1", status: "YES" }],
        coverages: [
          {
            id: "cov-declan",
            coveringAdultId: "a1",
            coveringAdultDisplayName: "Chris",
            assignedByAdultId: "a1",
            kidIds: ["k1"],
            status: "CONFIRMED",
            leaveFromPlaceId: null,
            leaveFromPlaceName: null,
            leaveFromAddress: null,
            leaveByAt: null,
            leaveByStatus: null,
            leaveByReason: null,
          },
        ],
        driveBlockLinks: [
          {
            leg: "TO",
            otherSource: "FEED",
            otherId: "mite",
            otherTitle: "CYH Mite Practice",
            otherStartsAt: "2030-09-22T22:00:00.000Z",
            combined: true,
            overrideAction: null,
          },
        ],
      }),
    ]

    const inboundApollo: CarpoolRide = {
      id: "ask-apollo",
      spaceId: "s1",
      eventKey: "UID:squirt",
      requestingCircleId: "c-apollo",
      requestingCircleName: "Apollo's family",
      requestedByAdultId: "a-apollo",
      kidIds: ["k-apollo"],
      kidFirstNames: ["Apollo"],
      seats: 1,
      pickupPlaceName: "Home",
      pickupAddress: "1 Other",
      pickupTown: null,
      detourMinutes: null,
      status: "ACCEPTED",
      legs: [
        {
          kind: "TO",
          phase: "CONFIRMED",
          assigneeAdultId: null,
          assigneeDisplayName: null,
          assigneeCircleId: "c1",
          assigneeCircleName: "House",
          placeId: null,
          placeName: null,
          placeAddress: null,
          meetSide: "REQUESTER",
        },
        {
          kind: "FROM",
          phase: "CONFIRMED",
          assigneeAdultId: null,
          assigneeDisplayName: null,
          assigneeCircleId: "c1",
          assigneeCircleName: "House",
          placeId: null,
          placeName: null,
          placeAddress: null,
          meetSide: "REQUESTER",
        },
      ],
      passedByMe: false,
      passedByAdultNames: [],
      acceptedByAdultId: "a1",
      acceptingCircleId: "c1",
      acceptingCircleName: "House",
    }

    render(
      <AgendaBlockCard
        items={members}
        circle={circle}
        currentAdultId="a1"
        rideEventFor={rideEventForMap({
          squirt: {
            eventKey: "UID:squirt",
            title: "Squirt",
            startsAt: members[1]!.startsAt,
            endsAt: members[1]!.endsAt,
            defaultKidIds: ["k1"],
            ownRequests: [],
            ownLegs: null,
            ownRequest: null,
            otherRequests: [inboundApollo],
          },
        })}
        onWithdrawRide={onWithdrawRide}
      />,
    )

    await expandBlock(user)
    expect(screen.getByTestId("agenda-block-title")).toHaveTextContent("CYH Practice")
    expect(screen.getByTestId("agenda-block-kid-plan-FEED-squirt-k-apollo")).toHaveTextContent(
      /Apollo/,
    )

    const actions = screen.getByTestId("agenda-block-commitment-actions")
    const withdraw = within(actions).getByRole("button", {
      name: "Can't take them anymore",
    })
    expect(withdraw).toBeInTheDocument()
    // Paired with own-kid reassign (ADR-0004 rule 7) — not collapsed into one link.
    expect(within(actions).getAllByTestId("agenda-reassign-link").length).toBeGreaterThan(
      0,
    )

    await user.click(withdraw)
    expect(onWithdrawRide).toHaveBeenCalledWith(
      expect.objectContaining({ id: "squirt" }),
      "ask-apollo",
      undefined,
    )
  })

  it("does not show a standalone Lock this plan link when eligible", () => {
    const a = item("a", "2030-08-15T17:00:00.000Z", {
      standingLockEligible: true,
    })
    const b = item("b", "2030-08-15T18:00:00.000Z", {
      standingLockEligible: true,
    })

    render(
      <AgendaBlockCard
        items={[a, b]}
        circle={circle}
        currentAdultId="a1"
        rideEventFor={() => null}
        onLockStandingBlock={vi.fn()}
      />,
    )

    expect(screen.queryByTestId("agenda-block-lock-standing")).not.toBeInTheDocument()
    expect(screen.queryByText("Lock this plan")).not.toBeInTheDocument()
  })

  it("shows locked summary with Edit and Remove; Edit reveals leave-from without Remove", async () => {
    const user = userEvent.setup()
    const onRemoveStandingBlock = vi.fn()
    const a = item("a", "2030-08-15T17:00:00.000Z", {
      standingLocked: true,
      standingBlockTemplateId: "tmpl-1",
      standingLockEligible: true,
      leaveFromPlaceId: "p1",
      leaveFromPlaceName: "Home",
      coverages: [
        {
          id: "c1",
          coveringAdultId: "a1",
          coveringAdultDisplayName: "Chris",
          assignedByAdultId: "a1",
          kidIds: ["k1"],
          status: "CONFIRMED",
          leaveFromPlaceId: null,
          leaveFromPlaceName: null,
          leaveFromAddress: null,
          leaveByAt: null,
          leaveByStatus: null,
          leaveByReason: null,
        },
      ],
    })
    const b = item("b", "2030-08-15T18:00:00.000Z", {
      standingLocked: true,
      standingBlockTemplateId: "tmpl-1",
      coverages: [
        {
          id: "c2",
          coveringAdultId: "a1",
          coveringAdultDisplayName: "Chris",
          assignedByAdultId: "a1",
          kidIds: ["k1"],
          status: "CONFIRMED",
          leaveFromPlaceId: null,
          leaveFromPlaceName: null,
          leaveFromAddress: null,
          leaveByAt: null,
          leaveByStatus: null,
          leaveByReason: null,
        },
      ],
    })

    render(
      <AgendaBlockCard
        items={[a, b]}
        circle={circle}
        currentAdultId="a1"
        rideEventFor={() => null}
        onRemoveStandingBlock={onRemoveStandingBlock}
        onSetLeaveFrom={vi.fn()}
      />,
    )

    expect(screen.queryByTestId("agenda-block-standing-locked-title")).not.toBeInTheDocument()
    await expandBlock(user)
    expect(screen.queryByTestId("agenda-block-lock-standing")).not.toBeInTheDocument()
    expect(screen.getByTestId("agenda-block-standing-locked-title")).toHaveTextContent(
      /Plan locked/,
    )
    expect(screen.getByTestId("agenda-block-standing-locked-caption")).toHaveTextContent(
      /Editing changes just this week/,
    )
    expect(screen.queryByTestId("agenda-block-leave-from")).not.toBeInTheDocument()

    await user.click(screen.getByTestId("agenda-block-standing-locked-edit"))
    expect(onRemoveStandingBlock).not.toHaveBeenCalled()
    expect(screen.getByTestId("agenda-block-leave-from")).toBeInTheDocument()
    expect(screen.getByTestId("agenda-block-standing-locked-title")).toHaveTextContent(
      /Plan locked/,
    )
    expect(screen.getByTestId("agenda-block-standing-locked-done-editing")).toBeInTheDocument()
    expect(screen.getByTestId("agenda-block-standing-locked-remove")).toBeInTheDocument()

    await user.click(screen.getByTestId("agenda-block-standing-locked-remove"))
    expect(onRemoveStandingBlock).toHaveBeenCalledWith("tmpl-1", "2030-08-15T17:00:00.000Z")
  })

  it("surfaces Remove failures on the locked summary", async () => {
    const user = userEvent.setup()
    const a = item("a", "2030-08-15T17:00:00.000Z", {
      standingLocked: true,
      standingBlockTemplateId: "tmpl-err",
      coverages: [
        {
          id: "c1",
          coveringAdultId: "a1",
          coveringAdultDisplayName: "Chris",
          assignedByAdultId: "a1",
          kidIds: ["k1"],
          status: "CONFIRMED",
          leaveFromPlaceId: null,
          leaveFromPlaceName: null,
          leaveFromAddress: null,
          leaveByAt: null,
          leaveByStatus: null,
          leaveByReason: null,
        },
      ],
    })

    render(
      <AgendaBlockCard
        items={[a, item("b", "2030-08-15T18:00:00.000Z", { standingLocked: true })]}
        circle={circle}
        currentAdultId="a1"
        rideEventFor={() => null}
        onRemoveStandingBlock={vi.fn()}
        actionError="Remove standing block failed"
      />,
    )

    await expandBlock(user)
    expect(screen.getByTestId("agenda-block-standing-locked-error")).toHaveTextContent(
      /Remove standing block failed/,
    )
    expect(screen.getByTestId("agenda-block-standing-locked-remove")).toBeInTheDocument()
  })
})
