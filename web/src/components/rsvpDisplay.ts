import type { CalendarItem, CalendarItemSource, RsvpStatus } from "@/api/types"

export function rsvpStatusLabel(status: RsvpStatus): string {
  switch (status) {
    case "YES":
      return "Yes"
    case "NO":
      return "No"
    case "NO_RESPONSE":
      return "No response"
  }
}

export function rsvpStatusForKid(item: CalendarItem, kidId: string): RsvpStatus {
  // Pre-RSVP localStorage cache rows omit `rsvps`; treat missing as empty.
  return (item.rsvps ?? []).find((row) => row.kidId === kidId)?.status ?? "NO_RESPONSE"
}

/**
 * FEED (ADR-0003): missing / NO_RESPONSE counts as going. MANUAL is opt-in:
 * only explicit YES counts as going.
 */
export function isGoingRsvp(
  status: RsvpStatus,
  source: CalendarItemSource = "FEED",
): boolean {
  if (source === "MANUAL") {
    return status === "YES"
  }
  return status !== "NO"
}

/** In-play kids on the item (source-aware going bag). */
export function goingKidIdsForItem(item: CalendarItem): string[] {
  return item.kidIds.filter((kidId) =>
    isGoingRsvp(rsvpStatusForKid(item, kidId), item.source),
  )
}

/** Out of play when no kid is going (source-aware). */
export function isAgendaItemOutOfPlay(item: CalendarItem): boolean {
  if (item.kidIds.length === 0) {
    return false
  }
  return goingKidIdsForItem(item).length === 0
}

export function kidHasActiveCoverage(item: CalendarItem, kidId: string): boolean {
  return (item.coverages ?? []).some(
    (coverage) =>
      (coverage.status === "PENDING" || coverage.status === "CONFIRMED") &&
      coverage.kidIds.includes(kidId),
  )
}

export function rsvpCoverageReleaseMessage(
  kidName: string,
  acceptedPassengerNames: readonly string[] = [],
): string {
  const base = `This will remove coverage for ${kidName}.`
  if (acceptedPassengerNames.length === 0) {
    return base
  }
  const names = acceptedPassengerNames.join(", ")
  return `${base} Accepted carpool passengers (${names}) will no longer have a ride with you.`
}
