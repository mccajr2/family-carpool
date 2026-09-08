import { useState } from "react"
import type { FamilyCircle, Place, SetCalendarLeaveFromRequest } from "@/api/types"
import { isPlaceLocated } from "@/api/types"
import {
  type LeaveFromFields,
  locatedPlacesSorted,
  resolvedLeaveFromLabel,
} from "@/components/leaveFromDisplay"

export type LeaveFromControlsProps = {
  value: LeaveFromFields
  circle: FamilyCircle
  loading?: boolean
  /** `field-row` = Agenda band; `subtle` = Focus / hero disclosure. */
  variant: "field-row" | "subtle"
  ariaLabel: string
  onChange: (body: SetCalendarLeaveFromRequest) => void
  /** Optional calm summary above the subtle control (Focus estimate line). */
  summaryLine?: string | null
  testIdPrefix?: string
}

type Mode = "default" | "place" | "one-time"

function modeFromValue(value: LeaveFromFields): Mode {
  if (value.leaveFromAddress?.trim()) {
    return "one-time"
  }
  if (value.leaveFromPlaceId) {
    return "place"
  }
  return "default"
}

function LeaveFromEditor({
  value,
  circle,
  loading,
  ariaLabel,
  onChange,
  testIdPrefix,
  compact,
}: {
  value: LeaveFromFields
  circle: FamilyCircle
  loading: boolean
  ariaLabel: string
  onChange: (body: SetCalendarLeaveFromRequest) => void
  testIdPrefix: string
  compact: boolean
}) {
  const located = locatedPlacesSorted(circle.places)
  const [mode, setMode] = useState<Mode>(() => modeFromValue(value))
  const [draftAddress, setDraftAddress] = useState(value.leaveFromAddress?.trim() ?? "")
  const resolvedDefault = resolvedLeaveFromLabel(
    { leaveFromPlaceId: null, leaveFromPlaceName: null, leaveFromAddress: null },
    circle,
  )

  function applyDefault() {
    setMode("default")
    onChange({ leaveFromPlaceId: null, leaveFromAddress: null })
  }

  function applyPlace(placeId: string) {
    setMode("place")
    onChange({ leaveFromPlaceId: placeId, leaveFromAddress: null })
  }

  function applyOneTime() {
    const trimmed = draftAddress.trim()
    if (!trimmed) {
      return
    }
    setMode("one-time")
    onChange({ leaveFromPlaceId: null, leaveFromAddress: trimmed })
  }

  const linkClass = compact
    ? "underline-offset-2 hover:underline disabled:opacity-50"
    : "underline-offset-2 hover:underline disabled:opacity-50 text-[var(--fc-text-secondary)]"

  return (
    <div
      className="flex flex-col gap-[var(--fc-space-sm)]"
      data-testid={`${testIdPrefix}-editor`}
    >
      <div className="flex flex-wrap gap-[var(--fc-space-sm)] text-xs">
        <button
          type="button"
          data-testid={`${testIdPrefix}-mode-default`}
          className={linkClass}
          style={{ fontWeight: mode === "default" ? 600 : 400 }}
          disabled={loading}
          onClick={applyDefault}
        >
          Default ({resolvedDefault})
        </button>
        {located.length > 0 ? (
          <button
            type="button"
            data-testid={`${testIdPrefix}-mode-place`}
            className={linkClass}
            style={{ fontWeight: mode === "place" ? 600 : 400 }}
            disabled={loading}
            onClick={() => {
              setMode("place")
              if (located.length === 1) {
                applyPlace(located[0]!.id)
              }
            }}
          >
            Named place
          </button>
        ) : null}
        <button
          type="button"
          data-testid={`${testIdPrefix}-mode-one-time`}
          className={linkClass}
          style={{ fontWeight: mode === "one-time" ? 600 : 400 }}
          disabled={loading}
          onClick={() => setMode("one-time")}
        >
          One-time address
        </button>
      </div>

      {mode === "place" && located.length > 1 ? (
        <select
          aria-label={ariaLabel}
          data-testid={`${testIdPrefix}-place-select`}
          className="h-9 rounded-md border border-[var(--fc-border)] bg-transparent px-2 text-sm"
          value={value.leaveFromPlaceId ?? ""}
          disabled={loading}
          onChange={(e) => {
            if (e.target.value) {
              applyPlace(e.target.value)
            }
          }}
        >
          {!value.leaveFromPlaceId ? <option value="">Choose a located place</option> : null}
          {circle.places.map((place: Place) => (
            <option key={place.id} value={place.id} disabled={!isPlaceLocated(place)}>
              {isPlaceLocated(place) ? place.name : `${place.name} (not located)`}
            </option>
          ))}
        </select>
      ) : null}

      {mode === "place" && located.length === 1 ? (
        <span
          className="text-sm font-medium text-[var(--fc-text-primary)]"
          data-testid={`${testIdPrefix}-label`}
        >
          {located[0]!.name}
        </span>
      ) : null}

      {mode === "default" ? (
        <span
          className="text-sm font-medium text-[var(--fc-text-primary)]"
          data-testid={`${testIdPrefix}-label`}
        >
          {resolvedLeaveFromLabel(value, circle)}
        </span>
      ) : null}

      {mode === "one-time" ? (
        <div className="flex flex-wrap items-center gap-[var(--fc-space-sm)]">
          <input
            type="text"
            aria-label={`${ariaLabel} one-time address`}
            data-testid={`${testIdPrefix}-one-time-input`}
            placeholder="Address for estimate only"
            className="h-9 min-w-[12rem] flex-1 rounded-md border border-[var(--fc-border)] bg-transparent px-2 text-sm"
            value={draftAddress}
            disabled={loading}
            onChange={(e) => setDraftAddress(e.target.value)}
          />
          <button
            type="button"
            data-testid={`${testIdPrefix}-one-time-apply`}
            className="text-sm font-medium text-[var(--fc-accent)] underline-offset-2 hover:underline disabled:opacity-50"
            disabled={loading || !draftAddress.trim()}
            onClick={applyOneTime}
          >
            Apply
          </button>
        </div>
      ) : null}

      <p className="text-xs text-[var(--fc-text-secondary)]">
        Leave-by is an estimate — not live traffic.
      </p>
    </div>
  )
}

