import { useState } from "react"
import { ChevronDown, ChevronUp, Clock } from "lucide-react"
import type { CalendarItem, CarpoolRideEvent, FamilyCircle, Garage, RsvpStatus } from "@/api/types"
import { isPlaceLocated } from "@/api/types"
import { AgendaInboundRequestRow } from "@/components/AgendaInboundRequestRow"
import { AgendaStatusChip } from "@/components/agendaStatusChip"
import { AttendanceToggle, rsvpWriteForAttendanceAction } from "@/components/AttendanceToggle"
import { Button } from "@/components/ui/button"
import { resolveSemanticIcon } from "@/components/uiIcons"
import { formatEventWhen } from "@/components/eventTimes"
import { agendaLeaveByLine } from "@/components/leaveByDisplay"
import { conflictDisplayLines } from "@/components/conflictDisplay"
import { kidDisplayName, ownRideDetailLine } from "@/components/carpoolDisplay"
import {
  isConfirmedDriver,
  isUnassigned,
  mapCalendarItemToCoverageGames,
  type CoverageGameEvent,
} from "@/components/coverageQueue"
import { DriverPicker } from "@/components/DriverPicker"
import { RevertRideLink } from "@/components/RevertRideLink"
import {
  activeCoverages,
  calendarSourceLabel,
  eventKidNames,
  pendingCoverageForAdult,
  remainingCoverageGapKidIds,
} from "@/components/coverageDisplay"
import {
  carpoolAskChipForRideEvent,
  rideStatusChipForGameRow,
  rideStatusChipsForItem,
} from "@/components/rideStatusChip"
import { isAgendaItemOutOfPlay } from "@/components/rsvpDisplay"

const MapPinIcon = resolveSemanticIcon("icon.places")

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

function isTeammateOwnRide(
  game: CoverageGameEvent,
  rideEvent: CarpoolRideEvent | null,
): boolean {
  const ownRequest = rideEvent?.ownRequest
  return (
    ownRequest?.status === "ACCEPTED" &&
    ownRequest.kidIds.includes(game.kidId)
  )
}

function isHouseholdConfirmedDriver(
  game: CoverageGameEvent,
  rideEvent: CarpoolRideEvent | null,
): boolean {
  return isConfirmedDriver(game.ownRide) && !isTeammateOwnRide(game, rideEvent)
}

/**
 * Unassigned gaps get DriverPicker. Not-going kids hide all driver/coverage
 * chrome but keep AttendanceToggle (ADR-0003).
 */
function showDriverPickerForKid(game: CoverageGameEvent): boolean {
  return game.attendance !== "not_going" && isUnassigned(game.ownRide)
}

