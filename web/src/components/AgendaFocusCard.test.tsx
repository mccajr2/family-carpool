import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
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

function renderCard(calendarItem: CalendarItem) {
  return render(
    <AgendaFocusCard
      item={calendarItem}
      circle={circle}
      currentAdultId="a1"
      loading={false}
      assignDraft={{ adultId: "a1", kidIds: calendarItem.uncoveredKidIds, soleAdult: true, soleKid: true }}
      {...noopHandlers}
    />,
  )
}

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
    expect(screen.getByText("Needs coverage: Sam")).toBeInTheDocument()
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
    expect(screen.getByText("All set")).toBeInTheDocument()
  })

  it("applies the display font to the hero title", () => {
    renderCard(
      item({
        id: "urgent",
        title: "Practice",
        uncoveredKidIds: ["k1"],
      }),
    )
    expect(screen.getByText("Practice")).toHaveClass("fc-display")
  })

  it("still fires Edit on a manual item after the chrome change", async () => {
    const user = userEvent.setup()
    const onEdit = vi.fn()
    render(
      <AgendaFocusCard
        item={item({ id: "e1", title: "Practice", uncoveredKidIds: ["k1"] })}
        circle={circle}
        currentAdultId="a1"
        loading={false}
        assignDraft={{ adultId: "a1", kidIds: ["k1"], soleAdult: true, soleKid: true }}
        {...noopHandlers}
        onEdit={onEdit}
      />,
    )
    await user.click(screen.getByRole("button", { name: "Edit" }))
    expect(onEdit).toHaveBeenCalledTimes(1)
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
