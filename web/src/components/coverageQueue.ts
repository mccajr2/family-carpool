/**
 * Shared coverage priority queue for the hero & coverage flow redesign.
 * Pure view-model — no UI, no API calls. See ADR-0001 and
 * docs/agenda-coverage-web-contract.md (Hero carousel queue).
 *
 * Downstream contract: assigning any real driver resets attendance to "going"
 * (ADR-0003) — enforced in household-driver-assignment, not here.
 */

import type {
  CalendarItem,
  CalendarItemSource,
  CarpoolRide,
  CarpoolRideEvent,
  CarpoolRideLeg,
  FamilyMember,
  RsvpStatus,
} from "@/api/types"
import {
  calendarItemKey,
  memberLabel,
} from "@/components/coverageDisplay"
import { rsvpStatusForKid } from "@/components/rsvpDisplay"
import { agendaDayBoundaries } from "@/components/agendaDayGroups"
import {
  ownRidePlanForKid,
  ownRideStatusFromTransportPlan,
  resolveOwnRidePlans,
} from "@/components/transportPlan"

export type Attendance = "going" | "not_going"

/** Ride-side status for one child on one event (not OpenAPI shapes). */
export type OwnRideStatus =
  | "unassigned"
  | "requested"
  | { driver: string; confirmed: boolean }

export type CarpoolRequestStatus = "pending" | "accepted" | "declined"

export type CarpoolRequest = {
  id: string
  requestingCircleName: string | null
  kidFirstNames: string[]
  seats: number
  pickupPlaceName: string
  pickupAddress: string
  pickupTown: string | null
  detourMinutes: number | null
  status: CarpoolRequestStatus
  autoDeclined?: boolean
  passedByMe?: boolean
}

/** One in-play kid/event row for queue and chip logic. */
export type CoverageGameEvent = {
  id: string
  kidId: string
  title: string
  startsAt: string
  /** Sort key — typically epoch ms from startsAt. */
  order: number
  attendance: Attendance
  ownRide: OwnRideStatus
  requests: CarpoolRequest[]
  /**
   * Circle transport plan legs (TO/FROM) when known. Used so a rollup
   * `ownRide` of requested/confirmed still queues when any leg is NEEDS_RIDE.
   */
  ownLegs?: CarpoolRideLeg[]
  /**
   * Calendar-item keys (`source-id`) of this kid's `KID_TIME_OVERLAP` peers.
   * Omitted or empty when the calendar item has no such conflicts for the kid.
   */
  kidTimeOverlapPeerKeys?: readonly string[]
}

export type QueueItem =
  | { kind: "ownRide"; game: CoverageGameEvent }
  | { kind: "request"; game: CoverageGameEvent; request: CarpoolRequest }
  | {
      kind: "playerConflict"
      /** Sooner peer row (emit / horizon anchor). */
      game: CoverageGameEvent
      /** Later peer row for the same unresolved kids. */
      peerGame: CoverageGameEvent
      /** Household kids still in-play on both peers (stable kidId order). */
      kidIds: readonly string[]
    }

/** `{calendarItemKey}:{kidId}` → calendar item key for list exclusion / lookup. */
export function coverageGameEventKey(gameId: string): string {
  const separator = gameId.lastIndexOf(":")
  return separator === -1 ? gameId : gameId.slice(0, separator)
}

export function isUnassigned(ownRide: OwnRideStatus): boolean {
  return ownRide === "unassigned"
}

export function isPendingHouseholdConfirm(
  ownRide: OwnRideStatus,
): ownRide is { driver: string; confirmed: false } {
  return typeof ownRide === "object" && !ownRide.confirmed
}

export function isConfirmedDriver(
  ownRide: OwnRideStatus,
): ownRide is { driver: string; confirmed: true } {
  return typeof ownRide === "object" && ownRide.confirmed
}

export function acceptedRiders(game: CoverageGameEvent): CarpoolRequest[] {
  return game.requests.filter((request) => request.status === "accepted")
}

/** Inbound accepted carpool **kids** on this game row (not request count). */
export function acceptedRiderKidCount(game: CoverageGameEvent): number {
  return acceptedRiders(game).reduce((sum, request) => {
    const fromNames = request.kidFirstNames?.length ?? 0
    if (fromNames > 0) {
      return sum + fromNames
    }
    return sum + Math.max(0, request.seats)
  }, 0)
}

