import { describe, expect, it, vi } from "vitest"

import type { CalendarItem } from "@/api/types"
import { carpoolLegsBoth } from "@/api/carpoolLegs"
import {
  buildAgendaBlockDecisionSections,
  classifyCombinedKidRow,
  eventKeyForMember,
  fanOutAssignCoverage,
  fanOutCreateRide,
  fanOutSaveKidPlans,
  fanOutSaveRidePlan,
  kidIdsForMemberEvent,
} from "@/components/agendaBlockDecision"
import type { CombinedKidRow } from "@/components/combinedEventLayout"
import type { DriverPickerSavePlanLegs } from "@/components/DriverPicker"

function kidRow(
  partial: Partial<CombinedKidRow> &
    Pick<CombinedKidRow, "key" | "itemKey" | "kidId" | "firstName">,
): CombinedKidRow {
  return {
    initial: partial.firstName.slice(0, 1),
    eventLabel: "Practice",
    timeLabel: "6:00 PM",
    there: { who: "Needs ride", detail: "Needs ride" },
    back: { who: "Needs ride", detail: "Needs ride" },
    assignmentLine: "There Needs ride · Back Needs ride",
    ...partial,
  }
}

function item(
  id: string,
  kidIds: string[],
  partial: Partial<CalendarItem> = {},
): CalendarItem {
  return {
    id,
    source: "FEED",
    title: `Practice ${id}`,
    startsAt: "2030-08-15T17:00:00.000Z",
    endsAt: null,
    location: "Field",
    kidIds,
    feedId: "f1",
    feedName: "U12",
    eventKey: `UID:${id}`,
    leaveFromPlaceId: "p1",
    leaveFromPlaceName: "Home",
    leaveFromAddress: null,
    leaveByAt: null,
    leaveByStatus: "OK",
    leaveByReason: null,
    coverages: [],
    uncoveredKidIds: kidIds,
    conflicts: [],
    rsvps: kidIds.map((kidId) => ({ kidId, status: "YES" as const })),
    driveBlockLinks: [],
    ...partial,
  }
}

const emptyLegs: DriverPickerSavePlanLegs = {
  to: { action: "HOUSEHOLD", assigneeAdultId: "a1" },
  from: { action: "HOUSEHOLD", assigneeAdultId: "a1" },
  toPlace: { placeId: "p1", placeAddress: null },
  fromPlace: { placeId: "p1", placeAddress: null },
  toMeetSide: "REQUESTER",
  fromMeetSide: "REQUESTER",
}

