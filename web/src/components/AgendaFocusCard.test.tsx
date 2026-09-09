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
    leaveFromAddress: null,
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

function focusRequest(
  partial: Partial<import("@/api/types").CarpoolRequest> = {},
): import("@/api/types").CarpoolRequest {
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

function focusRide(
  partial: Partial<import("@/api/types").CarpoolRide> = {},
): import("@/api/types").CarpoolRide {
  return {
    id: "ride-1",
    spaceId: "s1",
    eventKey: "UID:game",
    leg: "TO",
    driverAdultId: "a1",
    drivingCircleId: "c1",
    drivingCircleName: "Ours",
    vehicleId: "v1",
    vehicleLabel: "Van",
    passengerRequestIds: ["ask-1"],
    status: "ACTIVE",
    ...partial,
  }
}

function focusRideEvent(
  partial: Partial<import("@/api/types").CarpoolRideEvent> = {},
): import("@/api/types").CarpoolRideEvent {
  return {
    eventKey: "UID:game",
    title: "Practice",
    startsAt: "2030-08-15T17:00:00.000Z",
    endsAt: null,
    defaultKidIds: [],
    ownRequests: [],
    otherRequests: [],
    rides: [],
    ...partial,
  }
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
    expect(overlaps.className).toMatch(/uppercase/)
    expect(overlaps.className).toMatch(/--fc-font-feed-chip-size/)
    expect(screen.queryByTestId("agenda-status-pill-dot")).not.toBeInTheDocument()
    expect(screen.queryByText("Sam overlaps Other")).not.toBeInTheDocument()
  })

  it("shows kids and destination on one meta line without leave-from form labels", () => {
    renderCard(
      item({
        id: "meta",
        title: "Practice",
        uncoveredKidIds: ["k1"],
      }),
    )
    expect(screen.getByText("Sam · Rink")).toBeInTheDocument()
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
    expect(screen.getByText("Sam · 450 Huron Ave, Cambridge, MA 02138")).toBeInTheDocument()
    const meta = screen.getByText(/450 Huron Ave, Cambridge/)
    expect(meta.className).not.toMatch(/truncate/)
    expect(meta.className).not.toMatch(/whitespace-nowrap/)
  })

  it("when covering, shows leave-from combobox with estimate and one-time option", async () => {
    const user = userEvent.setup()
    const onSetLeaveFrom = vi.fn()
    renderCard(
      item({
        id: "covering",
        title: "Practice",
        uncoveredKidIds: [],
        leaveFromPlaceId: null,
        leaveFromPlaceName: "Mom's house",
        leaveFromAddress: null,
        leaveByAt: "2030-08-15T16:20:00.000Z",
        leaveByStatus: "OK",
        leaveByReason: null,
        coverages: [
          {
            id: "cov1",
            coveringAdultId: "a1",
            coveringAdultDisplayName: "Alex",
            assignedByAdultId: "a1",
            kidIds: ["k1"],
            status: "CONFIRMED",
            leaveFromPlaceId: null,
            leaveFromPlaceName: "Mom's house",
            leaveFromAddress: null,
            leaveByAt: "2030-08-15T16:20:00.000Z",
            leaveByStatus: "OK",
            leaveByReason: null,
          },
        ],
      }),
      { onSetLeaveFrom },
    )
    expect(screen.getByTestId("agenda-focus-leave-from")).toBeInTheDocument()
    expect(screen.getByTestId("focus-leave-from-MANUAL-covering-helper").textContent).toMatch(
      /^Leave from Mom's house · estimate /,
    )
    const select = screen.getByTestId("focus-leave-from-MANUAL-covering-place-select")
    expect(select).toHaveValue("p1")
    await user.selectOptions(select, "__one_time__")
    await user.type(
      screen.getByTestId("focus-leave-from-MANUAL-covering-one-time-input"),
      "Jack's house",
    )
    await user.click(screen.getByTestId("focus-leave-from-MANUAL-covering-one-time-input"))
    await user.tab()
    expect(onSetLeaveFrom).toHaveBeenCalledWith({
      leaveFromPlaceId: null,
      leaveFromAddress: "Jack's house",
    })
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
    expect(within(screen.getByTestId("agenda-focus-chips")).getByText("Ride needed")).toBeInTheDocument()
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
          leaveFromPlaceId: null,
          leaveFromPlaceName: null,
          leaveFromAddress: null,
          leaveByAt: null,
          leaveByStatus: null,
          leaveByReason: null,
          },
        ],
      }),
    )
    const card = screen.getByTestId("agenda-focus-MANUAL-calm")
    expect(card).toHaveStyle({ backgroundColor: "var(--fc-surface-raised)" })
    const drivingChip = within(screen.getByTestId("agenda-focus-chips")).getByText("You're driving")
    expect(drivingChip.className).toMatch(/uppercase/)
    expect(drivingChip.className).toMatch(/--fc-font-feed-chip-size/)
    expect(drivingChip.className).toMatch(/--fc-hero-success/)
    expect(screen.queryByTestId("agenda-status-pill-dot")).not.toBeInTheDocument()
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
          leaveFromPlaceId: null,
          leaveFromPlaceName: null,
          leaveFromAddress: null,
          leaveByAt: null,
          leaveByStatus: null,
          leaveByReason: null,
          },
        ],
      }),
    )
    const card = screen.getByTestId("agenda-focus-MANUAL-pending-self")
    expect(card).toHaveStyle({ backgroundColor: "var(--fc-hero-surface)" })
    expect(screen.queryByText("All set")).not.toBeInTheDocument()
    expect(within(screen.getByTestId("agenda-focus-chips")).getByText("Confirm you'll drive")).toBeInTheDocument()
    expect(screen.queryByText("Ride needed")).not.toBeInTheDocument()
    expect(screen.queryByText("Assigned to you")).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Confirm coverage" })).toBeInTheDocument()
    expect(screen.queryByTestId("driver-picker")).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Decline coverage" })).toBeInTheDocument()
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
          leaveFromPlaceId: null,
          leaveFromPlaceName: null,
          leaveFromAddress: null,
          leaveByAt: null,
          leaveByStatus: null,
          leaveByReason: null,
          },
        ],
      }),
    )
    const card = screen.getByTestId("agenda-focus-MANUAL-pending-other")
    expect(card).toHaveStyle({ backgroundColor: "var(--fc-surface-raised)" })
    expect(within(screen.getByTestId("agenda-focus-chips")).getByText("Waiting on Jordan")).toBeInTheDocument()
    expect(screen.queryByText("All set")).not.toBeInTheDocument()
    expect(screen.queryByText("You're driving")).not.toBeInTheDocument()
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
    expect(screen.getByTestId("driver-picker")).toBeInTheDocument()
    expect(screen.queryByTestId("agenda-focus-covering")).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: "You" })).toHaveAttribute("aria-pressed", "true")
    await user.click(screen.getByTestId("driver-picker-confirm"))
    expect(onAssignCoverage).toHaveBeenCalledWith("a1", ["k1"])
  })

  it("assigns a different adult after selecting another household chip", async () => {
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
    expect(screen.getByRole("button", { name: "Jordan" })).toHaveAttribute("aria-pressed", "true")
    await user.click(screen.getByRole("button", { name: "Ask Jordan to drive" }))
    expect(onAssignCoverage).toHaveBeenCalledWith("a2", ["k1"])
  })

  it("calls onUpdateAssignDraft when another household chip is selected", async () => {
    const user = userEvent.setup()
    const onUpdateAssignDraft = vi.fn()
    renderCard(
      item({
        id: "assign-chip",
        title: "Practice",
        uncoveredKidIds: ["k1"],
      }),
      {
        circle: twoAdultCircle,
        assignDraft: { adultId: "a1", kidIds: ["k1"], soleAdult: false, soleKid: true },
        onUpdateAssignDraft,
      },
    )
    await user.click(screen.getByRole("button", { name: "Jordan" }))
    expect(onUpdateAssignDraft).toHaveBeenCalledWith({ adultId: "a2" })
  })

  it("shows kid subset checkboxes above DriverPicker when multiple kids need coverage", () => {
    renderCard(
      item({
        id: "assign-multi",
        title: "Practice",
        kidIds: ["k1", "k2"],
        uncoveredKidIds: ["k1", "k2"],
      }),
      {
        circle: {
          ...twoAdultCircle,
          kids: [
            { id: "k1", displayName: "Sam" },
            { id: "k2", displayName: "Riley" },
          ],
        },
        assignDraft: {
          adultId: "a1",
          kidIds: ["k1", "k2"],
          soleAdult: false,
          soleKid: false,
        },
      },
    )

    const subset = screen.getByTestId("agenda-focus-kid-subset")
    expect(subset).toHaveTextContent("Uncovered kids")
    expect(screen.getByLabelText("Cover Sam for Practice")).toBeChecked()
    expect(screen.getByLabelText("Cover Riley for Practice")).toBeChecked()
    expect(subset.compareDocumentPosition(screen.getByTestId("driver-picker")) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it("assigns only selected kids after deselecting a subset checkbox", async () => {
    const user = userEvent.setup()
    const onAssignCoverage = vi.fn()
    const onUpdateAssignDraft = vi.fn()
    renderCard(
      item({
        id: "assign-subset",
        title: "Practice",
        kidIds: ["k1", "k2"],
        uncoveredKidIds: ["k1", "k2"],
      }),
      {
        circle: {
          ...twoAdultCircle,
          kids: [
            { id: "k1", displayName: "Sam" },
            { id: "k2", displayName: "Riley" },
          ],
        },
        assignDraft: {
          adultId: "a1",
          kidIds: ["k1", "k2"],
          soleAdult: false,
          soleKid: false,
        },
        onAssignCoverage,
        onUpdateAssignDraft,
      },
    )

    await user.click(screen.getByLabelText("Cover Riley for Practice"))
    expect(onUpdateAssignDraft).toHaveBeenCalledWith({ kidIds: ["k1"] })
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
          leaveFromPlaceId: null,
          leaveFromPlaceName: null,
          leaveFromAddress: null,
          leaveByAt: null,
          leaveByStatus: null,
          leaveByReason: null,
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
          leaveFromPlaceId: null,
          leaveFromPlaceName: null,
          leaveFromAddress: null,
          leaveByAt: null,
          leaveByStatus: null,
          leaveByReason: null,
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

  const pendingAsk = focusRequest()

  const rideEvent = focusRideEvent({
    otherRequests: [pendingAsk],
  })

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
    expect(screen.queryByTestId("driver-picker")).not.toBeInTheDocument()
    expect(screen.getByTestId("agenda-focus-incoming-ask")).toHaveTextContent(
      "House B · Mia · 1 seat · Home, 1 Main",
    )
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
          leaveFromPlaceId: null,
          leaveFromPlaceName: null,
          leaveFromAddress: null,
          leaveByAt: null,
          leaveByStatus: null,
          leaveByReason: null,
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
    expect(screen.queryByTestId("agenda-focus-incoming-ask")).not.toBeInTheDocument()
  })

  it("uses hero route fill when confirmed driver is carpooling teammates", () => {
    renderCard(
      item({
        id: "route-carpool",
        title: "Practice",
        coverages: [
          {
            id: "cov1",
            coveringAdultId: "a1",
            coveringAdultDisplayName: "Alex",
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
      }),
      {
        rideEvent: focusRideEvent({
          otherRequests: [
            focusRequest({
              id: "accepted-1",
              status: "FULLY_COVERED",
              legStatuses: [
                { leg: "TO", status: "CONFIRMED" },
                { leg: "FROM", status: "CONFIRMED" },
              ],
            }),
          ],
          rides: [
            focusRide({ id: "ride-to", leg: "TO", passengerRequestIds: ["accepted-1"] }),
            focusRide({ id: "ride-from", leg: "FROM", passengerRequestIds: ["accepted-1"] }),
          ],
        }),
      },
    )
    expect(screen.getByTestId("agenda-focus-MANUAL-route-carpool")).toHaveStyle({
      backgroundColor: "var(--fc-surface-raised)",
    })
    const routeChip = within(screen.getByTestId("agenda-focus-chips")).getByText(
      "You're driving · +1",
    )
    expect(routeChip.className).toMatch(/--fc-hero-accent/)
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
    expect(screen.queryByTestId("driver-picker")).not.toBeInTheDocument()
  })

  it("does not show Accept/Pass for own UNCOVERED request", () => {
    renderCard(item({ id: "own-pending", title: "Practice" }), {
      rideEvent: focusRideEvent({
        ownRequests: [
          focusRequest({
            id: "own",
            requestingCircleId: "c1",
            requestingCircleName: "Ours",
            kidId: "k1",
            kidFirstName: "Maya",
          }),
        ],
      }),
      garage,
      onAcceptRide: vi.fn(),
      onPassRide: vi.fn(),
      onCreateRide: vi.fn(),
    })
    expect(screen.queryByRole("button", { name: "Accept" })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Pass" })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Request" })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Cancel" })).not.toBeInTheDocument()
    expect(screen.getByTestId("agenda-focus-MANUAL-own-pending")).toHaveStyle({
      backgroundColor: "var(--fc-surface-raised)",
    })
  })

  it("does not show Accept/Pass after the caller has passed", () => {
    renderCard(item({ id: "passed-ask", title: "Practice" }), {
      rideEvent: focusRideEvent({
        otherRequests: [focusRequest({ passedByMe: true })],
      }),
      garage,
      onAcceptRide: vi.fn(),
      onPassRide: vi.fn(),
    })
    expect(screen.queryByRole("button", { name: "Accept" })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Pass" })).not.toBeInTheDocument()
    expect(screen.queryByTestId("agenda-focus-incoming-ask")).not.toBeInTheDocument()
  })

  it("keeps Ride needed chip and Assign while own ride is still UNCOVERED", () => {
    renderCard(
      item({
        id: "own-pending-gap",
        title: "Practice",
        uncoveredKidIds: ["k1"],
      }),
      {
        rideEvent: focusRideEvent({
          ownRequests: [
            focusRequest({
              id: "own",
              requestingCircleId: "c1",
              requestingCircleName: "Ours",
              kidId: "k1",
              kidFirstName: "Maya",
            }),
          ],
        }),
        onAssignCoverage: vi.fn(),
        assignDraft: { adultId: "a1", kidIds: ["k1"], soleAdult: true, soleKid: true },
      },
    )
    expect(within(screen.getByTestId("agenda-focus-chips")).getByText("Asked the team")).toBeInTheDocument()
    expect(screen.getByTestId("driver-picker")).toBeInTheDocument()
  })
})

describe("AgendaFocusCard Cancel CTA", () => {
  const ownCovered = focusRequest({
    id: "own-ride",
    eventKey: "UID:practice",
    requestingCircleId: "c1",
    requestingCircleName: "Ours",
    requestedByAdultId: "a1",
    kidId: "k1",
    kidFirstName: "Maya",
    status: "FULLY_COVERED",
    legStatuses: [
      { leg: "TO", status: "CONFIRMED" },
      { leg: "FROM", status: "CONFIRMED" },
    ],
  })

  const ownCoveredEvent = focusRideEvent({
    eventKey: "UID:practice",
    ownRequests: [ownCovered],
    rides: [
      focusRide({
        id: "fulfill-to",
        eventKey: "UID:practice",
        leg: "TO",
        drivingCircleId: "c2",
        drivingCircleName: "Sharks Family",
        passengerRequestIds: ["own-ride"],
      }),
    ],
  })

  const ownPartialEvent = focusRideEvent({
    eventKey: "UID:practice",
    ownRequests: [
      focusRequest({
        id: "own-ride",
        eventKey: "UID:practice",
        requestingCircleId: "c1",
        requestingCircleName: "Ours",
        requestedByAdultId: "a1",
        kidId: "k1",
        kidFirstName: "Maya",
        status: "PARTIAL",
        legStatuses: [
          { leg: "TO", status: "CONFIRMED" },
          { leg: "FROM", status: "OPEN" },
        ],
      }),
    ],
    rides: [
      focusRide({
        id: "fulfill-to",
        eventKey: "UID:practice",
        leg: "TO",
        drivingCircleId: "c2",
        drivingCircleName: "Sharks Family",
        passengerRequestIds: ["own-ride"],
      }),
    ],
  })

  it("does not show Cancel for uncovered own ask with no Ride yet", () => {
    renderCard(item({ id: "cancel-uncovered", title: "Practice" }), {
      rideEvent: focusRideEvent({
        eventKey: "UID:practice",
        ownRequests: [
          focusRequest({
            id: "own-ride",
            eventKey: "UID:practice",
            requestingCircleId: "c1",
            requestingCircleName: "Ours",
            kidId: "k1",
            kidFirstName: "Maya",
          }),
        ],
      }),
      onCancelRide: vi.fn(),
    })
    expect(screen.queryByRole("button", { name: "Cancel" })).not.toBeInTheDocument()
    expect(within(screen.getByTestId("agenda-focus-chips")).getByText("Asked the team")).toBeInTheDocument()
  })

  it("shows outline Cancel for covered own Ride and calls onCancelRide with Ride id", async () => {
    const user = userEvent.setup()
    const onCancelRide = vi.fn()
    renderCard(item({ id: "cancel-accepted", title: "Practice" }), {
      rideEvent: ownCoveredEvent,
      onCancelRide,
    })
    expect(screen.getByTestId("agenda-focus-own-ride")).toHaveTextContent(
      "Riding with Sharks Family · Maya · 1 seat · Home, 1 Main",
    )
    expect(
      within(screen.getByTestId("agenda-focus-chips")).getByText("Riding with Sharks Family"),
    ).toBeInTheDocument()
    const cancel = screen.getByRole("button", { name: "Cancel" })
    expect(cancel).toBeInTheDocument()
    expect(cancel.className).toMatch(/outline|border/)
    await user.click(cancel)
    expect(onCancelRide).toHaveBeenCalledWith("fulfill-to")
  })

  it("keeps Cancel outline beside Assign when PARTIAL still has a coverage gap", () => {
    renderCard(
      item({
        id: "cancel-with-assign",
        title: "Practice",
        uncoveredKidIds: ["k1"],
      }),
      {
        rideEvent: ownPartialEvent,
        assignDraft: { adultId: "a1", kidIds: ["k1"], soleAdult: true, soleKid: true },
        onAssignCoverage: vi.fn(),
        onCancelRide: vi.fn(),
      },
    )
    expect(screen.getByTestId("driver-picker")).toBeInTheDocument()
    expect(screen.getByTestId("driver-picker-confirm")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument()
    expect(screen.getByTestId("agenda-focus-own-ride")).toHaveTextContent(
      "Round trip — to confirmed, from still needed",
    )
  })
})

describe("AgendaFocusCard Withdraw CTA", () => {
  const acceptedByUsAsk = focusRequest({
    id: "accepted-ask",
    eventKey: "UID:practice",
    status: "FULLY_COVERED",
    legStatuses: [
      { leg: "TO", status: "CONFIRMED" },
      { leg: "FROM", status: "CONFIRMED" },
    ],
  })

  const acceptedRide = focusRide({
    id: "fulfill-accepted",
    eventKey: "UID:practice",
    leg: "TO",
    passengerRequestIds: ["accepted-ask"],
  })

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
        make: "Honda",
        model: "Odyssey",
        seats: 8,
        suggestedSeats: 8,
      },
    ],
  }

  it("shows outline Withdraw when this circle accepted a teammate ask", async () => {
    const user = userEvent.setup()
    const onWithdrawRide = vi.fn()
    renderCard(item({ id: "withdraw-focus", title: "Practice" }), {
      rideEvent: focusRideEvent({
        eventKey: "UID:practice",
        otherRequests: [acceptedByUsAsk],
        rides: [acceptedRide],
      }),
      onWithdrawRide,
    })
    expect(screen.getByTestId("agenda-focus-accepted-by-us")).toHaveTextContent(
      "House B · Mia · 1 seat · Home, 1 Main",
    )
    const withdraw = screen.getByRole("button", { name: "Withdraw" })
    expect(withdraw).toBeInTheDocument()
    expect(screen.getByTestId("agenda-focus-MANUAL-withdraw-focus")).toHaveStyle({
      backgroundColor: "var(--fc-surface-raised)",
    })
    await user.click(withdraw)
    expect(onWithdrawRide).toHaveBeenCalledWith("fulfill-accepted")
  })

  it("does not show Withdraw for a ask covered by another circle", () => {
    renderCard(item({ id: "other-accepted", title: "Practice" }), {
      rideEvent: focusRideEvent({
        eventKey: "UID:practice",
        otherRequests: [acceptedByUsAsk],
        rides: [
          focusRide({
            id: "fulfill-them",
            eventKey: "UID:practice",
            drivingCircleId: "c9",
            drivingCircleName: "Them",
            passengerRequestIds: ["accepted-ask"],
          }),
        ],
      }),
      onWithdrawRide: vi.fn(),
    })
    expect(screen.queryByRole("button", { name: "Withdraw" })).not.toBeInTheDocument()
  })

  it("keeps Accept/Pass primary when another open ask is eligible alongside accepted-by-us", () => {
    renderCard(item({ id: "withdraw-with-accept", title: "Practice" }), {
      rideEvent: focusRideEvent({
        eventKey: "UID:practice",
        otherRequests: [
          acceptedByUsAsk,
          focusRequest({
            id: "pending-ask",
            eventKey: "UID:practice",
            status: "UNCOVERED",
          }),
        ],
        rides: [acceptedRide],
      }),
      garage: {
        members: [{ adultId: "a1", displayName: "Alex", drives: true }],
        vehicles: [
          ...garage.vehicles,
          {
            id: "v2",
            ownerAdultId: "a1",
            driverAdultIds: ["a1"],
            keptAtPlaceId: null,
            label: "SUV",
            year: 2021,
            make: "Toyota",
            model: "Highlander",
            seats: 7,
            suggestedSeats: 7,
          },
        ],
      },
      onAcceptRide: vi.fn(),
      onPassRide: vi.fn(),
      onWithdrawRide: vi.fn(),
    })
    expect(screen.getByRole("button", { name: "Accept" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Pass" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Withdraw" })).toBeInTheDocument()
  })
})

describe("AgendaFocusCard Request CTA", () => {
  const requestableRide = {
    eventKey: "UID:practice",
    title: "Practice",
    startsAt: "2030-08-15T17:00:00.000Z",
    endsAt: null,
    defaultKidIds: ["k1"],
    ownRequests: [],
    otherRequests: [],
    rides: [],
  }

  it("shows DriverPicker with team ask on uncovered carpool FEED", async () => {
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
    expect(screen.queryByRole("button", { name: "Request" })).not.toBeInTheDocument()
    expect(screen.getByTestId("driver-picker")).toBeInTheDocument()
    expect(screen.getByTestId("driver-picker-confirm")).toBeInTheDocument()
    expect(screen.getByTestId("ride-needed-legs")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Ask the team for a ride" })).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Accept" })).not.toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Ask the team for a ride" }))
    expect(onCreateRide).toHaveBeenCalledWith("UID:practice", undefined, "BOTH")
    expect(onAssignCoverage).not.toHaveBeenCalled()
  })

  it("shows Request without Assign when coverage is all-set", () => {
    renderCard(item({ id: "covered-request", title: "Practice" }), {
      rideEvent: requestableRide,
      onCreateRide: vi.fn(),
    })
    expect(screen.getByRole("button", { name: "Request" })).toBeInTheDocument()
    expect(screen.getByTestId("ride-needed-legs")).toBeInTheDocument()
    expect(screen.queryByTestId("driver-picker")).not.toBeInTheDocument()
  })

  // Gap clearing from FULLY_COVERED ownRequests lands in the mapper task.
  it.skip("hides Assign when every uncovered kid is on an ACCEPTED own ride", () => {
    renderCard(
      item({
        id: "accepted-clears-gap",
        title: "Practice",
        uncoveredKidIds: ["k1"],
      }),
      {
        rideEvent: {
          eventKey: "UID:accepted",
          title: "Practice",
          startsAt: "2030-08-15T17:00:00.000Z",
          endsAt: null,
          defaultKidIds: [],
          ownRequest: {
            id: "r1",
            spaceId: "s1",
            eventKey: "UID:accepted",
            requestingCircleId: "c1",
            requestingCircleName: "Ours",
            requestedByAdultId: "a1",
            kidIds: ["k1"],
            kidFirstNames: ["Maya"],
            seats: 1,
            pickupPlaceName: "Home",
            pickupAddress: "1 Main",
pickupTown: null,
detourMinutes: null,
            status: "ACCEPTED",
            passedByMe: false,
            passedByAdultNames: [],
            acceptedByAdultId: "a2",
            acceptingCircleId: "c2",
            acceptingCircleName: "Sharks Family",
            vehicleId: "v1",
            vehicleLabel: "Van",
          },
          otherRequests: [],
        },
        onAssignCoverage: vi.fn(),
      },
    )
    expect(screen.queryByTestId("driver-picker")).not.toBeInTheDocument()
    expect(screen.queryByText("Needs coverage")).not.toBeInTheDocument()
    expect(
      within(screen.getByTestId("agenda-focus-chips")).getByText("Riding with Sharks Family"),
    ).toBeInTheDocument()
    expect(
      within(screen.getByTestId("agenda-focus-chips")).queryByText("All set"),
    ).not.toBeInTheDocument()
    expect(screen.getByTestId("agenda-focus-MANUAL-accepted-clears-gap")).toHaveStyle({
      backgroundColor: "var(--fc-surface-raised)",
    })
  })

  it("shows a calm ride-status chip when there is no transport gap", () => {
    renderCard(item({ id: "all-set-calm", title: "Practice", uncoveredKidIds: [] }))
    expect(
      within(screen.getByTestId("agenda-focus-chips")).getByText("Assigned driving"),
    ).toBeInTheDocument()
    expect(within(screen.getByTestId("agenda-focus-chips")).queryByText("All set")).not.toBeInTheDocument()
  })

  it.skip("keeps Assign when some uncovered kids remain after an ACCEPTED ride", () => {
    renderCard(
      item({
        id: "mixed-gap",
        title: "Practice",
        uncoveredKidIds: ["k1", "k2"],
        kidIds: ["k1", "k2"],
        rsvps: [
          { kidId: "k1", status: "YES" },
          { kidId: "k2", status: "YES" },
        ],
      }),
      {
        rideEvent: {
          eventKey: "UID:mixed",
          title: "Practice",
          startsAt: "2030-08-15T17:00:00.000Z",
          endsAt: null,
          defaultKidIds: [],
          ownRequest: {
            id: "r1",
            spaceId: "s1",
            eventKey: "UID:mixed",
            requestingCircleId: "c1",
            requestingCircleName: "Ours",
            requestedByAdultId: "a1",
            kidIds: ["k1"],
            kidFirstNames: ["Maya"],
            seats: 1,
            pickupPlaceName: "Home",
            pickupAddress: "1 Main",
pickupTown: null,
detourMinutes: null,
            status: "ACCEPTED",
            passedByMe: false,
            passedByAdultNames: [],
            acceptedByAdultId: "a2",
            acceptingCircleId: "c2",
            acceptingCircleName: "Sharks Family",
            vehicleId: "v1",
            vehicleLabel: "Van",
          },
          otherRequests: [],
        },
        assignDraft: { adultId: "a1", kidIds: ["k2"], soleAdult: true, soleKid: true },
        onAssignCoverage: vi.fn(),
      },
    )
    expect(screen.getByTestId("driver-picker")).toBeInTheDocument()
    expect(screen.getByTestId("driver-picker-confirm")).toBeInTheDocument()
    const chips = screen.getByTestId("agenda-focus-chips")
    expect(within(chips).getByText("Ride needed")).toBeInTheDocument()
    expect(within(chips).queryByText("Riding with Sharks Family")).not.toBeInTheDocument()
  })

  it("prefers Accept/Pass over Request", () => {
    renderCard(item({ id: "accept-over-request", title: "Practice" }), {
      rideEvent: {
        ...requestableRide,
        defaultKidIds: ["k1"],
        otherRequests: [
          focusRequest({
            id: "ask-1",
            eventKey: "UID:practice",
          }),
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
          leaveFromPlaceId: null,
          leaveFromPlaceName: null,
          leaveFromAddress: null,
          leaveByAt: null,
          leaveByStatus: null,
          leaveByReason: null,
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

describe("AgendaFocusCard ride commitment conflict", () => {
  const inboundAccepted = focusRequest({
    id: "inbound-accepted",
    eventKey: "UID:practice",
    kidId: "k-them",
    kidFirstName: "Mia",
    status: "FULLY_COVERED",
    legStatuses: [
      { leg: "TO", status: "CONFIRMED" },
      { leg: "FROM", status: "CONFIRMED" },
    ],
  })

  const inboundRide = focusRide({
    id: "inbound-fulfill",
    eventKey: "UID:practice",
    passengerRequestIds: ["inbound-accepted"],
  })

  it("shows Type A conflict line under chips and keeps Withdraw", () => {
    const onWithdrawRide = vi.fn()
    renderCard(
      item({
        id: "type-a-conflict",
        title: "Practice",
        uncoveredKidIds: ["k1"],
      }),
      {
        rideEvent: focusRideEvent({
          eventKey: "UID:practice",
          defaultKidIds: ["k1"],
          otherRequests: [inboundAccepted],
          rides: [inboundRide],
        }),
        onWithdrawRide,
      },
    )

    const chips = screen.getByTestId("agenda-focus-chips")
    expect(within(chips).getByText("Also driving Mia")).toBeInTheDocument()
    expect(within(chips).getByText("Ride needed")).toBeInTheDocument()
    expect(screen.getByTestId("agenda-focus-ride-conflict")).toHaveTextContent(
      "You're driving Mia but Sam still need a ride.",
    )
    expect(screen.getByRole("button", { name: "Withdraw" })).toBeInTheDocument()
  })

  it("shows Type B mutual-swap conflict line under chips", () => {
    renderCard(
      item({
        id: "type-b-conflict",
        title: "Practice",
        uncoveredKidIds: [],
      }),
      {
        rideEvent: focusRideEvent({
          eventKey: "UID:practice",
          ownRequests: [
            focusRequest({
              id: "own-accepted",
              eventKey: "UID:practice",
              requestingCircleId: "c1",
              requestingCircleName: "Ours",
              requestedByAdultId: "a1",
              kidId: "k1",
              kidFirstName: "Sam",
              status: "FULLY_COVERED",
              legStatuses: [
                { leg: "TO", status: "CONFIRMED" },
                { leg: "FROM", status: "CONFIRMED" },
              ],
            }),
          ],
          otherRequests: [inboundAccepted],
          rides: [
            inboundRide,
            focusRide({
              id: "own-fulfill",
              eventKey: "UID:practice",
              drivingCircleId: "c2",
              drivingCircleName: "House B",
              vehicleId: "v2",
              vehicleLabel: "SUV",
              passengerRequestIds: ["own-accepted"],
            }),
          ],
        }),
        onWithdrawRide: vi.fn(),
        onCancelRide: vi.fn(),
      },
    )

    const chips = screen.getByTestId("agenda-focus-chips")
    expect(within(chips).getByText("Ride conflict")).toBeInTheDocument()
    expect(within(chips).getByText("Riding with House B")).toBeInTheDocument()
    expect(screen.getByTestId("agenda-focus-ride-conflict")).toHaveTextContent(
      "You're driving Mia and Sam rides with them — pick one plan.",
    )
  })
})
