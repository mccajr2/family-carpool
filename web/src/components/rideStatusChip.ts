/**
 * Unified ride-status + carpool-ask chip descriptors for Agenda collapsed rows
 * and Focus card. Pure view-model — no UI. See docs/specs/active/unified-ride-status-chip.md.
 */

import type { CalendarItem, CarpoolRide } from "@/api/types"
import { circleDisplayName } from "@/components/carpoolDisplay"
import {
  acceptedRiders,
  isConfirmedDriver,
  isPendingHouseholdConfirm,
  isUnassigned,
  pendingRequests,
  type CarpoolRequest,
  type CoverageGameEvent,
} from "@/components/coverageQueue"

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
    label: who
      ? `Riding with ${circleDisplayName(who)}`
      : "Riding with a teammate",
    tone: "mint",
  }
}

function drivingLabel(driver: string, riderCount: number): RideStatusChipDescriptor {
  const base = driver === "You" ? "You're driving" : `${driver} driving`
  if (riderCount > 0) {
    return { label: `${base} · +${riderCount}`, tone: "route" }
  }
  return { label: base, tone: "mint" }
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
    return { label: "Ride needed", tone: "amber" }
  }
  if (ownRide === "requested") {
    return { label: "Asked the team", tone: "amber" }
  }
  if (isPendingHouseholdConfirm(ownRide)) {
    if (ownRide.driver === "You") {
      return { label: "Confirm you'll drive", tone: "amber" }
    }
    return { label: `Waiting on ${ownRide.driver}`, tone: "amber" }
  }
  if (isConfirmedDriver(ownRide)) {
    return drivingLabel(ownRide.driver, acceptedRiders(game).length)
  }

  return { label: "Ride needed", tone: "amber" }
}

/**
 * Overlaps (when applicable) + one ride-status chip for a calendar item.
 * All kids out-of-play → single muted **Not going**; no overlaps chip.
 */
export function rideStatusChipsForItem(
  item: CalendarItem,
  games: readonly CoverageGameEvent[],
  ownRequest: CarpoolRide | null | undefined,
): RideStatusChipDescriptor[] {
  const allNotGoing = games.length > 0 && games.every((game) => !isInPlay(game))
  if (allNotGoing) {
    return [{ label: "Not going", tone: "muted" }]
  }

  const chips: RideStatusChipDescriptor[] = []

  if (item.conflicts.length > 0) {
    chips.push({ label: "Overlaps", tone: "amber" })
  }

  const urgent = pickMostUrgentGameRow(games)
  if (urgent != null) {
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
    label: count === 1 ? "1 carpool ask" : `${count} carpool asks`,
    tone: "amber",
  }
}
