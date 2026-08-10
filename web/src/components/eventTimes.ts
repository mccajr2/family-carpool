/** Client-side rules for manual event datetimes (datetime-local values). */
export function validateManualEventTimes(
  startsLocal: string,
  endsLocal: string,
  nowMs: number = Date.now(),
): string | null {
  const startsTrimmed = startsLocal.trim()
  if (!startsTrimmed) {
    return "Start is required"
  }
  const starts = new Date(startsTrimmed).getTime()
  if (Number.isNaN(starts)) {
    return "Start time is invalid"
  }
  if (starts < nowMs) {
    return "Start must be in the future"
  }
  const endsTrimmed = endsLocal.trim()
  if (!endsTrimmed) {
    return null
  }
  const ends = new Date(endsTrimmed).getTime()
  if (Number.isNaN(ends)) {
    return "End time is invalid"
  }
  if (ends < starts) {
    return "End must be on or after start"
  }
  return null
}

/** Clear ends when it would be before the new start. */
export function coerceEndsAfterStart(startsLocal: string, endsLocal: string): string {
  if (!endsLocal.trim() || !startsLocal.trim()) {
    return endsLocal
  }
  const starts = new Date(startsLocal).getTime()
  const ends = new Date(endsLocal).getTime()
  if (Number.isNaN(starts) || Number.isNaN(ends) || ends >= starts) {
    return endsLocal
  }
  return ""
}

/** Local-friendly label like iOS medium date + short time: "Aug 12, 2026 at 12:30 PM". */
export function formatIsoForDisplay(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) {
    return iso
  }
  const day = date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
  const time = date.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  })
  return `${day} at ${time}`
}

export function formatEventWhen(startsAt: string, endsAt: string | null | undefined): string {
  const start = formatIsoForDisplay(startsAt)
  if (endsAt) {
    return `${start} → ${formatIsoForDisplay(endsAt)}`
  }
  return start
}

/** Default agenda page size in local calendar days. */
export const CALENDAR_PAGE_DAYS = 30

function startOfLocalDay(now: Date): Date {
  const start = new Date(now)
  start.setHours(0, 0, 0, 0)
  return start
}

/** Default agenda window: local start-of-today → +30 days, as UTC ISO instants. */
export function defaultCalendarWindow(now: Date = new Date()): { from: string; to: string } {
  return advanceCalendarWindow(startOfLocalDay(now).toISOString(), CALENDAR_PAGE_DAYS)
}

/**
 * Next exclusive page: `[fromIso, fromIso + days)` using the Date local calendar.
 * Pass the previous window's `to` as `fromIso`.
 */
export function advanceCalendarWindow(
  fromIso: string,
  days: number = CALENDAR_PAGE_DAYS,
): { from: string; to: string } {
  const from = new Date(fromIso)
  const to = new Date(from)
  to.setDate(to.getDate() + days)
  return { from: from.toISOString(), to: to.toISOString() }
}

/** Full reload range: local today through an already-loaded exclusive `to`. */
export function calendarWindowThrough(
  loadedToIso: string,
  now: Date = new Date(),
): { from: string; to: string } {
  return { from: startOfLocalDay(now).toISOString(), to: loadedToIso }
}

/** Grow `loadedTo` until `instantIso` falls inside `[…, loadedTo)`. */
export function ensureCalendarWindowCovers(
  loadedToIso: string,
  instantIso: string,
  days: number = CALENDAR_PAGE_DAYS,
): string {
  let to = loadedToIso
  let guard = 0
  while (instantIso >= to && guard < 120) {
    to = advanceCalendarWindow(to, days).to
    guard++
  }
  return to
}

export function mergeCalendarItems<T extends { id: string; source: string; startsAt: string }>(
  current: T[],
  more: T[],
): T[] {
  const seen = new Set(current.map((item) => `${item.source}:${item.id}`))
  const merged = [...current]
  for (const item of more) {
    const key = `${item.source}:${item.id}`
    if (seen.has(key)) {
      continue
    }
    seen.add(key)
    merged.push(item)
  }
  return merged.sort((a, b) =>
    a.startsAt === b.startsAt
      ? `${a.source}:${a.id}`.localeCompare(`${b.source}:${b.id}`)
      : a.startsAt.localeCompare(b.startsAt),
  )
}

export function calendarSourceLabel(
  source: "MANUAL" | "FEED",
  feedName: string | null | undefined,
): string {
  if (source === "FEED") {
    return feedName?.trim() ? feedName.trim() : "Feed"
  }
  return "Manual"
}

