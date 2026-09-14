import type {
  CalendarItem,
  CarpoolRide,
  CarpoolRideEvent,
  CarpoolRideLeg,
} from "@/api/types"
import { agendaDayBucketForStartsAt } from "@/components/agendaDayGroups"
import { eligiblePendingRideAccept } from "@/components/carpoolDisplay"
import { pendingCoverageForAdult, remainingCoverageGapKidIds } from "@/components/coverageDisplay"
import { hasWaitingHouseholdForAdult } from "@/components/coverageQueue"
import { isAgendaItemOutOfPlay } from "@/components/rsvpDisplay"
import {
  allOwnPlanLegs,
  resolveOwnRidePlans,
  transportGapKidIdsForRideEvent,
} from "@/components/transportPlan"

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

function hasNeedsRideOnAnyOwnPlan(rideEvent?: CarpoolRideEvent | null): boolean {
  const plans = resolveOwnRidePlans(rideEvent)
  if (plans.length >= 2) {
    return plans.some((plan) => {
      const planLegs = plan.legs
      if (planLegs == null || planLegs.length === 0) {
        return true
      }
      return planLegs.some((leg) => leg.phase === "NEEDS_RIDE")
    })
  }
  return hasNeedsRideOwnLeg(allOwnPlanLegs(rideEvent))
}

/**
 * Family decisions only — remaining coverage gap, conflict, pending Confirm
 * for self, or any transport leg still in `NEEDS_RIDE`. Pass ACCEPTED
 * `ownRequest` so ride kids are not treated as a coverage gap. Prefer
 * `rideEvent` so multi-plan `ownRequests` are read.
 */
export function focusItemNeedsFamilyDecision(
  item: CalendarItem,
  currentAdultId: string,
  ownRequest?: CarpoolRide | null,
  ownLegs?: CarpoolRideLeg[] | null,
  rideEvent?: CarpoolRideEvent | null,
): boolean {
  if (rideEvent != null) {
    if (hasNeedsRideOnAnyOwnPlan(rideEvent)) {
      return true
    }
    const gapKids = transportGapKidIdsForRideEvent(item.uncoveredKidIds, rideEvent)
    if (gapKids.length > 0 || item.conflicts.length > 0) {
      return true
    }
    if (currentAdultId && pendingCoverageForAdult(item, currentAdultId)) {
      return true
    }
    if (hasWaitingHouseholdForAdult(allOwnPlanLegs(rideEvent), currentAdultId)) {
      return true
    }
    return false
  }
  if (hasNeedsRideOwnLeg(ownLegs)) {
    return true
  }
  const gapKids = remainingCoverageGapKidIds([...item.uncoveredKidIds], ownRequest)
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
  rideEvent?: CarpoolRideEvent | null,
): boolean {
  if (
    focusItemNeedsFamilyDecision(
      item,
      currentAdultId,
      ownRequest,
      ownLegs,
      rideEvent,
    )
  ) {
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
    allOwnPlanLegs(rideOptions?.rideEventForItem(item) ?? null)
  const rideEventFor = (item: CalendarItem) =>
    rideOptions?.rideEventForItem(item) ?? null

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
        rideEventFor(item),
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
