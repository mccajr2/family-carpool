/**
 * Shared coverage priority queue for the hero & coverage flow redesign.
 * Pure view-model — no UI, no API calls. See docs/specs/active/coverage-priority-engine.md.
 *
 * Downstream contract: assigning any real driver resets attendance to "going"
 * (ADR-0003) — enforced in household-driver-assignment, not here.
 */

import type {
  CalendarItem,
  CarpoolRide,
  CarpoolRideEvent,
  FamilyMember,
  RsvpStatus,
} from "@/api/types"
import { circleDisplayName } from "@/components/carpoolDisplay"
import {
  activeCoverages,
  calendarItemKey,
  memberLabel,
  remainingCoverageGapKidIds,
} from "@/components/coverageDisplay"
import { rsvpStatusForKid } from "@/components/rsvpDisplay"
import { agendaDayBoundaries } from "@/components/agendaDayGroups"

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
}

export type QueueItem =
  | { kind: "ownRide"; game: CoverageGameEvent }
  | { kind: "request"; game: CoverageGameEvent; request: CarpoolRequest }

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

export function pendingRequests(game: CoverageGameEvent): CarpoolRequest[] {
  return game.requests.filter((request) => request.status === "pending")
}

function isInPlay(game: CoverageGameEvent): boolean {
  return game.attendance !== "not_going"
}

/**
 * Own-child row that needs a decision from the signed-in adult in the hero
 * carousel. Unassigned gaps and pending confirm-for-self only — "Asked the
 * team" and waiting on another household driver are out of queue (see mock
 * `getQueue` + empty-state copy).
 */
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

function sortByOrder<T extends { order: number }>(items: readonly T[]): T[] {
  return [...items].sort((left, right) => left.order - right.order)
}

function isActionableInboundRequest(request: CarpoolRequest): boolean {
  return request.status === "pending" && !request.autoDeclined && !request.passedByMe
}

/**
 * Priority queue per ADR-0001: own-ride gaps first (soonest order), then pending
 * inbound carpool requests (soonest order). Empty array = all caught up.
 */
export function getQueue(games: readonly CoverageGameEvent[]): QueueItem[] {
  const inPlay = games.filter(isInPlay)

  const ownRideItems: QueueItem[] = sortByOrder(inPlay.filter(isOwnRideGap)).map((game) => ({
    kind: "ownRide" as const,
    game,
  }))

  const requestItems: QueueItem[] = []
  for (const game of sortByOrder(inPlay)) {
    for (const request of pendingRequests(game)) {
      if (isActionableInboundRequest(request)) {
        requestItems.push({ kind: "request", game, request })
      }
    }
  }

  return [...ownRideItems, ...requestItems]
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

function mapRsvpToAttendance(status: RsvpStatus): Attendance {
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
  const ownRequest = rideEvent?.ownRequest ?? null

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
        options,
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
        options,
      ),
      confirmed: false,
    }
  }

  const gapKidIds = remainingCoverageGapKidIds(item.uncoveredKidIds, ownRequest)
  if (gapKidIds.includes(kidId)) {
    return "unassigned"
  }

  // Covered or otherwise resolved — not a queue gap.
  return { driver: "Assigned", confirmed: true }
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

  return item.kidIds.map((kidId) => ({
    id: `${eventKey}:${kidId}`,
    kidId,
    title: item.title,
    startsAt: item.startsAt,
    order,
    attendance: mapRsvpToAttendance(rsvpStatusForKid(item, kidId)),
    ownRide: mapOwnRideStatusForKid(kidId, item, rideEvent, options),
    requests,
  }))
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
