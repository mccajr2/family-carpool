import type { ReactNode } from "react"
import type { FamilyMember } from "@/api/types"
import { memberLabel } from "@/components/coverageDisplay"
import {
  ASK_THE_TEAM_FOR_RIDE,
  CONFIRM_ILL_DRIVE,
  HERO_ON_INVERSE,
  NOBODY_IN_HOUSEHOLD_FREE,
  askMemberToDriveLabel,
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
  /** When false, hides the team ask fallback (e.g. no carpool ride event). */
  showTeamSection?: boolean
  /** Slot between driver chips and Confirm (Leave from). */
  leaveFromSlot?: ReactNode
  /** Origin label for dynamic Confirm — {driver} from {origin}. */
  leaveFromLabel?: string
  /** Override confirm button text entirely. */
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
  if (leaveFromLabel != null && leaveFromLabel !== "") {
    return confirmDriveFromLabel({
      selectedAdultId,
      members,
      currentAdultId,
      leaveFromLabel,
    })
  }
  if (selectedAdultId === currentAdultId) {
    return CONFIRM_ILL_DRIVE
  }
  const member = members.find((row) => row.adultId === selectedAdultId)
  const name = member ? memberLabel(member) : "them"
  return askMemberToDriveLabel(name)
}

type DriverMemberChipProps = {
  label: string
  selected: boolean
  disabled?: boolean
  hero?: boolean
  onClick: () => void
}

function DriverMemberChip({
  label,
  selected,
  disabled = false,
  hero = false,
  onClick,
}: DriverMemberChipProps) {
  if (hero) {
    return (
      <button
        type="button"
        aria-pressed={selected}
        disabled={disabled}
        onClick={onClick}
        data-testid="driver-picker-chip"
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
      className={`rounded-full border px-[var(--fc-space-filter-chip-pad-x)] py-[var(--fc-space-filter-chip-pad-y)] text-[length:var(--fc-font-filter-chip-size)] leading-[var(--fc-font-filter-chip-line)] font-[number:var(--fc-font-filter-chip-weight)] transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
        selected ? selectedClass : unselectedClass
      }`}
    >
      {label}
    </button>
  )
}

type DriverPickerHouseholdSectionProps = {
  members: FamilyMember[]
  currentAdultId: string
  selectedAdultId: string
  loading: boolean
  confirmLabel: string
  hero: boolean
  kidIds: string[]
  leaveFromSlot?: ReactNode
  onSelectedAdultChange: (adultId: string) => void
  onAssignCoverage: (adultId: string, kidIds: string[]) => void
}

function DriverPickerHouseholdSection({
  members,
  currentAdultId,
  selectedAdultId,
  loading,
  confirmLabel,
  hero,
  kidIds,
  leaveFromSlot,
  onSelectedAdultChange,
  onAssignCoverage,
}: DriverPickerHouseholdSectionProps) {
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
          selected={member.adultId === selectedAdultId}
          disabled={loading}
          hero={hero}
          onClick={() => onSelectedAdultChange(member.adultId)}
        />
      ))}
    </div>
  )

  const confirmButton = hero ? (
    <button
      type="button"
      data-testid="driver-picker-confirm"
      className="w-full rounded-lg px-4 py-2.5 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50"
      style={{
        backgroundColor: "var(--fc-hero-on)",
        color: HERO_ON_INVERSE,
      }}
      onClick={() => onAssignCoverage(selectedAdultId, kidIds)}
      disabled={loading || !selectedAdultId || kidIds.length === 0}
    >
      {confirmLabel}
    </button>
  ) : (
    <Button
      type="button"
      size="sm"
      data-testid="driver-picker-confirm"
      className="w-full text-[length:var(--fc-font-focus-action-size)] leading-[var(--fc-font-focus-action-line)] font-[number:var(--fc-font-focus-action-weight)]"
      onClick={() => onAssignCoverage(selectedAdultId, kidIds)}
      disabled={loading || !selectedAdultId || kidIds.length === 0}
    >
      {confirmLabel}
    </Button>
  )

  return (
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
      {confirmButton}
    </div>
  )
}

type DriverPickerTeamSectionProps = {
  hero: boolean
  loading: boolean
  onAskTeam: () => void
}

function DriverPickerTeamSection({ hero, loading, onAskTeam }: DriverPickerTeamSectionProps) {
  if (hero) {
    return (
      <div
        data-testid="driver-picker-team-section"
        className="mt-[var(--fc-space-lg)] flex flex-wrap items-center justify-between gap-[var(--fc-space-sm)] border-t pt-[var(--fc-space-md)]"
        style={{ borderColor: "rgba(255,255,255,0.14)" }}
      >
        <p className="text-xs" style={{ color: "var(--fc-hero-on-secondary)" }}>
          {NOBODY_IN_HOUSEHOLD_FREE}
        </p>
        <button
          type="button"
          data-testid="driver-picker-team-ask"
          className="shrink-0 rounded-lg border px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50"
          style={{
            backgroundColor: "transparent",
            color: "var(--fc-hero-on)",
            borderColor: "rgba(255,255,255,0.35)",
          }}
          onClick={onAskTeam}
          disabled={loading}
        >
          {ASK_THE_TEAM_FOR_RIDE}
        </button>
      </div>
    )
  }

  return (
    <div
      data-testid="driver-picker-team-section"
      className="mt-[var(--fc-space-md)] flex flex-wrap items-center justify-between gap-[var(--fc-space-sm)] border-t border-[var(--fc-border)] pt-[var(--fc-space-md)]"
    >
      <p className="text-[length:var(--fc-font-subtitle-size)] leading-[var(--fc-font-subtitle-line)] font-[number:var(--fc-font-subtitle-weight)] text-[var(--fc-text-secondary)]">
        {NOBODY_IN_HOUSEHOLD_FREE}
      </p>
      <Button
        type="button"
        size="sm"
        variant="outline"
        data-testid="driver-picker-team-ask"
        className="shrink-0 text-[length:var(--fc-font-focus-action-ghost-size)] leading-[var(--fc-font-focus-action-ghost-line)] font-[number:var(--fc-font-focus-action-ghost-weight)]"
        onClick={onAskTeam}
        disabled={loading}
      >
        {ASK_THE_TEAM_FOR_RIDE}
      </Button>
    </div>
  )
}

/**
 * Household driver selection: member chips, optional leave-from slot, confirm
 * assign, and team ask fallback. Kid-subset checkboxes stay outside this
 * component (see AgendaFocusCard).
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
  const confirmLabel =
    confirmLabelProp ??
    confirmDriverLabel(selectedAdultId, members, currentAdultId, leaveFromLabel)

  return (
    <div data-testid="driver-picker" className="w-full min-w-0 max-w-full">
      <DriverPickerHouseholdSection
        members={members}
        currentAdultId={currentAdultId}
        selectedAdultId={selectedAdultId}
        loading={loading}
        confirmLabel={confirmLabel}
        hero={hero}
        kidIds={kidIds}
        leaveFromSlot={leaveFromSlot}
        onSelectedAdultChange={onSelectedAdultChange}
        onAssignCoverage={onAssignCoverage}
      />
      {showTeamSection ? (
        <DriverPickerTeamSection hero={hero} loading={loading} onAskTeam={onAskTeam} />
      ) : null}
    </div>
  )
}
