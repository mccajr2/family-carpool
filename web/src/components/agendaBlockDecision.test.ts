import { describe, expect, it, vi } from "vitest"

import type { CalendarItem } from "@/api/types"
import { carpoolLegsBoth } from "@/api/carpoolLegs"
import {
  eventKeyForMember,
  fanOutAssignCoverage,
  fanOutCreateRide,
  fanOutSaveKidPlans,
  fanOutSaveRidePlan,
  kidIdsForMemberEvent,
} from "@/components/agendaBlockDecision"
import type { DriverPickerSavePlanLegs } from "@/components/DriverPicker"

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
})
