/**
 * Gate for Agenda → ride-detail entry. Ported from mockup `canRoute` rules,
 * mapped onto live CoverageGameEvent + CarpoolRideEvent (no API carpoolRoute).
 */

import type { CarpoolRideEvent } from "@/api/types"
import {
  isConfirmedDriver,
  type CoverageGameEvent,
} from "@/components/coverageQueue"

function ownRequestForGame(
  game: CoverageGameEvent,
  rideEvent: CarpoolRideEvent | null | undefined,
) {
  return rideEvent?.ownRequests?.find((request) => request.kidId === game.kidId) ?? null
}

/** True when this kid's need has a confirmed TO leg (destination Route). */
export function hasConfirmedToLeg(
  game: CoverageGameEvent,
  rideEvent: CarpoolRideEvent | null | undefined,
): boolean {
  const ownRequest = ownRequestForGame(game, rideEvent)
  if (ownRequest == null) {
    return false
  }
  return ownRequest.legStatuses.some(
    (legStatus) => legStatus.leg === "TO" && legStatus.status === "CONFIRMED",
  )
}

/**
 * Own-request covering this kid via a teammate-driven active Ride
 * (driving circle ≠ requesting circle) — any confirmed leg.
 */
export function isTeammateOwnRide(
  game: CoverageGameEvent,
  rideEvent: CarpoolRideEvent | null | undefined,
): boolean {
  const ownRequest = ownRequestForGame(game, rideEvent)
  if (ownRequest == null || !isConfirmedDriver(game.ownRide)) {
    return false
  }
  if (ownRequest.status !== "FULLY_COVERED" && ownRequest.status !== "PARTIAL") {
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
 * Household driver confirmed for this kid — confirmed ownRide that is not a
 * teammate-driven own-request for that kid.
 */
export function isHouseholdConfirmedDriver(
  game: CoverageGameEvent,
  rideEvent: CarpoolRideEvent | null | undefined,
): boolean {
  return isConfirmedDriver(game.ownRide) && !isTeammateOwnRide(game, rideEvent)
}

/**
 * Destination Route entry: attendance in play, and a confirmed **TO**
 * fulfillment when this kid has a carpool need. `PARTIAL` with TO confirmed
 * allows Route; FROM-only confirmation does not. With no own need, household
 * confirmed coverage still opens ride detail (unchanged).
 */
export function canRoute(
  game: CoverageGameEvent,
  rideEvent: CarpoolRideEvent | null | undefined,
): boolean {
  if (game.attendance === "not_going") {
    return false
  }
  const ownRequest = ownRequestForGame(game, rideEvent)
  if (ownRequest != null) {
    return hasConfirmedToLeg(game, rideEvent)
  }
  return isHouseholdConfirmedDriver(game, rideEvent)
}
