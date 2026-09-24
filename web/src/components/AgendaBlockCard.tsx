import { useState } from "react"

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
  agendaCommitmentActionsForItems,
  blockDepartureItem,
  type AgendaCommitmentAction,
} from "@/components/agendaCommitmentActions"
import { canRoute } from "@/components/canRoute"
import { activeCoverages, calendarItemKey } from "@/components/coverageDisplay"
import {
  isPendingHouseholdConfirm,
  mapCalendarItemToCoverageGames,
  type CoverageGameEvent,
} from "@/components/coverageQueue"
import {
  agendaBlockDriveBlockControls,
} from "@/components/driveBlockAgendaLinks"
import { EventLocationLine } from "@/components/EventLocationLine"
import { formatAgendaBlockDayLabel } from "@/components/eventTimes"
import { heroKidFirstName } from "@/components/heroAttentionCopy"
import { agendaLeaveByLine } from "@/components/leaveByDisplay"
import { LeaveFromControls } from "@/components/LeaveFromControls"
import { LockedStandingPlanSummary } from "@/components/LockedStandingPlanSummary"
import {
  standingBlockChrome,
  standingWeekdayNames,
} from "@/components/standingBlockChrome"
import type { DecidedAssignee } from "@/components/transportPlan"

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
  /** Viewer "now" for Today / Tomorrow / weekday day labels. */
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

function sharedLocation(items: CalendarItem[]): string | null {
  const locations = items
    .map((item) => item.location?.trim() || null)
    .filter((value): value is string => value != null)
  if (locations.length === 0) {
    return null
  }
  const first = locations[0]!
  return locations.every((value) => value === first) ? first : first
}

function sharedFeedName(items: CalendarItem[]): string | null {
  const names = items
    .map((item) => item.feedName?.trim() || null)
    .filter((value): value is string => value != null && value.length > 0)
  if (names.length === 0) {
    return null
  }
  const first = names[0]!
  return names.every((value) => value === first) ? first : null
}

function blockTitle(items: CalendarItem[]): string {
  const n = items.length
  if (n === 2) {
    return "Two events tonight"
  }
  return `${n} events tonight`
}

