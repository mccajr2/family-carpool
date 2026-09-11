/**
 * Unified ride-status + carpool-ask chip descriptors for Agenda collapsed rows
 * and Focus card. Pure view-model — no UI. See docs/specs/active/unified-ride-status-chip.md.
 */

import type {
  CalendarItem,
  CarpoolRide,
  CarpoolRideEvent,
  CarpoolRideLeg,
} from "@/api/types"
import {
  acceptedRiders,
  isConfirmedDriver,
  isPendingHouseholdConfirm,
  isUnassigned,
  pendingRequests,
  type CarpoolRequest,
  type CoverageGameEvent,
} from "@/components/coverageQueue"
import {
  ASKED_THE_TEAM,
  ATTENDANCE_NOT_GOING_CHIP,
  CONFIRM_YOU_WILL_DRIVE,
  LEG_ASKED_TEAM,
  LEG_NEEDS_RIDE,
  OVERLAPS_CHIP,
  RIDE_NEEDED,
  RIDING_WITH_TEAMMATE,
  carpoolAskCountLabel,
  drivingChipLabel,
  legConfirmedStatusLabel,
  legStatusChipLabel,
  ridingWithCircleLabel,
  waitingOnDriverLabel,
} from "@/components/coverageCopy"
import {
  rideCommitmentConflict,
  rideCommitmentConflictChipLabel,
} from "@/components/rideCommitmentConflict"

export type RideStatusChipTone = "mint" | "amber" | "route" | "muted"

export type RideStatusChipDescriptor = {
  label: string
  tone: RideStatusChipTone
}

export type RideLegChipOptions = {
  currentAdultId?: string
  /** When CONFIRMED assignee names are empty (legacy fixtures), use this. */
  confirmedNameFallback?: string | null
}

function isInPlay(game: CoverageGameEvent): boolean {
  return game.attendance !== "not_going"
}

function isOwnRideGap(game: CoverageGameEvent): boolean {
  if (!isInPlay(game)) {
    return false
  }
  if (isConfirmedDriver(game.ownRide)) {
    return false
  }
  if (isUnassigned(game.ownRide)) {
    return true
  }
  return (
    typeof game.ownRide === "object" &&
    "driver" in game.ownRide &&
    !game.ownRide.confirmed &&
    game.ownRide.driver === "You"
  )
}

function sortByOrder(games: readonly CoverageGameEvent[]): CoverageGameEvent[] {
  return [...games].sort((left, right) => left.order - right.order)
}

/**
 * Most urgent in-play kid row on one calendar item — own-ride gaps before calm
 * states; soonest `order` within a tier (same tiers as `getQueue` own-ride pass).
 */
export function pickMostUrgentGameRow(
  games: readonly CoverageGameEvent[],
): CoverageGameEvent | null {
  const inPlay = games.filter(isInPlay)
  if (inPlay.length === 0) {
    return null
  }

  const gaps = sortByOrder(inPlay.filter(isOwnRideGap))
  if (gaps.length > 0) {
    return gaps[0] ?? null
  }

  return sortByOrder(inPlay)[0] ?? null
}

function isTeammateRide(
  game: CoverageGameEvent,
  ownRequest: CarpoolRide | null | undefined,
): boolean {
  return (
    ownRequest?.status === "ACCEPTED" &&
    ownRequest.kidIds.includes(game.kidId)
  )
}

function teammateRideChip(
  ownRequest: CarpoolRide,
): RideStatusChipDescriptor {
  const who = ownRequest.acceptingCircleName?.trim()
  return {
    label: who ? ridingWithCircleLabel(who) : RIDING_WITH_TEAMMATE,
    tone: "mint",
  }
}

function drivingLabel(
  driver: string,
  riderCount: number,
): RideStatusChipDescriptor {
  return {
    label: drivingChipLabel(driver, riderCount),
    tone: riderCount > 0 ? "route" : "mint",
  }
}

