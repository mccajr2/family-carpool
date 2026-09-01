export type PickupTone = {
  colorVar: string
  label: string
}

/** Detour tone thresholds locked to carpool-hero-flow-mockup-v6 pickupTone. */
export function pickupTone(detourMinutes: number): PickupTone {
  if (detourMinutes <= 10) {
    return { colorVar: "var(--fc-detour-on-way)", label: "On your way" }
  }
  if (detourMinutes <= 20) {
    return { colorVar: "var(--fc-detour-moderate)", label: "Bit of a detour" }
  }
  return { colorVar: "var(--fc-detour-far)", label: "Far out of the way" }
}
