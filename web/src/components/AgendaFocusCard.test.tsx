import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { ComponentProps } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import type { CalendarItem, FamilyCircle } from "@/api/types"
import { AgendaFocusCard } from "@/components/AgendaFocusCard"

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

const twoAdultCircle: FamilyCircle = {
  ...circle,
  members: [
    { adultId: "a1", email: "a@example.com", displayName: "Alex", role: "ORGANIZER" },
    { adultId: "a2", email: "j@example.com", displayName: "Jordan", role: "CAREGIVER" },
  ],
}

const noopHandlers = {
  onUpdateAssignDraft: vi.fn(),
  onAssignCoverage: vi.fn(),
  onReassignCoverage: vi.fn(),
  onConfirmCoverage: vi.fn(),
  onDeclineCoverage: vi.fn(),
  onRemoveCoverage: vi.fn(),
  onOpenPlaces: vi.fn(),
  onEdit: vi.fn(),
}

function renderCard(
  calendarItem: CalendarItem,
  overrides: Partial<ComponentProps<typeof AgendaFocusCard>> = {},
) {
  return render(
    <AgendaFocusCard
      item={calendarItem}
      circle={circle}
      currentAdultId="a1"
      loading={false}
      assignDraft={{
        adultId: "a1",
        kidIds: calendarItem.uncoveredKidIds,
        soleAdult: true,
        soleKid: true,
      }}
      {...noopHandlers}
      {...overrides}
    />,
  )
}

describe("AgendaFocusCard header chrome", () => {
  it("renders an 88px countdown ring with covering space under it", () => {
    renderCard(
      item({
        id: "ring",
        title: "Practice",
        uncoveredKidIds: ["k1"],
      }),
    )
    const ring = screen.getByTestId("agenda-focus-ring")
    expect(ring.className).toMatch(/--fc-space-focus-ring-covering-gap/)
    const svg = ring.querySelector("svg")
    expect(svg).toHaveAttribute("width", "88")
    expect(svg).toHaveAttribute("height", "88")
  })

  it("renders the hero title at the mock focusTitle size and weight", () => {
    renderCard(
      item({
        id: "title-type",
        title: "Hang with Arthur",
        uncoveredKidIds: ["k1"],
      }),
    )
    const title = screen.getByText("Hang with Arthur")
    expect(title).toHaveClass("fc-display")
    expect(title.className).toMatch(/--fc-font-focus-title-size/)
    expect(title.className).toMatch(/--fc-font-focus-title-weight/)
    expect(title.className).toMatch(/--fc-font-focus-title-line/)
  })

  it("shows an Overlaps chip when the item has conflicts, not conflict detail lines", () => {
    renderCard(
      item({
        id: "overlap",
        title: "Practice",
        uncoveredKidIds: [],
        conflicts: [
          {
            type: "KID_TIME_OVERLAP",
            kidId: "k1",
            adultId: null,
            adultDisplayName: null,
            otherSource: "MANUAL",
            otherItemId: "e2",
            otherTitle: "Other",
            otherStartsAt: "2030-08-15T18:00:00.000Z",
          },
        ],
      }),
    )
    const overlaps = within(screen.getByTestId("agenda-focus-chips")).getByText("Overlaps")
    expect(overlaps).toBeInTheDocument()
    expect(overlaps.className).not.toMatch(/uppercase/)
    expect(within(overlaps).getByTestId("agenda-status-pill-dot")).toBeInTheDocument()
    expect(screen.queryByText("Sam overlaps Other")).not.toBeInTheDocument()
  })

  it("shows kids, destination, and leave-from on one meta line without form labels", () => {
    renderCard(
      item({
        id: "meta",
        title: "Practice",
        uncoveredKidIds: ["k1"],
      }),
    )
    expect(screen.getByText("Sam · Rink · Leaving from Mom's house")).toBeInTheDocument()
    expect(screen.queryByText("Leave from")).not.toBeInTheDocument()
    expect(screen.queryByText("Manual")).not.toBeInTheDocument()
    expect(screen.queryByLabelText("RSVP for Sam on Practice")).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Remove event" })).not.toBeInTheDocument()
  })

  it("includes the full event location text when it is a street address", () => {
    renderCard(
      item({
        id: "address",
        title: "Game",
        location: "450 Huron Ave, Cambridge, MA 02138",
        uncoveredKidIds: ["k1"],
      }),
    )
    expect(
      screen.getByText("Sam · 450 Huron Ave, Cambridge, MA 02138 · Leaving from Mom's house"),
    ).toBeInTheDocument()
    const meta = screen.getByText(/450 Huron Ave, Cambridge/)
    expect(meta.className).not.toMatch(/truncate/)
    expect(meta.className).not.toMatch(/whitespace-nowrap/)
  })
})

