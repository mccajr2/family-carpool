import type { CalendarItem, CarpoolRide } from "@/api/types"
import { addDays, AGENDA_NEAR_TERM_DAYS, startOfLocalDay } from "@/components/agendaDayGroups"
import {
  pendingCoverageForAdult,
  remainingCoverageGapKidIds,
} from "@/components/coverageDisplay"
import {
  ALL_SET,
  WEEK_GLANCE_NEEDS_COVERAGE_PLURAL,
  WEEK_GLANCE_NEEDS_COVERAGE_SINGULAR,
  WEEK_GLANCE_NO_EVENTS,
  WEEK_GLANCE_OVERLAPS_PLURAL,
  WEEK_GLANCE_OVERLAPS_SINGULAR,
  WEEK_GLANCE_TO_CONFIRM,
  weekGlanceCountCopy,
} from "@/components/coverageCopy"
import { isAgendaItemOutOfPlay } from "@/components/rsvpDisplay"

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const

export const WEEK_GLANCE_DAY_COUNT = AGENDA_NEAR_TERM_DAYS

export type WeekGlanceDay = {
  date: Date
  weekdayLabel: string
  copy: string
  flagged: boolean
}

/** Resolve this circle's own ride request for an Agenda item (ACCEPTED clears gap chrome). */
export type WeekGlanceOwnRequestForItem = (
  item: CalendarItem,
) => CarpoolRide | null | undefined

function localDayKey(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
}

function countCopy(n: number, singular: string, plural: string): string {
  return weekGlanceCountCopy(n, singular, plural)
}

function statusForDay(
  itemsOnDay: CalendarItem[],
  currentAdultId: string,
  ownRequestForItem?: WeekGlanceOwnRequestForItem,
): Pick<WeekGlanceDay, "copy" | "flagged"> {
  if (itemsOnDay.length === 0) {
    return { copy: WEEK_GLANCE_NO_EVENTS, flagged: false }
  }

  const inPlay = itemsOnDay.filter((item) => !isAgendaItemOutOfPlay(item))
  const uncovered = inPlay.filter(
    (item) =>
      remainingCoverageGapKidIds(item.uncoveredKidIds, ownRequestForItem?.(item)).length > 0,
  )
  if (uncovered.length > 0) {
    return {
      copy: countCopy(
        uncovered.length,
        WEEK_GLANCE_NEEDS_COVERAGE_SINGULAR,
        WEEK_GLANCE_NEEDS_COVERAGE_PLURAL,
      ),
      flagged: true,
    }
  }

  const overlapping = inPlay.filter((item) => item.conflicts.length > 0)
  if (overlapping.length > 0) {
    return {
      copy: countCopy(
        overlapping.length,
        WEEK_GLANCE_OVERLAPS_SINGULAR,
        WEEK_GLANCE_OVERLAPS_PLURAL,
      ),
      flagged: true,
    }
  }

  const toConfirm = inPlay.filter(
    (item) => Boolean(currentAdultId) && pendingCoverageForAdult(item, currentAdultId),
  )
  if (toConfirm.length > 0) {
    return {
      copy: countCopy(toConfirm.length, WEEK_GLANCE_TO_CONFIRM, WEEK_GLANCE_TO_CONFIRM),
      flagged: true,
    }
  }

  return { copy: ALL_SET, flagged: false }
}

/**
 * Seven local days starting today, with one status line each, derived from the
 * already-loaded (kid-filtered) Agenda window. Unparseable `startsAt` is skipped.
 * Pass `ownRequestForItem` so ACCEPTED own rides clear kids from the coverage
 * gap the same way Focus / Agenda rows do.
 */
export function agendaWeekGlanceDays(
  items: CalendarItem[],
  now: Date = new Date(),
  currentAdultId: string = "",
  ownRequestForItem?: WeekGlanceOwnRequestForItem,
): WeekGlanceDay[] {
  const todayStart = startOfLocalDay(now)
  const byDay = new Map<string, CalendarItem[]>()

  for (const item of items) {
    const start = new Date(item.startsAt)
    if (Number.isNaN(start.getTime())) {
      continue
    }
    const key = localDayKey(start)
    const bucket = byDay.get(key)
    if (bucket) {
      bucket.push(item)
    } else {
      byDay.set(key, [item])
    }
  }

  const days: WeekGlanceDay[] = []
  for (let offset = 0; offset < WEEK_GLANCE_DAY_COUNT; offset++) {
    const date = addDays(todayStart, offset)
    const { copy, flagged } = statusForDay(
      byDay.get(localDayKey(date)) ?? [],
      currentAdultId,
      ownRequestForItem,
    )
    days.push({
      date,
      weekdayLabel: WEEKDAY_LABELS[date.getDay()],
      copy,
      flagged,
    })
  }
  return days
}
