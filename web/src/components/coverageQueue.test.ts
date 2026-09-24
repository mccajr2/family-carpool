import { describe, expect, it } from "vitest"

import type { CalendarItem, CarpoolRide, CarpoolRideEvent, FamilyMember } from "@/api/types"
import {
  acceptedRiderKidCount,
  acceptedRiders,
  applyAutoDeclinedViewModel,
  autoDeclineUnofferable,
  coverageGameEventKey,
  filterQueueWithinHorizon,
  getQueue,
  hasNeedsRideOwnLeg,
  isConfirmedDriver,
  isOwnRideGap,
  isPendingHouseholdConfirm,
  isUnassigned,
  mapCalendarItemToCoverageGames,
  mapCalendarItemsToCoverageGames,
  pendingRequests,
  type CarpoolRequest,
  type CoverageGameEvent,
} from "@/components/coverageQueue"
import { carpoolLeg, carpoolLegsBoth } from "@/api/carpoolLegs"

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
    leaveFromAddress: null,
    leaveByAt: null,
    leaveByStatus: "PENDING",
    leaveByReason: null,
    coverages: [],
    uncoveredKidIds: [],
    conflicts: [],
    rsvps: kidIds.map((kidId) => ({ kidId, status: "YES" as const })),
    driveBlockLinks: [],
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
    ...partial,
    legs: partial.legs ?? carpoolLegsBoth(partial.status === "ACCEPTED" ? "CONFIRMED" : "ASKED_TEAM"),
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
    ownRequests: partial.ownRequests ?? (partial.ownRequest != null ? [partial.ownRequest] : []),
    ownLegs: partial.ownLegs ?? carpoolLegsBoth("NEEDS_RIDE"),
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

  it("counts accepted rider kids across multi-kid asks", () => {
    const event = game({
      id: "g1",
      order: 1,
      requests: [
        request({
          id: "edelman",
          status: "accepted",
          kidFirstNames: ["Luke", "Graham"],
          seats: 2,
        }),
        request({
          id: "sharks",
          status: "accepted",
          kidFirstNames: ["Apollo"],
          seats: 1,
        }),
      ],
    })
    expect(acceptedRiderKidCount(event)).toBe(3)
  })
})

describe("coverageGameEventKey", () => {
  it("strips the kid suffix from a coverage game id", () => {
    expect(coverageGameEventKey("MANUAL-e1:k1")).toBe("MANUAL-e1")
  })
})

