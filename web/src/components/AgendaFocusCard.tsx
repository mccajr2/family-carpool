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
  pendingCoverageForAdult,
} from "@/components/coverageDisplay"
import { formatEventWhen } from "@/components/eventTimes"
import { agendaLeaveByLine } from "@/components/leaveByDisplay"
import { rsvpStatusForKid, rsvpStatusLabel } from "@/components/rsvpDisplay"

import { AgendaStatusChip, type AgendaStatusChipTone } from "@/components/agendaStatusChip"

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

/** Matches design-tokens spacing.focusRing (96) and focusRingStroke (6). */
const RING_BOX = 96
const RING_STROKE = 6
const RING_CENTER = RING_BOX / 2
const RING_RADIUS = RING_CENTER - RING_STROKE / 2 - 2
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS
/** Ring reads full at 3+ hours out, empty at 0 — a decorative urgency cue, not a literal countdown. */
const RING_MAX_MINUTES = 180

function minutesUntil(iso: string | null | undefined): number | null {
  if (!iso) return null
  const target = new Date(iso).getTime()
  if (Number.isNaN(target)) return null
  return Math.max(0, Math.round((target - Date.now()) / 60000))
}

function focusStatusChips(item: CalendarItem, needsDecision: boolean): { label: string; tone: AgendaStatusChipTone }[] {
  const active = activeCoverages(item)
  const chips: { label: string; tone: AgendaStatusChipTone }[] = []
  if (item.conflicts.length > 0) {
    chips.push({ label: "Overlaps", tone: "amber" })
  }
  if (item.uncoveredKidIds.length > 0) {
    chips.push({ label: "Needs coverage", tone: "amber" })
  } else if (needsDecision) {
    chips.push({ label: "Needs coverage", tone: "amber" })
  } else if (active.some((c) => c.status === "CONFIRMED")) {
    chips.push({ label: "Confirmed", tone: "mint" })
  } else {
    chips.push({ label: "All set", tone: "mint" })
  }
  return chips
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
  const active = activeCoverages(item)
  const pendingForSelf = pendingCoverageForAdult(item, currentAdultId)
  const locatedPlaces = circle.places.filter(isPlaceLocated)
  const statusChips = focusStatusChips(item, needsDecision)
  const confirmedCoverage = active.find((c) => c.status === "CONFIRMED")
  const coveringLine = confirmedCoverage
    ? `Covering: ${coverageAdultLabel(confirmedCoverage, circle.members)}`
    : null

  const mins = useMemo(() => minutesUntil(item.leaveByAt ?? item.startsAt), [item.leaveByAt, item.startsAt])
  const ringFraction = mins == null ? 1 : Math.min(1, mins / RING_MAX_MINUTES)
  const ringDashoffset = RING_CIRCUMFERENCE * (1 - ringFraction)
  const { label: ringLabel, unit: ringUnit } = formatRingCountdown(mins)

  const surfaceVar = needsDecision ? "var(--fc-hero-surface)" : "var(--fc-surface-raised)"
  const onVar = needsDecision ? "var(--fc-hero-on)" : "var(--fc-text-primary)"
  const onSecondaryVar = needsDecision ? "var(--fc-hero-on-secondary)" : "var(--fc-text-secondary)"
  const errorColorVar = needsDecision ? "var(--fc-hero-danger)" : "var(--fc-danger)"
  const ringColorVar = needsDecision ? "var(--fc-hero-danger)" : "var(--fc-hero-success)"
  const borderVar = needsDecision ? "transparent" : "var(--fc-border)"
  const dividerVar = needsDecision ? "rgba(255,255,255,0.12)" : "var(--fc-border)"
  const ringTrackVar = needsDecision ? "rgba(255,255,255,0.14)" : "var(--fc-border)"
  const conflictColorVar = needsDecision ? "var(--fc-hero-danger)" : "var(--fc-danger)"

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

      {/* Header — primary column + isolated ring column (Calendar mock) */}
      <div className="relative flex items-start gap-[var(--fc-space-lg)]">
        <div className="flex min-w-0 flex-1 flex-col gap-[var(--fc-space-sm)]">
          <span
            className="text-xs font-semibold uppercase tracking-wide"
            style={{ color: onSecondaryVar }}
          >
            {formatEventWhen(item.startsAt, item.endsAt)}
          </span>
          <span
            className="fc-display text-[length:var(--fc-font-focus-title-size)] font-bold leading-[var(--fc-font-focus-title-line)]"
            style={{ color: onVar, fontWeight: "var(--fc-font-focus-title-weight)" }}
          >
            {item.title}
          </span>
          {item.location ? (
            <span className="text-sm" style={{ color: onSecondaryVar }}>
              {item.location}
            </span>
          ) : null}
          {statusChips.length > 0 ? (
            <div
              className="flex flex-wrap gap-[var(--fc-space-xs)]"
              data-testid="agenda-focus-chips"
            >
              {statusChips.map((chip) => (
                <AgendaStatusChip
                  key={chip.label}
                  label={chip.label}
                  tone={chip.tone}
                  variant={needsDecision ? "hero" : "default"}
                />
              ))}
            </div>
          ) : null}
        </div>

        <div
          className="flex flex-shrink-0 flex-col items-center"
          style={{ width: "var(--fc-space-focus-ring)" }}
          data-testid="agenda-focus-ring"
        >
          <div
            className="relative"
            style={{ width: "var(--fc-space-focus-ring)", height: "var(--fc-space-focus-ring)" }}
          >
            <svg
              width={RING_BOX}
              height={RING_BOX}
              viewBox={`0 0 ${RING_BOX} ${RING_BOX}`}
              className="-rotate-90"
            >
              <circle
                cx={RING_CENTER}
                cy={RING_CENTER}
                r={RING_RADIUS}
                fill="none"
                stroke={ringTrackVar}
                strokeWidth={RING_STROKE}
              />
              <circle
                cx={RING_CENTER}
                cy={RING_CENTER}
                r={RING_RADIUS}
                fill="none"
                stroke={ringColorVar}
                strokeWidth={RING_STROKE}
                strokeLinecap="round"
                strokeDasharray={RING_CIRCUMFERENCE}
                strokeDashoffset={ringDashoffset}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span
                className="text-[length:var(--fc-font-focus-ring-label-size)] leading-[var(--fc-font-focus-ring-label-line)]"
                style={{ color: onVar, fontWeight: "var(--fc-font-focus-ring-label-weight)" }}
              >
                {ringLabel}
              </span>
              {ringUnit ? (
                <span
                  className="uppercase text-[length:var(--fc-font-focus-ring-unit-size)] leading-[var(--fc-font-focus-ring-unit-line)]"
                  style={{ color: onSecondaryVar, fontWeight: "var(--fc-font-focus-ring-unit-weight)" }}
                >
                  {ringUnit}
                </span>
              ) : null}
            </div>
          </div>
          {coveringLine ? (
            <span
              className="mt-[var(--fc-space-focus-ring-covering-gap)] text-center text-xs"
              style={{ color: onSecondaryVar }}
              data-testid="agenda-focus-covering"
            >
              {coveringLine}
            </span>
          ) : null}
        </div>
      </div>

      {conflictLines.length > 0 ? (
        <ul
          className="relative mt-[var(--fc-space-md)] flex flex-col gap-[2px]"
          data-testid={`agenda-focus-conflicts-${item.source}-${item.id}`}
          aria-label="Schedule conflicts"
        >
          {conflictLines.map((line) => (
            <li key={line} className="text-xs font-medium" style={{ color: conflictColorVar }}>
              {line}
            </li>
          ))}
        </ul>
      ) : null}

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
