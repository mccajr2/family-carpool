import type { CalendarItem, FamilyCircle } from "@/api/types"
import { isPlaceLocated } from "@/api/types"
import { Button } from "@/components/ui/button"
import { formatEventWhen } from "@/components/eventTimes"
import { agendaLeaveByLine } from "@/components/leaveByDisplay"
import { conflictDisplayLines } from "@/components/conflictDisplay"
import {
  rsvpStatusForKid,
  rsvpStatusLabel,
} from "@/components/rsvpDisplay"
import {
  activeCoverages,
  calendarSourceLabel,
  coverageAdultLabel,
  coverageKidNames,
  coverageStatusLabel,
  eventKidNames,
  pendingCoverageForAdult,
} from "@/components/coverageDisplay"
import type { RsvpStatus } from "@/api/types"

type AssignDraft = { adultId: string; kidIds: string[]; soleAdult: boolean; soleKid: boolean }

type AgendaFocusCardProps = {
  item: CalendarItem
  circle: FamilyCircle
  currentAdultId: string
  loading: boolean
  assignDraft: AssignDraft
  coverageActionError?: string
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
 * Exactly one item at a time renders this way — selection logic lives in
 * agendaFocusSelection.ts. See docs/agenda-focus-card-addendum.md.
 * Same data, same handlers as a flat Agenda row; this is a visual
 * promotion only, not new functionality.
 */
export function AgendaFocusCard({
  item,
  circle,
  currentAdultId,
  loading,
  assignDraft,
  coverageActionError,
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
}: AgendaFocusCardProps) {
  const isManual = item.source === "MANUAL"
  const needsDecision = item.uncoveredKidIds.length > 0 || item.conflicts.length > 0
  const statusColor = needsDecision ? "var(--fc-danger)" : "var(--fc-success)"
  const statusBg = needsDecision
    ? "color-mix(in srgb, var(--fc-danger) 14%, transparent)"
    : "color-mix(in srgb, var(--fc-success) 14%, transparent)"

  const conflictLines = conflictDisplayLines(item.conflicts, circle.kids)
  const uncoveredKidNames = eventKidNames(item.uncoveredKidIds, circle.kids)
  const active = activeCoverages(item)
  const pendingForSelf = pendingCoverageForAdult(item, currentAdultId)
  const locatedPlaces = circle.places.filter(isPlaceLocated)

  const statusLine = needsDecision
    ? (conflictLines[0] ??
      (uncoveredKidNames ? `Needs coverage: ${uncoveredKidNames}` : "Needs coverage"))
    : "All set"

  return (
    <div
      data-testid={`agenda-focus-${item.source}-${item.id}`}
      className="flex flex-col gap-[var(--fc-space-lg)] rounded-[var(--fc-radius-xl)] border border-[var(--fc-border)] bg-[var(--fc-surface-raised)] p-[var(--fc-space-xl)] shadow-sm"
    >
      {/* Primary */}
      <div className="flex flex-col gap-[var(--fc-space-xs)]">
        <span className="text-xs font-semibold uppercase tracking-wide text-[var(--fc-text-secondary)]">
          {formatEventWhen(item.startsAt, item.endsAt)}
        </span>
        <span className="text-[length:var(--fc-font-hero-size)] font-bold leading-[var(--fc-font-hero-line)] text-[var(--fc-text-primary)]">
          {item.title}
        </span>
        {item.location ? (
          <span className="text-sm text-[var(--fc-text-secondary)]">{item.location}</span>
        ) : null}
        <span
          className="mt-[var(--fc-space-xs)] inline-flex w-fit items-center gap-[var(--fc-space-xs)] rounded-full px-[var(--fc-space-md)] py-[var(--fc-space-xs)] text-sm font-semibold"
          style={{ color: statusColor, backgroundColor: statusBg }}
        >
          {statusLine}
        </span>
        {conflictLines.length > 1
          ? conflictLines.slice(1).map((line) => (
              <span key={line} className="text-xs font-medium" style={{ color: statusColor }}>
                {line}
              </span>
            ))
          : null}
      </div>

      {/* Travel / origin */}
      <div className="flex flex-col gap-[var(--fc-space-sm)] border-t border-[var(--fc-border)] pt-[var(--fc-space-md)]">
        <span className="text-xs text-[var(--fc-text-secondary)]">{agendaLeaveByLine(item)}</span>
        <div className="flex items-center justify-between gap-[var(--fc-space-md)]">
          <span className="text-xs text-[var(--fc-text-secondary)]">Leave from</span>
          {locatedPlaces.length <= 1 ? (
            <span className="text-sm font-medium text-[var(--fc-text-primary)]">
              {item.leaveFromPlaceName ?? locatedPlaces[0]?.name ?? "No located places yet"}
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

      {/* People / source */}
      <div className="flex flex-col gap-[var(--fc-space-sm)] border-t border-[var(--fc-border)] pt-[var(--fc-space-md)]">
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
      <div className="flex flex-col gap-[var(--fc-space-sm)] border-t border-[var(--fc-border)] pt-[var(--fc-space-md)]">
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

        {pendingForSelf ? (
          <div className="flex gap-[var(--fc-space-sm)]">
            <Button
              type="button"
              size="sm"
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

        {item.uncoveredKidIds.length > 0 && circle.members.length > 0 ? (
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
                      {m.displayName?.trim() ? m.displayName : m.email}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}
            <Button
              type="button"
              size="sm"
              variant={pendingForSelf ? "outline" : "default"}
              onClick={() => onAssignCoverage(assignDraft.adultId, assignDraft.kidIds)}
              disabled={loading || !assignDraft.adultId || assignDraft.kidIds.length === 0}
            >
              Assign coverage
            </Button>
          </div>
        ) : null}

        {coverageActionError ? (
          <p role="alert" className="text-sm" style={{ color: "var(--fc-danger)" }}>
            {coverageActionError}
          </p>
        ) : null}
      </div>

      {isManual ? (
        <div className="flex gap-[var(--fc-space-sm)] border-t border-[var(--fc-border)] pt-[var(--fc-space-md)]">
          <Button type="button" size="sm" variant="outline" onClick={onEdit} disabled={loading}>
            Edit
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={onRemoveEvent}
            disabled={loading}
          >
            Remove event
          </Button>
        </div>
      ) : null}
    </div>
  )
}
