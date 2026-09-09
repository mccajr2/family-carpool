import { useState } from "react"
import { ChevronDown, ChevronRight, ChevronUp, Navigation } from "lucide-react"
import type {
  CalendarItem,
  CarpoolLeg,
  CarpoolRideEvent,
  FamilyCircle,
  Garage,
  RsvpStatus,
  SetCalendarLeaveFromRequest,
} from "@/api/types"
import { AgendaInboundRequestRow } from "@/components/AgendaInboundRequestRow"
import { AgendaStatusChip } from "@/components/agendaStatusChip"
import { AttendanceToggle, rsvpWriteForAttendanceAction } from "@/components/AttendanceToggle"
import { Button } from "@/components/ui/button"
import { formatCompactEventWhen } from "@/components/eventTimes"
import { EventLocationLine } from "@/components/EventLocationLine"
import { agendaLeaveByLine } from "@/components/leaveByDisplay"
import { LeaveFromControls } from "@/components/LeaveFromControls"
import {
  coverageLeaveByLine,
  resolvedLeaveFromLabel,
} from "@/components/leaveFromDisplay"
import { conflictDisplayLines } from "@/components/conflictDisplay"
import { kidDisplayName, ownRideDetailLine } from "@/components/carpoolDisplay"
import {
  canRoute,
  isHouseholdConfirmedDriver,
  isTeammateOwnRide,
} from "@/components/canRoute"
import {
  DEFAULT_RIDE_NEEDED_LEGS,
  defaultKidsNeedingCarpoolRequest,
  type RideNeededLegsChoice,
} from "@/components/rideNeededLegs"
import { RideNeededLegsControl } from "@/components/RideNeededLegsControl"
import {
  applyAutoDeclinedViewModel,
  isConfirmedDriver,
  isPendingHouseholdConfirm,
  isUnassigned,
  mapCalendarItemToCoverageGames,
  type CoverageGameEvent,
} from "@/components/coverageQueue"
import { DriverPicker } from "@/components/DriverPicker"
import { revertOwnRideLabel } from "@/components/revertRideCopy"
import {
  activeCoverageForAdult,
  activeCoverages,
  calendarSourceLabel,
  coverageAdultLabel,
  eventKidNames,
  pendingCoverageForAdult,
  remainingCoverageGapKidIds,
} from "@/components/coverageDisplay"
import {
  CONFIRM_COVERAGE,
  DECLINE_COVERAGE,
  cancelRequestToDriverLabel,
  markAsNotGoingLabel,
  needsCoverageWithKids,
} from "@/components/coverageCopy"
import {
  carpoolAskChipForRideEvent,
  rideStatusChipsForItem,
} from "@/components/rideStatusChip"
import {
  rideCommitmentConflict,
  rideCommitmentConflictLine,
} from "@/components/rideCommitmentConflict"
import { ridersForItem } from "@/components/riderChips"
import { RiderChips } from "@/components/RiderChipsView"
import { isAgendaItemOutOfPlay } from "@/components/rsvpDisplay"

/** Team/feed label for GameCard header — omit for manual events without a feed name. */
function agendaRowTeamLabel(item: CalendarItem): string | null {
  const feedName = item.feedName?.trim()
  if (feedName) {
    return feedName
  }
  if (item.source === "FEED") {
    return calendarSourceLabel(item.source, item.feedName)
  }
  return null
}

/**
 * Unassigned gaps get DriverPicker. Open team ask ("requested") also gets
 * DriverPicker — Assign cancels the ask (auto-decline-unofferable). Not-going
 * kids hide driver/coverage chrome via showKidChrome but keep AttendanceToggle
 * (ADR-0003). Pending confirm-for-self keeps Confirm/Decline.
 */
function showDriverPickerForKid(game: CoverageGameEvent): boolean {
  return isUnassigned(game.ownRide) || game.ownRide === "requested"
}

type AssignDraft = { adultId: string; kidIds: string[]; soleAdult: boolean; soleKid: boolean }

