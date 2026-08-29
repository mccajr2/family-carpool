import { describe, expect, it } from "vitest"

import type { CalendarItem, CarpoolRide } from "@/api/types"
import { selectFocusItem } from "@/components/agendaFocusSelection"
import { agendaWeekGlanceDays } from "@/components/agendaWeekGlanceDays"

function item(
  partial: Pick<CalendarItem, "id" | "startsAt"> &
    Partial<
      Pick<
        CalendarItem,
        "kidIds" | "rsvps" | "uncoveredKidIds" | "conflicts" | "coverages" | "endsAt"
      >
    >,
): CalendarItem {
  const kidIds = partial.kidIds ?? ["k1"]
  return {
    id: partial.id,
    source: "MANUAL",
    title: partial.id,
    startsAt: partial.startsAt,
    endsAt: partial.endsAt ?? null,
    location: null,
    kidIds,
    feedId: null,
    feedName: null,
    eventKey: null,
    leaveFromPlaceId: null,
    leaveFromPlaceName: null,
    leaveByAt: null,
    leaveByStatus: "UNAVAILABLE",
    leaveByReason: "NO_ORIGIN",
    coverages: partial.coverages ?? [],
    uncoveredKidIds: partial.uncoveredKidIds ?? [],
    conflicts: partial.conflicts ?? [],
    rsvps: partial.rsvps ?? kidIds.map((kidId) => ({ kidId, status: "YES" as const })),
  }
}

