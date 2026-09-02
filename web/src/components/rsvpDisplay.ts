import type { CalendarItem, RsvpStatus } from "@/api/types"

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

/** Out of play when every kid on the item is RSVP No (includes one-kid No). */
export function isAgendaItemOutOfPlay(item: CalendarItem): boolean {
  if (item.kidIds.length === 0) {
    return false
  }
  return item.kidIds.every((kidId) => rsvpStatusForKid(item, kidId) === "NO")
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
