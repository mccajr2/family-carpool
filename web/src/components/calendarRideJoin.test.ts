import { describe, expect, it } from "vitest"

import type { CalendarItem, CarpoolRideEvent, CarpoolSummary } from "@/api/types"
import {
  feedSpaceIdsFromSummary,
  matchCalendarItemToRideEvent,
  normalizeRideMatchText,
  rideEventLocationNormalized,
  startsAtEqual,
} from "@/components/calendarRideJoin"

function rideEvent(partial: Partial<CarpoolRideEvent> = {}): CarpoolRideEvent {
  return {
    eventKey: "UID:game-1",
    title: "Practice",
    startsAt: "2026-08-21T16:00:00Z",
    endsAt: null,
    defaultKidIds: [],
    ownRequest: null,
    otherRequests: [],
    ...partial,
  }
}

function item(
  partial: Partial<CalendarItem> &
    Pick<CalendarItem, "source" | "feedId" | "title" | "startsAt">,
): Pick<CalendarItem, "source" | "feedId" | "title" | "startsAt" | "location"> {
  return {
    location: null,
    ...partial,
  }
}

const summary: CarpoolSummary = {
  circleRole: "ORGANIZER",
  feeds: [
    {
      feedId: "f1",
      feedName: "Soccer",
      status: "OWNER",
      spaceId: "s1",
      spaceName: "Soccer",
    },
    {
      feedId: "f2",
      feedName: "Other",
      status: "AVAILABLE",
      spaceId: "s2",
      spaceName: "Other",
    },
    {
      feedId: "f3",
      feedName: "Joined",
      status: "MEMBER",
      spaceId: "s3",
      spaceName: "Joined",
    },
  ],
  spaces: [],
}

describe("feedSpaceIdsFromSummary", () => {
  it("maps only MEMBER and OWNER feeds with a spaceId", () => {
    expect(Object.fromEntries(feedSpaceIdsFromSummary(summary))).toEqual({
      f1: "s1",
      f3: "s3",
    })
  })
})

describe("matchCalendarItemToRideEvent", () => {
  const spaceIds = feedSpaceIdsFromSummary(summary)
  const practice = rideEvent()
  const rides = new Map<string, CarpoolRideEvent[]>([["s1", [practice]]])

  it("returns null for MANUAL and non-member feeds", () => {
    expect(
      matchCalendarItemToRideEvent(
        item({
          source: "MANUAL",
          feedId: null,
          title: "Practice",
          startsAt: "2026-08-21T16:00:00Z",
        }),
        spaceIds,
        rides,
      ),
    ).toBeNull()
    expect(
      matchCalendarItemToRideEvent(
        item({
          source: "FEED",
          feedId: "f2",
          title: "Practice",
          startsAt: "2026-08-21T16:00:00Z",
        }),
        spaceIds,
        rides,
      ),
    ).toBeNull()
  })

  it("matches FEED row by space + startsAt + title (case/trim insensitive)", () => {
    expect(
      matchCalendarItemToRideEvent(
        item({
          source: "FEED",
          feedId: "f1",
          title: "  PRACTICE ",
          startsAt: "2026-08-21T16:00:00.000Z",
        }),
        spaceIds,
        rides,
      ),
    ).toBe(practice)
  })

  it("matches unique title+startsAt even when FP location drifts", () => {
    const fpRide = rideEvent({
      eventKey: "FP:practice|2026-08-21T16:00:00Z|field 3",
      title: "Practice",
    })
    const fpRides = new Map<string, CarpoolRideEvent[]>([["s1", [fpRide]]])

    expect(
      matchCalendarItemToRideEvent(
        item({
          source: "FEED",
          feedId: "f1",
          title: "Practice",
          startsAt: "2026-08-21T16:00:00Z",
          location: "Field 3",
        }),
        spaceIds,
        fpRides,
      ),
    ).toBe(fpRide)

    expect(
      matchCalendarItemToRideEvent(
        item({
          source: "FEED",
          feedId: "f1",
          title: "Practice",
          startsAt: "2026-08-21T16:00:00Z",
          location: "Gym",
        }),
        spaceIds,
        fpRides,
      ),
    ).toBe(fpRide)
  })

  it("uses location only to disambiguate title+startsAt collisions", () => {
    const field = rideEvent({
      eventKey: "FP:practice|2026-08-21T16:00:00Z|field 3",
      title: "Practice",
    })
    const gym = rideEvent({
      eventKey: "FP:practice|2026-08-21T16:00:00Z|gym",
      title: "Practice",
    })
    const collisionRides = new Map<string, CarpoolRideEvent[]>([["s1", [field, gym]]])

    expect(
      matchCalendarItemToRideEvent(
        item({
          source: "FEED",
          feedId: "f1",
          title: "Practice",
          startsAt: "2026-08-21T16:00:00Z",
          location: "Gym",
        }),
        spaceIds,
        collisionRides,
      ),
    ).toBe(gym)

    expect(
      matchCalendarItemToRideEvent(
        item({
          source: "FEED",
          feedId: "f1",
          title: "Practice",
          startsAt: "2026-08-21T16:00:00Z",
          location: "Field 3",
        }),
        spaceIds,
        collisionRides,
      ),
    ).toBe(field)

    expect(
      matchCalendarItemToRideEvent(
        item({
          source: "FEED",
          feedId: "f1",
          title: "Practice",
          startsAt: "2026-08-21T16:00:00Z",
          location: null,
        }),
        spaceIds,
        collisionRides,
      ),
    ).toBeNull()

    expect(
      matchCalendarItemToRideEvent(
        item({
          source: "FEED",
          feedId: "f1",
          title: "Practice",
          startsAt: "2026-08-21T16:00:00Z",
          location: "Pool",
        }),
        spaceIds,
        collisionRides,
      ),
    ).toBeNull()
  })

  it("skips location when unique UID ride has no fingerprint location", () => {
    expect(
      matchCalendarItemToRideEvent(
        item({
          source: "FEED",
          feedId: "f1",
          title: "Practice",
          startsAt: "2026-08-21T16:00:00Z",
          location: "Field 3",
        }),
        spaceIds,
        rides,
      ),
    ).toBe(practice)
  })

  it("does not match wrong title or startsAt", () => {
    expect(
      matchCalendarItemToRideEvent(
        item({
          source: "FEED",
          feedId: "f1",
          title: "Game",
          startsAt: "2026-08-21T16:00:00Z",
        }),
        spaceIds,
        rides,
      ),
    ).toBeNull()
    expect(
      matchCalendarItemToRideEvent(
        item({
          source: "FEED",
          feedId: "f1",
          title: "Practice",
          startsAt: "2026-08-22T16:00:00Z",
        }),
        spaceIds,
        rides,
      ),
    ).toBeNull()
  })
})

describe("normalize helpers", () => {
  it("normalizes text and parses FP location", () => {
    expect(normalizeRideMatchText("  Ab C ")).toBe("ab c")
    expect(rideEventLocationNormalized(rideEvent({ eventKey: "UID:x" }))).toBe("")
    expect(
      rideEventLocationNormalized(
        rideEvent({ eventKey: "FP:practice|2026-08-21T16:00:00Z|field 3" }),
      ),
    ).toBe("field 3")
    expect(startsAtEqual("2026-08-21T16:00:00Z", "2026-08-21T16:00:00.000Z")).toBe(true)
  })
})