describe("agendaBlockDecision", () => {
  it("filters kid ids to those on the member event", () => {
    expect(kidIdsForMemberEvent(item("a", ["k1", "k2"]), ["k2", "k3"])).toEqual([
      "k2",
    ])
  })

  it("resolves event keys from ride event or item.eventKey", () => {
    const row = item("a", ["k1"])
    expect(eventKeyForMember(row, null)).toBe("UID:a")
    expect(
      eventKeyForMember(row, {
        eventKey: "UID:ride",
        title: "Practice",
        startsAt: row.startsAt,
        endsAt: null,
        defaultKidIds: ["k1"],
        ownRequest: null,
        ownRequests: [],
        ownLegs: carpoolLegsBoth("NEEDS_RIDE"),
        otherRequests: [],
      }),
    ).toBe("UID:ride")
  })

  it("fans out assign coverage one call per member with kids in scope", () => {
    const onAssign = vi.fn()
    const members = [item("a", ["k1"]), item("b", ["k2"]), item("c", ["k9"])]
    fanOutAssignCoverage(members, "a1", ["k1", "k2"], onAssign, {
      lockStanding: true,
    })
    expect(onAssign).toHaveBeenCalledTimes(2)
    expect(onAssign).toHaveBeenNthCalledWith(
      1,
      members[0],
      "a1",
      ["k1"],
      { lockStanding: true },
    )
    expect(onAssign).toHaveBeenNthCalledWith(
      2,
      members[1],
      "a1",
      ["k2"],
      { lockStanding: true },
    )
  })

  it("fans out create ride one call per member event with kid ids", () => {
    const onCreate = vi.fn()
    const members = [item("a", ["k1"]), item("b", ["k1", "k2"])]
    fanOutCreateRide(
      members,
      ["k1"],
      () => null,
      onCreate,
    )
    expect(onCreate).toHaveBeenCalledTimes(2)
    expect(onCreate).toHaveBeenNthCalledWith(1, members[0], "UID:a", ["k1"])
    expect(onCreate).toHaveBeenNthCalledWith(2, members[1], "UID:b", ["k1"])
  })

  it("fans out save ride plan with the same legs per member in scope", () => {
    const onSave = vi.fn()
    const members = [item("a", ["k1"]), item("b", ["k2"])]
    fanOutSaveRidePlan(members, emptyLegs, ["k1", "k2"], onSave)
    expect(onSave).toHaveBeenCalledTimes(2)
    expect(onSave).toHaveBeenNthCalledWith(1, members[0], emptyLegs, ["k1"], undefined)
    expect(onSave).toHaveBeenNthCalledWith(2, members[1], emptyLegs, ["k2"], undefined)
  })

  it("routes kid-split plans to the member that owns each kid", () => {
    const onSave = vi.fn()
    const members = [item("a", ["k1"]), item("b", ["k2"])]
    const plans = [
      { kidId: "k1", legs: emptyLegs },
      { kidId: "k2", legs: emptyLegs },
    ]
    fanOutSaveKidPlans(members, plans, onSave, { standingAsk: true })
    expect(onSave).toHaveBeenCalledTimes(2)
    expect(onSave).toHaveBeenNthCalledWith(
      1,
      members[0],
      [plans[0]],
      { standingAsk: true },
    )
    expect(onSave).toHaveBeenNthCalledWith(
      2,
      members[1],
      [plans[1]],
      { standingAsk: true },
    )
  })

  it("classifies Needs ride as open, Asked team as asked, assignee as assigned", () => {
    expect(
      classifyCombinedKidRow({
        there: { who: "Needs ride", detail: "Needs ride" },
        back: { who: "Needs ride", detail: "Needs ride" },
      }),
    ).toBe("open")
    expect(
      classifyCombinedKidRow({
        there: { who: "Asked team", detail: "Asked team" },
        back: { who: "Asked team", detail: "Asked team" },
      }),
    ).toBe("asked")
    expect(
      classifyCombinedKidRow({
        there: { who: "You", detail: "You" },
        back: { who: "Katy", detail: "Katy" },
      }),
    ).toBe("assigned")
    expect(
      classifyCombinedKidRow({
        there: { who: "Needs ride", detail: "Needs ride" },
        back: { who: "You", detail: "You" },
      }),
    ).toBe("open")
  })

  it("groups identical open kids into one picker and emits cancel for Asked team", () => {
    const a = item("a", ["k1"])
    const b = item("b", ["k2"])
    const c = item("c", ["k1"], { kidIds: ["k1"] })
    const askedRide = {
      id: "ask-b",
      spaceId: "s1",
      eventKey: "UID:b",
      requestingCircleId: "c1",
      requestingCircleName: "House",
      requestedByAdultId: "a1",
      kidIds: ["k2"],
      kidFirstNames: ["Kian"],
      seats: 1,
      pickupPlaceName: "Home",
      pickupAddress: "1 Main",
      pickupTown: null,
      detourMinutes: null,
      status: "PENDING" as const,
      legs: [
        {
          kind: "TO" as const,
          phase: "ASKED_TEAM" as const,
          assigneeAdultId: null,
          assigneeDisplayName: null,
          assigneeCircleId: null,
          assigneeCircleName: null,
          placeId: null,
          placeName: null,
          placeAddress: null,
          meetSide: "REQUESTER" as const,
        },
        {
          kind: "FROM" as const,
          phase: "ASKED_TEAM" as const,
          assigneeAdultId: null,
          assigneeDisplayName: null,
          assigneeCircleId: null,
          assigneeCircleName: null,
          placeId: null,
          placeName: null,
          placeAddress: null,
          meetSide: "REQUESTER" as const,
        },
      ],
      passedByMe: false,
      passedByAdultNames: [],
      acceptedByAdultId: null,
      acceptingCircleId: null,
      acceptingCircleName: null,
    }
    const sections = buildAgendaBlockDecisionSections({
      items: [a, b, c],
      kidRows: [
        kidRow({
          key: "FEED-a-k1",
          itemKey: "FEED-a",
          kidId: "k1",
          firstName: "Declan",
        }),
        kidRow({
          key: "FEED-b-k2",
          itemKey: "FEED-b",
          kidId: "k2",
          firstName: "Kian",
          there: { who: "Asked team", detail: "Asked team" },
          back: { who: "Asked team", detail: "Asked team" },
        }),
        kidRow({
          key: "FEED-c-k1",
          itemKey: "FEED-c",
          kidId: "k1",
          firstName: "Declan",
          there: { who: "You", detail: "You" },
          back: { who: "You", detail: "You" },
        }),
      ],
      rideEventFor: (row) =>
        row.id === "b"
          ? {
              eventKey: "UID:b",
              title: "Practice",
              startsAt: b.startsAt,
              endsAt: null,
              defaultKidIds: ["k2"],
              ownRequest: askedRide,
              ownRequests: [askedRide],
              ownLegs: askedRide.legs,
              otherRequests: [],
            }
          : null,
    })

    expect(sections).toHaveLength(2)
    expect(sections[0]).toMatchObject({
      kind: "picker",
      kidIds: ["k1"],
      title: "DECLAN — ROUND TRIP",
      postLabel: "Post to team — Declan, round trip",
    })
    if (sections[0]?.kind === "picker") {
      expect(sections[0].memberItems.map((row) => row.id)).toEqual(["a"])
    }
    expect(sections[1]).toMatchObject({
      kind: "cancelAsk",
      ride: { id: "ask-b" },
      kidIds: ["k2"],
    })
  })

  it("merges two kids with the same open state into one titled picker", () => {
    const a = item("a", ["k1"])
    const b = item("b", ["k2"])
    const sections = buildAgendaBlockDecisionSections({
      items: [a, b],
      kidRows: [
        kidRow({
          key: "FEED-a-k1",
          itemKey: "FEED-a",
          kidId: "k1",
          firstName: "Declan",
        }),
        kidRow({
          key: "FEED-b-k2",
          itemKey: "FEED-b",
          kidId: "k2",
          firstName: "Kian",
        }),
      ],
      rideEventFor: () => null,
    })

    expect(sections).toHaveLength(1)
    expect(sections[0]).toMatchObject({
      kind: "picker",
      kidIds: ["k1", "k2"],
      title: "DECLAN + KIAN — ROUND TRIP",
      postLabel: "Post to team — Declan + Kian, round trip",
    })
    if (sections[0]?.kind === "picker") {
      expect(sections[0].memberItems.map((row) => row.id)).toEqual(["a", "b"])
    }
  })
})
