import type { CalendarItem } from "@/api/types"

export type AgendaDayGroup = {
  /** "Today" | "Tomorrow" | "This week" | "Later" */
  label: string
  /** e.g. "Aug 14" — present on every group except "Today" */
  dateLabel?: string
  items: CalendarItem[]
}

/** Today / Tomorrow / This week (days 3–6) / Later — matches groupAgendaByDay buckets. */
export type AgendaDayBucket = "today" | "tomorrow" | "this-week" | "later"

export type AgendaDayBoundaries = {
  todayStart: Date
  tomorrowStart: Date
  dayAfterTomorrowStart: Date
  weekEnd: Date
}

export function startOfLocalDay(d: Date): Date {
  const s = new Date(d)
  s.setHours(0, 0, 0, 0)
  return s
}

export function addDays(d: Date, days: number): Date {
  const next = new Date(d)
  next.setDate(next.getDate() + days)
  return next
}

export function agendaDayBoundaries(now: Date = new Date()): AgendaDayBoundaries {
  const todayStart = startOfLocalDay(now)
  return {
    todayStart,
    tomorrowStart: addDays(todayStart, 1),
    dayAfterTomorrowStart: addDays(todayStart, 2),
    weekEnd: addDays(todayStart, 7),
  }
}

/**
 * Classifies a start time into the same day bucket used by `groupAgendaByDay`.
 * Unparseable dates return `"later"` (same as grouping).
 */
export function agendaDayBucketForStartsAt(
  startsAt: string | Date,
  now: Date = new Date(),
): AgendaDayBucket {
  const start = typeof startsAt === "string" ? new Date(startsAt) : startsAt
  if (Number.isNaN(start.getTime())) {
    return "later"
  }
  const { tomorrowStart, dayAfterTomorrowStart, weekEnd } = agendaDayBoundaries(now)
  if (start < tomorrowStart) {
    return "today"
  }
  if (start < dayAfterTomorrowStart) {
    return "tomorrow"
  }
  if (start < weekEnd) {
    return "this-week"
  }
  return "later"
}

function compactDateLabel(d: Date): string {
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" })
}

/**
 * Groups already-sorted-by-startsAt agenda items into Today / Tomorrow /
 * This week / Later buckets, using the viewer's local calendar day — not UTC
 * day boundaries, so "today" matches what the person actually sees on a
 * clock. Empty buckets are omitted entirely (no "This week" header with
 * nothing under it).
 */
export function groupAgendaByDay(
  items: CalendarItem[],
  now: Date = new Date(),
): AgendaDayGroup[] {
  const { tomorrowStart } = agendaDayBoundaries(now)

  const buckets: AgendaDayGroup[] = [
    { label: "Today", items: [] },
    { label: "Tomorrow", dateLabel: compactDateLabel(tomorrowStart), items: [] },
    { label: "This week", items: [] },
    { label: "Later", items: [] },
  ]

  for (const item of items) {
    const bucket = agendaDayBucketForStartsAt(item.startsAt, now)
    if (bucket === "today") {
      buckets[0].items.push(item)
    } else if (bucket === "tomorrow") {
      buckets[1].items.push(item)
    } else if (bucket === "this-week") {
      buckets[2].items.push(item)
    } else {
      buckets[3].items.push(item)
    }
  }

  return buckets.filter((b) => b.items.length > 0)
}
