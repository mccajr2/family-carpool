const DAY_MINUTES = 24 * 60

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
