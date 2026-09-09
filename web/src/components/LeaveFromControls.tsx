import { useEffect, useState } from "react"
import type { FamilyCircle, Place, SetCalendarLeaveFromRequest } from "@/api/types"
import { isPlaceLocated } from "@/api/types"
import {
  LEAVE_FROM_ONE_TIME_VALUE,
  type LeaveFromFields,
  leaveFromBodyForPlaceId,
  leaveFromSelectValue,
  resolvedLeaveFromLabel,
} from "@/components/leaveFromDisplay"

export type LeaveFromControlsProps = {
  value: LeaveFromFields
  circle: FamilyCircle
  loading?: boolean
  /** `field-row` = Agenda band; `subtle` = Focus / hero (same combobox, quieter chrome). */
  variant: "field-row" | "subtle"
  ariaLabel: string
  onChange: (body: SetCalendarLeaveFromRequest) => void
  /** Optional calm leave-by line under the combobox (Focus / hero). */
  summaryLine?: string | null
  testIdPrefix?: string
}

/**
 * Leave-from control: located-place combobox with Default preselected
 * (stored as null), plus a permanent "One-time address…" option.
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
  const selectValue = leaveFromSelectValue(value, circle)
  const [oneTimeOpen, setOneTimeOpen] = useState(
    () => selectValue === LEAVE_FROM_ONE_TIME_VALUE,
  )
  const [draftAddress, setDraftAddress] = useState(value.leaveFromAddress?.trim() ?? "")

  useEffect(() => {
    const next = leaveFromSelectValue(value, circle)
    setOneTimeOpen(next === LEAVE_FROM_ONE_TIME_VALUE)
    setDraftAddress(value.leaveFromAddress?.trim() ?? "")
  }, [value.leaveFromPlaceId, value.leaveFromPlaceName, value.leaveFromAddress, circle])

  const oneTimeLabel = value.leaveFromAddress?.trim()
    ? `One-time: ${value.leaveFromAddress.trim()}`
    : "One-time address…"

  const selectClass =
    variant === "subtle"
      ? "h-9 max-w-full rounded-md border border-[color-mix(in_srgb,var(--fc-hero-on)_25%,transparent)] bg-transparent px-2 text-sm"
      : "h-9 max-w-full rounded-md border border-[var(--fc-border)] bg-transparent px-2 text-sm"

  return (
    <div
      className="flex flex-col gap-[var(--fc-space-sm)]"
      data-testid={
        variant === "subtle" ? `${testIdPrefix}-subtle` : `${testIdPrefix}-field-row`
      }
    >
      {variant === "field-row" ? (
        <span className="text-xs text-[var(--fc-text-secondary)]">Leave from</span>
      ) : null}
      {summaryLine != null && summaryLine !== "" ? (
        <span
          className="text-[length:var(--fc-font-subtitle-size)] leading-[var(--fc-font-subtitle-line)]"
          data-testid={`${testIdPrefix}-summary`}
        >
          {summaryLine}
        </span>
      ) : variant === "subtle" ? (
        <span
          className="text-xs opacity-90"
          data-testid={`${testIdPrefix}-label`}
        >
          Leave from {resolvedLeaveFromLabel(value, circle)}
        </span>
      ) : null}
      <select
        aria-label={ariaLabel}
        data-testid={`${testIdPrefix}-place-select`}
        className={selectClass}
        value={oneTimeOpen ? LEAVE_FROM_ONE_TIME_VALUE : selectValue}
        disabled={loading || (circle.places.filter(isPlaceLocated).length === 0 && !oneTimeOpen)}
        onChange={(e) => {
          const next = e.target.value
          if (next === LEAVE_FROM_ONE_TIME_VALUE) {
            setOneTimeOpen(true)
            return
          }
          setOneTimeOpen(false)
          onChange(leaveFromBodyForPlaceId(next, circle))
        }}
      >
        {circle.places.map((place: Place) => (
          <option key={place.id} value={place.id} disabled={!isPlaceLocated(place)}>
            {isPlaceLocated(place) ? place.name : `${place.name} (not located)`}
          </option>
        ))}
        <option value={LEAVE_FROM_ONE_TIME_VALUE}>{oneTimeLabel}</option>
      </select>

      {oneTimeOpen ? (
        <div className="flex flex-wrap items-center gap-[var(--fc-space-sm)]">
          <input
            type="text"
            aria-label={`${ariaLabel} one-time address`}
            data-testid={`${testIdPrefix}-one-time-input`}
            placeholder="Address for estimate only"
            className={
              variant === "subtle"
                ? "h-9 min-w-[12rem] flex-1 rounded-md border border-[color-mix(in_srgb,var(--fc-hero-on)_25%,transparent)] bg-transparent px-2 text-sm"
                : "h-9 min-w-[12rem] flex-1 rounded-md border border-[var(--fc-border)] bg-transparent px-2 text-sm"
            }
            value={draftAddress}
            disabled={loading}
            onChange={(e) => setDraftAddress(e.target.value)}
          />
          <button
            type="button"
            data-testid={`${testIdPrefix}-one-time-apply`}
            className={
              variant === "subtle"
                ? "text-sm font-medium underline-offset-2 hover:underline disabled:opacity-50"
                : "text-sm font-medium text-[var(--fc-accent)] underline-offset-2 hover:underline disabled:opacity-50"
            }
            disabled={loading || !draftAddress.trim()}
            onClick={() => {
              const trimmed = draftAddress.trim()
              if (!trimmed) {
                return
              }
              onChange({ leaveFromPlaceId: null, leaveFromAddress: trimmed })
            }}
          >
            Apply
          </button>
        </div>
      ) : null}

      {variant === "field-row" ? (
        <p className="text-xs text-[var(--fc-text-secondary)]">
          Leave-by is an estimate — not live traffic.
        </p>
      ) : null}
    </div>
  )
}