function showRevertLinkForKid(
  game: CoverageGameEvent,
  pendingSelfForKid: boolean,
): boolean {
  // Mutually exclusive with DriverPicker / Confirm-for-self. RevertRideLink
  // returns null when ownRide is still unresolved (unassigned / pending).
  return (
    game.attendance !== "not_going" &&
    !showDriverPickerForKid(game) &&
    !pendingSelfForKid
  )
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
  onCreateRide?: (eventKey: string, kidIds?: string[]) => void
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
  onSetLeaveFrom: (placeId: string) => void
  onSetRsvp: (kidId: string, status: RsvpStatus) => void
  onOpenPlaces: () => void
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
  onSetRsvp,
  onOpenPlaces,
  onEdit,
  onRemoveEvent,
}: AgendaRowProps) {
  const [open, setOpen] = useState(false)
  const [selectedRideKidIds, setSelectedRideKidIds] = useState<string[] | null>(null)
  const isManual = item.source === "MANUAL"
  const outOfPlay = isAgendaItemOutOfPlay(item)
  const active = activeCoverages(item)
  const pendingForSelf = pendingCoverageForAdult(item, currentAdultId)
  const locatedPlaces = circle.places.filter(isPlaceLocated)
  const conflictLines = conflictDisplayLines(item.conflicts, circle.kids)
  const ownRequest = rideEvent?.ownRequest ?? null
  const coverageGames = mapCalendarItemToCoverageGames(item, rideEvent, {
    currentAdultId,
    members: circle.members,
  })
  const gapKidIds = remainingCoverageGapKidIds(item.uncoveredKidIds, ownRequest)
  // Gap copy only for true unassigned kids — team ask / teammate ride use chips + revert.
  const unassignedGapKidIds = gapKidIds.filter((kidId) => {
    const game = coverageGames.find((row) => row.kidId === kidId)
    return game == null || isUnassigned(game.ownRide)
  })
  const uncoveredKidNames = eventKidNames(unassignedGapKidIds, circle.kids)
  const canAskTeam =
    rideEvent != null &&
    rideEvent.ownRequest == null &&
    rideEvent.defaultKidIds.length > 0 &&
    onCreateRide != null
  const showAssign =
    !outOfPlay &&
    !pendingForSelf &&
    unassignedGapKidIds.length > 0 &&
    circle.members.length > 0
  const showRequestInCarpool = canAskTeam && !showAssign
  const inPlayGames = coverageGames.filter((game) => game.attendance !== "not_going")
  const canOffer = inPlayGames.some((game) => isHouseholdConfirmedDriver(game, rideEvent))
  const askChip = carpoolAskChipForRideEvent(coverageGames)
  const rideChips = rideStatusChipsForItem(item, coverageGames, ownRequest)
  const tags = askChip != null ? [...rideChips, askChip] : rideChips
  const teamLabel = agendaRowTeamLabel(item)
  const whenLabel = formatEventWhen(item.startsAt, item.endsAt)
  const locationLabel = item.location?.trim() || null
  const defaultRideKids = rideEvent?.defaultKidIds ?? []
  const rideKidSelection = selectedRideKidIds ?? defaultRideKids
  // Own Request in the carpool band when RevertRideLink is not covering cancel;
  // inbound asks use AgendaInboundRequestRow.
  const showCarpoolBand =
    !outOfPlay &&
    rideEvent != null &&
    showRequestInCarpool &&
    defaultRideKids.length > 0 &&
    onCreateRide != null

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
    }
  }

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
        className="flex min-w-0 w-full items-center justify-between gap-[var(--fc-space-lg)] px-[var(--fc-space-list-row-pad-x)] py-[var(--fc-space-list-row-pad-y)] text-left"
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
            className="mt-0.5 flex items-center gap-1.5 text-[length:var(--fc-font-list-row-meta-size)] leading-[var(--fc-font-list-row-meta-line)] font-[number:var(--fc-font-list-row-meta-weight)] text-[var(--fc-text-secondary)]"
          >
            <Clock aria-hidden className="size-[14px] shrink-0" />
            {whenLabel}
          </span>
          {locationLabel != null ? (
            <span
              data-testid="agenda-row-where"
              className="flex items-center gap-1.5 text-[length:var(--fc-font-list-row-meta-size)] leading-[var(--fc-font-list-row-meta-line)] font-[number:var(--fc-font-list-row-meta-weight)] text-[var(--fc-text-secondary)]"
            >
              <MapPinIcon aria-hidden className="size-[14px] shrink-0" />
              {locationLabel}
            </span>
          ) : null}
        </span>
        <span className="flex max-w-[50%] shrink-0 flex-wrap items-center justify-end gap-[var(--fc-space-list-row-tag-gap)]">
          {tags.map((tag) => (
            <AgendaStatusChip
              key={tag.label}
              label={tag.label}
              tone={tag.tone}
            />
          ))}
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

          {/* Per-kid own-ride (mock GameCard): chip + DriverPicker | RevertRideLink + AttendanceToggle */}
          {coverageGames.length > 0 ? (
            <div
              data-testid="agenda-band-kids"
              className="flex flex-col gap-[var(--fc-space-md)]"
            >
              {coverageGames.map((game) => {
                const kid = circle.kids.find((row) => row.id === game.kidId)
                const kidName = kid?.displayName?.trim() || "Kid"
                const initial = kidName.charAt(0).toUpperCase() || "?"
                const chip = rideStatusChipForGameRow(game, ownRequest)
                const pendingSelfForKid =
                  pendingForSelf != null && pendingForSelf.kidIds.includes(game.kidId)
                const showKidChrome = !outOfPlay && game.attendance !== "not_going"
                const showPicker = showKidChrome && showAssign && showDriverPickerForKid(game)
                const showRevert =
                  showKidChrome && showRevertLinkForKid(game, pendingSelfForKid)

                return (
                  <div
                    key={game.id}
                    data-testid={`agenda-kid-row-${game.kidId}`}
                    className="flex flex-col"
                  >
                    {showKidChrome ? (
                      <>
                        <div className="flex items-center justify-between gap-[var(--fc-space-md)] py-[var(--fc-space-sm)]">
                          <div className="flex min-w-0 items-center gap-[var(--fc-space-sm)] text-sm text-[var(--fc-text-primary)]">
                            <span
                              aria-hidden
                              className="flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-bold text-[var(--fc-accent-on)] bg-[var(--fc-accent)]"
                            >
                              {initial}
                            </span>
                            <span className="min-w-0">{kidName}</span>
                          </div>
                          <AgendaStatusChip label={chip.label} tone={chip.tone} />
                        </div>

                        {pendingSelfForKid && pendingForSelf != null ? (
                          <div className="mb-2 flex flex-wrap gap-[var(--fc-space-sm)]">
                            <Button
                              type="button"
                              size="sm"
                              data-testid="agenda-cta-primary"
                              onClick={() => onConfirmCoverage(pendingForSelf.id)}
                              disabled={loading}
                            >
                              Confirm coverage
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => onDeclineCoverage(pendingForSelf.id)}
                              disabled={loading}
                            >
                              Decline coverage
                            </Button>
                          </div>
                        ) : null}

                        {showPicker ? (
                          <div className="mb-2">
                            <DriverPicker
                              members={circle.members}
                              currentAdultId={currentAdultId}
                              selectedAdultId={assignDraft.adultId}
                              onSelectedAdultChange={(adultId) =>
                                onUpdateAssignDraft({ adultId })
                              }
                              kidIds={[game.kidId]}
                              loading={loading}
                              onAssignCoverage={onAssignCoverage}
                              onAskTeam={() => {
                                if (rideEvent?.eventKey && onCreateRide) {
                                  const onlyGap =
                                    gapKidIds.length === 1 && gapKidIds[0] === game.kidId
                                  onCreateRide(
                                    rideEvent.eventKey,
                                    onlyGap ? undefined : [game.kidId],
                                  )
                                }
                              }}
                              showTeamSection={canAskTeam}
                            />
                          </div>
                        ) : null}

                        {showRevert ? (
                          <RevertRideLink
                            ownRide={game.ownRide}
                            teammateRide={isTeammateOwnRide(game, rideEvent)}
                            disabled={loading}
                            onCantMakeIt={() => handleCantMakeIt(game)}
                          />
                        ) : null}

                        {ownRequest != null && ownRequest.kidIds.includes(game.kidId) ? (
                          <p
                            data-testid="agenda-row-own-ride"
                            className="mt-1 text-xs text-[var(--fc-text-secondary)]"
                          >
                            {ownRideDetailLine(ownRequest)}
                          </p>
                        ) : null}
                      </>
                    ) : null}

                    <AttendanceToggle
                      displayName={kidName}
                      attendance={game.attendance}
                      disabled={loading}
                      data-testid={`rsvp-${item.source}-${item.id}-${game.kidId}`}
                      onSetAttendance={(next) =>
                        onSetRsvp(game.kidId, rsvpWriteForAttendanceAction(next))
                      }
                    />
                  </div>
                )
              })}
            </div>
          ) : null}

          {/* Travel / origin — below DriverPicker per weekly-list-focus-sync */}
          {!outOfPlay ? (
            <div
              data-testid="agenda-band-travel"
              className="flex flex-col gap-[var(--fc-space-sm)]"
            >
              <span
                className="text-xs text-[var(--fc-text-secondary)]"
                data-testid={`leave-by-${item.source}-${item.id}`}
              >
                {agendaLeaveByLine(item)}
              </span>
              <div className="flex items-center justify-between gap-[var(--fc-space-md)]">
                <span className="text-xs text-[var(--fc-text-secondary)]">Leave from</span>
                {locatedPlaces.length <= 1 ? (
                  <span
                    className="text-sm font-medium text-[var(--fc-text-primary)]"
                    data-testid={`leave-from-label-${item.source}-${item.id}`}
                  >
                    {item.leaveFromPlaceName ??
                      locatedPlaces[0]?.name ??
                      (circle.places.length === 0
                        ? "No places yet"
                        : "No located places yet")}
                  </span>
                ) : (
                  <select
                    aria-label={`Leave from for ${item.title}`}
                    className="h-9 rounded-md border border-[var(--fc-border)] bg-transparent px-2 text-sm"
                    value={item.leaveFromPlaceId ?? ""}
                    onChange={(e) => e.target.value && onSetLeaveFrom(e.target.value)}
                    disabled={loading}
                  >
                    {!item.leaveFromPlaceId ? <option value="">Choose a located place</option> : null}
                    {circle.places.map((place) => (
                      <option key={place.id} value={place.id} disabled={!isPlaceLocated(place)}>
                        {isPlaceLocated(place) ? place.name : `${place.name} (not located)`}
                      </option>
                    ))}
                  </select>
                )}
              </div>
              {item.leaveByStatus === "UNAVAILABLE" && item.leaveByReason === "NO_ORIGIN" ? (
                <Button type="button" size="sm" variant="outline" onClick={onOpenPlaces}>
                  Open Places
                </Button>
              ) : null}
            </div>
          ) : null}

          {/* People / source — attendance toggle lives under DriverPicker / Revert per kid */}
          <div
            data-testid="agenda-band-people"
            className="flex flex-col gap-[var(--fc-space-sm)]"
          >
            <span className="text-xs text-[var(--fc-text-secondary)]">
              {calendarSourceLabel(item.source, item.feedName)}
            </span>
          </div>

          {/* Coverage residuals: gap copy + errors (no Remove coverage admin button) */}
          {!outOfPlay && (unassignedGapKidIds.length > 0 || coverageActionError) ? (
            <div
              data-testid="agenda-band-coverage"
              className="flex flex-col gap-[var(--fc-space-sm)]"
            >
              {unassignedGapKidIds.length > 0 ? (
                <p className="text-sm text-[var(--fc-danger)]">
                  {uncoveredKidNames ? `Needs coverage: ${uncoveredKidNames}` : "Needs coverage"}
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

          {showCarpoolBand && rideEvent != null ? (
            <div
              data-testid="agenda-band-carpool"
              className="flex flex-col gap-[var(--fc-space-sm)]"
            >
              <span className="text-xs text-[var(--fc-text-secondary)]">Carpool</span>
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
              {rideEvent.otherRequests.map((request) => (
                <AgendaInboundRequestRow
                  key={request.id}
                  request={request}
                  circleId={circle.id}
                  currentAdultId={currentAdultId}
                  garage={garage}
                  rideEvent={rideEvent}
                  loading={loading}
                  inHeroQueue={heroQueuedRequestIds?.has(request.id) ?? false}
                  canOffer={canOffer}
                  recentlyWithdrawn={recentlyWithdrawnRideIds?.has(request.id) ?? false}
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
