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
  isOwnRideGap,
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
  YOURE_DRIVING,
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
import {
  collapseMatchingLegChips,
  inboundConfirmedCountByKind,
  nonBlankTransportLegs,
} from "@/components/transportPlan"

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

/** Dual Getting there / Coming back chips: household driving + inbound Accept count per leg. */
function combinedHouseholdInboundLegChips(
  driver: string,
  inboundCounts: { TO: number; FROM: number },
): RideStatusChipDescriptor[] {
  return collapseMatchingLegChips([
    {
      label: legStatusChipLabel("TO", drivingChipLabel(driver, inboundCounts.TO)),
      tone: inboundCounts.TO > 0 ? "route" : "mint",
    },
    {
      label: legStatusChipLabel("FROM", drivingChipLabel(driver, inboundCounts.FROM)),
      tone: inboundCounts.FROM > 0 ? "route" : "mint",
    },
  ])
}

/**
 * Overlay inbound · +n onto household CONFIRMED "You're driving" / name bodies
 * for each kind, then collapse matching bodies.
 */
function legChipsWithInboundOverlay(
  legs: readonly CarpoolRideLeg[],
  inboundCounts: { TO: number; FROM: number },
  options?: RideLegChipOptions,
): RideStatusChipDescriptor[] {
  const chips = orderedLegs(legs).map((leg) => {
    let body = legPhaseStatusLabel(leg, options)
    // Overlay inbound · +n only onto household CONFIRMED bodies (adult assignee,
    // no accepting circle). Teammate CONFIRMED legs keep plain riding-with copy.
    if (leg.phase === "CONFIRMED" && leg.assigneeCircleId == null) {
      const plus = inboundCounts[leg.kind]
      if (plus > 0) {
        if (body === YOURE_DRIVING || body.endsWith(" driving")) {
          body = drivingChipLabel(
            body === YOURE_DRIVING ? "You" : body.replace(/ driving$/, ""),
            plus,
          )
        } else if (body.endsWith(" confirmed")) {
          const who = body.replace(/ confirmed$/, "")
          body = `${who} confirmed · +${plus}`
        } else {
          body = `${body} · +${plus}`
        }
      }
    }
    return {
      label: legStatusChipLabel(leg.kind, body),
      tone:
        leg.phase === "CONFIRMED" &&
        leg.assigneeCircleId == null &&
        inboundCounts[leg.kind] > 0
          ? ("route" as const)
          : legChipTone(leg),
    }
  })
  return collapseMatchingLegChips(chips)
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
      if (
        options?.currentAdultId != null &&
        leg.assigneeAdultId != null &&
        leg.assigneeAdultId === options.currentAdultId
      ) {
        return CONFIRM_YOU_WILL_DRIVE
      }
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
 * Getting there / Coming back chips from persisted leg slots.
 * Both legs with the same display status body → one unprefixed chip.
 * Differing bodies → dual prefixed chips. True single-leg plans keep one
 * prefixed chip for that kind. Missing/undefined legs yield no chips.
 */
export function rideLegStatusChips(
  legs: readonly CarpoolRideLeg[] | null | undefined,
  options?: RideLegChipOptions,
): RideStatusChipDescriptor[] {
  return collapseMatchingLegChips(
    orderedLegs(legs).map((leg) => ({
      label: legStatusChipLabel(leg.kind, legPhaseStatusLabel(leg, options)),
      tone: legChipTone(leg),
    })),
  )
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
  return nonBlankTransportLegs(ownRequest, rideEvent)
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
 * Overlaps → ride-commitment conflict → leg chips (when carpool legs
 * exist) or one coverage ride-status chip. Matching TO/FROM bodies collapse
 * to one unprefixed chip. All kids out-of-play → single muted
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
  const inboundCounts = inboundConfirmedCountByKind(
    options?.rideEvent?.otherRequests,
    circleId,
  )
  const hasInboundPlus = inboundCounts.TO > 0 || inboundCounts.FROM > 0

  if (remainingGapBesideOwnPlan && urgent != null) {
    chips.push(rideStatusChipForGameRow(urgent, ownRequest))
  } else if (
    urgent != null &&
    isConfirmedDriver(urgent.ownRide) &&
    legs == null &&
    hasInboundPlus
  ) {
    chips.push(
      ...combinedHouseholdInboundLegChips(urgent.ownRide.driver, inboundCounts),
    )
  } else if (legs != null) {
    const overlayCounts =
      ownRequest?.status === "ACCEPTED"
        ? { TO: 0, FROM: 0 }
        : inboundCounts
    chips.push(
      ...legChipsWithInboundOverlay(legs, overlayCounts, {
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