describe("AgendaFocusCard hero surface", () => {
  it("uses heroSurface for an uncovered/urgent item", () => {
    renderCard(
      item({
        id: "urgent",
        title: "Practice",
        uncoveredKidIds: ["k1"],
      }),
    )
    const card = screen.getByTestId("agenda-focus-MANUAL-urgent")
    expect(card).toHaveStyle({ backgroundColor: "var(--fc-hero-surface)" })
    expect(within(screen.getByTestId("agenda-focus-chips")).getByText("Needs coverage")).toBeInTheDocument()
  })

  it("uses surfaceRaised for a resolved all-set item", () => {
    renderCard(
      item({
        id: "calm",
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
    const card = screen.getByTestId("agenda-focus-MANUAL-calm")
    expect(card).toHaveStyle({ backgroundColor: "var(--fc-surface-raised)" })
    expect(within(screen.getByTestId("agenda-focus-chips")).getByText("Confirmed")).toBeInTheDocument()
    expect(within(screen.getByTestId("agenda-focus-chips")).getByText("Confirmed").className).not.toMatch(
      /uppercase/,
    )
    expect(screen.getByTestId("agenda-focus-covering")).toHaveTextContent("Covering")
    expect(within(screen.getByTestId("agenda-focus-covering")).getByText("Alex")).toBeInTheDocument()
    expect(screen.getByTestId("agenda-focus-covering").className).toMatch(/items-center/)
    expect(screen.getByTestId("agenda-focus-covering").className).not.toMatch(/flex-col/)
    expect(within(screen.getByTestId("agenda-focus-covering")).getByText("Covering").className).toMatch(
      /--fc-font-focus-covering-weight/,
    )
    expect(screen.getByRole("button", { name: "Remove coverage" })).toBeInTheDocument()
  })

  it("uses heroSurface when pending coverage confirm is for the signed-in adult", () => {
    renderCard(
      item({
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
      }),
    )
    const card = screen.getByTestId("agenda-focus-MANUAL-pending-self")
    expect(card).toHaveStyle({ backgroundColor: "var(--fc-hero-surface)" })
    expect(screen.queryByText("All set")).not.toBeInTheDocument()
    expect(within(screen.getByTestId("agenda-focus-chips")).getByText("Confirm coverage")).toBeInTheDocument()
    expect(screen.queryByText("Needs coverage")).not.toBeInTheDocument()
    expect(screen.queryByText("Assigned to you")).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Confirm coverage" })).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Remove coverage" })).not.toBeInTheDocument()
  })

  it("uses surfaceRaised when pending coverage confirm is for someone else", () => {
    renderCard(
      item({
        id: "pending-other",
        title: "Practice",
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
      }),
    )
    const card = screen.getByTestId("agenda-focus-MANUAL-pending-other")
    expect(card).toHaveStyle({ backgroundColor: "var(--fc-surface-raised)" })
    expect(within(screen.getByTestId("agenda-focus-chips")).getByText("Awaiting confirm")).toBeInTheDocument()
    expect(screen.queryByText("All set")).not.toBeInTheDocument()
    expect(screen.queryByText("Confirmed")).not.toBeInTheDocument()
    expect(screen.getByTestId("agenda-focus-covering")).toHaveTextContent("Covering")
    expect(within(screen.getByTestId("agenda-focus-covering")).getByText(/Jordan · Pending/)).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Remove coverage" })).toBeInTheDocument()
  })

  it("still fires Edit on a manual item after the chrome change", async () => {
    const user = userEvent.setup()
    const onEdit = vi.fn()
    renderCard(item({ id: "e1", title: "Practice", uncoveredKidIds: ["k1"] }), { onEdit })
    await user.click(screen.getByRole("button", { name: "Edit" }))
    expect(onEdit).toHaveBeenCalledTimes(1)
  })
})

