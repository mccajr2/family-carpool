import { useState } from "react"

import type { CalendarItem, CarpoolRideEvent, FamilyCircle } from "@/api/types"
import {
  buildAgendaBlockSections,
  type AgendaBlockRunSection,
} from "@/components/agendaBlockSections"
import { calendarItemKey } from "@/components/coverageDisplay"
import { EventLocationLine } from "@/components/EventLocationLine"

export type AgendaBlockCardProps = {
  /** Combined driving-block members (length ≥ 2), chronological. */
  items: CalendarItem[]
  circle: FamilyCircle
  currentAdultId: string
  rideEventFor: (item: CalendarItem) => CarpoolRideEvent | null | undefined
  /** True when any member is the focused Agenda attention row. */
  isFocused?: boolean
}

function sharedLocation(items: CalendarItem[]): string | null {
  const locations = items
    .map((item) => item.location?.trim() || null)
    .filter((value): value is string => value != null)
  if (locations.length === 0) {
    return null
  }
  const first = locations[0]!
  return locations.every((value) => value === first) ? first : first
}

function sharedFeedName(items: CalendarItem[]): string | null {
  const names = items
    .map((item) => item.feedName?.trim() || null)
    .filter((value): value is string => value != null && value.length > 0)
  if (names.length === 0) {
    return null
  }
  const first = names[0]!
  return names.every((value) => value === first) ? first : null
}

function blockTitle(items: CalendarItem[]): string {
  const n = items.length
  if (n === 2) {
    return "Two events tonight"
  }
  return `${n} events tonight`
}

function RunSection({
  run,
  testId,
}: {
  run: AgendaBlockRunSection
  testId: string
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
          className="text-[length:var(--fc-font-list-row-meta-size)] leading-[var(--fc-font-list-row-meta-line)] font-[number:var(--fc-font-list-row-title-weight)] text-[var(--fc-text-primary)]"
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
      {hasDetail ? (
        <div className="mt-[var(--fc-space-sm)]">
          <button
            type="button"
            className="text-xs underline underline-offset-2 text-[var(--fc-text-secondary)]"
            aria-expanded={detailOpen}
            data-testid={`${testId}-detail-toggle`}
            onClick={() => setDetailOpen((open) => !open)}
          >
            {detailOpen ? "Hide details" : "Show details"}
          </button>
          {detailOpen ? (
            <ul
              data-testid={`${testId}-detail`}
              className="mt-[var(--fc-space-sm)] flex flex-col gap-[var(--fc-space-xs)] text-[length:var(--fc-font-list-row-meta-size)] text-[var(--fc-text-secondary)]"
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

/**
 * Multi-item Agenda driving-block card: drop-off / event bands / muted other
 * jobs / pickup (mockup order). Merge-split and View route land in later tasks.
 */
export function AgendaBlockCard({
  items,
  circle,
  currentAdultId,
  rideEventFor,
  isFocused = false,
}: AgendaBlockCardProps) {
  const locationLabel = sharedLocation(items)
  const teamLabel = sharedFeedName(items)
  const sections = buildAgendaBlockSections({
    items,
    currentAdultId,
    kids: circle.kids,
    members: circle.members,
    rideEventFor,
  })
  const focusRingStyle = isFocused
    ? {
        borderColor: "var(--fc-list-row-focus-border)",
        boxShadow:
          "0 0 0 var(--fc-space-list-row-focus-halo-spread) var(--fc-list-row-focus-halo)",
      }
    : undefined

  return (
    <div
      data-testid="agenda-block-card"
      data-member-keys={items.map(calendarItemKey).join(",")}
      data-focused={isFocused ? "true" : "false"}
      className={`overflow-hidden rounded-[var(--fc-radius-xl)] border bg-[var(--fc-surface-raised)] transition-colors ${
        isFocused
          ? "border-[var(--fc-list-row-focus-border)]"
          : "border-[var(--fc-border)]"
      }`}
      style={focusRingStyle}
    >
      <div className="flex flex-col gap-[var(--fc-space-md)] px-[var(--fc-space-list-row-pad-x)] py-[var(--fc-space-list-row-pad-y)]">
        <header className="min-w-0">
          {teamLabel != null ? (
            <span
              data-testid="agenda-block-team"
              className="block uppercase tracking-wide text-[length:var(--fc-font-list-row-team-size)] leading-[var(--fc-font-list-row-team-line)] font-[number:var(--fc-font-list-row-team-weight)] text-[var(--fc-text-secondary)]"
            >
              {teamLabel}
            </span>
          ) : null}
          <span
            data-testid="agenda-block-title"
            className="block text-[length:var(--fc-font-list-row-title-size)] leading-[var(--fc-font-list-row-title-line)] font-[number:var(--fc-font-list-row-title-weight)] text-[var(--fc-text-primary)]"
          >
            {blockTitle(items)}
          </span>
          {locationLabel != null ? (
            <EventLocationLine
              location={locationLabel}
              data-testid="agenda-block-where"
              className="mt-0.5"
            />
          ) : null}
        </header>

        {sections.roundTripBanner != null ? (
          <p
            data-testid="agenda-block-round-trip-banner"
            className="rounded-[var(--fc-radius-lg)] bg-[color-mix(in_srgb,var(--fc-success)_14%,transparent)] px-[var(--fc-space-md)] py-[var(--fc-space-sm)] text-[length:var(--fc-font-list-row-meta-size)] leading-[var(--fc-font-list-row-meta-line)] text-[var(--fc-success)]"
          >
            {sections.roundTripBanner}
          </p>
        ) : null}

        {sections.toRun != null ? (
          <RunSection run={sections.toRun} testId="agenda-block-run-to" />
        ) : null}

        {sections.eventBands.length > 0 ? (
          <ul
            data-testid="agenda-block-event-bands"
            className="flex flex-col gap-[var(--fc-space-xs)] px-[var(--fc-space-xs)]"
          >
            {sections.eventBands.map((band) => (
              <li
                key={band.itemKey}
                data-testid={`agenda-block-event-band-${band.itemKey}`}
                className="text-[length:var(--fc-font-list-row-meta-size)] leading-[var(--fc-font-list-row-meta-line)] text-[var(--fc-text-secondary)]"
              >
                {band.line}
              </li>
            ))}
          </ul>
        ) : null}

        {sections.mutedBand != null ? (
          <div
            data-testid="agenda-block-muted-band"
            className="rounded-[var(--fc-radius-lg)] bg-[var(--fc-surface)] px-[var(--fc-space-md)] py-[var(--fc-space-md)]"
          >
            <div
              data-testid="agenda-block-muted-heading"
              className="text-[length:var(--fc-font-list-row-meta-size)] leading-[var(--fc-font-list-row-meta-line)] font-[number:var(--fc-font-list-row-title-weight)] text-[var(--fc-text-secondary)]"
            >
              {sections.mutedBand.heading}
            </div>
            <ul
              data-testid="agenda-block-muted-lines"
              className="mt-[var(--fc-space-sm)] flex flex-col gap-[var(--fc-space-xs)]"
            >
              {sections.mutedBand.lines.map((line) => (
                <li
                  key={line}
                  className="text-[length:var(--fc-font-list-row-meta-size)] leading-[var(--fc-font-list-row-meta-line)] text-[var(--fc-text-secondary)]"
                >
                  {line}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {sections.fromRun != null ? (
          <RunSection run={sections.fromRun} testId="agenda-block-run-from" />
        ) : null}
      </div>
    </div>
  )
}
