import { useState, type ReactNode } from "react"
import type { FamilyMember } from "@/api/types"
import { memberLabel } from "@/components/coverageDisplay"
import {
  ASK_THE_TEAM,
  DIFFERENT_PLANS_FOR_EACH_LEG,
  HERO_ON_INVERSE,
  POST_TO_TEAM_ROUND_TRIP,
  confirmDriveFromLabel,
} from "@/components/coverageCopy"
import { Button } from "@/components/ui/button"

export type DriverPickerProps = {
  members: FamilyMember[]
  currentAdultId: string
  selectedAdultId: string
  onSelectedAdultChange: (adultId: string) => void
  kidIds: string[]
  loading?: boolean
  onAssignCoverage: (adultId: string, kidIds: string[]) => void
  onAskTeam: () => void
  /** Hero Focus card styling (needsDecision). */
  hero?: boolean
  /** When false, hides the Ask the team chip (e.g. no carpool ride event). */
  showTeamSection?: boolean
  /** Slot between driver chips and Confirm (Leave from). */
  leaveFromSlot?: ReactNode
  /** Origin label for dynamic Confirm — round trip from {origin}. */
  leaveFromLabel?: string
  /** Override confirm button text for household selection only. */
  confirmLabel?: string
}

export function householdDriverChipLabel(
  member: FamilyMember,
  currentAdultId: string,
): string {
  return member.adultId === currentAdultId ? "You" : memberLabel(member)
}

export function confirmDriverLabel(
  selectedAdultId: string,
  members: FamilyMember[],
  currentAdultId: string,
  leaveFromLabel?: string,
): string {
  return confirmDriveFromLabel({
    selectedAdultId,
    members,
    currentAdultId,
    leaveFromLabel: leaveFromLabel ?? "",
  })
}

type DriverMemberChipProps = {
  label: string
  selected: boolean
  disabled?: boolean
  hero?: boolean
  testId?: string
  onClick: () => void
}

function DriverMemberChip({
  label,
  selected,
  disabled = false,
  hero = false,
  testId = "driver-picker-chip",
  onClick,
}: DriverMemberChipProps) {
  if (hero) {
    return (
      <button
        type="button"
        aria-pressed={selected}
        disabled={disabled}
        onClick={onClick}
        data-testid={testId}
        data-selected={selected ? "true" : "false"}
        className="rounded-full border px-3.5 py-1.5 text-sm font-semibold transition-colors focus:outline-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--fc-list-row-focus-border)] focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50"
        style={
          selected
            ? {
                backgroundColor: "var(--fc-hero-on)",
                color: HERO_ON_INVERSE,
                borderColor: "var(--fc-hero-on)",
              }
            : {
                backgroundColor: "transparent",
                color: "var(--fc-hero-on)",
                borderColor: "rgba(255,255,255,0.35)",
              }
        }
      >
        {label}
      </button>
    )
  }

  const selectedClass =
    "border-[var(--fc-text-primary)] bg-[var(--fc-text-primary)] text-[var(--fc-accent-on)]"
  const unselectedClass =
    "border-[var(--fc-border)] bg-[var(--fc-surface-raised)] text-[var(--fc-text-secondary)] hover:border-[color-mix(in_srgb,var(--fc-text-secondary)_35%,var(--fc-border))]"

  return (
    <button
      type="button"
      aria-pressed={selected}
      disabled={disabled}
      onClick={onClick}
      data-testid={testId}
      className={`rounded-full border px-[var(--fc-space-filter-chip-pad-x)] py-[var(--fc-space-filter-chip-pad-y)] text-[length:var(--fc-font-filter-chip-size)] leading-[var(--fc-font-filter-chip-line)] font-[number:var(--fc-font-filter-chip-weight)] transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
        selected ? selectedClass : unselectedClass
      }`}
    >
      {label}
    </button>
  )
}

/**
 * Household driver selection: member chips + trailing Ask the team chip,
 * optional leave-from slot, Confirm / Post primary, and inert Different plans
 * link. Kid-subset checkboxes stay outside this component (see AgendaFocusCard).
 */
