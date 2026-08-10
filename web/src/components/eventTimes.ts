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

