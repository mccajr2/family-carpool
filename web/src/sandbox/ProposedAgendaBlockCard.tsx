import { useState } from "react"

import type {
  CalendarItem,
  CarpoolRideEvent,
  FamilyCircle,
} from "@/api/types"
import {
  buildAgendaBlockSections,
  type AgendaBlockRunSection,
} from "@/components/agendaBlockSections"
import {
  agendaCommitmentActionsForItems,
  blockDepartureItem,
} from "@/components/agendaCommitmentActions"
import { canRoute } from "@/components/canRoute"
import { calendarItemKey, calendarSourceLabel } from "@/components/coverageDisplay"
import { mapCalendarItemToCoverageGames } from "@/components/coverageQueue"
import { agendaBlockDriveBlockControls } from "@/components/driveBlockAgendaLinks"
import { EventLocationLine } from "@/components/EventLocationLine"
import { formatAgendaBlockDayLabel } from "@/components/eventTimes"
import { agendaLeaveByLine } from "@/components/leaveByDisplay"
import {
  SandboxOverflowMenu,
  type SandboxOverflowItem,
} from "@/sandbox/SandboxOverflowMenu"

function blockTitle(items: CalendarItem[]): string {
  if (items.length === 0) {
    return "Drive block"
  }
  if (items.length === 1) {
    return items[0]!.title
  }
  return `${items[0]!.title} + ${items.length - 1} more`
}