function assigneeLabelForLeg(
  leg: CarpoolRideLeg,
  options?: RideLegChipOptions,
): string | null {
  const display = leg.assigneeDisplayName?.trim()
  if (display) {
    return display
  }
  const circle = leg.assigneeCircleName?.trim()
  if (circle) {
    return circle
  }
  const fallback = options?.confirmedNameFallback?.trim()
  return fallback || null
}

/** Phase body only (no Getting there / Coming back prefix). */
export function legPhaseStatusLabel(
  leg: CarpoolRideLeg,
  options?: RideLegChipOptions,
): string {
  switch (leg.phase) {
    case "NEEDS_RIDE":
      return LEG_NEEDS_RIDE
    case "WAITING_HOUSEHOLD": {
      const who = assigneeLabelForLeg(leg, options) ?? "someone"
      return waitingOnDriverLabel(who)
    }
    case "ASKED_TEAM":
      return LEG_ASKED_TEAM
    case "CONFIRMED":
      return legConfirmedStatusLabel(assigneeLabelForLeg(leg, options), {
        currentAdultId: options?.currentAdultId,
        assigneeAdultId: leg.assigneeAdultId,
      })
  }
}

function legChipTone(leg: CarpoolRideLeg): RideStatusChipTone {
  return leg.phase === "CONFIRMED" ? "mint" : "amber"
}

function orderedLegs(
  legs: readonly CarpoolRideLeg[] | null | undefined,
): CarpoolRideLeg[] {
  if (legs == null) {
    return []
  }
  const to = legs.find((leg) => leg.kind === "TO")
  const from = legs.find((leg) => leg.kind === "FROM")
  const ordered: CarpoolRideLeg[] = []
  if (to != null) {
    ordered.push(to)
  }
  if (from != null) {
    ordered.push(from)
  }
  return ordered
}

/**
 * Dual Getting there / Coming back chips from persisted leg slots.
 * Inbound Accept clarity: TO-only asks show Coming back as Needs ride.
 * Missing/undefined legs (legacy fixtures) yield no chips.
 */
export function rideLegStatusChips(
  legs: readonly CarpoolRideLeg[] | null | undefined,
  options?: RideLegChipOptions,
): RideStatusChipDescriptor[] {
  return orderedLegs(legs).map((leg) => ({
    label: legStatusChipLabel(leg.kind, legPhaseStatusLabel(leg, options)),
    tone: legChipTone(leg),
  }))
}

/**
 * Dual chips for this circle's own request legs, or null when there is no
 * active request.
 */
export function agendaOwnRideLegChips(
  ownRequest: CarpoolRide | null | undefined,
  options?: RideLegChipOptions,
): RideStatusChipDescriptor[] | null {
  if (ownRequest == null || ownRequest.legs == null || ownRequest.legs.length === 0) {
    return null
  }
  return rideLegStatusChips(ownRequest.legs, {
    ...options,
    confirmedNameFallback:
      options?.confirmedNameFallback ??
      (ownRequest.status === "ACCEPTED" ? ownRequest.acceptingCircleName : null),
  })
}

/** Inbound Accept / Pass clarity — which leg(s) the teammate asked for. */
export function inboundAskLegChips(
  request: Pick<CarpoolRide, "legs">,
  options?: RideLegChipOptions,
): RideStatusChipDescriptor[] {
  return rideLegStatusChips(request.legs, options)
}

function transportLegsForItem(
  ownRequest: CarpoolRide | null | undefined,
  rideEvent: CarpoolRideEvent | null | undefined,
): CarpoolRideLeg[] | null {
  const fromRequest =
    ownRequest?.legs != null && ownRequest.legs.length > 0 ? ownRequest.legs : null
  const fromEvent =
    rideEvent?.ownLegs != null && rideEvent.ownLegs.length > 0 ? rideEvent.ownLegs : null
  const legs = fromRequest ?? fromEvent
  if (legs == null) {
    return null
  }
  // Household coverage Confirm/Assign still writes coverage rows, not leg slots
  // yet — keep the coverage chip when legs are still blank NEEDS_RIDE.
  if (ownRequest == null && legs.every((leg) => leg.phase === "NEEDS_RIDE")) {
    return null
  }
  return legs
}