function RunSection({
  run,
  testId,
  showViewRoute,
  loading,
  onViewRoute,
}: {
  run: AgendaBlockRunSection
  testId: string
  showViewRoute: boolean
  loading: boolean
  onViewRoute?: () => void
}) {
  const [detailOpen, setDetailOpen] = useState(false)
  const hasDetail = run.detailLines.length > 0

  return (
    <div
      data-testid={testId}
      className="rounded-[var(--fc-radius-lg)] border border-[var(--fc-border)] px-[var(--fc-space-md)] py-[var(--fc-space-md)]"
    >
      <div className="flex flex-wrap items-start justify-between gap-x-[var(--fc-space-md)] gap-y-[var(--fc-space-sm)]">
        <span
          data-testid={`${testId}-heading`}
          className="text-[length:var(--fc-font-list-row-meta-size)] leading-[var(--fc-font-list-row-meta-line)] font-[number:var(--fc-font-list-row-title-weight)] text-[var(--fc-text-primary)]"
        >
          {run.heading}
        </span>
        <span
          data-testid={`${testId}-chip`}
          className="rounded-full px-[var(--fc-space-feed-chip-pad-x)] py-[var(--fc-space-feed-chip-pad-y)] text-[length:var(--fc-font-feed-chip-size)] uppercase leading-[var(--fc-font-feed-chip-line)] font-[number:var(--fc-font-feed-chip-weight)] text-[var(--fc-success)] bg-[color-mix(in_srgb,var(--fc-success)_14%,transparent)]"
        >
          {run.chipLabel}
        </span>
      </div>
      {run.summaryLine != null ? (
        <p
          data-testid={`${testId}-summary`}
          className="mt-[var(--fc-space-sm)] text-[length:var(--fc-font-list-row-meta-size)] leading-[var(--fc-font-list-row-meta-line)] text-[var(--fc-text-secondary)]"
        >
          {run.summaryLine}
        </p>
      ) : null}
      {showViewRoute ? (
        <button
          type="button"
          disabled={loading}
          data-testid={`${testId}-view-route`}
          className="mt-[var(--fc-space-sm)] text-xs underline underline-offset-2 text-[var(--fc-text-secondary)] disabled:cursor-not-allowed disabled:opacity-50 text-left"
          onClick={onViewRoute}
        >
          View route
        </button>
      ) : null}
      {hasDetail ? (
        <div className="mt-[var(--fc-space-sm)]">
          <button
            type="button"
            className="text-xs underline underline-offset-2 text-[var(--fc-text-secondary)]"
            aria-expanded={detailOpen}
            data-testid={`${testId}-detail-toggle`}
            onClick={() => setDetailOpen((open) => !open)}
          >
            {detailOpen ? "Hide details" : "Show details"}
          </button>
          {detailOpen ? (
            <ul
              data-testid={`${testId}-detail`}
              className="mt-[var(--fc-space-sm)] flex flex-col gap-[var(--fc-space-xs)] text-[length:var(--fc-font-list-row-meta-size)] text-[var(--fc-text-secondary)]"
            >
              {run.detailLines.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </div>
  )
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

function blockLockedPlanSummaryLine(sections: {
  roundTripBanner: string | null
  toRun: AgendaBlockRunSection | null
  fromRun: AgendaBlockRunSection | null
}): string | null {
  if (sections.roundTripBanner != null && sections.roundTripBanner.length > 0) {
    return sections.roundTripBanner
  }
  const parts = [sections.toRun?.summaryLine, sections.fromRun?.summaryLine].filter(
    (line): line is string => line != null && line.length > 0,
  )
  return parts.length > 0 ? parts.join(" · ") : null
}

/**
 * Multi-item Agenda driving-block card: drop-off / event bands / muted other
 * jobs / pickup (mockup order). Combine/split + commitment actions + hang
 * departure leave-from live here (same surfaces as AgendaRow, block-scoped).
 */
export function AgendaBlockCard({
  items,
  circle,
  currentAdultId,
  rideEventFor,
  isFocused = false,
  loading = false,
  actionError,
  now = new Date(),
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
}: AgendaBlockCardProps) {
  const [editingLockedPlan, setEditingLockedPlan] = useState(false)
  const locationLabel = sharedLocation(items)
  const teamLabel = sharedFeedName(items)
  const dayLabel =
    items[0] != null ? formatAgendaBlockDayLabel(items[0].startsAt, now) : null
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
  const isStandingLocked = standingChrome.showRemove
  const settledLockedView = isStandingLocked && !editingLockedPlan
  const showLockedSummary = isStandingLocked
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
  const showLeaveFrom =
    onSetLeaveFrom != null &&
    departureItem != null &&
    sections.toRun != null &&
    !settledLockedView
  const overrideLinkClass =
    "text-xs underline underline-offset-2 text-[var(--fc-text-secondary)] disabled:cursor-not-allowed disabled:opacity-50 text-left"
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
  // Avoid unused-prop lint when Lock is confirm-time only (DriverPicker / Focus).
  void _onLockStandingBlock

  return (
    <div
      data-testid="agenda-block-card"
      data-member-keys={items.map(calendarItemKey).join(",")}
      data-focused={isFocused ? "true" : "false"}
      className={`overflow-hidden rounded-[var(--fc-radius-xl)] border bg-[var(--fc-surface-raised)] transition-colors ${
        isFocused
          ? "border-[var(--fc-list-row-focus-border)]"
          : "border-[var(--fc-border)]"
      }`}
      style={focusRingStyle}
    >
      <div className="flex flex-col gap-[var(--fc-space-md)] px-[var(--fc-space-list-row-pad-x)] py-[var(--fc-space-list-row-pad-y)]">
        <header className="min-w-0">
          {dayLabel != null ? (
            <span
              data-testid="agenda-block-day"
              className="block uppercase tracking-wide text-[length:var(--fc-font-list-row-team-size)] leading-[var(--fc-font-list-row-team-line)] font-[number:var(--fc-font-list-row-team-weight)] text-[var(--fc-text-secondary)]"
            >
              {teamLabel != null ? `${dayLabel} · ${teamLabel}` : dayLabel}
            </span>
          ) : teamLabel != null ? (
            <span
              data-testid="agenda-block-team"
              className="block uppercase tracking-wide text-[length:var(--fc-font-list-row-team-size)] leading-[var(--fc-font-list-row-team-line)] font-[number:var(--fc-font-list-row-team-weight)] text-[var(--fc-text-secondary)]"
            >
              {teamLabel}
            </span>
          ) : null}
          <span
            data-testid="agenda-block-title"
            className="block text-[length:var(--fc-font-list-row-title-size)] leading-[var(--fc-font-list-row-title-line)] font-[number:var(--fc-font-list-row-title-weight)] text-[var(--fc-text-primary)]"
          >
            {blockTitle(items)}
          </span>
          {locationLabel != null ? (
            <EventLocationLine
              location={locationLabel}
              data-testid="agenda-block-where"
              className="mt-0.5"
            />
          ) : null}
        </header>

        {sections.roundTripBanner != null && !settledLockedView ? (
          <p
            data-testid="agenda-block-round-trip-banner"
            className="rounded-[var(--fc-radius-lg)] bg-[color-mix(in_srgb,var(--fc-success)_14%,transparent)] px-[var(--fc-space-md)] py-[var(--fc-space-sm)] text-[length:var(--fc-font-list-row-meta-size)] leading-[var(--fc-font-list-row-meta-line)] text-[var(--fc-success)]"
          >
            {sections.roundTripBanner}
          </p>
        ) : null}

        {sections.toRun != null ? (
          <RunSection
            run={sections.toRun}
            testId="agenda-block-run-to"
            showViewRoute={toRoutable}
            loading={loading}
            onViewRoute={
              toRoutable
                ? () => onOpenRide?.(sections.toRun!.representativeItem, "TO")
                : undefined
            }
          />
        ) : null}

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
              ariaLabel={`Leave from for ${blockTitle(items)}`}
              helperLine={agendaLeaveByLine(departureItem)}
              onChange={(body) => onSetLeaveFrom(departureItem, body)}
              testIdPrefix={`leave-from-block-${calendarItemKey(departureItem)}`}
            />
          </div>
        ) : null}

        {sections.eventBands.length > 0 ? (
          <ul
            data-testid="agenda-block-event-bands"
            className="flex flex-col gap-[var(--fc-space-xs)] px-[var(--fc-space-xs)]"
          >
            {sections.eventBands.map((band) => (
              <li
                key={band.itemKey}
                data-testid={`agenda-block-event-band-${band.itemKey}`}
                className="text-[length:var(--fc-font-list-row-meta-size)] leading-[var(--fc-font-list-row-meta-line)] text-[var(--fc-text-secondary)]"
              >
                {band.line}
              </li>
            ))}
          </ul>
        ) : null}

        {sections.mutedBand != null ? (
          <div
            data-testid="agenda-block-muted-band"
            className="rounded-[var(--fc-radius-lg)] bg-[var(--fc-surface)] px-[var(--fc-space-md)] py-[var(--fc-space-md)]"
          >
            <div
              data-testid="agenda-block-muted-heading"
              className="text-[length:var(--fc-font-list-row-meta-size)] leading-[var(--fc-font-list-row-meta-line)] font-[number:var(--fc-font-list-row-title-weight)] text-[var(--fc-text-secondary)]"
            >
              {sections.mutedBand.heading}
            </div>
            <ul
              data-testid="agenda-block-muted-lines"
              className="mt-[var(--fc-space-sm)] flex flex-col gap-[var(--fc-space-xs)]"
            >
              {sections.mutedBand.lines.map((line) => (
                <li
                  key={line}
                  className="text-[length:var(--fc-font-list-row-meta-size)] leading-[var(--fc-font-list-row-meta-line)] text-[var(--fc-text-secondary)]"
                >
                  {line}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {sections.fromRun != null ? (
          <RunSection
            run={sections.fromRun}
            testId="agenda-block-run-from"
            showViewRoute={fromRoutable}
            loading={loading}
            onViewRoute={
              fromRoutable
                ? () => onOpenRide?.(sections.fromRun!.representativeItem, "FROM")
                : undefined
            }
          />
        ) : null}

        {showLockedSummary ? (
          <LockedStandingPlanSummary
            testIdPrefix="agenda-block-standing-locked"
            weekdays={weekdays}
            editing={editingLockedPlan}
            planSummaryLine={blockLockedPlanSummaryLine(sections)}
            loading={loading}
            onEditPlan={() => setEditingLockedPlan((open) => !open)}
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
            actionError={actionError}
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

        {visibleCommitmentActions.length > 0 ? (
          <div
            data-testid="agenda-block-commitment-actions"
            className="flex flex-wrap items-center gap-x-[var(--fc-space-lg)] gap-y-[var(--fc-space-sm)]"
          >
            {visibleCommitmentActions.map((action) => (
              <button
                key={action.key}
                type="button"
                disabled={loading}
                className={overrideLinkClass}
                data-testid={action.testId}
                data-action-key={action.key}
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

        {onDriveBlockLink != null && driveBlockControls.length > 0 ? (
          <div
            data-testid="agenda-block-drive-block-links"
            className="flex flex-col gap-[var(--fc-space-sm)]"
          >
            {driveBlockControls.map((control) => (
              <button
                key={`${control.link.leg}-${control.item.source}-${control.item.id}-${control.link.otherSource}-${control.link.otherId}`}
                type="button"
                disabled={loading}
                className={overrideLinkClass}
                data-testid={`agenda-block-drive-block-link-${control.link.leg}-${control.link.otherId}`}
                onClick={() => onDriveBlockLink(control.item, control.link)}
              >
                {control.label}
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  )
}
