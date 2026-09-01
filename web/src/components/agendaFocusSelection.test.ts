import { describe, expect, it } from "vitest"

import type { CalendarItem, CarpoolRide, CarpoolRideEvent, Garage } from "@/api/types"
import {
  agendaDayBucketForStartsAt,
  agendaDayBoundaries,
} from "@/components/agendaDayGroups"
import {
  focusItemNeedsDecision,
  focusItemNeedsFamilyDecision,
  selectFocusItem,
  type FocusRideOptions,
} from "@/components/agendaFocusSelection"

function item(
  partial: Pick<CalendarItem, "id" | "startsAt"> &
    Partial<Pick<CalendarItem, "kidIds" | "rsvps" | "uncoveredKidIds" | "conflicts" | "coverages">>,
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
    eventKey: null,
    leaveFromPlaceId: null,
    leaveFromPlaceName: null,
    leaveByAt: null,
    leaveByStatus: "UNAVAILABLE",
    leaveByReason: "NO_ORIGIN",
    coverages: partial.coverages ?? [],
    uncoveredKidIds: partial.uncoveredKidIds ?? [],
    conflicts: partial.conflicts ?? [],
    rsvps:
      partial.rsvps ??
      kidIds.map((kidId) => ({ kidId, status: "YES" as const })),
  }
}

/** Local calendar time so buckets are independent of UTC offset. */
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

const now = new Date(2026, 7, 15, 12, 0, 0, 0)
const adultId = "adult-1"

function rideAsk(partial: Partial<CarpoolRide> = {}): CarpoolRide {
  return {
    id: "ask-1",
    spaceId: "s1",
    eventKey: "UID:game",
    requestingCircleId: "c2",
    requestingCircleName: "House B",
    requestedByAdultId: "a2",
    kidIds: ["k2"],
    kidFirstNames: ["Mia"],
    seats: 1,
    pickupPlaceName: "Home",
    pickupAddress: "1 Main",
    pickupTown: null,
    detourMinutes: null,
    status: "PENDING",
    passedByMe: false,
    passedByAdultNames: [],
    acceptedByAdultId: null,
    acceptingCircleId: null,
    acceptingCircleName: null,
    vehicleId: null,
    vehicleLabel: null,
    ...partial,
  }
}

function rideEvent(partial: Partial<CarpoolRideEvent> = {}): CarpoolRideEvent {
  return {
    eventKey: "UID:game",
    title: "Practice",
    startsAt: localIso(2026, 8, 15, 16),
    endsAt: null,
    defaultKidIds: [],
    ownRequest: null,
    otherRequests: [rideAsk()],
    ...partial,
  }
}

const acceptGarage: Garage = {
  members: [{ adultId, displayName: "Alex", drives: true }],
  vehicles: [
    {
      id: "v1",
      ownerAdultId: adultId,
      driverAdultIds: [adultId],
      keptAtPlaceId: null,
      label: "Van",
      year: 2019,
      make: "HONDA",
      model: "Odyssey",
      seats: 8,
      suggestedSeats: 8,
    },
  ],
}

function rideOptionsFor(
  byId: Record<string, CarpoolRideEvent>,
  garage: Garage | null = acceptGarage,
): FocusRideOptions {
  return {
    rideEventForItem: (row) => byId[row.id] ?? null,
    garage,
  }
}

describe("agendaDayBucketForStartsAt", () => {
  it("matches groupAgendaByDay boundaries", () => {
    const { tomorrowStart, dayAfterTomorrowStart, weekEnd } = agendaDayBoundaries(now)
    expect(agendaDayBucketForStartsAt(localIso(2026, 8, 15, 18), now)).toBe("today")
    expect(agendaDayBucketForStartsAt(tomorrowStart, now)).toBe("tomorrow")
    expect(agendaDayBucketForStartsAt(dayAfterTomorrowStart, now)).toBe("this-week")
    expect(agendaDayBucketForStartsAt(weekEnd, now)).toBe("later")
    expect(agendaDayBucketForStartsAt("not-a-date", now)).toBe("later")
  })
})

