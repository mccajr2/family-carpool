/**
 * Detect contradictory ride commitments on one Agenda event (circle-level).
 * Pure view-model — no UI, no API. Phase 1 of ride-commitment-conflict.
 */

import type { CalendarItem, CarpoolRequest, CarpoolRideEvent, Kid } from "@/api/types"
import { acceptedByUsRequest, kidDisplayName } from "@/components/carpoolDisplay"
import {
  alsoDrivingKidLabel,
  RIDE_CONFLICT_CHIP,
} from "@/components/coverageCopy"
import {
  isPartialOwnRide,
  isUnassigned,
  type CoverageGameEvent,
} from "@/components/coverageQueue"

export type RideCommitmentConflict =
  | { kind: "needRideAndDriving"; inbound: CarpoolRequest; gapKidNames: string[] }
  | { kind: "mutualSwap"; inbound: CarpoolRequest; ownRequest: CarpoolRequest }

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
  const inboundName = conflict.inbound.kidFirstName.trim()
  if (inboundName) {
    return alsoDrivingKidLabel(inboundName)
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
    const inboundSummary = formatKidNames([conflict.inbound.kidFirstName])
    const gapNames = formatKidNames(conflict.gapKidNames)
    return `You're driving ${inboundSummary} but ${gapNames} still need a ride.`
  }
  const theirKid = formatKidNames([conflict.inbound.kidFirstName])
  const yourKid = formatKidNames([conflict.ownRequest.kidFirstName])
  return `You're driving ${theirKid} and ${yourKid} rides with them — pick one plan.`
}

function isInPlay(game: CoverageGameEvent): boolean {
  return game.attendance !== "not_going"
}

function needsRideGap(game: CoverageGameEvent): boolean {
  return (
    isUnassigned(game.ownRide) ||
    game.ownRide === "requested" ||
    isPartialOwnRide(game.ownRide)
  )
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
  const ownRequest = rideEvent?.ownRequests.find((request) => request.kidId === kidId)
  if (ownRequest?.kidFirstName.trim()) {
    return ownRequest.kidFirstName.trim()
  }
  return "Kid"
}

/**
 * Type A: driving an inbound ask + in-play kid still unassigned / Asked the team /
 * PARTIAL. Type B: mutual fully-covered swap (both directions, different kids).
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

  const fullyCoveredOwn =
    rideEvent?.ownRequests.filter((request) => request.status === "FULLY_COVERED") ?? []
  const inPlayOwn = fullyCoveredOwn.filter((request) =>
    inPlay.some((game) => game.kidId === request.kidId),
  )
  if (inPlayOwn.length > 0 && !inPlayOwn.some((request) => request.kidId === inbound.kidId)) {
    return { kind: "mutualSwap", inbound, ownRequest: inPlayOwn[0]! }
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
