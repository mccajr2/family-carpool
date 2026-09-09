import { resolveSemanticIcon } from "@/components/uiIcons"

const MapPinIcon = resolveSemanticIcon("icon.places")

export type EventLocationLineProps = {
  location: string | null | undefined
  className?: string
  /** Override text/icon color (e.g. hero on-secondary). */
  color?: string
  "data-testid"?: string
}

/**
 * Standard card location line: map-pin + 13px secondary text under datetime.
 */
export function EventLocationLine({
  location,
  className,
  color,
  "data-testid": testId = "event-location-line",
}: EventLocationLineProps) {
  const trimmed = location?.trim()
  if (!trimmed) {
    return null
  }

  return (
    <span
      data-testid={testId}
      className={[
        "flex items-center gap-1.5 text-[length:var(--fc-font-location-line-size)] leading-[var(--fc-font-location-line-line)] font-[number:var(--fc-font-location-line-weight)]",
        color == null ? "text-[var(--fc-text-secondary)]" : null,
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      style={color != null ? { color } : undefined}
    >
      <MapPinIcon
        aria-hidden
        className="size-[14px] shrink-0"
        style={color != null ? { color } : undefined}
      />
      {trimmed}
    </span>
  )
}
