const DAY_MINUTES = 24 * 60
const MS_PER_LOCAL_DAY = 24 * 60 * 60 * 1000

function startOfLocalDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

/** Adaptive Focus-card ring label: min / hr / nearest whole day. `"—"` only when unknown. */
export function formatRingCountdown(mins: number | null): { label: string; unit: string } {
  if (mins == null) return { label: "—", unit: "" }
  if (mins < 60) return { label: `${mins}`, unit: "min" }
  if (mins < DAY_MINUTES) {
    const h = Math.floor(mins / 60)
    const m = mins % 60
    return { label: m === 0 ? `${h}` : `${h}h ${m}`, unit: "hr" }
  }
  const days = Math.max(1, Math.round(mins / DAY_MINUTES))
  return { label: `${days}`, unit: days === 1 ? "day" : "days" }
}

/**
 * Whole minutes until event start (floor at 0). Null when `startsAt` is invalid.
 * Used by the hero carousel ring so granularity can step days → hours → minutes.
 */
export function minutesUntilEvent(startsAt: string, now: Date = new Date()): number | null {
  const eventStart = new Date(startsAt)
  if (Number.isNaN(eventStart.getTime())) {
    return null
  }
  return Math.max(0, Math.round((eventStart.getTime() - now.getTime()) / 60_000))
}

/** Whole local calendar days until an event start (minimum 0). */
export function heroDaysUntilEvent(startsAt: string, now: Date = new Date()): number {
  const eventStart = new Date(startsAt)
  if (Number.isNaN(eventStart.getTime())) {
    return 0
  }
  const diffMs = startOfLocalDay(eventStart).getTime() - startOfLocalDay(now).getTime()
  return Math.max(0, Math.round(diffMs / MS_PER_LOCAL_DAY))
}

/** @deprecated Prefer {@link formatHeroCountdownRing}; kept for calendar-day-only call sites. */
export function formatHeroDaysRing(days: number): { label: string; unit: string } {
  return {
    label: `${days}`,
    unit: days === 1 ? "DAY" : "DAYS",
  }
}

/** Hero carousel ring — adaptive minutes/hours/days with uppercase unit labels. */
export function formatHeroCountdownRing(
  startsAt: string,
  now: Date = new Date(),
): { label: string; unit: string } {
  const { label, unit } = formatRingCountdown(minutesUntilEvent(startsAt, now))
  return { label, unit: unit.toUpperCase() }
}

/** Convenience: local calendar days from ISO start → carousel ring label (days only). */
export function heroDaysRingFromStartsAt(
  startsAt: string,
  now: Date = new Date(),
): { label: string; unit: string } {
  return formatHeroDaysRing(heroDaysUntilEvent(startsAt, now))
}
