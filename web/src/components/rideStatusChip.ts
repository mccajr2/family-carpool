/**
 * Unified ride-status + carpool-ask chip descriptors for Agenda collapsed rows
 * and Focus card. Pure view-model — no UI. See docs/specs/active/unified-ride-status-chip.md.
 */

import type { CalendarItem, CarpoolRide, Kid } from "@/api/types"
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
  OVERLAPS_CHIP,
  RIDE_NEEDED,
  RIDING_WITH_TEAMMATE,
  carpoolAskCountLabel,
  drivingChipLabel,
  ridingWithCircleLabel,
  waitingOnDriverLabel,
} from "@/components/coverageCopy"
import { ridersForItem } from "@/components/riderChips"

export type RideStatusChipTone = "mint" | "amber" | "route" | "muted"

export type RideStatusChipDescriptor = {
  label: string
  tone: RideStatusChipTone
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
  suppressAcceptedRiderCount = false,
): RideStatusChipDescriptor {
  const effectiveCount = suppressAcceptedRiderCount ? 0 : riderCount
  return {
    label: drivingChipLabel(driver, effectiveCount),
    tone: effectiveCount > 0 ? "route" : "mint",
  }
}

/**
 * Map one game row's ride-side state to a single chip descriptor.
 */
export function rideStatusChipForGameRow(
  game: CoverageGameEvent,
  ownRequest: CarpoolRide | null | undefined,
  suppressAcceptedRiderCount = false,
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
    return drivingLabel(
      ownRide.driver,
      acceptedRiders(game).length,
      suppressAcceptedRiderCount,
    )
  }

  return { label: RIDE_NEEDED, tone: "amber" }
}

/**
 * Overlaps (when applicable) + one ride-status chip for a calendar item.
 * All kids out-of-play → single muted **Not going**; no overlaps chip.
 */
export function rideStatusChipsForItem(
  item: CalendarItem,
  games: readonly CoverageGameEvent[],
  ownRequest: CarpoolRide | null | undefined,
  kids?: readonly Kid[],
): RideStatusChipDescriptor[] {
  const allNotGoing = games.length > 0 && games.every((game) => !isInPlay(game))
  if (allNotGoing) {
    return [{ label: ATTENDANCE_NOT_GOING_CHIP, tone: "muted" }]
  }

  const chips: RideStatusChipDescriptor[] = []

  if (item.conflicts.length > 0) {
    chips.push({ label: OVERLAPS_CHIP, tone: "amber" })
  }

  const suppressAcceptedRiderCount =
    kids != null && ridersForItem(games, ownRequest, kids).length > 0

  const urgent = pickMostUrgentGameRow(games)
  if (urgent != null) {
    chips.push(
      rideStatusChipForGameRow(urgent, ownRequest, suppressAcceptedRiderCount),
    )
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
