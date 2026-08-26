import { useState } from "react"
import type { CalendarItem, CarpoolRideEvent, FamilyCircle, RsvpStatus } from "@/api/types"
import { isPlaceLocated } from "@/api/types"
import { accountInitials } from "@/components/accountInitials"
import { AgendaStatusChip } from "@/components/agendaStatusChip"
import { Button } from "@/components/ui/button"
import { resolveSemanticIcon } from "@/components/uiIcons"
import { formatEventWhen } from "@/components/eventTimes"
import { agendaLeaveByLine } from "@/components/leaveByDisplay"
import { conflictDisplayLines } from "@/components/conflictDisplay"
import {
  acceptedByUsRequest,
  agendaOwnRideStatusChip,
  circleDisplayName,
  kidDisplayName,
  ownRideStatusLine,
  rideSeatsLabel,
} from "@/components/carpoolDisplay"
import {
  isAgendaItemOutOfPlay,
  rsvpStatusForKid,
  rsvpStatusLabel,
} from "@/components/rsvpDisplay"
import {
  activeCoverages,
  agendaItemStatusTags,
  calendarSourceLabel,
  coverageAdultLabel,
  coverageKidNames,
  coverageStatusLabel,
  eventKidNames,
  insertOwnRideStatusChip,
  memberLabel,
  pendingCoverageForAdult,
  remainingCoverageGapKidIds,
} from "@/components/coverageDisplay"

const RowChevron = resolveSemanticIcon("icon.chevron")

function confirmedCoveringAvatars(
  item: CalendarItem,
  circle: FamilyCircle,
  outOfPlay: boolean,
): { adultId: string; name: string; initials: string }[] {
  if (outOfPlay) {
    return []
  }
  return activeCoverages(item)
    .filter((coverage) => coverage.status === "CONFIRMED")
    .slice(0, 2)
    .map((coverage) => {
      const name = coverageAdultLabel(coverage, circle.members)
      const member = circle.members.find((m) => m.adultId === coverage.coveringAdultId)
      return {
        adultId: coverage.coveringAdultId,
        name,
        initials: accountInitials(name, member?.email ?? ""),
      }
    })
}

type AssignDraft = { adultId: string; kidIds: string[]; soleAdult: boolean; soleKid: boolean }

