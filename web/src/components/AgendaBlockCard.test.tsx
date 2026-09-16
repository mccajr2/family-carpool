import { render, screen, within } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import type { CalendarItem } from "@/api/types"
import { AgendaBlockCard } from "@/components/AgendaBlockCard"

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
    eventKey: null,
    leaveFromPlaceId: null,
    leaveFromPlaceName: null,
    leaveFromAddress: null,
    leaveByAt: null,
    leaveByStatus: "UNAVAILABLE",
    leaveByReason: "NO_ORIGIN",
    coverages: [],
    uncoveredKidIds: [],
    conflicts: [],
    rsvps: [{ kidId: "k1", status: "NO_RESPONSE" }],
    driveBlockLinks: [],
    ...overrides,
  }
}

describe("AgendaBlockCard", () => {
  it("renders one card for multiple combined members (not per-event rows)", () => {
    const members = [
      item("a", "2030-08-15T17:00:00.000Z"),
      item("b", "2030-08-15T18:00:00.000Z"),
    ]

    render(<AgendaBlockCard items={members} />)

    const card = screen.getByTestId("agenda-block-card")
    expect(card).toHaveAttribute("data-member-keys", "FEED-a,FEED-b")
    expect(within(card).getByTestId("agenda-block-title")).toHaveTextContent(
      "Two events tonight",
    )
    expect(within(card).getByTestId("agenda-block-team")).toHaveTextContent("U12")
    expect(within(card).getByTestId("agenda-block-where")).toHaveTextContent(
      "Simoni Rink",
    )

    const list = within(card).getByTestId("agenda-block-members")
    expect(within(list).getAllByTestId(/agenda-block-member-FEED-/)).toHaveLength(2)
    expect(within(list).getByTestId("agenda-block-member-FEED-a")).toHaveTextContent(
      "Practice A",
    )
    expect(within(list).getByTestId("agenda-block-member-FEED-b")).toHaveTextContent(
      "Practice B",
    )

    expect(screen.queryByTestId("agenda-row-FEED-a")).not.toBeInTheDocument()
    expect(screen.queryByTestId("agenda-row-FEED-b")).not.toBeInTheDocument()
  })

  it("applies focus chrome when isFocused", () => {
    render(
      <AgendaBlockCard
        items={[
          item("a", "2030-08-15T17:00:00.000Z"),
          item("b", "2030-08-15T18:00:00.000Z"),
        ]}
        isFocused
      />,
    )
    const card = screen.getByTestId("agenda-block-card")
    expect(card).toHaveAttribute("data-focused", "true")
    expect(card.className).toMatch(/--fc-list-row-focus-border/)
  })
})
