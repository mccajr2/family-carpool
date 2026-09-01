import type { RsvpStatus } from "@/api/types"
import type { Attendance } from "@/components/coverageQueue"
import {
  markAsGoingAgainLabel,
  markAsNotGoingLabel,
  markedNotGoingMessage,
} from "@/components/coverageCopy"

export {
  markAsGoingAgainLabel,
  markAsNotGoingLabel,
  markedNotGoingMessage,
} from "@/components/coverageCopy"

/**
 * API write target for the two-state attendance toggle (ADR-0003).
 * UI never writes `NO_RESPONSE`. Read path stays `mapRsvpToAttendance`.
 */
export function rsvpWriteForAttendanceAction(
  nextAttendance: Attendance,
): Extract<RsvpStatus, "YES" | "NO"> {
  return nextAttendance === "not_going" ? "NO" : "YES"
}

export type AttendanceToggleProps = {
  displayName: string
  attendance: Attendance
  onSetAttendance: (next: Attendance) => void
  disabled?: boolean
  /** Stable test id; callers pass rsvp-{source}-{id}-{kidId}. */
  "data-testid"?: string
}

/**
 * Two-state attendance control (ADR-0003). Product copy is always going /
 * not going — never "make it" or ride-side "drive".
 */
export function AttendanceToggle({
  displayName,
  attendance,
  onSetAttendance,
  disabled = false,
  "data-testid": testId,
}: AttendanceToggleProps) {
  if (attendance === "not_going") {
    return (
      <p
        data-testid={testId}
        data-attendance="not_going"
        className="mt-2 text-xs text-[var(--fc-text-secondary)]"
      >
        {markedNotGoingMessage(displayName)}{" "}
        <button
          type="button"
          disabled={disabled}
          onClick={() => onSetAttendance("going")}
          className="font-semibold underline underline-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {markAsGoingAgainLabel()}
        </button>
      </p>
    )
  }

  return (
    <button
      type="button"
      data-testid={testId}
      data-attendance="going"
      disabled={disabled}
      onClick={() => onSetAttendance("not_going")}
      className="mt-2 text-left text-xs underline underline-offset-2 text-[var(--fc-text-secondary)] disabled:cursor-not-allowed disabled:opacity-50"
    >
      {markAsNotGoingLabel(displayName)}
    </button>
  )
}