describe("focusItemNeedsDecision", () => {
  it("includes pending coverage confirm for the signed-in adult", () => {
    const pending = item({
      id: "pending",
      startsAt: localIso(2026, 8, 15, 18),
      coverages: [
        {
          id: "c1",
          coveringAdultId: adultId,
          coveringAdultDisplayName: null,
          assignedByAdultId: "other",
          kidIds: ["k1"],
          status: "PENDING",
        },
      ],
    })
    expect(focusItemNeedsDecision(pending, adultId)).toBe(true)
    expect(focusItemNeedsDecision(pending, "other-adult")).toBe(false)
  })

  it("includes eligible pending ride accept and excludes own PENDING", () => {
    const calm = item({ id: "calm", startsAt: localIso(2026, 8, 15, 18) })
    const ask = rideAsk()
    expect(focusItemNeedsDecision(calm, adultId, ask)).toBe(true)
    expect(focusItemNeedsFamilyDecision(calm, adultId)).toBe(false)
    expect(focusItemNeedsDecision(calm, adultId, null)).toBe(false)
  })

  it("treats ACCEPTED own-ride kids as not a family coverage gap", () => {
    const uncovered = item({
      id: "covered-by-ride",
      startsAt: localIso(2026, 8, 15, 18),
      uncoveredKidIds: ["k1"],
    })
    const accepted = rideAsk({
      status: "ACCEPTED",
      kidIds: ["k1"],
      acceptingCircleName: "Sharks Family",
    })
    expect(focusItemNeedsFamilyDecision(uncovered, adultId, accepted)).toBe(false)
    expect(focusItemNeedsDecision(uncovered, adultId, null, accepted)).toBe(false)

    const pending = rideAsk({ status: "PENDING", kidIds: ["k1"] })
    expect(focusItemNeedsFamilyDecision(uncovered, adultId, pending)).toBe(true)

    const mixed = item({
      id: "mixed",
      startsAt: localIso(2026, 8, 15, 18),
      uncoveredKidIds: ["k1", "k2"],
    })
    expect(
      focusItemNeedsFamilyDecision(
        mixed,
        adultId,
        rideAsk({ status: "ACCEPTED", kidIds: ["k1"] }),
      ),
    ).toBe(true)
  })
})

