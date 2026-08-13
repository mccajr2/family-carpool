import { describe, expect, it } from "vitest"

import type { CalendarItem } from "@/api/types"
import {
  isAgendaItemOutOfPlay,
  kidHasActiveCoverage,
  rsvpCoverageReleaseMessage,
  rsvpStatusForKid,
  rsvpStatusLabel,
} from "@/components/rsvpDisplay"

function item(
  partial: Pick<CalendarItem, "id" | "kidIds" | "rsvps"> &
    Partial<Pick<CalendarItem, "coverages">>,
): CalendarItem {
  return {
    id: partial.id,
    source: "MANUAL",
    title: "Game",
    startsAt: "2026-08-15T17:00:00Z",
    endsAt: null,
    location: null,
    kidIds: partial.kidIds,
    feedId: null,
    feedName: null,
    leaveFromPlaceId: null,
    leaveFromPlaceName: null,
    leaveByAt: null,
    leaveByStatus: "UNAVAILABLE",
    leaveByReason: "NO_ORIGIN",
    coverages: partial.coverages ?? [],
    uncoveredKidIds: [],
    conflicts: [],
    rsvps: partial.rsvps,
  }
}

describe("rsvpDisplay", () => {
  it("labels RSVP statuses", () => {
    expect(rsvpStatusLabel("YES")).toBe("Yes")
    expect(rsvpStatusLabel("NO")).toBe("No")
    expect(rsvpStatusLabel("NO_RESPONSE")).toBe("No response")
  })

  it("defaults missing rsvp row to NO_RESPONSE", () => {
    expect(
      rsvpStatusForKid(item({ id: "e1", kidIds: ["k1"], rsvps: [] }), "k1"),
    ).toBe("NO_RESPONSE")
  })

  it("marks one-kid No and all-No as out of play", () => {
    expect(
      isAgendaItemOutOfPlay(
        item({
          id: "e1",
          kidIds: ["k1"],
          rsvps: [{ kidId: "k1", status: "NO" }],
        }),
      ),
    ).toBe(true)
    expect(
      isAgendaItemOutOfPlay(
        item({
          id: "e1",
          kidIds: ["k1", "k2"],
          rsvps: [
            { kidId: "k1", status: "NO" },
            { kidId: "k2", status: "NO" },
          ],
        }),
      ),
    ).toBe(true)
  })

  it("keeps mixed Yes/No in play", () => {
    expect(
      isAgendaItemOutOfPlay(
        item({
          id: "e1",
          kidIds: ["k1", "k2"],
          rsvps: [
            { kidId: "k1", status: "YES" },
            { kidId: "k2", status: "NO" },
          ],
        }),
      ),
    ).toBe(false)
  })

  it("detects active coverage for a kid", () => {
    const row = item({
      id: "e1",
      kidIds: ["k1", "k2"],
      rsvps: [],
      coverages: [
        {
          id: "a1",
          coveringAdultId: "adult",
          coveringAdultDisplayName: "Alex",
          assignedByAdultId: "adult",
          kidIds: ["k1"],
          status: "CONFIRMED",
        },
      ],
    })
    expect(kidHasActiveCoverage(row, "k1")).toBe(true)
    expect(kidHasActiveCoverage(row, "k2")).toBe(false)
  })

  it("builds coverage release confirm copy", () => {
    expect(rsvpCoverageReleaseMessage("Emma")).toBe(
      "This will remove coverage for Emma.",
    )
  })
})
