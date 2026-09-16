import { describe, expect, it } from "vitest"

import type { CalendarItem, CarpoolRideEvent } from "@/api/types"
import { isDrivingAdultForCalendarRoute } from "@/components/isDrivingAdultForCalendarRoute"

function item(coverages: CalendarItem["coverages"]): CalendarItem {
  return {
    id: "e1",
    source: "MANUAL",
    title: "Practice",
    startsAt: "2030-08-15T17:00:00.000Z",
    endsAt: null,
    location: "Rink",
    kidIds: ["k1"],
    uncoveredKidIds: [],
    rsvps: [{ kidId: "k1", status: "YES" }],
    coverages,
    conflicts: [],
    leaveFromPlaceId: null,
    leaveFromPlaceName: null,
    leaveFromAddress: null,
    leaveByAt: null,
    leaveByStatus: "OK",
    leaveByReason: null,
    feedId: null,
    feedName: null,
    eventKey: null,
    driveBlockLinks: [],
  }
}

describe("isDrivingAdultForCalendarRoute", () => {
  it("is true when the adult has CONFIRMED coverage", () => {
    expect(
      isDrivingAdultForCalendarRoute(
        "a1",
        item([
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
            leaveByStatus: null,
            leaveByReason: null,
          },
        ]),
        null,
      ),
    ).toBe(true)
  })

  it("is false for riders without confirmed coverage or accepted drive", () => {
    expect(
      isDrivingAdultForCalendarRoute(
        "a1",
        item([
          {
            id: "c1",
            coveringAdultId: "a2",
            coveringAdultDisplayName: "Other",
            assignedByAdultId: "a2",
            kidIds: ["k1"],
            status: "CONFIRMED",
            leaveFromPlaceId: null,
            leaveFromPlaceName: null,
            leaveFromAddress: null,
            leaveByAt: null,
            leaveByStatus: null,
            leaveByReason: null,
          },
        ]),
        null,
      ),
    ).toBe(false)
  })

  it("is true when the adult accepted a teammate ride", () => {
    const rideEvent = {
      eventKey: "FEED:e1",
      title: "Practice",
      startsAt: "2030-08-15T17:00:00.000Z",
      endsAt: null,
      defaultKidIds: ["k1"],
      ownRequests: [],
      ownLegs: null,
      ownRequest: null,
      otherRequests: [
        {
          id: "r1",
          spaceId: "s1",
          eventKey: "FEED:e1",
          requestingCircleId: "c2",
          requestingCircleName: "Them",
          requestedByAdultId: "a9",
          kidIds: ["k9"],
          kidFirstNames: ["Kid"],
          seats: 1,
          pickupPlaceName: "House",
          pickupAddress: "1 Oak",
          pickupTown: null,
          detourMinutes: null,
          status: "ACCEPTED",
          legs: [],
          passedByMe: false,
          passedByAdultNames: [],
          acceptedByAdultId: "a1",
          acceptingCircleId: "c1",
          acceptingCircleName: "Us",
        },
      ],
    } satisfies CarpoolRideEvent

    expect(isDrivingAdultForCalendarRoute("a1", item([]), rideEvent)).toBe(true)
  })
})
