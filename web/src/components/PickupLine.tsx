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
        "mt-1 flex items-center gap-1.5 text-[length:var(--fc-font-caption-size)] leading-[var(--fc-font-caption-line)]",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      style={{ color: textColor }}
    >
      <MapPin size={12} aria-hidden style={{ color: pinColor }} />
      <span>
        Pickup in {pickupTown}
        {showMinutes && tone ? (
          <span style={{ color: tone.colorVar, fontWeight: 600 }}>
            {" "}
            · ~{detourMinutes} min out of your way ({tone.label})
          </span>
        ) : null}
      </span>
    </div>
  )
}
