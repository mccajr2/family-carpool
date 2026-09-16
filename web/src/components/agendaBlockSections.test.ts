import { describe, expect, it } from "vitest"

import type {
  CalendarItem,
  CarpoolRide,
  CarpoolRideEvent,
  CarpoolRideLeg,
  FamilyMember,
  Kid,
} from "@/api/types"
import { buildAgendaBlockSections } from "@/components/agendaBlockSections"
import {
  ALREADY_COVERED,
  NOT_YOUR_JOB_TONIGHT,
} from "@/components/coverageCopy"
import { formatSiblingDriveClock } from "@/components/driveBlockAgendaLinks"

const kids: Kid[] = [
  { id: "k-declan", displayName: "Declan" },
  { id: "k-kian", displayName: "Kian" },
]

const members: FamilyMember[] = [
  {
    adultId: "a-chris",
    email: "chris@example.com",
    displayName: "Chris McCarthy",
    role: "ORGANIZER",
  },
  {
    adultId: "a-mom",
    email: "mom@example.com",
    displayName: "Kian's Mom",
    role: "CAREGIVER",
  },
]

function item(
  id: string,
  startsAt: string,
  overrides: Partial<CalendarItem> = {},
): CalendarItem {
  return {
    id,
    source: "FEED",
    title: id,
    startsAt,
    endsAt: null,
    location: "Simoni Rink",
    kidIds: ["k-declan"],
    feedId: "f1",
    feedName: "U12",
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
    rsvps: [{ kidId: "k-declan", status: "YES" }],
    driveBlockLinks: [],
    ...overrides,
  }
}

function leg(
  kind: "TO" | "FROM",
  assigneeAdultId: string,
  assigneeDisplayName: string,
): CarpoolRideLeg {
  return {
    kind,
    phase: "CONFIRMED",
    assigneeAdultId,
    assigneeDisplayName,
    assigneeCircleId: "c1",
    assigneeCircleName: "House",
    placeId: null,
    placeName: null,
    placeAddress: null,
    meetSide: "REQUESTER",
  }
}

function ride(
  kidIds: string[],
  legs: CarpoolRideLeg[],
  partial: Partial<CarpoolRide> = {},
): CarpoolRide {
  return {
    id: "r1",
    spaceId: "s1",
    eventKey: "UID:a",
    requestingCircleId: "c1",
    requestingCircleName: "House",
    requestedByAdultId: "a-chris",
    kidIds,
    kidFirstNames: kidIds.map((id) =>
      id === "k-kian" ? "Kian" : "Declan",
    ),
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
    ...partial,
  }
}

function rideEvent(own: CarpoolRide): CarpoolRideEvent {
  return {
    eventKey: own.eventKey,
    title: "Practice",
    startsAt: "2030-08-15T18:00:00.000Z",
    endsAt: "2030-08-15T19:00:00.000Z",
    defaultKidIds: own.kidIds,
    ownRequests: [own],
    ownLegs: own.legs,
    ownRequest: own,
    otherRequests: [],
  }
}

