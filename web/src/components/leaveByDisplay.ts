import type { LeaveByStatus } from "@/api/types"

/** Agenda leave-by copy helpers (estimate only — never live traffic / ETA). */

export const LEAVE_BY_PENDING_LABEL = "Estimating leave-by…"

export function formatLeaveByTime(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) {
    return iso
  }
  return date.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  })
}

/** e.g. "Leave by ~3:40 PM · estimate" */
export function formatLeaveByEstimateLine(leaveByAtIso: string): string {
  return `Leave by ~${formatLeaveByTime(leaveByAtIso)} · estimate`
}

/** Short human reason when leaveByStatus is UNAVAILABLE. */
export function leaveByUnavailableLabel(reason: string | null | undefined): string {
  switch (reason) {
    case "NO_ORIGIN":
      return "No leave-from place yet"
    case "NO_DESTINATION":
      return "Add a location to estimate leave-by"
    case "GEOCODE_FAILED":
      return "Couldn't locate the destination"
    default:
      return "Leave-by estimate unavailable"
  }
}

export function agendaLeaveByLine(item: {
  leaveByStatus: LeaveByStatus
  leaveByAt: string | null
  leaveByReason: string | null
}): string {
  if (item.leaveByStatus === "PENDING") {
    return LEAVE_BY_PENDING_LABEL
  }
  if (item.leaveByStatus === "OK" && item.leaveByAt) {
    return formatLeaveByEstimateLine(item.leaveByAt)
  }
  return leaveByUnavailableLabel(item.leaveByReason)
}
