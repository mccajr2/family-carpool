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
    expect(screen.getByTestId("agenda-block-quiet-actions")).toBeInTheDocument()
    const actions = screen.getByTestId("agenda-block-commitment-actions")
    const reassign = within(actions).getAllByTestId("agenda-reassign-link")
    expect(reassign).toHaveLength(2)
    expect(reassign[0]!.className).toMatch(/--fc-font-list-row-meta-size/)
    expect(reassign[0]!.className).not.toMatch(/--fc-font-focus-action/)
    expect(within(actions).getByText(/Mark Kian as not going/)).toBeInTheDocument()
    expect(within(actions).getByText(/Mark Declan as not going/)).toBeInTheDocument()

    await user.click(reassign[0]!)
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
    expect(withdraw).toHaveAttribute("data-action-kind", "withdraw-inbound")
    // Paired with own-kid reassign (ADR-0004 rule 7) — not collapsed into one link.
    const reassign = within(actions).getAllByTestId("agenda-reassign-link")
    expect(reassign.length).toBeGreaterThan(0)
    expect(reassign[0]).toHaveAttribute("data-action-kind", "cant-make-it")
    expect(withdraw).not.toHaveAttribute("data-action-kind", "cant-make-it")

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

  it("Frame H/I: Edit reveals simple Save ride plan picker; Remove calls onRemoveStandingBlock", async () => {
    const user = userEvent.setup()
    const onRemoveStandingBlock = vi.fn()
    const onSaveRidePlan = vi.fn()
    const onAssignCoverage = vi.fn()
    const onUpdateAssignDraft = vi.fn()
    const onSetNotGoing = vi.fn()
    const a = item("a", "2030-08-15T17:00:00.000Z", {
      standingLocked: true,
      standingBlockTemplateId: "tmpl-hi",
      leaveFromPlaceId: "p1",
      leaveFromPlaceName: "Home",
      uncoveredKidIds: [],
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
      standingBlockTemplateId: "tmpl-hi",
      kidIds: ["k2"],
      uncoveredKidIds: [],
      rsvps: [{ kidId: "k2", status: "YES" }],
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
      coverages: [
        {
          id: "c2",
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
    })
    const rides: Record<string, CarpoolRideEvent> = {
      a: {
        eventKey: "UID:a",
        title: "Practice A",
        startsAt: a.startsAt,
        endsAt: null,
        defaultKidIds: ["k1"],
        ownRequest: null,
        ownRequests: [],
        ownLegs: [confirmedLeg("TO", "a1", "Chris"), confirmedLeg("FROM", "a1", "Chris")],
        otherRequests: [],
      },
      b: {
        eventKey: "UID:b",
        title: "Practice B",
        startsAt: b.startsAt,
        endsAt: null,
        defaultKidIds: ["k2"],
        ownRequest: null,
        ownRequests: [],
        ownLegs: [confirmedLeg("TO", "a1", "Chris"), confirmedLeg("FROM", "a1", "Chris")],
        otherRequests: [],
      },
    }

    render(
      <AgendaBlockCard
        items={[a, b]}
        circle={circle}
        currentAdultId="a1"
        rideEventFor={rideEventForMap(rides)}
        assignDraft={{ adultId: "a1", kidIds: ["k1", "k2"], soleAdult: false, soleKid: false }}
        onUpdateAssignDraft={onUpdateAssignDraft}
        onAssignCoverage={onAssignCoverage}
        onSaveRidePlan={onSaveRidePlan}
        onSetNotGoing={onSetNotGoing}
        onRemoveStandingBlock={onRemoveStandingBlock}
        onSetLeaveFrom={vi.fn()}
        onDriveBlockLink={vi.fn()}
      />,
    )

    await expandBlock(user)
    const card = screen.getByTestId("agenda-block-card")
    const locked = within(card).getByTestId("agenda-block-standing-locked")
    const quiet = within(card).getByTestId("agenda-block-quiet-actions")
    const caption = within(card).getByTestId("agenda-block-standing-locked-caption")
    expect(
      locked.compareDocumentPosition(quiet) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
    expect(
      quiet.compareDocumentPosition(caption) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
    expect(
      within(locked).queryByTestId("agenda-block-standing-locked-caption"),
    ).not.toBeInTheDocument()
    expect(within(card).queryByTestId("driver-picker")).not.toBeInTheDocument()
    expect(
      within(locked).getByRole("button", { name: /Split into/ }),
    ).toBeInTheDocument()

    await user.click(within(card).getByTestId("agenda-block-standing-locked-edit"))
    const picker = within(card).getByTestId("driver-picker")
    expect(picker).toHaveAttribute("data-mode", "simple")
    expect(
      within(card).getByRole("button", { name: "Save ride plan" }),
    ).toBeInTheDocument()
    expect(
      within(card).getByRole("button", { name: /not going this week/ }),
    ).toBeInTheDocument()

    await user.click(within(card).getByRole("button", { name: "Save ride plan" }))
    expect(onSaveRidePlan).toHaveBeenCalled()
    expect(onAssignCoverage).not.toHaveBeenCalled()

    await user.click(within(card).getByTestId("agenda-block-standing-locked-remove"))
    expect(onRemoveStandingBlock).toHaveBeenCalledWith(
      "tmpl-hi",
      "2030-08-15T17:00:00.000Z",
    )
  })

  it("Frame B: open legs prefer urgent status chips over a plan chip", () => {
    const a = item("a", "2030-08-15T18:00:00.000Z", {
      feedName: "Mite 3",
      title: "CYH Mite 3 Practice",
      kidIds: ["k1"],
      uncoveredKidIds: ["k1"],
      rsvps: [{ kidId: "k1", status: "YES" }],
    })
    const b = item("b", "2030-08-15T19:00:00.000Z", {
      feedName: "Squirt 1",
      title: "CYH Squirt 1 Practice",
      kidIds: ["k2"],
      uncoveredKidIds: ["k2"],
      rsvps: [{ kidId: "k2", status: "YES" }],
    })
    const c = item("c", "2030-08-15T20:00:00.000Z", {
      feedName: "U10",
      title: "CYH U10 Practice",
      kidIds: ["k1"],
      uncoveredKidIds: [],
      rsvps: [{ kidId: "k1", status: "YES" }],
    })
    const asked: CarpoolRide = {
      id: "ask-b",
      spaceId: "s1",
      eventKey: "UID:b",
      requestingCircleId: "c1",
      requestingCircleName: "House",
      requestedByAdultId: "a1",
      kidIds: ["k2"],
      kidFirstNames: ["Kian"],
      seats: 1,
      pickupPlaceName: "Home",
      pickupAddress: "1 Main",
      pickupTown: null,
      detourMinutes: null,
      status: "PENDING",
      legs: [
        {
          kind: "TO",
          phase: "ASKED_TEAM",
          assigneeAdultId: null,
          assigneeDisplayName: null,
          assigneeCircleId: null,
          assigneeCircleName: null,
          placeId: null,
          placeName: null,
          placeAddress: null,
          meetSide: "REQUESTER",
        },
        {
          kind: "FROM",
          phase: "ASKED_TEAM",
          assigneeAdultId: null,
          assigneeDisplayName: null,
          assigneeCircleId: null,
          assigneeCircleName: null,
          placeId: null,
          placeName: null,
          placeAddress: null,
          meetSide: "REQUESTER",
        },
      ],
      passedByMe: false,
      passedByAdultNames: [],
      acceptedByAdultId: null,
      acceptingCircleId: null,
      acceptingCircleName: null,
    }
    const youDrive: CarpoolRideEvent = {
      eventKey: "UID:c",
      title: "CYH U10 Practice",
      startsAt: c.startsAt,
      endsAt: null,
      defaultKidIds: ["k1"],
      ownRequest: null,
      ownRequests: [
        {
          id: "own-c",
          spaceId: "s1",
          eventKey: "UID:c",
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
          legs: [confirmedLeg("TO", "a1", "Chris"), confirmedLeg("FROM", "a1", "Chris")],
          passedByMe: false,
          passedByAdultNames: [],
          acceptedByAdultId: null,
          acceptingCircleId: null,
          acceptingCircleName: null,
        },
      ],
      ownLegs: [confirmedLeg("TO", "a1", "Chris"), confirmedLeg("FROM", "a1", "Chris")],
      otherRequests: [],
    }

    render(
      <AgendaBlockCard
        items={[a, b, c]}
        circle={circle}
        currentAdultId="a1"
        rideEventFor={rideEventForMap({
          b: {
            eventKey: "UID:b",
            title: "CYH Squirt 1 Practice",
            startsAt: b.startsAt,
            endsAt: null,
            defaultKidIds: ["k2"],
            ownRequest: asked,
            ownRequests: [asked],
            ownLegs: asked.legs,
            otherRequests: [],
          },
          c: youDrive,
        })}
      />,
    )

    const card = screen.getByTestId("agenda-block-card")
    const strip = within(card).getByTestId("agenda-block-chip-strip")
    expect(strip.textContent).toMatch(/Ride needed/i)
    expect(strip.textContent).toMatch(/Asked team/i)
    expect(strip.textContent).not.toMatch(/round trip/i)
    expect(strip.textContent).not.toMatch(/of \d+ legs/i)
    expect(within(card).getByTestId("agenda-block-eyebrow")).toHaveTextContent(
      "Mite 3 + Squirt 1 + U10",
    )
    expect(within(card).getByTestId("agenda-block-title")).toHaveTextContent("CYH Practice")
    expect(within(card).getByTestId("agenda-block-kid-rows").children).toHaveLength(3)
    expect(
      within(card).getByTestId("agenda-block-kid-FEED-a-k1"),
    ).toHaveTextContent(/There Needs ride · Back Needs ride/)
    expect(
      within(card).getByTestId("agenda-block-kid-FEED-b-k2"),
    ).toHaveTextContent(/There Asked team · Back Asked team/)
    expect(
      within(card).getByTestId("agenda-block-kid-FEED-c-k1"),
    ).toHaveTextContent(/There You · Back You/)
  })

  it("Frame C: fully assigned other-parent plan chip; no You in kid rows", () => {
    const a = item("a", "2030-08-15T18:00:00.000Z", {
      feedName: "Mite 3",
      title: "CYH Mite 3 Practice",
      kidIds: ["k1"],
      rsvps: [{ kidId: "k1", status: "YES" }],
    })
    const b = item("b", "2030-08-15T19:00:00.000Z", {
      feedName: "Squirt 1",
      title: "CYH Squirt 1 Practice",
      kidIds: ["k2"],
      rsvps: [{ kidId: "k2", status: "YES" }],
    })
    const katyLegs = [
      confirmedLeg("TO", "a2", "Mom"),
      confirmedLeg("FROM", "a2", "Mom"),
    ]
    // Rename a2 display in circle is "Mom"; Frame C uses other-parent first name.
    const circleWithKaty: FamilyCircle = {
      ...circle,
      members: [
        circle.members[0]!,
        { ...circle.members[1]!, displayName: "Katy" },
      ],
    }

    render(
      <AgendaBlockCard
        items={[a, b]}
        circle={circleWithKaty}
        currentAdultId="a1"
        rideEventFor={rideEventForMap({
          a: {
            eventKey: "UID:a",
            title: a.title,
            startsAt: a.startsAt,
            endsAt: null,
            defaultKidIds: ["k1"],
            ownRequest: null,
            ownRequests: [
              {
                id: "own-a",
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
                legs: [
                  { ...katyLegs[0]!, assigneeDisplayName: "Katy" },
                  { ...katyLegs[1]!, assigneeDisplayName: "Katy" },
                ],
                passedByMe: false,
                passedByAdultNames: [],
                acceptedByAdultId: null,
                acceptingCircleId: null,
                acceptingCircleName: null,
              },
            ],
            ownLegs: [
              { ...katyLegs[0]!, assigneeDisplayName: "Katy" },
              { ...katyLegs[1]!, assigneeDisplayName: "Katy" },
            ],
            otherRequests: [],
          },
          b: {
            eventKey: "UID:b",
            title: b.title,
            startsAt: b.startsAt,
            endsAt: null,
            defaultKidIds: ["k2"],
            ownRequest: null,
            ownRequests: [
              {
                id: "own-b",
                spaceId: "s1",
                eventKey: "UID:b",
                requestingCircleId: "c1",
                requestingCircleName: "House",
                requestedByAdultId: "a1",
                kidIds: ["k2"],
                kidFirstNames: ["Kian"],
                seats: 1,
                pickupPlaceName: "Home",
                pickupAddress: "1 Main",
                pickupTown: null,
                detourMinutes: null,
                status: "PENDING",
                legs: [
                  { ...katyLegs[0]!, assigneeDisplayName: "Katy" },
                  { ...katyLegs[1]!, assigneeDisplayName: "Katy" },
                ],
                passedByMe: false,
                passedByAdultNames: [],
                acceptedByAdultId: null,
                acceptingCircleId: null,
                acceptingCircleName: null,
              },
            ],
            ownLegs: [
              { ...katyLegs[0]!, assigneeDisplayName: "Katy" },
              { ...katyLegs[1]!, assigneeDisplayName: "Katy" },
            ],
            otherRequests: [],
          },
        })}
      />,
    )

    const card = screen.getByTestId("agenda-block-card")
    const strip = within(card).getByTestId("agenda-block-chip-strip")
    expect(strip.textContent).toMatch(/Katy · round trip/i)
    expect(strip.textContent).not.toMatch(/Ride needed/i)
    expect(strip.textContent).not.toMatch(/You're driving/i)
    const planChip = within(strip).getByText(/Katy · round trip/i)
    expect(planChip.className).toMatch(/--fc-accent/)
    expect(planChip.className).not.toMatch(/--fc-success/)
    for (const kid of within(card).getByTestId("agenda-block-kid-rows").children) {
      expect(kid.textContent).not.toMatch(/\bYou\b/)
      expect(kid.textContent).toMatch(/There Katy · Back Katy/)
    }
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
    expect(screen.getByTestId("agenda-block-action-error")).toHaveTextContent(
      /Remove standing block failed/,
    )
    expect(screen.queryByTestId("agenda-block-standing-locked-error")).not.toBeInTheDocument()
    expect(screen.getByTestId("agenda-block-standing-locked-remove")).toBeInTheDocument()
  })

  it("shows actionError when not locked", async () => {
    const user = userEvent.setup()
    render(
      <AgendaBlockCard
        items={[
          item("a", "2030-08-15T17:00:00.000Z", { uncoveredKidIds: ["k1"] }),
          item("b", "2030-08-15T18:00:00.000Z", {
            uncoveredKidIds: ["k2"],
            kidIds: ["k2"],
            rsvps: [{ kidId: "k2", status: "YES" }],
          }),
        ]}
        circle={circle}
        currentAdultId="a1"
        rideEventFor={() => null}
        actionError="Could not split drive block"
      />,
    )

    expect(screen.queryByTestId("agenda-block-action-error")).not.toBeInTheDocument()
    expect(screen.queryByTestId("agenda-block-standing-locked")).not.toBeInTheDocument()
    await expandBlock(user)
    expect(screen.queryByTestId("agenda-block-standing-locked")).not.toBeInTheDocument()
    expect(screen.getByTestId("agenda-block-action-error")).toHaveTextContent(
      /Could not split drive block/,
    )
    expect(screen.getByTestId("agenda-block-action-error")).toHaveAttribute("role", "alert")
  })

  it("accepts item-scoped decision props and surfaces shared assign draft wiring", () => {
    const members = [
      item("a", "2030-08-15T18:00:00.000Z", {
        uncoveredKidIds: ["k1"],
        standingLockEligible: true,
      }),
      item("b", "2030-08-15T19:00:00.000Z", {
        uncoveredKidIds: ["k2"],
        kidIds: ["k2"],
        rsvps: [{ kidId: "k2", status: "YES" }],
        standingLockEligible: true,
      }),
    ]
    render(
      <AgendaBlockCard
        items={members}
        circle={{
          ...circle,
          places: [
            {
              id: "p1",
              name: "Home",
              address: "1 Main",
              latitude: 40,
              longitude: -74,
            },
          ],
        }}
        currentAdultId="a1"
        rideEventFor={() => null}
        assignDraft={{
          adultId: "a1",
          kidIds: ["k1", "k2"],
          soleAdult: false,
          soleKid: false,
        }}
        onUpdateAssignDraft={vi.fn()}
        onAssignCoverage={vi.fn()}
        onCreateRide={vi.fn()}
        onSaveRidePlan={vi.fn()}
        onSaveKidPlans={vi.fn()}
        onCancelRide={vi.fn()}
        canAskTeamForItem={() => true}
        hasPickupPlace
        coverageActionErrorForItem={(row) =>
          row.id === "b" ? "Save failed on B" : undefined
        }
        standingLockWeekdaySingular="Thursday"
        standingLockWeekdayPlural="Thursdays"
      />,
    )

    const card = screen.getByTestId("agenda-block-card")
    expect(card).toHaveAttribute("data-decision-wired", "true")
    expect(card).toHaveAttribute("data-assign-adult", "a1")
    expect(card).toHaveAttribute("data-can-ask-team", "true")
    expect(card).toHaveAttribute("data-has-pickup-place", "true")
    expect(card).toHaveAttribute("data-has-create-ride", "true")
    expect(card).toHaveAttribute("data-has-save-ride-plan", "true")
    expect(card).toHaveAttribute("data-has-save-kid-plans", "true")
    expect(card).toHaveAttribute("data-has-cancel-ride", "true")
    expect(card).toHaveAttribute("data-standing-lock-weekday", "Thursday")
    expect(card).toHaveAttribute("data-standing-lock-weekdays", "Thursdays")
    expect(card).toHaveAttribute("data-member-coverage-error", "Save failed on B")
  })

  it("Frame F: picker only for open kid; cancel-ask for posted kid; no picker for assigned", async () => {
    const user = userEvent.setup()
    const onCreateRide = vi.fn()
    const onCancelRide = vi.fn()
    const a = item("a", "2030-08-15T18:00:00.000Z", {
      feedName: "Mite 3",
      title: "CYH Mite 3 Practice",
      kidIds: ["k1"],
      uncoveredKidIds: ["k1"],
      leaveFromPlaceId: "p1",
      leaveFromPlaceName: "Home",
      leaveByStatus: "OK",
      leaveByReason: null,
      rsvps: [{ kidId: "k1", status: "YES" }],
    })
    const b = item("b", "2030-08-15T19:00:00.000Z", {
      feedName: "Squirt 1",
      title: "CYH Squirt 1 Practice",
      kidIds: ["k2"],
      uncoveredKidIds: [],
      leaveFromPlaceId: "p1",
      leaveFromPlaceName: "Home",
      leaveByStatus: "OK",
      leaveByReason: null,
      rsvps: [{ kidId: "k2", status: "YES" }],
    })
    const c = item("c", "2030-08-15T20:00:00.000Z", {
      feedName: "U10",
      title: "CYH U10 Practice",
      kidIds: ["k1"],
      uncoveredKidIds: [],
      leaveFromPlaceId: "p1",
      leaveFromPlaceName: "Home",
      leaveByStatus: "OK",
      leaveByReason: null,
      rsvps: [{ kidId: "k1", status: "YES" }],
    })
    const asked: CarpoolRide = {
      id: "ask-b",
      spaceId: "s1",
      eventKey: "UID:b",
      requestingCircleId: "c1",
      requestingCircleName: "House",
      requestedByAdultId: "a1",
      kidIds: ["k2"],
      kidFirstNames: ["Kian"],
      seats: 1,
      pickupPlaceName: "Home",
      pickupAddress: "1 Main",
      pickupTown: null,
      detourMinutes: null,
      status: "PENDING",
      legs: [
        {
          kind: "TO",
          phase: "ASKED_TEAM",
          assigneeAdultId: null,
          assigneeDisplayName: null,
          assigneeCircleId: null,
          assigneeCircleName: null,
          placeId: null,
          placeName: null,
          placeAddress: null,
          meetSide: "REQUESTER",
        },
        {
          kind: "FROM",
          phase: "ASKED_TEAM",
          assigneeAdultId: null,
          assigneeDisplayName: null,
          assigneeCircleId: null,
          assigneeCircleName: null,
          placeId: null,
          placeName: null,
          placeAddress: null,
          meetSide: "REQUESTER",
        },
      ],
      passedByMe: false,
      passedByAdultNames: [],
      acceptedByAdultId: null,
      acceptingCircleId: null,
      acceptingCircleName: null,
    }
    const youDrive: CarpoolRideEvent = {
      eventKey: "UID:c",
      title: "CYH U10 Practice",
      startsAt: c.startsAt,
      endsAt: null,
      defaultKidIds: ["k1"],
      ownRequest: null,
      ownRequests: [
        {
          id: "own-c",
          spaceId: "s1",
          eventKey: "UID:c",
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
          legs: [confirmedLeg("TO", "a1", "Chris"), confirmedLeg("FROM", "a1", "Chris")],
          passedByMe: false,
          passedByAdultNames: [],
          acceptedByAdultId: null,
          acceptingCircleId: null,
          acceptingCircleName: null,
        },
      ],
      ownLegs: [confirmedLeg("TO", "a1", "Chris"), confirmedLeg("FROM", "a1", "Chris")],
      otherRequests: [],
    }

    render(
      <AgendaBlockCard
        items={[a, b, c]}
        circle={{
          ...circle,
          places: [
            {
              id: "p1",
              name: "Home",
              address: "1 Main",
              latitude: 40,
              longitude: -74,
            },
          ],
        }}
        currentAdultId="a1"
        rideEventFor={rideEventForMap({
          b: {
            eventKey: "UID:b",
            title: b.title,
            startsAt: b.startsAt,
            endsAt: null,
            defaultKidIds: ["k2"],
            ownRequest: asked,
            ownRequests: [asked],
            ownLegs: asked.legs,
            otherRequests: [],
          },
          c: youDrive,
        })}
        assignDraft={{
          adultId: "a1",
          kidIds: ["k1", "k2"],
          soleAdult: false,
          soleKid: false,
        }}
        onUpdateAssignDraft={vi.fn()}
        onAssignCoverage={vi.fn()}
        onCreateRide={onCreateRide}
        onCancelRide={onCancelRide}
        canAskTeamForItem={() => true}
        hasPickupPlace
        onSetLeaveFrom={vi.fn()}
      />,
    )

    await expandBlock(user)
    const card = screen.getByTestId("agenda-block-card")
    expect(within(card).getByTestId("agenda-block-decision")).toBeInTheDocument()
    expect(
      within(card).getByTestId("agenda-block-decision-title-picker-k1"),
    ).toHaveTextContent("DECLAN — ROUND TRIP")
    expect(
      within(card).queryByTestId("agenda-block-decision-title-picker-k2"),
    ).not.toBeInTheDocument()
    expect(
      within(card).getByTestId("agenda-block-cancel-ask-ask-b"),
    ).toBeInTheDocument()

    await user.click(
      within(card).getByTestId("agenda-block-cancel-ask-btn-ask-b"),
    )
    expect(onCancelRide).toHaveBeenCalledWith(b, "ask-b")

    await user.click(within(card).getByRole("button", { name: "Ask the team" }))
    await user.click(
      within(card).getByRole("button", {
        name: "Post to team — Declan, round trip",
      }),
    )
    expect(onCreateRide).toHaveBeenCalledTimes(1)
    expect(onCreateRide).toHaveBeenCalledWith(a, "UID:a", ["k1"])
  })

  it("Frame K: one picker for two open kids; primary fans out per member event", async () => {
    const user = userEvent.setup()
    const onCreateRide = vi.fn()
    const a = item("a", "2030-08-15T18:00:00.000Z", {
      kidIds: ["k1"],
      uncoveredKidIds: ["k1"],
      leaveFromPlaceId: "p1",
      leaveFromPlaceName: "Home",
      leaveByStatus: "OK",
      leaveByReason: null,
      rsvps: [{ kidId: "k1", status: "YES" }],
    })
    const b = item("b", "2030-08-15T19:00:00.000Z", {
      kidIds: ["k2"],
      uncoveredKidIds: ["k2"],
      leaveFromPlaceId: "p1",
      leaveFromPlaceName: "Home",
      leaveByStatus: "OK",
      leaveByReason: null,
      rsvps: [{ kidId: "k2", status: "YES" }],
    })

    render(
      <AgendaBlockCard
        items={[a, b]}
        circle={{
          ...circle,
          places: [
            {
              id: "p1",
              name: "Home",
              address: "1 Main",
              latitude: 40,
              longitude: -74,
            },
          ],
        }}
        currentAdultId="a1"
        rideEventFor={() => null}
        assignDraft={{
          adultId: "a1",
          kidIds: ["k1", "k2"],
          soleAdult: false,
          soleKid: false,
        }}
        onUpdateAssignDraft={vi.fn()}
        onAssignCoverage={vi.fn()}
        onCreateRide={onCreateRide}
        canAskTeamForItem={() => true}
        hasPickupPlace
        onSetLeaveFrom={vi.fn()}
      />,
    )

    await expandBlock(user)
    const card = screen.getByTestId("agenda-block-card")
    expect(
      within(card).getByTestId("agenda-block-decision-title-picker-k1-k2"),
    ).toHaveTextContent("DECLAN + KIAN — ROUND TRIP")
    expect(
      within(card).getByRole("button", { name: /Different plans for each kid/i }),
    ).toBeInTheDocument()

    await user.click(within(card).getByRole("button", { name: "Ask the team" }))
    await user.click(
      within(card).getByRole("button", {
        name: "Post to team — Declan + Kian, round trip",
      }),
    )
    expect(onCreateRide).toHaveBeenCalledTimes(2)
    expect(onCreateRide).toHaveBeenNthCalledWith(1, a, "UID:a", ["k1"])
    expect(onCreateRide).toHaveBeenNthCalledWith(2, b, "UID:b", ["k2"])
  })
})
