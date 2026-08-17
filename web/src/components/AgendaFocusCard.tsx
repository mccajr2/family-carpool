import { useMemo } from "react"
import type { CalendarItem, FamilyCircle, RsvpStatus } from "@/api/types"
import { isPlaceLocated } from "@/api/types"
import { Button } from "@/components/ui/button"
import { formatRingCountdown } from "@/components/agendaFocusRing"
import { focusItemNeedsDecision } from "@/components/agendaFocusSelection"
import { conflictDisplayLines } from "@/components/conflictDisplay"
import {
  activeCoverages,
  calendarSourceLabel,
  coverageAdultLabel,
  coverageKidNames,
  coverageStatusLabel,
  eventKidNames,
  pendingCoverageForAdult,
} from "@/components/coverageDisplay"
import { formatEventWhen } from "@/components/eventTimes"
import { agendaLeaveByLine } from "@/components/leaveByDisplay"
import { rsvpStatusForKid, rsvpStatusLabel } from "@/components/rsvpDisplay"

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

const RING_RADIUS = 27
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS
/** Ring reads full at 3+ hours out, empty at 0 — a decorative urgency cue, not a literal countdown. */
const RING_MAX_MINUTES = 180

function minutesUntil(iso: string | null | undefined): number | null {
  if (!iso) return null
  const target = new Date(iso).getTime()
  if (Number.isNaN(target)) return null
  return Math.max(0, Math.round((target - Date.now()) / 60000))
}