describe("AgendaFocusCard assign", () => {
  it("assigns the signed-in adult by default when several adults exist", async () => {
    const user = userEvent.setup()
    const onAssignCoverage = vi.fn()
    renderCard(
      item({
        id: "assign-self",
        title: "Practice",
        uncoveredKidIds: ["k1"],
      }),
      {
        circle: twoAdultCircle,
        assignDraft: { adultId: "a1", kidIds: ["k1"], soleAdult: false, soleKid: true },
        onAssignCoverage,
      },
    )
    const coveringRow = screen.getByTestId("agenda-focus-covering")
    expect(within(coveringRow).getByText("Covering")).toBeInTheDocument()
    expect(coveringRow.className).toMatch(/items-center/)
    expect(coveringRow.className).not.toMatch(/flex-col/)
    const covering = screen.getByLabelText("Covering adult for Practice")
    expect(covering).toHaveValue("a1")
    await user.click(screen.getByRole("button", { name: "Assign coverage" }))
    expect(onAssignCoverage).toHaveBeenCalledWith("a1", ["k1"])
  })

  it("assigns a different adult after the covering combobox changes", async () => {
    const user = userEvent.setup()
    const onAssignCoverage = vi.fn()
    const onUpdateAssignDraft = vi.fn()
    renderCard(
      item({
        id: "assign-other",
        title: "Practice",
        uncoveredKidIds: ["k1"],
      }),
      {
        circle: twoAdultCircle,
        assignDraft: { adultId: "a2", kidIds: ["k1"], soleAdult: false, soleKid: true },
        onAssignCoverage,
        onUpdateAssignDraft,
      },
    )
    expect(screen.getByLabelText("Covering adult for Practice")).toHaveValue("a2")
    await user.click(screen.getByRole("button", { name: "Assign coverage" }))
    expect(onAssignCoverage).toHaveBeenCalledWith("a2", ["k1"])
  })
})

describe("AgendaFocusCard change and remove coverage", () => {
  it("reassigns when the covering combobox changes on a confirmed multi-adult item", async () => {
    const user = userEvent.setup()
    const onReassignCoverage = vi.fn()
    renderCard(
      item({
        id: "reassign",
        title: "Practice",
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
      }),
      {
        circle: twoAdultCircle,
        assignDraft: { adultId: "a1", kidIds: [], soleAdult: false, soleKid: false },
        onReassignCoverage,
      },
    )
    const coveringRow = screen.getByTestId("agenda-focus-covering")
    expect(within(coveringRow).getByText("Covering")).toBeInTheDocument()
    expect(coveringRow.className).not.toMatch(/flex-col/)
    const covering = screen.getByLabelText("Covering adult for Practice")
    expect(covering).toHaveValue("a1")
    expect(within(covering).getByRole("option", { name: "Alex" })).toBeInTheDocument()
    expect(within(covering).queryByRole("option", { name: "Covering: Alex" })).not.toBeInTheDocument()
    await user.selectOptions(covering, "a2")
    expect(onReassignCoverage).toHaveBeenCalledWith("cov1", "a2", ["k1"])
  })

  it("removes confirmed coverage from the hero card", async () => {
    const user = userEvent.setup()
    const onRemoveCoverage = vi.fn()
    renderCard(
      item({
        id: "remove",
        title: "Practice",
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
      }),
      { onRemoveCoverage },
    )
    await user.click(screen.getByRole("button", { name: "Remove coverage" }))
    expect(onRemoveCoverage).toHaveBeenCalledWith("cov1")
  })
})

