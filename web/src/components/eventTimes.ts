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