/**
 * Exactly one item at a time renders this way — selection logic lives in
 * agendaFocusSelection.ts. See docs/agenda-focus-card-addendum.md.
 *
 * Two visual states, same layout/bands, deliberately different surface:
 * - needsDecision → the theme-independent dark "hero*" tokens (a fixed
 *   spotlight surface, not the page's normal dark-mode card) so the item
 *   reads as urgent regardless of site theme.
 * - resolved/"all set" → normal theme-following surfaceRaised card.
 * Same data, same handlers as a flat Agenda row in either case — this is a
 * visual promotion only, not new functionality.
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
  const needsDecision = focusItemNeedsDecision(item, currentAdultId)

  const conflictLines = conflictDisplayLines(item.conflicts, circle.kids)
  const uncoveredKidNames = eventKidNames(item.uncoveredKidIds, circle.kids)
  const active = activeCoverages(item)
  const pendingForSelf = pendingCoverageForAdult(item, currentAdultId)
  const locatedPlaces = circle.places.filter(isPlaceLocated)

  const statusLine = needsDecision
    ? (conflictLines[0] ??
      (uncoveredKidNames ? `Needs coverage: ${uncoveredKidNames}` : "Needs coverage"))
    : "All set"

  const mins = useMemo(() => minutesUntil(item.leaveByAt ?? item.startsAt), [item.leaveByAt, item.startsAt])
  const ringFraction = mins == null ? 1 : Math.min(1, mins / RING_MAX_MINUTES)
  const ringDashoffset = RING_CIRCUMFERENCE * (1 - ringFraction)
  const { label: ringLabel, unit: ringUnit } = formatRingCountdown(mins)

  // Surface + accent role names swap by state, not by page theme — see the
  // component doc comment above. "hero*" is always used for the urgent
  // state; plain tokens for the resolved/calm state.
  const surfaceVar = needsDecision ? "var(--fc-hero-surface)" : "var(--fc-surface-raised)"
  const onVar = needsDecision ? "var(--fc-hero-on)" : "var(--fc-text-primary)"
  const onSecondaryVar = needsDecision ? "var(--fc-hero-on-secondary)" : "var(--fc-text-secondary)"
  const statusColorVar = needsDecision ? "var(--fc-hero-danger)" : "var(--fc-hero-success)"
  // Error text is always an error, independent of the card's calm/urgent state —
  // do not reuse the success color here just because the card happens to be calm.
  const errorColorVar = needsDecision ? "var(--fc-hero-danger)" : "var(--fc-danger)"
  const ringColorVar = needsDecision ? "var(--fc-hero-danger)" : "var(--fc-hero-success)"
  const borderVar = needsDecision ? "transparent" : "var(--fc-border)"
  const dividerVar = needsDecision ? "rgba(255,255,255,0.12)" : "var(--fc-border)"
  const ringTrackVar = needsDecision ? "rgba(255,255,255,0.14)" : "var(--fc-border)"

  return (
    <div
      data-testid={`agenda-focus-${item.source}-${item.id}`}
      className="relative overflow-hidden rounded-[var(--fc-radius-xl)] p-[var(--fc-space-xl)]"
      style={{
        backgroundColor: surfaceVar,
        color: onVar,
        border: `1px solid ${borderVar}`,
        boxShadow: needsDecision ? "0 20px 40px -24px rgba(0,0,0,0.45)" : "none",
      }}
    >
      {needsDecision ? (
        <div
          aria-hidden
          className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full"
          style={{
            background:
              "radial-gradient(circle, color-mix(in srgb, var(--fc-hero-accent) 45%, transparent), transparent 70%)",
          }}
        />
      ) : null}

      {/* Primary */}
      <div className="relative flex items-start justify-between gap-[var(--fc-space-lg)]">
        <div className="flex min-w-0 flex-col gap-[var(--fc-space-xs)]">
          <span
            className="text-xs font-semibold uppercase tracking-wide"
            style={{ color: onSecondaryVar }}
          >
            {formatEventWhen(item.startsAt, item.endsAt)}
          </span>
          <span
            className="fc-display text-[length:var(--fc-font-hero-size)] font-bold leading-[var(--fc-font-hero-line)]"
            style={{ color: onVar }}
          >
            {item.title}
          </span>
          {item.location ? (
            <span className="text-sm" style={{ color: onSecondaryVar }}>
              {item.location}
            </span>
          ) : null}
        </div>

        {/* Countdown ring — decorative urgency cue, see RING_MAX_MINUTES note above */}
        <div className="relative h-16 w-16 flex-shrink-0">
          <svg width="64" height="64" viewBox="0 0 64 64" className="-rotate-90">
            <circle cx="32" cy="32" r={RING_RADIUS} fill="none" stroke={ringTrackVar} strokeWidth={5} />
            <circle
              cx="32"
              cy="32"
              r={RING_RADIUS}
              fill="none"
              stroke={ringColorVar}
              strokeWidth={5}
              strokeLinecap="round"
              strokeDasharray={RING_CIRCUMFERENCE}
              strokeDashoffset={ringDashoffset}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-xs font-bold" style={{ color: onVar }}>
              {ringLabel}
            </span>
            {ringUnit ? (
              <span className="text-[9px] font-semibold uppercase" style={{ color: onSecondaryVar }}>
                {ringUnit}
              </span>
            ) : null}
          </div>
        </div>
      </div>

      <span
        className="relative mt-[var(--fc-space-md)] inline-flex w-fit items-center gap-[var(--fc-space-xs)] rounded-full px-[var(--fc-space-md)] py-[var(--fc-space-xs)] text-sm font-semibold"
        style={{
          color: statusColorVar,
          backgroundColor: `color-mix(in srgb, ${statusColorVar} 16%, transparent)`,
        }}
      >
        {statusLine}
      </span>
      {conflictLines.length > 1
        ? conflictLines.slice(1).map((line) => (
            <span
              key={line}
              className="relative mt-[var(--fc-space-xs)] block text-xs font-medium"
              style={{ color: statusColorVar }}
            >
              {line}
            </span>
          ))
        : null}

      {/* Travel / origin */}
      <div
        className="relative mt-[var(--fc-space-lg)] flex flex-col gap-[var(--fc-space-sm)] pt-[var(--fc-space-md)]"
        style={{ borderTop: `1px solid ${dividerVar}` }}
      >
        <span className="text-xs" style={{ color: onSecondaryVar }}>
          {agendaLeaveByLine(item)}
        </span>
        <div className="flex items-center justify-between gap-[var(--fc-space-md)]">
          <span className="text-xs" style={{ color: onSecondaryVar }}>
            Leave from
          </span>
          {locatedPlaces.length <= 1 ? (
            <span className="text-sm font-medium" style={{ color: onVar }}>
              {item.leaveFromPlaceName ?? locatedPlaces[0]?.name ?? "No located places yet"}
            </span>
          ) : (
            <select
              aria-label={`Leave from for ${item.title}`}
              className="h-9 rounded-md border bg-transparent px-2 text-sm"
              style={{ borderColor: dividerVar, color: onVar }}
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
      <div
        className="relative mt-[var(--fc-space-lg)] flex flex-col gap-[var(--fc-space-sm)] pt-[var(--fc-space-md)]"
        style={{ borderTop: `1px solid ${dividerVar}` }}
      >
        <span className="text-xs" style={{ color: onSecondaryVar }}>
          {calendarSourceLabel(item.source, item.feedName)}
        </span>
        {item.kidIds.map((kidId) => {
          const kid = circle.kids.find((k) => k.id === kidId)
          const kidName = kid?.displayName?.trim() || "Kid"
          const status = rsvpStatusForKid(item, kidId)
          return (
            <div key={kidId} className="flex items-center justify-between gap-[var(--fc-space-md)]">
              <span className="text-sm" style={{ color: onSecondaryVar }}>
                {kidName}
              </span>
              <select
                aria-label={`RSVP for ${kidName} on ${item.title}`}
                data-testid={`rsvp-${item.source}-${item.id}-${kidId}`}
                className="h-9 rounded-md border bg-transparent px-2 text-sm"
                style={{ borderColor: dividerVar, color: onVar }}
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
      <div
        className="relative mt-[var(--fc-space-lg)] flex flex-col gap-[var(--fc-space-sm)] pt-[var(--fc-space-md)]"
        style={{ borderTop: `1px solid ${dividerVar}` }}
      >
        {active.map((coverage) => (
          <div key={coverage.id} className="flex items-center justify-between gap-[var(--fc-space-md)]">
            <span className="text-xs" style={{ color: onSecondaryVar }}>
              {coverageAdultLabel(coverage, circle.members)} ·{" "}
              {coverageKidNames(coverage, circle.kids)} · {coverageStatusLabel(coverage.status)}
            </span>
            <Button
              type="button"
              size="sm"
              variant={needsDecision ? "secondary" : "outline"}
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
              style={needsDecision ? { backgroundColor: onVar, color: surfaceVar } : undefined}
              onClick={() => onConfirmCoverage(pendingForSelf.id)}
              disabled={loading}
            >
              Confirm coverage
            </Button>
            <Button
              type="button"
              size="sm"
              variant={needsDecision ? "secondary" : "outline"}
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
                <span className="text-xs" style={{ color: onSecondaryVar }}>
                  Covering adult
                </span>
                <select
                  aria-label={`Covering adult for ${item.title}`}
                  className="h-9 rounded-md border bg-transparent px-2 text-sm"
                  style={{ borderColor: dividerVar, color: onVar }}
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
              style={
                needsDecision && !pendingForSelf
                  ? { backgroundColor: onVar, color: surfaceVar }
                  : undefined
              }
              variant={!needsDecision ? (pendingForSelf ? "outline" : "default") : undefined}
              onClick={() => onAssignCoverage(assignDraft.adultId, assignDraft.kidIds)}
              disabled={loading || !assignDraft.adultId || assignDraft.kidIds.length === 0}
            >
              Assign coverage
            </Button>
          </div>
        ) : null}

        {coverageActionError ? (
          <p role="alert" className="text-sm" style={{ color: errorColorVar }}>
            {coverageActionError}
          </p>
        ) : null}
      </div>

      {isManual ? (
        <div
          className="relative mt-[var(--fc-space-lg)] flex gap-[var(--fc-space-sm)] pt-[var(--fc-space-md)]"
          style={{ borderTop: `1px solid ${dividerVar}` }}
        >
          <Button
            type="button"
            size="sm"
            variant={needsDecision ? "secondary" : "outline"}
            onClick={onEdit}
            disabled={loading}
          >
            Edit
          </Button>
          <Button
            type="button"
            size="sm"
            variant={needsDecision ? "secondary" : "outline"}
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
