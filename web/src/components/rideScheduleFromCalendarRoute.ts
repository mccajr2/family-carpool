/**
 * Map GET …/calendar/{source}/{itemId}/route into RideRouteTab schedule props.
 * Returns null when status is not OK or the payload cannot drive schedule math.
 */

import type { CalendarRoute } from "@/api/types"
import type { FixtureRideStop } from "@/components/rideDetailFixtures"
import type { CarpoolRouteSchedule } from "@/components/rideScheduleUtils"

export type RideRouteScheduleView = Omit<CarpoolRouteSchedule, "stops"> & {
  stops: FixtureRideStop[]
}

export function rideScheduleFromCalendarRoute(
  route: CalendarRoute,
): RideRouteScheduleView | null {
  if (route.status !== "OK") {
    return null
  }
  if (route.stops.length < 2) {
    return null
  }
  if (route.legMinutes.length !== route.stops.length - 1) {
    return null
  }
  return {
    bufferMinutes: route.bufferMinutes,
    stops: route.stops.map((stop) => ({
      name: stop.name,
      address: stop.address,
      kind: stop.kind,
      contact: stop.contact
        ? { channel: stop.contact.channel, to: stop.contact.to }
        : undefined,
    })),
    legMinutes: [...route.legMinutes],
  }
}

/** Hero badge / event-noun copy from locked buffer heuristic (45 / 20 / 0). */
export function routeLeadCopy(bufferMinutes: number): {
  badge: string
  eventNoun: string
} {
  if (bufferMinutes === 20) {
    return {
      badge: "20 min early for practices",
      eventNoun: "practice starts",
    }
  }
  if (bufferMinutes === 45) {
    return {
      badge: "45 min early for games",
      eventNoun: "puck drop",
    }
  }
  if (bufferMinutes > 0) {
    return {
      badge: `${bufferMinutes} min early`,
      eventNoun: "the event starts",
    }
  }
  return {
    badge: "Arrive on time",
    eventNoun: "the event starts",
  }
}
