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
})
