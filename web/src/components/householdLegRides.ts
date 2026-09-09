import type {
  CarpoolLeg,
  CarpoolNeededLeg,
  CarpoolRequest,
  CarpoolRideEvent,
  Garage,
} from "@/api/types"
import type { CarpoolClient } from "@/api/carpoolClient"
import { openLegsNeeded } from "@/components/carpoolDisplay"
import { DEFAULT_RIDE_NEEDED_LEGS } from "@/components/rideNeededLegs"

/** First garage vehicle the adult may drive, or null. */
export function vehicleIdForDriver(
  garage: Garage | null | undefined,
  adultId: string,
): string | null {
  if (garage == null || !adultId) {
    return null
  }
  const vehicle = garage.vehicles.find((entry) => entry.driverAdultIds.includes(adultId))
  return vehicle?.id ?? null
}

/**
 * Ensure each kid has an own CarpoolRequest, then create one Ride per still-OPEN
 * leg (round trip → two createRide calls) with those passengers. Caller must be
 * the driver (createRide always records the authenticated adult).
 */
export async function createHouseholdLegRides(options: {
  client: CarpoolClient
  accessToken: string
  spaceId: string
  eventKey: string
  kidIds: readonly string[]
  rideEvent: CarpoolRideEvent | null | undefined
  vehicleId: string
  /** Legs for newly created needs (default round trip). */
  legs?: CarpoolLeg
}): Promise<void> {
  const {
    client,
    accessToken,
    spaceId,
    eventKey,
    kidIds,
    rideEvent,
    vehicleId,
    legs = DEFAULT_RIDE_NEEDED_LEGS,
  } = options
  if (kidIds.length === 0) {
    return
  }

  const requestsByKid = new Map<string, CarpoolRequest>()
  for (const request of rideEvent?.ownRequests ?? []) {
    requestsByKid.set(request.kidId, request)
  }

  const ensured: CarpoolRequest[] = []
  for (const kidId of kidIds) {
    const existing = requestsByKid.get(kidId)
    if (existing != null) {
      ensured.push(existing)
      continue
    }
    const created = await client.createCarpoolRequest(accessToken, spaceId, {
      eventKey,
      kidId,
      legs,
    })
    ensured.push(created)
    requestsByKid.set(kidId, created)
  }

  const passengersByLeg = new Map<CarpoolNeededLeg, string[]>()
  for (const request of ensured) {
    for (const leg of openLegsNeeded(request)) {
      const list = passengersByLeg.get(leg) ?? []
      list.push(request.id)
      passengersByLeg.set(leg, list)
    }
  }

  for (const [leg, passengerRequestIds] of passengersByLeg) {
    if (passengerRequestIds.length === 0) {
      continue
    }
    await client.createRide(accessToken, spaceId, {
      eventKey,
      leg,
      vehicleId,
      passengerRequestIds,
    })
  }
}
