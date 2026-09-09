import type {
  CarpoolFeedStatusKind,
  CarpoolNeededLeg,
  CarpoolRequest,
  CarpoolRide,
  CarpoolRideEvent,
  Garage,
  Kid,
  Vehicle,
} from "@/api/types"
import {
  ASKED_THE_TEAM,
  RIDING_WITH_TEAMMATE,
  ridingWithCircleLabel,
} from "@/components/coverageCopy"

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

export function ownRequestForKid(
  rideEvent: CarpoolRideEvent | null | undefined,
  kidId: string,
): CarpoolRequest | null {
  return rideEvent?.ownRequests.find((request) => request.kidId === kidId) ?? null
}

export function activeRides(rideEvent: CarpoolRideEvent | null | undefined): CarpoolRide[] {
  return (rideEvent?.rides ?? []).filter((ride) => ride.status === "ACTIVE")
}

export function activeRidesForRequest(
  rideEvent: CarpoolRideEvent | null | undefined,
  requestId: string,
): CarpoolRide[] {
  return activeRides(rideEvent).filter((ride) =>
    ride.passengerRequestIds.includes(requestId),
  )
}

/**
 * Active fulfillments a passenger circle can Cancel (one Ride id per leg).
 * Uncovered asks with no rides have nothing to cancel here.
 */
export function cancelableRidesForRequest(
  rideEvent: CarpoolRideEvent | null | undefined,
  requestId: string,
): CarpoolRide[] {
  return activeRidesForRequest(rideEvent, requestId)
}

/**
 * Active fulfillments this circle drives for a request — Withdraw targets.
 */
export function withdrawableRidesForRequest(
  rideEvent: CarpoolRideEvent | null | undefined,
  requestId: string,
  circleId: string,
): CarpoolRide[] {
  if (!circleId) {
    return []
  }
  return activeRidesForRequest(rideEvent, requestId).filter(
    (ride) => ride.drivingCircleId === circleId,
  )
}

/** Button label when Cancel/Withdraw may target more than one leg. */
export function rideLegActionLabel(
  action: "Cancel" | "Withdraw",
  leg: CarpoolNeededLeg,
  rideCount: number,
): string {
  if (rideCount <= 1) {
    return action
  }
  return `${action} ${leg === "TO" ? "to" : "from"}`
}

export function openLegsNeeded(request: CarpoolRequest): CarpoolNeededLeg[] {
  return request.legStatuses
    .filter((legStatus) => legStatus.status === "OPEN")
    .map((legStatus) => legStatus.leg)
}

export function isRequestOpen(request: CarpoolRequest): boolean {
  return request.status === "UNCOVERED" || request.status === "PARTIAL"
}

/** RSVP YES kids on this event: still-need-a-ride plus fully covered own needs. */
export function ownYesKidCount(event: CarpoolRideEvent): number {
  const fullyCoveredOwn = event.ownRequests.filter(
    (request) => request.status === "FULLY_COVERED",
  ).length
  return fullyCoveredOwn + event.defaultKidIds.length
}

export function vehicleCommittedOnLeg(
  vehicleId: string,
  event: CarpoolRideEvent,
  leg: CarpoolNeededLeg,
): boolean {
  return activeRides(event).some(
    (ride) => ride.vehicleId === vehicleId && ride.leg === leg,
  )
}

/** True when the vehicle already has an active ride for any still-OPEN leg on the ask. */
export function vehicleCommittedForRequest(
  vehicleId: string,
  event: CarpoolRideEvent,
  request: CarpoolRequest,
): boolean {
  return openLegsNeeded(request).some((leg) =>
    vehicleCommittedOnLeg(vehicleId, event, leg),
  )
}

/** @deprecated Prefer vehicleCommittedForRequest — TO and FROM may share a vehicle. */
export function vehicleCommittedOnEvent(
  vehicleId: string,
  event: CarpoolRideEvent,
): boolean {
  return activeRides(event).some((ride) => ride.vehicleId === vehicleId)
}

export function eligibleVehiclesForAccept(options: {
  drives: boolean
  adultId: string
  vehicles: Vehicle[]
  event: CarpoolRideEvent
  request: CarpoolRequest
  /** Passenger request count being accepted (default one ask). */
  passengerCount?: number
}): Vehicle[] {
  if (!options.drives || !isRequestOpen(options.request)) {
    return []
  }
  const occupantsKids = ownYesKidCount(options.event)
  const passengers = options.passengerCount ?? 1
  return options.vehicles.filter((vehicle) => {
    if (!vehicle.driverAdultIds.includes(options.adultId)) {
      return false
    }
    if (vehicleCommittedForRequest(vehicle.id, options.event, options.request)) {
      return false
    }
    const remaining = vehicle.seats - 1 - occupantsKids
    return remaining >= passengers
  })
}

/** Teammate ask this circle is driving (Withdraw target) — via active Ride rows. */
export function isAcceptedByCircle(
  request: CarpoolRequest,
  circleId: string,
  rides: readonly CarpoolRide[] = [],
): boolean {
  return rides.some(
    (ride) =>
      ride.status === "ACTIVE" &&
      ride.drivingCircleId === circleId &&
      ride.passengerRequestIds.includes(request.id),
  )
}

/** First other-circle request on the event that this circle is driving. */
export function acceptedByUsRequest(
  rideEvent: CarpoolRideEvent | null | undefined,
  circleId: string,
): CarpoolRequest | null {
  if (rideEvent == null || !circleId) {
    return null
  }
  return (
    rideEvent.otherRequests.find((request) =>
      isAcceptedByCircle(request, circleId, rideEvent.rides),
    ) ?? null
  )
}

