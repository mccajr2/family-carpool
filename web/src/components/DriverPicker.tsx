import { useState, type ReactNode } from "react"
import type {
  CarpoolMeetSide,
  FamilyCircle,
  FamilyMember,
  RsvpStatus,
  SetCalendarLeaveFromRequest,
} from "@/api/types"
import { memberLabel } from "@/components/coverageDisplay"
import {
  ASK_THE_TEAM,
  ASK_TEAM_NEEDS_PLACE,
  BACK_TO_SIMPLE_VIEW,
  DIFFERENT_PLANS_FOR_EACH_KID,
  DIFFERENT_PLANS_FOR_EACH_LEG,
  HERO_ON_INVERSE,
  LEG_COMING_BACK,
  LEG_GETTING_THERE,
  MEET_DRIVERS_PLACE,
  MEET_DRIVERS_PLACE_HINT,
  MEET_OUR_PLACE,
  MEET_WHERE,
  PLACE_DROPPING_OFF_AT,
  PLACE_PICKING_UP_FROM,
  POST_TO_TEAM_ROUND_TRIP,
  SAVE_RIDE_PLAN,
  confirmDriveFromLabel,
  markAsNotGoingLabel,
  markKidsAsNotGoingLabel,
} from "@/components/coverageCopy"
import { LeaveFromControls } from "@/components/LeaveFromControls"
import type { LeaveFromFields } from "@/components/leaveFromDisplay"
import { Button } from "@/components/ui/button"

/** Per-leg driver intent for Save ride plan. */
export type DriverPickerLegChoice =
  | { action: "HOUSEHOLD"; assigneeAdultId: string }
  | { action: "ASK_TEAM" }
  | { action: "NEEDS_RIDE" }

/** Family-side place triad for a leg (Default = both null). */
export type DriverPickerPlaceFields = {
  placeId: string | null
  placeAddress: string | null
}

export type DriverPickerSavePlanLegs = {
  to: DriverPickerLegChoice
  from: DriverPickerLegChoice
  toPlace: DriverPickerPlaceFields
  fromPlace: DriverPickerPlaceFields
  toMeetSide: CarpoolMeetSide
  fromMeetSide: CarpoolMeetSide
}

/** Going kid eligible for per-kid plan sections (first name for headers). */
export type DriverPickerGoingKid = {
  id: string
  firstName: string
}

/** One kid's TO/FROM choices from the kid-split editor. */
export type DriverPickerKidPlan = {
  kidId: string
  legs: DriverPickerSavePlanLegs
}

const EMPTY_PLACE: LeaveFromFields = {
  leaveFromPlaceId: null,
  leaveFromPlaceName: null,
  leaveFromAddress: null,
}

export function placeFieldsFromLeaveFrom(fields: LeaveFromFields): DriverPickerPlaceFields {
  return {
    placeId: fields.leaveFromPlaceId,
    placeAddress: fields.leaveFromAddress,
  }
}

function leaveFromFromPlaceFields(place: DriverPickerPlaceFields): LeaveFromFields {
  return {
    leaveFromPlaceId: place.placeId,
    leaveFromPlaceName: null,
    leaveFromAddress: place.placeAddress,
  }
}

function placeFromBody(body: SetCalendarLeaveFromRequest): DriverPickerPlaceFields {
  return {
    placeId: body.leaveFromPlaceId ?? null,
    placeAddress: body.leaveFromAddress?.trim() || null,
  }
}