function localIso(year: number, month: number, day: number, hour = 12): string {
  return new Date(year, month - 1, day, hour, 0, 0, 0).toISOString()
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

/** Wednesday 12 Aug 2026 — Friday is within the seven-day strip. */
const now = new Date(2026, 7, 12, 12, 0, 0, 0)
const adultId = "adult-1"

function pendingFor(coveringAdultId: string) {
  return {
    id: "c1",
    coveringAdultId,
    coveringAdultDisplayName: "Alex",
    assignedByAdultId: "other",
    kidIds: ["k1"],
    status: "PENDING" as const,
  }
}

function acceptedOwnRide(kidIds: string[]): CarpoolRide {
  return {
    id: "r1",
    spaceId: "s1",
    eventKey: "UID:practice",
    requestingCircleId: "c1",
    requestingCircleName: "Ours",
    requestedByAdultId: adultId,
    kidIds,
    kidFirstNames: kidIds.map((id) => id),
    seats: kidIds.length,
    pickupPlaceName: "Home",
    pickupAddress: "1 Main",
    status: "ACCEPTED",
    passedByMe: false,
    passedByAdultNames: [],
    acceptedByAdultId: "a2",
    acceptingCircleId: "c2",
    acceptingCircleName: "Sharks Family",
    vehicleId: "v1",
    vehicleLabel: "Van",
  }
}

describe("agendaWeekGlanceDays", () => {
  it("returns today through today+6 weekday labels and omits today+7", () => {
    const days = agendaWeekGlanceDays(
      [
        item({ id: "plus7", startsAt: localIso(2026, 8, 19, 10), uncoveredKidIds: ["k1"] }),
      ],
      now,
      adultId,
    )
    expect(days).toHaveLength(7)
    expect(days.map((d) => d.weekdayLabel)).toEqual([
      "Wed",
      "Thu",
      "Fri",
      "Sat",
      "Sun",
      "Mon",
      "Tue",
    ])
    expect(days.every((d) => d.copy === "No events" && !d.flagged)).toBe(true)
  })

  it("counts in-play uncovered events, not kids", () => {
    const oneEventTwoKids = agendaWeekGlanceDays(
      [
        item({
          id: "practice",
          startsAt: localIso(2026, 8, 12, 18),
          kidIds: ["k1", "k2"],
          uncoveredKidIds: ["k1", "k2"],
          rsvps: [
            { kidId: "k1", status: "YES" },
            { kidId: "k2", status: "YES" },
          ],
        }),
      ],
      now,
      adultId,
    )
    expect(oneEventTwoKids[0]).toEqual(
      expect.objectContaining({ copy: "1 needs coverage", flagged: true }),
    )

    const twoEvents = agendaWeekGlanceDays(
      [
        item({
          id: "a",
          startsAt: localIso(2026, 8, 12, 16),
          uncoveredKidIds: ["k1"],
        }),
        item({
          id: "b",
          startsAt: localIso(2026, 8, 12, 18),
          uncoveredKidIds: ["k1"],
        }),
      ],
      now,
      adultId,
    )
    expect(twoEvents[0]).toEqual(
      expect.objectContaining({ copy: "2 need coverage", flagged: true }),
    )
  })

  it("flags uncovered Friday and keeps today All set without changing Focus ranking", () => {
    const tonight = item({ id: "tonight", startsAt: localIso(2026, 8, 12, 18) })
    const friday = item({
      id: "friday",
      startsAt: localIso(2026, 8, 14, 10),
      uncoveredKidIds: ["k1"],
    })
    const items = [tonight, friday]
    const days = agendaWeekGlanceDays(items, now, adultId)

    expect(days[0]).toEqual(expect.objectContaining({ copy: "All set", flagged: false }))
    expect(days[2]).toEqual(
      expect.objectContaining({
        weekdayLabel: "Fri",
        copy: "1 needs coverage",
        flagged: true,
      }),
    )
    expect(selectFocusItem(items, now, adultId)?.id).toBe("tonight")
  })

  it("treats all-RSVP-No days as All set and empty days as No events", () => {
    const days = agendaWeekGlanceDays(
      [
        item({
          id: "no",
          startsAt: localIso(2026, 8, 12, 16),
          rsvps: [{ kidId: "k1", status: "NO" }],
          uncoveredKidIds: ["k1"],
        }),
      ],
      now,
      adultId,
    )
    expect(days[0]).toEqual(expect.objectContaining({ copy: "All set", flagged: false }))
    expect(days[1]).toEqual(expect.objectContaining({ copy: "No events", flagged: false }))
  })

  it("uses overlap and pending-for-self copy, and treats pending-for-others as All set", () => {
    const overlapDays = agendaWeekGlanceDays(
      [
        item({
          id: "overlap",
          startsAt: localIso(2026, 8, 12, 18),
          conflicts: [conflict],
        }),
        item({
          id: "overlap-2",
          startsAt: localIso(2026, 8, 13, 18),
          conflicts: [conflict],
        }),
        item({
          id: "overlap-3",
          startsAt: localIso(2026, 8, 13, 19),
          conflicts: [conflict],
        }),
      ],
      now,
      adultId,
    )
    expect(overlapDays[0]).toEqual(expect.objectContaining({ copy: "1 overlaps", flagged: true }))
    expect(overlapDays[1]).toEqual(expect.objectContaining({ copy: "2 overlap", flagged: true }))

    const confirmDays = agendaWeekGlanceDays(
      [
        item({
          id: "mine",
          startsAt: localIso(2026, 8, 12, 18),
          coverages: [pendingFor(adultId)],
        }),
        item({
          id: "mine-2",
          startsAt: localIso(2026, 8, 13, 16),
          coverages: [{ ...pendingFor(adultId), id: "c2" }],
        }),
        item({
          id: "mine-3",
          startsAt: localIso(2026, 8, 13, 18),
          coverages: [{ ...pendingFor(adultId), id: "c3" }],
        }),
      ],
      now,
      adultId,
    )
    expect(confirmDays[0]).toEqual(expect.objectContaining({ copy: "1 to confirm", flagged: true }))
    expect(confirmDays[1]).toEqual(expect.objectContaining({ copy: "2 to confirm", flagged: true }))

    const otherPending = agendaWeekGlanceDays(
      [
        item({
          id: "theirs",
          startsAt: localIso(2026, 8, 12, 18),
          coverages: [pendingFor("other-adult")],
        }),
      ],
      now,
      adultId,
    )
    expect(otherPending[0]).toEqual(expect.objectContaining({ copy: "All set", flagged: false }))
  })

  it("prefers uncovered over overlap over confirm on the same day", () => {
    const days = agendaWeekGlanceDays(
      [
        item({
          id: "uncovered",
          startsAt: localIso(2026, 8, 12, 16),
          uncoveredKidIds: ["k1"],
        }),
        item({
          id: "overlap",
          startsAt: localIso(2026, 8, 12, 17),
          conflicts: [conflict],
        }),
        item({
          id: "confirm",
          startsAt: localIso(2026, 8, 12, 18),
          coverages: [pendingFor(adultId)],
        }),
      ],
      now,
      adultId,
    )
    expect(days[0].copy).toBe("1 needs coverage")
  })

  it("drops other kids' events when the list is already kid-filtered", () => {
    const samOnly = [
      item({
        id: "sam",
        startsAt: localIso(2026, 8, 12, 18),
        kidIds: ["sam"],
        rsvps: [{ kidId: "sam", status: "YES" }],
      }),
    ]
    const withRiley = [
      ...samOnly,
      item({
        id: "riley",
        startsAt: localIso(2026, 8, 13, 10),
        kidIds: ["riley"],
        uncoveredKidIds: ["riley"],
        rsvps: [{ kidId: "riley", status: "YES" }],
      }),
    ]
    expect(agendaWeekGlanceDays(withRiley, now, adultId)[1].copy).toBe("1 needs coverage")
    expect(agendaWeekGlanceDays(samOnly, now, adultId)[1].copy).toBe("No events")
  })

  it("skips unparseable startsAt and counts overnight events on the start day", () => {
    const days = agendaWeekGlanceDays(
      [
        item({ id: "bad", startsAt: "not-a-date", uncoveredKidIds: ["k1"] }),
        item({
          id: "overnight",
          startsAt: localIso(2026, 8, 12, 22),
          endsAt: localIso(2026, 8, 13, 2),
          uncoveredKidIds: ["k1"],
        }),
      ],
      now,
      adultId,
    )
    expect(days[0]).toEqual(
      expect.objectContaining({ copy: "1 needs coverage", flagged: true }),
    )
    expect(days[1]).toEqual(expect.objectContaining({ copy: "No events", flagged: false }))
  })

  it("treats ACCEPTED own rides as clearing coverage gap kids (same as Focus/rows)", () => {
    const coveredA = item({
      id: "a",
      startsAt: localIso(2026, 8, 12, 16),
      uncoveredKidIds: ["k1"],
    })
    const coveredB = item({
      id: "b",
      startsAt: localIso(2026, 8, 12, 18),
      uncoveredKidIds: ["k1"],
    })
    const ownById = new Map<string, CarpoolRide>([
      ["a", acceptedOwnRide(["k1"])],
      ["b", acceptedOwnRide(["k1"])],
    ])
    const cleared = agendaWeekGlanceDays(
      [coveredA, coveredB],
      now,
      adultId,
      (calendarItem) => ownById.get(calendarItem.id) ?? null,
    )
    expect(cleared[0]).toEqual(expect.objectContaining({ copy: "All set", flagged: false }))

    const pendingRide: CarpoolRide = { ...acceptedOwnRide(["k1"]), status: "PENDING" }
    const stillOpen = agendaWeekGlanceDays(
      [coveredA],
      now,
      adultId,
      () => pendingRide,
    )
    expect(stillOpen[0]).toEqual(
      expect.objectContaining({ copy: "1 needs coverage", flagged: true }),
    )

    const partial = agendaWeekGlanceDays(
      [
        item({
          id: "partial",
          startsAt: localIso(2026, 8, 12, 16),
          kidIds: ["k1", "k2"],
          uncoveredKidIds: ["k1", "k2"],
          rsvps: [
            { kidId: "k1", status: "YES" },
            { kidId: "k2", status: "YES" },
          ],
        }),
      ],
      now,
      adultId,
      () => acceptedOwnRide(["k1"]),
    )
    expect(partial[0]).toEqual(
      expect.objectContaining({ copy: "1 needs coverage", flagged: true }),
    )
  })
})
