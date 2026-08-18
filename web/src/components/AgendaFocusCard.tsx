import { useMemo } from "react"
import type { CalendarItem, FamilyCircle } from "@/api/types"
import { Button } from "@/components/ui/button"
import { formatRingCountdown } from "@/components/agendaFocusRing"
import { focusItemNeedsDecision } from "@/components/agendaFocusSelection"
import { AgendaStatusChip, type AgendaStatusChipTone } from "@/components/agendaStatusChip"
import {
  activeCoverages,
  coverageAdultLabel,
  eventKidNames,
  memberLabel,
  pendingCoverageForAdult,
} from "@/components/coverageDisplay"
import { formatFocusEventWhen } from "@/components/eventTimes"

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
  onReassignCoverage: (assignmentId: string, adultId: string, kidIds: string[]) => void
  onConfirmCoverage: (assignmentId: string) => void
  onDeclineCoverage: (assignmentId: string) => void
  onRemoveCoverage: (assignmentId: string) => void
  onOpenPlaces: () => void
  onEdit: () => void
}

/** Matches design-tokens spacing.focusRing (88) and focusRingStroke (6). */
const RING_BOX = 88
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

function focusMetaLine(item: CalendarItem, circle: FamilyCircle): string | null {
  const segments: string[] = []
  const kids = eventKidNames(item.kidIds, circle.kids)
  if (kids) segments.push(kids)
  const destination = item.location?.trim()
  if (destination) segments.push(destination)
  const origin = item.leaveFromPlaceName?.trim()
  if (origin) segments.push(`Leaving from ${origin}`)
  return segments.length > 0 ? segments.join(" · ") : null
}

