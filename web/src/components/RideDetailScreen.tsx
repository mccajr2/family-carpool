import type { ReactNode } from "react"
import { ArrowLeft } from "lucide-react"
import type { FixtureCarpoolRoute } from "@/components/rideDetailFixtures"

export type RideDetailScreenProps = {
  title: string
  whenLabel: string
  onBack: () => void
  /** Fixture (or later live) route metadata for the detail body. */
  carpoolRoute?: FixtureCarpoolRoute | null
  /** Route body — always shown (Playlist chrome removed for dogfood). */
  routePanel?: ReactNode
}

/**
 * Calendar ride-detail chrome: back, event header, and Route body.
 * Playlist tab was parked; Route is the sole detail surface.
 */
export function RideDetailScreen({
  title,
  whenLabel,
  onBack,
  carpoolRoute = null,
  routePanel = null,
}: RideDetailScreenProps) {
  return (
    <div
      data-testid="ride-detail-screen"
      data-fixture-kind={carpoolRoute?.kind}
      className="flex flex-col"
    >
      <button
        type="button"
        data-testid="ride-detail-back"
        onClick={onBack}
        className="mb-[var(--fc-space-ride-detail-back-mb)] inline-flex items-center gap-1.5 text-[length:var(--fc-font-ride-detail-back-size)] leading-[var(--fc-font-ride-detail-back-line)] font-[number:var(--fc-font-ride-detail-back-weight)] text-[var(--fc-text-secondary)]"
      >
        <ArrowLeft aria-hidden size={15} />
        Back to schedule
      </button>

      <div className="mb-[var(--fc-space-ride-detail-header-mb)]">
        <div
          data-testid="ride-detail-when"
          className="mb-1 uppercase tracking-widest text-[length:var(--fc-font-ride-detail-when-size)] leading-[var(--fc-font-ride-detail-when-line)] font-[number:var(--fc-font-ride-detail-when-weight)] text-[var(--fc-text-secondary)]"
        >
          {whenLabel}
        </div>
        <h1
          data-testid="ride-detail-title"
          className="fc-display text-[length:var(--fc-font-ride-detail-title-size)] leading-[var(--fc-font-ride-detail-title-line)] font-[number:var(--fc-font-ride-detail-title-weight)] text-[var(--fc-text-primary)]"
        >
          {title}
        </h1>
      </div>

      <div data-testid="ride-detail-panel-route">{routePanel}</div>
    </div>
  )
}
