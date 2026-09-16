import { render, screen, within } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import type {
  CalendarItem,
  CarpoolRide,
  CarpoolRideEvent,
  CarpoolRideLeg,
  FamilyCircle,
} from "@/api/types"
import { AgendaBlockCard } from "@/components/AgendaBlockCard"
import { NOT_YOUR_JOB_TONIGHT } from "@/components/coverageCopy"

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

describe("AgendaBlockCard", () => {
  it("renders one card with runs, event bands, and muted not-your-job band", () => {
    const members = [
      item("a", "2030-08-15T18:00:00.000Z", {
        endsAt: "2030-08-15T19:00:00.000Z",
        leaveByAt: "2030-08-15T17:40:00.000Z",
        kidIds: ["k1", "k2"],
        rsvps: [
          { kidId: "k1", status: "YES" },
          { kidId: "k2", status: "YES" },
        ],
      }),
      item("b", "2030-08-15T19:00:00.000Z", {
        endsAt: "2030-08-15T20:00:00.000Z",
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
      />,
    )

    const card = screen.getByTestId("agenda-block-card")
    expect(within(card).getByTestId("agenda-block-title")).toHaveTextContent(
      "Two events tonight",
    )
    expect(within(card).getByTestId("agenda-block-run-to")).toBeInTheDocument()
    expect(within(card).getByTestId("agenda-block-run-to-chip")).toHaveTextContent(
      "You're driving · 2 riders",
    )
    expect(within(card).getByTestId("agenda-block-event-bands").children).toHaveLength(
      2,
    )
    const muted = within(card).getByTestId("agenda-block-muted-band")
    expect(within(muted).getByTestId("agenda-block-muted-heading")).toHaveTextContent(
      NOT_YOUR_JOB_TONIGHT,
    )
    expect(within(muted).getByTestId("agenda-block-muted-lines").textContent).toMatch(
      /Kian/,
    )
    expect(within(card).getByTestId("agenda-block-run-from")).toBeInTheDocument()
    expect(within(card).getByTestId("agenda-block-run-from-summary")).toHaveTextContent(
      /Simoni Rink → home/,
    )
    expect(screen.queryByTestId("agenda-row-FEED-a")).not.toBeInTheDocument()
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
})
