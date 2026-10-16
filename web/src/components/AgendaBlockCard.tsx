import { useState } from "react"
import { ChevronDown, ChevronUp } from "lucide-react"

import type {
  CalendarDriveBlockLink,
  CalendarItem,
  CalendarRouteLeg,
  CarpoolRideEvent,
  FamilyCircle,
  SetCalendarLeaveFromRequest,
} from "@/api/types"
import {
  buildAgendaBlockSections,
  type AgendaBlockRunSection,
} from "@/components/agendaBlockSections"
import {
  buildAgendaBlockDecisionSections,
  buildLockedEditDecisionSections,
  fanOutAssignCoverage,
  fanOutCreateRide,
  fanOutSaveKidPlans,
  fanOutSaveRidePlan,
  kidIdsForMemberEvent,
  type AgendaBlockAssignDraft,
} from "@/components/agendaBlockDecision"
import {
  agendaCommitmentActionsForItems,
  blockDepartureItem,
  type AgendaCommitmentAction,
} from "@/components/agendaCommitmentActions"
import { AgendaStatusChip } from "@/components/agendaStatusChip"
import { canRoute } from "@/components/canRoute"
import { ownRideDetailLine } from "@/components/carpoolDisplay"
import { activeCoverages, calendarItemKey } from "@/components/coverageDisplay"
import {
  isPendingHouseholdConfirm,
  mapCalendarItemToCoverageGames,
  type CoverageGameEvent,
} from "@/components/coverageQueue"
import { AgendaLegsTable } from "@/components/AgendaLegsTable"
import {
  AgendaQuietActions,
  AGENDA_QUIET_ACTIONS_ROW_CLASS,
  AGENDA_QUIET_LINK_CLASS,
} from "@/components/AgendaQuietActions"
import {
  buildCombinedEventLayout,
  combinedEventLocationLine,
} from "@/components/combinedEventLayout"
import {
  DriverPicker,
  type DriverPickerConfirmOptions,
  type DriverPickerKidPlan,
  type DriverPickerSavePlanLegs,
} from "@/components/DriverPicker"
import { resolvedLeaveFromLabel } from "@/components/leaveFromDisplay"
import {
  agendaBlockDriveBlockControls,
  splitIntoEventsLabel,
} from "@/components/driveBlockAgendaLinks"
import { EventLocationLine } from "@/components/EventLocationLine"
import { heroKidFirstName } from "@/components/heroAttentionCopy"
import { agendaLeaveByLine } from "@/components/leaveByDisplay"
import { LeaveFromControls } from "@/components/LeaveFromControls"
import { LockedStandingPlanSummary } from "@/components/LockedStandingPlanSummary"
import {
  carpoolAskChipForRideEvent,
  rideStatusChipsForItem,
  type RideStatusChipDescriptor,
} from "@/components/rideStatusChip"
import {
  lockedPlanScopeCaption,
  recurrenceHintLabel,
  standingBlockChrome,
  standingWeekdayNames,
} from "@/components/standingBlockChrome"
import {
  resolveOwnRidePlans,
  type DecidedAssignee,
} from "@/components/transportPlan"

