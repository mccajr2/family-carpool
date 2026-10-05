import { describe, expect, it } from "vitest"

import type { CalendarItem, StandingRideArrangement } from "@/api/types"
import type { QueueItem } from "@/components/coverageQueue"
import {
  mergeStandingAsksIntoQueue,
  ownOpenStandingCoversCalendarItem,
  postStandingAskLabel,
  standingAskCheckboxLabel,
  standingAskGateOpen,
  standingAskHeroMergeItems,
  standingAskQueuePayload,
  standingInboundAskCaption,
  standingInboundAskTitle,
  standingRideAgendaChromeForItem,
} from "@/components/standingRideChrome"

function fingerprint(
  partial: Partial<StandingRideArrangement["fingerprint"]> = {},
): StandingRideArrangement["fingerprint"] {
  return {
    feedId: "feed-1",
    dayOfWeek: "TUESDAY",
    minuteOfDay: 17 * 60,
    normalizedLocation: "rink",
    ...partial,
  }
}

function arrangement(
  partial: Partial<StandingRideArrangement> = {},
): StandingRideArrangement {
  return {
    id: "arr-1",
    spaceId: "space-1",
    requestingCircleId: "circle-req",
    requestedByAdultId: "adult-1",
    fingerprint: fingerprint(),
    timeZone: "UTC",
    anchorStartsAt: "2030-09-03T17:00:00.000Z",
    assignment: "FIXED_PRIMARY",
    status: "OPEN",
    askTemplate: {
      kids: [{ kidId: "k1", firstName: "Ben" }],
      legs: [
        {
          kind: "TO",
          phase: "ASKED_TEAM",
          meetSide: "CURB",
        },
        {
          kind: "FROM",
          phase: "NEEDS_RIDE",
          meetSide: "CURB",
        },
      ],
    },
    createdAt: "2030-08-01T12:00:00.000Z",
    passedByMe: false,
    ...partial,
  }
}

function feedItem(partial: Partial<CalendarItem> = {}): CalendarItem {
  return {
    source: "FEED",
    id: "e1",
    title: "Practice",
    // Tuesday 17:00 UTC
    startsAt: "2030-09-03T17:00:00.000Z",
    endsAt: "2030-09-03T18:00:00.000Z",
    location: "Rink",
    kidIds: ["k1"],
    feedId: "feed-1",
    feedName: "Team",
    eventKey: "UID:e1",
    leaveFromPlaceId: null,
    leaveFromPlaceName: null,
    leaveFromAddress: null,
    leaveByAt: null,
    leaveByStatus: "PENDING",
    leaveByReason: null,
    coverages: [],
    uncoveredKidIds: ["k1"],
    conflicts: [],
    rsvps: [{ kidId: "k1", status: "YES" }],
    driveBlockLinks: [],
    ...partial,
  }
}

describe("standingRideChrome", () => {
  it("labels standing Ask checkbox and Post CTA with weekday", () => {
    expect(standingAskCheckboxLabel("Tuesday")).toBe(
      "Ask for every Tuesday practice",
    )
    expect(postStandingAskLabel("Tuesdays")).toBe(
      "Post standing Ask for Tuesdays",
    )
  })

  it("treats non-empty weekday singular as gate open", () => {
    expect(standingAskGateOpen("Tuesday")).toBe(true)
    expect(standingAskGateOpen(null)).toBe(false)
    expect(standingAskGateOpen(undefined)).toBe(false)
    expect(standingAskGateOpen("")).toBe(false)
  })

  it("builds series-obvious inbound Hero copy", () => {
    expect(standingInboundAskTitle("the Nguyens", "Tuesday")).toBe(
      "the Nguyens needs a standing ride every Tuesday",
    )
    expect(standingInboundAskCaption("Tuesdays")).toBe(
      "Accept once — you're the fixed primary for future Tuesdays until they end standing.",
    )
  })

  it("merges one standingAsk queue item per arrangementId", () => {
    const row = arrangement()
    const anchor = feedItem()
    const payload = standingAskQueuePayload(row, anchor, "the Nguyens")
    const laterOwn: QueueItem = {
      kind: "ownRide",
      game: {
        id: "FEED-e2:k1",
        kidId: "k1",
        title: "Later",
        startsAt: "2030-09-10T17:00:00.000Z",
        order: Date.parse("2030-09-10T17:00:00.000Z"),
        attendance: "going",
        ownRide: "unassigned",
        requests: [],
      },
    }
    const merged = mergeStandingAsksIntoQueue([laterOwn], [{ payload, anchor }])
    expect(merged).toHaveLength(2)
    expect(merged[0]?.kind).toBe("standingAsk")
    expect(merged[1]?.kind).toBe("ownRide")
    const again = mergeStandingAsksIntoQueue(merged, [{ payload, anchor }])
    expect(again.filter((item) => item.kind === "standingAsk")).toHaveLength(1)
  })

  it("builds Hero merge items only for inbound OPEN Asks with anchors", () => {
    const openInbound = arrangement({ id: "arr-in" })
    const ownOpen = arrangement({
      id: "arr-own",
      requestingCircleId: "viewer",
    })
    const passed = arrangement({ id: "arr-pass", passedByMe: true })
    const active = arrangement({ id: "arr-active", status: "ACTIVE" })
    const items = standingAskHeroMergeItems(
      [openInbound, ownOpen, passed, active],
      [feedItem()],
      "viewer",
      () => "the Nguyens",
    )
    expect(items).toHaveLength(1)
    expect(items[0]?.payload.arrangementId).toBe("arr-in")
    expect(items[0]?.payload.requestingCircleName).toBe("the Nguyens")
  })

  it("suppresses ownRide gaps under own OPEN standing Ask; not after ENDED", () => {
    const item = feedItem()
    const open = arrangement({
      requestingCircleId: "viewer",
      status: "OPEN",
    })
    expect(ownOpenStandingCoversCalendarItem(item, [open], "viewer")).toBe(true)
    expect(
      ownOpenStandingCoversCalendarItem(
        item,
        [arrangement({ requestingCircleId: "viewer", status: "ENDED" })],
        "viewer",
      ),
    ).toBe(false)
  })

  it("resolves Agenda chrome for inbound, requester End, and primary", () => {
    const item = feedItem()
    expect(
      standingRideAgendaChromeForItem(
        item,
        [arrangement({ requestingCircleId: "other" })],
        "viewer",
      ),
    ).toMatchObject({ inboundOpen: true, arrangementId: "arr-1" })
    expect(
      standingRideAgendaChromeForItem(
        item,
        [arrangement({ requestingCircleId: "viewer", status: "OPEN" })],
        "viewer",
      ),
    ).toMatchObject({ ownOpen: true })
    expect(
      standingRideAgendaChromeForItem(
        item,
        [
          arrangement({
            requestingCircleId: "other",
            status: "ACTIVE",
            primaryCircleId: "viewer",
          }),
        ],
        "viewer",
      ),
    ).toMatchObject({ primaryActive: true })
  })
})