export function pendingRequests(game: CoverageGameEvent): CarpoolRequest[] {
  return game.requests.filter((request) => request.status === "pending")
}

function isInPlay(game: CoverageGameEvent): boolean {
  return game.attendance !== "not_going"
}

/**
 * True when a mixed plan still has an open leg (`NEEDS_RIDE` alongside a
 * decided TO/FROM). Blank plans (every leg still `NEEDS_RIDE`) are not a
 * per-leg gap — household coverage rollup owns those, matching chip logic.
 */
export function hasNeedsRideOwnLeg(game: CoverageGameEvent): boolean {
  const legs = game.ownLegs
  if (legs == null || legs.length === 0) {
    return false
  }
  const anyNeedsRide = legs.some((leg) => leg.phase === "NEEDS_RIDE")
  if (!anyNeedsRide) {
    return false
  }
  return legs.some((leg) => leg.phase !== "NEEDS_RIDE")
}

/** WAITING_HOUSEHOLD legs assigned to this adult (confirm/decline-for-self). */
export function waitingHouseholdLegsForAdult(
  legs: readonly CarpoolRideLeg[] | null | undefined,
  adultId: string | null | undefined,
): CarpoolRideLeg[] {
  if (legs == null || adultId == null || adultId === "") {
    return []
  }
  return legs.filter(
    (leg) =>
      leg.phase === "WAITING_HOUSEHOLD" && leg.assigneeAdultId === adultId,
  )
}

export function hasWaitingHouseholdForAdult(
  legs: readonly CarpoolRideLeg[] | null | undefined,
  adultId: string | null | undefined,
): boolean {
  return waitingHouseholdLegsForAdult(legs, adultId).length > 0
}

/**
 * Own-child row that needs a decision from the signed-in adult in the hero
 * carousel. Unassigned gaps, pending confirm-for-self, and any plan leg in
 * `NEEDS_RIDE` — "Asked the team" (both legs) and waiting on another household
 * driver stay out of queue unless a leg is still Needs ride.
 */
