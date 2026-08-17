import type { CalendarItem } from "@/api/types"
import { agendaDayBucketForStartsAt } from "@/components/agendaDayGroups"
import { pendingCoverageForAdult } from "@/components/coverageDisplay"
import { isAgendaItemOutOfPlay } from "@/components/rsvpDisplay"

/**
 * Whether the Focus card should use the urgent needs-decision surface for this
 * item (also used by ranking for today/tomorrow tiers).
 */
export function focusItemNeedsDecision(
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
 * Selects the single item (if any) that should render as the Focus card.
 * See docs/agenda-focus-card-addendum.md — exactly one item, priority order:
 *   1. earliest today needing a decision (uncovered, conflict, pending confirm)
 *   2. else earliest tomorrow needing a decision
 *   3. else earliest in-play item (next event to leave for)
 *   4. else none
 * `items` must already be sorted by startsAt (agenda list is).
 */
export function selectFocusItem(
  items: CalendarItem[],
  now: Date = new Date(),
  currentAdultId: string = "",
): CalendarItem | null {
  const inPlay = items.filter((item) => !isAgendaItemOutOfPlay(item))
  if (inPlay.length === 0) {
    return null
  }

  const earliestNeedsDecisionIn = (bucket: "today" | "tomorrow") =>
    inPlay.find(
      (item) =>
        focusItemNeedsDecision(item, currentAdultId) &&
        agendaDayBucketForStartsAt(item.startsAt, now) === bucket,
    )

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
