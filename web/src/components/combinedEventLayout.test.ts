import { describe, expect, it } from "vitest"

import type {
  CalendarItem,
  CarpoolRide,
  CarpoolRideEvent,
  CarpoolRideLeg,
  FamilyCircle,
} from "@/api/types"
import {
  buildCombinedEventLayout,
  combinedEventTitle,
} from "@/components/combinedEventLayout"

const circle: Pick<FamilyCircle, "kids" | "members" | "id"> = {
  id: "c1",
  members: [
    {
      adultId: "a1",
      email: "you@example.com",
      displayName: "Chris",
      role: "ORGANIZER",
    },
    {
      adultId: "a2",
      email: "katy@example.com",
      displayName: "Katy",
      role: "CAREGIVER",
    },
  ],
  kids: [
    { id: "k-kian", displayName: "Kian" },
    { id: "k-declan", displayName: "Declan" },
  ],
}

function item(
  id: string,
  overrides: Partial<CalendarItem> = {},
): CalendarItem {
  return {
    id,
    source: "FEED",
    title: id,
    startsAt: "2030-10-13T22:00:00.000Z",
    endsAt: "2030-10-13T22:50:00.000Z",
    location: "155 Gore St, Cambridge, MA 02141",
    kidIds: [],
    feedId: "f1",
    feedName: null,
    eventKey: `UID:${id}`,
    leaveFromPlaceId: null,
    leaveFromPlaceName: null,
    leaveFromAddress: null,
    leaveByAt: null,
    leaveByStatus: "UNAVAILABLE",
    leaveByReason: "NO_ORIGIN",
    coverages: [],
    uncoveredKidIds: [],
    conflicts: [],
    rsvps: [],
    driveBlockLinks: [],
    ...overrides,
  }
}

function leg(
  kind: "TO" | "FROM",
  adultId: string,
  name: string,
): CarpoolRideLeg {
  return {
    kind,
    phase: "CONFIRMED",
    assigneeAdultId: adultId,
    assigneeDisplayName: name,
    assigneeCircleId: "c1",
    assigneeCircleName: "House",
    placeId: null,
    placeName: null,
    placeAddress: null,
    meetSide: "REQUESTER",
  }
}

function ride(
  eventKey: string,
  kidIds: string[],
  names: string[],
  legs: CarpoolRideLeg[],
): CarpoolRideEvent {
  const plan: CarpoolRide = {
    id: `r-${eventKey}`,
    spaceId: "s1",
    eventKey,
    requestingCircleId: "c1",
    requestingCircleName: "House",
    requestedByAdultId: "a1",
    kidIds,
    kidFirstNames: names,
    seats: kidIds.length,
    pickupPlaceName: "Home",
    pickupAddress: "1 Main",
    pickupTown: null,
    detourMinutes: null,
    status: "PENDING",
    legs,
    passedByMe: false,
    passedByAdultNames: [],
    acceptedByAdultId: null,
    acceptingCircleId: null,
    acceptingCircleName: null,
  }
  return {
    eventKey,
    title: eventKey,
    startsAt: "2030-10-13T22:00:00.000Z",
    endsAt: "2030-10-13T22:50:00.000Z",
    defaultKidIds: kidIds,
    ownRequests: [plan],
    ownLegs: legs,
    ownRequest: plan,
    otherRequests: [],
  }
}

describe("combinedEventTitle", () => {
  it("keeps one shared title and joins unrelated titles", () => {
    expect(combinedEventTitle([{ title: "Practice" }, { title: "Practice" }])).toBe(
      "Practice",
    )
    expect(
      combinedEventTitle([{ title: "Piano lesson" }, { title: "Swim practice" }]),
    ).toBe("Piano lesson + Swim practice")
  })

  it("keeps the shared club and event words", () => {
    expect(
      combinedEventTitle([
        { title: "CYH Mite 3 Practice" },
        { title: "CYH Squirt 1 Practice" },
      ]),
    ).toBe("CYH Practice")
  })
})

describe("buildCombinedEventLayout", () => {
  it("matches a single-card header and a per-kid there/back breakout", () => {
    const mite = item("mite", {
      title: "CYH Mite 3 Practice",
      feedName: "Mite 3",
      startsAt: "2030-10-13T22:00:00.000Z",
      endsAt: "2030-10-13T22:50:00.000Z",
      leaveByAt: "2030-10-13T21:43:00.000Z",
      kidIds: ["k-kian"],
      rsvps: [{ kidId: "k-kian", status: "YES" }],
    })
    const squirt = item("squirt", {
      title: "CYH Squirt 1 Practice",
      feedName: "Squirt 1",
      startsAt: "2030-10-13T23:00:00.000Z",
      endsAt: "2030-10-13T23:50:00.000Z",
      leaveByAt: "2030-10-13T21:43:00.000Z",
      kidIds: ["k-declan"],
      rsvps: [{ kidId: "k-declan", status: "YES" }],
    })
    const layout = buildCombinedEventLayout({
      items: [mite, squirt],
      currentAdultId: "a1",
      circleId: circle.id,
      kids: circle.kids,
      members: circle.members,
      rideEventFor: (row) =>
        row.id === "mite"
          ? ride("UID:mite", ["k-kian"], ["Kian"], [
              leg("TO", "a1", "Chris"),
              leg("FROM", "a2", "Katy"),
            ])
          : ride("UID:squirt", ["k-declan"], ["Declan"], [
              leg("TO", "a1", "Chris"),
              leg("FROM", "a1", "Chris"),
            ]),
    })

    expect(layout.eyebrow).toBe("Mite 3 + Squirt 1")
    expect(layout.title).toBe("CYH Practice")
    expect(layout.whenLabel).toMatch(/Oct 13,/)
    expect(layout.whenLabel).toMatch(/–/)
    expect(layout.planChip).toEqual({
      label: "You · 3 of 4 legs",
      tone: "route",
    })
    expect(layout.kidRows.map((row) => row.firstName)).toEqual(["Kian", "Declan"])
    expect(layout.kidRows[0]).toMatchObject({
      eventLabel: "Mite 3",
      assignmentLine: "There You · Back Katy",
    })
    expect(layout.kidRows[0]?.there.detail).toMatch(/^You · /)
    expect(layout.kidRows[0]?.back.detail).toMatch(/^Katy · /)
    expect(layout.kidRows[1]).toMatchObject({
      eventLabel: "Squirt 1",
      assignmentLine: "There You · Back You",
    })
  })

  it("leaves the header chip empty when a leg still needs a ride", () => {
    const layout = buildCombinedEventLayout({
      items: [
        item("a", {
          title: "Practice",
          feedName: "U12",
          kidIds: ["k-declan"],
          rsvps: [{ kidId: "k-declan", status: "YES" }],
        }),
        item("b", {
          title: "Practice",
          feedName: "U12",
          startsAt: "2030-10-13T23:00:00.000Z",
          kidIds: ["k-kian"],
          rsvps: [{ kidId: "k-kian", status: "YES" }],
        }),
      ],
      currentAdultId: "a1",
      circleId: circle.id,
      kids: circle.kids,
      members: circle.members,
      rideEventFor: () => null,
    })

    expect(layout.planChip).toBeNull()
    expect(layout.kidRows[0]?.assignmentLine).toBe("There Needs ride · Back Needs ride")
  })
})
