import { describe, expect, it } from "vitest"
import type { FamilyCircle } from "@/api/types"
import {
  defaultLeaveFromDisplayName,
  focusLeaveFromEstimateLine,
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
