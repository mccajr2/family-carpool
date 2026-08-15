import { describe, expect, it } from "vitest"

import type { CalendarItem } from "@/api/types"
import { selectFocusItem } from "@/components/agendaFocusSelection"

function item(
  partial: Pick<CalendarItem, "id" | "startsAt"> &
    Partial<Pick<CalendarItem, "kidIds" | "rsvps" | "uncoveredKidIds" | "conflicts">>,
): CalendarItem {
  const kidIds = partial.kidIds ?? ["k1"]
  return {
    id: partial.id,
    source: "MANUAL",
    title: partial.id,
    startsAt: partial.startsAt,
    endsAt: null,
    location: null,
    kidIds,
    feedId: null,
    feedName: null,
    leaveFromPlaceId: null,
    leaveFromPlaceName: null,
    leaveByAt: null,
    leaveByStatus: "UNAVAILABLE",
    leaveByReason: "NO_ORIGIN",
    coverages: [],
    uncoveredKidIds: partial.uncoveredKidIds ?? [],
    conflicts: partial.conflicts ?? [],
    rsvps:
      partial.rsvps ??
      kidIds.map((kidId) => ({ kidId, status: "YES" as const })),
  }
}

const conflict = {
  type: "KID_TIME_OVERLAP" as const,
  kidId: "k1",
  adultId: null,
  adultDisplayName: null,
  otherSource: "MANUAL" as const,
  otherItemId: "other",
  otherTitle: "Other",
  otherStartsAt: "2030-08-15T18:00:00Z",
}

describe("selectFocusItem", () => {
  it("picks the earliest uncovered or conflicted item over a calmer earlier one", () => {
    const calmEarly = item({
      id: "calm",
      startsAt: "2030-08-15T16:00:00Z",
    })
    const uncoveredLater = item({
      id: "uncovered",
      startsAt: "2030-08-15T17:00:00Z",
      uncoveredKidIds: ["k1"],
    })
    expect(selectFocusItem([calmEarly, uncoveredLater])?.id).toBe("uncovered")

    const conflictedLater = item({
      id: "conflicted",
      startsAt: "2030-08-15T17:00:00Z",
      conflicts: [conflict],
    })
    expect(selectFocusItem([calmEarly, conflictedLater])?.id).toBe("conflicted")
  })

  it("never selects an all-RSVP-No item", () => {
    const allNo = item({
      id: "no",
      startsAt: "2030-08-15T16:00:00Z",
      rsvps: [{ kidId: "k1", status: "NO" }],
      uncoveredKidIds: ["k1"],
    })
    const attending = item({
      id: "yes",
      startsAt: "2030-08-15T17:00:00Z",
    })
    expect(selectFocusItem([allNo, attending])?.id).toBe("yes")
    expect(selectFocusItem([allNo])).toBeNull()
  })

  it("returns null for an empty agenda", () => {
    expect(selectFocusItem([])).toBeNull()
  })

  it("returns the earliest item when every attending item is covered", () => {
    const first = item({ id: "first", startsAt: "2030-08-15T16:00:00Z" })
    const second = item({ id: "second", startsAt: "2030-08-15T17:00:00Z" })
    expect(selectFocusItem([first, second])?.id).toBe("first")
  })
})
