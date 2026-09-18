import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import { AuthSessionHolder } from "@/api/authSession"
import type { CalendarItem, FamilyCircle } from "@/api/types"
import { CalendarUxSandboxScreen } from "@/sandbox/CalendarUxSandboxScreen"

const circle: FamilyCircle = {
  id: "c1",
  name: "Test Family",
  role: "ORGANIZER",
  members: [
    { adultId: "a1", email: "a@example.com", displayName: "Alex", role: "ORGANIZER" },
  ],
  kids: [{ id: "k1", displayName: "Sam" }],
  places: [
    { id: "p1", name: "Home", address: "1 Main", latitude: 40, longitude: -74 },
  ],
  defaultLeaveFromPlaceId: "p1",
  defaultLeaveFromPlaceName: "Home",
}

function calendarItem(
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
    leaveFromPlaceName: "Home",
    leaveFromAddress: null,
    leaveByAt: "2030-08-15T16:30:00.000Z",
    leaveByStatus: "OK",
    leaveByReason: null,
    coverages: [],
    uncoveredKidIds: kidIds,
    conflicts: [],
    rsvps: kidIds.map((kidId) => ({ kidId, status: "YES" as const })),
    driveBlockLinks: [],
    ...partial,
  }
}

function createSession() {
  const session = new AuthSessionHolder()
  session.setSession("tok", {
    id: "a1",
    email: "a@example.com",
    displayName: "Alex",
  })
  return session
}

describe("CalendarUxSandboxScreen", () => {
  it("renders Current and Proposed columns with live calendar data", async () => {
    const items = [
      calendarItem({ id: "e1", title: "Practice at the Rink" }),
      calendarItem({
        id: "e2",
        title: "Game Night",
        startsAt: "2030-08-15T19:00:00.000Z",
        leaveByAt: "2030-08-15T18:30:00.000Z",
      }),
    ]
    const familyClient = {
      getCircle: vi.fn().mockResolvedValue(circle),
      listCalendar: vi.fn().mockResolvedValue(items),
    }
    const carpoolClient = {
      getSummary: vi.fn().mockResolvedValue({ spaces: [], feeds: [] }),
      listCircleRidePlans: vi.fn().mockResolvedValue([]),
      listRides: vi.fn().mockResolvedValue([]),
    }
    const onExit = vi.fn()
    const onSignedOut = vi.fn()

    render(
      <CalendarUxSandboxScreen
        session={createSession()}
        familyClient={familyClient as never}
        carpoolClient={carpoolClient as never}
        now={new Date("2030-08-15T12:00:00.000Z")}
        onExit={onExit}
        onSignedOut={onSignedOut}
      />,
    )

    await waitFor(() => {
      expect(screen.getByTestId("calendar-ux-sandbox")).toBeInTheDocument()
    })
    expect(screen.getByText("Calendar UX sandbox")).toBeInTheDocument()
    expect(
      screen.getByText("Read-only · live data · Current vs Proposed"),
    ).toBeInTheDocument()

    const current = await screen.findByTestId("sandbox-current-column")
    const proposed = screen.getByTestId("sandbox-proposed-column")
    expect(within(current).getByRole("heading", { name: "Current" })).toBeInTheDocument()
    expect(within(proposed).getByRole("heading", { name: "Proposed" })).toBeInTheDocument()
    expect(screen.getByTestId("sandbox-proposed-notes")).toBeInTheDocument()
    expect(within(current).getAllByText("Practice at the Rink").length).toBeGreaterThan(0)
    expect(within(proposed).getAllByText("Practice at the Rink").length).toBeGreaterThan(0)
    expect(familyClient.getCircle).toHaveBeenCalledWith("tok")
    expect(familyClient.listCalendar).toHaveBeenCalled()

    const user = userEvent.setup()
    await user.click(screen.getByRole("button", { name: "Exit sandbox" }))
    expect(onExit).toHaveBeenCalled()
  })

  it("shows an error state when the API fails", async () => {
    const familyClient = {
      getCircle: vi.fn().mockRejectedValue(new Error("backend down")),
      listCalendar: vi.fn(),
    }
    const carpoolClient = {
      getSummary: vi.fn(),
      listCircleRidePlans: vi.fn(),
      listRides: vi.fn(),
    }

    render(
      <CalendarUxSandboxScreen
        session={createSession()}
        familyClient={familyClient as never}
        carpoolClient={carpoolClient as never}
        onExit={vi.fn()}
        onSignedOut={vi.fn()}
      />,
    )

    expect(await screen.findByRole("alert")).toHaveTextContent("backend down")
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument()
  })
})