/**
 * Exactly one item at a time renders this way — selection logic lives in
 * agendaFocusSelection.ts. See docs/agenda-focus-card-addendum.md.
 *
 * Spotlight summary + one next action. Leave-from, RSVP, coverage kid-subset,
 * and Remove event stay on expanded AgendaRow (or Edit dialog for manual
 * Remove). Change/remove coverage stay on Focus — the promoted item is not
 * in the day list. Same assign/confirm/reassign/remove handlers as a row.
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
  onReassignCoverage,
  onConfirmCoverage,
  onDeclineCoverage,
  onRemoveCoverage,
  onOpenPlaces,
  onEdit,
}: AgendaFocusCardProps) {
  const isManual = item.source === "MANUAL"
  const needsDecision = focusItemNeedsDecision(item, currentAdultId)

  const active = activeCoverages(item)
  const pendingForSelf = pendingCoverageForAdult(item, currentAdultId)
  const statusChips = focusStatusChips(item, needsDecision)
  const activeCoverage = active[0]
  const showAssign = item.uncoveredKidIds.length > 0 && circle.members.length > 0 && !pendingForSelf
  const showAssignSelect = showAssign && !assignDraft.soleAdult
  const showChangeSelect = Boolean(activeCoverage) && circle.members.length > 1 && !showAssignSelect
  const showCoveringSelect = showAssignSelect || showChangeSelect
  const showCoveringRow = showCoveringSelect || Boolean(activeCoverage)
  const showRemoveCoverage = Boolean(activeCoverage) && !pendingForSelf
  const metaLine = focusMetaLine(item, circle)
  const showOpenPlaces = item.leaveByStatus === "UNAVAILABLE" && item.leaveByReason === "NO_ORIGIN"

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

      <div className="relative flex items-start gap-[var(--fc-space-xl)]">
        <div className="flex min-w-0 flex-1 flex-col">
          <span
            className="fc-display text-[length:var(--fc-font-focus-when-size)] leading-[var(--fc-font-focus-when-line)] font-[number:var(--fc-font-focus-when-weight)]"
            style={{ color: onSecondaryVar }}
          >
            {formatFocusEventWhen(item.startsAt, item.endsAt)}
          </span>
          <span
            className="fc-display mt-[var(--fc-space-focus-title-gap)] text-[length:var(--fc-font-focus-title-size)] leading-[var(--fc-font-focus-title-line)] font-[number:var(--fc-font-focus-title-weight)]"
            style={{ color: onVar }}
          >
            {item.title}
          </span>
          {metaLine ? (
            <span
              className="mt-[var(--fc-space-xs)] min-w-0 text-[length:var(--fc-font-subtitle-size)] leading-[var(--fc-font-subtitle-line)] font-[number:var(--fc-font-subtitle-weight)]"
              style={{ color: onSecondaryVar }}
            >
              {metaLine}
            </span>
          ) : null}
          {statusChips.length > 0 ? (
            <div
              className="mt-[var(--fc-space-lg)] flex flex-wrap gap-[var(--fc-space-xs)]"
              data-testid="agenda-focus-chips"
            >
              {statusChips.map((chip) => (
                <AgendaStatusChip
                  key={chip.label}
                  label={chip.label}
                  tone={chip.tone}
                  variant={needsDecision ? "hero" : "default"}
                  appearance="pill"
                />
              ))}
            </div>
          ) : null}
        </div>

        <div
          className="flex flex-shrink-0 flex-col items-center gap-[var(--fc-space-focus-ring-covering-gap)]"
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
                className="fc-display text-[length:var(--fc-font-focus-ring-label-size)] leading-[var(--fc-font-focus-ring-label-line)] font-[number:var(--fc-font-focus-ring-label-weight)]"
                style={{ color: onVar }}
              >
                {ringLabel}
              </span>
              {ringUnit ? (
                <span
                  className="uppercase text-[length:var(--fc-font-focus-ring-unit-size)] leading-[var(--fc-font-focus-ring-unit-line)] font-[number:var(--fc-font-focus-ring-unit-weight)] tracking-wide"
                  style={{ color: onSecondaryVar }}
                >
                  {ringUnit}
                </span>
              ) : null}
            </div>
          </div>
          {showCoveringRow ? (
            <label
              className="flex w-max items-center gap-[var(--fc-space-sm)] whitespace-nowrap"
              data-testid="agenda-focus-covering"
            >
              <span
                className="text-[length:var(--fc-font-focus-covering-size)] leading-[var(--fc-font-focus-covering-line)] font-[number:var(--fc-font-focus-covering-weight)]"
                style={{ color: onSecondaryVar }}
              >
                Covering
              </span>
              {showCoveringSelect ? (
                <select
                  aria-label={`Covering adult for ${item.title}`}
                  className="rounded-md border bg-transparent px-[var(--fc-space-md)] py-[var(--fc-space-focus-covering-pad-y)] text-[length:var(--fc-font-focus-covering-size)] leading-[var(--fc-font-focus-covering-line)] font-[number:var(--fc-font-focus-covering-weight)]"
                  style={{ borderColor: dividerVar, color: onVar }}
                  value={
                    showChangeSelect && activeCoverage
                      ? activeCoverage.coveringAdultId
                      : assignDraft.adultId
                  }
                  onChange={(e) => {
                    const adultId = e.target.value
                    if (showChangeSelect && activeCoverage) {
                      if (adultId !== activeCoverage.coveringAdultId) {
                        onReassignCoverage(activeCoverage.id, adultId, activeCoverage.kidIds)
                      }
                      return
                    }
                    onUpdateAssignDraft({ adultId })
                  }}
                  disabled={loading}
                >
                  {circle.members.map((m) => (
                    <option key={m.adultId} value={m.adultId}>
                      {memberLabel(m)}
                    </option>
                  ))}
                </select>
              ) : (
                <span
                  className="text-[length:var(--fc-font-focus-covering-size)] leading-[var(--fc-font-focus-covering-line)] font-[number:var(--fc-font-focus-covering-weight)]"
                  style={{ color: onVar }}
                >
                  {coverageAdultLabel(activeCoverage!, circle.members)}
                </span>
              )}
            </label>
          ) : null}
        </div>
      </div>

      <div className="relative mt-[var(--fc-space-focus-actions-gap)] flex flex-wrap items-center gap-[var(--fc-space-sm)]">
        {pendingForSelf ? (
          <>
            <Button
              type="button"
              size="sm"
              className="text-[length:var(--fc-font-focus-action-size)] leading-[var(--fc-font-focus-action-line)] font-[number:var(--fc-font-focus-action-weight)]"
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
              className="text-[length:var(--fc-font-focus-action-ghost-size)] leading-[var(--fc-font-focus-action-ghost-line)] font-[number:var(--fc-font-focus-action-ghost-weight)]"
              onClick={() => onDeclineCoverage(pendingForSelf.id)}
              disabled={loading}
            >
              Decline coverage
            </Button>
          </>
        ) : null}
        {showAssign ? (
          <Button
            type="button"
            size="sm"
            className="text-[length:var(--fc-font-focus-action-size)] leading-[var(--fc-font-focus-action-line)] font-[number:var(--fc-font-focus-action-weight)]"
            style={needsDecision ? { backgroundColor: onVar, color: surfaceVar } : undefined}
            variant={!needsDecision ? "default" : undefined}
            onClick={() => onAssignCoverage(assignDraft.adultId, assignDraft.kidIds)}
            disabled={loading || !assignDraft.adultId || assignDraft.kidIds.length === 0}
          >
            Assign coverage
          </Button>
        ) : null}
        {showRemoveCoverage && activeCoverage ? (
          <Button
            type="button"
            size="sm"
            variant={needsDecision ? "secondary" : "outline"}
            className="text-[length:var(--fc-font-focus-action-ghost-size)] leading-[var(--fc-font-focus-action-ghost-line)] font-[number:var(--fc-font-focus-action-ghost-weight)]"
            onClick={() => onRemoveCoverage(activeCoverage.id)}
            disabled={loading}
          >
            Remove coverage
          </Button>
        ) : null}
        {showOpenPlaces ? (
          <Button
            type="button"
            size="sm"
            variant={needsDecision ? "secondary" : "outline"}
            className="text-[length:var(--fc-font-focus-action-ghost-size)] leading-[var(--fc-font-focus-action-ghost-line)] font-[number:var(--fc-font-focus-action-ghost-weight)]"
            onClick={onOpenPlaces}
            disabled={loading}
          >
            Open Places
          </Button>
        ) : null}
        {isManual ? (
          <Button
            type="button"
            size="sm"
            variant={needsDecision ? "secondary" : "outline"}
            className="text-[length:var(--fc-font-focus-action-ghost-size)] leading-[var(--fc-font-focus-action-ghost-line)] font-[number:var(--fc-font-focus-action-ghost-weight)]"
            onClick={onEdit}
            disabled={loading}
          >
            Edit
          </Button>
        ) : null}
      </div>

      {coverageActionError ? (
        <p role="alert" className="relative mt-[var(--fc-space-sm)] text-sm" style={{ color: errorColorVar }}>
          {coverageActionError}
        </p>
      ) : null}
    </div>
  )
}
