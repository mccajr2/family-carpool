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
  /**
   * Fires whenever the visible leave-from label for Confirm CTAs changes
   * (including live one-time draft text and the empty-field placeholder).
   */
  onConfirmOriginLabelChange?: (label: string) => void
  /** Optional leave-by helper under the control (Agenda — single instance). */
  helperLine?: string | null
  testIdPrefix?: string
}

const ONE_TIME_EMPTY_ORIGIN = "the address you enter"

/**
 * Leave-from control: located-place combobox with Default preselected
 * (stored as null), plus a permanent "One-time address…" option that reveals
 * an inline text input (no separate Apply — parent drafts / persists via onChange).
 */
export function LeaveFromControls({
  value,
  circle,
  loading = false,
  variant,
  ariaLabel,
  onChange,
  onConfirmOriginLabelChange,
  helperLine = null,
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

  useEffect(() => {
    if (onConfirmOriginLabelChange == null) {
      return
    }
    if (oneTimeOpen) {
      const trimmed = draftAddress.trim()
      onConfirmOriginLabelChange(trimmed || ONE_TIME_EMPTY_ORIGIN)
      return
    }
    onConfirmOriginLabelChange(resolvedLeaveFromLabel(value, circle))
  }, [
    oneTimeOpen,
    draftAddress,
    value.leaveFromPlaceId,
    value.leaveFromPlaceName,
    value.leaveFromAddress,
    circle,
    onConfirmOriginLabelChange,
  ])

  const oneTimeLabel = value.leaveFromAddress?.trim()
    ? `One-time: ${value.leaveFromAddress.trim()}`
    : "One-time address…"

  const selectClass =
    variant === "subtle"
      ? "h-9 max-w-full rounded-md border border-[color-mix(in_srgb,var(--fc-hero-on)_25%,transparent)] bg-transparent px-2 text-sm"
      : "h-9 max-w-full rounded-md border border-[var(--fc-border)] bg-transparent px-2 text-sm"

  const labelClass =
    variant === "subtle"
      ? "text-xs opacity-90"
      : "text-xs text-[var(--fc-text-secondary)]"

  return (
    <div
      className="flex flex-col gap-[var(--fc-space-sm)]"
      data-testid={
        variant === "subtle" ? `${testIdPrefix}-subtle` : `${testIdPrefix}-field-row`
      }
    >
      <span className={labelClass} data-testid={`${testIdPrefix}-label`}>
        Leave from
      </span>
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
            setDraftAddress(value.leaveFromAddress?.trim() ?? "")
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
        <input
          type="text"
          aria-label={`${ariaLabel} one-time address`}
          data-testid={`${testIdPrefix}-one-time-input`}
          placeholder="Address for estimate only"
          className={
            variant === "subtle"
              ? "h-9 min-w-[12rem] w-full rounded-md border border-[color-mix(in_srgb,var(--fc-hero-on)_25%,transparent)] bg-transparent px-2 text-sm"
              : "h-9 min-w-[12rem] w-full rounded-md border border-[var(--fc-border)] bg-transparent px-2 text-sm"
          }
          value={draftAddress}
          disabled={loading}
          onChange={(e) => {
            setDraftAddress(e.target.value)
          }}
          onBlur={() => {
            const trimmed = draftAddress.trim()
            if (trimmed) {
              onChange({ leaveFromPlaceId: null, leaveFromAddress: trimmed })
            }
          }}
        />
      ) : null}

      {helperLine != null && helperLine !== "" ? (
        <p
          className="text-xs text-[var(--fc-text-secondary)]"
          data-testid={`${testIdPrefix}-helper`}
        >
          {helperLine}
        </p>
      ) : null}
    </div>
  )
}
