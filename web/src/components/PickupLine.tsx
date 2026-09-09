import { MapPin } from "lucide-react"

import { pickupTone } from "@/components/pickupTone"

export type PickupLineProps = {
  pickupTown: string | null
  detourMinutes: number | null
  /** Hero carousel slide uses on-secondary base text per mock dark slide. */
  variant?: "default" | "hero"
  className?: string
  "data-testid"?: string
}

export function PickupLine({
  pickupTown,
  detourMinutes,
  variant = "default",
  className,
  "data-testid": testId = "pickup-line",
}: PickupLineProps) {
  if (!pickupTown) {
    return null
  }

  const textColor =
    variant === "hero" ? "var(--fc-hero-on-secondary)" : "var(--fc-text-secondary)"
  const showMinutes = detourMinutes != null
  const tone = showMinutes ? pickupTone(detourMinutes) : null
  const pinColor = tone?.colorVar ?? textColor

  return (
    <div
      data-testid={testId}
      className={[
        "mt-1 flex flex-wrap items-center gap-1.5 text-[length:var(--fc-font-location-line-size)] leading-[var(--fc-font-location-line-line)]",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      style={{ color: textColor }}
    >
      <MapPin size={12} aria-hidden style={{ color: pinColor }} />
      <span>Pickup in {pickupTown}</span>
      {showMinutes && tone ? (
        <span
          data-testid={`${testId}-detour-pill`}
          className="inline-flex items-center rounded-full px-2 py-0.5 text-[length:var(--fc-font-location-line-size)] font-semibold leading-[var(--fc-font-location-line-line)]"
          style={{
            color: tone.colorVar,
            background: `color-mix(in srgb, ${tone.colorVar} 18%, transparent)`,
          }}
        >
          ~{detourMinutes} min out of your way
        </span>
      ) : null}
    </div>
  )
}
