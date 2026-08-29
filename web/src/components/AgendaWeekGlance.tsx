import type { CalendarItem } from "@/api/types"
import {
  agendaWeekGlanceDays,
  type WeekGlanceOwnRequestForItem,
} from "@/components/agendaWeekGlanceDays"

type AgendaWeekGlanceProps = {
  items: CalendarItem[]
  currentAdultId: string
  now?: Date
  /** When set, ACCEPTED own rides clear kids from the day coverage rollup. */
  ownRequestForItem?: WeekGlanceOwnRequestForItem
}

const titleClass =
  "fc-display text-[length:var(--fc-font-week-glance-title-size)] leading-[var(--fc-font-week-glance-title-line)] font-[number:var(--fc-font-week-glance-title-weight)] text-[var(--fc-text-primary)]"

const weekdayClass =
  "w-[var(--fc-space-week-day-width)] shrink-0 uppercase text-[length:var(--fc-font-week-day-size)] leading-[var(--fc-font-week-day-line)] font-[number:var(--fc-font-week-day-weight)] text-[var(--fc-text-secondary)]"

const countAttentionClass =
  "min-w-0 flex-1 text-[length:var(--fc-font-week-count-size)] leading-[var(--fc-font-week-count-line)] font-[number:var(--fc-font-week-count-weight)] text-[var(--fc-text-primary)]"

const countCalmClass =
  "min-w-0 flex-1 text-[length:var(--fc-font-week-count-calm-size)] leading-[var(--fc-font-week-count-calm-line)] font-[number:var(--fc-font-week-count-calm-weight)] text-[var(--fc-text-secondary)]"

const flagClass =
  "ml-auto h-[var(--fc-space-week-flag)] w-[var(--fc-space-week-flag)] shrink-0 rounded-full bg-[var(--fc-danger)]"

/**
 * Compact seven-day coverage/status strip for Calendar Context.
 * Rows are not interactive — jump-to-day stays the calendar grid.
 */
export function AgendaWeekGlance({
  items,
  currentAdultId,
  now = new Date(),
  ownRequestForItem,
}: AgendaWeekGlanceProps) {
  const days = agendaWeekGlanceDays(items, now, currentAdultId, ownRequestForItem)

  return (
    <div className="flex flex-col gap-[var(--fc-space-lg)]">
      <h3 className={titleClass}>Week at a glance</h3>
      <ul className="m-0 list-none p-0">
        {days.map((day) => (
          <li
            key={day.date.getTime()}
            className="flex items-center border-b border-[var(--fc-border)] py-[var(--fc-space-week-item-pad-y)] last:border-b-0"
          >
            <span className={weekdayClass}>{day.weekdayLabel}</span>
            <span className={day.flagged ? countAttentionClass : countCalmClass}>{day.copy}</span>
            {day.flagged ? (
              <span data-testid="week-glance-flag" className={flagClass} aria-hidden="true" />
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  )
}
