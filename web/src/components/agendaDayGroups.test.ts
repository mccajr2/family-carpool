import { describe, expect, it } from "vitest"

import type { CalendarItem } from "@/api/types"
import { groupAgendaByDay } from "@/components/agendaDayGroups"

function item(id: string, startsAt: string): CalendarItem {
  return {
    id,
    source: "MANUAL",
    title: id,
    startsAt,
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
    uncoveredKidIds: [],
    conflicts: [],
    rsvps: [{ kidId: "k1", status: "NO_RESPONSE" }],
  }
}

/** Local calendar noon so grouping is independent of UTC offset. */
function localIso(year: number, month: number, day: number, hour = 12): string {
  return new Date(year, month - 1, day, hour, 0, 0, 0).toISOString()
}

describe("groupAgendaByDay", () => {
  const now = new Date(2026, 7, 15, 12, 0, 0, 0)

  it("splits items across Today / Tomorrow / This week / Later on local days", () => {
    const groups = groupAgendaByDay(
      [
        item("today", localIso(2026, 8, 15, 18)),
        item("tomorrow", localIso(2026, 8, 16, 9)),
        item("this-week", localIso(2026, 8, 18, 10)),
        item("later", localIso(2026, 8, 25, 10)),
      ],
      now,
    )

    expect(groups.map((g) => g.label)).toEqual(["Today", "Tomorrow", "This week", "Later"])
    expect(groups[0].items.map((i) => i.id)).toEqual(["today"])
    expect(groups[1].items.map((i) => i.id)).toEqual(["tomorrow"])
    expect(groups[1].dateLabel).toBe(
      new Date(2026, 7, 16).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
      }),
    )
    expect(groups[2].items.map((i) => i.id)).toEqual(["this-week"])
    expect(groups[3].items.map((i) => i.id)).toEqual(["later"])
  })

  it("omits empty buckets", () => {
    const groups = groupAgendaByDay(
      [item("today", localIso(2026, 8, 15)), item("later", localIso(2026, 9, 1))],
      now,
    )
    expect(groups.map((g) => g.label)).toEqual(["Today", "Later"])
  })

  it("puts unparseable startsAt in Later without throwing", () => {
    const groups = groupAgendaByDay([item("bad", "not-a-date")], now)
    expect(groups).toEqual([
      expect.objectContaining({
        label: "Later",
        items: [expect.objectContaining({ id: "bad" })],
      }),
    ])
  })

  it("uses local midnight, not UTC day boundaries", () => {
    const lateTonight = new Date(2026, 7, 15, 23, 30, 0, 0).toISOString()
    const groups = groupAgendaByDay([item("late", lateTonight)], now)
    expect(groups).toHaveLength(1)
    expect(groups[0].label).toBe("Today")
  })
})
