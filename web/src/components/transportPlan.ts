/**
 * Shared per-leg transport view-model for Agenda / Hero / chips.
 * Non-blank `ownLegs` / per-kid plans win over calendar `uncoveredKidIds` and
 * a single `ownRide` rollup so mixed plans stay truthful on every surface.
 * Prefer `ownRequests` once plans diverge (singular `ownRequest` / `ownLegs`
 * are null when there are 0 or 2+ plans).
 */

import type {
  CalendarItem,
  CarpoolLegKind,
  CarpoolRide,
  CarpoolRideEvent,
  CarpoolRideLeg,
} from "@/api/types"
import { circleDisplayName } from "@/components/carpoolDisplay"
import { activeCoverages, remainingCoverageGapKidIds } from "@/components/coverageDisplay"
import { legKindLabel } from "@/components/coverageCopy"

/** Matches coverageQueue OwnRideStatus without importing it (avoid cycles). */
export type TransportOwnRideStatus =
  | "unassigned"
  | "requested"
  | { driver: string; confirmed: boolean }

export type DecidedAssigneeKind = "household" | "teammate" | "team_ask"

export type DecidedAssignee = {
  /** Stable dedupe key (adult / circle / ask). */
  key: string
  kind: DecidedAssigneeKind
  /** Display name used in revert copy (adult first name, circle, or Ask). */
  label: string
  adultId: string | null
  circleId: string | null
  legKinds: CarpoolLegKind[]
  /** True when every owned leg is still WAITING_HOUSEHOLD (cancel-request chrome). */
  waiting: boolean
}

export type TransportPlanSlots = {
  /** Null when legs are blank / coverage-owned (every NEEDS_RIDE or missing). */
  legs: CarpoolRideLeg[] | null
  isBlank: boolean
  /** Open transport decision for this kid (gap / waiting-on-me). */
  isGap: boolean
  waitingOnMe: boolean
  decidedAssignees: DecidedAssignee[]
}

/** True when legs are missing or every in-play slot is still NEEDS_RIDE. */
export function isBlankTransportPlan(
  legs: readonly CarpoolRideLeg[] | null | undefined,
): boolean {
  if (legs == null || legs.length === 0) {
    return true
  }
  return legs.every((leg) => leg.phase === "NEEDS_RIDE")
}

/**
 * All active own plans for an event. Prefers `ownRequests`; falls back to
 * singular `ownRequest` for fixtures that only set that field.
 */
export function resolveOwnRidePlans(
  rideEvent: CarpoolRideEvent | null | undefined,
): CarpoolRide[]
export function resolveOwnRidePlans(options: {
  ownRequests?: readonly CarpoolRide[] | null
  ownRequest?: CarpoolRide | null
}): CarpoolRide[]
export function resolveOwnRidePlans(
  rideEventOrOptions:
    | CarpoolRideEvent
    | null
    | undefined
    | {
        ownRequests?: readonly CarpoolRide[] | null
        ownRequest?: CarpoolRide | null
      },
): CarpoolRide[] {
  if (rideEventOrOptions == null) {
    return []
  }
  const ownRequests =
    "eventKey" in rideEventOrOptions
      ? rideEventOrOptions.ownRequests
      : rideEventOrOptions.ownRequests
  if (ownRequests != null && ownRequests.length > 0) {
    return [...ownRequests]
  }
  const ownRequest =
    "eventKey" in rideEventOrOptions
      ? rideEventOrOptions.ownRequest
      : rideEventOrOptions.ownRequest
  return ownRequest != null ? [ownRequest] : []
}

/** Plan that includes this kid, or null when the kid is not on any own plan. */
export function ownRidePlanForKid(
  plans: readonly CarpoolRide[],
  kidId: string,
): CarpoolRide | null {
  return plans.find((plan) => plan.kidIds.includes(kidId)) ?? null
}

/**
 * Non-blank transport legs for chip / gap chrome, or null when coverage owns
 * the row (blank NEEDS_RIDE plan). With 2+ own plans, returns null — callers
 * should use per-plan chip groups instead of a single shared leg strip.
 */