export type AgendaBlockCardProps = {
  /** Combined driving-block members (length ≥ 2), chronological. */
  items: CalendarItem[]
  circle: FamilyCircle
  currentAdultId: string
  rideEventFor: (item: CalendarItem) => CarpoolRideEvent | null | undefined
  /** True when any member is the focused Agenda attention row. */
  isFocused?: boolean
  loading?: boolean
  /** Standing Remove / other block-level action failures. */
  actionError?: string
  /**
   * Combine/split override — one place for the block (not on Hero / AgendaRow).
   * Anchor item is the member whose link was clicked.
   */
  onDriveBlockLink?: (
    item: Pick<CalendarItem, "id" | "source" | "startsAt">,
    link: CalendarDriveBlockLink,
  ) => void
  /**
   * Opens dual-leg Route for the block via a representative member item.
   * Passes the run's leg so There (TO) / Back (FROM) opens on the right tab.
   */
  onOpenRide?: (item: CalendarItem, leg?: CalendarRouteLeg) => void
  /** Kept for the agenda page caller. The when line uses each event's own timestamps. */
  now?: Date
  onRevertDecidedAssignee?: (
    item: CalendarItem,
    assignee: DecidedAssignee,
  ) => void
  onCantMakeIt?: (item: CalendarItem, game: CoverageGameEvent) => void
  onRemoveCoverage?: (assignmentId: string) => void
  onSetNotGoing?: (item: CalendarItem, kidIds: string[]) => void
  onSetLeaveFrom?: (
    item: CalendarItem,
    body: SetCalendarLeaveFromRequest,
  ) => void
  /** Withdraw ACCEPTED inbound ask (hand back Apollo etc.). */
  onWithdrawRide?: (
    item: CalendarItem,
    rideId: string,
    legs?: ("TO" | "FROM")[],
  ) => void
  /** Lock household plan as standing (gated by standingLockEligible). */
  onLockStandingBlock?: (items: CalendarItem[]) => void
  /** Remove recurring coverage template for this locked block (from this date forward). */
  onRemoveStandingBlock?: (templateId: string, fromStartsAt: string) => void
  /**
   * Shared adult draft for the block's decision picker (one adult for the shell).
   * Parent keys drafts per member and syncs adultId across the block.
   */
  assignDraft?: AgendaBlockAssignDraft
  onUpdateAssignDraft?: (
    patch: Partial<{ adultId: string; kidIds: string[] }>,
  ) => void
  /** Item-scoped Confirm — parent or fan-out helper calls once per member event. */
  onAssignCoverage?: (
    item: CalendarItem,
    adultId: string,
    kidIds: string[],
    options?: DriverPickerConfirmOptions,
  ) => void
  onCreateRide?: (
    item: CalendarItem,
    eventKey: string,
    kidIds?: string[],
  ) => void
  onSaveRidePlan?: (
    item: CalendarItem,
    legs: DriverPickerSavePlanLegs,
    kidIds?: string[],
    options?: DriverPickerConfirmOptions,
  ) => void
  onSaveKidPlans?: (
    item: CalendarItem,
    plans: DriverPickerKidPlan[],
    options?: DriverPickerConfirmOptions,
  ) => void
  onCancelRide?: (item: CalendarItem, rideId: string) => void
  /** True when this member's feed has a carpool space (Ask the team). */
  canAskTeamForItem?: (item: CalendarItem) => boolean
  hasPickupPlace?: boolean
  /** Per-member coverage / ask action error (fan-out failures stay item-scoped). */
  coverageActionErrorForItem?: (item: CalendarItem) => string | undefined
  /** Standing Lock weekday labels from `standingBlockChrome(items)` + startsAt. */
  standingLockWeekdaySingular?: string | null
  standingLockWeekdayPlural?: string | null
}

function isRunRoutable(
  run: AgendaBlockRunSection,
  circle: FamilyCircle,
  currentAdultId: string,
  rideEventFor: (item: CalendarItem) => CarpoolRideEvent | null | undefined,
): boolean {
  const rideEvent = rideEventFor(run.representativeItem)
  const games = mapCalendarItemToCoverageGames(
    run.representativeItem,
    rideEvent,
    { currentAdultId, members: circle.members },
  )
  return games.some((game) => canRoute(game, rideEvent))
}

function blockStatusChips(
  items: CalendarItem[],
  circle: FamilyCircle,
  currentAdultId: string,
  rideEventFor: (item: CalendarItem) => CarpoolRideEvent | null | undefined,
) {
  const tags: RideStatusChipDescriptor[] = []
  const seen = new Set<string>()
  for (const item of items) {
    const rideEvent = rideEventFor(item)
    const plans = resolveOwnRidePlans(rideEvent)
    const ownRequest =
      rideEvent?.ownRequest ?? (plans.length === 1 ? plans[0]! : null)
    const games = mapCalendarItemToCoverageGames(item, rideEvent, {
      currentAdultId,
      members: circle.members,
    })
    for (const chip of rideStatusChipsForItem(item, games, ownRequest, {
      rideEvent,
      circleId: circle.id,
      currentAdultId,
    })) {
      if (seen.has(chip.label)) {
        continue
      }
      seen.add(chip.label)
      tags.push(chip)
    }
    const askChip = carpoolAskChipForRideEvent(games)
    if (askChip != null && !seen.has(askChip.label)) {
      seen.add(askChip.label)
      tags.push(askChip)
    }
  }
  return tags
}

