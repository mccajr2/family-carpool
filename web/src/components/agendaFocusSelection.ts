import type { CalendarItem } from "@/api/types"
import { isAgendaItemOutOfPlay } from "@/components/rsvpDisplay"

/**
 * Selects the single item (if any) that should render as the Focus card.
 * See docs/agenda-focus-card-addendum.md — exactly one item, priority order:
 *   1. earliest with uncovered kids or conflicts
 *   2. else earliest upcoming item the adult is actually attending
 *   3. else none
 * `items` must already be sorted by startsAt (agenda list is).
 */
export function selectFocusItem(items: CalendarItem[]): CalendarItem | null {
  const inPlay = items.filter((item) => !isAgendaItemOutOfPlay(item))
  if (inPlay.length === 0) {
    return null
  }
  const needsDecision = inPlay.find(
    (item) => item.uncoveredKidIds.length > 0 || item.conflicts.length > 0,
  )
  if (needsDecision) {
    return needsDecision
  }
  return inPlay[0]
}
