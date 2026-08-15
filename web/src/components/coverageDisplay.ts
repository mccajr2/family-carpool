import type {
  CalendarCoverageAssignment,
  CalendarItem,
  FamilyMember,
  Kid,
} from "@/api/types"

/** Mirrors mobile/iosApp CoverageDisplay.swift + sharedUI CoverageDisplay.kt. */

export function calendarItemKey(item: CalendarItem): string {
  return `${item.source}-${item.id}`
}

export function coverageStatusLabel(status: CalendarCoverageAssignment["status"]): string {
  switch (status) {
    case "PENDING":
      return "Pending"
    case "CONFIRMED":
      return "Confirmed"
    case "DECLINED":
      return "Declined"
  }
}

export function memberLabel(member: FamilyMember): string {
  return member.displayName?.trim() ? member.displayName : member.email
}

export function coverageAdultLabel(
  coverage: CalendarCoverageAssignment,
  members: FamilyMember[],
): string {
  if (coverage.coveringAdultDisplayName?.trim()) {
    return coverage.coveringAdultDisplayName.trim()
  }
  const member = members.find((m) => m.adultId === coverage.coveringAdultId)
  return member ? memberLabel(member) : "Adult"
}

export function eventKidNames(kidIds: string[], kids: Kid[]): string {
  const namesById = new Map(kids.map((kid) => [kid.id, kid.displayName]))
  return kidIds
    .map((id) => namesById.get(id))
    .filter((name): name is string => Boolean(name?.trim()))
    .join(", ")
}

export function coverageKidNames(
  coverage: CalendarCoverageAssignment,
  kids: Kid[],
): string {
  return eventKidNames(coverage.kidIds, kids)
}

export function calendarSourceLabel(
  source: "MANUAL" | "FEED",
  feedName: string | null | undefined,
): string {
  if (source === "FEED") {
    return feedName?.trim() ? feedName.trim() : "Feed"
  }
  return "Manual"
}

export function activeCoverages(item: CalendarItem): CalendarCoverageAssignment[] {
  return item.coverages.filter((c) => c.status === "PENDING" || c.status === "CONFIRMED")
}

export function pendingCoverageForAdult(
  item: CalendarItem,
  adultId: string,
): CalendarCoverageAssignment | undefined {
  return activeCoverages(item).find(
    (c) => c.status === "PENDING" && c.coveringAdultId === adultId,
  )
}
