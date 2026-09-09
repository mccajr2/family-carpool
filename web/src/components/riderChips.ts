/**
 * Pure rider list helpers for Agenda RiderChips — no UI.
 * See docs/specs/active/agenda-ride-rider-chips.md.
 */

import type { CarpoolRideEvent, Kid } from "@/api/types"
import { isTeammateOwnRide } from "@/components/canRoute"
import { heroKidFirstName } from "@/components/heroAttentionCopy"
import {
  acceptedRiders,
  isConfirmedDriver,
  isUnassigned,
  type CoverageGameEvent,
} from "@/components/coverageQueue"
import { pickMostUrgentGameRow } from "@/components/rideStatusChip"

export type RiderDescriptor = {
  firstName: string
  initial: string
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

function isTeammateRide(
  game: CoverageGameEvent,
  rideEvent: CarpoolRideEvent | null | undefined,
): boolean {
  if (rideEvent != null) {
    return isTeammateOwnRide(game, rideEvent)
  }
  return (
    isConfirmedDriver(game.ownRide) &&
    typeof game.ownRide === "object" &&
    game.ownRide.driver !== "You"
  )
}

function teammateCoveredKidIds(
  games: readonly CoverageGameEvent[],
  urgent: CoverageGameEvent,
  rideEvent: CarpoolRideEvent | null | undefined,
): Set<string> {
  if (rideEvent != null) {
    return new Set(
      games
        .filter((game) => isTeammateOwnRide(game, rideEvent))
        .map((game) => game.kidId),
    )
  }
  const driverLabel =
    typeof urgent.ownRide === "object" && "driver" in urgent.ownRide
      ? urgent.ownRide.driver
      : null
  if (driverLabel == null || driverLabel === "You") {
    return new Set()
  }
  return new Set(
    games
      .filter(
        (game) =>
          isConfirmedDriver(game.ownRide) &&
          typeof game.ownRide === "object" &&
          game.ownRide.driver === driverLabel,
      )
      .map((game) => game.kidId),
  )
}

function sortByOrder(games: readonly CoverageGameEvent[]): CoverageGameEvent[] {
  return [...games].sort((left, right) => left.order - right.order)
}

/** First grapheme of `firstName`, uppercased; `?` when blank. */
export function riderInitial(firstName: string): string {
  const trimmed = firstName.trim()
  if (!trimmed) {
    return "?"
  }
  const first = [...trimmed][0]
  return first ? first.toUpperCase() : "?"
}

function teammateFirstName(kidFirstName: string): string {
  const trimmed = kidFirstName.trim()
  if (!trimmed) {
    return ""
  }
  return trimmed.split(/\s+/)[0] ?? trimmed
}

function circleKidRiders(
  games: readonly CoverageGameEvent[],
  kids: readonly Kid[],
): RiderDescriptor[] {
  return sortByOrder(games).map((game) => {
    const firstName = heroKidFirstName(game.kidId, kids)
    return { firstName, initial: riderInitial(firstName) }
  })
}

function acceptedTeammateRiders(game: CoverageGameEvent): RiderDescriptor[] {
  const riders: RiderDescriptor[] = []
  const seen = new Set<string>()

  for (const request of acceptedRiders(game)) {
    for (const kidFirstName of request.kidFirstNames) {
      const firstName = teammateFirstName(kidFirstName)
      if (!firstName) {
        continue
      }
      const key = firstName.toLowerCase()
      if (seen.has(key)) {
        continue
      }
      seen.add(key)
      riders.push({ firstName, initial: riderInitial(firstName) })
    }
  }

  return riders
}

function mergeRiders(...groups: readonly RiderDescriptor[][]): RiderDescriptor[] {
  const merged: RiderDescriptor[] = []
  const seen = new Set<string>()

  for (const group of groups) {
    for (const rider of group) {
      const key = rider.firstName.toLowerCase()
      if (seen.has(key)) {
        continue
      }
      seen.add(key)
      merged.push(rider)
    }
  }

  return merged
}

/** Screen-reader label for a rider chip group, e.g. `Riding: Declan, Ben`. */
export function riderChipsAriaLabel(riders: readonly RiderDescriptor[]): string {
  if (riders.length === 0) {
    return ""
  }
  return `Riding: ${riders.map((rider) => rider.firstName).join(", ")}`
}

/**
 * Ordered rider list for a collapsed Agenda row — empty unless the item's
 * urgent ride state is confirmed household driver or teammate ride.
 */
export function ridersForItem(
  games: readonly CoverageGameEvent[],
  kids: readonly Kid[],
  rideEvent: CarpoolRideEvent | null | undefined = null,
): RiderDescriptor[] {
  const inPlay = games.filter(isInPlay)
  if (inPlay.length === 0) {
    return []
  }

  const urgent = pickMostUrgentGameRow(games)
  if (urgent == null || isOwnRideGap(urgent)) {
    return []
  }

  if (isTeammateRide(urgent, rideEvent)) {
    const coveredIds = teammateCoveredKidIds(inPlay, urgent, rideEvent)
    const covered = inPlay.filter((game) => coveredIds.has(game.kidId))
    return circleKidRiders(covered, kids)
  }

  if (isConfirmedDriver(urgent.ownRide)) {
    const confirmedGames = inPlay.filter((game) => isConfirmedDriver(game.ownRide))
    const host = confirmedGames[0] ?? urgent
    return mergeRiders(
      circleKidRiders(confirmedGames, kids),
      acceptedTeammateRiders(host),
    )
  }

  return []
}

/**
 * Rider descriptors for one expanded per-kid band — subset when multi-kid
 * states diverge on the same calendar item.
 */
export function ridersForGameRow(
  game: CoverageGameEvent,
  _games: readonly CoverageGameEvent[],
  kids: readonly Kid[],
  rideEvent: CarpoolRideEvent | null | undefined = null,
): RiderDescriptor[] {
  if (!isInPlay(game)) {
    return []
  }

  if (isTeammateRide(game, rideEvent)) {
    const firstName = heroKidFirstName(game.kidId, kids)
    return [{ firstName, initial: riderInitial(firstName) }]
  }

  if (isConfirmedDriver(game.ownRide)) {
    const firstName = heroKidFirstName(game.kidId, kids)
    return [{ firstName, initial: riderInitial(firstName) }]
  }

  return []
}
