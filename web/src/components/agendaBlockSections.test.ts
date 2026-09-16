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
    expect(sections.eventBands).toHaveLength(2)
    expect(sections.eventBands[0]?.line).toContain("Practice A")
    expect(sections.eventBands[1]?.line).toContain("Practice B")
    expect(sections.mutedBand?.heading).toBe(NOT_YOUR_JOB_TONIGHT)
    expect(sections.mutedBand?.lines.some((line) => line.includes("Kian"))).toBe(
      true,
    )
    expect(sections.fromRun).toEqual(
      expect.objectContaining({
        leg: "FROM",
        chipLabel: "You're driving · 1 rider",
        summaryLine: "Declan",
      }),
    )
    expect(sections.fromRun?.heading).toMatch(/Pickup run$/)
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

  it("treats coverage CONFIRMED by the viewer as a drop-off run", () => {
    const a = item("Practice A", "2030-08-15T18:00:00.000Z", {
      id: "a",
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
      kids,
      members,
      rideEventFor: () => null,
    })

    expect(sections.toRun?.chipLabel).toBe("You're driving · 1 rider")
    expect(sections.toRun?.summaryLine).toBe("Declan")
    expect(sections.mutedBand).toBeNull()
  })
})
