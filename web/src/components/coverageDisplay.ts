import type {
  CalendarCoverageAssignment,
  CalendarItem,
  CarpoolRide,
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
 * Coverage API `uncoveredKidIds` minus kids already on this circle's ACCEPTED
 * own ride. PENDING (and no ride) leave the gap unchanged — transport is not
 * done until Accept. API uncovered stays orthogonal; chrome uses this list.
 */
export function remainingCoverageGapKidIds(
  uncoveredKidIds: string[],
  ownRequest: CarpoolRide | null | undefined,
): string[] {
  if (ownRequest?.status !== "ACCEPTED") {
    return [...uncoveredKidIds]
  }
  const onRide = new Set(ownRequest.kidIds)
  return uncoveredKidIds.filter((kidId) => !onRide.has(kidId))
}

/**
 * When household Assign covers any kid on an open PENDING team ask, cancel that
 * ask (ADR-0002 — one action, no dialog). Returns the ride id to cancel, or null.
 */
export function pendingOwnAskIdToCancelOnAssign(
  ownRequest: CarpoolRide | null | undefined,
  assignedKidIds: readonly string[],
): string | null {
  if (ownRequest == null || ownRequest.status !== "PENDING") {
    return null
  }
  const assigned = new Set(assignedKidIds)
  if (!ownRequest.kidIds.some((kidId) => assigned.has(kidId))) {
    return null
  }
  return ownRequest.id
}

/**
 * Collapsed-row tags and Focus header pills share this precedence (see
 * docs/agenda-coverage-web-contract.md). Focus passes `includeAllSet: true`.
 * Pass `ownRequest` so Needs coverage uses remaining gap kids (ACCEPTED ride).
 */
export function agendaItemStatusTags(
  item: CalendarItem,
  currentAdultId: string,
  options: {
    outOfPlay?: boolean
    includeAllSet?: boolean
    ownRequest?: CarpoolRide | null
  } = {},
): AgendaItemStatusTag[] {
  const { outOfPlay = false, includeAllSet = false, ownRequest } = options
  if (outOfPlay) {
    return [{ label: "Not going", tone: "muted" }]
  }

  const tags: AgendaItemStatusTag[] = []
  const active = activeCoverages(item)
  const pendingForSelf = pendingCoverageForAdult(item, currentAdultId)
  const gapKids = remainingCoverageGapKidIds(item.uncoveredKidIds, ownRequest)

  if (item.conflicts.length > 0) {
    tags.push({ label: "Overlaps", tone: "amber" })
  }
  if (gapKids.length > 0) {
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

/**
 * Insert the own-ride chip immediately after Overlaps (or first if none).
 * Used by collapsed Agenda rows and Focus pills.
 */
export function insertOwnRideStatusChip(
  tags: AgendaItemStatusTag[],
  rideChip: AgendaItemStatusTag | null | undefined,
): AgendaItemStatusTag[] {
  if (rideChip == null) {
    return tags
  }
  const overlapsIndex = tags.findIndex((tag) => tag.label === "Overlaps")
  if (overlapsIndex >= 0) {
    return [
      ...tags.slice(0, overlapsIndex + 1),
      rideChip,
      ...tags.slice(overlapsIndex + 1),
    ]
  }
  return [rideChip, ...tags]
}

/** Red status dot on collapsed rows; Focus urgent surface uses focusItemNeedsDecision. */
export function agendaItemNeedsAttention(
  item: CalendarItem,
  currentAdultId: string,
  outOfPlay = false,
  ownRequest?: CarpoolRide | null,
): boolean {
  if (outOfPlay) {
    return false
  }
  const gapKids = remainingCoverageGapKidIds(item.uncoveredKidIds, ownRequest)
  return (
    gapKids.length > 0 ||
    item.conflicts.length > 0 ||
    Boolean(pendingCoverageForAdult(item, currentAdultId))
  )
}