describe("AgendaFocusCard countdown ring", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-08-16T12:00:00.000Z"))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("renders a day count for a far-future off-season event, not hours or an em dash", () => {
    renderCard(
      item({
        id: "far",
        title: "Team Meeting",
        uncoveredKidIds: ["k1"],
        leaveByAt: "2026-08-26T08:39:00.000Z",
      }),
    )
    expect(screen.getByText("10")).toBeInTheDocument()
    expect(screen.getByText("days")).toBeInTheDocument()
    expect(screen.queryByText("236h 39")).not.toBeInTheDocument()
  })

  it("renders minutes when the event is under an hour away", () => {
    renderCard(
      item({
        id: "soon",
        title: "Practice",
        uncoveredKidIds: ["k1"],
        leaveByAt: "2026-08-16T12:42:00.000Z",
      }),
    )
    expect(screen.getByText("42")).toBeInTheDocument()
    expect(screen.getByText("min")).toBeInTheDocument()
  })

  it("renders hours when the event is under a day away", () => {
    renderCard(
      item({
        id: "today",
        title: "Practice",
        uncoveredKidIds: ["k1"],
        leaveByAt: "2026-08-16T14:00:00.000Z",
      }),
    )
    expect(screen.getByText("2")).toBeInTheDocument()
    expect(screen.getByText("hr")).toBeInTheDocument()
  })
})

describe("AgendaFocusCard title", () => {
  it("renders feed titles as given without HTML-decoding", () => {
    renderCard(
      item({
        id: "entities",
        title: "Team &amp; Family Meeting",
        uncoveredKidIds: ["k1"],
      }),
    )
    expect(screen.getByText("Team &amp; Family Meeting")).toBeInTheDocument()
  })
})

