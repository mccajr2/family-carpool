import { describe, expect, it } from "vitest"

import type { CalendarItem, CarpoolRide, CarpoolRideEvent, FamilyMember } from "@/api/types"
import {
  acceptedRiders,
  autoDeclineUnofferable,
  getQueue,
  isConfirmedDriver,
  isPendingHouseholdConfirm,
  isUnassigned,
  mapCalendarItemToCoverageGames,
  mapCalendarItemsToCoverageGames,
  pendingRequests,
  type CarpoolRequest,
  type CoverageGameEvent,
} from "@/components/coverageQueue"

function request(partial: Partial<CarpoolRequest> & Pick<CarpoolRequest, "id">): CarpoolRequest {
  return {
    requestingCircleName: "House B",
    kidFirstNames: ["Mia"],
    seats: 1,
    pickupPlaceName: "Home",
    pickupAddress: "1 Main",
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

const members: FamilyMember[] = [
  { adultId: "a1", email: "alex@example.com", displayName: "Alex", role: "ORGANIZER" },
  { adultId: "a2", email: "jordan@example.com", displayName: "Jordan", role: "CAREGIVER" },
]

const mapOptions = { currentAdultId: "a1", members }

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
    startsAt: "2030-08-15T17:00:00.000Z",
    endsAt: null,
    defaultKidIds: [],
    ownRequest: null,
    otherRequests: [],
    ...partial,
  }
}

describe("coverageQueue helpers", () => {
  it("classifies own-ride status variants", () => {
    expect(isUnassigned("unassigned")).toBe(true)
    expect(isUnassigned("requested")).toBe(false)
    expect(isPendingHouseholdConfirm({ driver: "Jordan", confirmed: false })).toBe(true)
    expect(isPendingHouseholdConfirm({ driver: "You", confirmed: true })).toBe(false)
    expect(isConfirmedDriver({ driver: "You", confirmed: true })).toBe(true)
    expect(isConfirmedDriver("requested")).toBe(false)
  })

  it("filters accepted and pending carpool requests on a game", () => {
    const event = game({
      id: "g1",
      order: 1,
      requests: [
        request({ id: "p1", status: "pending" }),
        request({ id: "a1", status: "accepted" }),
        request({ id: "d1", status: "declined" }),
      ],
    })
    expect(pendingRequests(event).map((row) => row.id)).toEqual(["p1"])
    expect(acceptedRiders(event).map((row) => row.id)).toEqual(["a1"])
  })
})

describe("getQueue", () => {
  it("ranks an own-ride gap ahead of a sooner pending carpool request", () => {
    const soonerRequest = game({
      id: "soon-ask",
      order: 100,
      ownRide: { driver: "You", confirmed: true },
      requests: [request({ id: "ask-sooner" })],
    })
    const laterGap = game({
      id: "later-gap",
      order: 200,
      ownRide: "unassigned",
    })

    const queue = getQueue([soonerRequest, laterGap])

    expect(queue).toHaveLength(2)
    expect(queue[0]).toMatchObject({ kind: "ownRide", game: { id: "later-gap" } })
    expect(queue[1]).toMatchObject({
      kind: "request",
      game: { id: "soon-ask" },
      request: { id: "ask-sooner" },
    })
  })

  it("excludes not_going games even when ownRide is unassigned", () => {
    const queue = getQueue([
      game({
        id: "out",
        order: 100,
        attendance: "not_going",
        ownRide: "unassigned",
        requests: [request({ id: "ask-1" })],
      }),
    ])

    expect(queue).toEqual([])
  })

  it("orders multiple own-ride gaps and requests soonest-first by order", () => {
    const games = [
      game({
        id: "gap-late",
        order: 300,
        ownRide: "unassigned",
      }),
      game({
        id: "gap-early",
        order: 100,
        ownRide: "requested",
      }),
      game({
        id: "resolved-with-ask",
        order: 150,
        ownRide: { driver: "You", confirmed: true },
        requests: [request({ id: "ask-mid" })],
      }),
      game({
        id: "resolved-with-ask-late",
        order: 250,
        ownRide: { driver: "You", confirmed: true },
        requests: [request({ id: "ask-late" })],
      }),
    ]

    const queue = getQueue(games)

    expect(queue.map((item) => item.kind + ":" + item.game.id)).toEqual([
      "ownRide:gap-early",
      "ownRide:gap-late",
      "request:resolved-with-ask",
      "request:resolved-with-ask-late",
    ])
  })

  it("returns an empty queue when every game is resolved", () => {
    const queue = getQueue([
      game({
        id: "done",
        order: 100,
        ownRide: { driver: "You", confirmed: true },
        requests: [request({ id: "ask-1", status: "declined" })],
      }),
    ])

    expect(queue).toEqual([])
  })

  it("skips passed and auto-declined pending requests", () => {
    const queue = getQueue([
      game({
        id: "host",
        order: 100,
        ownRide: { driver: "You", confirmed: true },
        requests: [
          request({ id: "passed", passedByMe: true }),
          request({ id: "auto", autoDeclined: true }),
          request({ id: "live" }),
        ],
      }),
    ])

    expect(queue).toHaveLength(1)
    expect(queue[0]).toMatchObject({ kind: "request", request: { id: "live" } })
  })
})

