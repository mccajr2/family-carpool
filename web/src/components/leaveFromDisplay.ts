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

/** Combobox sentinel for the one-time address option. */
export const LEAVE_FROM_ONE_TIME_VALUE = "__one_time__"

/**
 * Place id that represents membership Default in the combobox (membership
 * default when located, else first located by name).
 */
export function resolvedDefaultLeaveFromPlaceId(circle: FamilyCircle): string | null {
  const membershipId = circle.defaultLeaveFromPlaceId
  if (membershipId != null) {
    const match = circle.places.find(
      (place) => place.id === membershipId && isPlaceLocated(place),
    )
    if (match != null) {
      return match.id
    }
  }
  return locatedPlacesSorted(circle.places)[0]?.id ?? null
}

/**
 * Combobox value for current leave-from fields: place id, or
 * {@link LEAVE_FROM_ONE_TIME_VALUE} when a one-time address is set.
 * Default mode (both null) maps to the resolved default place id.
 */
export function leaveFromSelectValue(
  fields: LeaveFromFields,
  circle: FamilyCircle,
): string {
  if (fields.leaveFromAddress?.trim()) {
    return LEAVE_FROM_ONE_TIME_VALUE
  }
  if (fields.leaveFromPlaceId) {
    return fields.leaveFromPlaceId
  }
  return resolvedDefaultLeaveFromPlaceId(circle) ?? ""
}

/**
 * Persist body for a combobox place selection. Selecting the resolved default
 * place stores Default (both null) so midseason membership-default changes
 * still apply.
 */
export function leaveFromBodyForPlaceId(
  placeId: string,
  circle: FamilyCircle,
): { leaveFromPlaceId: string | null; leaveFromAddress: null } {
  const defaultId = resolvedDefaultLeaveFromPlaceId(circle)
  if (defaultId != null && placeId === defaultId) {
    return { leaveFromPlaceId: null, leaveFromAddress: null }
  }
  return { leaveFromPlaceId: placeId, leaveFromAddress: null }
}

/** True when the request is Default mode (no place / one-time override). */
export function isDefaultLeaveFromBody(body: {
  leaveFromPlaceId?: string | null
  leaveFromAddress?: string | null
}): boolean {
  const address = body.leaveFromAddress?.trim()
  return !body.leaveFromPlaceId && !address
}
