import { describe, expect, it } from "vitest"

import {
  applyLeaveByFillIn,
  mergeCheapCalendarItem,
  mergeCheapCalendarItems,
} from "@/api/calendarLeaveBy"
import type { CalendarItem, CalendarLeaveBy } from "@/api/types"

function item(
  partial: Partial<CalendarItem> & Pick<CalendarItem, "id" | "title">,
): CalendarItem {
  return {
    source: "MANUAL",
    startsAt: "2026-08-15T17:00:00.000Z",
    endsAt: null,
    location: "Rink",
    kidIds: ["k1"],
    feedId: null,
    feedName: null,
    leaveFromPlaceId: "p1",
    leaveFromPlaceName: "Home",
    leaveByAt: null,
    leaveByStatus: "PENDING",
    leaveByReason: null,
    coverages: [],
    uncoveredKidIds: [],
    conflicts: [],
    rsvps: [],
    ...partial,
  }
}

describe("mergeCheapCalendarItem", () => {
  it("uses incoming UNAVAILABLE and clears a stale OK", () => {
    const cached = item({
      id: "e1",
      title: "Practice",
      leaveByStatus: "OK",
      leaveByAt: "2026-08-15T16:00:00.000Z",
      leaveByReason: null,
    })
    const incoming = item({
      id: "e1",
      title: "Practice",
      leaveByStatus: "UNAVAILABLE",
      leaveByReason: "NO_ORIGIN",
      leaveFromPlaceId: null,
      leaveFromPlaceName: null,
    })
    expect(mergeCheapCalendarItem(incoming, cached)).toEqual(incoming)
  })

  it("keeps cached settled leave-by when cheap is PENDING and origin matches", () => {
    const cached = item({
      id: "e1",
      title: "Practice",
      leaveByStatus: "OK",
      leaveByAt: "2026-08-15T16:00:00.000Z",
    })
    const incoming = item({
      id: "e1",
      title: "Practice refreshed",
      leaveByStatus: "PENDING",
      leaveByAt: null,
    })
    const merged = mergeCheapCalendarItem(incoming, cached)
    expect(merged.title).toBe("Practice refreshed")
    expect(merged.leaveByStatus).toBe("OK")
    expect(merged.leaveByAt).toBe("2026-08-15T16:00:00.000Z")
  })

  it("shows PENDING when origin differs from cached OK", () => {
    const cached = item({
      id: "e1",
      title: "Practice",
      leaveFromPlaceId: "p1",
      leaveByStatus: "OK",
      leaveByAt: "2026-08-15T16:00:00.000Z",
    })
    const incoming = item({
      id: "e1",
      title: "Practice",
      leaveFromPlaceId: "p2",
      leaveFromPlaceName: "Dad's",
      leaveByStatus: "PENDING",
      leaveByAt: null,
    })
    expect(mergeCheapCalendarItem(incoming, cached).leaveByStatus).toBe("PENDING")
  })

  it("shows PENDING when there is no cached settled leave-by", () => {
    const incoming = item({ id: "e1", title: "Practice", leaveByStatus: "PENDING" })
    expect(mergeCheapCalendarItem(incoming, undefined).leaveByStatus).toBe("PENDING")
    expect(
      mergeCheapCalendarItem(
        incoming,
        item({ id: "e1", title: "Practice", leaveByStatus: "PENDING" }),
      ).leaveByStatus,
    ).toBe("PENDING")
  })

  it("uses incoming OK from a warm cheap list", () => {
    const incoming = item({
      id: "e1",
      title: "Practice",
      leaveByStatus: "OK",
      leaveByAt: "2026-08-15T16:10:00.000Z",
    })
    const cached = item({
      id: "e1",
      title: "Practice",
      leaveByStatus: "OK",
      leaveByAt: "2026-08-15T16:00:00.000Z",
    })
    expect(mergeCheapCalendarItem(incoming, cached)).toEqual(incoming)
  })
})

describe("mergeCheapCalendarItems", () => {
  it("matches by source and id", () => {
    const cached = [
      item({
        id: "e1",
        title: "Old",
        leaveByStatus: "OK",
        leaveByAt: "2026-08-15T16:00:00.000Z",
      }),
    ]
    const incoming = [
      item({ id: "e1", title: "New", leaveByStatus: "PENDING" }),
      item({ id: "e2", title: "Other", source: "FEED", leaveByStatus: "PENDING" }),
    ]
    const merged = mergeCheapCalendarItems(incoming, cached)
    expect(merged[0]?.leaveByStatus).toBe("OK")
    expect(merged[1]?.leaveByStatus).toBe("PENDING")
  })
})

describe("applyLeaveByFillIn", () => {
  it("overwrites leave-by fields and ignores unknown ids", () => {
    const items = [
      item({ id: "e1", title: "Practice", leaveByStatus: "PENDING" }),
      item({ id: "e2", title: "Game", leaveByStatus: "PENDING" }),
    ]
    const rows: CalendarLeaveBy[] = [
      {
        id: "e1",
        source: "MANUAL",
        leaveFromPlaceId: "p1",
        leaveFromPlaceName: "Home",
        leaveByAt: "2026-08-15T16:20:00.000Z",
        leaveByStatus: "OK",
        leaveByReason: null,
      },
      {
        id: "missing",
        source: "MANUAL",
        leaveByStatus: "OK",
        leaveByAt: "2026-08-15T16:00:00.000Z",
      },
    ]
    const next = applyLeaveByFillIn(items, rows)
    expect(next[0]?.leaveByStatus).toBe("OK")
    expect(next[0]?.leaveByAt).toBe("2026-08-15T16:20:00.000Z")
    expect(next[1]?.leaveByStatus).toBe("PENDING")
  })
})