describe("buildAgendaBlockSections", () => {
  it("builds drop-off run, event bands, muted other jobs, and pickup run", () => {
    const a = item("Practice A", "2030-08-15T18:00:00.000Z", {
      id: "a",
      endsAt: "2030-08-15T19:00:00.000Z",
      leaveByAt: "2030-08-15T17:40:00.000Z",
      kidIds: ["k-declan", "k-kian"],
      rsvps: [
        { kidId: "k-declan", status: "YES" },
        { kidId: "k-kian", status: "YES" },
      ],
    })
    const b = item("Practice B", "2030-08-15T19:00:00.000Z", {
      id: "b",
      endsAt: "2030-08-15T20:00:00.000Z",
      kidIds: ["k-declan"],
    })

    const rides = new Map<string, CarpoolRideEvent>([
      [
        "FEED-a",
        rideEvent(
          ride(
            ["k-declan", "k-kian"],
            [
              leg("TO", "a-chris", "Chris"),
              leg("FROM", "a-mom", "Kian's Mom"),
            ],
          ),
        ),
      ],
      [
        "FEED-b",
        rideEvent(
          ride(["k-declan"], [leg("FROM", "a-chris", "Chris")], {
            eventKey: "UID:b",
          }),
        ),
      ],
    ])

    const sections = buildAgendaBlockSections({
      items: [a, b],
      currentAdultId: "a-chris",
      circleId: "c1",
      kids,
      members,
      rideEventFor: (row) => rides.get(`${row.source}-${row.id}`),
    })

    expect(sections.toRun).toEqual(
      expect.objectContaining({
        leg: "TO",
        chipLabel: "You're driving · 2 riders",
        summaryLine: "Declan and Kian",
      }),
    )
    expect(sections.toRun?.heading).toMatch(/Drop-off run$/)
    expect(sections.toRun?.representativeItem.id).toBe("a")
    expect(sections.eventBands).toHaveLength(2)
    expect(sections.eventBands[0]?.line).toContain("Practice A")
    expect(sections.eventBands[1]?.line).toContain("Practice B")
    expect(sections.mutedBand?.heading).toBe(NOT_YOUR_JOB_TONIGHT)
    expect(sections.mutedBand?.lines.some((line) => line.includes("Kian"))).toBe(
      true,
    )
    expect(sections.mutedBand?.lines[0]).toMatch(/your home/)
    expect(sections.fromRun).toEqual(
      expect.objectContaining({
        leg: "FROM",
        chipLabel: "You're driving · 1 rider",
        summaryLine: "Declan · Simoni Rink → home",
      }),
    )
    expect(sections.fromRun?.heading).toMatch(/Pickup run$/)
    expect(sections.fromRun?.representativeItem.id).toBe("b")
    expect(sections.roundTripBanner).toBe(
      "You're already driving Declan round trip",
    )
  })

  it("picks the earliest startsAt as the View-route representative for a multi-item TO run", () => {
    const early = item("Practice A", "2030-08-15T18:00:00.000Z", {
      id: "a",
      leaveByAt: "2030-08-15T17:40:00.000Z",
      kidIds: ["k-declan"],
    })
    const later = item("Practice B", "2030-08-15T19:00:00.000Z", {
      id: "b",
      leaveByAt: "2030-08-15T18:40:00.000Z",
      kidIds: ["k-declan"],
    })
    const rides = new Map<string, CarpoolRideEvent>([
      [
        "FEED-a",
        rideEvent(ride(["k-declan"], [leg("TO", "a-chris", "Chris")])),
      ],
      [
        "FEED-b",
        rideEvent(
          ride(["k-declan"], [leg("TO", "a-chris", "Chris")], {
            eventKey: "UID:b",
          }),
        ),
      ],
    ])

    const sections = buildAgendaBlockSections({
      items: [later, early],
      currentAdultId: "a-chris",
      circleId: "c1",
      kids,
      members,
      rideEventFor: (row) => rides.get(`${row.source}-${row.id}`),
    })

    expect(sections.toRun?.representativeItem.id).toBe("a")
    expect(sections.toRun?.representativeItem.startsAt).toBe(early.startsAt)
  })

  it("shows round-trip banner when the viewer owns TO and FROM for the same kid", () => {
    const a = item("Practice A", "2030-08-15T18:00:00.000Z", {
      id: "a",
      endsAt: "2030-08-15T19:00:00.000Z",
      kidIds: ["k-declan"],
    })
    const b = item("Practice B", "2030-08-15T19:00:00.000Z", {
      id: "b",
      endsAt: "2030-08-15T20:00:00.000Z",
      kidIds: ["k-declan"],
    })

    const sections = buildAgendaBlockSections({
      items: [a, b],
      currentAdultId: "a-chris",
      circleId: "c1",
      kids,
      members,
      rideEventFor: (row) =>
        row.id === "a"
          ? rideEvent(
              ride(["k-declan"], [
                leg("TO", "a-chris", "Chris"),
                leg("FROM", "a-chris", "Chris"),
              ]),
            )
          : rideEvent(
              ride(["k-declan"], [leg("FROM", "a-chris", "Chris")], {
                eventKey: "UID:b",
              }),
            ),
    })

    expect(sections.roundTripBanner).toBe(
      "You're already driving Declan round trip",
    )
  })

  it("qualifies another household's home on muted FROM lines", () => {
    const a = item("Practice A", "2030-08-15T18:00:00.000Z", {
      id: "a",
      endsAt: "2030-08-15T19:00:00.000Z",
      kidIds: ["k-guest"],
      rsvps: [{ kidId: "k-guest", status: "YES" }],
    })
    const b = item("Practice B", "2030-08-15T19:00:00.000Z", {
      id: "b",
      endsAt: "2030-08-15T20:00:00.000Z",
    })
    const guestKids = [...kids, { id: "k-guest", displayName: "Apollo" }]

    const sections = buildAgendaBlockSections({
      items: [a, b],
      currentAdultId: "a-chris",
      circleId: "c1",
      kids: guestKids,
      members,
      viewerHouseholdKidIds: new Set(["k-declan", "k-kian"]),
      rideEventFor: () =>
        rideEvent(
          ride(
            ["k-guest"],
            [
              leg("TO", "a-chris", "Chris"),
              leg("FROM", "a-mom", "Kian's Mom"),
            ],
            { kidFirstNames: ["Apollo"] },
          ),
        ),
    })

    expect(sections.mutedBand?.lines[0]).toMatch(/Apollo's home/)
  })

  it("uses Already covered when the viewer has no driving run on the block", () => {
    const a = item("Practice A", "2030-08-15T18:00:00.000Z", {
      id: "a",
      endsAt: "2030-08-15T19:00:00.000Z",
      kidIds: ["k-declan"],
    })
    const b = item("Practice B", "2030-08-15T19:00:00.000Z", {
      id: "b",
      endsAt: "2030-08-15T20:00:00.000Z",
      kidIds: ["k-declan"],
    })

    const sections = buildAgendaBlockSections({
      items: [a, b],
      currentAdultId: "a-chris",
      circleId: "c1",
      kids,
      members,
      rideEventFor: () =>
        rideEvent(
          ride(["k-declan"], [leg("TO", "a-mom", "Kian's Mom")]),
        ),
    })

    expect(sections.toRun).toBeNull()
    expect(sections.fromRun).toBeNull()
    expect(sections.mutedBand?.heading).toBe(ALREADY_COVERED)
    expect(sections.mutedBand?.lines[0]).toMatch(/Declan/)
  })

  it("treats coverage CONFIRMED by the viewer as a round-trip (TO + FROM)", () => {
    const a = item("Practice A", "2030-08-15T18:00:00.000Z", {
      id: "a",
      endsAt: "2030-08-15T19:00:00.000Z",
      leaveByAt: "2030-08-15T17:40:00.000Z",
      coverages: [
        {
          id: "cov1",
          coveringAdultId: "a-chris",
          coveringAdultDisplayName: "Chris",
          assignedByAdultId: "a-chris",
          kidIds: ["k-declan"],
          status: "CONFIRMED",
          leaveFromPlaceId: null,
          leaveFromPlaceName: null,
          leaveFromAddress: null,
          leaveByAt: null,
          leaveByStatus: null,
          leaveByReason: null,
        },
      ],
    })
    const b = item("Practice B", "2030-08-15T19:00:00.000Z", {
      id: "b",
      endsAt: "2030-08-15T20:00:00.000Z",
      coverages: [
        {
          id: "cov2",
          coveringAdultId: "a-chris",
          coveringAdultDisplayName: "Chris",
          assignedByAdultId: "a-chris",
          kidIds: ["k-declan"],
          status: "CONFIRMED",
          leaveFromPlaceId: null,
          leaveFromPlaceName: null,
          leaveFromAddress: null,
          leaveByAt: null,
          leaveByStatus: null,
          leaveByReason: null,
        },
      ],
    })

    const sections = buildAgendaBlockSections({
      items: [a, b],
      currentAdultId: "a-chris",
      circleId: "c1",
      kids,
      members,
      rideEventFor: () => null,
    })

    expect(sections.toRun?.chipLabel).toBe("You're driving · 1 rider")
    expect(sections.toRun?.summaryLine).toBe("Declan")
    expect(sections.fromRun?.chipLabel).toBe("You're driving · 1 rider")
    expect(sections.fromRun?.summaryLine).toBe("Declan · Simoni Rink → home")
    expect(sections.fromRun?.heading).toMatch(/Pickup run$/)
    expect(sections.roundTripBanner).toBe(
      "You're already driving Declan round trip",
    )
    expect(sections.mutedBand).toBeNull()
  })

  it("keeps coverage-only kids on the pickup run when a sibling event has an explicit PLAN", () => {
    // Dogfood: Kian coverage-only on the early event; Declan PLAN TO+FROM on the later.
    const mite = item("CYH Mite Practice", "2030-09-22T22:00:00.000Z", {
      id: "mite",
      endsAt: "2030-09-22T22:50:00.000Z",
      leaveByAt: "2030-09-22T21:41:00.000Z",
      location: "155 Gore St, Cambridge, MA",
      kidIds: ["k-kian"],
      rsvps: [{ kidId: "k-kian", status: "YES" }],
      coverages: [
        {
          id: "cov-kian",
          coveringAdultId: "a-chris",
          coveringAdultDisplayName: "Chris",
          assignedByAdultId: "a-chris",
          kidIds: ["k-kian"],
          status: "CONFIRMED",
          leaveFromPlaceId: null,
          leaveFromPlaceName: null,
          leaveFromAddress: null,
          leaveByAt: null,
          leaveByStatus: null,
          leaveByReason: null,
        },
      ],
    })
    const squirt = item("CYH Squirt 1 Practice", "2030-09-22T23:00:00.000Z", {
      id: "squirt",
      endsAt: "2030-09-22T23:50:00.000Z",
      leaveByAt: "2030-09-22T22:43:00.000Z",
      location: "155 Gore St, Cambridge, MA",
      kidIds: ["k-declan"],
      rsvps: [{ kidId: "k-declan", status: "YES" }],
      coverages: [
        {
          id: "cov-declan",
          coveringAdultId: "a-chris",
          coveringAdultDisplayName: "Chris",
          assignedByAdultId: "a-chris",
          kidIds: ["k-declan"],
          status: "CONFIRMED",
          leaveFromPlaceId: null,
          leaveFromPlaceName: null,
          leaveFromAddress: null,
          leaveByAt: null,
          leaveByStatus: null,
          leaveByReason: null,
        },
      ],
    })

    const sections = buildAgendaBlockSections({
      items: [mite, squirt],
      currentAdultId: "a-chris",
      circleId: "c1",
      kids,
      members,
      rideEventFor: (row) => {
        if (row.id !== "squirt") {
          return null
        }
        return rideEvent(
          ride(
            ["k-declan"],
            [
              leg("TO", "a-chris", "Chris"),
              leg("FROM", "a-chris", "Chris"),
            ],
            {
              eventKey: "UID:squirt",
              pickupPlaceName: "Home",
              pickupAddress: "390 Huron Ave",
            },
          ),
        )
      },
    })

    expect(sections.toRun?.chipLabel).toBe("You're driving · 2 riders")
    expect(sections.toRun?.summaryLine).toBe("Kian and Declan")
    expect(sections.fromRun?.chipLabel).toBe("You're driving · 2 riders")
    expect(sections.fromRun?.summaryLine).toBe(
      "Kian and Declan · 155 Gore St, Cambridge, MA → home",
    )
    expect(sections.fromRun?.representativeItem.id).toBe("squirt")
    expect(sections.roundTripBanner).toBe(
      "You're already driving Kian and Declan round trip",
    )
  })

  it("does not invent FROM from coverage when a non-blank plan already owns the kid", () => {
    const a = item("Practice A", "2030-08-15T18:00:00.000Z", {
      id: "a",
      endsAt: "2030-08-15T19:00:00.000Z",
      kidIds: ["k-declan"],
      coverages: [
        {
          id: "cov1",
          coveringAdultId: "a-chris",
          coveringAdultDisplayName: "Chris",
          assignedByAdultId: "a-chris",
          kidIds: ["k-declan"],
          status: "CONFIRMED",
          leaveFromPlaceId: null,
          leaveFromPlaceName: null,
          leaveFromAddress: null,
          leaveByAt: null,
          leaveByStatus: null,
          leaveByReason: null,
        },
      ],
    })

    const sections = buildAgendaBlockSections({
      items: [a],
      currentAdultId: "a-chris",
      circleId: "c1",
      kids,
      members,
      rideEventFor: () =>
        rideEvent(
          ride(["k-declan"], [
            {
              ...leg("TO", "a-chris", "Chris"),
            },
            {
              kind: "FROM",
              phase: "NEEDS_RIDE",
              assigneeAdultId: null,
              assigneeDisplayName: null,
              assigneeCircleId: null,
              assigneeCircleName: null,
              placeId: null,
              placeName: null,
              placeAddress: null,
              meetSide: "REQUESTER",
            },
          ]),
        ),
    })

    expect(sections.toRun?.summaryLine).toBe("Declan")
    expect(sections.fromRun).toBeNull()
    expect(sections.roundTripBanner).toBeNull()
  })

  it("includes ACCEPTED inbound riders on viewer-owned runs (You're driving · +n)", () => {
    const squirt = item("CYH Squirt 1 Practice", "2030-09-22T23:00:00.000Z", {
      id: "squirt",
      endsAt: "2030-09-22T23:50:00.000Z",
      leaveByAt: "2030-09-22T22:43:00.000Z",
      kidIds: ["k-declan"],
      rsvps: [{ kidId: "k-declan", status: "YES" }],
      coverages: [
        {
          id: "cov-declan",
          coveringAdultId: "a-chris",
          coveringAdultDisplayName: "Chris",
          assignedByAdultId: "a-chris",
          kidIds: ["k-declan"],
          status: "CONFIRMED",
          leaveFromPlaceId: null,
          leaveFromPlaceName: null,
          leaveFromAddress: null,
          leaveByAt: null,
          leaveByStatus: null,
          leaveByReason: null,
        },
      ],
    })
    const mite = item("CYH Mite Practice", "2030-09-22T22:00:00.000Z", {
      id: "mite",
      endsAt: "2030-09-22T22:50:00.000Z",
      leaveByAt: "2030-09-22T21:41:00.000Z",
      kidIds: ["k-kian"],
      rsvps: [{ kidId: "k-kian", status: "YES" }],
      coverages: [
        {
          id: "cov-kian",
          coveringAdultId: "a-chris",
          coveringAdultDisplayName: "Chris",
          assignedByAdultId: "a-chris",
          kidIds: ["k-kian"],
          status: "CONFIRMED",
          leaveFromPlaceId: null,
          leaveFromPlaceName: null,
          leaveFromAddress: null,
          leaveByAt: null,
          leaveByStatus: null,
          leaveByReason: null,
        },
      ],
    })

    const inboundApollo = ride(
      ["k-apollo"],
      [
        {
          kind: "TO",
          phase: "CONFIRMED",
          assigneeAdultId: null,
          assigneeDisplayName: null,
          assigneeCircleId: "c1",
          assigneeCircleName: "House",
          placeId: null,
          placeName: null,
          placeAddress: null,
          meetSide: "REQUESTER",
        },
        {
          kind: "FROM",
          phase: "CONFIRMED",
          assigneeAdultId: null,
          assigneeDisplayName: null,
          assigneeCircleId: "c1",
          assigneeCircleName: "House",
          placeId: null,
          placeName: null,
          placeAddress: null,
          meetSide: "REQUESTER",
        },
      ],
      {
        id: "ask-apollo",
        eventKey: "UID:squirt",
        status: "ACCEPTED",
        requestingCircleId: "c-apollo",
        requestingCircleName: "Apollo's family",
        acceptedByAdultId: "a-chris",
        acceptingCircleId: "c1",
        acceptingCircleName: "House",
        kidFirstNames: ["Apollo"],
      },
    )

    const sections = buildAgendaBlockSections({
      items: [mite, squirt],
      currentAdultId: "a-chris",
      circleId: "c1",
      kids,
      members,
      rideEventFor: (row) => {
        if (row.id !== "squirt") {
          return null
        }
        return {
          eventKey: "UID:squirt",
          title: "Squirt",
          startsAt: squirt.startsAt,
          endsAt: squirt.endsAt,
          defaultKidIds: ["k-declan"],
          ownRequests: [],
          ownLegs: null,
          ownRequest: null,
          otherRequests: [inboundApollo],
        }
      },
    })

    expect(sections.toRun?.chipLabel).toBe("You're driving · 3 riders")
    expect(sections.toRun?.summaryLine).toMatch(/Apollo/)
    expect(sections.toRun?.summaryLine).toMatch(/Declan/)
    expect(sections.toRun?.summaryLine).toMatch(/Kian/)
    // Pickup still includes Kian (hang) + Declan + accepted inbound Apollo.
    expect(sections.fromRun?.chipLabel).toBe("You're driving · 3 riders")
    expect(sections.fromRun?.summaryLine).toMatch(/Apollo/)
    expect(sections.fromRun?.summaryLine).toMatch(/Declan/)
    expect(sections.fromRun?.summaryLine).toMatch(/Kian/)
    expect(sections.roundTripBanner).toMatch(/Apollo/)
    expect(sections.roundTripBanner).not.toMatch(/Kid/)
  })

  it("uses the earliest event's leave-by for TO, not a later home-based estimate", () => {
    const early = item("Practice A", "2030-08-15T18:00:00.000Z", {
      id: "a",
      endsAt: "2030-08-15T19:00:00.000Z",
      leaveByAt: null,
      leaveByStatus: "UNAVAILABLE",
      kidIds: ["k-kian"],
      rsvps: [{ kidId: "k-kian", status: "YES" }],
      coverages: [
        {
          id: "cov-k",
          coveringAdultId: "a-chris",
          coveringAdultDisplayName: "Chris",
          assignedByAdultId: "a-chris",
          kidIds: ["k-kian"],
          status: "CONFIRMED",
          leaveFromPlaceId: null,
          leaveFromPlaceName: null,
          leaveFromAddress: null,
          leaveByAt: null,
          leaveByStatus: null,
          leaveByReason: null,
        },
      ],
    })
    const later = item("Practice B", "2030-08-15T19:00:00.000Z", {
      id: "b",
      endsAt: "2030-08-15T20:00:00.000Z",
      // Solo home leave-by that is earlier than A's start — must not win the hang clock.
      leaveByAt: "2030-08-15T17:30:00.000Z",
      leaveByStatus: "OK",
      kidIds: ["k-declan"],
      coverages: [
        {
          id: "cov-d",
          coveringAdultId: "a-chris",
          coveringAdultDisplayName: "Chris",
          assignedByAdultId: "a-chris",
          kidIds: ["k-declan"],
          status: "CONFIRMED",
          leaveFromPlaceId: null,
          leaveFromPlaceName: null,
          leaveFromAddress: null,
          leaveByAt: null,
          leaveByStatus: null,
          leaveByReason: null,
        },
      ],
    })

    const sections = buildAgendaBlockSections({
      items: [early, later],
      currentAdultId: "a-chris",
      circleId: "c1",
      kids,
      members,
      rideEventFor: () => null,
    })

    expect(sections.toRun?.heading).toMatch(/Drop-off run$/)
    expect(sections.toRun?.heading).not.toMatch(/5:30/)
    // Earliest event start (18:00Z → local) — not the later event's 17:30Z home leave-by.
    const earlyClock = formatSiblingDriveClock("2030-08-15T18:00:00.000Z")
    expect(sections.toRun?.heading.startsWith(`${earlyClock} ·`)).toBe(true)
  })
})