export function nonBlankTransportLegs(
  ownRequest: CarpoolRide | null | undefined,
  rideEvent: CarpoolRideEvent | null | undefined,
): CarpoolRideLeg[] | null {
  const plans = resolveOwnRidePlans(rideEvent ?? { ownRequest })
  if (plans.length >= 2) {
    return null
  }
  const single = plans[0] ?? ownRequest ?? null
  const fromRequest =
    single?.legs != null && single.legs.length > 0 ? single.legs : null
  const fromEvent =
    rideEvent?.ownLegs != null && rideEvent.ownLegs.length > 0 ? rideEvent.ownLegs : null
  const legs = fromRequest ?? fromEvent
  if (legs == null || isBlankTransportPlan(legs)) {
    return null
  }
  return [...legs]
}

/** Flatten legs from every own plan (waiting-on-me / assignee scans). */
export function allOwnPlanLegs(
  rideEvent: CarpoolRideEvent | null | undefined,
): CarpoolRideLeg[] | null {
  const plans = resolveOwnRidePlans(rideEvent)
  if (plans.length === 0) {
    return rideEvent?.ownLegs ?? null
  }
  const legs = plans.flatMap((plan) => plan.legs ?? [])
  return legs.length > 0 ? legs : null
}

/**
 * Revert targets across every own plan (dedupe by assignee key, merge legs).
 */
export function decidedAssigneesFromOwnPlans(
  rideEvent: CarpoolRideEvent | null | undefined,
  options: {
    currentAdultId?: string | null
    teammateCircleId?: string | null
    teammateCircleName?: string | null
  } = {},
): DecidedAssignee[] {
  const plans = resolveOwnRidePlans(rideEvent)
  if (plans.length === 0) {
    return decidedAssigneesFromLegs(rideEvent?.ownLegs, options)
  }
  const byKey = new Map<string, DecidedAssignee>()
  for (const plan of plans) {
    for (const assignee of decidedAssigneesFromLegs(plan.legs, {
      currentAdultId: options.currentAdultId,
      teammateCircleId: plan.acceptingCircleId ?? options.teammateCircleId,
      teammateCircleName: plan.acceptingCircleName ?? options.teammateCircleName,
    })) {
      const existing = byKey.get(assignee.key)
      if (existing == null) {
        byKey.set(assignee.key, { ...assignee, legKinds: [...assignee.legKinds] })
        continue
      }
      const kinds = new Set([...existing.legKinds, ...assignee.legKinds])
      byKey.set(assignee.key, {
        ...existing,
        legKinds: (["TO", "FROM"] as const).filter((kind) => kinds.has(kind)),
        waiting: existing.waiting && assignee.waiting,
      })
    }
  }
  return [...byKey.values()]
}