/**
 * Map one game row's ride-side state to a single chip descriptor.
 */
export function rideStatusChipForGameRow(
  game: CoverageGameEvent,
  ownRequest: CarpoolRide | null | undefined,
): RideStatusChipDescriptor {
  if (isTeammateRide(game, ownRequest)) {
    return teammateRideChip(ownRequest!)
  }

  const { ownRide } = game

  if (isUnassigned(ownRide)) {
    return { label: RIDE_NEEDED, tone: "amber" }
  }
  if (ownRide === "requested") {
    return { label: ASKED_THE_TEAM, tone: "amber" }
  }
  if (isPendingHouseholdConfirm(ownRide)) {
    if (ownRide.driver === "You") {
      return { label: CONFIRM_YOU_WILL_DRIVE, tone: "amber" }
    }
    return { label: waitingOnDriverLabel(ownRide.driver), tone: "amber" }
  }
  if (isConfirmedDriver(ownRide)) {
    return drivingLabel(ownRide.driver, acceptedRiders(game).length)
  }

  return { label: RIDE_NEEDED, tone: "amber" }
}

/**
 * Overlaps → ride-commitment conflict → dual leg chips (when carpool legs
 * exist) or one coverage ride-status chip. All kids out-of-play → single muted
 * **Not going**; no overlaps/conflict.
 */
export function rideStatusChipsForItem(
  item: CalendarItem,
  games: readonly CoverageGameEvent[],
  ownRequest: CarpoolRide | null | undefined,
  options?: {
    rideEvent?: CarpoolRideEvent | null
    circleId?: string
    currentAdultId?: string
  },
): RideStatusChipDescriptor[] {
  const allNotGoing = games.length > 0 && games.every((game) => !isInPlay(game))
  if (allNotGoing) {
    return [{ label: ATTENDANCE_NOT_GOING_CHIP, tone: "muted" }]
  }

  const chips: RideStatusChipDescriptor[] = []

  if (item.conflicts.length > 0) {
    chips.push({ label: OVERLAPS_CHIP, tone: "amber" })
  }

  const circleId = options?.circleId
  if (circleId) {
    const conflict = rideCommitmentConflict(
      options?.rideEvent,
      item,
      games,
      circleId,
    )
    if (conflict != null) {
      chips.push({
        label: rideCommitmentConflictChipLabel(conflict),
        tone: "amber",
      })
    }
  }

  const legs = transportLegsForItem(ownRequest, options?.rideEvent)
  const urgent = pickMostUrgentGameRow(games)
  const remainingGapBesideOwnPlan =
    legs != null &&
    ownRequest != null &&
    urgent != null &&
    isOwnRideGap(urgent) &&
    !ownRequest.kidIds.includes(urgent.kidId)

  if (remainingGapBesideOwnPlan) {
    chips.push(rideStatusChipForGameRow(urgent, ownRequest))
  } else if (legs != null) {
    chips.push(
      ...rideLegStatusChips(legs, {
        currentAdultId: options?.currentAdultId,
        confirmedNameFallback:
          ownRequest?.status === "ACCEPTED"
            ? ownRequest.acceptingCircleName
            : null,
      }),
    )
  } else if (urgent != null) {
    chips.push(rideStatusChipForGameRow(urgent, ownRequest))
  }

  return chips
}

function isActionableInboundRequest(request: CarpoolRequest): boolean {
  return request.status === "pending" && !request.autoDeclined && !request.passedByMe
}

/**
 * Optional inbound carpool-ask chip — one count per event, shared across kid rows.
 * Skipped when every kid on the item is out-of-play.
 */
export function carpoolAskChipForRideEvent(
  games: readonly CoverageGameEvent[],
): RideStatusChipDescriptor | null {
  const inPlay = games.filter(isInPlay)
  if (inPlay.length === 0) {
    return null
  }

  const host = inPlay[0]
  if (host == null) {
    return null
  }

  const count = pendingRequests(host).filter(isActionableInboundRequest).length
  if (count === 0) {
    return null
  }

  return {
    label: carpoolAskCountLabel(count),
    tone: "amber",
  }
}
