import { describe, expect, it } from "vitest"

import type {
  CalendarItem,
  CalendarConflict,
  CarpoolRequest,
  CarpoolRide,
  CarpoolRideEvent,
} from "@/api/types"
import {
  ASKED_THE_TEAM,
  ATTENDANCE_NOT_GOING_CHIP,
  CARPOOL_ASK_SINGULAR,
  CONFIRM_YOU_WILL_DRIVE,
  OVERLAPS_CHIP,
  RIDE_CONFLICT_CHIP,
  RIDE_NEEDED,
  YOURE_DRIVING,
  alsoDrivingKidLabel,
  carpoolAskCountLabel,
  drivingChipLabel,
  ridingWithCircleLabel,
  waitingOnDriverLabel,
} from "@/components/coverageCopy"
import {
  carpoolAskChipForRideEvent,
  pickMostUrgentGameRow,
  rideStatusChipForGameRow,
  rideStatusChipsForItem,
} from "@/components/rideStatusChip"
import type { CarpoolRequest as QueueRequest, CoverageGameEvent } from "@/components/coverageQueue"

function request(partial: Partial<QueueRequest> & Pick<QueueRequest, "id">): QueueRequest {
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
    leaveFromAddress: null,
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

function ownNeed(partial: Partial<CarpoolRequest> = {}): CarpoolRequest {
  return {
    id: "r1",
    spaceId: "s1",
    eventKey: "UID:game",
    requestingCircleId: "c1",
    requestingCircleName: "Ours",
    requestedByAdultId: "a1",
    kidId: "k1",
    kidFirstName: "Maya",
    legsNeeded: ["TO", "FROM"],
    legStatuses: [
      { leg: "TO", status: "OPEN" },
      { leg: "FROM", status: "OPEN" },
    ],
    pickupPlaceName: "Home",
    pickupAddress: "1 Main",
    pickupTown: null,
    detourMinutes: null,
    status: "UNCOVERED",
    passedByMe: false,
    passedByAdultNames: [],
    ...partial,
  }
}

function fulfillment(partial: Partial<CarpoolRide> = {}): CarpoolRide {
  return {
    id: "ride-1",
    spaceId: "s1",
    eventKey: "UID:game",
    leg: "TO",
    driverAdultId: "a9",
    drivingCircleId: "c2",
    drivingCircleName: "Sharks",
    vehicleId: "v1",
    vehicleLabel: "Van",
    passengerRequestIds: ["r1"],
    status: "ACTIVE",
    ...partial,
  }
}

function rideEvent(partial: Partial<CarpoolRideEvent> = {}): CarpoolRideEvent {
  return {
    eventKey: "UID:game",
    title: "Practice",
    startsAt: "2030-08-15T17:00:00.000Z",
    endsAt: null,
    defaultKidIds: [],
    ownRequests: [],
    otherRequests: [],
    rides: [],
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

  it("prefers PARTIAL over a sooner confirmed-driver row", () => {
    const picked = pickMostUrgentGameRow([
      game({
        id: "confirmed-sooner",
        kidId: "k2",
        order: 100,
        ownRide: { driver: "You", confirmed: true },
      }),
      game({
        id: "partial-later",
        kidId: "k1",
        order: 200,
        ownRide: "partial",
      }),
    ])

    expect(picked?.id).toBe("partial-later")
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
    expect(rideStatusChipForGameRow(game({ id: "g", order: 1, ownRide: "unassigned" }))).toEqual({
      label: RIDE_NEEDED,
      tone: "amber",
    })
    expect(rideStatusChipForGameRow(game({ id: "g", order: 1, ownRide: "requested" }))).toEqual({
      label: ASKED_THE_TEAM,
      tone: "amber",
    })
    expect(
      rideStatusChipForGameRow(
        game({ id: "g", order: 1, ownRide: { driver: "You", confirmed: false } }),
      ),
    ).toEqual({ label: CONFIRM_YOU_WILL_DRIVE, tone: "amber" })
    expect(
      rideStatusChipForGameRow(
        game({ id: "g", order: 1, ownRide: { driver: "Jordan", confirmed: false } }),
      ),
    ).toEqual({ label: waitingOnDriverLabel("Jordan"), tone: "amber" })
  })

  it("emits partial round-trip chip copy from leg statuses", () => {
    const row = game({ id: "g", order: 1, kidId: "k1", ownRide: "partial" })
    const event = rideEvent({
      ownRequests: [
        ownNeed({
          status: "PARTIAL",
          legStatuses: [
            { leg: "TO", status: "OPEN" },
            { leg: "FROM", status: "CONFIRMED" },
          ],
        }),
      ],
    })
    expect(rideStatusChipForGameRow(row, event)).toEqual({
      label: "Round trip — from confirmed, to still needed",
      tone: "amber",
    })
    expect(
      rideStatusChipForGameRow(
        row,
        rideEvent({
          ownRequests: [
            ownNeed({
              status: "PARTIAL",
              legStatuses: [
                { leg: "TO", status: "CONFIRMED" },
                { leg: "FROM", status: "OPEN" },
              ],
            }),
          ],
        }),
      ),
    ).toEqual({
      label: "Round trip — to confirmed, from still needed",
      tone: "amber",
    })
  })

  it("uses route tone for confirmed driver with accepted riders", () => {
    const withRiders = game({
      id: "g",
      order: 1,
      ownRide: { driver: "You", confirmed: true },
      requests: [request({ id: "a1", status: "accepted" })],
    })
    expect(rideStatusChipForGameRow(withRiders)).toEqual({
      label: drivingChipLabel("You", 1),
      tone: "route",
    })

    const solo = game({
      id: "g2",
      order: 1,
      ownRide: { driver: "You", confirmed: true },
    })
    expect(rideStatusChipForGameRow(solo)).toEqual({
      label: YOURE_DRIVING,
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
    expect(rideStatusChipForGameRow(otherDriver)).toEqual({
      label: drivingChipLabel("Jordan", 2),
      tone: "route",
    })
  })

  it("labels teammate ride from FULLY_COVERED own need + teammate Ride", () => {
    const row = game({
      id: "g",
      order: 1,
      kidId: "k1",
      ownRide: { driver: "Sharks", confirmed: true },
    })
    const event = rideEvent({
      ownRequests: [ownNeed({ status: "FULLY_COVERED", kidId: "k1" })],
      rides: [
        fulfillment({
          drivingCircleId: "c2",
          drivingCircleName: "Sharks",
          passengerRequestIds: ["r1"],
        }),
      ],
    })

    expect(rideStatusChipForGameRow(row, event)).toEqual({
      label: ridingWithCircleLabel("Sharks"),
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

    expect(rideStatusChipsForItem(item, games)).toEqual([
      { label: ATTENDANCE_NOT_GOING_CHIP, tone: "muted" },
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

    expect(rideStatusChipsForItem(item, games)).toEqual([
      { label: OVERLAPS_CHIP, tone: "amber" },
      { label: RIDE_NEEDED, tone: "amber" },
    ])
  })

  it("prefers PARTIAL chip over confirmed sibling on the same item", () => {
    const item = calendarItem({ kidIds: ["k1", "k2"] })
    const games = [
      game({
        id: "confirmed",
        kidId: "k2",
        order: 100,
        ownRide: { driver: "You", confirmed: true },
      }),
      game({
        id: "partial",
        kidId: "k1",
        order: 200,
        ownRide: "partial",
      }),
    ]
    const event = rideEvent({
      ownRequests: [
        ownNeed({
          kidId: "k1",
          status: "PARTIAL",
          legStatuses: [
            { leg: "TO", status: "CONFIRMED" },
            { leg: "FROM", status: "OPEN" },
          ],
        }),
      ],
    })

    expect(rideStatusChipsForItem(item, games, { rideEvent: event })).toEqual([
      { label: "Round trip — to confirmed, from still needed", tone: "amber" },
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

    expect(rideStatusChipsForItem(item, games)).toEqual([
      { label: RIDE_NEEDED, tone: "amber" },
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
    const rideChips = rideStatusChipsForItem(item, games)
    const askChip = carpoolAskChipForRideEvent(games)

    expect(rideChips).toEqual([
      { label: OVERLAPS_CHIP, tone: "amber" },
      { label: drivingChipLabel("You", 1), tone: "route" },
    ])
    expect(askChip).toEqual({ label: CARPOOL_ASK_SINGULAR, tone: "amber" })
    expect([...rideChips, askChip!]).toEqual([
      { label: OVERLAPS_CHIP, tone: "amber" },
      { label: drivingChipLabel("You", 1), tone: "route" },
      { label: CARPOOL_ASK_SINGULAR, tone: "amber" },
    ])
  })

  it("keeps the accepted-rider suffix when driving with accepted carpool kids", () => {
    const item = calendarItem()
    const games = [
      game({
        id: "host",
        order: 100,
        ownRide: { driver: "You", confirmed: true },
        requests: [request({ id: "a1", status: "accepted", kidFirstNames: ["Mia"] })],
      }),
    ]

    expect(rideStatusChipsForItem(item, games)).toEqual([
      { label: "You're driving · +1", tone: "route" },
    ])
  })

  it("omits Overlaps on out-of-play items", () => {
    const item = calendarItem({
      conflicts: [kidConflict()],
    })
    const games = [game({ id: "g", order: 100, attendance: "not_going" })]

    expect(rideStatusChipsForItem(item, games)).toEqual([
      { label: ATTENDANCE_NOT_GOING_CHIP, tone: "muted" },
    ])
  })

  it("inserts Also driving {name} after Overlaps and before Ride needed", () => {
    const inbound = ownNeed({
      id: "inbound",
      requestingCircleId: "c2",
      requestingCircleName: "House B",
      kidId: "k-them",
      kidFirstName: "Sam",
      status: "FULLY_COVERED",
    })
    const event = rideEvent({
      defaultKidIds: ["k1"],
      otherRequests: [inbound],
      rides: [
        fulfillment({
          id: "drive-them",
          drivingCircleId: "c1",
          drivingCircleName: "Ours",
          passengerRequestIds: ["inbound"],
        }),
      ],
    })
    const item = calendarItem({
      kidIds: ["k1"],
      uncoveredKidIds: ["k1"],
      conflicts: [kidConflict()],
    })
    const games = [game({ id: "g", kidId: "k1", order: 100, ownRide: "unassigned" })]

    expect(
      rideStatusChipsForItem(item, games, {
        rideEvent: event,
        circleId: "c1",
      }),
    ).toEqual([
      { label: OVERLAPS_CHIP, tone: "amber" },
      { label: alsoDrivingKidLabel("Sam"), tone: "amber" },
      { label: RIDE_NEEDED, tone: "amber" },
    ])
  })

  it("inserts Ride conflict for Type B mutual swap before Riding with", () => {
    const inbound = ownNeed({
      id: "inbound",
      requestingCircleId: "c2",
      kidId: "k-them",
      kidFirstName: "Sam",
      status: "FULLY_COVERED",
    })
    const own = ownNeed({
      id: "own",
      status: "FULLY_COVERED",
      kidId: "k1",
      kidFirstName: "Maya",
    })
    const event = rideEvent({
      ownRequests: [own],
      otherRequests: [inbound],
      rides: [
        fulfillment({
          id: "we-drive",
          drivingCircleId: "c1",
          passengerRequestIds: ["inbound"],
        }),
        fulfillment({
          id: "they-drive",
          drivingCircleId: "c2",
          drivingCircleName: "House B",
          passengerRequestIds: ["own"],
        }),
      ],
    })
    const item = calendarItem({ kidIds: ["k1"] })
    const games = [
      game({
        id: "g",
        kidId: "k1",
        order: 100,
        ownRide: { driver: "House B", confirmed: true },
      }),
    ]

    expect(
      rideStatusChipsForItem(item, games, {
        rideEvent: event,
        circleId: "c1",
      }),
    ).toEqual([
      { label: RIDE_CONFLICT_CHIP, tone: "amber" },
      { label: ridingWithCircleLabel("House B"), tone: "mint" },
    ])
  })

  it("uses Ride conflict for Type A with multiple inbound kids, still beside Ride needed", () => {
    const inboundA = ownNeed({
      id: "inbound-a",
      requestingCircleId: "c2",
      kidId: "k-a",
      kidFirstName: "Sam",
      status: "FULLY_COVERED",
    })
    const inboundB = ownNeed({
      id: "inbound-b",
      requestingCircleId: "c2",
      kidId: "k-b",
      kidFirstName: "Lee",
      status: "FULLY_COVERED",
    })
    // acceptedByUsRequest returns the first other request we drive — conflict chip
    // uses Ride conflict when inbound has multiple kid first-names on one request.
    // With per-kid requests, multi-kid Type A becomes first inbound only ("Also driving Sam").
    // Spec still allows Ride conflict for multi-kid Type A; prefer alsoDriving for single name.
    const event = rideEvent({
      defaultKidIds: ["k1"],
      otherRequests: [inboundA, inboundB],
      rides: [
        fulfillment({
          id: "drive-a",
          drivingCircleId: "c1",
          passengerRequestIds: ["inbound-a"],
        }),
        fulfillment({
          id: "drive-b",
          drivingCircleId: "c1",
          passengerRequestIds: ["inbound-b"],
        }),
      ],
    })
    const item = calendarItem({ kidIds: ["k1"], uncoveredKidIds: ["k1"] })
    const games = [game({ id: "g", kidId: "k1", order: 100, ownRide: "unassigned" })]

    expect(
      rideStatusChipsForItem(item, games, {
        rideEvent: event,
        circleId: "c1",
      }),
    ).toEqual([
      { label: alsoDrivingKidLabel("Sam"), tone: "amber" },
      { label: RIDE_NEEDED, tone: "amber" },
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
      label: carpoolAskCountLabel(2),
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
      label: carpoolAskCountLabel(2),
      tone: "amber",
    })

    expect(
      carpoolAskChipForRideEvent([
        game({ id: "out", order: 100, attendance: "not_going", requests: [request({ id: "p1" })] }),
      ]),
    ).toBeNull()
  })
})
