import type {
  CalendarItem,
  CarpoolRide,
  CarpoolRideEvent,
  CarpoolRideLeg,
} from "@/api/types"
import { agendaDayBucketForStartsAt } from "@/components/agendaDayGroups"
import { eligiblePendingRideAccept } from "@/components/carpoolDisplay"
import {
  pendingCoverageForAdult,
  remainingCoverageGapKidIds,
} from "@/components/coverageDisplay"
import { hasWaitingHouseholdForAdult } from "@/components/coverageQueue"
import { isAgendaItemOutOfPlay } from "@/components/rsvpDisplay"

export type FocusRideOptions = {
  rideEventForItem: (item: CalendarItem) => CarpoolRideEvent | null | undefined
}

function hasNeedsRideOwnLeg(ownLegs?: CarpoolRideLeg[] | null): boolean {
  if (ownLegs == null || ownLegs.length === 0) {
    return false
  }
  const anyNeedsRide = ownLegs.some((leg) => leg.phase === "NEEDS_RIDE")
  if (!anyNeedsRide) {
    return false
  }
  // Blank both-NEEDS_RIDE plans are not Focus gaps — coverage rollup owns them.
  return ownLegs.some((leg) => leg.phase !== "NEEDS_RIDE")
}

/**
 * Family decisions only — remaining coverage gap, conflict, pending Confirm
 * for self, or any transport leg still in `NEEDS_RIDE`. Pass ACCEPTED
 * `ownRequest` so ride kids are not treated as a coverage gap.
 */
export function focusItemNeedsFamilyDecision(
  item: CalendarItem,
  currentAdultId: string,
  ownRequest?: CarpoolRide | null,
  ownLegs?: CarpoolRideLeg[] | null,
): boolean {
  if (hasNeedsRideOwnLeg(ownLegs)) {
    return true
  }
  const gapKids = remainingCoverageGapKidIds(item.uncoveredKidIds, ownRequest)
  if (gapKids.length > 0 || item.conflicts.length > 0) {
    return true
  }
  if (currentAdultId && pendingCoverageForAdult(item, currentAdultId)) {
    return true
  }
  if (hasWaitingHouseholdForAdult(ownLegs, currentAdultId)) {
    return true
  }
  return false
}

/**
 * Whether the Focus card should use the urgent needs-decision surface for this
 * item (also used by ranking for today/tomorrow tiers). Community ride Accept
 * counts only when `eligibleRideAccept` is provided (or resolved via options).
 */
export function focusItemNeedsDecision(
  item: CalendarItem,
  currentAdultId: string,
  eligibleRideAccept: CarpoolRide | null = null,
  ownRequest?: CarpoolRide | null,
  ownLegs?: CarpoolRideLeg[] | null,
): boolean {
  if (focusItemNeedsFamilyDecision(item, currentAdultId, ownRequest, ownLegs)) {
    return true
  }
  return eligibleRideAccept != null
}

function eligibleRideForItem(
  item: CalendarItem,
  currentAdultId: string,
  rideOptions: FocusRideOptions | undefined,
): CarpoolRide | null {
  if (rideOptions == null) {
    return null
  }
  return eligiblePendingRideAccept(rideOptions.rideEventForItem(item), {
    adultId: currentAdultId,
  })
}

/**
 * Selects the single item (if any) that should render as the Focus card.
 * Horizon: Today decisions → Tomorrow decisions → earliest in-play.
 * Inside Today/Tomorrow: family decisions beat eligible ride Accept, then
 * earliest startsAt. Own PENDING ride is not a decision.
 * `items` must already be sorted by startsAt (agenda list is).
 */
export function selectFocusItem(
  items: CalendarItem[],
  now: Date = new Date(),
  currentAdultId: string = "",
  rideOptions?: FocusRideOptions,
): CalendarItem | null {
  const inPlay = items.filter((item) => !isAgendaItemOutOfPlay(item))
  if (inPlay.length === 0) {
    return null
  }

  const ownRequestFor = (item: CalendarItem) =>
    rideOptions?.rideEventForItem(item)?.ownRequest ?? null
  const ownLegsFor = (item: CalendarItem) =>
    rideOptions?.rideEventForItem(item)?.ownLegs ?? null

  const earliestNeedsDecisionIn = (bucket: "today" | "tomorrow") => {
    const inBucket = inPlay.filter(
      (item) => agendaDayBucketForStartsAt(item.startsAt, now) === bucket,
    )
    const family = inBucket.find((item) =>
      focusItemNeedsFamilyDecision(
        item,
        currentAdultId,
        ownRequestFor(item),
        ownLegsFor(item),
      ),
    )
    if (family) {
      return family
    }
    return (
      inBucket.find(
        (item) => eligibleRideForItem(item, currentAdultId, rideOptions) != null,
      ) ?? null
    )
  }

  const todayDecision = earliestNeedsDecisionIn("today")
  if (todayDecision) {
    return todayDecision
  }

  const tomorrowDecision = earliestNeedsDecisionIn("tomorrow")
  if (tomorrowDecision) {
    return tomorrowDecision
  }

  return inPlay[0]
}