describe("selectFocusItem", () => {
  it("picks the earliest today decision over a calmer earlier today item", () => {
    const calmEarly = item({
      id: "calm",
      startsAt: localIso(2026, 8, 15, 16),
    })
    const uncoveredLater = item({
      id: "uncovered",
      startsAt: localIso(2026, 8, 15, 17),
      uncoveredKidIds: ["k1"],
    })
    expect(selectFocusItem([calmEarly, uncoveredLater], now, adultId)?.id).toBe("uncovered")

    const conflictedLater = item({
      id: "conflicted",
      startsAt: localIso(2026, 8, 15, 17),
      conflicts: [conflict],
    })
    expect(selectFocusItem([calmEarly, conflictedLater], now, adultId)?.id).toBe("conflicted")
  })

  it("does not treat ACCEPTED own-ride gap clearance as a family decision", () => {
    const calmEarly = item({
      id: "calm",
      startsAt: localIso(2026, 8, 15, 16),
    })
    const rideCovered = item({
      id: "ride-covered",
      startsAt: localIso(2026, 8, 15, 17),
      uncoveredKidIds: ["k1"],
    })
    const options = rideOptionsFor({
      "ride-covered": rideEvent({
        ownRequest: rideAsk({
          status: "ACCEPTED",
          kidIds: ["k1"],
          acceptingCircleName: "Sharks Family",
        }),
        otherRequests: [],
      }),
    })
    expect(selectFocusItem([calmEarly, rideCovered], now, adultId, options)?.id).toBe("calm")
  })

  it("prefers tomorrow decisions over all-set today", () => {
    const todayCalm = item({
      id: "today",
      startsAt: localIso(2026, 8, 15, 18),
    })
    const tomorrowUncovered = item({
      id: "tomorrow",
      startsAt: localIso(2026, 8, 16, 10),
      uncoveredKidIds: ["k1"],
    })
    expect(selectFocusItem([todayCalm, tomorrowUncovered], now, adultId)?.id).toBe("tomorrow")
  })

  it("prefers pending confirm today over an earlier all-set item today", () => {
    const calmEarly = item({
      id: "calm",
      startsAt: localIso(2026, 8, 15, 16),
    })
    const pendingLater = item({
      id: "pending",
      startsAt: localIso(2026, 8, 15, 18),
      coverages: [
        {
          id: "c1",
          coveringAdultId: adultId,
          coveringAdultDisplayName: "Alex",
          assignedByAdultId: "other",
          kidIds: ["k1"],
          status: "PENDING",
        },
      ],
    })
    expect(selectFocusItem([calmEarly, pendingLater], now, adultId)?.id).toBe("pending")
  })

  it("prefers pending confirm tomorrow over all-set today", () => {
    const todayCalm = item({
      id: "today",
      startsAt: localIso(2026, 8, 15, 18),
    })
    const tomorrowPending = item({
      id: "tomorrow-pending",
      startsAt: localIso(2026, 8, 16, 10),
      coverages: [
        {
          id: "c1",
          coveringAdultId: adultId,
          coveringAdultDisplayName: "Alex",
          assignedByAdultId: "other",
          kidIds: ["k1"],
          status: "PENDING",
        },
      ],
    })
    expect(selectFocusItem([todayCalm, tomorrowPending], now, adultId)?.id).toBe(
      "tomorrow-pending",
    )
  })

  it("does not prefer pending confirm for someone else", () => {
    const todayCalm = item({
      id: "today",
      startsAt: localIso(2026, 8, 15, 18),
    })
    const tomorrowPendingOther = item({
      id: "tomorrow-other",
      startsAt: localIso(2026, 8, 16, 10),
      coverages: [
        {
          id: "c1",
          coveringAdultId: "other-adult",
          coveringAdultDisplayName: "Jordan",
          assignedByAdultId: adultId,
          kidIds: ["k1"],
          status: "PENDING",
        },
      ],
    })
    expect(selectFocusItem([todayCalm, tomorrowPendingOther], now, adultId)?.id).toBe("today")
  })

  it("prefers all-set today over pending confirm rest-of-week", () => {
    const todayCalm = item({
      id: "today",
      startsAt: localIso(2026, 8, 15, 18),
    })
    const fridayPending = item({
      id: "friday-pending",
      startsAt: localIso(2026, 8, 21, 10),
      coverages: [
        {
          id: "c1",
          coveringAdultId: adultId,
          coveringAdultDisplayName: "Alex",
          assignedByAdultId: "other",
          kidIds: ["k1"],
          status: "PENDING",
        },
      ],
    })
    expect(selectFocusItem([todayCalm, fridayPending], now, adultId)?.id).toBe("today")
  })

  it("prefers all-set tonight over uncovered far in the future", () => {
    const tonight = item({
      id: "tonight",
      startsAt: localIso(2026, 8, 15, 18),
    })
    const farUncovered = item({
      id: "far",
      startsAt: localIso(2026, 9, 15, 10),
      uncoveredKidIds: ["k1"],
    })
    expect(selectFocusItem([tonight, farUncovered], now, adultId)?.id).toBe("tonight")
  })

  it("prefers all-set today over uncovered rest-of-week", () => {
    const todayCalm = item({
      id: "today",
      startsAt: localIso(2026, 8, 15, 18),
    })
    const fridayUncovered = item({
      id: "friday",
      startsAt: localIso(2026, 8, 21, 10),
      uncoveredKidIds: ["k1"],
    })
    expect(selectFocusItem([todayCalm, fridayUncovered], now, adultId)?.id).toBe("today")
  })

  it("never selects an all-RSVP-No item", () => {
    const allNo = item({
      id: "no",
      startsAt: localIso(2026, 8, 15, 16),
      rsvps: [{ kidId: "k1", status: "NO" }],
      uncoveredKidIds: ["k1"],
    })
    const attending = item({
      id: "yes",
      startsAt: localIso(2026, 8, 15, 17),
    })
    expect(selectFocusItem([allNo, attending], now, adultId)?.id).toBe("yes")
    expect(selectFocusItem([allNo], now, adultId)).toBeNull()
  })

  it("returns null for an empty agenda", () => {
    expect(selectFocusItem([], now, adultId)).toBeNull()
  })

  it("returns the earliest item when every attending item is covered", () => {
    const first = item({ id: "first", startsAt: localIso(2026, 8, 15, 16) })
    const second = item({ id: "second", startsAt: localIso(2026, 8, 15, 17) })
    expect(selectFocusItem([first, second], now, adultId)?.id).toBe("first")
  })

  it("returns rest-of-week uncovered when it is the only in-play item", () => {
    const fridayUncovered = item({
      id: "friday",
      startsAt: localIso(2026, 8, 21, 10),
      uncoveredKidIds: ["k1"],
    })
    expect(selectFocusItem([fridayUncovered], now, adultId)?.id).toBe("friday")
  })

  it("prefers tomorrow eligible ride accept over all-set today", () => {
    const todayCalm = item({ id: "today", startsAt: localIso(2026, 8, 15, 18) })
    const tomorrowAsk = item({ id: "tomorrow-ask", startsAt: localIso(2026, 8, 16, 10) })
    const options = rideOptionsFor({
      "tomorrow-ask": rideEvent({ otherRequests: [rideAsk({ id: "ask-tmr" })] }),
    })
    expect(selectFocusItem([todayCalm, tomorrowAsk], now, adultId, options)?.id).toBe(
      "tomorrow-ask",
    )
  })

  it("does not let rest-of-week ride accept beat all-set today", () => {
    const todayCalm = item({ id: "today", startsAt: localIso(2026, 8, 15, 18) })
    const fridayAsk = item({ id: "friday-ask", startsAt: localIso(2026, 8, 21, 10) })
    const options = rideOptionsFor({
      "friday-ask": rideEvent({ otherRequests: [rideAsk({ id: "ask-fri" })] }),
    })
    expect(selectFocusItem([todayCalm, fridayAsk], now, adultId, options)?.id).toBe("today")
  })

  it("prefers later uncovered over earlier ride ask today (family-before-community)", () => {
    const rideAt4 = item({ id: "ride-4", startsAt: localIso(2026, 8, 15, 16) })
    const uncoveredAt5 = item({
      id: "uncovered-5",
      startsAt: localIso(2026, 8, 15, 17),
      uncoveredKidIds: ["k1"],
    })
    const options = rideOptionsFor({
      "ride-4": rideEvent({ otherRequests: [rideAsk({ id: "ask-4" })] }),
    })
    expect(selectFocusItem([rideAt4, uncoveredAt5], now, adultId, options)?.id).toBe(
      "uncovered-5",
    )
  })

  it("prefers earlier uncovered over later ride ask today", () => {
    const uncoveredAt4 = item({
      id: "uncovered-4",
      startsAt: localIso(2026, 8, 15, 16),
      uncoveredKidIds: ["k1"],
    })
    const rideAt5 = item({ id: "ride-5", startsAt: localIso(2026, 8, 15, 17) })
    const options = rideOptionsFor({
      "ride-5": rideEvent({ otherRequests: [rideAsk({ id: "ask-5" })] }),
    })
    expect(selectFocusItem([uncoveredAt4, rideAt5], now, adultId, options)?.id).toBe(
      "uncovered-4",
    )
  })

  it("selects today eligible ride ask when coverage is all-set", () => {
    const calmEarly = item({ id: "calm", startsAt: localIso(2026, 8, 15, 15) })
    const rideAskItem = item({ id: "ride", startsAt: localIso(2026, 8, 15, 16) })
    const options = rideOptionsFor({
      ride: rideEvent({ otherRequests: [rideAsk()] }),
    })
    expect(selectFocusItem([calmEarly, rideAskItem], now, adultId, options)?.id).toBe("ride")
  })

  it("does not treat own PENDING ride as a Focus decision", () => {
    const calmEarly = item({ id: "calm", startsAt: localIso(2026, 8, 15, 15) })
    const ownPending = item({ id: "own-pending", startsAt: localIso(2026, 8, 15, 16) })
    const options = rideOptionsFor({
      "own-pending": rideEvent({
        ownRequest: rideAsk({ id: "own", status: "PENDING" }),
        otherRequests: [],
      }),
    })
    expect(selectFocusItem([calmEarly, ownPending], now, adultId, options)?.id).toBe("calm")
  })

  it("does not treat a passed ask as a Focus decision", () => {
    const calmEarly = item({ id: "calm", startsAt: localIso(2026, 8, 15, 15) })
    const passedAsk = item({ id: "passed", startsAt: localIso(2026, 8, 15, 16) })
    const options = rideOptionsFor({
      passed: rideEvent({
        otherRequests: [rideAsk({ id: "ask", passedByMe: true })],
      }),
    })
    expect(selectFocusItem([calmEarly, passedAsk], now, adultId, options)?.id).toBe("calm")
  })
})
