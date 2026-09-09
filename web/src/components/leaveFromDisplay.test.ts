import { describe, expect, it } from "vitest"
import type { FamilyCircle } from "@/api/types"
import {
  defaultLeaveFromDisplayName,
  focusLeaveFromEstimateLine,
  LEAVE_FROM_ONE_TIME_VALUE,
  leaveFromBodyForPlaceId,
  leaveFromSelectValue,
  resolvedLeaveFromLabel,
} from "./leaveFromDisplay"

const circle = {
  id: "c1",
  name: "House",
  role: "ORGANIZER" as const,
  members: [],
  kids: [],
  places: [
    {
      id: "p2",
      name: "School",
      address: "2 School",
      latitude: 1,
      longitude: 2,
    },
    {
      id: "p1",
      name: "Home",
      address: "1 Main",
      latitude: 1,
      longitude: 2,
    },
  ],
  defaultLeaveFromPlaceId: "p1",
  defaultLeaveFromPlaceName: "Home",
} satisfies FamilyCircle

describe("resolvedLeaveFromLabel", () => {
  it("prefers one-time address, then place name, then default", () => {
    expect(
      resolvedLeaveFromLabel(
        {
          leaveFromPlaceId: null,
          leaveFromPlaceName: null,
          leaveFromAddress: "Jack's house",
        },
        circle,
      ),
    ).toBe("Jack's house")
    expect(
      resolvedLeaveFromLabel(
        {
          leaveFromPlaceId: "p2",
          leaveFromPlaceName: "School",
          leaveFromAddress: null,
        },
        circle,
      ),
    ).toBe("School")
    expect(
      resolvedLeaveFromLabel(
        {
          leaveFromPlaceId: null,
          leaveFromPlaceName: null,
          leaveFromAddress: null,
        },
        circle,
      ),
    ).toBe("Home")
  })
})

describe("defaultLeaveFromDisplayName", () => {
  it("falls back to first located place by name when membership default is unset", () => {
    expect(
      defaultLeaveFromDisplayName({
        ...circle,
        defaultLeaveFromPlaceId: null,
        defaultLeaveFromPlaceName: null,
      }),
    ).toBe("Home")
  })
})

describe("focusLeaveFromEstimateLine", () => {
  it("combines origin with estimate clock without live-traffic wording", () => {
    const line = focusLeaveFromEstimateLine(
      {
        leaveFromPlaceId: null,
        leaveFromPlaceName: "Home",
        leaveFromAddress: null,
        leaveByAt: "2026-08-15T15:25:00Z",
        leaveByStatus: "OK",
        leaveByReason: null,
      },
      circle,
    )
    expect(line).toMatch(/^Leave from Home · estimate /)
    expect(line.toLowerCase()).not.toContain("live traffic")
  })
})

describe("leaveFromSelectValue / leaveFromBodyForPlaceId", () => {
  it("maps Default mode to the membership default place id in the combobox", () => {
    expect(
      leaveFromSelectValue(
        {
          leaveFromPlaceId: null,
          leaveFromPlaceName: null,
          leaveFromAddress: null,
        },
        circle,
      ),
    ).toBe("p1")
    expect(leaveFromBodyForPlaceId("p1", circle)).toEqual({
      leaveFromPlaceId: null,
      leaveFromAddress: null,
    })
    expect(leaveFromBodyForPlaceId("p2", circle)).toEqual({
      leaveFromPlaceId: "p2",
      leaveFromAddress: null,
    })
  })

  it("uses the one-time sentinel when an address override is set", () => {
    expect(
      leaveFromSelectValue(
        {
          leaveFromPlaceId: null,
          leaveFromPlaceName: null,
          leaveFromAddress: "Jack's house",
        },
        circle,
      ),
    ).toBe(LEAVE_FROM_ONE_TIME_VALUE)
  })
})
