import { describe, expect, it } from "vitest"

import type {
  CalendarItem,
  CarpoolRide,
  CarpoolRideEvent,
  CarpoolRideLeg,
  FamilyCircle,
} from "@/api/types"
import {
  agendaCommitmentActionsForItem,
  agendaCommitmentActionsForItems,
  blockDepartureItem,
  qualifyCommitmentActionLabels,
} from "@/components/agendaCommitmentActions"
import { REVERT_REASSIGN_YOU } from "@/components/coverageCopy"

const circle: FamilyCircle = {
  id: "c1",
  name: "House",
  role: "ORGANIZER",
  members: [
    {
      adultId: "a1",
      email: "chris@example.com",
      displayName: "Chris",
      role: "ORGANIZER",
    },
    {
      adultId: "a2",
      email: "other@example.com",
      displayName: "Jordan",
      role: "CAREGIVER",
    },
  ],
  kids: [
    { id: "k1", displayName: "Kian" },
    { id: "k2", displayName: "Declan" },
  ],
  places: [],
  defaultLeaveFromPlaceId: null,
  defaultLeaveFromPlaceName: null,
}

function item(
  id: string,
  startsAt: string,
  overrides: Partial<CalendarItem> = {},
): CalendarItem {
  return {
    id,
    source: "FEED",
    title: id === "mite" ? "Mite Practice" : id === "squirt" ? "Squirt Practice" : id,
    startsAt,
    endsAt: null,
    location: "155 Gore St",
    kidIds: ["k1"],
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
    rsvps: [{ kidId: "k1", status: "YES" }],
    driveBlockLinks: [],
    ...overrides,
  }
}

function confirmedCoverage(adultId: string, kidIds: string[]) {
  return {
    id: `cov-${kidIds.join("-")}`,
    coveringAdultId: adultId,
    coveringAdultDisplayName: "Chris",
    assignedByAdultId: adultId,
    kidIds,
    status: "CONFIRMED" as const,
    leaveFromPlaceId: null,
    leaveFromPlaceName: null,
    leaveFromAddress: null,
    leaveByAt: null,
    leaveByStatus: null,
    leaveByReason: null,
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
    assigneeCircleId: null,
    assigneeCircleName: null,
    placeId: null,
    placeName: null,
    placeAddress: null,
    meetSide: "REQUESTER",
  }
}

function rideEvent(own: CarpoolRide): CarpoolRideEvent {
  return {
    eventKey: own.eventKey,
    title: "Practice",
    startsAt: "2030-09-22T22:00:00.000Z",
    endsAt: "2030-09-22T23:00:00.000Z",
    defaultKidIds: own.kidIds,
    ownRequests: [own],
    ownLegs: own.legs,
    ownRequest: own,
    otherRequests: [],
  }
}

