import type { CalendarItem } from "@/api/types"
import type { CarpoolRideEvent } from "@/api/types"

/**
 * Whether the signed-in adult is the driving adult for a calendar route
 * (CONFIRMED coverage, or ACCEPTED carpool ride they accepted). Matches the
 * server gate for PUT …/route reorder.
 */
export function isDrivingAdultForCalendarRoute(
  adultId: string | null | undefined,
  item: CalendarItem | null | undefined,
  rideEvent: CarpoolRideEvent | null | undefined,
): boolean {
  if (adultId == null || item == null) {
    return false
  }
  if (
    item.coverages.some(
      (coverage) =>
        coverage.status === "CONFIRMED" && coverage.coveringAdultId === adultId,
    )
  ) {
    return true
  }
  if (rideEvent == null) {
    return false
  }
  const rides = [...rideEvent.ownRequests, ...rideEvent.otherRequests]
  return rides.some(
    (ride) => ride.status === "ACCEPTED" && ride.acceptedByAdultId === adultId,
  )
}
