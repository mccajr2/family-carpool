/**
 * Detect contradictory ride commitments on one Agenda event (circle-level).
 * Pure view-model — no UI, no API. Phase 1 of ride-commitment-conflict.
 */

import type { CalendarItem, CarpoolRide, CarpoolRideEvent, Kid } from "@/api/types"
import { acceptedByUsRequest, kidDisplayName } from "@/components/carpoolDisplay"
import {
  alsoDrivingKidLabel,
  RIDE_CONFLICT_CHIP,
} from "@/components/coverageCopy"
import {
  isUnassigned,
  type CoverageGameEvent,
} from "@/components/coverageQueue"

export type RideCommitmentConflict =
  | { kind: "needRideAndDriving"; inbound: CarpoolRide; gapKidNames: string[] }
  | { kind: "mutualSwap"; inbound: CarpoolRide; ownRequest: CarpoolRide }

function formatKidNames(names: readonly string[]): string {
  const cleaned = names.map((name) => name.trim()).filter(Boolean)
  return cleaned.length > 0 ? cleaned.join(", ") : "a teammate kid"
}

/** Collapsed Agenda / Focus chip label for a detected commitment conflict. */
export function rideCommitmentConflictChipLabel(
  conflict: RideCommitmentConflict,
): string {
  if (conflict.kind === "mutualSwap") {
    return RIDE_CONFLICT_CHIP
  }
  const inboundNames = conflict.inbound.kidFirstNames
    .map((name) => name.trim())
    .filter(Boolean)
  if (inboundNames.length === 1) {
    return alsoDrivingKidLabel(inboundNames[0]!)
  }
  return RIDE_CONFLICT_CHIP
}

/** True when a tag/chip label is the ride-commitment conflict slot. */
export function isRideCommitmentConflictChipLabel(label: string): boolean {
  return label === RIDE_CONFLICT_CHIP || label.startsWith("Also driving ")
}

/**
 * One factual Focus / expanded-row line naming both commitments (no dialog).
 */
export function rideCommitmentConflictLine(
  conflict: RideCommitmentConflict,
): string {
  if (conflict.kind === "needRideAndDriving") {
    const inboundSummary = formatKidNames(conflict.inbound.kidFirstNames)
    const gapNames = formatKidNames(conflict.gapKidNames)
    return `You're driving ${inboundSummary} but ${gapNames} still need a ride.`
  }
  const theirKid = formatKidNames(conflict.inbound.kidFirstNames)
  const yourKid = formatKidNames(conflict.ownRequest.kidFirstNames)
  return `You're driving ${theirKid} and ${yourKid} rides with them — pick one plan.`
}

function isInPlay(game: CoverageGameEvent): boolean {
  return game.attendance !== "not_going"
}

function needsRideGap(game: CoverageGameEvent): boolean {
  return isUnassigned(game.ownRide) || game.ownRide === "requested"
}

function sameKidSet(left: readonly string[], right: readonly string[]): boolean {
  if (left.length !== right.length) {
    return false
  }
  const rightSet = new Set(right)
  return left.every((kidId) => rightSet.has(kidId))
}

/** First-name for a gap kid: circle roster, else own-ask labels, else "Kid". */
function gapKidName(
  kidId: string,
  rideEvent: CarpoolRideEvent | null | undefined,
  kids: readonly Kid[],
): string {
  if (kids.length > 0) {
    const fromCircle = kidDisplayName([...kids], kidId)
    if (fromCircle !== "Kid") {
      return fromCircle
    }
  }
  const ownRequest = rideEvent?.ownRequest
  if (ownRequest != null) {
    const index = ownRequest.kidIds.indexOf(kidId)
    const named = index >= 0 ? ownRequest.kidFirstNames[index]?.trim() : null
    if (named) {
      return named
    }
  }
  return "Kid"
}

/**
 * Type A: ACCEPTED inbound + in-play kid still unassigned / Asked the team.
 * Type B: mutual ACCEPTED swap (both directions, different kid sets).
 * Null when inbound + household CONFIRMED covers every own gap (valid two-kid
 * plan), or only one direction is set with gaps cleared.
 */
export function rideCommitmentConflict(
  rideEvent: CarpoolRideEvent | null | undefined,
  item: CalendarItem,
  coverageGames: readonly CoverageGameEvent[],
  circleId: string,
  kids: readonly Kid[] = [],
): RideCommitmentConflict | null {
  const inbound = acceptedByUsRequest(rideEvent, circleId)
  if (inbound == null) {
    return null
  }

  const itemKidIds = new Set(item.kidIds)
  const inPlay = coverageGames.filter(
    (game) => itemKidIds.has(game.kidId) && isInPlay(game),
  )

  const ownRequest = rideEvent?.ownRequest ?? null
  if (ownRequest?.status === "ACCEPTED") {
    const inPlayOwnKidIds = ownRequest.kidIds.filter((kidId) =>
      inPlay.some((game) => game.kidId === kidId),
    )
    if (
      inPlayOwnKidIds.length > 0 &&
      !sameKidSet(inPlayOwnKidIds, inbound.kidIds)
    ) {
      return { kind: "mutualSwap", inbound, ownRequest }
    }
  }

  const gapGames = inPlay.filter(needsRideGap)
  if (gapGames.length === 0) {
    return null
  }

  return {
    kind: "needRideAndDriving",
    inbound,
    gapKidNames: gapGames.map((game) => gapKidName(game.kidId, rideEvent, kids)),
  }
}
