import type { CalendarItem, CalendarLeaveBy } from "@/api/types"
import { mergeCalendarItems } from "@/components/eventTimes"

export function calendarRowKey(source: string, id: string): string {
  return `${source}:${id}`
}

/**
 * Cheap list onto a cached row: settled UNAVAILABLE/OK replace; PENDING keeps
 * cached settled leave-by when origin is unchanged (avoid flicker).
 */
export function mergeCheapCalendarItem(
  incoming: CalendarItem,
  cached: CalendarItem | undefined,
): CalendarItem {
  if (incoming.leaveByStatus !== "PENDING") {
    return incoming
  }
  if (
    cached &&
    cached.leaveFromPlaceId === incoming.leaveFromPlaceId &&
    (cached.leaveByStatus === "OK" || cached.leaveByStatus === "UNAVAILABLE")
  ) {
    return {
      ...incoming,
      leaveByAt: cached.leaveByAt,
      leaveByStatus: cached.leaveByStatus,
      leaveByReason: cached.leaveByReason,
    }
  }
  return incoming
}

export function mergeCheapCalendarItems(
  incoming: CalendarItem[],
  cached: CalendarItem[],
): CalendarItem[] {
  const byKey = new Map(
    cached.map((row) => [calendarRowKey(row.source, row.id), row]),
  )
  return incoming.map((row) =>
    mergeCheapCalendarItem(row, byKey.get(calendarRowKey(row.source, row.id))),
  )
}

/** Revalidate a loaded window without dropping items outside `[from, to)`. */
export function mergeCalendarWindowRefresh(
  incoming: CalendarItem[],
  previous: CalendarItem[],
  window: { from: string; to: string },
): CalendarItem[] {
  const outside = previous.filter(
    (item) => item.startsAt < window.from || item.startsAt >= window.to,
  )
  const refreshed = mergeCheapCalendarItems(incoming, previous)
  return mergeCalendarItems(outside, refreshed)
}

/** Fill-in always overwrites leave-by fields for matching (source, id). */
export function applyLeaveByFillIn(
  items: CalendarItem[],
  rows: CalendarLeaveBy[],
): CalendarItem[] {
  const byKey = new Map(
    rows.map((row) => [calendarRowKey(row.source, row.id), row]),
  )
  return items.map((item) => {
    const fill = byKey.get(calendarRowKey(item.source, item.id))
    if (!fill) {
      return item
    }
    return {
      ...item,
      leaveFromPlaceId:
        fill.leaveFromPlaceId !== undefined
          ? fill.leaveFromPlaceId
          : item.leaveFromPlaceId,
      leaveFromPlaceName:
        fill.leaveFromPlaceName !== undefined
          ? fill.leaveFromPlaceName
          : item.leaveFromPlaceName,
      leaveByAt: fill.leaveByAt ?? null,
      leaveByStatus: fill.leaveByStatus,
      leaveByReason: fill.leaveByReason ?? null,
    }
  })
}
