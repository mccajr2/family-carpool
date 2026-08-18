import { render, screen, within } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import type { CalendarItem } from "@/api/types"
import { AgendaWeekGlance } from "@/components/AgendaWeekGlance"

function item(
  partial: Pick<CalendarItem, "id" | "startsAt"> & Partial<Pick<CalendarItem, "uncoveredKidIds">>,
): CalendarItem {
  return {
    id: partial.id,
    source: "MANUAL",
    title: partial.id,
    startsAt: partial.startsAt,
    endsAt: null,
    location: null,
    kidIds: ["k1"],
    feedId: null,
    feedName: null,
    leaveFromPlaceId: null,
    leaveFromPlaceName: null,
    leaveByAt: null,
    leaveByStatus: "UNAVAILABLE",
    leaveByReason: "NO_ORIGIN",
    coverages: [],
    uncoveredKidIds: partial.uncoveredKidIds ?? [],
    conflicts: [],
    rsvps: [{ kidId: "k1", status: "YES" }],
  }
}

function localIso(year: number, month: number, day: number, hour = 12): string {
  return new Date(year, month - 1, day, hour, 0, 0, 0).toISOString()
}

const now = new Date(2026, 7, 12, 12, 0, 0, 0)

describe("AgendaWeekGlance", () => {
  it("renders the heading, five weekday rows, a flag, and no Maps or driver copy", () => {
    render(
      <AgendaWeekGlance
        now={now}
        currentAdultId="adult-1"
        items={[
          item({
            id: "uncovered",
            startsAt: localIso(2026, 8, 12, 18),
            uncoveredKidIds: ["k1"],
          }),
        ]}
      />,
    )

    const heading = screen.getByRole("heading", { name: "Week at a glance" })
    expect(heading.tagName).toBe("H3")
    expect(heading.className).toMatch(/fc-display/)
    expect(heading.className).toMatch(/--fc-font-week-glance-title-size/)
    expect(heading.className).not.toMatch(/hero/)

    const rows = screen.getAllByRole("listitem")
    expect(rows).toHaveLength(5)
    expect(rows.map((row) => within(row).getByText(/^(Wed|Thu|Fri|Sat|Sun)$/i).textContent)).toEqual(
      ["Wed", "Thu", "Fri", "Sat", "Sun"],
    )
    expect(within(rows[0]).getByText("1 needs coverage")).toBeInTheDocument()
    expect(within(rows[0]).getByText("Wed").className).toMatch(/--fc-text-secondary/)
    expect(within(rows[0]).getByText("1 needs coverage").className).toMatch(/--fc-text-primary/)
    expect(within(rows[0]).getByTestId("week-glance-flag").className).toMatch(/--fc-space-week-flag/)
    expect(within(rows[0]).getByTestId("week-glance-flag").className).toMatch(/--fc-danger/)
    expect(within(rows[0]).getByTestId("week-glance-flag").className).not.toMatch(/hero/)
    expect(within(rows[1]).getByText("No events")).toBeInTheDocument()
    expect(within(rows[1]).getByText("No events").className).toMatch(/--fc-text-secondary/)
    expect(within(rows[1]).queryByTestId("week-glance-flag")).not.toBeInTheDocument()

    expect(screen.queryByRole("button")).not.toBeInTheDocument()
    expect(screen.queryByRole("link")).not.toBeInTheDocument()
    expect(screen.queryByText(/open in maps/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/need drivers/i)).not.toBeInTheDocument()
    expect(document.body.innerHTML).not.toMatch(/--fc-hero/)
  })
})
