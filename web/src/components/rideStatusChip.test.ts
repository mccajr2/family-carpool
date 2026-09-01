import { describe, expect, it } from "vitest"

import type { CalendarItem, CalendarConflict, CarpoolRide } from "@/api/types"
import {
  carpoolAskChipForRideEvent,
  pickMostUrgentGameRow,
  rideStatusChipForGameRow,
  rideStatusChipsForItem,
} from "@/components/rideStatusChip"
import type { CarpoolRequest, CoverageGameEvent } from "@/components/coverageQueue"

function request(partial: Partial<CarpoolRequest> & Pick<CarpoolRequest, "id">): CarpoolRequest {
  return {
    requestingCircleName: "House B",
    kidFirstNames: ["Mia"],
    seats: 1,
    pickupPlaceName: "Home",
    pickupAddress: "1 Main",
    pickupTown: null,
    detourMinutes: null,
    status: "pending",
    ...partial,
  }
}

function game(
  partial: Partial<CoverageGameEvent> & Pick<CoverageGameEvent, "id" | "order">,
): CoverageGameEvent {
  return {
    kidId: "k1",
    title: partial.id,
    startsAt: new Date(partial.order).toISOString(),
    attendance: "going",
    ownRide: "unassigned",
    requests: [],
    ...partial,
  }
}

function kidConflict(partial: Partial<CalendarConflict> = {}): CalendarConflict {
  return {
    type: "KID_TIME_OVERLAP",
    kidId: "k1",
    adultId: null,
    adultDisplayName: null,
    otherSource: "MANUAL",
    otherItemId: "other",
    otherTitle: "Game",
    otherStartsAt: "2030-08-15T17:30:00.000Z",
    ...partial,
  }
}

function calendarItem(partial: Partial<CalendarItem> = {}): CalendarItem {
  const kidIds = partial.kidIds ?? ["k1"]
  return {
    source: "MANUAL",
    id: "e1",
    title: "Practice",
    startsAt: "2030-08-15T17:00:00.000Z",
    endsAt: null,
    location: null,
    kidIds,
    feedId: null,
    feedName: null,
    eventKey: null,
    leaveFromPlaceId: null,
    leaveFromPlaceName: null,
    leaveByAt: null,
    leaveByStatus: "PENDING",
    leaveByReason: null,
    coverages: [],
    uncoveredKidIds: [],
    conflicts: [],
    rsvps: kidIds.map((kidId) => ({ kidId, status: "YES" as const })),
    ...partial,
  }
}

