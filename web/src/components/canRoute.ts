/**
 * Gate for Agenda → ride-detail entry. Ported from mockup `canRoute` rules,
 * mapped onto live CoverageGameEvent + CarpoolRideEvent (no API carpoolRoute).
 */

import type { CarpoolRideEvent } from "@/api/types"
import {
  isConfirmedDriver,
  type CoverageGameEvent,
} from "@/components/coverageQueue"

/**
 * Own-request FULLY_COVERED covering this kid via a teammate-driven Ride
 * (driving circle ≠ requesting circle).
 */
export function isTeammateOwnRide(
  game: CoverageGameEvent,
  rideEvent: CarpoolRideEvent | null | undefined,
): boolean {
  const ownRequest = rideEvent?.ownRequests?.find((request) => request.kidId === game.kidId)
  if (ownRequest?.status !== "FULLY_COVERED") {
    return false
  }
  return (rideEvent?.rides ?? []).some(
    (ride) =>
      ride.status === "ACTIVE" &&
      ride.passengerRequestIds.includes(ownRequest.id) &&
      ride.drivingCircleId !== ownRequest.requestingCircleId,
  )
}

/**
 * Household driver confirmed for this kid — confirmed ownRide that is not an
 * ACCEPTED teammate own-request for that kid.
 */
export function isHouseholdConfirmedDriver(
  game: CoverageGameEvent,
  rideEvent: CarpoolRideEvent | null | undefined,
): boolean {
  return isConfirmedDriver(game.ownRide) && !isTeammateOwnRide(game, rideEvent)
}

/**
 * True only when a ride is actually confirmed (household driver or teammate
 * driving) and attendance is not not-going. Unassigned, pending household
 * confirm, and open team ask stay false — nothing to route yet.
 * (TO-confirmed gate lands in the canRoute task.)
 */
export function canRoute(
  game: CoverageGameEvent,
  rideEvent: CarpoolRideEvent | null | undefined,
): boolean {
  if (game.attendance === "not_going") {
    return false
  }
  return (
    isHouseholdConfirmedDriver(game, rideEvent) ||
    isTeammateOwnRide(game, rideEvent)
  )
}