type AgendaRowProps = {
  item: CalendarItem
  isFocused?: boolean
  circle: FamilyCircle
  currentAdultId: string
  loading: boolean
  assignDraft: AssignDraft
  coverageActionError?: string
  rideEvent?: CarpoolRideEvent | null
  garage?: Garage | null
  heroQueuedRequestIds?: ReadonlySet<string>
  recentlyWithdrawnRideIds?: ReadonlySet<string>
  /** Session-local auto-decline ids — inbound chip + Reconsider until Accept. */
  autoDeclinedRideIds?: ReadonlySet<string>
  onCreateRide?: (eventKey: string, kidIds?: string[], legs?: CarpoolLeg) => void
  onCancelRide?: (rideId: string) => void
  onWithdrawRide?: (rideId: string) => void
  onAcceptRide?: (rideId: string, vehicleId: string) => void
  onPassRide?: (rideId: string) => void
  /** Own-ride revert; when omitted, maps to onRemoveCoverage / onCancelRide. */
  onCantMakeIt?: (game: CoverageGameEvent) => void
  onUpdateAssignDraft: (patch: Partial<{ adultId: string; kidIds: string[] }>) => void
  onAssignCoverage: (adultId: string, kidIds: string[]) => void
  onConfirmCoverage: (assignmentId: string) => void
  onDeclineCoverage: (assignmentId: string) => void
  onRemoveCoverage: (assignmentId: string) => void
  onSetLeaveFrom: (body: SetCalendarLeaveFromRequest) => void
  onSetCoverageLeaveFrom: (
    assignmentId: string,
    body: SetCalendarLeaveFromRequest,
  ) => void
  onSetRsvp: (kidId: string, status: RsvpStatus) => void
  onOpenPlaces: () => void
  /** Opens ride-detail overlay when `canRoute` for at least one in-play kid. */
  onOpenRide?: () => void
  onEdit: () => void
  onRemoveEvent: () => void
}

/**
 * Flat Agenda GameCard row: collapsed by default with mock hierarchy
 * (team/feed label, title, Clock when, MapPin where, chips + chevron),
 * tap to expand field bands. Out-of-play items render muted.
 *
 * Title and meta wrap — do not add `truncate` / `whitespace-nowrap`. Ellipsis
 * here sets the page-frame grid item's min-content to ~820px, so Calendar's
 * `1fr` column cannot shrink with the window.
 *
 * NOTE: a "N stops" carpool tag was part of the original mockup but is not
 * included here — CalendarItem has no per-event stop/pickup-order field in
 * the current data model (see api/types). Do not fabricate one; this needs
 * a real backend field before it can render. Tracked as a data-model
 * dependency for the Carpool destination redesign, not implemented here.
 */
