import type { CalendarItem } from "@/api/types"
import { calendarItemKey } from "@/components/coverageDisplay"
import { EventLocationLine } from "@/components/EventLocationLine"
import { formatCompactEventWhen } from "@/components/eventTimes"

export type AgendaBlockCardProps = {
  /** Combined driving-block members (length ≥ 2), chronological. */
  items: CalendarItem[]
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

/**
 * Multi-item Agenda driving-block card. Task 1: one card chrome for combined
 * members (per-leg runs / muted band / merge controls land in later tasks).
 */
export function AgendaBlockCard({ items, isFocused = false }: AgendaBlockCardProps) {
  const locationLabel = sharedLocation(items)
  const teamLabel = sharedFeedName(items)
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

        <ul
          data-testid="agenda-block-members"
          className="flex flex-col gap-[var(--fc-space-sm)]"
        >
          {items.map((item) => (
            <li
              key={calendarItemKey(item)}
              data-testid={`agenda-block-member-${item.source}-${item.id}`}
              className="min-w-0"
            >
              <span
                data-testid="agenda-block-member-title"
                className="block text-[length:var(--fc-font-list-row-meta-size)] leading-[var(--fc-font-list-row-meta-line)] font-[number:var(--fc-font-list-row-meta-weight)] text-[var(--fc-text-primary)]"
              >
                {item.title}
              </span>
              <span
                data-testid="agenda-block-member-when"
                className="block text-[length:var(--fc-font-list-row-meta-size)] leading-[var(--fc-font-list-row-meta-line)] font-[number:var(--fc-font-list-row-meta-weight)] text-[var(--fc-text-secondary)]"
              >
                {formatCompactEventWhen(item.startsAt, item.endsAt)}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