describe("agendaCommitmentActions", () => {
  it("emits reassign + not-going for coverage-only confirmed driving", () => {
    const mite = item("mite", "2030-09-22T22:00:00.000Z", {
      coverages: [confirmedCoverage("a1", ["k1"])],
      rsvps: [{ kidId: "k1", status: "YES" }],
    })

    const actions = agendaCommitmentActionsForItem({
      item: mite,
      circle,
      currentAdultId: "a1",
      rideEvent: null,
    })

    expect(actions.some((row) => row.kind === "cant-make-it")).toBe(true)
    expect(actions.some((row) => row.label === REVERT_REASSIGN_YOU)).toBe(true)
    expect(actions.some((row) => row.kind === "not-going")).toBe(true)
  })

  it("keeps both reassign commitments across a block instead of collapsing labels", () => {
    const mite = item("mite", "2030-09-22T22:00:00.000Z", {
      kidIds: ["k1"],
      coverages: [confirmedCoverage("a1", ["k1"])],
      rsvps: [{ kidId: "k1", status: "YES" }],
    })
    const squirt = item("squirt", "2030-09-22T23:00:00.000Z", {
      kidIds: ["k2"],
      coverages: [confirmedCoverage("a1", ["k2"])],
      rsvps: [{ kidId: "k2", status: "YES" }],
    })

    const actions = agendaCommitmentActionsForItems([mite, squirt], {
      circle,
      currentAdultId: "a1",
      rideEventFor: () => null,
    })

    const reassigns = actions.filter((row) => row.kind === "cant-make-it")
    expect(reassigns).toHaveLength(2)
    expect(reassigns[0]!.label).not.toBe(reassigns[1]!.label)
    expect(reassigns.every((row) => row.label.includes("Reassign"))).toBe(true)
  })

  it("emits inbound withdraw beside household reassign for an added rider", () => {
    const ownCoverage = item("squirt", "2030-09-22T23:00:00.000Z", {
      kidIds: ["k1"],
      coverages: [confirmedCoverage("a1", ["k1"])],
      rsvps: [{ kidId: "k1", status: "YES" }],
    })
    const inboundApollo: CarpoolRide = {
      id: "ask-apollo",
      spaceId: "s1",
      eventKey: "UID:squirt",
      requestingCircleId: "c-apollo",
      requestingCircleName: "Apollo's family",
      requestedByAdultId: "a-apollo",
      kidIds: ["k-apollo"],
      kidFirstNames: ["Apollo"],
      seats: 1,
      pickupPlaceName: "Home",
      pickupAddress: "1 Other",
      pickupTown: null,
      detourMinutes: null,
      status: "ACCEPTED",
      legs: [
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
      passedByMe: false,
      passedByAdultNames: [],
      acceptedByAdultId: "a1",
      acceptingCircleId: "c1",
      acceptingCircleName: "House",
    }

    const actions = agendaCommitmentActionsForItem({
      item: ownCoverage,
      circle,
      currentAdultId: "a1",
      rideEvent: {
        eventKey: "UID:squirt",
        title: "Practice",
        startsAt: "2030-09-22T23:00:00.000Z",
        endsAt: "2030-09-22T23:50:00.000Z",
        defaultKidIds: ["k1"],
        ownRequests: [],
        ownLegs: null,
        ownRequest: null,
        otherRequests: [inboundApollo],
      },
    })

    expect(actions.some((row) => row.kind === "cant-make-it")).toBe(true)
    const withdraw = actions.find((row) => row.kind === "withdraw-inbound")
    expect(withdraw).toMatchObject({
      kind: "withdraw-inbound",
      rideId: "ask-apollo",
      label: "Can't take them anymore",
      kidFirstNames: ["Apollo"],
    })
  })

  it("emits paired household + teammate revert links for a mixed plan", () => {
    const own: CarpoolRide = {
      id: "r1",
      spaceId: "s1",
      eventKey: "UID:squirt",
      requestingCircleId: "c1",
      requestingCircleName: "House",
      requestedByAdultId: "a1",
      kidIds: ["k2"],
      kidFirstNames: ["Declan"],
      seats: 1,
      pickupPlaceName: "Home",
      pickupAddress: "1 Main",
      pickupTown: null,
      detourMinutes: null,
      status: "ACCEPTED",
      legs: [
        leg("TO", "a1", "Chris"),
        {
          kind: "FROM",
          phase: "CONFIRMED",
          assigneeAdultId: "guy",
          assigneeDisplayName: null,
          assigneeCircleId: "s-other",
          assigneeCircleName: "Sharks",
          placeId: null,
          placeName: null,
          placeAddress: null,
          meetSide: "REQUESTER",
        },
      ],
      passedByMe: false,
      passedByAdultNames: [],
      acceptedByAdultId: "guy",
      acceptingCircleId: "s-other",
      acceptingCircleName: "Sharks",
    }
    const squirt = item("squirt", "2030-09-22T23:00:00.000Z", {
      kidIds: ["k2"],
      rsvps: [{ kidId: "k2", status: "YES" }],
      coverages: [confirmedCoverage("a1", ["k2"])],
    })

    const actions = agendaCommitmentActionsForItem({
      item: squirt,
      circle,
      currentAdultId: "a1",
      rideEvent: rideEvent(own),
    })

    const reverts = actions.filter((row) => row.kind === "revert")
    expect(reverts.map((row) => row.assignee.kind).sort()).toEqual([
      "household",
      "teammate",
    ])
    expect(reverts.some((row) => row.label.includes("Reassign"))).toBe(true)
    expect(reverts.some((row) => row.label.includes("Find a new ride"))).toBe(
      true,
    )
  })

  it("qualifies colliding generic labels with kid + event", () => {
    const qualified = qualifyCommitmentActionLabels(
      [
        {
          kind: "cant-make-it",
          key: "a",
          label: REVERT_REASSIGN_YOU,
          testId: "agenda-reassign-link",
          item: item("mite", "2030-09-22T22:00:00.000Z"),
          game: {
            id: "FEED-mite:k1",
            kidId: "k1",
            title: "Mite",
            startsAt: "2030-09-22T22:00:00.000Z",
            order: 1,
            attendance: "going",
            ownRide: { driver: "You", confirmed: true },
            requests: [],
          },
          rideEvent: null,
        },
        {
          kind: "cant-make-it",
          key: "b",
          label: REVERT_REASSIGN_YOU,
          testId: "agenda-reassign-link",
          item: item("squirt", "2030-09-22T23:00:00.000Z", {
            kidIds: ["k2"],
            rsvps: [{ kidId: "k2", status: "YES" }],
          }),
          game: {
            id: "FEED-squirt:k2",
            kidId: "k2",
            title: "Squirt",
            startsAt: "2030-09-22T23:00:00.000Z",
            order: 2,
            attendance: "going",
            ownRide: { driver: "You", confirmed: true },
            requests: [],
          },
          rideEvent: null,
        },
      ],
      circle.kids,
    )

    expect(qualified[0]!.label).toContain("Kian")
    expect(qualified[1]!.label).toContain("Declan")
  })

  it("picks the earliest viewer-owned TO event as hang departure", () => {
    const mite = item("mite", "2030-09-22T22:00:00.000Z", {
      leaveByAt: "2030-09-22T21:41:00.000Z",
      leaveFromPlaceName: "Haggerty",
      coverages: [confirmedCoverage("a1", ["k1"])],
    })
    const squirt = item("squirt", "2030-09-22T23:00:00.000Z", {
      kidIds: ["k2"],
      leaveByAt: "2030-09-22T22:43:00.000Z",
      leaveFromPlaceName: "Home",
      coverages: [confirmedCoverage("a1", ["k2"])],
      rsvps: [{ kidId: "k2", status: "YES" }],
    })

    const departure = blockDepartureItem({
      items: [mite, squirt],
      currentAdultId: "a1",
      rideEventFor: () => null,
    })

    expect(departure?.id).toBe("mite")
    expect(departure?.leaveFromPlaceName).toBe("Haggerty")
  })
})
