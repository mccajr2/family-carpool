import type { CalendarItem, Kid } from "@/api/types"
import { circleDisplayName } from "@/components/carpoolDisplay"
import { calendarSourceLabel } from "@/components/coverageDisplay"
import { CONFIRM_COVERAGE, kidNeedsRideTitle } from "@/components/coverageCopy"
import type { CarpoolRequest, QueueItem } from "@/components/coverageQueue"
import { formatFocusEventWhen } from "@/components/eventTimes"

export function heroKidFirstName(kidId: string, kids: readonly Kid[]): string {
  const kid = kids.find((entry) => entry.id === kidId)
  const name = kid?.displayName?.trim()
  if (!name) {
    return "Kid"
  }
  return name.split(/\s+/)[0] ?? name
}

/** `{team/feed label} vs {title} · {formatted when}` */
export function heroEventContextLine(
  item: CalendarItem,
  now: Date = new Date(),
): string {
  const label = calendarSourceLabel(item.source, item.feedName)
  const when = formatFocusEventWhen(item.startsAt, item.endsAt, now)
  return `${label} vs ${item.title} · ${when}`
}

export function heroVenueLine(item: CalendarItem): string | null {
  const venue = item.location?.trim()
  return venue || null
}

/** `{circle} need a ride for {kids}` — mock copy uses plural “need”. */
export function heroRequestTitle(request: CarpoolRequest): string {
  const circle = circleDisplayName(request.requestingCircleName)
  const kids = request.kidFirstNames.join(", ")
  return `${circle} need a ride for ${kids}`
}

/** Pickup place + address only (no detour copy). */
export function heroPickupSummary(request: CarpoolRequest): string {
  return `${request.pickupPlaceName}, ${request.pickupAddress}`
}

/** Accessible name for a hero carousel slide shell (title-derived). */
export function heroAttentionSlideAriaLabel(
  item: QueueItem,
  options: { kidFirstName: string; pendingConfirm: boolean },
): string {
  if (item.kind === "request") {
    return heroRequestTitle(item.request)
  }
  if (options.pendingConfirm) {
    return CONFIRM_COVERAGE
  }
  return kidNeedsRideTitle(options.kidFirstName)
}