describe("autoDeclineUnofferable", () => {
  it("declines pending requests only when ownRide is requested", () => {
    const games = [
      game({
        id: "requested",
        order: 1,
        ownRide: "requested",
        requests: [
          request({ id: "keep-accepted", status: "accepted" }),
          request({ id: "decline-me" }),
        ],
      }),
    ]

    const [updated] = autoDeclineUnofferable(games)

    expect(updated?.requests).toEqual([
      expect.objectContaining({ id: "keep-accepted", status: "accepted" }),
      expect.objectContaining({
        id: "decline-me",
        status: "declined",
        autoDeclined: true,
      }),
    ])
  })

  it("leaves pending requests untouched for unassigned own rides", () => {
    const games = [
      game({
        id: "gap",
        order: 1,
        ownRide: "unassigned",
        requests: [request({ id: "still-pending" })],
      }),
    ]

    expect(autoDeclineUnofferable(games)).toEqual(games)
  })

  it("leaves pending requests untouched for pending household confirm", () => {
    const games = [
      game({
        id: "waiting",
        order: 1,
        ownRide: { driver: "Jordan", confirmed: false },
        requests: [request({ id: "still-pending" })],
      }),
    ]

    expect(autoDeclineUnofferable(games)).toEqual(games)
  })
})

describe("mapCalendarItemToCoverageGames", () => {
  it("maps RSVP values to attendance and per-kid ownRide states", () => {
    const item = calendarItem({
      kidIds: ["k1", "k2"],
      rsvps: [
        { kidId: "k1", status: "YES" },
        { kidId: "k2", status: "NO" },
      ],
      uncoveredKidIds: ["k1"],
    })

    const rows = mapCalendarItemToCoverageGames(item, null, mapOptions)

    expect(rows).toHaveLength(2)
    expect(rows[0]).toMatchObject({
      id: "MANUAL-e1:k1",
      kidId: "k1",
      attendance: "going",
      ownRide: "unassigned",
    })
    expect(rows[1]).toMatchObject({
      id: "MANUAL-e1:k2",
      kidId: "k2",
      attendance: "not_going",
    })
  })

  it("maps pending household confirm and requested own rides from API shapes", () => {
    const pendingConfirm = mapCalendarItemToCoverageGames(
      calendarItem({
        coverages: [
          {
            id: "c1",
            coveringAdultId: "a2",
            coveringAdultDisplayName: null,
            assignedByAdultId: "a1",
            kidIds: ["k1"],
            status: "PENDING",
          },
        ],
      }),
      null,
      mapOptions,
    )
    expect(pendingConfirm[0]?.ownRide).toEqual({ driver: "Jordan", confirmed: false })

    const selfConfirmed = mapCalendarItemToCoverageGames(
      calendarItem({
        coverages: [
          {
            id: "c-self",
            coveringAdultId: "a1",
            coveringAdultDisplayName: "Alex",
            assignedByAdultId: "a1",
            kidIds: ["k1"],
            status: "CONFIRMED",
          },
        ],
      }),
      null,
      mapOptions,
    )
    expect(selfConfirmed[0]?.ownRide).toEqual({ driver: "You", confirmed: true })

    const requested = mapCalendarItemToCoverageGames(
      calendarItem({ uncoveredKidIds: ["k1"] }),
      rideEvent({ ownRequest: ownRide({ status: "PENDING" }) }),
      mapOptions,
    )
    expect(requested[0]?.ownRide).toBe("requested")

    const riding = mapCalendarItemToCoverageGames(
      calendarItem(),
      rideEvent({
        ownRequest: ownRide({
          status: "ACCEPTED",
          acceptingCircleName: "Sharks",
        }),
      }),
      mapOptions,
    )
    expect(riding[0]?.ownRide).toEqual({ driver: "Sharks", confirmed: true })
  })

  it("maps inbound otherRequests onto each kid row", () => {
    const rows = mapCalendarItemToCoverageGames(
      calendarItem({ kidIds: ["k1", "k2"] }),
      rideEvent({
        otherRequests: [
          ownRide({
            id: "ask-1",
            requestingCircleName: "House B",
            status: "PENDING",
          }),
        ],
      }),
      mapOptions,
    )

    expect(rows[0]?.requests).toHaveLength(1)
    expect(rows[1]?.requests).toEqual(rows[0]?.requests)
    expect(rows[0]?.requests[0]).toMatchObject({
      id: "ask-1",
      status: "pending",
      requestingCircleName: "House B",
    })
  })

  it("batch mapper joins items through rideEventForItem", () => {
    const early = calendarItem({ id: "early", startsAt: "2030-08-15T16:00:00.000Z" })
    const late = calendarItem({
      id: "late",
      startsAt: "2030-08-15T18:00:00.000Z",
      uncoveredKidIds: ["k1"],
    })

    const games = mapCalendarItemsToCoverageGames(
      [late, early],
      (item) =>
        item.id === "late"
          ? rideEvent({
              otherRequests: [
                ownRide({ id: "ask-late", requestingCircleName: "House B", status: "PENDING" }),
              ],
            })
          : null,
      mapOptions,
    )

    const queue = getQueue(games)
    expect(queue[0]).toMatchObject({ kind: "ownRide", game: { id: "MANUAL-late:k1" } })
    expect(queue[1]).toMatchObject({
      kind: "request",
      request: { id: "ask-late" },
    })
  })
})
