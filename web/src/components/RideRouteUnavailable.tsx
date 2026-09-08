/**
 * Minimal Route-tab unavailable state. Honest about estimate failure — never
 * shows fixture leave-by. Richer chrome waits on ride-detail-polish.
 */

export type RideRouteUnavailableProps = {
  /** Machine reason from CalendarRoute when status is UNAVAILABLE. */
  reason?: string | null
  /** Fetch/network error message when the GET itself failed. */
  errorMessage?: string | null
}

/** Short human copy for multi-stop route soft-fails (estimate only). */
export function routeUnavailableLabel(reason: string | null | undefined): string {
  switch (reason) {
    case "NO_ORIGIN":
      return "No leave-from place yet — add a home address to estimate the route."
    case "NO_DESTINATION":
      return "Add an event location to estimate the route."
    case "GEOCODE_FAILED":
      return "Couldn't locate a stop on the route."
    case "OSRM_UNAVAILABLE":
      return "Driving times aren't available right now."
    case "NOT_ROUTABLE":
      return "This ride isn't ready to route yet."
    default:
      return "Route estimate unavailable."
  }
}

export function RideRouteUnavailable({
  reason = null,
  errorMessage = null,
}: RideRouteUnavailableProps) {
  const detail =
    errorMessage?.trim() ||
    (reason ? routeUnavailableLabel(reason) : "Route estimate unavailable.")

  return (
    <div
      data-testid="ride-route-unavailable"
      className="rounded-[var(--fc-radius-xl)] border border-dashed border-[var(--fc-border)] bg-[var(--fc-hero-carousel-control-bg)] p-[var(--fc-space-ride-detail-map-placeholder-pad)]"
    >
      <p className="text-[length:var(--fc-font-ride-detail-hero-copy-size)] leading-[var(--fc-font-ride-detail-hero-copy-line)] font-[number:var(--fc-font-ride-detail-hero-copy-weight)] text-[var(--fc-text-primary)]">
        {detail}
      </p>
      <p className="mt-2 text-[length:var(--fc-font-ride-detail-section-size)] leading-[var(--fc-font-ride-detail-section-line)] font-[number:var(--fc-font-ride-detail-section-weight)] text-[var(--fc-text-secondary)]">
        Leave-by and stop times are an estimate only — never live traffic. Try again
        after places or the event location are set.
      </p>
    </div>
  )
}
