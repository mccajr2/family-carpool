import { Navigation } from "lucide-react"
import type { KeyboardEvent, MouseEvent } from "react"

import { resolveSemanticIcon } from "@/components/uiIcons"

const MapPinIcon = resolveSemanticIcon("icon.places")

export type EventLocationLineProps = {
  location: string | null | undefined
  className?: string
  /** Override text/icon color (e.g. hero on-secondary). */
  color?: string
  /**
   * `pin` — single venue (default). `route` — multi-venue "N stops" on a
   * combined card (lucide Navigation; no new design-token icon).
   */
  variant?: "pin" | "route"
  /**
   * When set, the line is activatable (stops propagation so a parent expand
   * control is not triggered). Omit when the line is display-only.
   */
  onClick?: () => void
  "data-testid"?: string
}

/**
 * Standard card location line: map-pin + 13px secondary text under datetime.
 * Combined multi-venue cards may use the route variant with "N stops".
 */
export function EventLocationLine({
  location,
  className,
  color,
  variant = "pin",
  onClick,
  "data-testid": testId = "event-location-line",
}: EventLocationLineProps) {
  const trimmed = location?.trim()
  if (!trimmed) {
    return null
  }

  const Icon = variant === "route" ? Navigation : MapPinIcon
  const classes = [
    "flex items-center gap-1.5 text-[length:var(--fc-font-location-line-size)] leading-[var(--fc-font-location-line-line)] font-[number:var(--fc-font-location-line-weight)]",
    color == null ? "text-[var(--fc-text-secondary)]" : null,
    onClick != null
      ? "cursor-pointer text-left disabled:cursor-not-allowed"
      : null,
    className,
  ]
    .filter(Boolean)
    .join(" ")
  const style = color != null ? { color } : undefined

  function handleClick(event: MouseEvent<HTMLElement>) {
    if (onClick == null) {
      return
    }
    event.preventDefault()
    event.stopPropagation()
    onClick()
  }

  function handleKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (onClick == null) {
      return
    }
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault()
      event.stopPropagation()
      onClick()
    }
  }

  const content = (
    <>
      <Icon
        aria-hidden
        className="size-[14px] shrink-0"
        style={color != null ? { color } : undefined}
      />
      {trimmed}
    </>
  )

  if (onClick != null) {
    return (
      <span
        role="button"
        tabIndex={0}
        data-testid={testId}
        data-location-variant={variant}
        className={classes}
        style={style}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
      >
        {content}
      </span>
    )
  }

  return (
    <span
      data-testid={testId}
      data-location-variant={variant}
      className={classes}
      style={style}
    >
      {content}
    </span>
  )
}
