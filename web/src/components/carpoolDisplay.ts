import type {
  CarpoolFeedStatusKind,
  CarpoolRide,
  CarpoolRideEvent,
  Garage,
  Kid,
  Vehicle,
} from "@/api/types"

export function circleDisplayName(name: string | null | undefined): string {
  const trimmed = name?.trim()
  return trimmed ? trimmed : "Your family"
}

export function carpoolFeedStatusLabel(status: CarpoolFeedStatusKind): string {
  switch (status) {
    case "NONE":
      return "No carpool"
    case "AVAILABLE":
      return "Carpool available"
    case "REQUESTED":
      return "Requested"
    case "MEMBER":
      return "Member"
    case "OWNER":
      return "Owned"
  }
}

export function enableCarpoolConfirmMessage(feedName: string): string {
  return `This family will own the carpool for ${feedName} and will admit or decline join requests. Enable carpool?`
}

export function kidDisplayName(kids: Kid[], kidId: string): string {
  return kids.find((kid) => kid.id === kidId)?.displayName.trim() || "Kid"
}

export function rideSeatsLabel(seats: number): string {
  return seats === 1 ? "1 seat" : `${seats} seats`
}

export function callerDrives(garage: Garage | null, adultId: string): boolean {
  if (garage == null) {
    return false
  }
  const member = garage.members.find((row) => row.adultId === adultId)
  return member?.drives ?? true
}

/** RSVP YES kids on this event: still-need-a-ride plus this circle's accepted kids. */
export function ownYesKidCount(event: CarpoolRideEvent): number {
  const acceptedOwn =
    event.ownRequest?.status === "ACCEPTED" ? event.ownRequest.kidIds.length : 0
  return acceptedOwn + event.defaultKidIds.length
}

export function vehicleCommittedOnEvent(
  vehicleId: string,
  event: CarpoolRideEvent,
): boolean {
  const rides = [
    ...(event.ownRequest ? [event.ownRequest] : []),
    ...event.otherRequests,
  ]
  return rides.some((ride) => ride.status === "ACCEPTED" && ride.vehicleId === vehicleId)
}

export function eligibleVehiclesForAccept(options: {
  drives: boolean
  adultId: string
  vehicles: Vehicle[]
  event: CarpoolRideEvent
  request: CarpoolRide
}): Vehicle[] {
  if (!options.drives) {
    return []
  }
  const occupantsKids = ownYesKidCount(options.event)
  return options.vehicles.filter((vehicle) => {
    if (!vehicle.driverAdultIds.includes(options.adultId)) {
      return false
    }
    if (vehicleCommittedOnEvent(vehicle.id, options.event)) {
      return false
    }
    const remaining = vehicle.seats - 1 - occupantsKids
    return remaining >= options.request.seats
  })
}

/** Teammate ask this circle accepted (Withdraw target) — not our own request. */
export function isAcceptedByCircle(request: CarpoolRide, circleId: string): boolean {
  return request.status === "ACCEPTED" && request.acceptingCircleId === circleId
}

/** First other-circle ride on the event that this circle accepted. */
export function acceptedByUsRequest(
  rideEvent: CarpoolRideEvent | null | undefined,
  circleId: string,
): CarpoolRide | null {
  if (rideEvent == null || !circleId) {
    return null
  }
  return (
    rideEvent.otherRequests.find((request) => isAcceptedByCircle(request, circleId)) ?? null
  )
}

/**
 * First other-circle PENDING ask this adult can Accept for Focus ranking/CTAs
 * (skips passedByMe soft declines; has an eligible vehicle). Own PENDING/
 * ACCEPTED requests never qualify. Carpool tab Accept is gated separately and
 * may still offer Accept after Pass.
 */
export function eligiblePendingRideAccept(
  rideEvent: CarpoolRideEvent | null | undefined,
  options: { adultId: string; garage: Garage | null },
): CarpoolRide | null {
  if (rideEvent == null || !options.adultId) {
    return null
  }
  const drives = callerDrives(options.garage, options.adultId)
  const vehicles = options.garage?.vehicles ?? []
  for (const request of rideEvent.otherRequests) {
    if (request.status !== "PENDING" || request.passedByMe) {
      continue
    }
    const eligible = eligibleVehiclesForAccept({
      drives,
      adultId: options.adultId,
      vehicles,
      event: rideEvent,
      request,
    })
    if (eligible.length > 0) {
      return request
    }
  }
  return null
}

/** Collapsed Agenda / Focus chip for this circle's active ride on the event. */
export function agendaOwnRideStatusChip(
  ownRequest: CarpoolRide | null | undefined,
): { label: string; tone: "mint" | "amber" } | null {
  if (ownRequest == null) {
    return null
  }
  if (ownRequest.status === "ACCEPTED") {
    const who = ownRequest.acceptingCircleName?.trim()
    return {
      label: who ? `Riding with ${circleDisplayName(who)}` : "Riding with a teammate",
      tone: "mint",
    }
  }
  if (ownRequest.status === "PENDING") {
    return { label: "Requested", tone: "amber" }
  }
  return null
}

export function ownRideStatusLine(ride: CarpoolRide): string {
  if (ride.status === "ACCEPTED") {
    const who = ride.acceptingCircleName?.trim()
    return who ? `Riding with ${circleDisplayName(who)}` : "Riding with a teammate"
  }
  if (ride.status === "PENDING") {
    if (ride.passedByAdultNames.length > 0) {
      return `Passed by ${ride.passedByAdultNames.join(", ")}`
    }
    return "Requested"
  }
  return ride.status
}

/** Kids · seats · pickup — shared field tail for ride detail lines. */
export function rideKidsSeatsPickup(ride: CarpoolRide): string {
  return `${ride.kidFirstNames.join(", ")} · ${rideSeatsLabel(ride.seats)} · ${ride.pickupPlaceName}, ${ride.pickupAddress}`
}

/**
 * Incoming Accept/Pass ask (Focus + Carpool tab OtherRideRequest): requesting
 * circle · kids · seats · pickup.
 */
export function incomingRideAskSummary(request: CarpoolRide): string {
  return `${circleDisplayName(request.requestingCircleName)} · ${rideKidsSeatsPickup(request)}`
}

/**
 * Own PENDING / ACCEPTED detail line (Calendar wording): status · kids · seats ·
 * pickup. Pass `statusLabel` to reuse the field set with tab phrasing.
 */
export function ownRideDetailLine(
  ride: CarpoolRide,
  statusLabel: string = ownRideStatusLine(ride),
): string {
  return `${statusLabel} · ${rideKidsSeatsPickup(ride)}`
}

/**
 * Accepted-by-us detail line: requesting circle · kids · seats · pickup
 * (same field set as an incoming ask).
 */
export function acceptedByUsRideDetailLine(ride: CarpoolRide): string {
  return incomingRideAskSummary(ride)
}

