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
    eventKey: null,
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
  it("renders GameCard hierarchy with list-row tokens and no title truncate", () => {
    renderRow(
      item({
        id: "a",
        title: "Birthday Party — Maya at the Community Center",
        location: "450 Huron Ave, Cambridge",
      }),
    )
    const row = screen.getByTestId("agenda-row-MANUAL-a")
    expect(row.className).toMatch(/--fc-radius-xl/)
    expect(row.className).toMatch(/--fc-surface-raised/)
    expect(within(row).queryByTestId("agenda-row-team")).not.toBeInTheDocument()
    const title = within(row).getByTestId("agenda-row-title")
    expect(title).toHaveTextContent("Birthday Party — Maya at the Community Center")
    expect(title.className).toMatch(/--fc-font-list-row-title-size/)
    expect(title.className).not.toMatch(/truncate/)
    expect(title.className).not.toMatch(/whitespace-nowrap/)
    const when = within(row).getByTestId("agenda-row-when")
    expect(when.className).toMatch(/--fc-font-list-row-meta-size/)
    expect(when.className).not.toMatch(/truncate/)
    const where = within(row).getByTestId("agenda-row-where")
    expect(where).toHaveTextContent("450 Huron Ave, Cambridge")
    expect(where.className).not.toMatch(/truncate/)
  })

  it("shows feed name as uppercase team label and focuses with ring tokens", () => {
    render(
      <AgendaRow
        item={item({
          id: "feed",
          source: "FEED",
          title: "vs Hawks",
          feedName: "U12 Soccer",
          location: "Field 2",
        })}
        isFocused
        circle={circle}
        currentAdultId="a1"
        loading={false}
        assignDraft={{ adultId: "a1", kidIds: [], soleAdult: true, soleKid: true }}
        {...noopHandlers}
      />,
    )
    const row = screen.getByTestId("agenda-row-FEED-feed")
    expect(row).toHaveAttribute("data-focused", "true")
    expect(row.className).toMatch(/--fc-list-row-focus-border/)
    expect(row.style.boxShadow).toContain("--fc-list-row-focus-halo")
    const team = within(row).getByTestId("agenda-row-team")
    expect(team).toHaveTextContent("U12 Soccer")
    expect(team.className).toMatch(/uppercase/)
    expect(team.className).toMatch(/--fc-font-list-row-team-size/)
    expect(within(row).getByTestId("agenda-row-title")).toHaveTextContent("vs Hawks")
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
    expect(within(row).getByText("Not going").className).toMatch(/uppercase/)
    expect(within(row).getByText("Not going").className).toMatch(/--fc-font-feed-chip-size/)
    expect(within(row).queryByTestId("agenda-status-pill-dot")).not.toBeInTheDocument()
    expect(within(row).queryByTestId("agenda-row-covering-avatars")).not.toBeInTheDocument()
    expect(within(row).queryByText("Needs coverage")).not.toBeInTheDocument()
    expect(within(row).queryByTestId("agenda-band-travel")).not.toBeInTheDocument()
    expect(within(row).queryByTestId("agenda-band-coverage")).not.toBeInTheDocument()

    await user.click(within(row).getByRole("button", { expanded: false }))
    const attendance = within(row).getByTestId("rsvp-MANUAL-skip-k1")
    expect(attendance).toHaveAttribute("data-attendance", "not_going")
    expect(attendance).toHaveTextContent("Sam is marked not going.")
    expect(
      within(row).getByRole("button", { name: "Mark as going again" }),
    ).toBeInTheDocument()
    expect(within(row).queryByRole("combobox")).not.toBeInTheDocument()
    expect(within(row).queryByTestId("agenda-band-travel")).not.toBeInTheDocument()
    expect(within(row).queryByTestId("agenda-band-coverage")).not.toBeInTheDocument()
    expect(within(row).getByTestId("agenda-band-kids")).toBeInTheDocument()
    expect(within(row).queryByText("Leave from")).not.toBeInTheDocument()
    expect(within(row).queryByRole("button", { name: "Assign coverage" })).not.toBeInTheDocument()
    expect(within(row).queryByTestId("driver-picker")).not.toBeInTheDocument()
    expect(
      within(row).queryByRole("button", { name: /can't drive anymore/i }),
    ).not.toBeInTheDocument()
  })

  it("shows Mark as not going under the kid band and writes NO via onSetRsvp", async () => {
    const user = userEvent.setup()
    const onSetRsvp = vi.fn()
    render(
      <AgendaRow
        item={item({ id: "going", title: "Game" })}
        circle={circle}
        currentAdultId="a1"
        loading={false}
        assignDraft={{ adultId: "a1", kidIds: [], soleAdult: true, soleKid: true }}
        {...noopHandlers}
        onSetRsvp={onSetRsvp}
      />,
    )
    const row = screen.getByTestId("agenda-row-MANUAL-going")
    await user.click(within(row).getByRole("button", { expanded: false }))
    const toggle = within(row).getByTestId("rsvp-MANUAL-going-k1")
    expect(toggle).toHaveAttribute("data-attendance", "going")
    expect(toggle).toHaveTextContent("Mark Sam as not going")
    expect(within(row).queryByRole("combobox")).not.toBeInTheDocument()
    expect(within(row).queryByText("No response")).not.toBeInTheDocument()
    await user.click(toggle)
    expect(onSetRsvp).toHaveBeenCalledWith("k1", "NO")
  })

  it("hides per-kid driver/coverage chrome for not-going kids on mixed multi-kid items", async () => {
    const user = userEvent.setup()
    const twoKids: FamilyCircle = {
      ...circle,
      kids: [
        { id: "k1", displayName: "Sam" },
        { id: "k2", displayName: "Riley" },
      ],
    }
    render(
      <AgendaRow
        item={item({
          id: "mixed",
          title: "Game",
          kidIds: ["k1", "k2"],
          uncoveredKidIds: ["k2"],
          rsvps: [
            { kidId: "k1", status: "NO" },
            { kidId: "k2", status: "YES" },
          ],
        })}
        circle={twoKids}
        currentAdultId="a1"
        loading={false}
        assignDraft={{ adultId: "a1", kidIds: ["k2"], soleAdult: true, soleKid: true }}
        {...noopHandlers}
      />,
    )

    const row = screen.getByTestId("agenda-row-MANUAL-mixed")
    await user.click(within(row).getByRole("button", { expanded: false }))

    const samRow = within(row).getByTestId("agenda-kid-row-k1")
    expect(within(samRow).getByTestId("rsvp-MANUAL-mixed-k1")).toHaveAttribute(
      "data-attendance",
      "not_going",
    )
    expect(within(samRow).queryByTestId("driver-picker")).not.toBeInTheDocument()
    expect(within(samRow).queryByRole("button", { name: "Confirm coverage" })).not.toBeInTheDocument()
    expect(
      within(samRow).queryByRole("button", { name: /can't drive anymore/i }),
    ).not.toBeInTheDocument()
    expect(within(samRow).queryByText("Sam")).not.toBeInTheDocument()

    const rileyRow = within(row).getByTestId("agenda-kid-row-k2")
    expect(within(rileyRow).getByText("Riley")).toBeInTheDocument()
    expect(within(rileyRow).getByTestId("driver-picker")).toBeInTheDocument()
    expect(within(rileyRow).getByTestId("rsvp-MANUAL-mixed-k2")).toHaveAttribute(
      "data-attendance",
      "going",
    )
    expect(within(row).getByText("Needs coverage: Riley")).toBeInTheDocument()
    expect(within(row).queryByText(/Needs coverage:.*Sam/)).not.toBeInTheDocument()
  })

  it("shows Confirm you'll drive tag when pending for the signed-in adult", () => {
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
    expect(within(row).getByText("Confirm you'll drive")).toBeInTheDocument()
    expect(within(row).getByText("Confirm you'll drive").className).toMatch(/uppercase/)
    expect(within(row).getByText("Confirm you'll drive").className).toMatch(/--fc-font-feed-chip-size/)
    expect(within(row).queryByTestId("agenda-status-pill-dot")).not.toBeInTheDocument()
    expect(within(row).queryByTestId("agenda-row-covering-avatars")).not.toBeInTheDocument()
    expect(within(row).queryByText("You're driving")).not.toBeInTheDocument()
    expect(within(row).queryByText("Ride needed")).not.toBeInTheDocument()
  })

  it("shows Waiting on tag when pending for someone else", () => {
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
    expect(within(row).getByText("Waiting on Jordan")).toBeInTheDocument()
    expect(within(row).queryByTestId("agenda-row-covering-avatars")).not.toBeInTheDocument()
    expect(within(row).queryByText("You're driving")).not.toBeInTheDocument()
  })

  it("uses default accent fill for route tone on collapsed rows", () => {
    render(
      <AgendaRow
        item={item({
          id: "route-row",
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
        })}
        circle={circle}
        currentAdultId="a1"
        loading={false}
        assignDraft={{ adultId: "a1", kidIds: [], soleAdult: true, soleKid: true }}
        rideEvent={{
          eventKey: "UID:game",
          title: "Practice",
          startsAt: "2030-08-15T17:00:00.000Z",
          endsAt: null,
          defaultKidIds: [],
          ownRequest: null,
          otherRequests: [
            {
              id: "accepted-1",
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
              status: "ACCEPTED" as const,
              passedByMe: false,
              passedByAdultNames: [],
              acceptedByAdultId: "a1",
              acceptingCircleId: "c1",
              acceptingCircleName: null,
              vehicleId: "v1",
              vehicleLabel: "Van",
            },
          ],
        }}
        {...noopHandlers}
      />,
    )
    const row = screen.getByTestId("agenda-row-MANUAL-route-row")
    const routeChip = within(row).getByText("You're driving · +1")
    expect(routeChip.className).toMatch(/--fc-accent/)
    expect(routeChip.className).not.toMatch(/--fc-hero-accent/)
  })

  it("shows status chips and a chevron on confirmed in-play rows, without covering avatars or a status dot", () => {
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
    expect(within(row).getByText("You're driving")).toBeInTheDocument()
    expect(within(row).queryByTestId("agenda-row-covering-avatars")).not.toBeInTheDocument()
    expect(within(row).getByTestId("agenda-row-chevron")).toBeInTheDocument()
    expect(row.querySelector("[class*='h-[9px]']")).toBeNull()
  })

  it("does not render covering avatars when multiple adults are confirmed", () => {
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
    expect(screen.queryByLabelText("Covering: Alex, Jordan Lee")).not.toBeInTheDocument()
    expect(screen.queryByTestId("agenda-row-covering-avatars")).not.toBeInTheDocument()
    expect(screen.getByText("You're driving")).toBeInTheDocument()
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

  it("shows Asked the team chip collapsed and Request/Cancel when expanded for a ride event", async () => {
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
    expect(within(row).queryByText("Asked the team")).not.toBeInTheDocument()
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
        passedByAdultNames: [],
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
    expect(within(row).getAllByText("Asked the team").length).toBeGreaterThan(0)
    expect(within(row).getByTestId("agenda-row-own-ride")).toHaveTextContent(
      "Requested · Sam · 1 seat · Home, 1 Main",
    )
    await user.click(
      within(row).getByRole("button", {
        name: "No longer need a ride? Cancel this ask",
      }),
    )
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
            passedByAdultNames: ["Sam"],
          },
        }}
        onCreateRide={onCreateRide}
        onCancelRide={onCancelRide}
        {...noopHandlers}
      />,
    )
    expect(within(row).getByText(/Passed by Sam/)).toBeInTheDocument()
    expect(within(row).getByTestId("agenda-row-own-ride")).toHaveTextContent(
      "Passed by Sam · Sam · 1 seat · Home, 1 Main",
    )
    expect(within(row).queryByTestId("agenda-band-carpool")).not.toBeInTheDocument()
    expect(within(row).getByTestId("agenda-row-own-ride")).not.toHaveTextContent(
      /^Requested/,
    )

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
    expect(within(row).getAllByText("Riding with House B").length).toBeGreaterThan(0)
    expect(within(row).getByTestId("agenda-row-own-ride")).toHaveTextContent(
      "Riding with House B · Sam · 1 seat · Home, 1 Main",
    )
    expect(within(row).queryByText(/Accepted ·|Accepted:/)).not.toBeInTheDocument()
  })

  it("clears Needs coverage / Assign when ACCEPTED ride covers all uncovered kids", async () => {
    const user = userEvent.setup()
    const feedItem = item({
      id: "feed-accepted",
      source: "FEED",
      title: "Practice",
      feedId: "f1",
      feedName: "Soccer",
      uncoveredKidIds: ["k1"],
    })
    const rideEvent = {
      eventKey: "UID:accepted",
      title: "Practice",
      startsAt: feedItem.startsAt,
      endsAt: null,
      defaultKidIds: [],
      ownRequest: {
        id: "ride-1",
        spaceId: "s1",
        eventKey: "UID:accepted",
        requestingCircleId: "c1",
        requestingCircleName: "Test",
        requestedByAdultId: "a1",
        kidIds: ["k1"],
        kidFirstNames: ["Sam"],
        seats: 1,
        pickupPlaceName: "Home",
        pickupAddress: "1 Main",
        status: "ACCEPTED" as const,
        passedByMe: false,
        passedByAdultNames: [],
        acceptedByAdultId: "a2",
        acceptingCircleId: "c2",
        acceptingCircleName: "Sharks Family",
        vehicleId: "v1",
        vehicleLabel: "Van",
      },
      otherRequests: [],
    }

    render(
      <AgendaRow
        item={feedItem}
        circle={circle}
        currentAdultId="a1"
        loading={false}
        assignDraft={{ adultId: "a1", kidIds: ["k1"], soleAdult: true, soleKid: true }}
        rideEvent={rideEvent}
        onCreateRide={vi.fn()}
        onCancelRide={vi.fn()}
        {...noopHandlers}
      />,
    )

    const row = screen.getByTestId("agenda-row-FEED-feed-accepted")
    expect(within(row).getAllByText("Riding with Sharks Family").length).toBeGreaterThan(0)
    expect(within(row).queryByText("Needs coverage")).not.toBeInTheDocument()
    expect(within(row).queryByText(/Accepted ·|Accepted:/)).not.toBeInTheDocument()

    await user.click(within(row).getByRole("button", { expanded: false }))
    expect(within(row).queryByRole("button", { name: "Assign coverage" })).not.toBeInTheDocument()
    expect(within(row).queryByTestId("driver-picker")).not.toBeInTheDocument()
    expect(within(row).getAllByText("Riding with Sharks Family").length).toBeGreaterThan(0)
    expect(
      within(row).getByRole("button", {
        name: "Sharks Family can't drive anymore? Find a new ride",
      }),
    ).toBeInTheDocument()
    expect(within(row).queryByRole("button", { name: "Remove coverage" })).not.toBeInTheDocument()
  })

  it("keeps Ride needed chip and Assign for remaining gap kids after a teammate ride", async () => {
    const user = userEvent.setup()
    const twoKids: FamilyCircle = {
      ...circle,
      kids: [
        { id: "k1", displayName: "Sam" },
        { id: "k2", displayName: "Riley" },
      ],
    }
    const feedItem = item({
      id: "feed-mixed",
      source: "FEED",
      title: "Practice",
      feedId: "f1",
      feedName: "Soccer",
      kidIds: ["k1", "k2"],
      uncoveredKidIds: ["k1", "k2"],
      rsvps: [
        { kidId: "k1", status: "YES" },
        { kidId: "k2", status: "YES" },
      ],
    })
    const rideEvent = {
      eventKey: "UID:mixed",
      title: "Practice",
      startsAt: feedItem.startsAt,
      endsAt: null,
      defaultKidIds: [],
      ownRequest: {
        id: "ride-1",
        spaceId: "s1",
        eventKey: "UID:mixed",
        requestingCircleId: "c1",
        requestingCircleName: "Test",
        requestedByAdultId: "a1",
        kidIds: ["k1"],
        kidFirstNames: ["Sam"],
        seats: 1,
        pickupPlaceName: "Home",
        pickupAddress: "1 Main",
        status: "ACCEPTED" as const,
        passedByMe: false,
        passedByAdultNames: [],
        acceptedByAdultId: "a2",
        acceptingCircleId: "c2",
        acceptingCircleName: "House B",
        vehicleId: "v1",
        vehicleLabel: "Van",
      },
      otherRequests: [],
    }

    render(
      <AgendaRow
        item={feedItem}
        circle={twoKids}
        currentAdultId="a1"
        loading={false}
        assignDraft={{ adultId: "a1", kidIds: ["k2"], soleAdult: true, soleKid: true }}
        rideEvent={rideEvent}
        onCreateRide={vi.fn()}
        onCancelRide={vi.fn()}
        {...noopHandlers}
      />,
    )

    const row = screen.getByTestId("agenda-row-FEED-feed-mixed")
    expect(within(row).getByText("Ride needed")).toBeInTheDocument()
    expect(within(row).queryByText("Riding with House B")).not.toBeInTheDocument()

    await user.click(within(row).getByRole("button", { expanded: false }))
    expect(within(row).getByText("Needs coverage: Riley")).toBeInTheDocument()
    expect(within(row).queryByText(/Needs coverage:.*Sam/)).not.toBeInTheDocument()
    const riley = within(row).getByTestId("agenda-kid-row-k2")
    expect(within(riley).getByTestId("driver-picker")).toBeInTheDocument()
    expect(within(riley).getByRole("button", { name: "Confirm I'll drive" })).toBeInTheDocument()
    const sam = within(row).getByTestId("agenda-kid-row-k1")
    expect(within(sam).queryByTestId("driver-picker")).not.toBeInTheDocument()
    expect(
      within(sam).getByRole("button", {
        name: "House B can't drive anymore? Find a new ride",
      }),
    ).toBeInTheDocument()
  })

  it("shows RevertRideLink cancel ask instead of Assign while own ride is PENDING", async () => {
    const user = userEvent.setup()
    const feedItem = item({
      id: "feed-pending",
      source: "FEED",
      title: "Practice",
      feedId: "f1",
      feedName: "Soccer",
      uncoveredKidIds: ["k1"],
    })
    const rideEvent = {
      eventKey: "UID:pending",
      title: "Practice",
      startsAt: feedItem.startsAt,
      endsAt: null,
      defaultKidIds: [],
      ownRequest: {
        id: "ride-1",
        spaceId: "s1",
        eventKey: "UID:pending",
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
        passedByAdultNames: [],
        acceptedByAdultId: null,
        acceptingCircleId: null,
        acceptingCircleName: null,
        vehicleId: null,
        vehicleLabel: null,
      },
      otherRequests: [],
    }

    render(
      <AgendaRow
        item={feedItem}
        circle={circle}
        currentAdultId="a1"
        loading={false}
        assignDraft={{ adultId: "a1", kidIds: ["k1"], soleAdult: true, soleKid: true }}
        rideEvent={rideEvent}
        onCreateRide={vi.fn()}
        onCancelRide={vi.fn()}
        {...noopHandlers}
      />,
    )

    const row = screen.getByTestId("agenda-row-FEED-feed-pending")
    expect(within(row).getByText("Asked the team")).toBeInTheDocument()
    expect(within(row).queryByText("Ride needed")).not.toBeInTheDocument()

    await user.click(within(row).getByRole("button", { expanded: false }))
    expect(within(row).queryByTestId("driver-picker")).not.toBeInTheDocument()
    expect(within(row).queryByText("Needs coverage: Sam")).not.toBeInTheDocument()
    expect(
      within(row).getByRole("button", {
        name: "No longer need a ride? Cancel this ask",
      }),
    ).toBeInTheDocument()
  })

  it("shows DriverPicker on the kid band when there is a coverage gap", async () => {
    const user = userEvent.setup()
    const onCreateRide = vi.fn()
    const onAssignCoverage = vi.fn()
    const feedItem = item({
      id: "feed-gap",
      source: "FEED",
      title: "Practice",
      feedId: "f1",
      feedName: "Soccer",
      kidIds: ["k1"],
      uncoveredKidIds: ["k1"],
      rsvps: [{ kidId: "k1", status: "YES" }],
    })
    const rideEvent = {
      eventKey: "UID:gap",
      title: "Practice",
      startsAt: feedItem.startsAt,
      endsAt: null,
      defaultKidIds: ["k1"],
      ownRequest: null,
      otherRequests: [],
    }

    render(
      <AgendaRow
        item={feedItem}
        circle={circle}
        currentAdultId="a1"
        loading={false}
        assignDraft={{ adultId: "a1", kidIds: ["k1"], soleAdult: true, soleKid: true }}
        rideEvent={rideEvent}
        onCreateRide={onCreateRide}
        onCancelRide={vi.fn()}
        {...noopHandlers}
        onAssignCoverage={onAssignCoverage}
      />,
    )

    const row = screen.getByTestId("agenda-row-FEED-feed-gap")
    await user.click(within(row).getByRole("button", { expanded: false }))
    const kid = within(row).getByTestId("agenda-kid-row-k1")
    expect(within(kid).getByTestId("driver-picker")).toBeInTheDocument()
    expect(within(row).queryByRole("button", { name: "Request" })).not.toBeInTheDocument()
    await user.click(within(kid).getByRole("button", { name: "Ask the team for a ride" }))
    expect(onCreateRide).toHaveBeenCalledWith("UID:gap", undefined)
    await user.click(within(kid).getByRole("button", { name: "Confirm I'll drive" }))
    expect(onAssignCoverage).toHaveBeenCalledWith("a1", ["k1"])
  })

  it("shows Request for No-response defaults without telling adults to RSVP Yes first", async () => {
    const user = userEvent.setup()
    const onCreateRide = vi.fn()
    const feedItem = item({
      id: "feed-nr",
      source: "FEED",
      title: "Practice",
      feedId: "f1",
      feedName: "Soccer",
      kidIds: ["k1"],
      rsvps: [{ kidId: "k1", status: "NO_RESPONSE" }],
    })
    const rideEvent = {
      eventKey: "UID:practice-nr",
      title: "Practice",
      startsAt: feedItem.startsAt,
      endsAt: null,
      defaultKidIds: ["k1"],
      ownRequest: null,
      otherRequests: [],
    }

    render(
      <AgendaRow
        item={feedItem}
        circle={circle}
        currentAdultId="a1"
        loading={false}
        assignDraft={{ adultId: "a1", kidIds: [], soleAdult: true, soleKid: true }}
        rideEvent={rideEvent}
        onCreateRide={onCreateRide}
        onCancelRide={vi.fn()}
        {...noopHandlers}
      />,
    )

    const row = screen.getByTestId("agenda-row-FEED-feed-nr")
    expect(
      within(row).queryByText("Mark who's going on Calendar to request a ride."),
    ).not.toBeInTheDocument()
    await user.click(within(row).getByRole("button", { expanded: false }))
    const band = within(row).getByTestId("agenda-band-carpool")
    expect(within(band).getByRole("button", { name: "Request" })).toBeEnabled()
    await user.click(within(band).getByRole("button", { name: "Request" }))
    expect(onCreateRide).toHaveBeenCalledWith("UID:practice-nr", undefined)
  })

  it("shows accepted-by-us ride density and Can't take them anymore when expanded", async () => {
    const user = userEvent.setup()
    const onWithdrawRide = vi.fn()
    const feedItem = item({
      id: "feed-withdraw",
      source: "FEED",
      title: "Practice",
      feedId: "f1",
      feedName: "Soccer",
      eventKey: "UID:practice-w",
    })
    const rideEvent = {
      eventKey: "UID:practice-w",
      title: "Practice",
      startsAt: feedItem.startsAt,
      endsAt: null,
      defaultKidIds: [],
      ownRequest: null,
      otherRequests: [
        {
          id: "ask-accepted",
          spaceId: "s1",
          eventKey: "UID:practice-w",
          requestingCircleId: "c2",
          requestingCircleName: "House B",
          requestedByAdultId: "a2",
          kidIds: ["k2"],
          kidFirstNames: ["Mia"],
          seats: 1,
          pickupPlaceName: "Home",
          pickupAddress: "1 Main",
          status: "ACCEPTED" as const,
          passedByMe: false,
          passedByAdultNames: [],
          acceptedByAdultId: "a1",
          acceptingCircleId: "c1",
          acceptingCircleName: "Test",
          vehicleId: "v1",
          vehicleLabel: "Van",
        },
      ],
    }

    render(
      <AgendaRow
        item={feedItem}
        circle={circle}
        currentAdultId="a1"
        loading={false}
        assignDraft={{ adultId: "a1", kidIds: [], soleAdult: true, soleKid: true }}
        rideEvent={rideEvent}
        onWithdrawRide={onWithdrawRide}
        {...noopHandlers}
      />,
    )

    const row = screen.getByTestId("agenda-row-FEED-feed-withdraw")
    expect(within(row).queryByTestId("agenda-band-carpool")).not.toBeInTheDocument()
    await user.click(within(row).getByRole("button", { expanded: false }))
    const inbound = within(row).getByTestId("agenda-band-inbound-requests")
    expect(within(inbound).getByTestId("agenda-inbound-request-ask-accepted")).toHaveTextContent(
      "House B · Mia · 1 seat · Home, 1 Main",
    )
    expect(within(inbound).queryByRole("button", { name: "Accept" })).not.toBeInTheDocument()
    expect(within(inbound).queryByRole("button", { name: "Pass" })).not.toBeInTheDocument()
    await user.click(
      within(inbound).getByRole("button", { name: "Can't take them anymore" }),
    )
    expect(onWithdrawRide).toHaveBeenCalledWith("ask-accepted")
  })

  it("shows Accept and Pass for pending inbound asks outside the hero queue", async () => {
    const user = userEvent.setup()
    const onAcceptRide = vi.fn()
    const onPassRide = vi.fn()
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
    const feedItem = item({
      id: "feed-accept",
      source: "FEED",
      title: "Practice",
      feedId: "f1",
      feedName: "Soccer",
      eventKey: "UID:practice-accept",
    })

    render(
      <AgendaRow
        item={feedItem}
        circle={circle}
        currentAdultId="a1"
        loading={false}
        assignDraft={{ adultId: "a1", kidIds: [], soleAdult: true, soleKid: true }}
        garage={garage}
        rideEvent={{
          eventKey: "UID:practice-accept",
          title: "Practice",
          startsAt: feedItem.startsAt,
          endsAt: null,
          defaultKidIds: ["k1"],
          ownRequest: null,
          otherRequests: [
            {
              id: "pending-other",
              spaceId: "s1",
              eventKey: "UID:practice-accept",
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
            },
          ],
        }}
        onAcceptRide={onAcceptRide}
        onPassRide={onPassRide}
        onCreateRide={vi.fn()}
        onCancelRide={vi.fn()}
        onWithdrawRide={vi.fn()}
        {...noopHandlers}
      />,
    )

    const row = screen.getByTestId("agenda-row-FEED-feed-accept")
    await user.click(within(row).getByRole("button", { expanded: false }))
    const inbound = within(row).getByTestId("agenda-band-inbound-requests")
    await user.click(within(inbound).getByRole("button", { name: "Accept" }))
    expect(onAcceptRide).toHaveBeenCalledWith("pending-other", "v1")
    await user.click(within(inbound).getByRole("button", { name: "Pass" }))
    expect(onPassRide).toHaveBeenCalledWith("pending-other")
  })

  it("hides Accept and Pass when the ask is active in the hero queue", async () => {
    const user = userEvent.setup()
    const feedItem = item({
      id: "feed-queued",
      source: "FEED",
      title: "Practice",
      feedId: "f1",
      feedName: "Soccer",
      eventKey: "UID:practice-queued",
    })

    render(
      <AgendaRow
        item={feedItem}
        circle={circle}
        currentAdultId="a1"
        loading={false}
        assignDraft={{ adultId: "a1", kidIds: [], soleAdult: true, soleKid: true }}
        garage={{
          members: [{ adultId: "a1", displayName: "Alex", drives: true }],
          vehicles: [],
        }}
        heroQueuedRequestIds={new Set(["pending-other"])}
        rideEvent={{
          eventKey: "UID:practice-queued",
          title: "Practice",
          startsAt: feedItem.startsAt,
          endsAt: null,
          defaultKidIds: ["k1"],
          ownRequest: null,
          otherRequests: [
            {
              id: "pending-other",
              spaceId: "s1",
              eventKey: "UID:practice-queued",
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
            },
          ],
        }}
        onAcceptRide={vi.fn()}
        onPassRide={vi.fn()}
        onCreateRide={vi.fn()}
        onCancelRide={vi.fn()}
        onWithdrawRide={vi.fn()}
        {...noopHandlers}
      />,
    )

    const row = screen.getByTestId("agenda-row-FEED-feed-queued")
    await user.click(within(row).getByRole("button", { expanded: false }))
    const inbound = within(row).getByTestId("agenda-band-inbound-requests")
    expect(within(inbound).getByText("Handle in Needs your attention above")).toBeInTheDocument()
    expect(within(inbound).queryByRole("button", { name: "Accept" })).not.toBeInTheDocument()
    expect(within(inbound).queryByRole("button", { name: "Pass" })).not.toBeInTheDocument()
  })

  it("keeps Request/Cancel for own request without duplicate inbound Accept/Pass", async () => {
    const user = userEvent.setup()
    const feedItem = item({
      id: "feed-no-accept",
      source: "FEED",
      title: "Practice",
      feedId: "f1",
      feedName: "Soccer",
      eventKey: "UID:practice-na",
    })
    render(
      <AgendaRow
        item={feedItem}
        circle={circle}
        currentAdultId="a1"
        loading={false}
        assignDraft={{ adultId: "a1", kidIds: [], soleAdult: true, soleKid: true }}
        rideEvent={{
          eventKey: "UID:practice-na",
          title: "Practice",
          startsAt: feedItem.startsAt,
          endsAt: null,
          defaultKidIds: ["k1"],
          ownRequest: null,
          otherRequests: [],
        }}
        onCreateRide={vi.fn()}
        onCancelRide={vi.fn()}
        onWithdrawRide={vi.fn()}
        {...noopHandlers}
      />,
    )

    const row = screen.getByTestId("agenda-row-FEED-feed-no-accept")
    await user.click(within(row).getByRole("button", { expanded: false }))
    const band = within(row).getByTestId("agenda-band-carpool")
    expect(within(band).getByRole("button", { name: "Request" })).toBeInTheDocument()
    expect(within(row).queryByTestId("agenda-band-inbound-requests")).not.toBeInTheDocument()
  })

  it("shows per-kid RevertRideLink for confirmed coverage and removes Remove coverage", async () => {
    const user = userEvent.setup()
    const onRemoveCoverage = vi.fn()
    const feedItem = item({
      id: "feed-confirmed",
      source: "FEED",
      title: "Practice",
      feedId: "f1",
      feedName: "Soccer",
      uncoveredKidIds: [],
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
    })

    render(
      <AgendaRow
        item={feedItem}
        circle={circle}
        currentAdultId="a1"
        loading={false}
        assignDraft={{ adultId: "a1", kidIds: [], soleAdult: true, soleKid: true }}
        {...noopHandlers}
        onRemoveCoverage={onRemoveCoverage}
      />,
    )

    const row = screen.getByTestId("agenda-row-FEED-feed-confirmed")
    await user.click(within(row).getByRole("button", { expanded: false }))
    const kid = within(row).getByTestId("agenda-kid-row-k1")
    expect(within(kid).getByText("You're driving")).toBeInTheDocument()
    expect(within(row).queryByRole("button", { name: "Remove coverage" })).not.toBeInTheDocument()
    expect(within(row).queryByTestId("driver-picker")).not.toBeInTheDocument()
    await user.click(
      within(kid).getByRole("button", { name: "Can't drive anymore? Reassign the ride" }),
    )
    expect(onRemoveCoverage).toHaveBeenCalledWith("cov1")
  })

  it("hides RevertRideLink for unassigned and pending household confirm", async () => {
    const user = userEvent.setup()
    const gapItem = item({
      id: "gap",
      title: "Practice",
      uncoveredKidIds: ["k1"],
    })
    render(
      <AgendaRow
        item={gapItem}
        circle={circle}
        currentAdultId="a1"
        loading={false}
        assignDraft={{ adultId: "a1", kidIds: ["k1"], soleAdult: true, soleKid: true }}
        {...noopHandlers}
      />,
    )
    const gapRow = screen.getByTestId("agenda-row-MANUAL-gap")
    await user.click(within(gapRow).getByRole("button", { expanded: false }))
    expect(within(gapRow).getByTestId("driver-picker")).toBeInTheDocument()
    expect(
      within(gapRow).queryByRole("button", { name: /can't drive anymore|cancel this ask/i }),
    ).not.toBeInTheDocument()
  })

  it("hides RevertRideLink when pending household confirm for viewer", async () => {
    const user = userEvent.setup()
    render(
      <AgendaRow
        item={item({
          id: "pending-self",
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
        })}
        circle={circle}
        currentAdultId="a1"
        loading={false}
        assignDraft={{ adultId: "a1", kidIds: [], soleAdult: true, soleKid: true }}
        {...noopHandlers}
      />,
    )
    const pendingRow = screen.getByTestId("agenda-row-MANUAL-pending-self")
    await user.click(within(pendingRow).getByRole("button", { expanded: false }))
    expect(within(pendingRow).getByRole("button", { name: "Confirm coverage" })).toBeInTheDocument()
    expect(
      within(pendingRow).queryByRole("button", { name: /can't drive anymore|cancel this ask/i }),
    ).not.toBeInTheDocument()
  })

  it("names other household driver on RevertRideLink", async () => {
    const user = userEvent.setup()
    const twoAdults: FamilyCircle = {
      ...circle,
      members: [
        { adultId: "a1", email: "a@example.com", displayName: "Alex", role: "ORGANIZER" },
        { adultId: "a2", email: "j@example.com", displayName: "Jordan", role: "CAREGIVER" },
      ],
    }
    render(
      <AgendaRow
        item={item({
          id: "other-driver",
          title: "Practice",
          uncoveredKidIds: [],
          coverages: [
            {
              id: "cov1",
              coveringAdultId: "a2",
              coveringAdultDisplayName: "Jordan",
              assignedByAdultId: "a1",
              kidIds: ["k1"],
              status: "CONFIRMED",
            },
          ],
        })}
        circle={twoAdults}
        currentAdultId="a1"
        loading={false}
        assignDraft={{ adultId: "a1", kidIds: [], soleAdult: false, soleKid: true }}
        {...noopHandlers}
      />,
    )
    const row = screen.getByTestId("agenda-row-MANUAL-other-driver")
    await user.click(within(row).getByRole("button", { expanded: false }))
    expect(
      within(row).getByRole("button", {
        name: "Jordan can't drive anymore? Reassign the ride",
      }),
    ).toBeInTheDocument()
  })
})