/**
 * First other-circle open ask this adult can Accept for Focus ranking/CTAs
 * (skips passedByMe soft declines; has an eligible vehicle). Own requests never
 * qualify. Carpool tab Accept is gated separately and may still offer Accept
 * after Pass.
 */
export function eligiblePendingRideAccept(
  rideEvent: CarpoolRideEvent | null | undefined,
  options: { adultId: string; garage: Garage | null },
): CarpoolRequest | null {
  if (rideEvent == null || !options.adultId) {
    return null
  }
  const drives = callerDrives(options.garage, options.adultId)
  const vehicles = options.garage?.vehicles ?? []
  for (const request of rideEvent.otherRequests) {
    if (!isRequestOpen(request) || request.passedByMe) {
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

function coveringCircleName(
  request: CarpoolRequest,
  rides: readonly CarpoolRide[] = [],
): string | null {
  const covering = rides.find(
    (ride) =>
      ride.status === "ACTIVE" && ride.passengerRequestIds.includes(request.id),
  )
  const fromRide = covering?.drivingCircleName?.trim()
  if (fromRide) {
    return fromRide
  }
  return request.acceptingCircleName?.trim() || null
}

/** Partial round-trip copy for chips / detail lines. */
export function partialRideStatusLabel(request: CarpoolRequest): string {
  const to = request.legStatuses.find((leg) => leg.leg === "TO")
  const from = request.legStatuses.find((leg) => leg.leg === "FROM")
  if (to != null && from != null) {
    if (to.status === "CONFIRMED" && from.status === "OPEN") {
      return "Round trip — to confirmed, from still needed"
    }
    if (from.status === "CONFIRMED" && to.status === "OPEN") {
      return "Round trip — from confirmed, to still needed"
    }
  }
  const confirmed = request.legStatuses.filter((leg) => leg.status === "CONFIRMED")
  const open = request.legStatuses.filter((leg) => leg.status === "OPEN")
  if (confirmed.length === 1 && open.length === 1) {
    const done = confirmed[0]!.leg === "TO" ? "to" : "from"
    const need = open[0]!.leg === "TO" ? "to" : "from"
    return `${done} confirmed, ${need} still needed`
  }
  return "Partially covered"
}

/** Collapsed Agenda / Focus chip for this circle's active need on the event. */
export function agendaOwnRideStatusChip(
  ownRequest: CarpoolRequest | null | undefined,
  rides: readonly CarpoolRide[] = [],
): { label: string; tone: "mint" | "amber" } | null {
  if (ownRequest == null) {
    return null
  }
  if (ownRequest.status === "FULLY_COVERED") {
    const who = coveringCircleName(ownRequest, rides)
    return {
      label: who ? ridingWithCircleLabel(who) : RIDING_WITH_TEAMMATE,
      tone: "mint",
    }
  }
  if (ownRequest.status === "PARTIAL") {
    return { label: partialRideStatusLabel(ownRequest), tone: "amber" }
  }
  if (ownRequest.status === "UNCOVERED") {
    return { label: ASKED_THE_TEAM, tone: "amber" }
  }
  return null
}

export function ownRideStatusLine(
  request: CarpoolRequest,
  rides: readonly CarpoolRide[] = [],
): string {
  if (request.status === "FULLY_COVERED") {
    const who = coveringCircleName(request, rides)
    return who ? `Riding with ${circleDisplayName(who)}` : "Riding with a teammate"
  }
  if (request.status === "PARTIAL") {
    return partialRideStatusLabel(request)
  }
  if (request.passedByAdultNames.length > 0) {
    return `Passed by ${request.passedByAdultNames.join(", ")}`
  }
  return "Requested"
}

/** Kids · seats · pickup — shared field tail for ride detail lines. */
export function rideKidsSeatsPickup(request: CarpoolRequest, seats = 1): string {
  return `${request.kidFirstName} · ${rideSeatsLabel(seats)} · ${request.pickupPlaceName}, ${request.pickupAddress}`
}

/**
 * Incoming Accept/Pass ask (Focus + Carpool tab OtherRideRequest): requesting
 * circle · kids · seats · pickup.
 */
export function incomingRideAskSummary(request: CarpoolRequest, seats = 1): string {
  return `${circleDisplayName(request.requestingCircleName)} · ${rideKidsSeatsPickup(request, seats)}`
}

/**
 * Own need detail line (Calendar wording): status · kids · seats · pickup.
 * Pass `statusLabel` to reuse the field set with tab phrasing.
 */
export function ownRideDetailLine(
  request: CarpoolRequest,
  statusLabel: string = ownRideStatusLine(request),
  seats = 1,
): string {
  return `${statusLabel} · ${rideKidsSeatsPickup(request, seats)}`
}

/**
 * Per-leg fulfillment lines when TO/FROM rides differ (Agenda expanded density).
 * Empty when there are no active rides for the request.
 */
export function ownRideLegDetailLines(
  request: CarpoolRequest,
  rides: readonly CarpoolRide[],
): string[] {
  const active = rides.filter(
    (ride) =>
      ride.status === "ACTIVE" && ride.passengerRequestIds.includes(request.id),
  )
  if (active.length === 0) {
    return []
  }
  return active.map((ride) => {
    const legLabel = ride.leg === "TO" ? "To" : "From"
    const who = ride.drivingCircleName?.trim()
    const driver = who ? circleDisplayName(who) : "a teammate"
    return `${legLabel}: Riding with ${driver}`
  })
}

/**
 * Accepted-by-us detail line: requesting circle · kids · seats · pickup
 * (same field set as an incoming ask).
 */
export function acceptedByUsRideDetailLine(request: CarpoolRequest, seats = 1): string {
  return incomingRideAskSummary(request, seats)
}
