import { describe, expect, it } from "vitest"

import type { CalendarRoute } from "@/api/types"
import {
  rideScheduleFromCalendarRoute,
  routeLeadCopy,
} from "@/components/rideScheduleFromCalendarRoute"

describe("rideScheduleFromCalendarRoute", () => {
  it("maps an OK route into schedule props", () => {
    const route: CalendarRoute = {
      status: "OK",
      reason: null,
      bufferMinutes: 45,
      stops: [
        { name: "Home", address: "1 Main", kind: "home" },
        {
          name: "Pickup",
          address: "2 Oak",
          kind: "pickup",
          contact: { channel: "push", to: "the Oseis" },
        },
        { name: "Rink", address: "3 Elm", kind: "destination" },
      ],
      legMinutes: [12, 18],
    }

    expect(rideScheduleFromCalendarRoute(route)).toEqual({
      bufferMinutes: 45,
      stops: [
        { name: "Home", address: "1 Main", kind: "home", contact: undefined },
        {
          name: "Pickup",
          address: "2 Oak",
          kind: "pickup",
          contact: { channel: "push", to: "the Oseis" },
        },
        { name: "Rink", address: "3 Elm", kind: "destination", contact: undefined },
      ],
      legMinutes: [12, 18],
    })
  })

  it("returns null for UNAVAILABLE or malformed payloads", () => {
    expect(
      rideScheduleFromCalendarRoute({
        status: "UNAVAILABLE",
        reason: "OSRM_UNAVAILABLE",
        bufferMinutes: 20,
        stops: [],
        legMinutes: [],
      }),
    ).toBeNull()
    expect(
      rideScheduleFromCalendarRoute({
        status: "OK",
        bufferMinutes: 45,
        stops: [{ name: "Home", address: "1 Main", kind: "home" }],
        legMinutes: [],
      }),
    ).toBeNull()
    expect(
      rideScheduleFromCalendarRoute({
        status: "OK",
        bufferMinutes: 45,
        stops: [
          { name: "Home", address: "1 Main", kind: "home" },
          { name: "Rink", address: "3 Elm", kind: "destination" },
        ],
        legMinutes: [12, 18],
      }),
    ).toBeNull()
  })
})

describe("routeLeadCopy", () => {
  it("uses locked 45 / 20 / 0 wording", () => {
    expect(routeLeadCopy(45).badge).toBe("45 min early for games")
    expect(routeLeadCopy(20).badge).toBe("20 min early for practices")
    expect(routeLeadCopy(0).badge).toBe("Arrive on time")
    expect(routeLeadCopy(0).eventNoun).toBe("the event starts")
  })
})