function runCommitmentAction(
  action: AgendaCommitmentAction,
  handlers: {
    onRevertDecidedAssignee?: AgendaBlockCardProps["onRevertDecidedAssignee"]
    onCantMakeIt?: AgendaBlockCardProps["onCantMakeIt"]
    onRemoveCoverage?: AgendaBlockCardProps["onRemoveCoverage"]
    onSetNotGoing?: AgendaBlockCardProps["onSetNotGoing"]
    onWithdrawRide?: AgendaBlockCardProps["onWithdrawRide"]
    currentAdultId: string
  },
) {
  switch (action.kind) {
    case "revert":
      handlers.onRevertDecidedAssignee?.(action.item, action.assignee)
      return
    case "cant-make-it":
      handlers.onCantMakeIt?.(action.item, action.game)
      return
    case "cancel-pending": {
      if (
        !isPendingHouseholdConfirm(action.game.ownRide) ||
        action.game.ownRide.driver === "You"
      ) {
        return
      }
      const coverage = activeCoverages(action.item).find(
        (row) =>
          row.status === "PENDING" &&
          row.kidIds.includes(action.game.kidId) &&
          row.coveringAdultId !== handlers.currentAdultId,
      )
      if (coverage != null) {
        handlers.onRemoveCoverage?.(coverage.id)
      }
      return
    }
    case "not-going":
      handlers.onSetNotGoing?.(action.item, action.kidIds)
      return
    case "withdraw-inbound":
      handlers.onWithdrawRide?.(action.item, action.rideId, action.legs)
      return
  }
}

/**
 * Multi-item Agenda card. Header matches a single event (eyebrow, title,
 * when, one plan chip). Collapsed body is one kid row per event. Expanded
 * body is the Getting there / Coming back pair, then shared controls.
 * Plan locked stays inside the expanded body.
 */
