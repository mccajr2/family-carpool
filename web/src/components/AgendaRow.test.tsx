import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import type { CalendarItem, FamilyCircle } from "@/api/types"
import { AgendaRow } from "@/components/AgendaRow"

function item(
  partial: Pick<CalendarItem, "id" | "title"> & Partial<CalendarItem>,
): CalendarItem {
  const kidIds = partial.kidIds ?? ["k1"]
  return {
    source: "MANUAL",
    startsAt: "2030-08-15T17:00:00.000Z",
    endsAt: null,
    location: "Rink",
    kidIds,
    feedId: null,
    feedName: null,
    leaveFromPlaceId: "p1",
    leaveFromPlaceName: "Mom's house",
    leaveByAt: "2030-08-15T16:30:00.000Z",
    leaveByStatus: "OK",
    leaveByReason: null,
    coverages: [],
    uncoveredKidIds: [],
    conflicts: [],
    rsvps: kidIds.map((kidId) => ({ kidId, status: "YES" as const })),
    ...partial,
  }
}

const circle: FamilyCircle = {
  id: "c1",
  name: "Test",
  role: "ORGANIZER",
  members: [
    { adultId: "a1", email: "a@example.com", displayName: "Alex", role: "ORGANIZER" },
  ],
  kids: [{ id: "k1", displayName: "Sam" }],
  places: [
    { id: "p1", name: "Mom's house", address: "1 Main", latitude: 40, longitude: -74 },
  ],
  defaultLeaveFromPlaceId: "p1",
  defaultLeaveFromPlaceName: "Mom's house",
}

const noopHandlers = {
  onUpdateAssignDraft: vi.fn(),
  onAssignCoverage: vi.fn(),
  onConfirmCoverage: vi.fn(),
  onDeclineCoverage: vi.fn(),
  onRemoveCoverage: vi.fn(),
  onSetLeaveFrom: vi.fn(),
  onSetRsvp: vi.fn(),
  onOpenPlaces: vi.fn(),
  onEdit: vi.fn(),
  onRemoveEvent: vi.fn(),
}

function renderRow(calendarItem: CalendarItem) {
  return render(
    <AgendaRow
      item={calendarItem}
      circle={circle}
      currentAdultId="a1"
      loading={false}
      assignDraft={{
        adultId: "a1",
        kidIds: calendarItem.uncoveredKidIds,
        soleAdult: true,
        soleKid: calendarItem.uncoveredKidIds.length <= 1,
      }}
      {...noopHandlers}
    />,
  )
}

