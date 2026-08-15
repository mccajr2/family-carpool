import type { CalendarItem } from "@/api/types"

export type AgendaDayGroup = {
  /** "Today" | "Tomorrow" | "This week" | "Later" */
  label: string
  /** e.g. "Aug 14" — present on every group except "Today" */
  dateLabel?: string
  items: CalendarItem[]
}

function startOfLocalDay(d: Date): Date {
  const s = new Date(d)
  s.setHours(0, 0, 0, 0)
  return s
}

function addDays(d: Date, days: number): Date {
  const next = new Date(d)
  next.setDate(next.getDate() + days)
  return next
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
  const todayStart = startOfLocalDay(now)
  const tomorrowStart = addDays(todayStart, 1)
  const dayAfterTomorrowStart = addDays(todayStart, 2)
  const weekEnd = addDays(todayStart, 7)

  const buckets: AgendaDayGroup[] = [
    { label: "Today", items: [] },
    { label: "Tomorrow", dateLabel: compactDateLabel(tomorrowStart), items: [] },
    { label: "This week", items: [] },
    { label: "Later", items: [] },
  ]

  for (const item of items) {
    const startsAt = new Date(item.startsAt)
    if (Number.isNaN(startsAt.getTime())) {
      buckets[3].items.push(item)
      continue
    }
    if (startsAt < tomorrowStart) {
      buckets[0].items.push(item)
    } else if (startsAt < dayAfterTomorrowStart) {
      buckets[1].items.push(item)
    } else if (startsAt < weekEnd) {
      buckets[2].items.push(item)
    } else {
      buckets[3].items.push(item)
    }
  }

  return buckets.filter((b) => b.items.length > 0)
}
