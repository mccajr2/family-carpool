import type {
  CalendarCoverageAssignment,
  FamilyCircle,
  LeaveByStatus,
  Place,
} from "@/api/types"
import { isPlaceLocated } from "@/api/types"
import {
  formatLeaveByTime,
  leaveByUnavailableLabel,
} from "@/components/leaveByDisplay"

/** Fields used to resolve a displayed leave-from label. */
export type LeaveFromFields = {
  leaveFromPlaceId: string | null
  leaveFromPlaceName: string | null
  leaveFromAddress: string | null
}

export type LeaveFromLeaveByFields = LeaveFromFields & {
  leaveByAt: string | null
  leaveByStatus: LeaveByStatus | null
  leaveByReason: string | null
}

/** Membership default name, else first located place by name (circle order). */
export function defaultLeaveFromDisplayName(circle: FamilyCircle): string | null {
  const named = circle.defaultLeaveFromPlaceName?.trim()
  if (named) {
    return named
  }
  const located = circle.places
    .filter(isPlaceLocated)
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name))
  return located[0]?.name?.trim() || null
}

/**
 * Label for UI: one-time address, enriched place name, or resolved Default
 * (membership default → first located). Never blank when a located default exists.
 */
export function resolvedLeaveFromLabel(
  fields: LeaveFromFields,
  circle: FamilyCircle,
): string {
  const oneTime = fields.leaveFromAddress?.trim()
  if (oneTime) {
    return oneTime
  }
  const placeName = fields.leaveFromPlaceName?.trim()
  if (placeName) {
    return placeName
  }
  return (
    defaultLeaveFromDisplayName(circle) ??
    (circle.places.length === 0 ? "No places yet" : "No located places yet")
  )
}

/** Calm Focus / hero copy: "Leave from Home · estimate 5:10". */
export function focusLeaveFromEstimateLine(
  fields: LeaveFromLeaveByFields,
  circle: FamilyCircle,
): string {
  const origin = resolvedLeaveFromLabel(fields, circle)
  if (fields.leaveByStatus === "OK" && fields.leaveByAt) {
    return `Leave from ${origin} · estimate ${formatLeaveByTime(fields.leaveByAt)}`
  }
  if (fields.leaveByStatus === "PENDING") {
    return `Leave from ${origin} · estimating…`
  }
  if (fields.leaveByStatus === "UNAVAILABLE") {
    return `Leave from ${origin} · ${leaveByUnavailableLabel(fields.leaveByReason)}`
  }
  return `Leave from ${origin}`
}

/** Coverage leave-by line (null status → skip band). */
export function coverageLeaveByLine(coverage: CalendarCoverageAssignment): string | null {
  if (coverage.leaveByStatus == null) {
    return null
  }
  if (coverage.leaveByStatus === "PENDING") {
    return "Estimating leave-by…"
  }
  if (coverage.leaveByStatus === "OK" && coverage.leaveByAt) {
    return `Leave by ~${formatLeaveByTime(coverage.leaveByAt)} · estimate`
  }
  return leaveByUnavailableLabel(coverage.leaveByReason)
}

export function locatedPlacesSorted(places: Place[]): Place[] {
  return places
    .filter(isPlaceLocated)
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name))
}
