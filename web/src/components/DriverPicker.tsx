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
  if (hero) {
    return (
      <button
        type="button"
        aria-pressed={selected}
        disabled={disabled}
        onClick={onClick}
        data-testid="driver-picker-chip"
        data-selected={selected ? "true" : "false"}
        className="rounded-full border-0 px-3.5 py-1.5 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50"
        style={
          selected
            ? {
                background: "var(--fc-hero-on)",
                color: "var(--fc-text-primary)",
              }
            : {
                background: "rgba(255,255,255,0.1)",
                color: "var(--fc-hero-on)",
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

  if (hero) {
    return (
      <div data-testid="driver-picker" className="w-full">
        <div className="mb-3 flex flex-col gap-3">
          <div
            className="flex flex-wrap gap-2"
            role="group"
            aria-label="Household driver"
          >
            {members.map((member) => (
              <DriverMemberChip
                key={member.adultId}
                label={householdDriverChipLabel(member, currentAdultId)}
                selected={member.adultId === selectedAdultId}
                disabled={loading}
                hero
                onClick={() => onSelectedAdultChange(member.adultId)}
              />
            ))}
          </div>
          <button
            type="button"
            data-testid="driver-picker-confirm"
            className="w-fit rounded-lg px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50"
            style={{
              background: "var(--fc-hero-on)",
              color: "var(--fc-text-primary)",
            }}
            onClick={() => onAssignCoverage(selectedAdultId, kidIds)}
            disabled={loading || !selectedAdultId || kidIds.length === 0}
          >
            {confirmLabel}
          </button>
        </div>
        {showTeamSection ? (
          <div
            data-testid="driver-picker-team-section"
            className="mt-5 border-t pt-4"
            style={{ borderColor: "rgba(255,255,255,0.14)" }}
          >
            <p
              className="mb-2 text-xs"
              style={{ color: "var(--fc-hero-on-secondary)" }}
            >
              Nobody in the household free?
            </p>
            <button
              type="button"
              data-testid="driver-picker-team-ask"
              className="rounded-lg px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50"
              style={{
                background: "var(--fc-hero-decline-bg)",
                color: "var(--fc-hero-on)",
              }}
              onClick={onAskTeam}
              disabled={loading}
            >
              Ask the team for a ride
            </button>
          </div>
        ) : null}
      </div>
    )
  }

  const onSecondaryVar = "var(--fc-text-secondary)"
  const dividerVar = "var(--fc-border)"
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
            hero={false}
            onClick={() => onSelectedAdultChange(member.adultId)}
          />
        ))}
      </div>
      <Button
        type="button"
        size="sm"
        className="w-fit text-[length:var(--fc-font-focus-action-size)] leading-[var(--fc-font-focus-action-line)] font-[number:var(--fc-font-focus-action-weight)]"
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
            variant="outline"
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