export function DriverPicker({
  members,
  currentAdultId,
  selectedAdultId,
  onSelectedAdultChange,
  kidIds,
  loading = false,
  onAssignCoverage,
  onAskTeam,
  hero = false,
  showTeamSection = true,
  leaveFromSlot,
  leaveFromLabel,
  confirmLabel: confirmLabelProp,
}: DriverPickerProps) {
  const [askTeamSelected, setAskTeamSelected] = useState(false)
  const teamChipVisible = showTeamSection
  const teamSelected = teamChipVisible && askTeamSelected

  const primaryLabel = teamSelected
    ? POST_TO_TEAM_ROUND_TRIP
    : (confirmLabelProp ??
      confirmDriverLabel(selectedAdultId, members, currentAdultId, leaveFromLabel))

  const primaryDisabled =
    loading || kidIds.length === 0 || (!teamSelected && !selectedAdultId)

  function handlePrimaryClick() {
    if (teamSelected) {
      onAskTeam()
      return
    }
    onAssignCoverage(selectedAdultId, kidIds)
  }

  const chips = (
    <div
      className={`flex flex-wrap ${hero ? "gap-[var(--fc-space-sm)]" : "gap-[var(--fc-space-xs)]"} min-w-0 max-w-full`}
      role="group"
      aria-label="Household driver"
    >
      {members.map((member) => (
        <DriverMemberChip
          key={member.adultId}
          label={householdDriverChipLabel(member, currentAdultId)}
          selected={!teamSelected && member.adultId === selectedAdultId}
          disabled={loading}
          hero={hero}
          onClick={() => {
            setAskTeamSelected(false)
            onSelectedAdultChange(member.adultId)
          }}
        />
      ))}
      {teamChipVisible ? (
        <DriverMemberChip
          label={ASK_THE_TEAM}
          selected={teamSelected}
          disabled={loading}
          hero={hero}
          testId="driver-picker-ask-team-chip"
          onClick={() => setAskTeamSelected(true)}
        />
      ) : null}
    </div>
  )

  const primaryButton = hero ? (
    <button
      type="button"
      data-testid="driver-picker-confirm"
      className="w-full rounded-lg px-4 py-2.5 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50"
      style={{
        backgroundColor: "var(--fc-hero-on)",
        color: HERO_ON_INVERSE,
      }}
      onClick={handlePrimaryClick}
      disabled={primaryDisabled}
    >
      {primaryLabel}
    </button>
  ) : (
    <Button
      type="button"
      size="sm"
      data-testid="driver-picker-confirm"
      className="w-full text-[length:var(--fc-font-focus-action-size)] leading-[var(--fc-font-focus-action-line)] font-[number:var(--fc-font-focus-action-weight)]"
      onClick={handlePrimaryClick}
      disabled={primaryDisabled}
    >
      {primaryLabel}
    </Button>
  )

  const differentPlansClass = hero
    ? "text-left text-xs underline-offset-2 opacity-90 underline decoration-transparent hover:decoration-current cursor-not-allowed"
    : "text-left text-[length:var(--fc-font-subtitle-size)] leading-[var(--fc-font-subtitle-line)] font-[number:var(--fc-font-subtitle-weight)] text-[var(--fc-text-secondary)] underline-offset-2 underline decoration-transparent hover:decoration-current cursor-not-allowed"

  return (
    <div data-testid="driver-picker" className="w-full min-w-0 max-w-full">
      <div
        data-testid="driver-picker-household-section"
        className="flex min-w-0 max-w-full flex-col gap-[var(--fc-space-md)]"
      >
        <span
          className={
            hero
              ? "text-xs font-semibold uppercase tracking-wide opacity-90"
              : "text-xs font-semibold uppercase tracking-wide text-[var(--fc-text-secondary)]"
          }
          data-testid="driver-picker-driver-label"
        >
          Driver
        </span>
        {chips}
        {leaveFromSlot}
        {primaryButton}
        <button
          type="button"
          data-testid="driver-picker-different-plans"
          className={differentPlansClass}
          style={hero ? { color: "var(--fc-hero-on-secondary)" } : undefined}
          aria-disabled="true"
          tabIndex={-1}
          onClick={(event) => {
            event.preventDefault()
          }}
        >
          {DIFFERENT_PLANS_FOR_EACH_LEG}
        </button>
      </div>
    </div>
  )
}