export function AgendaBlockCard({
  items,
  circle,
  currentAdultId,
  rideEventFor,
  isFocused = false,
  loading = false,
  actionError,
  onDriveBlockLink,
  onOpenRide,
  onRevertDecidedAssignee,
  onCantMakeIt,
  onRemoveCoverage,
  onSetNotGoing,
  onSetLeaveFrom,
  onWithdrawRide,
  onLockStandingBlock: _onLockStandingBlock,
  onRemoveStandingBlock,
  assignDraft,
  onUpdateAssignDraft,
  onAssignCoverage,
  onCreateRide,
  onSaveRidePlan,
  onSaveKidPlans,
  onCancelRide,
  canAskTeamForItem,
  hasPickupPlace = false,
  coverageActionErrorForItem,
  standingLockWeekdaySingular: standingLockWeekdaySingularProp,
  standingLockWeekdayPlural: standingLockWeekdayPluralProp,
}: AgendaBlockCardProps) {
  const [open, setOpen] = useState(false)
  const [editingLockedPlan, setEditingLockedPlan] = useState(false)
  const [confirmOriginLabel, setConfirmOriginLabel] = useState("")
  const locationLine = combinedEventLocationLine(items)
  const layout = buildCombinedEventLayout({
    items,
    currentAdultId,
    circleId: circle.id,
    kids: circle.kids,
    members: circle.members,
    rideEventFor,
  })
  const sections = buildAgendaBlockSections({
    items,
    currentAdultId,
    circleId: circle.id,
    kids: circle.kids,
    members: circle.members,
    rideEventFor,
  })
  const driveBlockControls = agendaBlockDriveBlockControls(items)
  const standingChrome = standingBlockChrome(items)
  const weekdays =
    items[0] != null ? standingWeekdayNames(items[0].startsAt) : { singular: "week", plural: "weeks" }
  const standingLockWeekdaySingular =
    standingLockWeekdaySingularProp !== undefined
      ? standingLockWeekdaySingularProp
      : standingChrome.showLock
        ? weekdays.singular
        : null
  const standingLockWeekdayPlural =
    standingLockWeekdayPluralProp !== undefined
      ? standingLockWeekdayPluralProp
      : standingChrome.showLock
        ? weekdays.plural
        : null
  // Minimum Confirm wiring; Ask/Save/Cancel are optional until the picker mounts.
  const decisionWiringReady =
    assignDraft != null &&
    onUpdateAssignDraft != null &&
    onAssignCoverage != null
  const canAskTeamAnywhere =
    canAskTeamForItem != null && items.some((member) => canAskTeamForItem(member))
  const memberCoverageError =
    coverageActionErrorForItem != null
      ? items
          .map((member) => coverageActionErrorForItem(member))
          .find((message) => message != null && message.length > 0)
      : undefined
  const isStandingLocked = standingChrome.showRemove
  const settledLockedView = isStandingLocked && !editingLockedPlan
  const showLockedSummary = isStandingLocked
  const decisionSections =
    decisionWiringReady && !settledLockedView
      ? editingLockedPlan
        ? buildLockedEditDecisionSections({
            items,
            kidRows: layout.kidRows,
          })
        : buildAgendaBlockDecisionSections({
            items,
            kidRows: layout.kidRows,
            rideEventFor,
          })
      : []
  const hasOpenPicker = decisionSections.some((section) => section.kind === "picker")
  const commitmentActions = agendaCommitmentActionsForItems(items, {
    circle,
    currentAdultId,
    rideEventFor,
  })
  const lockedNotGoingActions = commitmentActions
    .filter((action) => action.kind === "not-going")
    .map((action) => ({
      key: action.key,
      kidIds: action.kidIds,
      firstNames: action.kidIds.map((kidId) =>
        heroKidFirstName(kidId, circle.kids),
      ),
      testId: action.testId,
    }))
  const visibleCommitmentActions = settledLockedView
    ? []
    : commitmentActions
  const departureItem = blockDepartureItem({
    items,
    currentAdultId,
    rideEventFor,
  })
  const leaveFromItem = departureItem ?? items[0] ?? null
  const leaveFromFields =
    leaveFromItem != null
      ? {
          leaveFromPlaceId: leaveFromItem.leaveFromPlaceId,
          leaveFromPlaceName: leaveFromItem.leaveFromPlaceName,
          leaveFromAddress: leaveFromItem.leaveFromAddress,
        }
      : {
          leaveFromPlaceId: null as string | null,
          leaveFromPlaceName: null as string | null,
          leaveFromAddress: null as string | null,
        }
  const originForConfirm =
    confirmOriginLabel || resolvedLeaveFromLabel(leaveFromFields, circle)
  const showLeaveFrom =
    onSetLeaveFrom != null &&
    departureItem != null &&
    sections.toRun != null &&
    !settledLockedView &&
    !hasOpenPicker
  const quietLinkClass = AGENDA_QUIET_LINK_CLASS
  const decisionTitleClass =
    "block uppercase tracking-wide text-[length:var(--fc-font-list-row-team-size)] leading-[var(--fc-font-list-row-team-line)] font-[number:var(--fc-font-list-row-team-weight)] text-[var(--fc-text-secondary)]"
  const focusRingStyle = isFocused
    ? {
        borderColor: "var(--fc-list-row-focus-border)",
        boxShadow:
          "0 0 0 var(--fc-space-list-row-focus-halo-spread) var(--fc-list-row-focus-halo)",
      }
    : undefined
  const toRoutable =
    onOpenRide != null &&
    sections.toRun != null &&
    isRunRoutable(sections.toRun, circle, currentAdultId, rideEventFor)
  const fromRoutable =
    onOpenRide != null &&
    sections.fromRun != null &&
    isRunRoutable(sections.fromRun, circle, currentAdultId, rideEventFor)
  const statusChips = blockStatusChips(
    items,
    circle,
    currentAdultId,
    rideEventFor,
  )
  const ChevronIcon = open ? ChevronUp : ChevronDown
  const toItemKey =
    sections.toRun != null ? calendarItemKey(sections.toRun.representativeItem) : null
  const fromItemKey =
    sections.fromRun != null
      ? calendarItemKey(sections.fromRun.representativeItem)
      : null
  const toRouteRowKey = toRoutable
    ? layout.kidRows.find((row) => row.itemKey === toItemKey)?.key ?? null
    : null
  const fromRouteRowKey = fromRoutable
    ? layout.kidRows.find((row) => row.itemKey === fromItemKey)?.key ?? null
    : null
  const leaveFromAriaLabel =
    items.length > 0
      ? `Leave from for ${items.map((row) => row.title).join(" / ")}`
      : "Leave from for drive block"
  const leaveFromSlotForPicker =
    leaveFromItem != null && onSetLeaveFrom != null ? (
      <LeaveFromControls
        variant="field-row"
        value={leaveFromFields}
        circle={circle}
        loading={loading}
        ariaLabel={leaveFromAriaLabel}
        helperLine={agendaLeaveByLine(leaveFromItem)}
        onChange={(body) => onSetLeaveFrom(leaveFromItem, body)}
        onConfirmOriginLabelChange={setConfirmOriginLabel}
        testIdPrefix={`leave-from-block-${calendarItemKey(leaveFromItem)}`}
      />
    ) : undefined
  // Avoid unused-prop lint when Lock is confirm-time only (DriverPicker / Focus).
  void _onLockStandingBlock

  return (
    <div
      data-testid="agenda-block-card"
      data-member-keys={items.map(calendarItemKey).join(",")}
      data-focused={isFocused ? "true" : "false"}
      data-decision-wired={decisionWiringReady ? "true" : "false"}
      data-assign-adult={assignDraft?.adultId ?? ""}
      data-can-ask-team={canAskTeamAnywhere ? "true" : "false"}
      data-has-pickup-place={hasPickupPlace ? "true" : "false"}
      data-has-create-ride={onCreateRide != null ? "true" : "false"}
      data-has-save-ride-plan={onSaveRidePlan != null ? "true" : "false"}
      data-has-save-kid-plans={onSaveKidPlans != null ? "true" : "false"}
      data-has-cancel-ride={onCancelRide != null ? "true" : "false"}
      data-standing-lock-weekday={standingLockWeekdaySingular ?? ""}
      data-standing-lock-weekdays={standingLockWeekdayPlural ?? ""}
      data-member-coverage-error={memberCoverageError ?? ""}
      className={`overflow-hidden rounded-[var(--fc-radius-xl)] border bg-[var(--fc-surface-raised)] transition-colors ${
        isFocused
          ? "border-[var(--fc-list-row-focus-border)]"
          : "border-[var(--fc-border)]"
      }`}
      style={focusRingStyle}
    >
      <div className="flex min-w-0 items-start justify-between gap-x-[var(--fc-space-lg)] gap-y-[var(--fc-space-sm)] px-[var(--fc-space-list-row-pad-x)] pt-[var(--fc-space-list-row-pad-y)]">
        <button
          type="button"
          className="min-w-0 flex-1 text-left"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          data-testid="agenda-block-header"
        >
          {layout.eyebrow != null ? (
            <span
              data-testid="agenda-block-eyebrow"
              className="block uppercase tracking-wide text-[length:var(--fc-font-list-row-team-size)] leading-[var(--fc-font-list-row-team-line)] font-[number:var(--fc-font-list-row-team-weight)] text-[var(--fc-text-secondary)]"
            >
              {layout.eyebrow}
            </span>
          ) : null}
          <span
            data-testid="agenda-block-title"
            className="block text-[length:var(--fc-font-list-row-title-size)] leading-[var(--fc-font-list-row-title-line)] font-[number:var(--fc-font-list-row-title-weight)] text-[var(--fc-text-primary)]"
          >
            {layout.title}
          </span>
          <span
            data-testid="agenda-block-when"
            className="mt-0.5 block text-[length:var(--fc-font-list-row-meta-size)] leading-[var(--fc-font-list-row-meta-line)] font-[number:var(--fc-font-list-row-meta-weight)] text-[var(--fc-text-secondary)]"
          >
            {layout.whenLabel}
          </span>
          {!open && showLockedSummary ? (
            <span
              data-testid="agenda-block-recurrence"
              className="mt-0.5 block text-[length:var(--fc-font-list-row-meta-size)] leading-[var(--fc-font-list-row-meta-line)] font-[number:var(--fc-font-list-row-meta-weight)] text-[var(--fc-text-secondary)]"
            >
              <span aria-hidden>↻ </span>
              {recurrenceHintLabel(weekdays.singular)}
            </span>
          ) : null}
          {locationLine != null ? (
            <EventLocationLine
              location={locationLine.text}
              variant={locationLine.multiVenue ? "route" : "pin"}
              data-testid="agenda-block-where"
              className="mt-0.5"
              onClick={
                locationLine.multiVenue &&
                onOpenRide != null &&
                sections.toRun != null
                  ? () =>
                      onOpenRide(sections.toRun!.representativeItem, "TO")
                  : undefined
              }
            />
          ) : null}
        </button>
        <span
          data-testid="agenda-block-chip-strip"
          className="flex min-w-0 shrink-0 flex-wrap items-center justify-end gap-[var(--fc-space-list-row-tag-gap)]"
        >
          {layout.planChip != null ? (
            <AgendaStatusChip
              label={layout.planChip.label}
              tone={layout.planChip.tone}
            />
          ) : (
            statusChips.map((tag) => (
              <AgendaStatusChip
                key={tag.label}
                label={tag.label}
                tone={tag.tone}
              />
            ))
          )}
          <button
            type="button"
            data-testid="agenda-block-chevron"
            aria-label={open ? `Collapse ${layout.title}` : `Expand ${layout.title}`}
            className="inline-flex shrink-0 items-center justify-center text-[var(--fc-text-secondary)]"
            style={{
              minWidth: "var(--fc-space-focus-action-min-height)",
              minHeight: "var(--fc-space-focus-action-min-height)",
            }}
            onClick={() => setOpen((value) => !value)}
          >
            <ChevronIcon
              aria-hidden
              style={{
                width: "var(--fc-font-list-row-chevron-size)",
                height: "var(--fc-font-list-row-chevron-size)",
              }}
            />
          </button>
        </span>
      </div>

      {!open && layout.kidRows.length === 0 ? (
        <div className="pb-[var(--fc-space-sm)]" />
      ) : null}
      {!open && layout.kidRows.length > 0 ? (
        <div
          data-testid="agenda-block-kid-rows"
          className="flex flex-col gap-[var(--fc-space-md)] px-[var(--fc-space-list-row-pad-x)] pt-[var(--fc-space-md)] pb-[var(--fc-space-list-row-pad-y)]"
        >
          {layout.kidRows.map((row) => (
            <div
              key={row.key}
              data-testid={`agenda-block-kid-${row.key}`}
              className="flex min-w-0 items-center justify-between gap-[var(--fc-space-md)]"
            >
              <span className="flex min-w-0 items-center gap-[var(--fc-space-sm)]">
                <span
                  aria-hidden
                  className="flex shrink-0 items-center justify-center rounded-full bg-[var(--fc-accent)] text-[var(--fc-accent-on)]"
                  style={{
                    width: "var(--fc-space-list-row-kid-avatar)",
                    height: "var(--fc-space-list-row-kid-avatar)",
                    fontSize: "var(--fc-font-list-row-avatar-label-size)",
                    lineHeight: "var(--fc-font-list-row-avatar-label-line)",
                    fontWeight: "var(--fc-font-list-row-avatar-label-weight)",
                  }}
                >
                  {row.initial}
                </span>
                <span className="min-w-0">
                  <span className="block text-[length:var(--fc-font-list-row-meta-size)] leading-[var(--fc-font-list-row-meta-line)] font-[number:var(--fc-font-list-row-title-weight)] text-[var(--fc-text-primary)]">
                    {row.firstName}
                  </span>
                  <span className="block text-[length:var(--fc-font-list-row-meta-size)] leading-[var(--fc-font-list-row-meta-line)] text-[var(--fc-text-secondary)]">
                    {row.eventLabel} · {row.timeLabel}
                  </span>
                </span>
              </span>
              <span className="shrink-0 text-right text-[length:var(--fc-font-list-row-meta-size)] leading-[var(--fc-font-list-row-meta-line)] text-[var(--fc-text-secondary)]">
                {row.assignmentLine}
              </span>
            </div>
          ))}
        </div>
      ) : null}

      {open ? (
        <div className="flex flex-col gap-[var(--fc-space-md)] border-t border-[var(--fc-border)] px-[var(--fc-space-list-row-pad-x)] py-[var(--fc-space-list-row-pad-y)]">
          <AgendaLegsTable
            testId="agenda-block-legs-table"
            rows={layout.kidRows}
            loading={loading}
            rowTestId={(row) => `agenda-block-kid-plan-${row.key}`}
            legPairTestId={(row) => `agenda-block-legs-${row.key}`}
            toViewRoute={
              toRouteRowKey != null && sections.toRun != null
                ? {
                    rowKey: toRouteRowKey,
                    testId: "agenda-block-run-to-view-route",
                    onClick: () =>
                      onOpenRide?.(sections.toRun!.representativeItem, "TO"),
                  }
                : null
            }
            fromViewRoute={
              fromRouteRowKey != null && sections.fromRun != null
                ? {
                    rowKey: fromRouteRowKey,
                    testId: "agenda-block-run-from-view-route",
                    onClick: () =>
                      onOpenRide?.(sections.fromRun!.representativeItem, "FROM"),
                  }
                : null
            }
          />

          {showLeaveFrom && departureItem != null ? (
            <div data-testid="agenda-block-leave-from">
              <LeaveFromControls
                variant="field-row"
                value={{
                  leaveFromPlaceId: departureItem.leaveFromPlaceId,
                  leaveFromPlaceName: departureItem.leaveFromPlaceName,
                  leaveFromAddress: departureItem.leaveFromAddress,
                }}
                circle={circle}
                loading={loading}
                ariaLabel={leaveFromAriaLabel}
                helperLine={agendaLeaveByLine(departureItem)}
                onChange={(body) => onSetLeaveFrom(departureItem, body)}
                testIdPrefix={`leave-from-block-${calendarItemKey(departureItem)}`}
              />
            </div>
          ) : null}

          {decisionSections.length > 0 ? (
            <div
              data-testid="agenda-block-decision"
              className="flex flex-col gap-[var(--fc-space-md)]"
            >
              {decisionSections.map((section) => {
                if (section.kind === "cancelAsk") {
                  return (
                    <div
                      key={section.key}
                      data-testid={`agenda-block-cancel-ask-${section.ride.id}`}
                      className="flex flex-col gap-[var(--fc-space-sm)]"
                    >
                      <p
                        data-testid={`agenda-block-own-ride-${section.ride.id}`}
                        className="text-xs text-[var(--fc-text-secondary)]"
                      >
                        {ownRideDetailLine(section.ride)}
                      </p>
                      {onCancelRide != null ? (
                        <button
                          type="button"
                          disabled={loading}
                          className={quietLinkClass}
                          data-testid={`agenda-block-cancel-ask-btn-${section.ride.id}`}
                          onClick={() => onCancelRide(section.item, section.ride.id)}
                        >
                          No longer need a ride? Cancel this ask
                        </button>
                      ) : null}
                    </div>
                  )
                }

                const groupCanAsk =
                  onCreateRide != null &&
                  section.memberItems.some(
                    (member) =>
                      canAskTeamForItem == null || canAskTeamForItem(member),
                  )
                const groupError =
                  coverageActionErrorForItem != null
                    ? section.memberItems
                        .map((member) => coverageActionErrorForItem(member))
                        .find((message) => message != null && message.length > 0)
                    : undefined

                return (
                  <div
                    key={section.key}
                    data-testid={`agenda-block-decision-picker-${section.key}`}
                    className="flex flex-col gap-[var(--fc-space-sm)]"
                  >
                    <span
                      data-testid={`agenda-block-decision-title-${section.key}`}
                      className={decisionTitleClass}
                    >
                      {section.title}
                    </span>
                    <DriverPicker
                      members={circle.members}
                      currentAdultId={currentAdultId}
                      selectedAdultId={assignDraft!.adultId}
                      onSelectedAdultChange={(adultId) =>
                        onUpdateAssignDraft!({ adultId })
                      }
                      kidIds={section.kidIds}
                      loading={loading}
                      leaveFromSlot={leaveFromSlotForPicker}
                      leaveFromLabel={originForConfirm}
                      circle={circle}
                      sharedPlaceValue={leaveFromFields}
                      postLabel={section.postLabel}
                      onAssignCoverage={(adultId, kidIds, options) =>
                        fanOutAssignCoverage(
                          section.memberItems,
                          adultId,
                          kidIds,
                          onAssignCoverage!,
                          options,
                        )
                      }
                      onAskTeam={
                        groupCanAsk
                          ? () =>
                              fanOutCreateRide(
                                section.memberItems,
                                section.kidIds,
                                rideEventFor,
                                onCreateRide!,
                              )
                          : undefined
                      }
                      onSaveRidePlan={
                        onSaveRidePlan != null
                          ? (legs, options) =>
                              fanOutSaveRidePlan(
                                section.memberItems,
                                legs,
                                section.kidIds,
                                onSaveRidePlan,
                                options,
                              )
                          : undefined
                      }
                      goingKids={section.goingKids}
                      onSaveKidPlans={
                        onSaveKidPlans != null
                          ? (plans, options) =>
                              fanOutSaveKidPlans(
                                section.memberItems,
                                plans,
                                onSaveKidPlans,
                                options,
                              )
                          : undefined
                      }
                      showTeamSection={groupCanAsk}
                      hasPickupPlace={hasPickupPlace}
                      actionError={groupError}
                      standingLockWeekdaySingular={standingLockWeekdaySingular}
                      standingLockWeekdayPlural={standingLockWeekdayPlural}
                      notGoingThisWeek={isStandingLocked}
                      saveExistingPlan={editingLockedPlan}
                      onSetNotGoing={
                        isStandingLocked && onSetNotGoing != null
                          ? (kidIds) => {
                              for (const member of section.memberItems) {
                                const memberKids = kidIdsForMemberEvent(
                                  member,
                                  kidIds,
                                )
                                if (memberKids.length > 0) {
                                  onSetNotGoing(member, memberKids)
                                }
                              }
                            }
                          : undefined
                      }
                    />
                  </div>
                )
              })}
            </div>
          ) : null}

          {showLockedSummary ? (
            <LockedStandingPlanSummary
              testIdPrefix="agenda-block-standing-locked"
              weekdays={weekdays}
              editing={editingLockedPlan}
              planSummaryLine={null}
              notGoingScope="name"
              loading={loading}
              showCaption={false}
              extraActions={
                onDriveBlockLink != null
                  ? driveBlockControls.map((control) => (
                      <button
                        key={`${control.link.leg}-${control.item.source}-${control.item.id}-${control.link.otherSource}-${control.link.otherId}`}
                        type="button"
                        disabled={loading}
                        className={quietLinkClass}
                        data-testid={`agenda-block-drive-block-link-${control.link.leg}-${control.link.otherId}`}
                        onClick={() => onDriveBlockLink(control.item, control.link)}
                      >
                        {control.link.combined
                          ? splitIntoEventsLabel(items.length)
                          : control.label}
                      </button>
                    ))
                  : null
              }
              onEditPlan={() => setEditingLockedPlan((was) => !was)}
              onRemoveRecurring={
                onRemoveStandingBlock != null && standingChrome.templateId != null
                  ? () => {
                      const fromStartsAt = items.reduce(
                        (earliest, row) =>
                          row.startsAt < earliest ? row.startsAt : earliest,
                        items[0]?.startsAt ?? new Date().toISOString(),
                      )
                      onRemoveStandingBlock(standingChrome.templateId!, fromStartsAt)
                    }
                  : undefined
              }
              notGoingActions={lockedNotGoingActions}
              onNotGoing={
                onSetNotGoing != null
                  ? (kidIds) => {
                      const action = commitmentActions.find(
                        (row) =>
                          row.kind === "not-going" &&
                          row.kidIds.length === kidIds.length &&
                          kidIds.every((id) => row.kidIds.includes(id)),
                      )
                      if (action?.kind === "not-going") {
                        onSetNotGoing(action.item, kidIds)
                      }
                    }
                  : undefined
              }
            />
          ) : null}

          <AgendaQuietActions testId="agenda-block-quiet-actions">
            {visibleCommitmentActions.length > 0 ? (
              <div
                data-testid="agenda-block-commitment-actions"
                className={AGENDA_QUIET_ACTIONS_ROW_CLASS}
              >
                {visibleCommitmentActions.map((action) => (
                  <button
                    key={action.key}
                    type="button"
                    disabled={loading}
                    className={quietLinkClass}
                    data-testid={action.testId}
                    data-action-key={action.key}
                    data-action-kind={action.kind}
                    onClick={() =>
                      runCommitmentAction(action, {
                        onRevertDecidedAssignee,
                        onCantMakeIt,
                        onRemoveCoverage,
                        onSetNotGoing,
                        onWithdrawRide,
                        currentAdultId,
                      })
                    }
                  >
                    {action.label}
                  </button>
                ))}
              </div>
            ) : null}

            {onDriveBlockLink != null &&
            driveBlockControls.length > 0 &&
            !showLockedSummary ? (
              <div
                data-testid="agenda-block-drive-block-links"
                className="flex flex-col gap-[var(--fc-space-sm)]"
              >
                {driveBlockControls.map((control) => (
                  <button
                    key={`${control.link.leg}-${control.item.source}-${control.item.id}-${control.link.otherSource}-${control.link.otherId}`}
                    type="button"
                    disabled={loading}
                    className={quietLinkClass}
                    data-testid={`agenda-block-drive-block-link-${control.link.leg}-${control.link.otherId}`}
                    onClick={() => onDriveBlockLink(control.item, control.link)}
                  >
                    {control.link.combined
                      ? splitIntoEventsLabel(items.length)
                      : control.label}
                  </button>
                ))}
              </div>
            ) : null}
          </AgendaQuietActions>

          {actionError != null && actionError.length > 0 ? (
            <p
              role="alert"
              data-testid="agenda-block-action-error"
              className="text-sm text-[var(--fc-danger)]"
            >
              {actionError}
            </p>
          ) : null}

          {showLockedSummary ? (
            <p
              data-testid="agenda-block-standing-locked-caption"
              className="text-[length:var(--fc-font-list-row-meta-size)] leading-[var(--fc-font-list-row-meta-line)] text-[var(--fc-text-secondary)]"
            >
              {lockedPlanScopeCaption(weekdays.plural)}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
