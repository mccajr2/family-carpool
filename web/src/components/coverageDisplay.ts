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

export type AgendaItemStatusTag = {
  label: string
  tone: "mint" | "amber" | "muted"
}

/**
 * Collapsed-row tags and Focus header pills share this precedence (see
 * docs/agenda-coverage-web-contract.md). Focus passes `includeAllSet: true`.
 */
export function agendaItemStatusTags(
  item: CalendarItem,
  currentAdultId: string,
  options: { outOfPlay?: boolean; includeAllSet?: boolean } = {},
): AgendaItemStatusTag[] {
  const { outOfPlay = false, includeAllSet = false } = options
  if (outOfPlay) {
    return [{ label: "Not going", tone: "muted" }]
  }

  const tags: AgendaItemStatusTag[] = []
  const active = activeCoverages(item)
  const pendingForSelf = pendingCoverageForAdult(item, currentAdultId)

  if (item.conflicts.length > 0) {
    tags.push({ label: "Overlaps", tone: "amber" })
  }
  if (item.uncoveredKidIds.length > 0) {
    tags.push({ label: "Needs coverage", tone: "amber" })
  } else if (pendingForSelf) {
    tags.push({ label: "Confirm coverage", tone: "amber" })
  } else if (active.some((c) => c.status === "PENDING")) {
    tags.push({ label: "Awaiting confirm", tone: "amber" })
  } else if (active.some((c) => c.status === "CONFIRMED")) {
    tags.push({ label: "Confirmed", tone: "mint" })
  } else if (includeAllSet) {
    tags.push({ label: "All set", tone: "mint" })
  }
  return tags
}

/** Red status dot on collapsed rows; Focus urgent surface uses focusItemNeedsDecision. */
export function agendaItemNeedsAttention(
  item: CalendarItem,
  currentAdultId: string,
  outOfPlay = false,
): boolean {
  if (outOfPlay) {
    return false
  }
  return (
    item.uncoveredKidIds.length > 0 ||
    item.conflicts.length > 0 ||
    Boolean(pendingCoverageForAdult(item, currentAdultId))
  )
}
