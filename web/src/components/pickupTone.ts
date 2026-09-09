/** Detour tone thresholds — v6 mock (0–10 / 11–20 / 21+). */
export type PickupTone = {
  colorVar: string
  label: string
}

export function pickupTone(detourMinutes: number): PickupTone {
  if (detourMinutes <= 10) {
    return { colorVar: "var(--fc-detour-on-way)", label: "On your way" }
  }
  if (detourMinutes <= 20) {
    return { colorVar: "var(--fc-detour-moderate)", label: "Bit of a detour" }
  }
  return { colorVar: "var(--fc-detour-far)", label: "Far out of the way" }
}
