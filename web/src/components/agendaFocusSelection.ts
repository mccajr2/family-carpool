import type { CalendarItem, CarpoolRide, CarpoolRideEvent, Garage } from "@/api/types"
import { agendaDayBucketForStartsAt } from "@/components/agendaDayGroups"
import { eligiblePendingRideAccept } from "@/components/carpoolDisplay"
import { pendingCoverageForAdult } from "@/components/coverageDisplay"
import { isAgendaItemOutOfPlay } from "@/components/rsvpDisplay"

export type FocusRideOptions = {
  rideEventForItem: (item: CalendarItem) => CarpoolRideEvent | null | undefined
  garage: Garage | null
}

/** Family decisions only — uncovered, conflict, or pending Confirm for self. */
export function focusItemNeedsFamilyDecision(
  item: CalendarItem,
  currentAdultId: string,
): boolean {
  if (item.uncoveredKidIds.length > 0 || item.conflicts.length > 0) {
    return true
  }
  if (currentAdultId && pendingCoverageForAdult(item, currentAdultId)) {
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
): boolean {
  if (focusItemNeedsFamilyDecision(item, currentAdultId)) {
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
    garage: rideOptions.garage,
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

  const earliestNeedsDecisionIn = (bucket: "today" | "tomorrow") => {
    const inBucket = inPlay.filter(
      (item) => agendaDayBucketForStartsAt(item.startsAt, now) === bucket,
    )
    const family = inBucket.find((item) =>
      focusItemNeedsFamilyDecision(item, currentAdultId),
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
