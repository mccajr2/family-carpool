import { useState } from "react"
import type { CalendarItem, FamilyCircle, RsvpStatus } from "@/api/types"
import { isPlaceLocated } from "@/api/types"
import { Button } from "@/components/ui/button"
import { formatEventWhen } from "@/components/eventTimes"
import { agendaLeaveByLine } from "@/components/leaveByDisplay"
import { conflictDisplayLines } from "@/components/conflictDisplay"
import {
  isAgendaItemOutOfPlay,
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

type AssignDraft = { adultId: string; kidIds: string[]; soleAdult: boolean; soleKid: boolean }

type AgendaRowProps = {
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

type Tag = { label: string; tone: "mint" | "amber" | "route" | "muted" }

/**
 * Redesigned flat Agenda row: collapsed by default (title, time, status
 * dot, up to 2 tags), tap/click to expand the same field-row bands as
 * AgendaFocusCard (leave-from, per-kid RSVP, coverage, manual actions).
 * Out-of-play items (every kid RSVP No) render muted and start collapsed
 * with no auto-expand affordance beyond the summary + "Not going" tag.
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
  const isManual = item.source === "MANUAL"
  const outOfPlay = isAgendaItemOutOfPlay(item)
  const needsDecision = !outOfPlay && (item.uncoveredKidIds.length > 0 || item.conflicts.length > 0)
  const active = activeCoverages(item)
  const pendingForSelf = pendingCoverageForAdult(item, currentAdultId)
  const locatedPlaces = circle.places.filter(isPlaceLocated)
  const conflictLines = conflictDisplayLines(item.conflicts, circle.kids)
  const uncoveredKidNames = eventKidNames(item.uncoveredKidIds, circle.kids)

  const statusDot = outOfPlay ? "off" : needsDecision ? "needs" : "confirmed"

  const tags: Tag[] = []
  if (outOfPlay) {
    tags.push({ label: "Not going", tone: "muted" })
  } else {
    if (item.conflicts.length > 0) tags.push({ label: "Overlaps", tone: "amber" })
    if (item.uncoveredKidIds.length > 0) tags.push({ label: "Needs coverage", tone: "amber" })
    else if (active.length > 0) tags.push({ label: "Confirmed", tone: "mint" })
  }

  const tagToneClass: Record<Tag["tone"], string> = {
    mint: "text-[var(--fc-success)] bg-[color-mix(in_srgb,var(--fc-success)_14%,transparent)]",
    amber: "text-[var(--fc-danger)] bg-[color-mix(in_srgb,var(--fc-danger)_14%,transparent)]",
    route: "text-[var(--fc-accent)] bg-[color-mix(in_srgb,var(--fc-accent)_14%,transparent)]",
    muted: "text-[var(--fc-text-secondary)] bg-[var(--fc-surface)]",
  }
  const dotToneClass: Record<string, string> = {
    confirmed: "bg-[var(--fc-success)]",
    needs: "bg-[var(--fc-danger)]",
    off: "bg-[var(--fc-text-secondary)]",
  }

  return (
    <div
      data-testid={`agenda-row-${item.source}-${item.id}`}
      className={`rounded-[var(--fc-radius-md)] border border-[var(--fc-border)] bg-[var(--fc-surface-raised)] px-[var(--fc-space-lg)] py-[var(--fc-space-md)] transition-colors ${outOfPlay ? "opacity-60" : ""}`}
    >
      <button
        type="button"
        className="flex w-full items-center gap-[var(--fc-space-md)] text-left"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span className={`h-[9px] w-[9px] flex-shrink-0 rounded-full ${dotToneClass[statusDot]}`} />
        <span className="min-w-0 flex-1">
          <span
            className={`block truncate text-[15.5px] font-semibold ${outOfPlay ? "text-[var(--fc-text-secondary)]" : "text-[var(--fc-text-primary)]"}`}
          >
            {item.title}
          </span>
          <span className="block truncate text-xs text-[var(--fc-text-secondary)]">
            {formatEventWhen(item.startsAt, item.endsAt)}
            {item.location ? ` · ${item.location}` : ""}
          </span>
        </span>
        {tags.length > 0 ? (
          <span className="hidden flex-shrink-0 gap-[var(--fc-space-xs)] sm:flex">
            {tags.map((tag) => (
              <span
                key={tag.label}
                className={`rounded-full px-[var(--fc-space-md)] py-[2px] text-[11px] font-bold uppercase tracking-wide ${tagToneClass[tag.tone]}`}
              >
                {tag.label}
              </span>
            ))}
          </span>
        ) : null}
        <span
          className="flex-shrink-0 text-[var(--fc-text-secondary)] transition-transform"
          style={{ transform: open ? "rotate(90deg)" : undefined }}
        >
          ›
        </span>
      </button>

      {open ? (
        <div className="mt-[var(--fc-space-md)] flex flex-col gap-[var(--fc-space-lg)] border-t border-[var(--fc-border)] pt-[var(--fc-space-md)]">
          {!outOfPlay && conflictLines.length > 0 ? (
            <div className="flex flex-col gap-[2px]">
              {conflictLines.map((line) => (
                <span key={line} className="text-xs font-medium text-[var(--fc-danger)]">
                  {line}
                </span>
              ))}
            </div>
          ) : null}

          {/* Travel / origin */}
          {!outOfPlay ? (
            <div className="flex flex-col gap-[var(--fc-space-sm)]">
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
          ) : null}

          {/* People / source */}
          <div className="flex flex-col gap-[var(--fc-space-sm)]">
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
            <div className="flex flex-col gap-[var(--fc-space-sm)]">
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
              {item.uncoveredKidIds.length > 0 ? (
                <p className="text-sm text-[var(--fc-danger)]">
                  {uncoveredKidNames ? `Needs coverage: ${uncoveredKidNames}` : "Needs coverage"}
                </p>
              ) : null}
              {pendingForSelf ? (
                <div className="flex gap-[var(--fc-space-sm)]">
                  <Button type="button" size="sm" onClick={() => onConfirmCoverage(pendingForSelf.id)} disabled={loading}>
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
                <p role="alert" className="text-sm text-[var(--fc-danger)]">
                  {coverageActionError}
                </p>
              ) : null}
            </div>
          ) : null}

          {isManual ? (
            <div className="flex gap-[var(--fc-space-sm)]">
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
