import type { FamilyMember } from "@/api/types"
import { memberLabel } from "@/components/coverageDisplay"
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
): string {
  if (selectedAdultId === currentAdultId) {
    return "Confirm I'll drive"
  }
  const member = members.find((row) => row.adultId === selectedAdultId)
  const name = member ? memberLabel(member) : "them"
  return `Ask ${name} to drive`
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
  const selectedClass = hero
    ? "border-[var(--fc-hero-on)] bg-[var(--fc-hero-on)] text-[var(--fc-hero-surface)]"
    : "border-[var(--fc-text-primary)] bg-[var(--fc-text-primary)] text-[var(--fc-accent-on)]"
  const unselectedClass = hero
    ? "border-[color-mix(in_srgb,var(--fc-hero-on)_20%,transparent)] bg-[color-mix(in_srgb,var(--fc-hero-on)_8%,transparent)] text-[var(--fc-hero-on-secondary)] hover:border-[color-mix(in_srgb,var(--fc-hero-on)_35%,transparent)]"
    : "border-[var(--fc-border)] bg-[var(--fc-surface-raised)] text-[var(--fc-text-secondary)] hover:border-[color-mix(in_srgb,var(--fc-text-secondary)_35%,var(--fc-border))]"

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

/**
 * Household driver selection: member chips, confirm assign, and team ask fallback.
 * Kid-subset checkboxes stay outside this component (see AgendaFocusCard).
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
}: DriverPickerProps) {
  const confirmLabel = confirmDriverLabel(selectedAdultId, members, currentAdultId)
  const onSecondaryVar = hero ? "var(--fc-hero-on-secondary)" : "var(--fc-text-secondary)"
  const dividerVar = hero ? "rgba(255,255,255,0.12)" : "var(--fc-border)"
  const surfaceVar = hero ? "var(--fc-hero-surface)" : undefined
  const onVar = hero ? "var(--fc-hero-on)" : undefined

  return (
    <div
      data-testid="driver-picker"
      className="flex w-full flex-col gap-[var(--fc-space-md)]"
    >
      <div
        className="flex flex-wrap gap-[var(--fc-space-xs)]"
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
      <Button
        type="button"
        size="sm"
        className="w-fit text-[length:var(--fc-font-focus-action-size)] leading-[var(--fc-font-focus-action-line)] font-[number:var(--fc-font-focus-action-weight)]"
        style={hero ? { backgroundColor: onVar, color: surfaceVar } : undefined}
        onClick={() => onAssignCoverage(selectedAdultId, kidIds)}
        disabled={loading || !selectedAdultId || kidIds.length === 0}
      >
        {confirmLabel}
      </Button>
      {showTeamSection ? (
        <div
          data-testid="driver-picker-team-section"
          className="flex flex-col gap-[var(--fc-space-sm)] border-t pt-[var(--fc-space-md)]"
          style={{ borderColor: dividerVar }}
        >
          <p
            className="text-[length:var(--fc-font-subtitle-size)] leading-[var(--fc-font-subtitle-line)] font-[number:var(--fc-font-subtitle-weight)]"
            style={{ color: onSecondaryVar }}
          >
            Nobody in the household free?
          </p>
          <Button
            type="button"
            size="sm"
            variant={hero ? "secondary" : "outline"}
            className="w-fit text-[length:var(--fc-font-focus-action-ghost-size)] leading-[var(--fc-font-focus-action-ghost-line)] font-[number:var(--fc-font-focus-action-ghost-weight)]"
            onClick={onAskTeam}
            disabled={loading}
          >
            Ask the team for a ride
          </Button>
        </div>
      ) : null}
    </div>
  )
}
