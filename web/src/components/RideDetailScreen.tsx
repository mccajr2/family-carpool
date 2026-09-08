import type { ReactNode } from "react"
import { ArrowLeft } from "lucide-react"
import type { FixtureCarpoolRoute } from "@/components/rideDetailFixtures"

export type RideDetailTab = "route" | "playlist"

const tabClass =
  "rounded-[var(--fc-radius-lg)] px-[var(--fc-space-ride-detail-tab-pad-x)] py-[var(--fc-space-ride-detail-tab-pad-y)] text-[length:var(--fc-font-ride-detail-tab-size)] leading-[var(--fc-font-ride-detail-tab-line)] font-[number:var(--fc-font-ride-detail-tab-weight)]"

export type RideDetailScreenProps = {
  title: string
  whenLabel: string
  tab: RideDetailTab
  onTabChange: (tab: RideDetailTab) => void
  onBack: () => void
  /** Remix seed for playlist tab — reset to 0 when opening detail. */
  shuffleSeed?: number
  /** Fixture (or later live) route + playlist payload for tab bodies. */
  carpoolRoute?: FixtureCarpoolRoute | null
  /** Route tab body. */
  routePanel?: ReactNode
  /** Playlist tab body. */
  playlistPanel?: ReactNode
}

/**
 * Calendar ride-detail chrome: back, event header, Route | Playlist segmented
 * control. Ported from mockup DetailScreen.
 */
export function RideDetailScreen({
  title,
  whenLabel,
  tab,
  onTabChange,
  onBack,
  shuffleSeed = 0,
  carpoolRoute = null,
  routePanel = null,
  playlistPanel = null,
}: RideDetailScreenProps) {
  return (
    <div
      data-testid="ride-detail-screen"
      data-shuffle-seed={shuffleSeed}
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

      <div className="mb-[var(--fc-space-ride-detail-header-mb)] flex flex-wrap items-center justify-between gap-2">
        <div>
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

        <div
          role="tablist"
          aria-label="Ride detail sections"
          data-testid="ride-detail-tabs"
          className="flex items-center gap-1 rounded-[var(--fc-radius-xl)] bg-[var(--fc-hero-carousel-control-bg)] p-[var(--fc-space-ride-detail-tab-rail-pad)]"
        >
          <button
            type="button"
            role="tab"
            id="ride-detail-tab-route"
            aria-selected={tab === "route"}
            aria-controls="ride-detail-panel-route"
            data-testid="ride-detail-tab-route"
            onClick={() => onTabChange("route")}
            className={`${tabClass} ${
              tab === "route"
                ? "bg-[var(--fc-surface-raised)] text-[var(--fc-text-primary)] shadow-[0_1px_2px_rgba(0,0,0,0.08)]"
                : "text-[var(--fc-text-secondary)]"
            }`}
          >
            Route
          </button>
          <button
            type="button"
            role="tab"
            id="ride-detail-tab-playlist"
            aria-selected={tab === "playlist"}
            aria-controls="ride-detail-panel-playlist"
            data-testid="ride-detail-tab-playlist"
            onClick={() => onTabChange("playlist")}
            className={`${tabClass} ${
              tab === "playlist"
                ? "bg-[var(--fc-surface-raised)] text-[var(--fc-text-primary)] shadow-[0_1px_2px_rgba(0,0,0,0.08)]"
                : "text-[var(--fc-text-secondary)]"
            }`}
          >
            Playlist
          </button>
        </div>
      </div>

      <div
        role="tabpanel"
        id={tab === "route" ? "ride-detail-panel-route" : "ride-detail-panel-playlist"}
        aria-labelledby={
          tab === "route" ? "ride-detail-tab-route" : "ride-detail-tab-playlist"
        }
        data-testid={
          tab === "route" ? "ride-detail-panel-route" : "ride-detail-panel-playlist"
        }
      >
        {tab === "route" ? routePanel : playlistPanel}
      </div>
    </div>
  )
}