export type DriverPickerProps = {
  members: FamilyMember[]
  currentAdultId: string
  selectedAdultId: string
  onSelectedAdultChange: (adultId: string) => void
  kidIds: string[]
  loading?: boolean
  onAssignCoverage: (adultId: string, kidIds: string[]) => void
  /** Required when showTeamSection is true; unused when the Ask chip is hidden. */
  onAskTeam?: () => void
  /**
   * When set, Different plans for each leg opens the shared split editor and
   * Save ride plan calls this with both leg choices for `kidIds`. Simple Ask
   * the team also prefers this (both legs ASK_TEAM + shared place) when set.
   */
  onSaveRidePlan?: (legs: DriverPickerSavePlanLegs) => void
  /**
   * Going kids on the event (not RSVP NO). When length ≥ 2 and
   * `onSaveKidPlans` is set, shows Different plans for each kid.
   */
  goingKids?: DriverPickerGoingKid[]
  /** Atomic multi-plan Save for the kid-split editor (required to activate). */
  onSaveKidPlans?: (plans: DriverPickerKidPlan[]) => void
  /**
   * Optional attendance escape (Hero gap). Per-kid not-going inside kid-split;
   * 1-kid simple/legSplit also uses this.
   */
  onSetRsvp?: (kidId: string, status: RsvpStatus) => void
  /** Bulk not-going on simple/legSplit when 2+ going kids (Hero gap). */
  onSetNotGoing?: (kidIds: string[]) => void
  /** Hero Focus card styling (needsDecision). */
  hero?: boolean
  /** When false, hides the Ask the team chip (e.g. no carpool ride event). */
  showTeamSection?: boolean
  /** Slot between driver chips and Confirm (Leave from) — simple mode only. */
  leaveFromSlot?: ReactNode
  /** Origin label for dynamic Confirm — round trip from {origin}. */
  leaveFromLabel?: string
  /**
   * Circle places for per-leg LeaveFromControls in split / kid-split editors.
   * Required to show Picking up from / Dropping off at.
   */
  circle?: FamilyCircle
  /** Shared leave-from value (seeds split/kid places; used on simple Ask save). */
  sharedPlaceValue?: LeaveFromFields
  /** Override confirm button text for household selection only. */
  confirmLabel?: string
  /**
   * When false, selecting Ask the team disables Post/Save with inline copy.
   * Defaults to true (caller did not check).
   */
  hasPickupPlace?: boolean
  /** Inline error under the primary button (near Save / Confirm). */
  actionError?: string
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

const EMPTY_PLACE_FIELDS: DriverPickerPlaceFields = {
  placeId: null,
  placeAddress: null,
}

const DEFAULT_MEET: CarpoolMeetSide = "REQUESTER"

type LegChipSelection = string | "ASK_TEAM" | null

type KidSectionState = {
  legSplit: boolean
  roundTrip: LegChipSelection
  to: LegChipSelection
  from: LegChipSelection
  roundTripPlace: DriverPickerPlaceFields
  toPlace: DriverPickerPlaceFields
  fromPlace: DriverPickerPlaceFields
  toMeetSide: CarpoolMeetSide
  fromMeetSide: CarpoolMeetSide
}

function choiceFromSelection(selection: LegChipSelection): DriverPickerLegChoice {
  if (selection === "ASK_TEAM") {
    return { action: "ASK_TEAM" }
  }
  if (selection == null || selection === "") {
    return { action: "NEEDS_RIDE" }
  }
  return { action: "HOUSEHOLD", assigneeAdultId: selection }
}

function selectionNeedsPlace(
  selection: LegChipSelection,
  meetSide: CarpoolMeetSide = DEFAULT_MEET,
): boolean {
  if (selection === "ASK_TEAM") {
    return meetSide === "REQUESTER"
  }
  return selection != null && selection !== ""
}

function placeForSelection(
  selection: LegChipSelection,
  meetSide: CarpoolMeetSide,
  place: DriverPickerPlaceFields,
): DriverPickerPlaceFields {
  return selectionNeedsPlace(selection, meetSide) ? place : EMPTY_PLACE_FIELDS
}

function meetForSelection(
  selection: LegChipSelection,
  meetSide: CarpoolMeetSide,
): CarpoolMeetSide {
  return selection === "ASK_TEAM" ? meetSide : DEFAULT_MEET
}

function legsFromKidState(state: KidSectionState): DriverPickerSavePlanLegs {
  if (state.legSplit) {
    return {
      to: choiceFromSelection(state.to),
      from: choiceFromSelection(state.from),
      toPlace: placeForSelection(state.to, state.toMeetSide, state.toPlace),
      fromPlace: placeForSelection(state.from, state.fromMeetSide, state.fromPlace),
      toMeetSide: meetForSelection(state.to, state.toMeetSide),
      fromMeetSide: meetForSelection(state.from, state.fromMeetSide),
    }
  }
  const both = choiceFromSelection(state.roundTrip)
  return {
    to: both,
    from: both,
    toPlace: placeForSelection(state.roundTrip, state.toMeetSide, state.roundTripPlace),
    fromPlace: placeForSelection(state.roundTrip, state.fromMeetSide, state.roundTripPlace),
    toMeetSide: meetForSelection(state.roundTrip, state.toMeetSide),
    fromMeetSide: meetForSelection(state.roundTrip, state.fromMeetSide),
  }
}

function initialKidState(
  seed: LegChipSelection,
  place: DriverPickerPlaceFields,
): KidSectionState {
  return {
    legSplit: false,
    roundTrip: seed,
    to: seed,
    from: seed,
    roundTripPlace: place,
    toPlace: place,
    fromPlace: place,
    toMeetSide: DEFAULT_MEET,
    fromMeetSide: DEFAULT_MEET,
  }
}

function askSelectionNeedsRequesterPlace(
  selection: LegChipSelection,
  meetSide: CarpoolMeetSide,
): boolean {
  return selection === "ASK_TEAM" && meetSide === "REQUESTER"
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

type MeetWhereControlProps = {
  meetSide: CarpoolMeetSide
  onMeetSideChange: (next: CarpoolMeetSide) => void
  loading: boolean
  hero: boolean
  testIdPrefix: string
  /** Optional leg label for aria (e.g. Getting there). */
  legLabel?: string
}

function MeetWhereControl({
  meetSide,
  onMeetSideChange,
  loading,
  hero,
  testIdPrefix,
  legLabel,
}: MeetWhereControlProps) {
  const labelClass = hero
    ? "text-xs font-semibold uppercase tracking-wide opacity-90"
    : "text-xs font-semibold uppercase tracking-wide text-[var(--fc-text-secondary)]"
  const hintClass = hero
    ? "text-xs opacity-90"
    : "text-xs text-[var(--fc-text-secondary)]"
  const ariaLabel = legLabel != null ? `${MEET_WHERE} — ${legLabel}` : MEET_WHERE

  return (
    <div
      data-testid={`${testIdPrefix}-meet-where`}
      className="flex flex-col gap-[var(--fc-space-xs)]"
    >
      <span className={labelClass}>{MEET_WHERE}</span>
      <div
        className={`flex flex-wrap ${hero ? "gap-[var(--fc-space-sm)]" : "gap-[var(--fc-space-xs)]"}`}
        role="group"
        aria-label={ariaLabel}
      >
        <DriverMemberChip
          label={MEET_OUR_PLACE}
          selected={meetSide === "REQUESTER"}
          disabled={loading}
          hero={hero}
          testId={`${testIdPrefix}-meet-our-place`}
          onClick={() => onMeetSideChange("REQUESTER")}
        />
        <DriverMemberChip
          label={MEET_DRIVERS_PLACE}
          selected={meetSide === "ACCEPTOR"}
          disabled={loading}
          hero={hero}
          testId={`${testIdPrefix}-meet-drivers-place`}
          onClick={() => onMeetSideChange("ACCEPTOR")}
        />
      </div>
      {meetSide === "ACCEPTOR" ? (
        <p
          data-testid={`${testIdPrefix}-meet-drivers-hint`}
          className={hintClass}
          style={hero ? { color: "var(--fc-hero-on-secondary)" } : undefined}
        >
          {MEET_DRIVERS_PLACE_HINT}
        </p>
      ) : null}
    </div>
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
              onSelectionChange(member.adultId)
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
          onClick={() => onSelectionChange("ASK_TEAM")}
        />
      ) : null}
    </div>
  )
}

