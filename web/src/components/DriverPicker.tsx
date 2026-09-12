import { useState, type ReactNode } from "react"
import type { FamilyMember } from "@/api/types"
import { memberLabel } from "@/components/coverageDisplay"
import {
  ASK_THE_TEAM,
  BACK_TO_SIMPLE_VIEW,
  DIFFERENT_PLANS_FOR_EACH_LEG,
  HERO_ON_INVERSE,
  LEG_COMING_BACK,
  LEG_GETTING_THERE,
  POST_TO_TEAM_ROUND_TRIP,
  SAVE_RIDE_PLAN,
  confirmDriveFromLabel,
} from "@/components/coverageCopy"
import { Button } from "@/components/ui/button"

/** Per-leg driver intent for Save ride plan. */
export type DriverPickerLegChoice =
  | { action: "HOUSEHOLD"; assigneeAdultId: string }
  | { action: "ASK_TEAM" }
  | { action: "NEEDS_RIDE" }

export type DriverPickerSavePlanLegs = {
  to: DriverPickerLegChoice
  from: DriverPickerLegChoice
}

export type DriverPickerProps = {
  members: FamilyMember[]
  currentAdultId: string
  selectedAdultId: string
  onSelectedAdultChange: (adultId: string) => void
  kidIds: string[]
  loading?: boolean
  onAssignCoverage: (adultId: string, kidIds: string[]) => void
  onAskTeam: () => void
  /**
   * When set, Different plans opens the split editor and Save ride plan calls
   * this with both leg choices. Omit to keep the link inert (no carpool space).
   */
  onSaveRidePlan?: (legs: DriverPickerSavePlanLegs) => void
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

type LegChipSelection = string | "ASK_TEAM" | null

function choiceFromSelection(selection: LegChipSelection): DriverPickerLegChoice {
  if (selection === "ASK_TEAM") {
    return { action: "ASK_TEAM" }
  }
  if (selection == null || selection === "") {
    return { action: "NEEDS_RIDE" }
  }
  return { action: "HOUSEHOLD", assigneeAdultId: selection }
}

function selectionIsHousehold(selection: LegChipSelection): boolean {
  return selection != null && selection !== "ASK_TEAM"
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

type DriverChipRowProps = {
  members: FamilyMember[]
  currentAdultId: string
  selection: LegChipSelection
  onSelectionChange: (next: LegChipSelection) => void
  loading: boolean
  hero: boolean
  showTeamSection: boolean
  ariaLabel: string
  testIdPrefix: string
}

function DriverChipRow({
  members,
  currentAdultId,
  selection,
  onSelectionChange,
  loading,
  hero,
  showTeamSection,
  ariaLabel,
  testIdPrefix,
}: DriverChipRowProps) {
  const teamSelected = showTeamSection && selection === "ASK_TEAM"

  return (
    <div
      className={`flex flex-wrap ${hero ? "gap-[var(--fc-space-sm)]" : "gap-[var(--fc-space-xs)]"} min-w-0 max-w-full`}
      role="group"
      aria-label={ariaLabel}
      data-testid={`${testIdPrefix}-chips`}
    >
      {members.map((member) => {
        const selected = !teamSelected && selection === member.adultId
        return (
          <DriverMemberChip
            key={member.adultId}
            label={householdDriverChipLabel(member, currentAdultId)}
            selected={selected}
            disabled={loading}
            hero={hero}
            testId={`${testIdPrefix}-chip-${member.adultId}`}
            onClick={() => {
              // Toggle off → Needs ride (allowed open leg).
              onSelectionChange(selected ? null : member.adultId)
            }}
          />
        )
      })}
      {showTeamSection ? (
        <DriverMemberChip
          label={ASK_THE_TEAM}
          selected={teamSelected}
          disabled={loading}
          hero={hero}
          testId={`${testIdPrefix}-ask-team-chip`}
          onClick={() => {
            onSelectionChange(teamSelected ? null : "ASK_TEAM")
          }}
        />
      ) : null}
    </div>
  )
}

/**
 * Household driver selection: member chips + trailing Ask the team chip,
 * optional leave-from slot, Confirm / Post primary, and Different plans →
 * split editor (Save ride plan / Back to simple view). Kid-subset checkboxes
 * stay outside this component (see AgendaFocusCard).
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
  onSaveRidePlan,
  hero = false,
  showTeamSection = true,
  leaveFromSlot,
  leaveFromLabel,
  confirmLabel: confirmLabelProp,
}: DriverPickerProps) {
  const [askTeamSelected, setAskTeamSelected] = useState(false)
  const [splitMode, setSplitMode] = useState(false)
  const [toSelection, setToSelection] = useState<LegChipSelection>(currentAdultId)
  const [fromSelection, setFromSelection] = useState<LegChipSelection>(currentAdultId)

  const teamChipVisible = showTeamSection
  const teamSelected = teamChipVisible && askTeamSelected
  const splitEnabled = onSaveRidePlan != null

  const primaryLabel = teamSelected
    ? POST_TO_TEAM_ROUND_TRIP
    : (confirmLabelProp ??
      confirmDriverLabel(selectedAdultId, members, currentAdultId, leaveFromLabel))

  const primaryDisabled =
    loading || kidIds.length === 0 || (!teamSelected && !selectedAdultId)

  const splitLeaveFromVisible =
    selectionIsHousehold(toSelection) || selectionIsHousehold(fromSelection)
  const splitPrimaryDisabled = loading || kidIds.length === 0

  function handlePrimaryClick() {
    if (teamSelected) {
      onAskTeam()
      return
    }
    onAssignCoverage(selectedAdultId, kidIds)
  }

  function openSplitEditor() {
    if (!splitEnabled) {
      return
    }
    const initial: LegChipSelection = teamSelected
      ? "ASK_TEAM"
      : selectedAdultId || currentAdultId
    setToSelection(initial)
    setFromSelection(initial)
    setSplitMode(true)
  }

  function handleSaveRidePlan() {
    if (onSaveRidePlan == null) {
      return
    }
    onSaveRidePlan({
      to: choiceFromSelection(toSelection),
      from: choiceFromSelection(fromSelection),
    })
  }

  const linkClass = hero
    ? "text-left text-xs underline-offset-2 opacity-90 underline decoration-transparent hover:decoration-current"
    : "text-left text-[length:var(--fc-font-subtitle-size)] leading-[var(--fc-font-subtitle-line)] font-[number:var(--fc-font-subtitle-weight)] text-[var(--fc-text-secondary)] underline-offset-2 underline decoration-transparent hover:decoration-current"

  const sectionLabelClass = hero
    ? "text-xs font-semibold uppercase tracking-wide opacity-90"
    : "text-xs font-semibold uppercase tracking-wide text-[var(--fc-text-secondary)]"

  function renderPrimaryButton(label: string, onClick: () => void, disabled: boolean) {
    if (hero) {
      return (
        <button
          type="button"
          data-testid="driver-picker-confirm"
          className="w-full rounded-lg px-4 py-2.5 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50"
          style={{
            backgroundColor: "var(--fc-hero-on)",
            color: HERO_ON_INVERSE,
          }}
          onClick={onClick}
          disabled={disabled}
        >
          {label}
        </button>
      )
    }
    return (
      <Button
        type="button"
        size="sm"
        data-testid="driver-picker-confirm"
        className="w-full text-[length:var(--fc-font-focus-action-size)] leading-[var(--fc-font-focus-action-line)] font-[number:var(--fc-font-focus-action-weight)]"
        onClick={onClick}
        disabled={disabled}
      >
        {label}
      </Button>
    )
  }

  if (splitMode && splitEnabled) {
    return (
      <div data-testid="driver-picker" data-mode="split" className="w-full min-w-0 max-w-full">
        <div className="flex min-w-0 max-w-full flex-col gap-[var(--fc-space-md)]">
          <div data-testid="driver-picker-leg-to" className="flex flex-col gap-[var(--fc-space-sm)]">
            <span className={sectionLabelClass}>{LEG_GETTING_THERE}</span>
            <DriverChipRow
              members={members}
              currentAdultId={currentAdultId}
              selection={toSelection}
              onSelectionChange={setToSelection}
              loading={loading}
              hero={hero}
              showTeamSection={teamChipVisible}
              ariaLabel={LEG_GETTING_THERE}
              testIdPrefix="driver-picker-to"
            />
          </div>
          <div data-testid="driver-picker-leg-from" className="flex flex-col gap-[var(--fc-space-sm)]">
            <span className={sectionLabelClass}>{LEG_COMING_BACK}</span>
            <DriverChipRow
              members={members}
              currentAdultId={currentAdultId}
              selection={fromSelection}
              onSelectionChange={setFromSelection}
              loading={loading}
              hero={hero}
              showTeamSection={teamChipVisible}
              ariaLabel={LEG_COMING_BACK}
              testIdPrefix="driver-picker-from"
            />
          </div>
          {splitLeaveFromVisible ? leaveFromSlot : null}
          {renderPrimaryButton(SAVE_RIDE_PLAN, handleSaveRidePlan, splitPrimaryDisabled)}
          <button
            type="button"
            data-testid="driver-picker-back-to-simple"
            className={linkClass}
            style={hero ? { color: "var(--fc-hero-on-secondary)" } : undefined}
            disabled={loading}
            onClick={() => setSplitMode(false)}
          >
            {BACK_TO_SIMPLE_VIEW}
          </button>
        </div>
      </div>
    )
  }

  const chips = (
    <DriverChipRow
      members={members}
      currentAdultId={currentAdultId}
      selection={teamSelected ? "ASK_TEAM" : selectedAdultId}
      onSelectionChange={(next) => {
        if (next === "ASK_TEAM") {
          setAskTeamSelected(true)
          return
        }
        setAskTeamSelected(false)
        if (next != null) {
          onSelectedAdultChange(next)
        }
      }}
      loading={loading}
      hero={hero}
      showTeamSection={teamChipVisible}
      ariaLabel="Household driver"
      testIdPrefix="driver-picker"
    />
  )

  return (
    <div data-testid="driver-picker" data-mode="simple" className="w-full min-w-0 max-w-full">
      <div
        data-testid="driver-picker-household-section"
        className="flex min-w-0 max-w-full flex-col gap-[var(--fc-space-md)]"
      >
        <span className={sectionLabelClass} data-testid="driver-picker-driver-label">
          Driver
        </span>
        {chips}
        {leaveFromSlot}
        {renderPrimaryButton(primaryLabel, handlePrimaryClick, primaryDisabled)}
        <button
          type="button"
          data-testid="driver-picker-different-plans"
          className={`${linkClass}${splitEnabled ? "" : " cursor-not-allowed"}`}
          style={hero ? { color: "var(--fc-hero-on-secondary)" } : undefined}
          aria-disabled={splitEnabled ? undefined : "true"}
          tabIndex={splitEnabled ? undefined : -1}
          disabled={loading}
          onClick={(event) => {
            if (!splitEnabled) {
              event.preventDefault()
              return
            }
            openSplitEditor()
          }}
        >
          {DIFFERENT_PLANS_FOR_EACH_LEG}
        </button>
      </div>
    </div>
  )
}
