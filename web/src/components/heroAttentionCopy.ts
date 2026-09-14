import type { CalendarItem, Kid } from "@/api/types"
import { circleDisplayName } from "@/components/carpoolDisplay"
import { calendarSourceLabel } from "@/components/coverageDisplay"
import {
  assignedYouToDriveKidsTitle,
  confirmYoullDriveKidsTitle,
  kidsNeedRideTitle,
} from "@/components/coverageCopy"
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

export function heroAdultFirstName(
  adultId: string | null | undefined,
  members: readonly { adultId: string; displayName: string | null }[],
  fallbackDisplayName?: string | null,
): string | null {
  if (fallbackDisplayName?.trim()) {
    return fallbackDisplayName.trim().split(/\s+/)[0] ?? fallbackDisplayName.trim()
  }
  if (adultId == null || adultId === "") {
    return null
  }
  const member = members.find((row) => row.adultId === adultId)
  const name = member?.displayName?.trim()
  if (!name) {
    return null
  }
  return name.split(/\s+/)[0] ?? name
}

/** Own-ride hero title — pending confirm uses assigner copy when known. */
export function heroOwnRideTitle(options: {
  /** @deprecated Prefer kidFirstNames for multi-kid events. */
  kidFirstName?: string
  kidFirstNames?: readonly string[]
  pendingConfirm: boolean
  assignerFirstName?: string | null
}): string {
  const names =
    options.kidFirstNames != null && options.kidFirstNames.length > 0
      ? options.kidFirstNames
      : options.kidFirstName != null
        ? [options.kidFirstName]
        : []
  if (!options.pendingConfirm) {
    return kidsNeedRideTitle(names)
  }
  const assigner = options.assignerFirstName?.trim()
  if (assigner) {
    return assignedYouToDriveKidsTitle(assigner, names)
  }
  return confirmYoullDriveKidsTitle(names)
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
  options: {
    kidFirstName?: string
    kidFirstNames?: readonly string[]
    pendingConfirm: boolean
    assignerFirstName?: string | null
  },
): string {
  if (item.kind === "request") {
    return heroRequestTitle(item.request)
  }
  return heroOwnRideTitle({
    kidFirstName: options.kidFirstName,
    kidFirstNames: options.kidFirstNames,
    pendingConfirm: options.pendingConfirm,
    assignerFirstName: options.assignerFirstName,
  })
}
