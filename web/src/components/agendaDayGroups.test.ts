import { describe, expect, it } from "vitest"

import type { CalendarItem, CarpoolRide } from "@/api/types"
import {
  AGENDA_LIST_SECTION_LABEL,
  groupAgendaByDay,
  groupAgendaListSections,
} from "@/components/agendaDayGroups"

function item(
  id: string,
  startsAt: string,
  overrides: Partial<CalendarItem> = {},
): CalendarItem {
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
    eventKey: null,
    leaveFromPlaceId: null,
    leaveFromPlaceName: null,
    leaveByAt: null,
    leaveByStatus: "UNAVAILABLE",
    leaveByReason: "NO_ORIGIN",
    coverages: [],
    uncoveredKidIds: [],
    conflicts: [],
    rsvps: [{ kidId: "k1", status: "NO_RESPONSE" }],
    ...overrides,
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

describe("groupAgendaListSections", () => {
  const now = new Date(2026, 7, 15, 12, 0, 0, 0)
  const adultId = "a1"

  it("splits today attention vs rest of today and uses all-caps labels", () => {
    const attention = item("gap", localIso(2026, 8, 15, 10), {
      uncoveredKidIds: ["k1"],
    })
    const calmToday = item("calm", localIso(2026, 8, 15, 14))
    const tomorrow = item("tomorrow", localIso(2026, 8, 16, 9))
    const thisWeek = item("week", localIso(2026, 8, 18, 10))
    const later = item("later", localIso(2026, 8, 25, 10))

    const { floatFocusAbove, sections } = groupAgendaListSections(
      [attention, calmToday, tomorrow, thisWeek, later],
      { now, currentAdultId: adultId, queueHasItems: false },
    )

    expect(floatFocusAbove).toBe(false)
    expect(sections.map((s) => s.label)).toEqual([
      AGENDA_LIST_SECTION_LABEL.needsAttention,
      AGENDA_LIST_SECTION_LABEL.restOfToday,
      AGENDA_LIST_SECTION_LABEL.tomorrow,
      AGENDA_LIST_SECTION_LABEL.thisWeek,
      AGENDA_LIST_SECTION_LABEL.later,
    ])
    expect(sections[0].items.map((i) => i.id)).toEqual(["gap"])
    expect(sections[1].items.map((i) => i.id)).toEqual(["calm"])
    expect(sections[2].dateLabel).toBe(
      new Date(2026, 7, 16).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
      }),
    )
  })

  it("omits NEEDS YOUR ATTENTION list section when queueHasItems and folds today attention into REST OF TODAY", () => {
    const attention = item("gap", localIso(2026, 8, 15, 10), {
      uncoveredKidIds: ["k1"],
    })
    const calmToday = item("calm", localIso(2026, 8, 15, 14))
    const { floatFocusAbove, sections } = groupAgendaListSections(
      [attention, calmToday],
      {
        now,
        currentAdultId: adultId,
        queueHasItems: true,
      },
    )

    expect(floatFocusAbove).toBe(true)
    expect(sections.map((s) => s.label)).toEqual([AGENDA_LIST_SECTION_LABEL.restOfToday])
    expect(sections[0].items.map((i) => i.id)).toEqual(["gap", "calm"])
  })

  it("keeps NEEDS YOUR ATTENTION in the list when queue is empty and today rows need attention", () => {
    const attention = item("gap", localIso(2026, 8, 15, 10), {
      uncoveredKidIds: ["k1"],
    })
    const calmToday = item("calm", localIso(2026, 8, 15, 14))
    const { floatFocusAbove, sections } = groupAgendaListSections(
      [attention, calmToday],
      {
        now,
        currentAdultId: adultId,
        queueHasItems: false,
      },
    )

    expect(floatFocusAbove).toBe(false)
    expect(sections.map((s) => s.label)).toEqual([
      AGENDA_LIST_SECTION_LABEL.needsAttention,
      AGENDA_LIST_SECTION_LABEL.restOfToday,
    ])
    expect(sections[0].items.map((i) => i.id)).toEqual(["gap"])
    expect(sections[1].items.map((i) => i.id)).toEqual(["calm"])
  })

  it("omits NEEDS YOUR ATTENTION when queue is empty and there are no attention rows", () => {
    const calmToday = item("calm", localIso(2026, 8, 15, 14))
    const { floatFocusAbove, sections } = groupAgendaListSections([calmToday], {
      now,
      currentAdultId: adultId,
      queueHasItems: false,
    })

    expect(floatFocusAbove).toBe(false)
    expect(sections.map((s) => s.label)).toEqual([AGENDA_LIST_SECTION_LABEL.restOfToday])
  })

  it("includes queue attention rows in REST OF TODAY without excluding them when queueHasItems", () => {
    const earlierGap = item("urgent", localIso(2026, 8, 15, 9), {
      uncoveredKidIds: ["k1"],
    })
    const calmToday = item("calm", localIso(2026, 8, 15, 14))
    const laterGap = item("gap", localIso(2026, 8, 15, 18), {
      uncoveredKidIds: ["k1"],
    })

    const { sections } = groupAgendaListSections([earlierGap, calmToday, laterGap], {
      now,
      currentAdultId: adultId,
      queueHasItems: true,
    })

    expect(sections.map((s) => s.label)).toEqual([AGENDA_LIST_SECTION_LABEL.restOfToday])
    expect(sections[0].items.map((i) => i.id)).toEqual(["urgent", "calm", "gap"])
  })

  it("keeps tomorrow attention rows in TOMORROW when queueHasItems", () => {
    const tomorrowGap = item("tmw-gap", localIso(2026, 8, 16, 9), {
      uncoveredKidIds: ["k1"],
    })

    const { sections } = groupAgendaListSections([tomorrowGap], {
      now,
      currentAdultId: adultId,
      queueHasItems: true,
    })

    expect(sections.map((s) => s.label)).toEqual([AGENDA_LIST_SECTION_LABEL.tomorrow])
    expect(sections[0].items.map((i) => i.id)).toEqual(["tmw-gap"])
  })

  it("puts out-of-play today rows under REST OF TODAY, not attention", () => {
    const skipped = item("skip", localIso(2026, 8, 15, 10), {
      uncoveredKidIds: ["k1"],
      rsvps: [{ kidId: "k1", status: "NO" }],
    })
    const { sections } = groupAgendaListSections([skipped], {
      now,
      currentAdultId: adultId,
      queueHasItems: false,
    })

    expect(sections.map((s) => s.label)).toEqual([AGENDA_LIST_SECTION_LABEL.restOfToday])
    expect(sections[0].items.map((i) => i.id)).toEqual(["skip"])
  })

  it("wires ownRequest so covered gap kids leave attention", () => {
    const gap = item("gap", localIso(2026, 8, 15, 10), {
      uncoveredKidIds: ["k1"],
    })
    const ownRequest = {
      id: "r1",
      status: "ACCEPTED",
      kidIds: ["k1"],
    } as CarpoolRide

    const { sections } = groupAgendaListSections([gap], {
      now,
      currentAdultId: adultId,
      queueHasItems: false,
      ownRequestFor: () => ownRequest,
    })

    expect(sections.map((s) => s.label)).toEqual([AGENDA_LIST_SECTION_LABEL.restOfToday])
  })

  it("omits empty day sections", () => {
    const later = item("later", localIso(2026, 8, 25, 10))
    const { sections } = groupAgendaListSections([later], {
      now,
      currentAdultId: adultId,
      queueHasItems: false,
    })
    expect(sections.map((s) => s.label)).toEqual([AGENDA_LIST_SECTION_LABEL.later])
  })
})