describe("getQueue", () => {
  it("ranks a same-event ask ahead of a later own-ride gap (event-grouped)", () => {
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
    expect(queue[0]).toMatchObject({
      kind: "request",
      game: { id: "soon-ask" },
      request: { id: "ask-sooner" },
    })
    expect(queue[1]).toMatchObject({ kind: "ownRide", game: { id: "later-gap" } })
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

  it("keeps separate own-ride decisions — never merges two gaps into one queue item", () => {
    // day-block-agenda: Agenda may collapse combined events to one card; Focus
    // queue cardinality stays one decision per attention item.
    const queue = getQueue([
      game({ id: "FEED-drive-a:k1", order: 100, ownRide: "unassigned" }),
      game({ id: "FEED-drive-b:k1", order: 200, ownRide: "unassigned" }),
    ])
    expect(queue).toHaveLength(2)
    expect(queue.map((item) => item.game.id)).toEqual([
      "FEED-drive-a:k1",
      "FEED-drive-b:k1",
    ])
  })

  it("orders by event soonest-first: asks on earlier events before later own gaps", () => {
    const games = [
      game({
        id: "gap-late",
        order: 300,
        ownRide: "unassigned",
      }),
      game({
        id: "asked-team",
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
      "request:resolved-with-ask",
      "request:resolved-with-ask-late",
      "ownRide:gap-late",
    ])
  })

  it("queues unassigned and pending-for-self only — not asked-team or waiting on others", () => {
    const queue = getQueue([
      game({ id: "unassigned", order: 100, ownRide: "unassigned" }),
      game({ id: "asked-team", order: 110, ownRide: "requested" }),
      game({
        id: "wait-jordan",
        order: 120,
        ownRide: { driver: "Jordan", confirmed: false },
      }),
      game({
        id: "confirm-you",
        order: 130,
        ownRide: { driver: "You", confirmed: false },
      }),
    ])

    expect(queue.map((item) => item.game.id)).toEqual(["unassigned", "confirm-you"])
  })

  it("collapses standing-locked pending household confirms to one queue item per template", () => {
    const week1 = game({
      id: "FEED-w1:k1",
      order: 100,
      ownRide: { driver: "You", confirmed: false },
      standingBlockTemplateId: "tmpl-standing",
      ownLegs: [
        carpoolLeg("TO", "CONFIRMED", { assigneeAdultId: "a2", assigneeDisplayName: "Jason" }),
        carpoolLeg("FROM", "WAITING_HOUSEHOLD", {
          assigneeAdultId: "a1",
          assigneeDisplayName: "Katy",
        }),
      ],
    })
    const week2 = game({
      id: "FEED-w2:k1",
      order: 200,
      ownRide: { driver: "You", confirmed: false },
      standingBlockTemplateId: "tmpl-standing",
      ownLegs: [
        carpoolLeg("TO", "CONFIRMED", { assigneeAdultId: "a2", assigneeDisplayName: "Jason" }),
        carpoolLeg("FROM", "WAITING_HOUSEHOLD", {
          assigneeAdultId: "a1",
          assigneeDisplayName: "Katy",
        }),
      ],
    })
    const otherGap = game({
      id: "FEED-other:k1",
      order: 150,
      ownRide: "unassigned",
    })

    const queue = getQueue([week1, otherGap, week2])
    expect(queue.map((item) => item.game.id)).toEqual([
      "FEED-w1:k1",
      "FEED-other:k1",
    ])
  })

  it("queues when any ownLegs phase is NEEDS_RIDE even if rollup ownRide looks covered or asked", () => {
    const mixedConfirmed = game({
      id: "mixed-confirmed",
      order: 100,
      ownRide: { driver: "You", confirmed: true },
      ownLegs: [
        carpoolLeg("TO", "CONFIRMED", {
          assigneeAdultId: "a1",
          assigneeDisplayName: "Alex",
        }),
        carpoolLeg("FROM", "NEEDS_RIDE"),
      ],
    })
    const mixedAsked = game({
      id: "mixed-asked",
      order: 110,
      ownRide: "requested",
      ownLegs: [carpoolLeg("TO", "ASKED_TEAM"), carpoolLeg("FROM", "NEEDS_RIDE")],
    })
    const bothAsked = game({
      id: "both-asked",
      order: 120,
      ownRide: "requested",
      ownLegs: carpoolLegsBoth("ASKED_TEAM"),
    })

    expect(hasNeedsRideOwnLeg(mixedConfirmed)).toBe(true)
    expect(isOwnRideGap(mixedConfirmed)).toBe(true)
    expect(isOwnRideGap(mixedAsked)).toBe(true)
    expect(isOwnRideGap(bothAsked)).toBe(false)

    const blankNeedsBoth = game({
      id: "blank-needs",
      order: 105,
      ownRide: { driver: "You", confirmed: true },
      ownLegs: carpoolLegsBoth("NEEDS_RIDE"),
    })
    expect(hasNeedsRideOwnLeg(blankNeedsBoth)).toBe(false)
    expect(isOwnRideGap(blankNeedsBoth)).toBe(false)

    const queue = getQueue([mixedConfirmed, blankNeedsBoth, mixedAsked, bothAsked])
    expect(queue.map((item) => item.game.id)).toEqual(["mixed-confirmed", "mixed-asked"])
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

  it("interleaves same-event ask before a later own gap when E is already covered", () => {
    const askOnE = request({ id: "ask-e" })
    const queue = getQueue([
      game({
        id: "EVENT-E:k1",
        order: 100,
        ownRide: { driver: "You", confirmed: true },
        requests: [askOnE],
      }),
      game({
        id: "EVENT-F:k1",
        order: 200,
        ownRide: "unassigned",
      }),
    ])

    expect(queue.map((item) => item.kind + ":" + (item.kind === "request" ? item.request.id : item.game.id))).toEqual([
      "request:ask-e",
      "ownRide:EVENT-F:k1",
    ])
  })

  it("keeps family-first within an event: ownGap(E) then ask(E) then ownGap(F)", () => {
    const askOnE = request({ id: "ask-e" })
    const queue = getQueue([
      game({
        id: "EVENT-E:k1",
        order: 100,
        ownRide: "unassigned",
        requests: [askOnE],
      }),
      game({
        id: "EVENT-F:k1",
        order: 200,
        ownRide: "unassigned",
      }),
    ])

    expect(queue.map((item) => item.kind + ":" + (item.kind === "request" ? item.request.id : item.game.id))).toEqual([
      "ownRide:EVENT-E:k1",
      "request:ask-e",
      "ownRide:EVENT-F:k1",
    ])
  })

  it("dedupes multi-kid same-event asks to one slide per request.id", () => {
    const sharedAsk = request({ id: "shared-ask" })
    const queue = getQueue([
      game({
        id: "EVENT-E:k1",
        kidId: "k1",
        order: 100,
        ownRide: { driver: "You", confirmed: true },
        requests: [sharedAsk],
      }),
      game({
        id: "EVENT-E:k2",
        kidId: "k2",
        order: 100,
        ownRide: { driver: "You", confirmed: true },
        requests: [sharedAsk],
      }),
    ])

    expect(queue).toHaveLength(1)
    expect(queue[0]).toMatchObject({
      kind: "request",
      request: { id: "shared-ask" },
      game: { id: "EVENT-E:k1" },
    })
  })

  it("collapses multi-kid same-event ownRide gaps to one slide", () => {
    const queue = getQueue([
      game({
        id: "EVENT-E:k1",
        kidId: "k1",
        order: 100,
        ownRide: "unassigned",
      }),
      game({
        id: "EVENT-E:k2",
        kidId: "k2",
        order: 100,
        ownRide: "unassigned",
      }),
    ])

    expect(queue).toHaveLength(1)
    expect(queue[0]).toMatchObject({
      kind: "ownRide",
      game: { id: "EVENT-E:k1", kidId: "k1" },
    })
  })

  it("emits one playerConflict per unresolved KID_TIME_OVERLAP pair before that event's gaps/asks", () => {
    const sooner = game({
      id: "MANUAL-e1:k1",
      kidId: "k1",
      order: 100,
      ownRide: "unassigned",
      kidTimeOverlapPeerKeys: ["MANUAL-e2"],
      requests: [request({ id: "ask-on-sooner" })],
    })
    const later = game({
      id: "MANUAL-e2:k1",
      kidId: "k1",
      order: 200,
      ownRide: "unassigned",
      kidTimeOverlapPeerKeys: ["MANUAL-e1"],
    })

    const queue = getQueue([later, sooner])

    expect(queue.map((item) => item.kind)).toEqual([
      "playerConflict",
      "ownRide",
      "request",
      "ownRide",
    ])
    expect(queue[0]).toMatchObject({
      kind: "playerConflict",
      game: { id: "MANUAL-e1:k1" },
      peerGame: { id: "MANUAL-e2:k1" },
      kidIds: ["k1"],
    })
    expect(queue.filter((item) => item.kind === "playerConflict")).toHaveLength(1)
  })

  it("keeps a sooner unrelated gap ahead of a later player-conflict pair", () => {
    const unrelatedGap = game({
      id: "MANUAL-early:k1",
      kidId: "k1",
      order: 50,
      ownRide: "unassigned",
    })
    const conflictA = game({
      id: "MANUAL-a:k1",
      kidId: "k1",
      order: 100,
      ownRide: { driver: "You", confirmed: true },
      kidTimeOverlapPeerKeys: ["MANUAL-b"],
    })
    const conflictB = game({
      id: "MANUAL-b:k1",
      kidId: "k1",
      order: 200,
      ownRide: { driver: "You", confirmed: true },
      kidTimeOverlapPeerKeys: ["MANUAL-a"],
    })

    const queue = getQueue([conflictB, unrelatedGap, conflictA])

    expect(queue.map((item) => item.kind + ":" + coverageGameEventKey(item.game.id))).toEqual([
      "ownRide:MANUAL-early",
      "playerConflict:MANUAL-a",
    ])
  })

  it("keeps a sooner unrelated inbound ask ahead of a later player-conflict pair", () => {
    const unrelatedAsk = game({
      id: "MANUAL-early:k1",
      kidId: "k1",
      order: 50,
      ownRide: { driver: "You", confirmed: true },
      requests: [request({ id: "ask-early" })],
    })
    const conflictA = game({
      id: "MANUAL-a:k1",
      kidId: "k1",
      order: 100,
      ownRide: { driver: "You", confirmed: true },
      kidTimeOverlapPeerKeys: ["MANUAL-b"],
      requests: [request({ id: "ask-on-conflict" })],
    })
    const conflictB = game({
      id: "MANUAL-b:k1",
      kidId: "k1",
      order: 200,
      ownRide: { driver: "You", confirmed: true },
      kidTimeOverlapPeerKeys: ["MANUAL-a"],
    })

    const queue = getQueue([conflictB, unrelatedAsk, conflictA])

    expect(
      queue.map((item) =>
        item.kind === "request"
          ? `request:${item.request.id}`
          : `${item.kind}:${coverageGameEventKey(item.game.id)}`,
      ),
    ).toEqual([
      "request:ask-early",
      "playerConflict:MANUAL-a",
      "request:ask-on-conflict",
    ])
  })

  it("omits playerConflict after not_going even when peer keys (amber conflicts) remain", () => {
    const kept = game({
      id: "MANUAL-e1:k1",
      kidId: "k1",
      order: 100,
      attendance: "going",
      ownRide: { driver: "You", confirmed: true },
      kidTimeOverlapPeerKeys: ["MANUAL-e2"],
    })
    const dropped = game({
      id: "MANUAL-e2:k1",
      kidId: "k1",
      order: 200,
      attendance: "not_going",
      ownRide: "unassigned",
      kidTimeOverlapPeerKeys: ["MANUAL-e1"],
    })

    expect(getQueue([kept, dropped]).some((item) => item.kind === "playerConflict")).toBe(false)
    expect(kept.kidTimeOverlapPeerKeys).toEqual(["MANUAL-e2"])
  })

  it("drops playerConflict when the kid is not_going on either peer", () => {
    const goingOnA = game({
      id: "MANUAL-e1:k1",
      kidId: "k1",
      order: 100,
      attendance: "going",
      ownRide: "unassigned",
      kidTimeOverlapPeerKeys: ["MANUAL-e2"],
    })
    const notGoingOnB = game({
      id: "MANUAL-e2:k1",
      kidId: "k1",
      order: 200,
      attendance: "not_going",
      ownRide: "unassigned",
      kidTimeOverlapPeerKeys: ["MANUAL-e1"],
    })

    expect(getQueue([goingOnA, notGoingOnB]).some((item) => item.kind === "playerConflict")).toBe(
      false,
    )

    const notGoingOnA = { ...goingOnA, attendance: "not_going" as const }
    const goingOnB = { ...notGoingOnB, attendance: "going" as const }
    expect(getQueue([notGoingOnA, goingOnB]).some((item) => item.kind === "playerConflict")).toBe(
      false,
    )
  })

  it("collects multiple unresolved kids on the same pair into one playerConflict", () => {
    const aK1 = game({
      id: "MANUAL-e1:k1",
      kidId: "k1",
      order: 100,
      kidTimeOverlapPeerKeys: ["MANUAL-e2"],
      ownRide: { driver: "You", confirmed: true },
    })
    const aK2 = game({
      id: "MANUAL-e1:k2",
      kidId: "k2",
      order: 100,
      kidTimeOverlapPeerKeys: ["MANUAL-e2"],
      ownRide: { driver: "You", confirmed: true },
    })
    const bK1 = game({
      id: "MANUAL-e2:k1",
      kidId: "k1",
      order: 200,
      kidTimeOverlapPeerKeys: ["MANUAL-e1"],
      ownRide: { driver: "You", confirmed: true },
    })
    const bK2 = game({
      id: "MANUAL-e2:k2",
      kidId: "k2",
      order: 200,
      kidTimeOverlapPeerKeys: ["MANUAL-e1"],
      ownRide: { driver: "You", confirmed: true },
    })
    const bK2Out = { ...bK2, attendance: "not_going" as const }

    const both = getQueue([aK1, aK2, bK1, bK2])
    expect(both).toHaveLength(1)
    expect(both[0]).toMatchObject({
      kind: "playerConflict",
      kidIds: ["k1", "k2"],
    })

    const oneLeft = getQueue([aK1, aK2, bK1, bK2Out])
    expect(oneLeft).toHaveLength(1)
    expect(oneLeft[0]).toMatchObject({
      kind: "playerConflict",
      kidIds: ["k1"],
    })
  })

  it("maps calendar KID_TIME_OVERLAP conflicts onto coverage games for getQueue", () => {
    const itemA = calendarItem({
      id: "e1",
      startsAt: "2030-08-15T17:00:00.000Z",
      kidIds: ["k1"],
      conflicts: [
        {
          type: "KID_TIME_OVERLAP",
          kidId: "k1",
          otherKidId: null,
          adultId: null,
          adultDisplayName: null,
          otherSource: "MANUAL",
          otherItemId: "e2",
          otherTitle: "Game",
          otherStartsAt: "2030-08-15T17:30:00.000Z",
        },
      ],
    })
    const itemB = calendarItem({
      id: "e2",
      title: "Game",
      startsAt: "2030-08-15T17:30:00.000Z",
      kidIds: ["k1"],
      conflicts: [
        {
          type: "KID_TIME_OVERLAP",
          kidId: "k1",
          otherKidId: null,
          adultId: null,
          adultDisplayName: null,
          otherSource: "MANUAL",
          otherItemId: "e1",
          otherTitle: "Practice",
          otherStartsAt: "2030-08-15T17:00:00.000Z",
        },
      ],
    })

    const rows = mapCalendarItemsToCoverageGames(
      [itemA, itemB],
      () => null,
      mapOptions,
    )
    expect(rows.map((row) => row.kidTimeOverlapPeerKeys)).toEqual([
      ["MANUAL-e2"],
      ["MANUAL-e1"],
    ])

    const queue = getQueue(rows)
    expect(queue).toHaveLength(1)
    expect(queue[0]).toMatchObject({
      kind: "playerConflict",
      game: { id: "MANUAL-e1:k1" },
      peerGame: { id: "MANUAL-e2:k1" },
      kidIds: ["k1"],
    })
  })

  it("does not map FAMILY_TIME_OVERLAP into Hero playerConflict slides", () => {
    const soccer = calendarItem({
      id: "soccer",
      title: "Soccer",
      startsAt: "2030-08-15T17:00:00.000Z",
      kidIds: ["k1"],
      coverages: [
        {
          id: "c1",
          coveringAdultId: "a1",
          coveringAdultDisplayName: "Alex",
          assignedByAdultId: "a1",
          kidIds: ["k1"],
          status: "CONFIRMED",
          leaveFromPlaceId: null,
          leaveFromPlaceName: null,
          leaveFromAddress: null,
          leaveByAt: null,
          leaveByStatus: "PENDING",
          leaveByReason: null,
        },
      ],
      conflicts: [
        {
          type: "FAMILY_TIME_OVERLAP",
          kidId: "k1",
          otherKidId: "k2",
          adultId: null,
          adultDisplayName: null,
          otherSource: "MANUAL",
          otherItemId: "dance",
          otherTitle: "Dance",
          otherStartsAt: "2030-08-15T17:30:00.000Z",
        },
      ],
    })
    const dance = calendarItem({
      id: "dance",
      title: "Dance",
      startsAt: "2030-08-15T17:30:00.000Z",
      kidIds: ["k2"],
      coverages: [
        {
          id: "c2",
          coveringAdultId: "a1",
          coveringAdultDisplayName: "Alex",
          assignedByAdultId: "a1",
          kidIds: ["k2"],
          status: "CONFIRMED",
          leaveFromPlaceId: null,
          leaveFromPlaceName: null,
          leaveFromAddress: null,
          leaveByAt: null,
          leaveByStatus: "PENDING",
          leaveByReason: null,
        },
      ],
      conflicts: [
        {
          type: "FAMILY_TIME_OVERLAP",
          kidId: "k2",
          otherKidId: "k1",
          adultId: null,
          adultDisplayName: null,
          otherSource: "MANUAL",
          otherItemId: "soccer",
          otherTitle: "Soccer",
          otherStartsAt: "2030-08-15T17:00:00.000Z",
        },
      ],
    })

    const rows = mapCalendarItemsToCoverageGames(
      [soccer, dance],
      () => null,
      mapOptions,
    )
    expect(rows.every((row) => row.kidTimeOverlapPeerKeys == null)).toBe(true)

    const queue = getQueue(rows)
    expect(queue.some((item) => item.kind === "playerConflict")).toBe(false)
  })
})

describe("filterQueueWithinHorizon", () => {
  const now = new Date("2030-08-15T12:00:00")

  it("keeps items starting within the next seven local days", () => {
    const queue = getQueue([
      game({
        id: "this-week",
        order: Date.parse("2030-08-16T17:00:00.000Z"),
        startsAt: "2030-08-16T17:00:00.000Z",
        ownRide: "unassigned",
      }),
      game({
        id: "later",
        order: Date.parse("2030-08-25T17:00:00.000Z"),
        startsAt: "2030-08-25T17:00:00.000Z",
        ownRide: "unassigned",
      }),
    ])

    const filtered = filterQueueWithinHorizon(queue, now)

    expect(filtered).toHaveLength(1)
    expect(filtered[0]).toMatchObject({ game: { id: "this-week" } })
  })

  it("excludes playerConflict slides whose sooner peer is outside the near-term horizon", () => {
    const queue = getQueue([
      game({
        id: "MANUAL-near:k1",
        kidId: "k1",
        order: Date.parse("2030-08-16T17:00:00.000Z"),
        startsAt: "2030-08-16T17:00:00.000Z",
        ownRide: { driver: "You", confirmed: true },
        kidTimeOverlapPeerKeys: ["MANUAL-far"],
      }),
      game({
        id: "MANUAL-far:k1",
        kidId: "k1",
        order: Date.parse("2030-08-16T18:00:00.000Z"),
        startsAt: "2030-08-16T18:00:00.000Z",
        ownRide: { driver: "You", confirmed: true },
        kidTimeOverlapPeerKeys: ["MANUAL-near"],
      }),
      game({
        id: "MANUAL-out-a:k1",
        kidId: "k1",
        order: Date.parse("2030-08-25T17:00:00.000Z"),
        startsAt: "2030-08-25T17:00:00.000Z",
        ownRide: { driver: "You", confirmed: true },
        kidTimeOverlapPeerKeys: ["MANUAL-out-b"],
      }),
      game({
        id: "MANUAL-out-b:k1",
        kidId: "k1",
        order: Date.parse("2030-08-25T18:00:00.000Z"),
        startsAt: "2030-08-25T18:00:00.000Z",
        ownRide: { driver: "You", confirmed: true },
        kidTimeOverlapPeerKeys: ["MANUAL-out-a"],
      }),
    ])

    expect(queue.filter((item) => item.kind === "playerConflict")).toHaveLength(2)

    const filtered = filterQueueWithinHorizon(queue, now)
    expect(filtered).toHaveLength(1)
    expect(filtered[0]).toMatchObject({
      kind: "playerConflict",
      game: { id: "MANUAL-near:k1" },
    })
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

describe("applyAutoDeclinedViewModel", () => {
  it("auto-declines pending inbound when ownRide is requested and reports new ids", () => {
    const games = [
      game({
        id: "asked",
        order: 1,
        ownRide: "requested",
        requests: [request({ id: "inbound-1" }), request({ id: "already", status: "accepted" })],
      }),
    ]

    const result = applyAutoDeclinedViewModel(games)

    expect(result.newlyDeclinedRideIds).toEqual(["inbound-1"])
    expect(result.games[0]?.requests).toEqual([
      expect.objectContaining({
        id: "inbound-1",
        status: "declined",
        autoDeclined: true,
      }),
      expect.objectContaining({ id: "already", status: "accepted" }),
    ])
    expect(getQueue(result.games)).toEqual([])
  })

  it("keeps session auto-declined ids sticky after ownRide leaves requested", () => {
    const games = [
      game({
        id: "after-cancel",
        order: 1,
        ownRide: "unassigned",
        requests: [request({ id: "sticky-inbound" })],
      }),
    ]

    const result = applyAutoDeclinedViewModel(games, new Set(["sticky-inbound"]))

    expect(result.newlyDeclinedRideIds).toEqual([])
    expect(result.games[0]?.requests[0]).toEqual(
      expect.objectContaining({
        id: "sticky-inbound",
        status: "declined",
        autoDeclined: true,
      }),
    )
    expect(getQueue(result.games).some((item) => item.kind === "request")).toBe(false)
  })

  it("does not sticky-decline when id is absent and ownRide is not requested", () => {
    const games = [
      game({
        id: "gap",
        order: 1,
        ownRide: "unassigned",
        requests: [request({ id: "still-pending" })],
      }),
      game({
        id: "confirm",
        order: 2,
        ownRide: { driver: "You", confirmed: false },
        requests: [request({ id: "also-pending" })],
      }),
    ]

    const result = applyAutoDeclinedViewModel(games, new Set())

    expect(result.newlyDeclinedRideIds).toEqual([])
    expect(result.games).toEqual(games)
  })

  it("omits already-sessioned ids from newlyDeclinedRideIds", () => {
    const games = [
      game({
        id: "asked",
        order: 1,
        ownRide: "requested",
        requests: [request({ id: "known" }), request({ id: "fresh" })],
      }),
    ]

    const result = applyAutoDeclinedViewModel(games, new Set(["known"]))

    expect(result.newlyDeclinedRideIds).toEqual(["fresh"])
  })

  it("re-applies auto-decline after remap while ownRide stays requested", () => {
    // Simulates reload: API still returns PENDING inbound + PENDING own ask.
    const remapped = mapCalendarItemsToCoverageGames(
      [
        calendarItem({
          id: "e1",
          kidIds: ["k1"],
          uncoveredKidIds: ["k1"],
          eventKey: "UID:reload",
        }),
      ],
      () =>
        rideEvent({
          eventKey: "UID:reload",
          ownRequest: ownRide({
            id: "own-ask",
            eventKey: "UID:reload",
            status: "PENDING",
            kidIds: ["k1"],
          }),
          otherRequests: [
            ownRide({
              id: "inbound",
              eventKey: "UID:reload",
              requestingCircleId: "c2",
              requestingCircleName: "House B",
              requestedByAdultId: "a2",
              kidIds: ["k2"],
              kidFirstNames: ["Mia"],
              status: "PENDING",
            }),
          ],
        }),
      mapOptions,
    )

    const rawInbound = remapped[0]?.requests.find((row) => row.id === "inbound")
    expect(rawInbound).toMatchObject({ status: "pending" })
    expect(rawInbound?.autoDeclined).toBeUndefined()

    const { games, newlyDeclinedRideIds } = applyAutoDeclinedViewModel(remapped)

    expect(newlyDeclinedRideIds).toEqual(["inbound"])
    expect(games[0]?.requests.find((row) => row.id === "inbound")).toMatchObject({
      status: "declined",
      autoDeclined: true,
    })
    expect(getQueue(games).some((item) => item.kind === "request")).toBe(false)
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

  it("maps NO_RESPONSE and missing RSVP rows to going attendance on FEED", () => {
    const withNoResponse = mapCalendarItemToCoverageGames(
      calendarItem({
        source: "FEED",
        kidIds: ["k1"],
        rsvps: [{ kidId: "k1", status: "NO_RESPONSE" }],
        uncoveredKidIds: ["k1"],
      }),
      null,
      mapOptions,
    )
    expect(withNoResponse[0]?.attendance).toBe("going")

    const stale = calendarItem({
      source: "FEED",
      kidIds: ["k1"],
      rsvps: [],
      driveBlockLinks: [],
      uncoveredKidIds: ["k1"],
    })
    delete (stale as { rsvps?: CalendarItem["rsvps"] }).rsvps
    const withoutRow = mapCalendarItemToCoverageGames(stale, null, mapOptions)
    expect(withoutRow[0]?.attendance).toBe("going")
  })

  it("maps NO_RESPONSE to going attendance on MANUAL", () => {
    const rows = mapCalendarItemToCoverageGames(
      calendarItem({
        source: "MANUAL",
        kidIds: ["k1"],
        rsvps: [{ kidId: "k1", status: "NO_RESPONSE" }],
        uncoveredKidIds: ["k1"],
      }),
      null,
      mapOptions,
    )
    expect(rows[0]?.attendance).toBe("going")
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
          leaveFromPlaceId: null,
          leaveFromPlaceName: null,
          leaveFromAddress: null,
          leaveByAt: null,
          leaveByStatus: null,
          leaveByReason: null,
          },
        ],
      }),
      null,
      mapOptions,
    )
    expect(pendingConfirm[0]?.ownRide).toEqual({ driver: "Jordan", confirmed: false })

    const standingLocked = mapCalendarItemToCoverageGames(
      calendarItem({
        source: "FEED",
        standingLocked: true,
        standingBlockTemplateId: "tmpl-9",
      }),
      null,
      mapOptions,
    )
    expect(standingLocked[0]?.standingBlockTemplateId).toBe("tmpl-9")

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
          leaveFromPlaceId: null,
          leaveFromPlaceName: null,
          leaveFromAddress: null,
          leaveByAt: null,
          leaveByStatus: null,
          leaveByReason: null,
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

  it("copies ownLegs onto coverage games so mixed NEEDS_RIDE re-enters getQueue", () => {
    const mixedLegs = [
      carpoolLeg("TO", "CONFIRMED", {
        assigneeAdultId: "a1",
        assigneeDisplayName: "Alex",
      }),
      carpoolLeg("FROM", "NEEDS_RIDE"),
    ]
    const rows = mapCalendarItemToCoverageGames(
      calendarItem({
        coverages: [
          {
            id: "c-self",
            coveringAdultId: "a1",
            coveringAdultDisplayName: "Alex",
            assignedByAdultId: "a1",
            kidIds: ["k1"],
            status: "CONFIRMED",
            leaveFromPlaceId: null,
            leaveFromPlaceName: null,
            leaveFromAddress: null,
            leaveByAt: null,
            leaveByStatus: null,
            leaveByReason: null,
          },
        ],
      }),
      rideEvent({ ownRequest: null, ownLegs: mixedLegs }),
      mapOptions,
    )

    expect(rows[0]?.ownRide).toBe("unassigned")
    expect(rows[0]?.ownLegs).toEqual(mixedLegs)
    expect(getQueue(rows).map((item) => item.game.id)).toEqual(["MANUAL-e1:k1"])
  })

  it("queues only the open kid when ownRequests split household and ask plans", () => {
    const household = ownRide({
      id: "plan-a",
      status: "PLAN",
      kidIds: ["k1"],
      kidFirstNames: ["Sam"],
      legs: carpoolLegsBoth("CONFIRMED", {
        assigneeAdultId: "a1",
        assigneeDisplayName: "Alex",
      }),
    })
    const open = ownRide({
      id: "plan-b",
      status: "PLAN",
      kidIds: ["k2"],
      kidFirstNames: ["Mia"],
      legs: [
        carpoolLeg("TO", "CONFIRMED", {
          assigneeAdultId: "a1",
          assigneeDisplayName: "Alex",
        }),
        carpoolLeg("FROM", "NEEDS_RIDE"),
      ],
    })
    const rows = mapCalendarItemToCoverageGames(
      calendarItem({ kidIds: ["k1", "k2"], uncoveredKidIds: [] }),
      rideEvent({
        ownRequests: [household, open],
        ownRequest: null,
        ownLegs: null,
        defaultKidIds: ["k1", "k2"],
      }),
      mapOptions,
    )

    expect(rows.find((row) => row.kidId === "k1")?.ownRide).toEqual({
      driver: "You",
      confirmed: true,
    })
    expect(rows.find((row) => row.kidId === "k2")?.ownRide).toBe("unassigned")
    expect(isOwnRideGap(rows.find((row) => row.kidId === "k2")!)).toBe(true)
    expect(isOwnRideGap(rows.find((row) => row.kidId === "k1")!)).toBe(false)
    expect(getQueue(rows).map((item) => item.game.kidId)).toEqual(["k2"])
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

  it("maps pickupTown and detourMinutes from otherRequests", () => {
    const rows = mapCalendarItemToCoverageGames(
      calendarItem({ kidIds: ["k1"] }),
      rideEvent({
        otherRequests: [
          ownRide({
            id: "ask-1",
            pickupTown: "Cambridge, MA",
            detourMinutes: 7,
          }),
        ],
      }),
      mapOptions,
    )

    expect(rows[0]?.requests[0]).toMatchObject({
      pickupTown: "Cambridge, MA",
      detourMinutes: 7,
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