/**
 * Leave-from control: Agenda field-row or Focus/hero subtle disclosure.
 * Modes: Default / named place / one-time address (XOR).
 */
export function LeaveFromControls({
  value,
  circle,
  loading = false,
  variant,
  ariaLabel,
  onChange,
  summaryLine = null,
  testIdPrefix = "leave-from",
}: LeaveFromControlsProps) {
  const [open, setOpen] = useState(false)
  const label = resolvedLeaveFromLabel(value, circle)

  if (variant === "subtle") {
    return (
      <div
        className="flex flex-col gap-[var(--fc-space-xs)]"
        data-testid={`${testIdPrefix}-subtle`}
      >
        <span
          className="text-[length:var(--fc-font-subtitle-size)] leading-[var(--fc-font-subtitle-line)]"
          data-testid={`${testIdPrefix}-summary`}
        >
          {summaryLine ?? `Leave from ${label}`}
        </span>
        <button
          type="button"
          data-testid={`${testIdPrefix}-change`}
          className="w-fit text-xs underline-offset-2 opacity-80 hover:underline disabled:opacity-50"
          disabled={loading}
          onClick={() => setOpen((prev) => !prev)}
        >
          {open ? "Done" : "Change leave-from"}
        </button>
        {open ? (
          <LeaveFromEditor
            value={value}
            circle={circle}
            loading={loading}
            ariaLabel={ariaLabel}
            onChange={onChange}
            testIdPrefix={testIdPrefix}
            compact
          />
        ) : null}
      </div>
    )
  }

  return (
    <div
      className="flex flex-col gap-[var(--fc-space-sm)]"
      data-testid={`${testIdPrefix}-field-row`}
    >
      <span className="text-xs text-[var(--fc-text-secondary)]">Leave from</span>
      <LeaveFromEditor
        value={value}
        circle={circle}
        loading={loading}
        ariaLabel={ariaLabel}
        onChange={onChange}
        testIdPrefix={testIdPrefix}
        compact={false}
      />
    </div>
  )
}