export function isOwnRideGap(game: CoverageGameEvent): boolean {
  if (!isInPlay(game)) {
    return false
  }
  if (hasNeedsRideOwnLeg(game)) {
    return true
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

function sortByOrder<T extends { order: number }>(items: readonly T[]): T[] {
  return [...items].sort((left, right) => left.order - right.order)
}

function isActionableInboundRequest(request: CarpoolRequest): boolean {
  return request.status === "pending" && !request.autoDeclined && !request.passedByMe
}

/** Unordered event-pair key for player-conflict dedupe. */
function playerConflictPairKey(eventKeyA: string, eventKeyB: string): string {
  return eventKeyA < eventKeyB
    ? `${eventKeyA}|${eventKeyB}`
    : `${eventKeyB}|${eventKeyA}`
}

type UnresolvedPlayerConflict = {
  pairKey: string
  soonerEventKey: string
  laterEventKey: string
  soonerGame: CoverageGameEvent
  laterGame: CoverageGameEvent
  kidIds: string[]
}

/**
 * Unresolved same-kid overlaps: kid still in-play on both peers of a
 * `KID_TIME_OVERLAP`. One entry per unordered event pair.
 */
function unresolvedPlayerConflicts(
  games: readonly CoverageGameEvent[],
): UnresolvedPlayerConflict[] {
  const byGameId = new Map<string, CoverageGameEvent>()
  for (const game of games) {
    byGameId.set(game.id, game)
  }

  const byPair = new Map<
    string,
    {
      soonerEventKey: string
      laterEventKey: string
      soonerGame: CoverageGameEvent
      laterGame: CoverageGameEvent
      kidIds: Set<string>
    }
  >()

  for (const game of games) {
    if (!isInPlay(game)) {
      continue
    }
    const eventKey = coverageGameEventKey(game.id)
    const peerKeys = game.kidTimeOverlapPeerKeys
    if (peerKeys == null || peerKeys.length === 0) {
      continue
    }
    for (const peerKey of peerKeys) {
      if (peerKey === eventKey) {
        continue
      }
      const peerGame = byGameId.get(`${peerKey}:${game.kidId}`)
      if (peerGame == null || !isInPlay(peerGame)) {
        continue
      }
      const pairKey = playerConflictPairKey(eventKey, peerKey)
      const existing = byPair.get(pairKey)
      if (existing) {
        existing.kidIds.add(game.kidId)
        continue
      }
      const soonerFirst =
        game.order < peerGame.order ||
        (game.order === peerGame.order && eventKey <= peerKey)
      byPair.set(pairKey, {
        soonerEventKey: soonerFirst ? eventKey : peerKey,
        laterEventKey: soonerFirst ? peerKey : eventKey,
        soonerGame: soonerFirst ? game : peerGame,
        laterGame: soonerFirst ? peerGame : game,
        kidIds: new Set([game.kidId]),
      })
    }
  }

  return [...byPair.entries()]
    .map(([pairKey, row]) => ({
      pairKey,
      soonerEventKey: row.soonerEventKey,
      laterEventKey: row.laterEventKey,
      soonerGame: row.soonerGame,
      laterGame: row.laterGame,
      kidIds: [...row.kidIds].sort(),
    }))
    .sort((left, right) => {
      const orderDelta = left.soonerGame.order - right.soonerGame.order
      if (orderDelta !== 0) {
        return orderDelta
      }
      return left.pairKey.localeCompare(right.pairKey)
    })
}

/**
 * Priority queue per ADR-0001 (event-grouped): walk calendar events
 * soonest-first; for each event emit unresolved player-conflict (once per
 * pair, at the sooner peer), then own-ride gaps, then actionable inbound
 * asks (deduped by `request.id`). Empty array = all caught up.
 */
export function getQueue(games: readonly CoverageGameEvent[]): QueueItem[] {
  const inPlay = games.filter(isInPlay)
  const byEvent = new Map<string, CoverageGameEvent[]>()
  const eventOrder = new Map<string, number>()

  for (const game of inPlay) {
    const eventKey = coverageGameEventKey(game.id)
    const group = byEvent.get(eventKey)
    if (group) {
      group.push(game)
    } else {
      byEvent.set(eventKey, [game])
      eventOrder.set(eventKey, game.order)
    }
  }

  const eventKeys = [...byEvent.keys()].sort(
    (left, right) => (eventOrder.get(left) ?? 0) - (eventOrder.get(right) ?? 0),
  )

  const conflictsBySoonerEvent = new Map<string, UnresolvedPlayerConflict[]>()
  for (const conflict of unresolvedPlayerConflicts(games)) {
    const group = conflictsBySoonerEvent.get(conflict.soonerEventKey)
    if (group) {
      group.push(conflict)
    } else {
      conflictsBySoonerEvent.set(conflict.soonerEventKey, [conflict])
    }
  }

  const queue: QueueItem[] = []
  const emittedRequestIds = new Set<string>()
  const emittedConflictPairs = new Set<string>()

  for (const eventKey of eventKeys) {
    const eventGames = sortByOrder(byEvent.get(eventKey) ?? [])

    for (const conflict of conflictsBySoonerEvent.get(eventKey) ?? []) {
      if (emittedConflictPairs.has(conflict.pairKey)) {
        continue
      }
      emittedConflictPairs.add(conflict.pairKey)
      queue.push({
        kind: "playerConflict",
        game: conflict.soonerGame,
        peerGame: conflict.laterGame,
        kidIds: conflict.kidIds,
      })
    }

    // One own-ride slide per event — the slide already has per-kid coverage chrome.
    const ownGaps = eventGames.filter(isOwnRideGap)
    if (ownGaps.length > 0) {
      queue.push({ kind: "ownRide", game: ownGaps[0]! })
    }

    for (const game of eventGames) {
      for (const request of pendingRequests(game)) {
        if (!isActionableInboundRequest(request) || emittedRequestIds.has(request.id)) {
          continue
        }
        emittedRequestIds.add(request.id)
        queue.push({ kind: "request", game, request })
      }
    }
  }

  return queue
}

/** Hero carousel horizon — same seven-day window as agenda "This week". */
export function filterQueueWithinHorizon(
  queue: readonly QueueItem[],
  now: Date = new Date(),
): QueueItem[] {
  const { todayStart, weekEnd } = agendaDayBoundaries(now)
  return queue.filter((item) => {
    const startsAt = new Date(item.game.startsAt)
    if (Number.isNaN(startsAt.getTime())) {
      return false
    }
    return startsAt >= todayStart && startsAt < weekEnd
  })
}

/**
 * When the parent asks the wider team for a ride, pending inbound requests on
 * that game are auto-declined. Fires only on `"requested"` — not `"unassigned"`
 * or pending household confirm.
 */
export function autoDeclineUnofferable(
  games: readonly CoverageGameEvent[],
): CoverageGameEvent[] {
  return games.map((game) => {
    if (game.ownRide !== "requested") {
      return game
    }
    return {
      ...game,
      requests: game.requests.map((request) =>
        request.status === "pending"
          ? { ...request, status: "declined" as const, autoDeclined: true }
          : request,
      ),
    }
  })
}

/**
 * Re-apply sticky session auto-decline ids after remap. OpenAPI rides stay
 * PENDING; the client keeps showing them as auto-declined until Accept /
 * Reconsider clears the id — even after ownRide leaves `"requested"`.
 */
function applySessionAutoDeclined(
  games: readonly CoverageGameEvent[],
  sessionAutoDeclinedIds: ReadonlySet<string>,
): CoverageGameEvent[] {
  if (sessionAutoDeclinedIds.size === 0) {
    return [...games]
  }
  return games.map((game) => ({
    ...game,
    requests: game.requests.map((request) => {
      if (!sessionAutoDeclinedIds.has(request.id) || request.status !== "pending") {
        return request
      }
      return { ...request, status: "declined" as const, autoDeclined: true }
    }),
  }))
}

function collectAutoDeclinedRideIds(
  games: readonly CoverageGameEvent[],
): string[] {
  const ids = new Set<string>()
  for (const game of games) {
    for (const request of game.requests) {
      if (request.autoDeclined) {
        ids.add(request.id)
      }
    }
  }
  return [...ids]
}

/**
 * Central post-remap step: run `autoDeclineUnofferable`, then sticky session
 * ids. `newlyDeclinedRideIds` are ids marked by the transform while
 * `ownRide === "requested"` — callers add them to the session set.
 */
export function applyAutoDeclinedViewModel(
  games: readonly CoverageGameEvent[],
  sessionAutoDeclinedIds: ReadonlySet<string> = new Set(),
): { games: CoverageGameEvent[]; newlyDeclinedRideIds: string[] } {
  const transformed = autoDeclineUnofferable(games)
  const newlyDeclinedRideIds = collectAutoDeclinedRideIds(transformed).filter(
    (id) => !sessionAutoDeclinedIds.has(id),
  )
  return {
    games: applySessionAutoDeclined(transformed, sessionAutoDeclinedIds),
    newlyDeclinedRideIds,
  }
}

export type MapCoverageGamesOptions = {
  currentAdultId: string
  members: FamilyMember[]
}

/** Single read mapper: FEED missing/NO_RESPONSE → going; MANUAL → YES only. */
export function mapRsvpToAttendance(
  status: RsvpStatus,
  source: CalendarItemSource = "FEED",
): Attendance {
  if (source === "MANUAL") {
    return status === "YES" ? "going" : "not_going"
  }
  return status === "NO" ? "not_going" : "going"
}

function orderFromStartsAt(startsAt: string): number {
  const parsed = Date.parse(startsAt)
  return Number.isNaN(parsed) ? 0 : parsed
}

function householdDriverLabel(
  coveringAdultId: string,
  coveringAdultDisplayName: string | null,
  options: MapCoverageGamesOptions,
): string {
  if (coveringAdultId === options.currentAdultId) {
    return "You"
  }
  if (coveringAdultDisplayName?.trim()) {
    return coveringAdultDisplayName.trim()
  }
  const member = options.members.find((row) => row.adultId === coveringAdultId)
  return member ? memberLabel(member) : "Adult"
}

function mapCarpoolRideStatus(
  status: CarpoolRide["status"],
): CarpoolRequestStatus {
  switch (status) {
    case "PENDING":
      return "pending"
    case "ACCEPTED":
      return "accepted"
    case "CANCELLED":
    case "PLAN":
      // PLAN is own-plan only; inbound otherRequests never use it.
      return "declined"
  }
}

function mapCarpoolRequest(ride: CarpoolRide): CarpoolRequest {
  return {
    id: ride.id,
    requestingCircleName: ride.requestingCircleName,
    kidFirstNames: [...ride.kidFirstNames],
    seats: ride.seats,
    pickupPlaceName: ride.pickupPlaceName,
    pickupAddress: ride.pickupAddress,
    pickupTown: ride.pickupTown,
    detourMinutes: ride.detourMinutes,
    status: mapCarpoolRideStatus(ride.status),
    passedByMe: ride.passedByMe,
  }
}

function inboundRequests(rideEvent: CarpoolRideEvent | null | undefined): CarpoolRequest[] {
  return (rideEvent?.otherRequests ?? []).map(mapCarpoolRequest)
}

function mapOwnRideStatusForKid(
  kidId: string,
  item: CalendarItem,
  rideEvent: CarpoolRideEvent | null | undefined,
  options: MapCoverageGamesOptions,
): OwnRideStatus {
  const plans = resolveOwnRidePlans(rideEvent)
  const plan = ownRidePlanForKid(plans, kidId)
  const ownRequest =
    plan ?? (plans.length <= 1 ? (rideEvent?.ownRequest ?? null) : null)
  const ownLegs =
    plan?.legs ??
    (plans.length === 0
      ? rideEvent?.ownLegs
      : plans.length === 1
        ? (plan?.legs ?? rideEvent?.ownLegs)
        : null)
  return ownRideStatusFromTransportPlan({
    kidId,
    item,
    ownRequest,
    ownLegs,
    currentAdultId: options.currentAdultId,
    householdDriverLabel: (coveringAdultId, coveringAdultDisplayName) =>
      householdDriverLabel(coveringAdultId, coveringAdultDisplayName, options),
  })
}

/**
 * One row per kid on the calendar item. Inbound carpool asks are shared across
 * kid rows for the same event (same game, different kidId).
 */
export function mapCalendarItemToCoverageGames(
  item: CalendarItem,
  rideEvent: CarpoolRideEvent | null | undefined,
  options: MapCoverageGamesOptions,
): CoverageGameEvent[] {
  const eventKey = calendarItemKey(item)
  const order = orderFromStartsAt(item.startsAt)
  const requests = inboundRequests(rideEvent)
  const plans = resolveOwnRidePlans(rideEvent)

  return item.kidIds.map((kidId) => {
    const plan = ownRidePlanForKid(plans, kidId)
    const ownLegs =
      plan?.legs ??
      (plans.length === 0
        ? rideEvent?.ownLegs
        : plans.length === 1
          ? (plan?.legs ?? rideEvent?.ownLegs)
          : undefined)
    const kidTimeOverlapPeerKeys = [
      ...new Set(
        item.conflicts
          // Hero / getQueue only for same-kid overlaps — FAMILY_TIME_OVERLAP stays Agenda-only.
          .filter(
            (conflict) =>
              conflict.type === "KID_TIME_OVERLAP" && conflict.kidId === kidId,
          )
          .map((conflict) => `${conflict.otherSource}-${conflict.otherItemId}`),
      ),
    ]
    return {
      id: `${eventKey}:${kidId}`,
      kidId,
      title: item.title,
      startsAt: item.startsAt,
      order,
      attendance: mapRsvpToAttendance(rsvpStatusForKid(item, kidId), item.source),
      ownRide: mapOwnRideStatusForKid(kidId, item, rideEvent, options),
      requests,
      ...(ownLegs != null ? { ownLegs } : {}),
      ...(kidTimeOverlapPeerKeys.length > 0
        ? { kidTimeOverlapPeerKeys }
        : {}),
    }
  })
}

export function mapCalendarItemsToCoverageGames(
  items: readonly CalendarItem[],
  rideEventForItem: (item: CalendarItem) => CarpoolRideEvent | null | undefined,
  options: MapCoverageGamesOptions,
): CoverageGameEvent[] {
  return items.flatMap((item) =>
    mapCalendarItemToCoverageGames(item, rideEventForItem(item), options),
  )
}