describe("AgendaRow", () => {
  it("applies the display font to the row title", () => {
    renderRow(item({ id: "a", title: "Practice" }))
    expect(screen.getByText("Practice")).toHaveClass("fc-display")
  })

  it("lets the title and time wrap instead of nowrap truncate, so the page-frame 1fr track can shrink", () => {
    renderRow(
      item({
        id: "a",
        title: "Birthday Party — Maya at the Community Center",
        location: "450 Huron Ave, Cambridge",
      }),
    )
    const title = screen.getByText("Birthday Party — Maya at the Community Center")
    expect(title.className).not.toMatch(/truncate/)
    expect(title.className).not.toMatch(/whitespace-nowrap/)
    const time = screen.getByText(/450 Huron Ave/)
    expect(time.className).not.toMatch(/truncate/)
    expect(time.className).not.toMatch(/whitespace-nowrap/)
  })

  it("renders an out-of-play item muted with only a Not going tag and no coverage/travel when expanded", async () => {
    const user = userEvent.setup()
    renderRow(
      item({
        id: "skip",
        title: "Skip practice",
        rsvps: [{ kidId: "k1", status: "NO" }],
      }),
    )

    const row = screen.getByTestId("agenda-row-MANUAL-skip")
    expect(row).toHaveClass("opacity-60")
    expect(within(row).getByText("Not going")).toBeInTheDocument()
    expect(within(row).getByText("Not going").className).not.toMatch(/uppercase/)
    expect(within(row).getByTestId("agenda-status-pill-dot")).toBeInTheDocument()
    expect(within(row).queryByTestId("agenda-row-covering-avatars")).not.toBeInTheDocument()
    expect(within(row).queryByText("Needs coverage")).not.toBeInTheDocument()
    expect(within(row).queryByTestId("agenda-band-travel")).not.toBeInTheDocument()
    expect(within(row).queryByTestId("agenda-band-coverage")).not.toBeInTheDocument()

    await user.click(within(row).getByRole("button", { expanded: false }))
    expect(within(row).getByTestId("rsvp-MANUAL-skip-k1")).toHaveValue("NO")
    expect(within(row).queryByTestId("agenda-band-travel")).not.toBeInTheDocument()
    expect(within(row).queryByTestId("agenda-band-coverage")).not.toBeInTheDocument()
    expect(within(row).queryByText("Leave from")).not.toBeInTheDocument()
    expect(within(row).queryByRole("button", { name: "Assign coverage" })).not.toBeInTheDocument()
  })

  it("shows Confirm coverage tag when pending for the signed-in adult", () => {
    renderRow(
      item({
        id: "pending",
        title: "Practice",
        coverages: [
          {
            id: "cov1",
            coveringAdultId: "a1",
            coveringAdultDisplayName: "Alex",
            assignedByAdultId: "a2",
            kidIds: ["k1"],
            status: "PENDING",
          },
        ],
      }),
    )
    const row = screen.getByTestId("agenda-row-MANUAL-pending")
    expect(within(row).getByText("Confirm coverage")).toBeInTheDocument()
    expect(within(row).getByText("Confirm coverage").className).not.toMatch(/uppercase/)
    expect(within(row).getByTestId("agenda-status-pill-dot")).toBeInTheDocument()
    expect(within(row).queryByTestId("agenda-row-covering-avatars")).not.toBeInTheDocument()
    expect(within(row).queryByText("Confirmed")).not.toBeInTheDocument()
    expect(within(row).queryByText("Needs coverage")).not.toBeInTheDocument()
  })

  it("shows Awaiting confirm tag when pending for someone else", () => {
    const twoAdultCircle: FamilyCircle = {
      ...circle,
      members: [
        { adultId: "a1", email: "a@example.com", displayName: "Alex", role: "ORGANIZER" },
        { adultId: "a2", email: "j@example.com", displayName: "Jordan", role: "CAREGIVER" },
      ],
    }
    render(
      <AgendaRow
        item={item({
          id: "waiting",
          title: "Game",
          coverages: [
            {
              id: "cov1",
              coveringAdultId: "a2",
              coveringAdultDisplayName: "Jordan",
              assignedByAdultId: "a1",
              kidIds: ["k1"],
              status: "PENDING",
            },
          ],
        })}
        circle={twoAdultCircle}
        currentAdultId="a1"
        loading={false}
        assignDraft={{ adultId: "a1", kidIds: [], soleAdult: false, soleKid: true }}
        {...noopHandlers}
      />,
    )
    const row = screen.getByTestId("agenda-row-MANUAL-waiting")
    expect(within(row).getByText("Awaiting confirm")).toBeInTheDocument()
    expect(within(row).queryByTestId("agenda-row-covering-avatars")).not.toBeInTheDocument()
    expect(within(row).queryByText("Confirmed")).not.toBeInTheDocument()
  })

  it("shows covering avatars and a token chevron on confirmed in-play rows, without a standalone status dot", () => {
    renderRow(
      item({
        id: "covered",
        title: "Practice",
        coverages: [
          {
            id: "cov1",
            coveringAdultId: "a1",
            coveringAdultDisplayName: "Alex",
            assignedByAdultId: "a1",
            kidIds: ["k1"],
            status: "CONFIRMED",
          },
        ],
      }),
    )
    const row = screen.getByTestId("agenda-row-MANUAL-covered")
    expect(within(row).getByText("Confirmed")).toBeInTheDocument()
    expect(within(row).getByLabelText("Covering: Alex")).toHaveTextContent("A")
    expect(within(row).getByTestId("agenda-row-chevron")).toBeInTheDocument()
    expect(row.querySelector("[class*='h-[9px]']")).toBeNull()
  })

  it("stacks up to two covering avatars when two adults are confirmed", () => {
    const twoAdultCircle: FamilyCircle = {
      ...circle,
      members: [
        { adultId: "a1", email: "a@example.com", displayName: "Alex", role: "ORGANIZER" },
        { adultId: "a2", email: "j@example.com", displayName: "Jordan Lee", role: "CAREGIVER" },
      ],
    }
    render(
      <AgendaRow
        item={item({
          id: "shared",
          title: "Game",
          kidIds: ["k1"],
          coverages: [
            {
              id: "cov1",
              coveringAdultId: "a1",
              coveringAdultDisplayName: "Alex",
              assignedByAdultId: "a1",
              kidIds: ["k1"],
              status: "CONFIRMED",
            },
            {
              id: "cov2",
              coveringAdultId: "a2",
              coveringAdultDisplayName: "Jordan Lee",
              assignedByAdultId: "a1",
              kidIds: ["k1"],
              status: "CONFIRMED",
            },
          ],
        })}
        circle={twoAdultCircle}
        currentAdultId="a1"
        loading={false}
        assignDraft={{ adultId: "a1", kidIds: [], soleAdult: false, soleKid: true }}
        {...noopHandlers}
      />,
    )
    const avatars = screen.getByLabelText("Covering: Alex, Jordan Lee")
    expect(avatars).toHaveTextContent("A")
    expect(avatars).toHaveTextContent("JL")
  })

  it("toggles expand/collapse per row without affecting other rows", async () => {
    const user = userEvent.setup()
    render(
      <>
        <AgendaRow
          item={item({ id: "a", title: "Practice" })}
          circle={circle}
          currentAdultId="a1"
          loading={false}
          assignDraft={{ adultId: "a1", kidIds: [], soleAdult: true, soleKid: true }}
          {...noopHandlers}
        />
        <AgendaRow
          item={item({ id: "b", title: "Game" })}
          circle={circle}
          currentAdultId="a1"
          loading={false}
          assignDraft={{ adultId: "a1", kidIds: [], soleAdult: true, soleKid: true }}
          {...noopHandlers}
        />
      </>,
    )

    const rowA = screen.getByTestId("agenda-row-MANUAL-a")
    const rowB = screen.getByTestId("agenda-row-MANUAL-b")
    expect(within(rowA).queryByTestId("agenda-band-people")).not.toBeInTheDocument()
    expect(within(rowB).queryByTestId("agenda-band-people")).not.toBeInTheDocument()

    await user.click(within(rowA).getByRole("button", { expanded: false }))
    expect(within(rowA).getByTestId("agenda-band-people")).toBeInTheDocument()
    expect(within(rowB).queryByTestId("agenda-band-people")).not.toBeInTheDocument()

    await user.click(within(rowA).getByRole("button", { expanded: true }))
    await user.click(within(rowB).getByRole("button", { expanded: false }))
    expect(within(rowA).queryByTestId("agenda-band-people")).not.toBeInTheDocument()
    expect(within(rowB).getByTestId("agenda-band-people")).toBeInTheDocument()
  })

  it("shows Requested chip collapsed and Request/Cancel when expanded for a ride event", async () => {
    const user = userEvent.setup()
    const onCreateRide = vi.fn()
    const onCancelRide = vi.fn()
    const feedItem = item({
      id: "feed-1",
      source: "FEED",
      title: "Practice",
      feedId: "f1",
      feedName: "Soccer",
      kidIds: ["k1", "k2"],
      rsvps: [
        { kidId: "k1", status: "YES" },
        { kidId: "k2", status: "YES" },
      ],
    })
    const twoKids: FamilyCircle = {
      ...circle,
      kids: [
        { id: "k1", displayName: "Sam" },
        { id: "k2", displayName: "Riley" },
      ],
    }
    const rideEvent = {
      eventKey: "UID:practice",
      title: "Practice",
      startsAt: feedItem.startsAt,
      endsAt: null,
      defaultKidIds: ["k1", "k2"],
      ownRequest: null,
      otherRequests: [],
    }

    const { rerender } = render(
      <AgendaRow
        item={feedItem}
        circle={twoKids}
        currentAdultId="a1"
        loading={false}
        assignDraft={{ adultId: "a1", kidIds: [], soleAdult: true, soleKid: true }}
        rideEvent={rideEvent}
        onCreateRide={onCreateRide}
        onCancelRide={onCancelRide}
        {...noopHandlers}
      />,
    )

    const row = screen.getByTestId("agenda-row-FEED-feed-1")
    expect(within(row).queryByText("Requested")).not.toBeInTheDocument()
    expect(within(row).queryByTestId("agenda-band-carpool")).not.toBeInTheDocument()

    await user.click(within(row).getByRole("button", { expanded: false }))
    const band = within(row).getByTestId("agenda-band-carpool")
    expect(within(band).getByRole("checkbox", { name: "Request ride for Sam" })).toBeChecked()
    expect(within(band).getByRole("checkbox", { name: "Request ride for Riley" })).toBeChecked()
    await user.click(within(band).getByRole("checkbox", { name: "Request ride for Riley" }))
    await user.click(within(band).getByRole("button", { name: "Request" }))
    expect(onCreateRide).toHaveBeenCalledWith("UID:practice", ["k1"])

    const requestedEvent = {
      ...rideEvent,
      defaultKidIds: [],
      ownRequest: {
        id: "ride-1",
        spaceId: "s1",
        eventKey: "UID:practice",
        requestingCircleId: "c1",
        requestingCircleName: "Test",
        requestedByAdultId: "a1",
        kidIds: ["k1"],
        kidFirstNames: ["Sam"],
        seats: 1,
        pickupPlaceName: "Home",
        pickupAddress: "1 Main",
        status: "PENDING" as const,
        passedByMe: false,
        acceptedByAdultId: null,
        acceptingCircleId: null,
        acceptingCircleName: null,
        vehicleId: null,
        vehicleLabel: null,
      },
    }
    rerender(
      <AgendaRow
        item={feedItem}
        circle={twoKids}
        currentAdultId="a1"
        loading={false}
        assignDraft={{ adultId: "a1", kidIds: [], soleAdult: true, soleKid: true }}
        rideEvent={requestedEvent}
        onCreateRide={onCreateRide}
        onCancelRide={onCancelRide}
        {...noopHandlers}
      />,
    )
    expect(within(row).getByText("Requested")).toBeInTheDocument()
    await user.click(within(row).getByRole("button", { name: "Cancel" }))
    expect(onCancelRide).toHaveBeenCalledWith("ride-1")

    rerender(
      <AgendaRow
        item={feedItem}
        circle={twoKids}
        currentAdultId="a1"
        loading={false}
        assignDraft={{ adultId: "a1", kidIds: [], soleAdult: true, soleKid: true }}
        rideEvent={{
          ...requestedEvent,
          ownRequest: {
            ...requestedEvent.ownRequest!,
            status: "ACCEPTED",
            acceptingCircleName: "House B",
          },
        }}
        onCreateRide={onCreateRide}
        onCancelRide={onCancelRide}
        {...noopHandlers}
      />,
    )
    expect(within(row).getByText("Accepted · House B")).toBeInTheDocument()
  })
})