type EditorMode = "simple" | "legSplit" | "kidSplit"

/**
 * Household driver selection: member chips + trailing Ask the team chip,
 * optional leave-from slot, Confirm / Post primary, and progressive
 * Different plans for each leg / each kid editors.
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
  goingKids = [],
  onSaveKidPlans,
  onSetRsvp,
  onSetNotGoing,
  hero = false,
  showTeamSection = true,
  leaveFromSlot,
  leaveFromLabel,
  circle,
  sharedPlaceValue,
  confirmLabel: confirmLabelProp,
  hasPickupPlace = true,
  actionError,
}: DriverPickerProps) {
  const [askTeamSelected, setAskTeamSelected] = useState(false)
  const [mode, setMode] = useState<EditorMode>("simple")
  const [toSelection, setToSelection] = useState<LegChipSelection>(currentAdultId)
  const [fromSelection, setFromSelection] = useState<LegChipSelection>(currentAdultId)
  const [kidStates, setKidStates] = useState<Record<string, KidSectionState>>({})
  const sharedPlaceSeed = placeFieldsFromLeaveFrom(sharedPlaceValue ?? EMPTY_PLACE)
  const [toPlace, setToPlace] = useState<DriverPickerPlaceFields>(sharedPlaceSeed)
  const [fromPlace, setFromPlace] = useState<DriverPickerPlaceFields>(sharedPlaceSeed)
  const [toMeetSide, setToMeetSide] = useState<CarpoolMeetSide>(DEFAULT_MEET)
  const [fromMeetSide, setFromMeetSide] = useState<CarpoolMeetSide>(DEFAULT_MEET)
  const [simpleToMeetSide, setSimpleToMeetSide] =
    useState<CarpoolMeetSide>(DEFAULT_MEET)
  const [simpleFromMeetSide, setSimpleFromMeetSide] =
    useState<CarpoolMeetSide>(DEFAULT_MEET)

  const teamChipVisible = showTeamSection
  const teamSelected = teamChipVisible && askTeamSelected
  const legSplitEnabled = onSaveRidePlan != null
  const kidSplitEligible = goingKids.length >= 2
  const kidSplitEnabled = kidSplitEligible && onSaveKidPlans != null
  const actionKidIds =
    goingKids.length > 0 ? goingKids.map((kid) => kid.id) : kidIds
  const placeVariant = hero ? "subtle" : "field-row"

  const primaryLabel = teamSelected
    ? POST_TO_TEAM_ROUND_TRIP
    : (confirmLabelProp ??
      confirmDriverLabel(selectedAdultId, members, currentAdultId, leaveFromLabel))

  const simpleNeedsRequesterPlace =
    askSelectionNeedsRequesterPlace("ASK_TEAM", simpleToMeetSide) ||
    askSelectionNeedsRequesterPlace("ASK_TEAM", simpleFromMeetSide)
  const askBlockedByMissingPlace =
    teamSelected && simpleNeedsRequesterPlace && !hasPickupPlace
  const primaryDisabled =
    loading ||
    actionKidIds.length === 0 ||
    (!teamSelected && !selectedAdultId) ||
    askBlockedByMissingPlace

  const splitNeedsRequesterPlace =
    askSelectionNeedsRequesterPlace(toSelection, toMeetSide) ||
    askSelectionNeedsRequesterPlace(fromSelection, fromMeetSide)
  const splitPrimaryDisabled =
    loading ||
    actionKidIds.length === 0 ||
    (splitNeedsRequesterPlace && !hasPickupPlace)

  function kidSplitNeedsRequesterPlace(): boolean {
    return goingKids.some((kid) => {
      const state =
        kidStates[kid.id] ?? initialKidState(currentAdultId, sharedPlaceSeed)
      if (state.legSplit) {
        return (
          askSelectionNeedsRequesterPlace(state.to, state.toMeetSide) ||
          askSelectionNeedsRequesterPlace(state.from, state.fromMeetSide)
        )
      }
      return (
        askSelectionNeedsRequesterPlace(state.roundTrip, state.toMeetSide) ||
        askSelectionNeedsRequesterPlace(state.roundTrip, state.fromMeetSide)
      )
    })
  }

  const kidSplitPrimaryDisabled =
    loading ||
    goingKids.length === 0 ||
    (kidSplitNeedsRequesterPlace() && !hasPickupPlace)

  const pickupHint =
    !hasPickupPlace &&
    (askBlockedByMissingPlace ||
      (mode === "legSplit" && splitNeedsRequesterPlace) ||
      (mode === "kidSplit" && kidSplitNeedsRequesterPlace()))
      ? ASK_TEAM_NEEDS_PLACE
      : null
  const inlineError = actionError ?? pickupHint

  function renderInlineError() {
    if (inlineError == null) {
      return null
    }
    return (
      <p
        role="alert"
        data-testid="driver-picker-action-error"
        className={
          hero
            ? "text-xs opacity-90"
            : "text-sm text-[var(--fc-danger)]"
        }
        style={hero ? { color: "var(--fc-hero-on-secondary)" } : undefined}
      >
        {inlineError}
      </p>
    )
  }

  function renderMeetWhere(
    selection: LegChipSelection,
    meetSide: CarpoolMeetSide,
    onMeetSideChange: (next: CarpoolMeetSide) => void,
    testIdPrefix: string,
    legLabel?: string,
  ) {
    if (selection !== "ASK_TEAM") {
      return null
    }
    return (
      <MeetWhereControl
        meetSide={meetSide}
        onMeetSideChange={onMeetSideChange}
        loading={loading}
        hero={hero}
        testIdPrefix={testIdPrefix}
        legLabel={legLabel}
      />
    )
  }

  function renderLegPlaceControl(
    kind: "TO" | "FROM",
    selection: LegChipSelection,
    place: DriverPickerPlaceFields,
    onPlaceChange: (next: DriverPickerPlaceFields) => void,
    testIdPrefix: string,
    meetSide: CarpoolMeetSide = DEFAULT_MEET,
  ) {
    if (circle == null || !selectionNeedsPlace(selection, meetSide)) {
      return null
    }
    const label = kind === "TO" ? PLACE_PICKING_UP_FROM : PLACE_DROPPING_OFF_AT
    return (
      <div data-testid={`${testIdPrefix}-place`}>
        <LeaveFromControls
          variant={placeVariant}
          label={label}
          value={leaveFromFromPlaceFields(place)}
          circle={circle}
          loading={loading}
          ariaLabel={label}
          onChange={(body) => onPlaceChange(placeFromBody(body))}
          testIdPrefix={testIdPrefix}
        />
      </div>
    )
  }

  function sharedSeedSelection(): LegChipSelection {
    if (mode === "legSplit") {
      return toSelection ?? fromSelection ?? (selectedAdultId || currentAdultId)
    }
    return teamSelected ? "ASK_TEAM" : (selectedAdultId || currentAdultId)
  }

  function openLegSplitEditor() {
    if (!legSplitEnabled) {
      return
    }
    const initial: LegChipSelection = teamSelected
      ? "ASK_TEAM"
      : selectedAdultId || currentAdultId
    const seed = placeFieldsFromLeaveFrom(sharedPlaceValue ?? EMPTY_PLACE)
    setToSelection(initial)
    setFromSelection(initial)
    setToPlace(seed)
    setFromPlace(seed)
    setToMeetSide(teamSelected ? simpleToMeetSide : DEFAULT_MEET)
    setFromMeetSide(teamSelected ? simpleFromMeetSide : DEFAULT_MEET)
    setMode("legSplit")
  }

  function openKidSplitEditor() {
    if (!kidSplitEnabled) {
      return
    }
    const seed = sharedSeedSelection()
    const place =
      mode === "legSplit"
        ? toPlace
        : placeFieldsFromLeaveFrom(sharedPlaceValue ?? EMPTY_PLACE)
    const next: Record<string, KidSectionState> = {}
    for (const kid of goingKids) {
      const base = initialKidState(seed, place)
      if (mode === "legSplit") {
        next[kid.id] = {
          ...base,
          toMeetSide,
          fromMeetSide,
        }
      } else if (teamSelected) {
        next[kid.id] = {
          ...base,
          toMeetSide: simpleToMeetSide,
          fromMeetSide: simpleFromMeetSide,
        }
      } else {
        next[kid.id] = base
      }
    }
    setKidStates(next)
    setMode("kidSplit")
  }

  function handlePrimaryClick() {
    if (teamSelected) {
      if (onSaveRidePlan != null) {
        const place = placeFieldsFromLeaveFrom(sharedPlaceValue ?? EMPTY_PLACE)
        onSaveRidePlan({
          to: { action: "ASK_TEAM" },
          from: { action: "ASK_TEAM" },
          toPlace: placeForSelection("ASK_TEAM", simpleToMeetSide, place),
          fromPlace: placeForSelection("ASK_TEAM", simpleFromMeetSide, place),
          toMeetSide: simpleToMeetSide,
          fromMeetSide: simpleFromMeetSide,
        })
        return
      }
      onAskTeam?.()
      return
    }
    onAssignCoverage(selectedAdultId, actionKidIds)
  }

  function handleSaveRidePlan() {
    if (onSaveRidePlan == null) {
      return
    }
    onSaveRidePlan({
      to: choiceFromSelection(toSelection),
      from: choiceFromSelection(fromSelection),
      toPlace: placeForSelection(toSelection, toMeetSide, toPlace),
      fromPlace: placeForSelection(fromSelection, fromMeetSide, fromPlace),
      toMeetSide: meetForSelection(toSelection, toMeetSide),
      fromMeetSide: meetForSelection(fromSelection, fromMeetSide),
    })
  }

  function handleSaveKidPlans() {
    if (onSaveKidPlans == null) {
      return
    }
    const plans: DriverPickerKidPlan[] = goingKids.map((kid) => {
      const state =
        kidStates[kid.id] ?? initialKidState(currentAdultId, sharedPlaceSeed)
      return { kidId: kid.id, legs: legsFromKidState(state) }
    })
    onSaveKidPlans(plans)
  }

  function updateKidState(kidId: string, patch: Partial<KidSectionState>) {
    setKidStates((current) => {
      const prev =
        current[kidId] ?? initialKidState(currentAdultId, sharedPlaceSeed)
      return { ...current, [kidId]: { ...prev, ...patch } }
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

  function renderDisclosureLink(
    testId: string,
    label: string,
    enabled: boolean,
    onClick: () => void,
  ) {
    return (
      <button
        type="button"
        data-testid={testId}
        className={`${linkClass}${enabled ? "" : " cursor-not-allowed"}`}
        style={hero ? { color: "var(--fc-hero-on-secondary)" } : undefined}
        aria-disabled={enabled ? undefined : "true"}
        tabIndex={enabled ? undefined : -1}
        disabled={loading}
        onClick={(event) => {
          if (!enabled) {
            event.preventDefault()
            return
          }
          onClick()
        }}
      >
        {label}
      </button>
    )
  }

  function markGoingKidsNotAttending() {
    const ids = goingKids.map((kid) => kid.id)
    if (ids.length === 0) {
      return
    }
    if (ids.length >= 2 && onSetNotGoing != null) {
      onSetNotGoing(ids)
      return
    }
    if (onSetRsvp != null) {
      for (const id of ids) {
        onSetRsvp(id, "NO")
      }
      return
    }
    onSetNotGoing?.(ids)
  }

  /** Collapsed simple / leg-split attendance escape (not shown in kid-split). */
  function renderCollapsedNotGoingControl() {
    if (goingKids.length === 0 || (onSetRsvp == null && onSetNotGoing == null)) {
      return null
    }
    return (
      <button
        type="button"
        data-testid={
          goingKids.length >= 2
            ? "driver-picker-not-going-all"
            : `driver-picker-not-going-${goingKids[0]!.id}`
        }
        className={`${linkClass} disabled:cursor-not-allowed disabled:opacity-50`}
        style={hero ? { color: "var(--fc-hero-on-secondary)" } : undefined}
        disabled={loading}
        onClick={markGoingKidsNotAttending}
      >
        {goingKids.length >= 2
          ? markKidsAsNotGoingLabel(goingKids.map((kid) => kid.firstName))
          : markAsNotGoingLabel(goingKids[0]!.firstName)}
      </button>
    )
  }

  function renderKidNotGoingControl(kid: DriverPickerGoingKid) {
    if (onSetRsvp == null) {
      return null
    }
    return (
      <button
        type="button"
        data-testid={`driver-picker-not-going-${kid.id}`}
        className={`${linkClass} disabled:cursor-not-allowed disabled:opacity-50`}
        style={hero ? { color: "var(--fc-hero-on-secondary)" } : undefined}
        disabled={loading}
        onClick={() => onSetRsvp(kid.id, "NO")}
      >
        {markAsNotGoingLabel(kid.firstName)}
      </button>
    )
  }

  if (mode === "kidSplit" && kidSplitEnabled) {
    return (
      <div data-testid="driver-picker" data-mode="kid-split" className="w-full min-w-0 max-w-full">
        <div className="flex min-w-0 max-w-full flex-col gap-[var(--fc-space-lg)]">
          {goingKids.map((kid) => {
            const state =
              kidStates[kid.id] ?? initialKidState(currentAdultId, sharedPlaceSeed)
            return (
              <div
                key={kid.id}
                data-testid={`driver-picker-kid-${kid.id}`}
                className="flex flex-col gap-[var(--fc-space-md)]"
              >
                <span className={sectionLabelClass} data-testid={`driver-picker-kid-header-${kid.id}`}>
                  {kid.firstName}
                </span>
                {state.legSplit ? (
                  <>
                    <div
                      data-testid={`driver-picker-kid-${kid.id}-leg-to`}
                      className="flex flex-col gap-[var(--fc-space-sm)]"
                    >
                      <span className={sectionLabelClass}>{LEG_GETTING_THERE}</span>
                      <DriverChipRow
                        members={members}
                        currentAdultId={currentAdultId}
                        selection={state.to}
                        onSelectionChange={(next) => updateKidState(kid.id, { to: next })}
                        loading={loading}
                        hero={hero}
                        showTeamSection={teamChipVisible}
                        ariaLabel={`${kid.firstName} ${LEG_GETTING_THERE}`}
                        testIdPrefix={`driver-picker-kid-${kid.id}-to`}
                      />
                      {renderMeetWhere(
                        state.to,
                        state.toMeetSide,
                        (next) => updateKidState(kid.id, { toMeetSide: next }),
                        `driver-picker-kid-${kid.id}-to`,
                        LEG_GETTING_THERE,
                      )}
                      {renderLegPlaceControl(
                        "TO",
                        state.to,
                        state.toPlace,
                        (next) => updateKidState(kid.id, { toPlace: next }),
                        `driver-picker-kid-${kid.id}-to`,
                        state.toMeetSide,
                      )}
                    </div>
                    <div
                      data-testid={`driver-picker-kid-${kid.id}-leg-from`}
                      className="flex flex-col gap-[var(--fc-space-sm)]"
                    >
                      <span className={sectionLabelClass}>{LEG_COMING_BACK}</span>
                      <DriverChipRow
                        members={members}
                        currentAdultId={currentAdultId}
                        selection={state.from}
                        onSelectionChange={(next) => updateKidState(kid.id, { from: next })}
                        loading={loading}
                        hero={hero}
                        showTeamSection={teamChipVisible}
                        ariaLabel={`${kid.firstName} ${LEG_COMING_BACK}`}
                        testIdPrefix={`driver-picker-kid-${kid.id}-from`}
                      />
                      {renderMeetWhere(
                        state.from,
                        state.fromMeetSide,
                        (next) => updateKidState(kid.id, { fromMeetSide: next }),
                        `driver-picker-kid-${kid.id}-from`,
                        LEG_COMING_BACK,
                      )}
                      {renderLegPlaceControl(
                        "FROM",
                        state.from,
                        state.fromPlace,
                        (next) => updateKidState(kid.id, { fromPlace: next }),
                        `driver-picker-kid-${kid.id}-from`,
                        state.fromMeetSide,
                      )}
                    </div>
                    {renderDisclosureLink(
                      `driver-picker-kid-${kid.id}-back-to-round-trip`,
                      BACK_TO_SIMPLE_VIEW,
                      true,
                      () =>
                        updateKidState(kid.id, {
                          legSplit: false,
                          roundTrip: state.to ?? state.from ?? currentAdultId,
                          roundTripPlace: state.toPlace,
                        }),
                    )}
                  </>
                ) : (
                  <>
                    <DriverChipRow
                      members={members}
                      currentAdultId={currentAdultId}
                      selection={state.roundTrip}
                      onSelectionChange={(next) => updateKidState(kid.id, { roundTrip: next })}
                      loading={loading}
                      hero={hero}
                      showTeamSection={teamChipVisible}
                      ariaLabel={`${kid.firstName} driver`}
                      testIdPrefix={`driver-picker-kid-${kid.id}`}
                    />
                    {state.roundTrip === "ASK_TEAM" ? (
                      <>
                        {renderMeetWhere(
                          "ASK_TEAM",
                          state.toMeetSide,
                          (next) => updateKidState(kid.id, { toMeetSide: next }),
                          `driver-picker-kid-${kid.id}-to`,
                          LEG_GETTING_THERE,
                        )}
                        {renderMeetWhere(
                          "ASK_TEAM",
                          state.fromMeetSide,
                          (next) => updateKidState(kid.id, { fromMeetSide: next }),
                          `driver-picker-kid-${kid.id}-from`,
                          LEG_COMING_BACK,
                        )}
                      </>
                    ) : null}
                    {circle != null &&
                    (selectionNeedsPlace(state.roundTrip, state.toMeetSide) ||
                      selectionNeedsPlace(state.roundTrip, state.fromMeetSide)) ? (
                      <div data-testid={`driver-picker-kid-${kid.id}-place`}>
                        <LeaveFromControls
                          variant={placeVariant}
                          label="Leave from"
                          value={leaveFromFromPlaceFields(state.roundTripPlace)}
                          circle={circle}
                          loading={loading}
                          ariaLabel={`${kid.firstName} Leave from`}
                          onChange={(body) =>
                            updateKidState(kid.id, { roundTripPlace: placeFromBody(body) })
                          }
                          testIdPrefix={`driver-picker-kid-${kid.id}-place`}
                        />
                      </div>
                    ) : null}
                    {renderDisclosureLink(
                      `driver-picker-kid-${kid.id}-different-plans-leg`,
                      DIFFERENT_PLANS_FOR_EACH_LEG,
                      true,
                      () => {
                        const seed = state.roundTrip ?? currentAdultId
                        updateKidState(kid.id, {
                          legSplit: true,
                          to: seed,
                          from: seed,
                          toPlace: state.roundTripPlace,
                          fromPlace: state.roundTripPlace,
                        })
                      },
                    )}
                  </>
                )}
                {renderKidNotGoingControl(kid)}
              </div>
            )
          })}
          {renderPrimaryButton(SAVE_RIDE_PLAN, handleSaveKidPlans, kidSplitPrimaryDisabled)}
          {renderInlineError()}
          {renderDisclosureLink(
            "driver-picker-back-to-simple",
            BACK_TO_SIMPLE_VIEW,
            true,
            () => setMode("simple"),
          )}
        </div>
      </div>
    )
  }

  if (mode === "legSplit" && legSplitEnabled) {
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
            {renderMeetWhere(
              toSelection,
              toMeetSide,
              setToMeetSide,
              "driver-picker-to",
              LEG_GETTING_THERE,
            )}
            {renderLegPlaceControl(
              "TO",
              toSelection,
              toPlace,
              setToPlace,
              "driver-picker-to",
              toMeetSide,
            )}
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
            {renderMeetWhere(
              fromSelection,
              fromMeetSide,
              setFromMeetSide,
              "driver-picker-from",
              LEG_COMING_BACK,
            )}
            {renderLegPlaceControl(
              "FROM",
              fromSelection,
              fromPlace,
              setFromPlace,
              "driver-picker-from",
              fromMeetSide,
            )}
          </div>
          {renderPrimaryButton(SAVE_RIDE_PLAN, handleSaveRidePlan, splitPrimaryDisabled)}
          {renderInlineError()}
          {kidSplitEligible
            ? renderDisclosureLink(
                "driver-picker-different-plans-kid",
                DIFFERENT_PLANS_FOR_EACH_KID,
                kidSplitEnabled,
                openKidSplitEditor,
              )
            : null}
          {renderDisclosureLink(
            "driver-picker-back-to-simple",
            BACK_TO_SIMPLE_VIEW,
            true,
            () => setMode("simple"),
          )}
          {renderCollapsedNotGoingControl()}
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
        {teamSelected ? (
          <>
            {renderMeetWhere(
              "ASK_TEAM",
              simpleToMeetSide,
              setSimpleToMeetSide,
              "driver-picker-simple-to",
              LEG_GETTING_THERE,
            )}
            {renderMeetWhere(
              "ASK_TEAM",
              simpleFromMeetSide,
              setSimpleFromMeetSide,
              "driver-picker-simple-from",
              LEG_COMING_BACK,
            )}
          </>
        ) : null}
        {!teamSelected || simpleNeedsRequesterPlace ? leaveFromSlot : null}
        {renderPrimaryButton(primaryLabel, handlePrimaryClick, primaryDisabled)}
        {renderInlineError()}
        {renderDisclosureLink(
          "driver-picker-different-plans",
          DIFFERENT_PLANS_FOR_EACH_LEG,
          legSplitEnabled,
          openLegSplitEditor,
        )}
        {kidSplitEligible
          ? renderDisclosureLink(
              "driver-picker-different-plans-kid",
              DIFFERENT_PLANS_FOR_EACH_KID,
              kidSplitEnabled,
              openKidSplitEditor,
            )
          : null}
        {renderCollapsedNotGoingControl()}
      </div>
    </div>
  )
}
