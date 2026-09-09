import type {
  CalendarCoverageAssignment,
  CalendarItem,
  CarpoolRequest,
  FamilyMember,
  Kid,
} from "@/api/types"
import {
  ALL_SET,
  ATTENDANCE_NOT_GOING_CHIP,
  AWAITING_CONFIRM,
  CONFIRM_COVERAGE,
  COVERAGE_CONFIRMED,
  NEEDS_COVERAGE,
  OVERLAPS_CHIP,
} from "@/components/coverageCopy"
import { isRideCommitmentConflictChipLabel } from "@/components/rideCommitmentConflict"

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

/** Active (PENDING/CONFIRMED) coverage row for this adult, if any. */
export function activeCoverageForAdult(
  item: CalendarItem,
  adultId: string,
): CalendarCoverageAssignment | undefined {
  return activeCoverages(item).find((c) => c.coveringAdultId === adultId)
}

export type AgendaItemStatusTag = {
  label: string
  tone: "mint" | "amber" | "muted"
}

/**
 * Coverage API `uncoveredKidIds` minus kids whose own need is `FULLY_COVERED`.
 * `PARTIAL` / `UNCOVERED` / no request leave the gap unchanged — transport is
 * not done until every needed leg is confirmed. API uncovered stays orthogonal;
 * chrome uses this list.
 */
export function remainingCoverageGapKidIds(
  uncoveredKidIds: string[],
  ownRequests: readonly CarpoolRequest[] | null | undefined,
): string[] {
  if (ownRequests == null || ownRequests.length === 0) {
    return [...uncoveredKidIds]
  }
  const fullyCovered = new Set(
    ownRequests
      .filter((request) => request.status === "FULLY_COVERED")
      .map((request) => request.kidId),
  )
  return uncoveredKidIds.filter((kidId) => !fullyCovered.has(kidId))
}

/**
 * When household Assign covers kids with open own needs, cancel those asks
 * (ADR-0002 — one action, no dialog). Returns request ids to cancel.
 */
export function pendingOwnAskIdsToCancelOnAssign(
  ownRequests: readonly CarpoolRequest[] | null | undefined,
  assignedKidIds: readonly string[],
): string[] {
  if (ownRequests == null || ownRequests.length === 0) {
    return []
  }
  const assigned = new Set(assignedKidIds)
  return ownRequests
    .filter(
      (request) =>
        (request.status === "UNCOVERED" || request.status === "PARTIAL") &&
        assigned.has(request.kidId),
    )
    .map((request) => request.id)
}

/** First open own-ask id to cancel on Assign, or null. */
export function pendingOwnAskIdToCancelOnAssign(
  ownRequests: readonly CarpoolRequest[] | null | undefined,
  assignedKidIds: readonly string[],
): string | null {
  return pendingOwnAskIdsToCancelOnAssign(ownRequests, assignedKidIds)[0] ?? null
}

/**
 * Collapsed-row tags and Focus header pills share this precedence (see
 * docs/agenda-coverage-web-contract.md). Focus passes `includeAllSet: true`.
 * Pass `ownRequests` so Needs coverage uses remaining gap kids (FULLY_COVERED).
 */
export function agendaItemStatusTags(
  item: CalendarItem,
  currentAdultId: string,
  options: {
    outOfPlay?: boolean
    includeAllSet?: boolean
    ownRequests?: readonly CarpoolRequest[] | null
  } = {},
): AgendaItemStatusTag[] {
  const { outOfPlay = false, includeAllSet = false, ownRequests } = options
  if (outOfPlay) {
    return [{ label: ATTENDANCE_NOT_GOING_CHIP, tone: "muted" }]
  }

  const tags: AgendaItemStatusTag[] = []
  const active = activeCoverages(item)
  const pendingForSelf = pendingCoverageForAdult(item, currentAdultId)
  const gapKids = remainingCoverageGapKidIds(item.uncoveredKidIds, ownRequests)

  if (item.conflicts.length > 0) {
    tags.push({ label: OVERLAPS_CHIP, tone: "amber" })
  }
  if (gapKids.length > 0) {
    tags.push({ label: NEEDS_COVERAGE, tone: "amber" })
  } else if (pendingForSelf) {
    tags.push({ label: CONFIRM_COVERAGE, tone: "amber" })
  } else if (active.some((c) => c.status === "PENDING")) {
    tags.push({ label: AWAITING_CONFIRM, tone: "amber" })
  } else if (active.some((c) => c.status === "CONFIRMED")) {
    tags.push({ label: COVERAGE_CONFIRMED, tone: "mint" })
  } else if (includeAllSet) {
    tags.push({ label: ALL_SET, tone: "mint" })
  }
  return tags
}

/**
 * Index for the own-ride chip: after Overlaps (if any) and after the
 * ride-commitment conflict chip (if any).
 */
function ownRideChipInsertIndex(tags: AgendaItemStatusTag[]): number {
  let index = 0
  if (tags[index]?.label === OVERLAPS_CHIP) {
    index += 1
  }
  if (
    tags[index] != null &&
    isRideCommitmentConflictChipLabel(tags[index]!.label)
  ) {
    index += 1
  }
  return index
}

/**
 * Insert the own-ride chip after Overlaps → conflict (or first if neither).
 * Used by collapsed Agenda rows and Focus pills.
 */
export function insertOwnRideStatusChip(
  tags: AgendaItemStatusTag[],
  rideChip: AgendaItemStatusTag | null | undefined,
): AgendaItemStatusTag[] {
  if (rideChip == null) {
    return tags
  }
  const insertAt = ownRideChipInsertIndex(tags)
  return [...tags.slice(0, insertAt), rideChip, ...tags.slice(insertAt)]
}

/** Red status dot on collapsed rows; Focus urgent surface uses focusItemNeedsDecision. */
export function agendaItemNeedsAttention(
  item: CalendarItem,
  currentAdultId: string,
  outOfPlay = false,
  ownRequests?: readonly CarpoolRequest[] | null,
  hasRideCommitmentConflict = false,
): boolean {
  if (outOfPlay) {
    return false
  }
  const gapKids = remainingCoverageGapKidIds(item.uncoveredKidIds, ownRequests)
  return (
    gapKids.length > 0 ||
    item.conflicts.length > 0 ||
    Boolean(pendingCoverageForAdult(item, currentAdultId)) ||
    hasRideCommitmentConflict
  )
}