function ownRide(partial: Partial<CarpoolRide> = {}): CarpoolRide {
  return {
    id: "r1",
    spaceId: "s1",
    eventKey: "UID:game",
    requestingCircleId: "c1",
    requestingCircleName: "Ours",
    requestedByAdultId: "a1",
    kidIds: ["k1"],
    kidFirstNames: ["Maya"],
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

describe("pickMostUrgentGameRow", () => {
  it("prefers an own-ride gap over a sooner confirmed-driver row", () => {
    const picked = pickMostUrgentGameRow([
      game({
        id: "confirmed-sooner",
        kidId: "k2",
        order: 100,
        ownRide: { driver: "You", confirmed: true },
      }),
      game({
        id: "gap-later",
        kidId: "k1",
        order: 200,
        ownRide: "unassigned",
      }),
    ])

    expect(picked?.id).toBe("gap-later")
  })

  it("picks soonest in-play row when all are resolved", () => {
    const picked = pickMostUrgentGameRow([
      game({ id: "late", kidId: "k2", order: 200, ownRide: { driver: "Jordan", confirmed: true } }),
      game({ id: "early", kidId: "k1", order: 100, ownRide: { driver: "You", confirmed: true } }),
    ])

    expect(picked?.id).toBe("early")
  })
})

describe("rideStatusChipForGameRow", () => {
  it("maps own-ride states to label and tone", () => {
    expect(rideStatusChipForGameRow(game({ id: "g", order: 1, ownRide: "unassigned" }), null)).toEqual({
      label: "Ride needed",
      tone: "amber",
    })
    expect(rideStatusChipForGameRow(game({ id: "g", order: 1, ownRide: "requested" }), null)).toEqual({
      label: "Asked the team",
      tone: "amber",
    })
    expect(
      rideStatusChipForGameRow(
        game({ id: "g", order: 1, ownRide: { driver: "You", confirmed: false } }),
        null,
      ),
    ).toEqual({ label: "Confirm you'll drive", tone: "amber" })
    expect(
      rideStatusChipForGameRow(
        game({ id: "g", order: 1, ownRide: { driver: "Jordan", confirmed: false } }),
        null,
      ),
    ).toEqual({ label: "Waiting on Jordan", tone: "amber" })
  })

  it("uses route tone for confirmed driver with accepted riders", () => {
    const withRiders = game({
      id: "g",
      order: 1,
      ownRide: { driver: "You", confirmed: true },
      requests: [request({ id: "a1", status: "accepted" })],
    })
    expect(rideStatusChipForGameRow(withRiders, null)).toEqual({
      label: "You're driving · +1",
      tone: "route",
    })

    const solo = game({
      id: "g2",
      order: 1,
      ownRide: { driver: "You", confirmed: true },
    })
    expect(rideStatusChipForGameRow(solo, null)).toEqual({
      label: "You're driving",
      tone: "mint",
    })

    const otherDriver = game({
      id: "g3",
      order: 1,
      ownRide: { driver: "Jordan", confirmed: true },
      requests: [
        request({ id: "a1", status: "accepted" }),
        request({ id: "a2", status: "accepted" }),
      ],
    })
    expect(rideStatusChipForGameRow(otherDriver, null)).toEqual({
      label: "Jordan driving · +2",
      tone: "route",
    })
  })

  it("labels teammate ride from ACCEPTED ownRequest, not household driving", () => {
    const row = game({
      id: "g",
      order: 1,
      kidId: "k1",
      ownRide: { driver: "Sharks", confirmed: true },
    })
    const accepted = ownRide({
      status: "ACCEPTED",
      acceptingCircleName: "Sharks",
      kidIds: ["k1"],
    })

    expect(rideStatusChipForGameRow(row, accepted)).toEqual({
      label: "Riding with Sharks",
      tone: "mint",
    })
  })
})

describe("rideStatusChipsForItem", () => {
  it("returns only Not going when every kid is out-of-play", () => {
    const item = calendarItem()
    const games = [
      game({ id: "g1", kidId: "k1", order: 100, attendance: "not_going" }),
      game({ id: "g2", kidId: "k2", order: 100, attendance: "not_going" }),
    ]

    expect(rideStatusChipsForItem(item, games, null)).toEqual([
      { label: "Not going", tone: "muted" },
    ])
  })

  it("orders Overlaps before ride-status and picks most urgent kid row", () => {
    const item = calendarItem({
      kidIds: ["k1", "k2"],
      conflicts: [kidConflict()],
    })
    const games = [
      game({
        id: "confirmed",
        kidId: "k2",
        order: 100,
        ownRide: { driver: "You", confirmed: true },
      }),
      game({
        id: "gap",
        kidId: "k1",
        order: 200,
        ownRide: "unassigned",
      }),
    ]

    expect(rideStatusChipsForItem(item, games, null)).toEqual([
      { label: "Overlaps", tone: "amber" },
      { label: "Ride needed", tone: "amber" },
    ])
  })

  it("shows Ride needed when one kid is uncovered and another is confirmed driver", () => {
    const item = calendarItem({ kidIds: ["k1", "k2"] })
    const games = [
      game({
        id: "confirmed",
        kidId: "k2",
        order: 100,
        ownRide: { driver: "You", confirmed: true },
      }),
      game({
        id: "gap",
        kidId: "k1",
        order: 200,
        ownRide: "unassigned",
      }),
    ]

    expect(rideStatusChipsForItem(item, games, null)).toEqual([
      { label: "Ride needed", tone: "amber" },
    ])
  })

  it("composes overlaps, ride-status, and carpool ask in order", () => {
    const item = calendarItem({
      conflicts: [kidConflict()],
    })
    const games = [
      game({
        id: "host",
        order: 100,
        ownRide: { driver: "You", confirmed: true },
        requests: [request({ id: "p1" }), request({ id: "a1", status: "accepted" })],
      }),
    ]
    const rideChips = rideStatusChipsForItem(item, games, null)
    const askChip = carpoolAskChipForRideEvent(games)

    expect(rideChips).toEqual([
      { label: "Overlaps", tone: "amber" },
      { label: "You're driving · +1", tone: "route" },
    ])
    expect(askChip).toEqual({ label: "1 carpool ask", tone: "amber" })
    expect([...rideChips, askChip!]).toEqual([
      { label: "Overlaps", tone: "amber" },
      { label: "You're driving · +1", tone: "route" },
      { label: "1 carpool ask", tone: "amber" },
    ])
  })

  it("omits Overlaps on out-of-play items", () => {
    const item = calendarItem({
      conflicts: [kidConflict()],
    })
    const games = [game({ id: "g", order: 100, attendance: "not_going" })]

    expect(rideStatusChipsForItem(item, games, null)).toEqual([
      { label: "Not going", tone: "muted" },
    ])
  })
})

describe("carpoolAskChipForRideEvent", () => {
  it("counts actionable inbound pending requests once per event", () => {
    const sharedRequests = [
      request({ id: "p1" }),
      request({ id: "p2" }),
      request({ id: "passed", passedByMe: true }),
      request({ id: "auto", autoDeclined: true }),
    ]
    const games = [
      game({ id: "g1", kidId: "k1", order: 100, requests: sharedRequests }),
      game({ id: "g2", kidId: "k2", order: 100, requests: sharedRequests }),
    ]

    expect(carpoolAskChipForRideEvent(games)).toEqual({
      label: "2 carpool asks",
      tone: "amber",
    })
  })

  it("pluralizes multiple asks and skips out-of-play items", () => {
    const games = [
      game({
        id: "g",
        order: 100,
        requests: [request({ id: "p1" }), request({ id: "p2" })],
      }),
    ]
    expect(carpoolAskChipForRideEvent(games)).toEqual({
      label: "2 carpool asks",
      tone: "amber",
    })

    expect(
      carpoolAskChipForRideEvent([
        game({ id: "out", order: 100, attendance: "not_going", requests: [request({ id: "p1" })] }),
      ]),
    ).toBeNull()
  })
})
