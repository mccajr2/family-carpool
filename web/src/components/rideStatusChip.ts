/**
 * Unified ride-status + carpool-ask chip descriptors for Agenda collapsed rows
 * and Focus card. Pure view-model — no UI. See docs/specs/archive/unified-ride-status-chip.md.
 */

import type { CalendarItem, CarpoolRideEvent } from "@/api/types"
import { isTeammateOwnRide } from "@/components/canRoute"
import { partialRideStatusLabel } from "@/components/carpoolDisplay"
import {
  acceptedRiders,
  isConfirmedDriver,
  isPartialOwnRide,
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
  OVERLAPS_CHIP,
  RIDE_NEEDED,
  RIDING_WITH_TEAMMATE,
  carpoolAskCountLabel,
  drivingChipLabel,
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

export type RideStatusChipOptions = {
  rideEvent?: CarpoolRideEvent | null
  circleId?: string
}

function isInPlay(game: CoverageGameEvent): boolean {
  return game.attendance !== "not_going"
}

/**
 * Own-ride gap for chip urgency — same spirit as `getQueue`: unassigned,
 * PARTIAL, and confirm-for-self. Asked-the-team wait is not a gap chip tier
 * preference over confirmed (requested rows still emit Asked the team when
 * they are the urgent calm row).
 */
function isOwnRideGap(game: CoverageGameEvent): boolean {
  if (!isInPlay(game)) {
    return false
  }
  if (isConfirmedDriver(game.ownRide)) {
    return false
  }
  if (isUnassigned(game.ownRide) || isPartialOwnRide(game.ownRide)) {
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
 * Most urgent in-play kid row on one calendar item — own-ride gaps (including
 * PARTIAL) before calm states; soonest `order` within a tier.
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

function teammateCoveringCircleName(
  game: CoverageGameEvent,
  rideEvent: CarpoolRideEvent,
): string | null {
  const ownNeed = rideEvent.ownRequests.find((request) => request.kidId === game.kidId)
  if (ownNeed == null) {
    return null
  }
  const covering = rideEvent.rides.find(
    (ride) =>
      ride.status === "ACTIVE" &&
      ride.passengerRequestIds.includes(ownNeed.id) &&
      ride.drivingCircleId !== ownNeed.requestingCircleId,
  )
  return covering?.drivingCircleName?.trim() || ownNeed.acceptingCircleName?.trim() || null
}

function teammateRideChip(
  game: CoverageGameEvent,
  rideEvent: CarpoolRideEvent,
): RideStatusChipDescriptor {
  const who = teammateCoveringCircleName(game, rideEvent)
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

function partialChip(
  game: CoverageGameEvent,
  rideEvent: CarpoolRideEvent | null | undefined,
): RideStatusChipDescriptor {
  const ownNeed = rideEvent?.ownRequests.find((request) => request.kidId === game.kidId)
  return {
    label: ownNeed != null ? partialRideStatusLabel(ownNeed) : "Partially covered",
    tone: "amber",
  }
}

/**
 * Map one game row's ride-side state to a single chip descriptor.
 */
export function rideStatusChipForGameRow(
  game: CoverageGameEvent,
  rideEvent?: CarpoolRideEvent | null,
): RideStatusChipDescriptor {
  if (rideEvent != null && isTeammateOwnRide(game, rideEvent)) {
    return teammateRideChip(game, rideEvent)
  }

  const { ownRide } = game

  if (isUnassigned(ownRide)) {
    return { label: RIDE_NEEDED, tone: "amber" }
  }
  if (isPartialOwnRide(ownRide)) {
    return partialChip(game, rideEvent)
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
 * Overlaps → ride-commitment conflict → one ride-status chip for a calendar
 * item. All kids out-of-play → single muted **Not going**; no overlaps/conflict.
 */
export function rideStatusChipsForItem(
  item: CalendarItem,
  games: readonly CoverageGameEvent[],
  options?: RideStatusChipOptions,
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

  const urgent = pickMostUrgentGameRow(games)
  if (urgent != null) {
    chips.push(rideStatusChipForGameRow(urgent, options?.rideEvent))
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