describe("AgendaFocusCard ride Accept/Pass", () => {
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

  const pendingAsk = {
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
    status: "PENDING" as const,
    passedByMe: false,
    acceptedByAdultId: null,
    acceptingCircleId: null,
    acceptingCircleName: null,
    vehicleId: null,
    vehicleLabel: null,
  }

  const rideEvent = {
    eventKey: "UID:game",
    title: "Practice",
    startsAt: "2030-08-15T17:00:00.000Z",
    endsAt: null,
    defaultKidIds: [],
    ownRequest: null,
    otherRequests: [pendingAsk],
  }

  it("shows Accept and Pass for an eligible pending ride ask", async () => {
    const user = userEvent.setup()
    const onAcceptRide = vi.fn()
    const onPassRide = vi.fn()
    renderCard(item({ id: "ride-focus", title: "Practice" }), {
      rideEvent,
      garage,
      onAcceptRide,
      onPassRide,
    })
    const card = screen.getByTestId("agenda-focus-MANUAL-ride-focus")
    expect(card).toHaveStyle({ backgroundColor: "var(--fc-hero-surface)" })
    expect(screen.getByRole("button", { name: "Accept" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Pass" })).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Assign coverage" })).not.toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Accept" }))
    expect(onAcceptRide).toHaveBeenCalledWith("ask-1", "v1")
    await user.click(screen.getByRole("button", { name: "Pass" }))
    expect(onPassRide).toHaveBeenCalledWith("ask-1")
  })

  it("prefers Confirm/Decline over Accept/Pass on the same card", () => {
    renderCard(
      item({
        id: "confirm-first",
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
      {
        rideEvent,
        garage,
        onAcceptRide: vi.fn(),
        onPassRide: vi.fn(),
      },
    )
    expect(screen.getByRole("button", { name: "Confirm coverage" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Decline coverage" })).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Accept" })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Pass" })).not.toBeInTheDocument()
  })

  it("prefers Accept/Pass over Assign when uncovered and ride-eligible", () => {
    renderCard(
      item({
        id: "ride-over-assign",
        title: "Practice",
        uncoveredKidIds: ["k1"],
      }),
      {
        rideEvent,
        garage,
        onAcceptRide: vi.fn(),
        onPassRide: vi.fn(),
      },
    )
    expect(screen.getByRole("button", { name: "Accept" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Pass" })).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Assign coverage" })).not.toBeInTheDocument()
  })

  it("does not show Accept/Pass for own PENDING request", () => {
    renderCard(item({ id: "own-pending", title: "Practice" }), {
      rideEvent: {
        ...rideEvent,
        ownRequest: { ...pendingAsk, id: "own", status: "PENDING" },
        otherRequests: [],
      },
      garage,
      onAcceptRide: vi.fn(),
      onPassRide: vi.fn(),
      onCreateRide: vi.fn(),
    })
    expect(screen.queryByRole("button", { name: "Accept" })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Pass" })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Request" })).not.toBeInTheDocument()
    expect(screen.getByTestId("agenda-focus-MANUAL-own-pending")).toHaveStyle({
      backgroundColor: "var(--fc-surface-raised)",
    })
  })
})

describe("AgendaFocusCard Request CTA", () => {
  const requestableRide = {
    eventKey: "UID:practice",
    title: "Practice",
    startsAt: "2030-08-15T17:00:00.000Z",
    endsAt: null,
    defaultKidIds: ["k1"],
    ownRequest: null,
    otherRequests: [],
  }

  it("shows Request as primary with Assign secondary on uncovered carpool FEED", async () => {
    const user = userEvent.setup()
    const onCreateRide = vi.fn()
    const onAssignCoverage = vi.fn()
    renderCard(
      item({
        id: "feed-1",
        source: "FEED",
        title: "Practice",
        feedId: "f1",
        feedName: "Soccer",
        uncoveredKidIds: ["k1"],
        rsvps: [{ kidId: "k1", status: "NO_RESPONSE" }],
      }),
      {
        rideEvent: requestableRide,
        onCreateRide,
        onAssignCoverage,
      },
    )
    expect(screen.getByRole("button", { name: "Request" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Assign coverage" })).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Accept" })).not.toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Request" }))
    expect(onCreateRide).toHaveBeenCalledWith("UID:practice")
    expect(onAssignCoverage).not.toHaveBeenCalled()
  })

  it("shows Request without Assign when coverage is all-set", () => {
    renderCard(item({ id: "covered-request", title: "Practice" }), {
      rideEvent: requestableRide,
      onCreateRide: vi.fn(),
    })
    expect(screen.getByRole("button", { name: "Request" })).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Assign coverage" })).not.toBeInTheDocument()
  })

  it("prefers Accept/Pass over Request", () => {
    renderCard(item({ id: "accept-over-request", title: "Practice" }), {
      rideEvent: {
        ...requestableRide,
        defaultKidIds: ["k1"],
        otherRequests: [
          {
            id: "ask-1",
            spaceId: "s1",
            eventKey: "UID:practice",
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
            acceptedByAdultId: null,
            acceptingCircleId: null,
            acceptingCircleName: null,
            vehicleId: null,
            vehicleLabel: null,
          },
        ],
      },
      garage: {
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
      },
      onAcceptRide: vi.fn(),
      onPassRide: vi.fn(),
      onCreateRide: vi.fn(),
    })
    expect(screen.getByRole("button", { name: "Accept" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Pass" })).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Request" })).not.toBeInTheDocument()
  })

  it("prefers Confirm/Decline over Request", () => {
    renderCard(
      item({
        id: "confirm-over-request",
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
      {
        rideEvent: requestableRide,
        onCreateRide: vi.fn(),
      },
    )
    expect(screen.getByRole("button", { name: "Confirm coverage" })).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Request" })).not.toBeInTheDocument()
  })
})
