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
  agendaCommitmentActionsForItems,
  blockDepartureItem,
  type AgendaCommitmentAction,
} from "@/components/agendaCommitmentActions"
import { AgendaStatusChip } from "@/components/agendaStatusChip"
import { canRoute } from "@/components/canRoute"
import { activeCoverages, calendarItemKey } from "@/components/coverageDisplay"
import {
  isPendingHouseholdConfirm,
  mapCalendarItemToCoverageGames,
  type CoverageGameEvent,
} from "@/components/coverageQueue"
import { AgendaLegPair } from "@/components/AgendaLegPair"
import { buildCombinedEventLayout } from "@/components/combinedEventLayout"
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
  rideStatusChipsForItem,
  type RideStatusChipDescriptor,
} from "@/components/rideStatusChip"
import {
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
}: AgendaBlockCardProps) {
  const [open, setOpen] = useState(false)
  const [editingLockedPlan, setEditingLockedPlan] = useState(false)
  const locationLabel = sharedLocation(items)
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
  const splitLinkClass =
    "text-[length:var(--fc-font-list-row-meta-size)] leading-[var(--fc-font-list-row-meta-line)] text-[var(--fc-text-secondary)] disabled:cursor-not-allowed disabled:opacity-50 text-left"
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
          {locationLabel != null ? (
            <EventLocationLine
              location={locationLabel}
              data-testid="agenda-block-where"
              className="mt-0.5"
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
        <ul
          data-testid="agenda-block-kid-rows"
          className="flex flex-col gap-[var(--fc-space-md)] px-[var(--fc-space-list-row-pad-x)] pt-[var(--fc-space-md)] pb-[var(--fc-space-list-row-pad-y)]"
        >
          {layout.kidRows.map((row) => (
            <li
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
            </li>
          ))}
        </ul>
      ) : null}

      {open ? (
        <div className="flex flex-col gap-[var(--fc-space-md)] border-t border-[var(--fc-border)] px-[var(--fc-space-list-row-pad-x)] py-[var(--fc-space-list-row-pad-y)]">
          {layout.kidRows.map((row) => (
            <div
              key={row.key}
              data-testid={`agenda-block-kid-plan-${row.key}`}
              className="flex flex-col gap-[var(--fc-space-sm)]"
            >
              <div className="flex min-w-0 items-center gap-[var(--fc-space-sm)]">
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
              </div>
              <AgendaLegPair
                testId={`agenda-block-legs-${row.key}`}
                thereDetail={row.there.detail}
                backDetail={row.back.detail}
                thereAction={
                  row.key === toRouteRowKey ? (
                    <button
                      type="button"
                      disabled={loading}
                      data-testid="agenda-block-run-to-view-route"
                      className="mt-[var(--fc-space-sm)] text-xs underline underline-offset-2 text-[var(--fc-text-secondary)] disabled:cursor-not-allowed disabled:opacity-50 text-left"
                      onClick={() =>
                        onOpenRide?.(sections.toRun!.representativeItem, "TO")
                      }
                    >
                      View route
                    </button>
                  ) : undefined
                }
                backAction={
                  row.key === fromRouteRowKey ? (
                    <button
                      type="button"
                      disabled={loading}
                      data-testid="agenda-block-run-from-view-route"
                      className="mt-[var(--fc-space-sm)] text-xs underline underline-offset-2 text-[var(--fc-text-secondary)] disabled:cursor-not-allowed disabled:opacity-50 text-left"
                      onClick={() =>
                        onOpenRide?.(sections.fromRun!.representativeItem, "FROM")
                      }
                    >
                      View route
                    </button>
                  ) : undefined
                }
              />
            </div>
          ))}

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

          {showLockedSummary ? (
            <LockedStandingPlanSummary
              testIdPrefix="agenda-block-standing-locked"
              weekdays={weekdays}
              editing={editingLockedPlan}
              planSummaryLine={null}
              notGoingScope="name"
              loading={loading}
              extraActions={
                onDriveBlockLink != null
                  ? driveBlockControls.map((control) => (
                      <button
                        key={`${control.link.leg}-${control.item.source}-${control.item.id}-${control.link.otherSource}-${control.link.otherId}`}
                        type="button"
                        disabled={loading}
                        className={splitLinkClass}
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
                  className={splitLinkClass}
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
        </div>
      ) : null}
    </div>
  )
}