export function orderedTransportLegs(
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

/** ACCEPTED inbound asks this circle drives, counted per CONFIRMED leg kind. */
export function inboundConfirmedCountByKind(
  otherRequests: readonly CarpoolRide[] | null | undefined,
  circleId: string | null | undefined,
): Record<CarpoolLegKind, number> {
  const counts: Record<CarpoolLegKind, number> = { TO: 0, FROM: 0 }
  if (otherRequests == null || circleId == null || circleId === "") {
    return counts
  }
  for (const request of otherRequests) {
    if (request.status !== "ACCEPTED" || request.acceptingCircleId !== circleId) {
      continue
    }
    for (const leg of orderedTransportLegs(request.legs)) {
      if (leg.phase === "CONFIRMED") {
        counts[leg.kind] += 1
      }
    }
  }
  return counts
}

/**
 * Collapse dual Getting there / Coming back chips when bodies match.
 * Bodies = text after the first ": " (phase + assignee + · +n).
 * Matching → one **unprefixed** chip (locked by carpool-leg-chip-collapse),
 * including matching Needs ride → plain `Needs ride`.
 */
export function collapseMatchingLegChips<T extends { label: string; tone: string }>(
  chips: readonly T[],
): T[] {
  if (chips.length !== 2) {
    return [...chips]
  }
  const [toChip, fromChip] = chips
  if (toChip == null || fromChip == null) {
    return [...chips]
  }
  const toBody = chipBody(toChip.label)
  const fromBody = chipBody(fromChip.label)
  if (toBody == null || fromBody == null || toBody !== fromBody) {
    return [...chips]
  }
  return [
    {
      ...toChip,
      label: toBody,
      tone: toChip.tone === "route" || fromChip.tone === "route" ? "route" : toChip.tone,
    },
  ]
}

function chipBody(label: string): string | null {
  const separator = label.indexOf(": ")
  if (separator === -1) {
    return null
  }
  return label.slice(separator + 2)
}

function waitingHouseholdForAdult(
  legs: readonly CarpoolRideLeg[] | null | undefined,
  adultId: string | null | undefined,
): boolean {
  if (legs == null || adultId == null || adultId === "") {
    return false
  }
  return legs.some(
    (leg) => leg.phase === "WAITING_HOUSEHOLD" && leg.assigneeAdultId === adultId,
  )
}

function assigneeKey(leg: CarpoolRideLeg): string | null {
  if (leg.phase === "NEEDS_RIDE") {
    return null
  }
  if (leg.phase === "ASKED_TEAM") {
    return "ask-team"
  }
  if (leg.assigneeAdultId != null) {
    return `adult:${leg.assigneeAdultId}`
  }
  if (leg.assigneeCircleId != null) {
    return `circle:${leg.assigneeCircleId}`
  }
  const name = leg.assigneeDisplayName?.trim() || leg.assigneeCircleName?.trim()
  return name ? `name:${name}` : `phase:${leg.phase}:${leg.kind}`
}

function decidedAssigneeKindForLeg(leg: CarpoolRideLeg): DecidedAssigneeKind {
  if (leg.phase === "ASKED_TEAM") {
    return "team_ask"
  }
  // Team accept stamps assigneeCircleId; household legs use adult only.
  if (leg.assigneeCircleId != null) {
    return "teammate"
  }
  if (leg.assigneeAdultId != null) {
    return "household"
  }
  if (leg.assigneeCircleName != null) {
    return "teammate"
  }
  return "household"
}

function assigneeLabel(
  leg: CarpoolRideLeg,
  currentAdultId: string | null | undefined,
): string {
  if (leg.phase === "ASKED_TEAM") {
    return "the team"
  }
  if (
    currentAdultId != null &&
    leg.assigneeAdultId != null &&
    leg.assigneeAdultId === currentAdultId
  ) {
    return "You"
  }
  const display = leg.assigneeDisplayName?.trim()
  if (display) {
    return display.split(/\s+/)[0] ?? display
  }
  const circle = leg.assigneeCircleName?.trim()
  if (circle) {
    return circleDisplayName(circle)
  }
  return "Driver"
}

/**
 * One revert target per distinct decided assignee (household adult, teammate
 * circle, or open team ask), with the leg kinds they own.
 */
export function decidedAssigneesFromLegs(
  legs: readonly CarpoolRideLeg[] | null | undefined,
  options: {
    currentAdultId?: string | null
    /** When CONFIRMED legs lack circle stamps (fixtures), treat as teammate. */
    teammateCircleId?: string | null
    teammateCircleName?: string | null
  } = {},
): DecidedAssignee[] {
  const ordered = orderedTransportLegs(legs)
  const byKey = new Map<string, DecidedAssignee>()

  for (const leg of ordered) {
    if (leg.phase === "NEEDS_RIDE") {
      continue
    }
    let key = assigneeKey(leg)
    let kind = decidedAssigneeKindForLeg(leg)
    let label = assigneeLabel(leg, options.currentAdultId)
    let adultId = leg.assigneeAdultId
    let circleId = leg.assigneeCircleId

    if (
      leg.phase === "CONFIRMED" &&
      kind === "household" &&
      leg.assigneeAdultId == null &&
      (options.teammateCircleId != null || options.teammateCircleName != null)
    ) {
      kind = "teammate"
      circleId = options.teammateCircleId ?? null
      key = circleId != null ? `circle:${circleId}` : `name:${options.teammateCircleName}`
      label = circleDisplayName(options.teammateCircleName)
      adultId = null
    }

    if (key == null) {
      continue
    }
    const existing = byKey.get(key)
    if (existing != null) {
      if (!existing.legKinds.includes(leg.kind)) {
        existing.legKinds.push(leg.kind)
      }
      if (leg.phase !== "WAITING_HOUSEHOLD") {
        existing.waiting = false
      }
      continue
    }
    byKey.set(key, {
      key,
      kind,
      label,
      adultId,
      circleId,
      legKinds: [leg.kind],
      waiting: leg.phase === "WAITING_HOUSEHOLD",
    })
  }

  return [...byKey.values()].map((row) => ({
    ...row,
    legKinds: [...row.legKinds].sort((left, right) =>
      left === right ? 0 : left === "TO" ? -1 : 1,
    ),
  }))
}

/** Revert / cancel-request label for one decided assignee (leg-scoped when needed). */
export function decidedAssigneeRevertLabel(assignee: DecidedAssignee): string {
  const legSuffix =
    assignee.legKinds.length === 1
      ? ` for ${legKindLabel(assignee.legKinds[0]!).toLowerCase()}`
      : ""

  if (assignee.kind === "team_ask") {
    return `No longer need a ride${legSuffix}? Cancel this ask`
  }
  if (assignee.waiting) {
    return `Cancel request to ${assignee.label}${legSuffix}`
  }
  if (assignee.kind === "teammate") {
    return `${assignee.label} can't drive anymore${legSuffix}? Find a new ride`
  }
  if (assignee.label === "You") {
    return `Can't drive anymore${legSuffix}? Reassign the ride`
  }
  return `${assignee.label} can't drive anymore${legSuffix}? Reassign`
}

/**
 * Gap kids for Assign / Needs coverage: calendar uncovered, minus ACCEPTED
 * riders — unless a non-blank plan still has NEEDS_RIDE (keep those kids) or a
 * settled non-blank plan covers the row (drop uncovered owned by that plan).
 * Pass `ownRequests` (or a ride event that lists them) so a sibling's settled
 * plan does not hide another kid's NEEDS_RIDE / blank plan gap.
 */
export function transportGapKidIds(
  uncoveredKidIds: readonly string[],
  ownRequest: CarpoolRide | null | undefined,
  ownLegs: readonly CarpoolRideLeg[] | null | undefined,
  ownRequests?: readonly CarpoolRide[] | null,
): string[] {
  const plans = resolveOwnRidePlans({ ownRequests, ownRequest })
  if (plans.length >= 2) {
    return transportGapKidIdsForPlans(uncoveredKidIds, plans)
  }

  const single = plans[0] ?? ownRequest ?? null
  const legs = single?.legs ?? ownLegs
  const blank = isBlankTransportPlan(legs)
  if (!blank && legs != null) {
    const openNeedsRide = legs.some((leg) => leg.phase === "NEEDS_RIDE")
    if (openNeedsRide) {
      const ids = new Set(uncoveredKidIds)
      if (single != null) {
        for (const kidId of single.kidIds) {
          ids.add(kidId)
        }
      }
      return [...ids]
    }
    // Settled non-blank plan — calendar uncovered is stale for plan kids.
    if (single == null) {
      return []
    }
    const onRide = new Set(single.kidIds)
    return uncoveredKidIds.filter((kidId) => !onRide.has(kidId))
  }
  return remainingCoverageGapKidIds([...uncoveredKidIds], single)
}

function transportGapKidIdsForPlans(
  uncoveredKidIds: readonly string[],
  plans: readonly CarpoolRide[],
): string[] {
  const gaps = new Set<string>()
  const settledKids = new Set<string>()

  for (const plan of plans) {
    const legs = plan.legs
    const blank = isBlankTransportPlan(legs)
    if (blank) {
      for (const kidId of plan.kidIds) {
        gaps.add(kidId)
      }
      continue
    }
    if (legs != null && legs.some((leg) => leg.phase === "NEEDS_RIDE")) {
      for (const kidId of plan.kidIds) {
        gaps.add(kidId)
      }
      continue
    }
    for (const kidId of plan.kidIds) {
      settledKids.add(kidId)
    }
  }

  for (const kidId of uncoveredKidIds) {
    if (!settledKids.has(kidId)) {
      gaps.add(kidId)
    }
  }

  return [...gaps]
}

export function transportGapKidIdsForRideEvent(
  uncoveredKidIds: readonly string[],
  rideEvent: CarpoolRideEvent | null | undefined,
): string[] {
  return transportGapKidIds(
    uncoveredKidIds,
    rideEvent?.ownRequest,
    rideEvent?.ownLegs,
    rideEvent?.ownRequests,
  )
}

export function transportPlanForItem(options: {
  item: CalendarItem
  rideEvent: CarpoolRideEvent | null | undefined
  currentAdultId: string
  circleId?: string | null
  kidId?: string
}): TransportPlanSlots {
  const { item, rideEvent, currentAdultId, kidId } = options
  const plans = resolveOwnRidePlans(rideEvent)
  const plan =
    kidId != null ? ownRidePlanForKid(plans, kidId) : (plans[0] ?? null)
  const ownRequest = plan ?? rideEvent?.ownRequest ?? null
  const legs =
    kidId != null && plans.length >= 2
      ? plan != null && !isBlankTransportPlan(plan.legs)
        ? [...(plan.legs ?? [])]
        : null
      : nonBlankTransportLegs(ownRequest, rideEvent)
  const legsForWaiting = allOwnPlanLegs(rideEvent)
  const waitingOnMe = waitingHouseholdForAdult(
    legsForWaiting ?? rideEvent?.ownLegs ?? legs,
    currentAdultId,
  )
  const gapKids = transportGapKidIdsForRideEvent(item.uncoveredKidIds, rideEvent)

  let isGap = false
  if (kidId != null && plans.length >= 2) {
    isGap = gapKids.includes(kidId) || waitingOnMe
  } else if (legs == null) {
    isGap =
      (kidId != null ? gapKids.includes(kidId) : gapKids.length > 0) || waitingOnMe
  } else {
    isGap = legs.some((leg) => leg.phase === "NEEDS_RIDE") || waitingOnMe
  }

  return {
    legs,
    isBlank: legs == null,
    isGap,
    waitingOnMe,
    decidedAssignees: decidedAssigneesFromOwnPlans(rideEvent, {
      currentAdultId,
    }),
  }
}

/**
 * Own-ride rollup that prefers non-blank legs over uncoveredKidIds / sole
 * ACCEPTED teammate when a mixed plan still needs a decision.
 */
export function ownRideStatusFromTransportPlan(options: {
  kidId: string
  item: CalendarItem
  ownRequest: CarpoolRide | null | undefined
  ownLegs: readonly CarpoolRideLeg[] | null | undefined
  currentAdultId: string
  householdDriverLabel: (
    coveringAdultId: string,
    coveringAdultDisplayName: string | null,
  ) => string
}): TransportOwnRideStatus {
  const { kidId, item, ownRequest, ownLegs, currentAdultId, householdDriverLabel } = options
  const blank = isBlankTransportPlan(ownLegs)

  if (!blank && ownLegs != null) {
    if (waitingHouseholdForAdult(ownLegs, currentAdultId)) {
      return { driver: "You", confirmed: false }
    }
    if (ownLegs.some((leg) => leg.phase === "NEEDS_RIDE")) {
      return "unassigned"
    }
    const waitingOther = ownLegs.find(
      (leg) =>
        leg.phase === "WAITING_HOUSEHOLD" &&
        leg.assigneeAdultId != null &&
        leg.assigneeAdultId !== currentAdultId,
    )
    if (waitingOther != null) {
      return {
        driver: householdDriverLabel(
          waitingOther.assigneeAdultId!,
          waitingOther.assigneeDisplayName,
        ),
        confirmed: false,
      }
    }
    if (ownLegs.some((leg) => leg.phase === "ASKED_TEAM")) {
      if (ownRequest?.kidIds.includes(kidId) && ownRequest.status === "PENDING") {
        return "requested"
      }
      if (ownRequest?.kidIds.includes(kidId) && ownRequest.status === "ACCEPTED") {
        return {
          driver: circleDisplayName(ownRequest.acceptingCircleName),
          confirmed: true,
        }
      }
      return "requested"
    }
    // All CONFIRMED (household and/or teammate).
    if (ownRequest?.kidIds.includes(kidId) && ownRequest.status === "ACCEPTED") {
      const householdConfirmed = ownLegs.find(
        (leg) => leg.phase === "CONFIRMED" && leg.assigneeAdultId != null,
      )
      const teamConfirmed = ownLegs.find(
        (leg) =>
          leg.phase === "CONFIRMED" &&
          (leg.assigneeCircleId != null || leg.assigneeCircleName != null) &&
          leg.assigneeAdultId == null,
      )
      // Mixed household + teammate: prefer a confirmed rollup (not a gap).
      if (householdConfirmed != null && teamConfirmed == null) {
        // Fall through to household label when every confirmed leg is household.
      } else if (teamConfirmed != null && householdConfirmed == null) {
        return {
          driver: circleDisplayName(ownRequest.acceptingCircleName),
          confirmed: true,
        }
      } else {
        return {
          driver: circleDisplayName(ownRequest.acceptingCircleName),
          confirmed: true,
        }
      }
    }
    const self = ownLegs.find(
      (leg) =>
        leg.phase === "CONFIRMED" &&
        leg.assigneeAdultId != null &&
        leg.assigneeAdultId === currentAdultId,
    )
    if (self != null) {
      return { driver: "You", confirmed: true }
    }
    const other = ownLegs.find(
      (leg) => leg.phase === "CONFIRMED" && leg.assigneeAdultId != null,
    )
    if (other != null) {
      return {
        driver: householdDriverLabel(other.assigneeAdultId!, other.assigneeDisplayName),
        confirmed: true,
      }
    }
    if (ownRequest?.kidIds.includes(kidId) && ownRequest.status === "ACCEPTED") {
      return {
        driver: circleDisplayName(ownRequest.acceptingCircleName),
        confirmed: true,
      }
    }
    return { driver: "Assigned", confirmed: true }
  }

  if (ownRequest?.kidIds.includes(kidId)) {
    if (ownRequest.status === "ACCEPTED") {
      return {
        driver: circleDisplayName(ownRequest.acceptingCircleName),
        confirmed: true,
      }
    }
    if (ownRequest.status === "PENDING") {
      return "requested"
    }
    // Blank PLAN (or other non-accepted) still covers this kid as an open gap.
    if (blank) {
      return "unassigned"
    }
  }

  const coveragesForKid = activeCoverages(item).filter((coverage) =>
    coverage.kidIds.includes(kidId),
  )
  const confirmed = coveragesForKid.find((coverage) => coverage.status === "CONFIRMED")
  if (confirmed) {
    return {
      driver: householdDriverLabel(
        confirmed.coveringAdultId,
        confirmed.coveringAdultDisplayName,
      ),
      confirmed: true,
    }
  }
  const pending = coveragesForKid.find((coverage) => coverage.status === "PENDING")
  if (pending) {
    return {
      driver: householdDriverLabel(
        pending.coveringAdultId,
        pending.coveringAdultDisplayName,
      ),
      confirmed: false,
    }
  }

  const gapKidIds = transportGapKidIds(item.uncoveredKidIds, ownRequest, ownLegs)
  if (gapKidIds.includes(kidId)) {
    return "unassigned"
  }
  return { driver: "Assigned", confirmed: true }
}

/** TO-only / both → pickup; FROM-only → drop-off (display-only, no meet-at). */
export function ridePlaceLineKind(
  legs: readonly CarpoolRideLeg[] | null | undefined,
): "pickup" | "dropoff" {
  const ordered = orderedTransportLegs(legs)
  if (ordered.length === 0) {
    return "pickup"
  }
  const active = ordered.filter((leg) => leg.phase !== "NEEDS_RIDE")
  if (active.length === 1 && active[0]?.kind === "FROM") {
    return "dropoff"
  }
  const confirmed = ordered.filter((leg) => leg.phase === "CONFIRMED")
  if (confirmed.length === 1 && confirmed[0]?.kind === "FROM") {
    return "dropoff"
  }
  return "pickup"
}

export function inboundWithdrawLegs(
  legs: readonly CarpoolRideLeg[] | null | undefined,
): CarpoolLegKind[] | undefined {
  const confirmed = orderedTransportLegs(legs).filter((leg) => leg.phase === "CONFIRMED")
  if (confirmed.length === 0 || confirmed.length === 2) {
    return undefined
  }
  return confirmed.map((leg) => leg.kind)
}

export function inboundWithdrawLabel(
  legs: readonly CarpoolRideLeg[] | null | undefined,
): string {
  const kinds = inboundWithdrawLegs(legs)
  if (kinds?.length === 1 && kinds[0] === "FROM") {
    return "Can't drive them home anymore?"
  }
  if (kinds?.length === 1 && kinds[0] === "TO") {
    return "Can't take them there anymore?"
  }
  return "Can't take them anymore"
}