type AgendaRowProps = {
  item: CalendarItem
  circle: FamilyCircle
  currentAdultId: string
  loading: boolean
  assignDraft: AssignDraft
  coverageActionError?: string
  rideEvent?: CarpoolRideEvent | null
  onCreateRide?: (eventKey: string, kidIds?: string[]) => void
  onCancelRide?: (rideId: string) => void
  onWithdrawRide?: (rideId: string) => void
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
 * Redesigned flat Agenda row: collapsed by default (title, time, status
 * pills, covering avatars, chevron), tap/click to expand the same field-row
 * bands as AgendaFocusCard (leave-from, per-kid RSVP, coverage, manual
 * actions). Out-of-play items (every kid RSVP No) render muted and start
 * collapsed with no auto-expand affordance beyond the summary + "Not going"
 * pill.
 *
 * Title and time wrap — do not add `truncate` / `whitespace-nowrap`. Ellipsis
 * here sets the page-frame grid item's min-content to ~820px, so Calendar's
 * `1fr` column cannot shrink with the window (mock `.row-main` wraps).
 *
 * NOTE: a "N stops" carpool tag was part of the original mockup but is not
 * included here — CalendarItem has no per-event stop/pickup-order field in
 * the current data model (see api/types). Do not fabricate one; this needs
 * a real backend field before it can render. Tracked as a data-model
 * dependency for the Carpool destination redesign, not implemented here.
 */
export function AgendaRow({
  item,
  circle,
  currentAdultId,
  loading,
  assignDraft,
  coverageActionError,
  rideEvent = null,
  onCreateRide,
  onCancelRide,
  onWithdrawRide,
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
  const acceptedByUs = acceptedByUsRequest(rideEvent, circle.id)
  const gapKidIds = remainingCoverageGapKidIds(item.uncoveredKidIds, ownRequest)
  const uncoveredKidNames = eventKidNames(gapKidIds, circle.kids)
  const tags = insertOwnRideStatusChip(
    agendaItemStatusTags(item, currentAdultId, { outOfPlay, ownRequest }),
    agendaOwnRideStatusChip(ownRequest),
  )
  const coveringAvatars = confirmedCoveringAvatars(item, circle, outOfPlay)
  const coveringLabel =
    coveringAvatars.length > 0
      ? `Covering: ${coveringAvatars.map((adult) => adult.name).join(", ")}`
      : undefined
  const defaultRideKids = rideEvent?.defaultKidIds ?? []
  const rideKidSelection = selectedRideKidIds ?? defaultRideKids
  // Own Request/Cancel, and/or minimal accepted-by-us + Withdraw. No Accept/Pass
  // on expanded rows (those stay on Focus / Carpool tab).
  const showCarpoolBand =
    !outOfPlay &&
    rideEvent != null &&
    (ownRequest != null || defaultRideKids.length > 0 || acceptedByUs != null) &&
    (onCreateRide != null || onCancelRide != null || onWithdrawRide != null)

  return (
    <div
      data-testid={`agenda-row-${item.source}-${item.id}`}
      data-out-of-play={outOfPlay ? "true" : "false"}
      className={`rounded-[var(--fc-radius-md)] border border-[var(--fc-border)] bg-[var(--fc-surface-raised)] px-[var(--fc-space-lg)] py-[var(--fc-space-md)] transition-colors ${outOfPlay ? "opacity-60" : ""}`}
    >
      <div data-testid="agenda-band-primary">
      <button
        type="button"
        className="flex min-w-0 w-full items-center gap-[var(--fc-space-list-row-gap)] text-left"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span className="min-w-0 flex-1">
          <span
            className={`fc-display block text-[15.5px] font-semibold ${outOfPlay ? "text-[var(--fc-text-secondary)]" : "text-[var(--fc-text-primary)]"}`}
          >
            {item.title}
          </span>
          <span className="block text-xs text-[var(--fc-text-secondary)]">
            {formatEventWhen(item.startsAt, item.endsAt)}
            {item.location ? ` · ${item.location}` : ""}
          </span>
        </span>
        {tags.length > 0 ? (
          <span className="flex flex-shrink-0 gap-[var(--fc-space-list-row-tag-gap)]">
            {tags.map((tag) => (
              <AgendaStatusChip
                key={tag.label}
                label={tag.label}
                tone={tag.tone}
                appearance="pill"
              />
            ))}
          </span>
        ) : null}
        {coveringAvatars.length > 0 ? (
          <span
            className="flex flex-shrink-0"
            data-testid="agenda-row-covering-avatars"
            aria-label={coveringLabel}
          >
            {coveringAvatars.map((adult, index) => (
              <span
                key={adult.adultId}
                aria-hidden
                className="flex shrink-0 items-center justify-center rounded-full border-[length:var(--fc-space-list-row-avatar-border)] border-[var(--fc-surface-raised)] bg-[color-mix(in_srgb,var(--fc-accent)_14%,transparent)] font-[family-name:var(--fc-font-family-display)] text-[length:var(--fc-font-list-row-avatar-label-size)] leading-[var(--fc-font-list-row-avatar-label-line)] font-[number:var(--fc-font-list-row-avatar-label-weight)] text-[var(--fc-accent)]"
                style={{
                  width: "var(--fc-space-list-row-avatar)",
                  height: "var(--fc-space-list-row-avatar)",
                  marginLeft: index === 0 ? undefined : "calc(var(--fc-space-list-row-avatar-overlap) * -1)",
                }}
              >
                {adult.initials}
              </span>
            ))}
          </span>
        ) : null}
        <RowChevron
          aria-hidden
          data-testid="agenda-row-chevron"
          className="flex-shrink-0 text-[var(--fc-text-secondary)] transition-transform"
          style={{
            width: "var(--fc-font-list-row-chevron-size)",
            height: "var(--fc-font-list-row-chevron-size)",
            transform: open ? "rotate(90deg)" : undefined,
          }}
        />
      </button>
      </div>

      {open ? (
        <div className="mt-[var(--fc-space-md)] flex flex-col gap-[var(--fc-space-lg)] border-t border-[var(--fc-border)] pt-[var(--fc-space-md)]">
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

          {/* Travel / origin */}
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

          {/* People / source */}
          <div
            data-testid="agenda-band-people"
            className="flex flex-col gap-[var(--fc-space-sm)]"
          >
            <span className="text-xs text-[var(--fc-text-secondary)]">
              {calendarSourceLabel(item.source, item.feedName)}
            </span>
            {item.kidIds.map((kidId) => {
              const kid = circle.kids.find((k) => k.id === kidId)
              const kidName = kid?.displayName?.trim() || "Kid"
              const status = rsvpStatusForKid(item, kidId)
              return (
                <div key={kidId} className="flex items-center justify-between gap-[var(--fc-space-md)]">
                  <span className="text-sm text-[var(--fc-text-secondary)]">{kidName}</span>
                  <select
                    aria-label={`RSVP for ${kidName} on ${item.title}`}
                    data-testid={`rsvp-${item.source}-${item.id}-${kidId}`}
                    className="h-9 rounded-md border border-[var(--fc-border)] bg-transparent px-2 text-sm"
                    value={status}
                    onChange={(e) => onSetRsvp(kidId, e.target.value as RsvpStatus)}
                    disabled={loading}
                  >
                    <option value="NO_RESPONSE">{rsvpStatusLabel("NO_RESPONSE")}</option>
                    <option value="YES">{rsvpStatusLabel("YES")}</option>
                    <option value="NO">{rsvpStatusLabel("NO")}</option>
                  </select>
                </div>
              )
            })}
          </div>

          {/* Coverage / actions */}
          {!outOfPlay ? (
            <div
              data-testid="agenda-band-coverage"
              className="flex flex-col gap-[var(--fc-space-sm)]"
            >
              {active.map((coverage) => (
                <div key={coverage.id} className="flex items-center justify-between gap-[var(--fc-space-md)]">
                  <span className="text-xs text-[var(--fc-text-secondary)]">
                    {coverageAdultLabel(coverage, circle.members)} ·{" "}
                    {coverageKidNames(coverage, circle.kids)} · {coverageStatusLabel(coverage.status)}
                  </span>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => onRemoveCoverage(coverage.id)}
                    disabled={loading}
                  >
                    Remove coverage
                  </Button>
                </div>
              ))}
              {gapKidIds.length > 0 ? (
                <p className="text-sm text-[var(--fc-danger)]">
                  {uncoveredKidNames ? `Needs coverage: ${uncoveredKidNames}` : "Needs coverage"}
                </p>
              ) : null}
              {pendingForSelf ? (
                <div className="flex gap-[var(--fc-space-sm)]">
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
              {gapKidIds.length > 0 && circle.members.length > 0 ? (
                <div className="flex flex-col gap-[var(--fc-space-sm)]">
                  {!assignDraft.soleAdult ? (
                    <div className="flex items-center justify-between gap-[var(--fc-space-md)]">
                      <span className="text-xs text-[var(--fc-text-secondary)]">Covering adult</span>
                      <select
                        aria-label={`Covering adult for ${item.title}`}
                        className="h-9 rounded-md border border-[var(--fc-border)] bg-transparent px-2 text-sm"
                        value={assignDraft.adultId}
                        onChange={(e) => onUpdateAssignDraft({ adultId: e.target.value })}
                        disabled={loading}
                      >
                        {circle.members.map((m) => (
                          <option key={m.adultId} value={m.adultId}>
                            {memberLabel(m)}
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : null}
                  {!assignDraft.soleKid ? (
                    <fieldset className="flex flex-col gap-[var(--fc-space-xs)]">
                      <legend className="text-xs text-[var(--fc-text-secondary)]">
                        Uncovered kids
                      </legend>
                      {gapKidIds.map((kidId) => {
                        const kid = circle.kids.find((entry) => entry.id === kidId)
                        if (!kid) {
                          return null
                        }
                        return (
                          <label
                            key={kidId}
                            className="flex items-center gap-[var(--fc-space-sm)] text-sm"
                          >
                            <input
                              type="checkbox"
                              aria-label={`Cover ${kid.displayName} for ${item.title}`}
                              checked={assignDraft.kidIds.includes(kidId)}
                              onChange={() =>
                                onUpdateAssignDraft({
                                  kidIds: assignDraft.kidIds.includes(kidId)
                                    ? assignDraft.kidIds.filter((id) => id !== kidId)
                                    : [...assignDraft.kidIds, kidId],
                                })
                              }
                              disabled={loading}
                            />
                            {kid.displayName}
                          </label>
                        )
                      })}
                    </fieldset>
                  ) : null}
                  <Button
                    type="button"
                    size="sm"
                    variant={pendingForSelf ? "outline" : "default"}
                    data-testid={pendingForSelf ? undefined : "agenda-cta-primary"}
                    onClick={() => onAssignCoverage(assignDraft.adultId, assignDraft.kidIds)}
                    disabled={loading || !assignDraft.adultId || assignDraft.kidIds.length === 0}
                  >
                    Assign coverage
                  </Button>
                </div>
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
              {rideEvent.ownRequest != null ? (
                <div className="flex items-center justify-between gap-[var(--fc-space-md)]">
                  <span className="text-sm text-[var(--fc-text-secondary)]">
                    {ownRideStatusLine(rideEvent.ownRequest)}
                    {" · "}
                    {rideEvent.ownRequest.kidFirstNames.join(", ")}
                    {" · "}
                    {rideSeatsLabel(rideEvent.ownRequest.seats)}
                  </span>
                  {onCancelRide != null ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={loading}
                      onClick={() => onCancelRide(rideEvent.ownRequest!.id)}
                    >
                      Cancel
                    </Button>
                  ) : null}
                </div>
              ) : defaultRideKids.length > 0 ? (
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
              {acceptedByUs != null ? (
                <div
                  data-testid="agenda-row-accepted-by-us"
                  className="flex items-center justify-between gap-[var(--fc-space-md)]"
                >
                  <span className="text-sm text-[var(--fc-text-secondary)]">
                    Accepted · {circleDisplayName(acceptedByUs.requestingCircleName)} ·{" "}
                    {acceptedByUs.kidFirstNames.join(", ")}
                  </span>
                  {onWithdrawRide != null ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={loading}
                      onClick={() => onWithdrawRide(acceptedByUs.id)}
                    >
                      Withdraw
                    </Button>
                  ) : null}
                </div>
              ) : null}
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
