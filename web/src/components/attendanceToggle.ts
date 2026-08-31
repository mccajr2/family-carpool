import type { RsvpStatus } from "@/api/types"
import type { Attendance } from "@/components/coverageQueue"

/**
 * API write target for the two-state attendance toggle (ADR-0003).
 * UI never writes `NO_RESPONSE`. Read path stays `mapRsvpToAttendance`.
 */
export function rsvpWriteForAttendanceAction(
  nextAttendance: Attendance,
): Extract<RsvpStatus, "YES" | "NO"> {
  return nextAttendance === "not_going" ? "NO" : "YES"
}

/** Locked mock copy: going → mark not going. */
export function markAsNotGoingLabel(displayName: string): string {
  return `Mark ${displayName} as not going`
}

/** Locked mock copy: not-going status sentence (link is separate). */
export function markedNotGoingMessage(displayName: string): string {
  return `${displayName} is marked not going.`
}

/** Locked mock copy: not going → mark going again. */
export function markAsGoingAgainLabel(): string {
  return "Mark as going again"
}