export function AgendaRow({
  item,
  isFocused = false,
  circle,
  currentAdultId,
  loading,
  assignDraft,
  coverageActionError,
  rideEvent = null,
  garage = null,
  heroQueuedRequestIds,
  recentlyWithdrawnRideIds,
  autoDeclinedRideIds,
  onCreateRide,
  onCancelRide,
  onWithdrawRide,
  onAcceptRide,
  onPassRide,
  onCantMakeIt,
  onUpdateAssignDraft,
  onAssignCoverage,
  onConfirmCoverage,
  onDeclineCoverage,
  onRemoveCoverage,
  onSetLeaveFrom,
  onSetCoverageLeaveFrom,
  onSetRsvp,
  onOpenPlaces,
  onOpenRide,
  onEdit,
  onRemoveEvent,
}: AgendaRowProps) {
  const [open, setOpen] = useState(false)
  const [selectedRideKidIds, setSelectedRideKidIds] = useState<string[] | null>(null)
  const [rideNeededLegs, setRideNeededLegs] =
    useState<RideNeededLegsChoice>(DEFAULT_RIDE_NEEDED_LEGS)
  const isManual = item.source === "MANUAL"
  const outOfPlay = isAgendaItemOutOfPlay(item)
  const active = activeCoverages(item)
  const pendingForSelf = pendingCoverageForAdult(item, currentAdultId)
  const selfCoverage = activeCoverageForAdult(item, currentAdultId)
  const conflictLines = conflictDisplayLines(item.conflicts, circle.kids)
  // Gap clearing uses per-kid FULLY_COVERED ownRequests; Cancel/Withdraw per-Ride
  // and chip copy land in later tasks.
  const ownRequests = rideEvent?.ownRequests ?? null
  const ownRequest =
    ownRequests?.find((request) => request.status === "UNCOVERED" || request.status === "PARTIAL") ??
    ownRequests?.[0] ??
    null
  const { games: coverageGames } = applyAutoDeclinedViewModel(
    mapCalendarItemToCoverageGames(item, rideEvent, {
      currentAdultId,
      members: circle.members,
    }),
    autoDeclinedRideIds ?? new Set(),
  )
  const gapKidIds = remainingCoverageGapKidIds(item.uncoveredKidIds, ownRequests)
  // Gap copy only for true unassigned kids — team ask / teammate ride use chips + revert.
  const unassignedGapKidIds = gapKidIds.filter((kidId) => {
    const game = coverageGames.find((row) => row.kidId === kidId)
    return game == null || isUnassigned(game.ownRide)
  })
  // Assign is available for unassigned gaps, PARTIAL needs, and open team asks.
  const assignableGapKidIds = gapKidIds.filter((kidId) => {
    const game = coverageGames.find((row) => row.kidId === kidId)
    return (
      game == null ||
      isUnassigned(game.ownRide) ||
      game.ownRide === "requested" ||
      game.ownRide === "partial"
    )
  })
  const uncoveredKidNames = eventKidNames(unassignedGapKidIds, circle.kids)
  const kidsNeedingAsk =
    rideEvent != null ? defaultKidsNeedingCarpoolRequest(rideEvent) : []
  const canAskTeam =
    rideEvent != null && kidsNeedingAsk.length > 0 && onCreateRide != null
  const showAssign =
    !outOfPlay &&
    !pendingForSelf &&
    assignableGapKidIds.length > 0 &&
    circle.members.length > 0
  const showRequestInCarpool = canAskTeam && !showAssign
  const inPlayGames = coverageGames.filter((game) => game.attendance !== "not_going")
  const canOffer = inPlayGames.some((game) => isHouseholdConfirmedDriver(game, rideEvent))
  // Entry only when gate passes and a handler exists — never a dead-end control.
  const routable =
    onOpenRide != null && coverageGames.some((game) => canRoute(game, rideEvent))
  const askChip = carpoolAskChipForRideEvent(coverageGames)
  const itemRiders = ridersForItem(coverageGames, null, circle.kids)
  const rideChips = rideStatusChipsForItem(item, coverageGames, null, {
    rideEvent,
    circleId: circle.id,
  })
  const tags = askChip != null ? [...rideChips, askChip] : rideChips
  const commitmentConflict = rideCommitmentConflict(
    rideEvent,
    item,
    coverageGames,
    circle.id,
    circle.kids,
  )
  const commitmentConflictLine =
    commitmentConflict != null
      ? rideCommitmentConflictLine(commitmentConflict)
      : null
  const teamLabel = agendaRowTeamLabel(item)
  const whenLabel = formatCompactEventWhen(item.startsAt, item.endsAt)
  const locationLabel = item.location?.trim() || null
  const defaultRideKids = kidsNeedingAsk
  const rideKidSelection = selectedRideKidIds ?? defaultRideKids
  // Own Request in the carpool band when not yet asked; inbound asks use AgendaInboundRequestRow.
  const showCarpoolBand =
    !outOfPlay &&
    rideEvent != null &&
    showRequestInCarpool &&
    defaultRideKids.length > 0 &&
    onCreateRide != null
  const confirmedGames = inPlayGames.filter((game) => isConfirmedDriver(game.ownRide))
  const waitingOnOtherGames = inPlayGames.filter(
    (game) =>
      isPendingHouseholdConfirm(game.ownRide) && game.ownRide.driver !== "You",
  )
  const showOverrideLinks =
    !outOfPlay && (confirmedGames.length > 0 || waitingOnOtherGames.length > 0)
  /** Leave-from lives inside DriverPicker on Ride Needed — suppress travel duplicate. */
  const leaveFromInPicker = showAssign && active.length === 0
  const firstPickerKidId =
    coverageGames.find(
      (game) =>
        !outOfPlay &&
        game.attendance !== "not_going" &&
        showAssign &&
        showDriverPickerForKid(game),
    )?.kidId ?? null

  const itemLeaveFromFields = {
    leaveFromPlaceId: item.leaveFromPlaceId,
    leaveFromPlaceName: item.leaveFromPlaceName,
    leaveFromAddress: item.leaveFromAddress,
  }
  const itemLeaveFromLabel = resolvedLeaveFromLabel(itemLeaveFromFields, circle)

  const ChevronIcon = open ? ChevronUp : ChevronDown
  const focusRingStyle = isFocused
    ? {
        borderColor: "var(--fc-list-row-focus-border)",
        boxShadow:
          "0 0 0 var(--fc-space-list-row-focus-halo-spread) var(--fc-list-row-focus-halo)",
      }
    : undefined

  function handleCantMakeIt(game: CoverageGameEvent) {
    if (onCantMakeIt != null) {
      onCantMakeIt(game)
      return
    }
    if (game.ownRide === "requested" && ownRequest != null) {
      onCancelRide?.(ownRequest.id)
      return
    }
    if (isConfirmedDriver(game.ownRide)) {
      if (isTeammateOwnRide(game, rideEvent) && ownRequest != null) {
        onCancelRide?.(ownRequest.id)
        return
      }
      const coverage = active.find(
        (row) => row.status === "CONFIRMED" && row.kidIds.includes(game.kidId),
      )
      if (coverage != null) {
        onRemoveCoverage(coverage.id)
      }
      return
    }
    if (isPendingHouseholdConfirm(game.ownRide) && game.ownRide.driver !== "You") {
      const coverage = active.find(
        (row) =>
          row.status === "PENDING" &&
          row.kidIds.includes(game.kidId) &&
          row.coveringAdultId !== currentAdultId,
      )
      if (coverage != null) {
        onRemoveCoverage(coverage.id)
      }
    }
  }

  function cancelPendingRequestForGame(game: CoverageGameEvent) {
    if (!isPendingHouseholdConfirm(game.ownRide) || game.ownRide.driver === "You") {
      return
    }
    const coverage = active.find(
      (row) =>
        row.status === "PENDING" &&
        row.kidIds.includes(game.kidId) &&
        row.coveringAdultId !== currentAdultId,
    )
    if (coverage != null) {
      onRemoveCoverage(coverage.id)
    }
  }

  const overrideLinkClass =
    "text-xs underline underline-offset-2 text-[var(--fc-text-secondary)] disabled:cursor-not-allowed disabled:opacity-50"

  const leaveFromSlotForPicker = (
    <LeaveFromControls
      variant="field-row"
      value={itemLeaveFromFields}
      circle={circle}
      loading={loading}
      ariaLabel={`Leave from for ${item.title}`}
      helperLine={agendaLeaveByLine(item)}
      onChange={onSetLeaveFrom}
      testIdPrefix={`leave-from-${item.source}-${item.id}`}
    />
  )

  return (
    <div
      data-testid={`agenda-row-${item.source}-${item.id}`}
      data-focused={isFocused ? "true" : "false"}
      data-out-of-play={outOfPlay ? "true" : "false"}
      className={`overflow-hidden rounded-[var(--fc-radius-xl)] border bg-[var(--fc-surface-raised)] transition-colors ${
        isFocused
          ? "border-[var(--fc-list-row-focus-border)]"
          : "border-[var(--fc-border)]"
      } ${outOfPlay ? "opacity-60" : ""}`}
      style={focusRingStyle}
    >
      <div data-testid="agenda-band-primary">
      <button
        type="button"
        className="flex min-w-0 w-full flex-wrap items-start justify-between gap-x-[var(--fc-space-lg)] gap-y-[var(--fc-space-sm)] px-[var(--fc-space-list-row-pad-x)] pt-[var(--fc-space-list-row-pad-y)] pb-[var(--fc-space-sm)] text-left"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span className="min-w-0 flex-1">
          {teamLabel != null ? (
            <span
              data-testid="agenda-row-team"
              className="block uppercase tracking-wide text-[length:var(--fc-font-list-row-team-size)] leading-[var(--fc-font-list-row-team-line)] font-[number:var(--fc-font-list-row-team-weight)] text-[var(--fc-text-secondary)]"
            >
              {teamLabel}
            </span>
          ) : null}
          <span
            data-testid="agenda-row-title"
            className={`block text-[length:var(--fc-font-list-row-title-size)] leading-[var(--fc-font-list-row-title-line)] font-[number:var(--fc-font-list-row-title-weight)] ${
              outOfPlay ? "text-[var(--fc-text-secondary)]" : "text-[var(--fc-text-primary)]"
            }`}
          >
            {item.title}
          </span>
          <span
            data-testid="agenda-row-when"
            className="mt-0.5 block text-[length:var(--fc-font-list-row-meta-size)] leading-[var(--fc-font-list-row-meta-line)] font-[number:var(--fc-font-list-row-meta-weight)] text-[var(--fc-text-secondary)]"
          >
            {whenLabel}
          </span>
          <EventLocationLine
            location={locationLabel}
            data-testid="agenda-row-where"
            className="mt-0.5"
          />
        </span>
        <span
          data-testid="agenda-row-chip-strip"
          className="flex min-w-0 flex-wrap items-center justify-end gap-[var(--fc-space-list-row-tag-gap)] max-[390px]:w-full max-[390px]:max-w-none max-[390px]:justify-start min-[391px]:max-w-[50%] min-[391px]:shrink-0"
        >
          {tags.map((tag) => (
            <AgendaStatusChip
              key={tag.label}
              label={tag.label}
              tone={tag.tone}
            />
          ))}
          {routable ? (
            <span
              role="button"
              tabIndex={0}
              data-testid="agenda-row-open-ride"
              title="Route for this ride"
              aria-label="Route for this ride"
              className="inline-flex rounded-full p-[var(--fc-space-ride-detail-open-ride-pad)] text-[var(--fc-accent)] bg-[color-mix(in_srgb,var(--fc-accent)_16%,transparent)]"
              onClick={(event) => {
                event.stopPropagation()
                onOpenRide?.()
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault()
                  event.stopPropagation()
                  onOpenRide?.()
                }
              }}
            >
              <Navigation aria-hidden size={14} />
            </span>
          ) : null}
          <ChevronIcon
            aria-hidden
            data-testid="agenda-row-chevron"
            className="shrink-0 text-[var(--fc-text-secondary)]"
            style={{
              width: "var(--fc-font-list-row-chevron-size)",
              height: "var(--fc-font-list-row-chevron-size)",
            }}
          />
        </span>
      </button>
      {itemRiders.length > 0 ? (
        <div className="px-[var(--fc-space-list-row-pad-x)] pb-[var(--fc-space-list-row-pad-y)]">
          <RiderChips
            riders={itemRiders}
            variant="compact"
            data-testid="agenda-row-rider-chips"
          />
        </div>
      ) : (
        <div className="pb-[var(--fc-space-sm)]" />
      )}
      </div>

      {open ? (
        <div className="flex flex-col gap-[var(--fc-space-lg)] border-t border-[var(--fc-border)] px-[var(--fc-space-list-row-pad-x)] pb-[var(--fc-space-list-row-pad-x)] pt-[var(--fc-space-sm)]">
          {!outOfPlay && conflictLines.length > 0 ? (
            <ul
              data-testid={`agenda-conflicts-${item.source}-${item.id}`}
              className="flex flex-col gap-[2px]"
              aria-label="Schedule conflicts"
            >
              {conflictLines.map((line) => (
                <li key={line} className="text-xs font-medium text-[var(--fc-danger)]">
                  {line}
                </li>
              ))}
            </ul>
          ) : null}

          {!outOfPlay && commitmentConflictLine != null ? (
            <p
              data-testid={`agenda-ride-conflict-${item.source}-${item.id}`}
              className="text-xs font-medium text-[var(--fc-danger)]"
            >
              {commitmentConflictLine}
            </p>
          ) : null}

          {/* Pending assign / confirm per uncovered kid; confirmed rides use override links */}
          {coverageGames.length > 0 ? (
            <div
              data-testid="agenda-band-kids"
              className="flex flex-col gap-[var(--fc-space-md)]"
            >
              {showOverrideLinks ? (
                <div
                  data-testid="agenda-override-links"
                  className="flex flex-wrap items-center gap-x-[var(--fc-space-lg)] gap-y-[var(--fc-space-sm)]"
                >
                  {(() => {
                    const seenLabels = new Set<string>()
                    const cancelLinks = waitingOnOtherGames.map((game) => {
                      if (!isPendingHouseholdConfirm(game.ownRide)) {
                        return null
                      }
                      const label = cancelRequestToDriverLabel(game.ownRide.driver)
                      if (seenLabels.has(label)) {
                        return null
                      }
                      seenLabels.add(label)
                      return (
                        <button
                          key={`cancel-request-${game.kidId}`}
                          type="button"
                          disabled={loading}
                          className={overrideLinkClass}
                          data-testid="agenda-cancel-request-link"
                          onClick={() => cancelPendingRequestForGame(game)}
                        >
                          {label}
                        </button>
                      )
                    })
                    const reassignLinks = confirmedGames.map((game) => {
                      const label = revertOwnRideLabel(game.ownRide, {
                        teammateRide: isTeammateOwnRide(game, rideEvent),
                      })
                      if (label == null || seenLabels.has(label)) {
                        return null
                      }
                      seenLabels.add(label)
                      return (
                        <button
                          key={`reassign-${game.kidId}`}
                          type="button"
                          disabled={loading}
                          className={overrideLinkClass}
                          data-testid="agenda-reassign-link"
                          onClick={() => handleCantMakeIt(game)}
                        >
                          {label}
                        </button>
                      )
                    })
                    return [...cancelLinks, ...reassignLinks]
                  })()}
                  {coverageGames.map((game) => {
                    if (game.attendance === "not_going") {
                      return (
                        <AttendanceToggle
                          key={`att-${game.kidId}`}
                          displayName={
                            circle.kids.find((row) => row.id === game.kidId)?.displayName?.trim() ||
                            "Kid"
                          }
                          attendance={game.attendance}
                          disabled={loading}
                          data-testid={`rsvp-${item.source}-${item.id}-${game.kidId}`}
                          onSetAttendance={(next) =>
                            onSetRsvp(game.kidId, rsvpWriteForAttendanceAction(next))
                          }
                        />
                      )
                    }
                    const kidName =
                      circle.kids.find((row) => row.id === game.kidId)?.displayName?.trim() ||
                      "Kid"
                    return (
                      <button
                        key={`not-going-${game.kidId}`}
                        type="button"
                        disabled={loading}
                        className={overrideLinkClass}
                        data-testid={`rsvp-${item.source}-${item.id}-${game.kidId}`}
                        data-attendance="going"
                        onClick={() => onSetRsvp(game.kidId, "NO")}
                      >
                        {markAsNotGoingLabel(kidName)}
                      </button>
                    )
                  })}
                </div>
              ) : null}

              {ownRequest != null ? (
                <div className="flex flex-col gap-[var(--fc-space-sm)]">
                  <p
                    data-testid="agenda-row-own-ride"
                    className="text-xs text-[var(--fc-text-secondary)]"
                  >
                    {ownRideDetailLine(ownRequest)}
                  </p>
                  {(ownRequest.status === "UNCOVERED" || ownRequest.status === "PARTIAL") &&
                  onCancelRide != null ? (
                    <button
                      type="button"
                      disabled={loading}
                      className={`${overrideLinkClass} text-left`}
                      onClick={() => onCancelRide(ownRequest.id)}
                    >
                      No longer need a ride? Cancel this ask
                    </button>
                  ) : null}
                </div>
              ) : null}

              {coverageGames.map((game) => {
                const kid = circle.kids.find((row) => row.id === game.kidId)
                const kidName = kid?.displayName?.trim() || "Kid"
                const pendingSelfForKid =
                  pendingForSelf != null && pendingForSelf.kidIds.includes(game.kidId)
                const showKidChrome = !outOfPlay && game.attendance !== "not_going"
                const showPicker = showKidChrome && showAssign && showDriverPickerForKid(game)

                if (showOverrideLinks && !showPicker && !pendingSelfForKid) {
                  return null
                }

                return (
                  <div
                    key={game.id}
                    data-testid={`agenda-kid-row-${game.kidId}`}
                    className="flex flex-col"
                  >
                    {showKidChrome ? (
                      <>
                        {pendingSelfForKid && pendingForSelf != null ? (
                          <div className="mb-2 flex flex-wrap gap-[var(--fc-space-sm)]">
                            <Button
                              type="button"
                              size="sm"
                              data-testid="agenda-cta-primary"
                              onClick={() => onConfirmCoverage(pendingForSelf.id)}
                              disabled={loading}
                            >
                              {CONFIRM_COVERAGE}
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => onDeclineCoverage(pendingForSelf.id)}
                              disabled={loading}
                            >
                              {DECLINE_COVERAGE}
                            </Button>
                          </div>
                        ) : null}

                        {showPicker ? (
                          <div className="mb-2 flex flex-col gap-[var(--fc-space-sm)]">
                            {canAskTeam ? (
                              <RideNeededLegsControl
                                id={`agenda-legs-${item.source}-${item.id}-${game.kidId}`}
                                value={rideNeededLegs}
                                onChange={setRideNeededLegs}
                                disabled={loading}
                              />
                            ) : null}
                            <DriverPicker
                              members={circle.members}
                              currentAdultId={currentAdultId}
                              selectedAdultId={assignDraft.adultId}
                              onSelectedAdultChange={(adultId) =>
                                onUpdateAssignDraft({ adultId })
                              }
                              kidIds={[game.kidId]}
                              loading={loading}
                              leaveFromSlot={
                                leaveFromInPicker && game.kidId === firstPickerKidId
                                  ? leaveFromSlotForPicker
                                  : undefined
                              }
                              leaveFromLabel={itemLeaveFromLabel}
                              onAssignCoverage={onAssignCoverage}
                              onAskTeam={() => {
                                if (rideEvent?.eventKey && onCreateRide) {
                                  const onlyGap =
                                    gapKidIds.length === 1 && gapKidIds[0] === game.kidId
                                  onCreateRide(
                                    rideEvent.eventKey,
                                    onlyGap ? undefined : [game.kidId],
                                    rideNeededLegs,
                                  )
                                }
                              }}
                              showTeamSection={canAskTeam}
                            />
                          </div>
                        ) : null}
                      </>
                    ) : null}

                    {!showOverrideLinks ? (
                      <AttendanceToggle
                        displayName={kidName}
                        attendance={game.attendance}
                        disabled={loading}
                        data-testid={`rsvp-${item.source}-${item.id}-${game.kidId}`}
                        onSetAttendance={(next) =>
                          onSetRsvp(game.kidId, rsvpWriteForAttendanceAction(next))
                        }
                      />
                    ) : null}
                  </div>
                )
              })}
            </div>
          ) : null}

          {/* Coverage residuals sit with the decision chrome (below Confirm / overrides) */}
          {!outOfPlay && (unassignedGapKidIds.length > 0 || coverageActionError) ? (
            <div
              data-testid="agenda-band-coverage"
              className="flex flex-col gap-[var(--fc-space-sm)]"
            >
              {unassignedGapKidIds.length > 0 ? (
                <p className="text-sm text-[var(--fc-danger)]">
                  {needsCoverageWithKids(uncoveredKidNames)}
                </p>
              ) : null}
              {coverageActionError ? (
                <p
                  role="alert"
                  data-testid={`agenda-coverage-error-${item.source}-${item.id}`}
                  className="text-sm text-[var(--fc-danger)]"
                >
                  {coverageActionError}
                </p>
              ) : null}
            </div>
          ) : null}

          {routable ? (
            <button
              type="button"
              data-testid="agenda-row-open-ride-cta"
              onClick={() => onOpenRide?.()}
              className="flex w-full items-center justify-between rounded-[var(--fc-radius-xl)] px-[var(--fc-space-ride-detail-agenda-cta-pad-x)] py-[var(--fc-space-ride-detail-cta-pad-y)] text-[length:var(--fc-font-ride-detail-back-size)] leading-[var(--fc-font-ride-detail-back-line)] font-[number:var(--fc-font-ride-detail-back-weight)] text-[var(--fc-accent)] bg-[color-mix(in_srgb,var(--fc-accent)_16%,transparent)]"
            >
              <span className="flex items-center gap-[var(--fc-space-sm)]">
                <Navigation aria-hidden size={15} />
                Route for this ride
              </span>
              <ChevronRight aria-hidden size={16} />
            </button>
          ) : null}

          {/* Travel / origin — coverage leave-from when covering/waiting; else item (unless in picker) */}
          {!outOfPlay ? (
            <div
              data-testid="agenda-band-travel"
              className="flex flex-col gap-[var(--fc-space-sm)]"
            >
              {active.length > 0 ? (
                active.map((coverage) => {
                  const leaveBy = coverageLeaveByLine(coverage)
                  return (
                    <div
                      key={coverage.id}
                      data-testid={`agenda-coverage-leave-${coverage.id}`}
                      className="flex flex-col gap-[var(--fc-space-sm)]"
                    >
                      <LeaveFromControls
                        variant="field-row"
                        value={{
                          leaveFromPlaceId: coverage.leaveFromPlaceId,
                          leaveFromPlaceName: coverage.leaveFromPlaceName,
                          leaveFromAddress: coverage.leaveFromAddress,
                        }}
                        circle={circle}
                        loading={loading}
                        ariaLabel={`Leave from for ${coverageAdultLabel(coverage, circle.members)}`}
                        helperLine={leaveBy}
                        onChange={(body) => onSetCoverageLeaveFrom(coverage.id, body)}
                        testIdPrefix={`coverage-leave-from-${coverage.id}`}
                      />
                    </div>
                  )
                })
              ) : null}

              {/* Item-level only when nobody has coverage — and not already in DriverPicker */}
              {active.length === 0 && !leaveFromInPicker ? (
                <>
                  <LeaveFromControls
                    variant="field-row"
                    value={itemLeaveFromFields}
                    circle={circle}
                    loading={loading}
                    ariaLabel={`Leave from for ${item.title}`}
                    helperLine={agendaLeaveByLine(item)}
                    onChange={onSetLeaveFrom}
                    testIdPrefix={`leave-from-${item.source}-${item.id}`}
                  />
                  {item.leaveByStatus === "UNAVAILABLE" &&
                  item.leaveByReason === "NO_ORIGIN" ? (
                    <Button type="button" size="sm" variant="outline" onClick={onOpenPlaces}>
                      Open Places
                    </Button>
                  ) : null}
                </>
              ) : null}

              {active.length > 0 &&
              item.leaveByStatus === "UNAVAILABLE" &&
              item.leaveByReason === "NO_ORIGIN" &&
              selfCoverage != null ? (
                <Button type="button" size="sm" variant="outline" onClick={onOpenPlaces}>
                  Open Places
                </Button>
              ) : null}
            </div>
          ) : null}

          {showCarpoolBand && rideEvent != null ? (
            <div
              data-testid="agenda-band-carpool"
              className="flex flex-col gap-[var(--fc-space-sm)]"
            >
              <span className="text-xs font-semibold uppercase tracking-wide text-[var(--fc-text-secondary)]">
                Carpool
              </span>
              {showRequestInCarpool && defaultRideKids.length > 0 ? (
                <div className="flex flex-col gap-[var(--fc-space-sm)]">
                  {defaultRideKids.length > 1
                    ? defaultRideKids.map((kidId) => {
                        const name = kidDisplayName(circle.kids, kidId)
                        return (
                          <label
                            key={kidId}
                            className="flex items-center gap-[var(--fc-space-sm)] text-sm"
                          >
                            <input
                              type="checkbox"
                              aria-label={`Request ride for ${name}`}
                              checked={rideKidSelection.includes(kidId)}
                              disabled={loading}
                              onChange={(change) => {
                                const current = rideKidSelection
                                const next = change.target.checked
                                  ? [...current, kidId]
                                  : current.filter((id) => id !== kidId)
                                setSelectedRideKidIds(next)
                              }}
                            />
                            {name}
                          </label>
                        )
                      })
                    : null}
                  <RideNeededLegsControl
                    id={`agenda-request-legs-${item.source}-${item.id}`}
                    value={rideNeededLegs}
                    onChange={setRideNeededLegs}
                    disabled={loading}
                  />
                  {onCreateRide != null ? (
                    <Button
                      type="button"
                      size="sm"
                      disabled={loading || rideKidSelection.length === 0}
                      onClick={() => {
                        const allDefault =
                          rideKidSelection.length === defaultRideKids.length &&
                          rideKidSelection.every((id) => defaultRideKids.includes(id))
                        onCreateRide(
                          rideEvent.eventKey,
                          allDefault ? undefined : rideKidSelection,
                          rideNeededLegs,
                        )
                      }}
                    >
                      Request
                    </Button>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : null}

          {!outOfPlay && rideEvent != null && rideEvent.otherRequests.length > 0 ? (
            <div
              data-testid="agenda-band-inbound-requests"
              className="flex flex-col gap-[var(--fc-space-sm)]"
            >
              <span className="text-xs font-semibold uppercase tracking-wide text-[var(--fc-text-secondary)]">
                Carpool
              </span>
                  {rideEvent.otherRequests.map((request) => (
                <AgendaInboundRequestRow
                  key={request.id}
                  request={request as never}
                  circleId={circle.id}
                  currentAdultId={currentAdultId}
                  garage={garage}
                  rideEvent={rideEvent}
                  loading={loading}
                  inHeroQueue={heroQueuedRequestIds?.has(request.id) ?? false}
                  canOffer={canOffer}
                  recentlyWithdrawn={recentlyWithdrawnRideIds?.has(request.id) ?? false}
                  autoDeclined={coverageGames.some((game) =>
                    game.requests.some(
                      (row) => row.id === request.id && row.autoDeclined === true,
                    ),
                  )}
                  onAcceptRide={onAcceptRide}
                  onPassRide={onPassRide}
                  onWithdrawRide={onWithdrawRide}
                />
              ))}
            </div>
          ) : null}

          {isManual ? (
            <div
              data-testid="agenda-band-manual-actions"
              className="flex gap-[var(--fc-space-sm)]"
            >
              <Button type="button" size="sm" variant="outline" onClick={onEdit} disabled={loading}>
                Edit
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={onRemoveEvent} disabled={loading}>
                Remove event
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
