import { useState } from "react"
import { ChevronDown, ChevronRight, Navigation } from "lucide-react"

import type {
  CalendarItem,
  CarpoolRideEvent,
  FamilyCircle,
} from "@/api/types"
import { AgendaStatusChip } from "@/components/agendaStatusChip"
import { agendaCommitmentActionsForItems } from "@/components/agendaCommitmentActions"
import { canRoute } from "@/components/canRoute"
import { calendarSourceLabel } from "@/components/coverageDisplay"
import { EventLocationLine } from "@/components/EventLocationLine"
import { formatCompactEventWhen } from "@/components/eventTimes"
import { mapCalendarItemToCoverageGames } from "@/components/coverageQueue"
import { rideStatusChipsForItem } from "@/components/rideStatusChip"
import { isAgendaItemOutOfPlay } from "@/components/rsvpDisplay"
import { Button } from "@/components/ui/button"
import {
  SandboxOverflowMenu,
  type SandboxOverflowItem,
} from "@/sandbox/SandboxOverflowMenu"

function teamLabelFor(item: CalendarItem): string | null {
  const feedName = item.feedName?.trim()
  if (feedName) {
    return feedName
  }
  if (item.source === "FEED") {
    return calendarSourceLabel(item.source, item.feedName)
  }
  return null
}

type ProposedAgendaRowProps = {
  item: CalendarItem
  circle: FamilyCircle
  currentAdultId: string
  rideEvent?: CarpoolRideEvent | null
  isFocused?: boolean
  defaultOpen?: boolean
}

/**
 * Audit-proposed agenda row: keep header hierarchy; expanded = primary CTA + More.
 */
export function ProposedAgendaRow({
  item,
  circle,
  currentAdultId,
  rideEvent = null,
  isFocused = false,
  defaultOpen = false,
}: ProposedAgendaRowProps) {
  const [open, setOpen] = useState(defaultOpen)
  const outOfPlay = isAgendaItemOutOfPlay(item)
  const teamLabel = teamLabelFor(item)
  const whenLabel = formatCompactEventWhen(item.startsAt, item.endsAt)
  const games = mapCalendarItemToCoverageGames(item, rideEvent, {
    currentAdultId,
    members: circle.members,
  })
  const routable = games.some((game) => canRoute(game, rideEvent))
  const tags = rideStatusChipsForItem(item, games, rideEvent?.ownRequest, {
    rideEvent,
    circleId: circle.id,
    currentAdultId,
  })
  const commitmentActions = agendaCommitmentActionsForItems([item], {
    circle,
    currentAdultId,
    rideEventFor: () => rideEvent,
  })
  const moreItems: SandboxOverflowItem[] = [
    ...commitmentActions.map((action) => ({
      key: action.key,
      label: action.label,
      testId: `proposed-row-more-${action.key}`,
    })),
    { key: "edit", label: "Edit event" },
    { key: "remove", label: "Remove event" },
  ]
  const ChevronIcon = open ? ChevronDown : ChevronRight

  return (
    <article
      data-testid={`proposed-agenda-row-${item.source}-${item.id}`}
      data-focused={isFocused ? "true" : "false"}
      className={`overflow-hidden rounded-[var(--fc-radius-xl)] border bg-[var(--fc-surface-raised)] ${
        isFocused
          ? "border-[var(--fc-list-row-focus-border)]"
          : "border-[var(--fc-border)]"
      }`}
    >
      <button
        type="button"
        className="flex w-full items-start justify-between gap-[var(--fc-space-md)] px-[var(--fc-space-list-row-pad-x)] pt-[var(--fc-space-list-row-pad-y)] text-left"
        aria-expanded={open}
        data-testid="proposed-agenda-row-toggle"
        onClick={() => setOpen((value) => !value)}
      >
        <span className="min-w-0 flex-1">
          {teamLabel != null ? (
            <span className="block uppercase tracking-wide text-[length:var(--fc-font-list-row-team-size)] leading-[var(--fc-font-list-row-team-line)] font-[number:var(--fc-font-list-row-team-weight)] text-[var(--fc-text-secondary)]">
              {teamLabel}
            </span>
          ) : null}
          <span
            data-testid="proposed-agenda-row-title"
            className={`block text-[length:var(--fc-font-list-row-title-size)] leading-[var(--fc-font-list-row-title-line)] font-[number:var(--fc-font-list-row-title-weight)] ${
              outOfPlay
                ? "text-[var(--fc-text-secondary)]"
                : "text-[var(--fc-text-primary)]"
            }`}
          >
            {item.title}
          </span>
          <span
            data-testid="proposed-agenda-row-when"
            className="mt-0.5 block text-[length:var(--fc-font-list-row-meta-size)] leading-[var(--fc-font-list-row-meta-line)] font-[number:var(--fc-font-list-row-meta-weight)] text-[var(--fc-text-secondary)]"
          >
            {whenLabel}
          </span>
          <EventLocationLine
            location={item.location}
            data-testid="proposed-agenda-row-where"
            className="mt-0.5"
          />
        </span>
        <span className="flex shrink-0 items-center gap-[var(--fc-space-sm)]">
          {tags.map((tag) => (
            <AgendaStatusChip key={tag.label} label={tag.label} tone={tag.tone} />
          ))}
          {routable ? (
            <span
              data-testid="proposed-agenda-row-route"
              className="inline-flex rounded-full p-[var(--fc-space-ride-detail-open-ride-pad)] text-[var(--fc-accent)] bg-[color-mix(in_srgb,var(--fc-accent)_16%,transparent)]"
            >
              <Navigation aria-hidden size={14} />
            </span>
          ) : null}
          <ChevronIcon
            aria-hidden
            className="shrink-0 text-[var(--fc-text-secondary)]"
            style={{
              width: "var(--fc-font-list-row-chevron-size)",
              height: "var(--fc-font-list-row-chevron-size)",
            }}
          />
        </span>
      </button>

      {open ? (
        <div
          data-testid="proposed-agenda-row-expanded"
          className="flex flex-wrap items-center gap-[var(--fc-space-sm)] border-t border-[var(--fc-border)] px-[var(--fc-space-list-row-pad-x)] py-[var(--fc-space-md)]"
        >
          <Button type="button" data-testid="proposed-agenda-row-primary">
            {routable ? "View route" : "Confirm / assign"}
          </Button>
          <SandboxOverflowMenu
            label="More actions"
            testId="proposed-agenda-row-more"
            items={moreItems}
            footer="Sandbox — not writing"
          />
        </div>
      ) : (
        <div className="pb-[var(--fc-space-sm)]" />
      )}
    </article>
  )
}