function ProposedRunSection({
  run,
  testId,
  showViewRoute,
}: {
  run: AgendaBlockRunSection
  testId: string
  showViewRoute: boolean
}) {
  const [detailOpen, setDetailOpen] = useState(false)
  const hasDetail = run.detailLines.length > 0

  return (
    <div
      data-testid={testId}
      className="rounded-[var(--fc-radius-lg)] border border-[var(--fc-border)] px-[var(--fc-space-md)] py-[var(--fc-space-md)]"
    >
      <div className="flex flex-wrap items-start justify-between gap-x-[var(--fc-space-md)] gap-y-[var(--fc-space-sm)]">
        <span
          data-testid={`${testId}-heading`}
          className="text-[length:var(--fc-font-list-row-title-size)] leading-[var(--fc-font-list-row-title-line)] font-[number:var(--fc-font-list-row-title-weight)] text-[var(--fc-text-primary)]"
        >
          {run.heading}
        </span>
        <span
          data-testid={`${testId}-chip`}
          className="rounded-full px-[var(--fc-space-feed-chip-pad-x)] py-[var(--fc-space-feed-chip-pad-y)] text-[length:var(--fc-font-feed-chip-size)] uppercase leading-[var(--fc-font-feed-chip-line)] font-[number:var(--fc-font-feed-chip-weight)] text-[var(--fc-success)] bg-[color-mix(in_srgb,var(--fc-success)_14%,transparent)]"
        >
          {run.chipLabel}
        </span>
      </div>
      {run.summaryLine != null ? (
        <p
          data-testid={`${testId}-summary`}
          className="mt-[var(--fc-space-sm)] text-[length:var(--fc-font-list-row-meta-size)] leading-[var(--fc-font-list-row-meta-line)] text-[var(--fc-text-secondary)]"
        >
          {run.summaryLine}
        </p>
      ) : null}
      {showViewRoute ? (
        <button
          type="button"
          data-testid={`${testId}-view-route`}
          className="mt-[var(--fc-space-sm)] text-xs font-medium text-[var(--fc-accent)]"
        >
          View route
        </button>
      ) : null}
      {hasDetail ? (
        <div className="mt-[var(--fc-space-sm)]">
          <button
            type="button"
            className="text-xs text-[var(--fc-text-secondary)] underline underline-offset-2"
            aria-expanded={detailOpen}
            data-testid={`${testId}-detail-toggle`}
            onClick={() => setDetailOpen((open) => !open)}
          >
            {detailOpen ? "Hide details" : "Show details"}
          </button>
          {detailOpen ? (
            <ul
              data-testid={`${testId}-detail`}
              className="mt-[var(--fc-space-sm)] flex flex-col gap-[var(--fc-space-xs)] text-xs text-[var(--fc-text-secondary)]"
            >
              {run.detailLines.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

function isRunRoutable(
  run: AgendaBlockRunSection,
  rideEventFor: (item: CalendarItem) => CarpoolRideEvent | null | undefined,
  currentAdultId: string,
  members: FamilyCircle["members"],
): boolean {
  const item = run.representativeItem
  const rideEvent = rideEventFor(item) ?? null
  const games = mapCalendarItemToCoverageGames(item, rideEvent, {
    currentAdultId,
    members,
  })
  return games.some((game) => canRoute(game, rideEvent))
}

type ProposedAgendaBlockCardProps = {
  items: CalendarItem[]
  circle: FamilyCircle
  currentAdultId: string
  rideEventFor: (item: CalendarItem) => CarpoolRideEvent | null | undefined
  isFocused?: boolean
  now?: Date
}

/**
 * Audit-proposed block card: elevated RunSection titles, caption muted band,
 * commitment + drive-block links in Adjust plans overflow.
 */
export function ProposedAgendaBlockCard({
  items,
  circle,
  currentAdultId,
  rideEventFor,
  isFocused = false,
  now = new Date(),
}: ProposedAgendaBlockCardProps) {
  const sections = buildAgendaBlockSections({
    items,
    currentAdultId,
    circleId: circle.id,
    kids: circle.kids,
    members: circle.members,
    rideEventFor,
  })
  const commitmentActions = agendaCommitmentActionsForItems(items, {
    circle,
    currentAdultId,
    rideEventFor,
  })
  const driveBlockControls = agendaBlockDriveBlockControls(items)
  const departureItem = blockDepartureItem({
    items,
    currentAdultId,
    rideEventFor,
  })
  const dayLabel = formatAgendaBlockDayLabel(items[0]?.startsAt ?? "", now)
  const teamLabel =
    items.map((item) => item.feedName?.trim()).find(Boolean) ??
    (items[0]?.source === "FEED"
      ? calendarSourceLabel(items[0].source, items[0].feedName)
      : null)
  const locationLabel =
    items.map((item) => item.location?.trim()).find(Boolean) ?? null
  const toRoutable =
    sections.toRun != null &&
    isRunRoutable(sections.toRun, rideEventFor, currentAdultId, circle.members)
  const fromRoutable =
    sections.fromRun != null &&
    isRunRoutable(sections.fromRun, rideEventFor, currentAdultId, circle.members)

  const adjustItems: SandboxOverflowItem[] = [
    ...commitmentActions.map((action) => ({
      key: action.key,
      label: action.label,
      testId: `proposed-block-adjust-${action.key}`,
    })),
    ...driveBlockControls.map((control, index) => ({
      key: `drive-${index}-${control.link.otherId}`,
      label: control.label,
      testId: `proposed-block-adjust-drive-${index}`,
    })),
  ]

  return (
    <article
      data-testid="proposed-agenda-block-card"
      data-member-keys={items.map(calendarItemKey).join(",")}
      data-focused={isFocused ? "true" : "false"}
      className={`overflow-hidden rounded-[var(--fc-radius-xl)] border bg-[var(--fc-surface-raised)] ${
        isFocused
          ? "border-[var(--fc-list-row-focus-border)]"
          : "border-[var(--fc-border)]"
      }`}
    >
      <div className="flex flex-col gap-[var(--fc-space-md)] px-[var(--fc-space-list-row-pad-x)] py-[var(--fc-space-list-row-pad-y)]">
        <header className="min-w-0">
          {dayLabel != null ? (
            <span
              data-testid="proposed-agenda-block-day"
              className="block uppercase tracking-wide text-[length:var(--fc-font-list-row-team-size)] leading-[var(--fc-font-list-row-team-line)] font-[number:var(--fc-font-list-row-team-weight)] text-[var(--fc-text-secondary)]"
            >
              {teamLabel != null ? `${dayLabel} · ${teamLabel}` : dayLabel}
            </span>
          ) : teamLabel != null ? (
            <span className="block uppercase tracking-wide text-[length:var(--fc-font-list-row-team-size)] leading-[var(--fc-font-list-row-team-line)] font-[number:var(--fc-font-list-row-team-weight)] text-[var(--fc-text-secondary)]">
              {teamLabel}
            </span>
          ) : null}
          <span
            data-testid="proposed-agenda-block-title"
            className="block text-[length:var(--fc-font-list-row-title-size)] leading-[var(--fc-font-list-row-title-line)] font-[number:var(--fc-font-list-row-title-weight)] text-[var(--fc-text-primary)]"
          >
            {blockTitle(items)}
          </span>
          {locationLabel != null ? (
            <EventLocationLine
              location={locationLabel}
              data-testid="proposed-agenda-block-where"
              className="mt-0.5"
            />
          ) : null}
        </header>

        {sections.roundTripBanner != null ? (
          <p className="rounded-[var(--fc-radius-lg)] bg-[color-mix(in_srgb,var(--fc-success)_14%,transparent)] px-[var(--fc-space-md)] py-[var(--fc-space-sm)] text-[length:var(--fc-font-list-row-meta-size)] text-[var(--fc-success)]">
            {sections.roundTripBanner}
          </p>
        ) : null}

        {sections.toRun != null ? (
          <ProposedRunSection
            run={sections.toRun}
            testId="proposed-agenda-block-run-to"
            showViewRoute={toRoutable}
          />
        ) : null}

        {departureItem != null ? (
          <p
            data-testid="proposed-agenda-block-leave-from"
            className="text-[length:var(--fc-font-list-row-meta-size)] text-[var(--fc-text-secondary)]"
          >
            Leave from · {agendaLeaveByLine(departureItem) ?? "set origin"}
          </p>
        ) : null}

        {sections.eventBands.length > 0 ? (
          <ul className="flex flex-col gap-[var(--fc-space-xs)] px-[var(--fc-space-xs)]">
            {sections.eventBands.map((band) => (
              <li
                key={band.itemKey}
                className="text-[length:var(--fc-font-list-row-meta-size)] text-[var(--fc-text-secondary)]"
              >
                {band.line}
              </li>
            ))}
          </ul>
        ) : null}

        {sections.mutedBand != null ? (
          <div
            data-testid="proposed-agenda-block-muted-band"
            className="rounded-[var(--fc-radius-lg)] bg-[var(--fc-surface)] px-[var(--fc-space-md)] py-[var(--fc-space-md)]"
          >
            <div
              data-testid="proposed-agenda-block-muted-heading"
              className="text-xs font-semibold uppercase tracking-wide text-[var(--fc-text-secondary)]"
            >
              {sections.mutedBand.heading}
            </div>
            <ul className="mt-[var(--fc-space-sm)] flex flex-col gap-[var(--fc-space-xs)]">
              {sections.mutedBand.lines.map((line) => (
                <li
                  key={line}
                  className="text-[length:var(--fc-font-list-row-meta-size)] text-[var(--fc-text-secondary)]"
                >
                  {line}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {sections.fromRun != null ? (
          <ProposedRunSection
            run={sections.fromRun}
            testId="proposed-agenda-block-run-from"
            showViewRoute={fromRoutable}
          />
        ) : null}

        {adjustItems.length > 0 ? (
          <div data-testid="proposed-agenda-block-adjust">
            <SandboxOverflowMenu
              label="Adjust plans"
              testId="proposed-agenda-block-more"
              items={adjustItems}
              footer="Sandbox — not writing"
            />
          </div>
        ) : null}
      </div>
    </article>
  )
}
