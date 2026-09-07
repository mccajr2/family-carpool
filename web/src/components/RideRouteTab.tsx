import { useMemo, useState } from "react"
import {
  Bell,
  Check,
  Flag,
  Home,
  Info,
  Loader2,
  MessageCircle,
  Navigation,
  Users,
} from "lucide-react"

import type {
  FixtureCarpoolRoute,
  FixtureRideStop,
  RideNotifyContact,
} from "@/components/rideDetailFixtures"
import {
  computeSchedule,
  embedUrl,
  navigationUrl,
  toTime,
} from "@/components/rideScheduleUtils"
import { googleMapsEmbedApiKey } from "@/config"

export type RideNotifyStatus = "sending" | "sent"

export type RideNotifyState = {
  status: RideNotifyStatus
  sentAt?: string
}

export type RideRouteTabProps = {
  carpoolRoute: FixtureCarpoolRoute
  /** Calendar item start ISO — converted to local `h:mm AM/PM` for schedule math. */
  startsAt: string
  /** Event venue label; falls back to destination stop name. */
  location?: string | null
  /** Optional override for tests / config. */
  mapsEmbedApiKey?: string | null
  /** Notify delay ms — default matches mockup; override in tests. */
  notifyDelayMs?: number
}

/** Local wall-clock `h:mm AM/PM` from an ISO instant (matches `toMinutes` / `toTime`). */
export function eventStartClockFromIso(startsAt: string): string {
  const date = new Date(startsAt)
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid startsAt: ${startsAt}`)
  }
  return toTime(date.getHours() * 60 + date.getMinutes())
}

function formatSentAt(now: Date = new Date()): string {
  return now.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
}

function channelLabel(channel: RideNotifyContact["channel"]): string {
  return channel === "push" ? "push notification" : "text message"
}

function RouteMap({
  stops,
  apiKey,
}: {
  stops: FixtureRideStop[]
  apiKey: string | null | undefined
}) {
  const src = embedUrl(stops, apiKey)
  if (src) {
    return (
      <div
        data-testid="ride-route-map-embed"
        className="overflow-hidden rounded-[var(--fc-radius-xl)] border border-[var(--fc-border)]"
      >
        <iframe
          title="Carpool route"
          src={src}
          width="100%"
          height="280"
          className="h-[var(--fc-space-ride-detail-map-h)] w-full border-0"
          loading="lazy"
        />
      </div>
    )
  }

  return (
    <div
      data-testid="ride-route-map-placeholder"
      className="rounded-[var(--fc-radius-xl)] border border-dashed border-[var(--fc-border)] bg-[var(--fc-hero-carousel-control-bg)] p-[var(--fc-space-ride-detail-map-placeholder-pad)]"
    >
      <div className="flex items-start gap-3">
        <Info
          aria-hidden
          size={18}
          className="mt-0.5 shrink-0 text-[var(--fc-text-secondary)]"
        />
        <div>
          <div className="text-sm font-semibold text-[var(--fc-text-primary)]">
            Live map needs a Google Maps API key
          </div>
          <div className="mt-1 text-sm text-[var(--fc-text-secondary)]">
            Add a free Maps Embed API key from Google Cloud Console (no billing charge for
            Embed usage) to show the route here. Stop order below is already computed — the
            map is just the visual.
          </div>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        {stops.map((stop, index) => (
          <div key={stop.name} className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 rounded-full border border-[var(--fc-border)] bg-[var(--fc-surface-raised)] px-3 py-1.5 text-xs font-semibold text-[var(--fc-text-primary)]">
              {stop.kind === "home" ? <Home aria-hidden size={12} /> : null}
              {stop.kind === "pickup" ? <Users aria-hidden size={12} /> : null}
              {stop.kind === "destination" ? <Flag aria-hidden size={12} /> : null}
              {stop.name}
            </div>
            {index < stops.length - 1 ? (
              <div className="h-px w-4 bg-[var(--fc-border)]" aria-hidden />
            ) : null}
          </div>
        ))}
      </div>
    </div>
  )
}

function NotifyAction({
  stop,
  time,
  state,
  onNotify,
}: {
  stop: FixtureRideStop & { contact: RideNotifyContact }
  time: number
  state: RideNotifyState | undefined
  onNotify: (stop: FixtureRideStop) => void
}) {
  const channel = stop.contact.channel
  const ChannelIcon = channel === "push" ? Bell : MessageCircle
  const label = channelLabel(channel)

  if (state?.status === "sent") {
    return (
      <div
        data-testid={`ride-route-notify-${stop.name}`}
        data-notify-status="sent"
        className="mt-2 flex flex-wrap items-center gap-2"
      >
        <span className="inline-flex items-center gap-1.5 rounded-[var(--fc-radius-lg)] bg-[color-mix(in_srgb,var(--fc-success)_16%,transparent)] px-[var(--fc-space-ride-detail-notify-pad-x)] py-[var(--fc-space-ride-detail-notify-pad-y)] text-[length:var(--fc-font-ride-detail-notify-size)] leading-[var(--fc-font-ride-detail-notify-line)] font-[number:var(--fc-font-ride-detail-notify-weight)] text-[var(--fc-success)]">
          <Check aria-hidden size={12} /> Sent via {label} · {state.sentAt}
        </span>
        <button
          type="button"
          onClick={() => onNotify(stop)}
          className="text-[length:var(--fc-font-ride-detail-notify-size)] leading-[var(--fc-font-ride-detail-notify-line)] text-[var(--fc-text-secondary)] underline underline-offset-2"
        >
          Resend
        </button>
      </div>
    )
  }

  if (state?.status === "sending") {
    return (
      <div
        data-testid={`ride-route-notify-${stop.name}`}
        data-notify-status="sending"
        className="mt-2 inline-flex items-center gap-1.5 rounded-[var(--fc-radius-lg)] bg-[var(--fc-hero-carousel-control-bg)] px-[var(--fc-space-ride-detail-notify-pad-x)] py-[var(--fc-space-ride-detail-notify-pad-y)] text-[length:var(--fc-font-ride-detail-notify-size)] leading-[var(--fc-font-ride-detail-notify-line)] font-[number:var(--fc-font-ride-detail-notify-weight)] text-[var(--fc-text-secondary)]"
      >
        <Loader2 aria-hidden size={12} className="animate-spin" /> Sending…
      </div>
    )
  }

  return (
    <div data-testid={`ride-route-notify-${stop.name}`} data-notify-status="idle">
      <button
        type="button"
        onClick={() => onNotify(stop)}
        className="mt-2 inline-flex items-center gap-1.5 rounded-[var(--fc-radius-lg)] bg-[var(--fc-hero-carousel-control-bg)] px-[var(--fc-space-ride-detail-notify-pad-x)] py-[var(--fc-space-ride-detail-notify-pad-y)] text-[length:var(--fc-font-ride-detail-notify-size)] leading-[var(--fc-font-ride-detail-notify-line)] font-[number:var(--fc-font-ride-detail-notify-weight)] text-[var(--fc-text-primary)]"
      >
        <ChannelIcon aria-hidden size={12} /> Notify {toTime(time)} ready-by time
      </button>
      <div className="mt-1 text-[length:var(--fc-font-ride-detail-notify-size)] leading-[var(--fc-font-ride-detail-notify-line)] text-[var(--fc-text-secondary)]">
        Will send to {stop.contact.to} via {label}
        {channel === "sms" ? " — no push token on file yet" : ""}
      </div>
    </div>
  )
}

function StopRow({
  stop,
  time,
  isFirst,
  isLast,
  notifyState,
  onNotify,
}: {
  stop: FixtureRideStop
  time: number
  isFirst: boolean
  isLast: boolean
  notifyState: RideNotifyState | undefined
  onNotify: (stop: FixtureRideStop) => void
}) {
  const label = isFirst ? "Leave by" : isLast ? "Arrive by" : "Be ready by"
  const Icon =
    stop.kind === "home" ? Home : stop.kind === "destination" ? Flag : Users

  return (
    <div data-testid={`ride-route-stop-${stop.name}`} className="flex gap-4">
      <div className="flex shrink-0 flex-col items-center">
        <div
          className={`flex items-center justify-center rounded-full ${
            isLast
              ? "bg-[color-mix(in_srgb,var(--fc-success)_16%,transparent)] text-[var(--fc-success)]"
              : "bg-[color-mix(in_srgb,var(--fc-accent)_16%,transparent)] text-[var(--fc-accent)]"
          }`}
          style={{
            width: "var(--fc-space-ride-detail-stop-icon)",
            height: "var(--fc-space-ride-detail-stop-icon)",
          }}
        >
          <Icon aria-hidden size={15} />
        </div>
        {!isLast ? (
          <div className="mt-1 w-px flex-1 bg-[var(--fc-border)]" aria-hidden />
        ) : null}
      </div>
      <div className="min-w-0 flex-1 pb-6">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <div className="text-[length:var(--fc-font-ride-detail-stop-name-size)] leading-[var(--fc-font-ride-detail-stop-name-line)] font-[number:var(--fc-font-ride-detail-stop-name-weight)] text-[var(--fc-text-primary)]">
            {stop.name}
          </div>
          <div className="text-[length:var(--fc-font-ride-detail-stop-meta-size)] leading-[var(--fc-font-ride-detail-stop-meta-line)] font-[number:var(--fc-font-ride-detail-stop-meta-weight)] text-[var(--fc-text-secondary)]">
            {label}{" "}
            <span className="text-[var(--fc-text-primary)]">{toTime(time)}</span>
          </div>
        </div>
        <div className="mt-0.5 text-[length:var(--fc-font-ride-detail-hero-copy-size)] leading-[var(--fc-font-ride-detail-hero-copy-line)] font-[number:var(--fc-font-ride-detail-hero-copy-weight)] text-[var(--fc-text-secondary)]">
          {stop.address}
        </div>
        {stop.kind === "pickup" && stop.contact != null ? (
          <NotifyAction
            stop={{ ...stop, contact: stop.contact }}
            time={time}
            state={notifyState}
            onNotify={onNotify}
          />
        ) : null}
      </div>
    </div>
  )
}

/**
 * Route tab: leave-by hero, map/placeholder, stop list, local notify stub.
 * Schedule / maps URLs from rideScheduleUtils; no network for notify.
 */
export function RideRouteTab({
  carpoolRoute,
  startsAt,
  location = null,
  mapsEmbedApiKey = googleMapsEmbedApiKey,
  notifyDelayMs = 700,
}: RideRouteTabProps) {
  const [notifyStates, setNotifyStates] = useState<Record<string, RideNotifyState>>({})
  const eventStart = eventStartClockFromIso(startsAt)
  const isPractice = carpoolRoute.kind === "practice"
  const { arriveBy, stopTimes } = useMemo(
    () => computeSchedule(carpoolRoute, eventStart),
    [carpoolRoute, eventStart],
  )
  const leaveBy = stopTimes[0] ?? arriveBy
  const destinationName =
    location?.trim() ||
    carpoolRoute.stops.find((stop) => stop.kind === "destination")?.name ||
    "destination"
  const navHref = navigationUrl(carpoolRoute.stops)

  function handleNotify(stop: FixtureRideStop) {
    setNotifyStates((current) => ({
      ...current,
      [stop.name]: { status: "sending" },
    }))
    window.setTimeout(() => {
      setNotifyStates((current) => ({
        ...current,
        [stop.name]: { status: "sent", sentAt: formatSentAt() },
      }))
    }, notifyDelayMs)
  }

  return (
    <div data-testid="ride-route-tab">
      <div
        data-testid="ride-route-hero"
        className="relative overflow-hidden rounded-[var(--fc-radius-xl)] p-[var(--fc-space-hero-slide-pad)] text-[var(--fc-hero-on)] mb-[var(--fc-space-ride-detail-block-mb)]"
        style={{ background: "var(--fc-hero-glow)" }}
      >
        <div className="mb-2 flex items-center gap-2 uppercase tracking-widest text-[length:var(--fc-font-ride-detail-when-size)] leading-[var(--fc-font-ride-detail-when-line)] font-[number:var(--fc-font-ride-detail-when-weight)]">
          <span
            className="rounded-full px-[var(--fc-space-ride-detail-badge-pad-x)] py-[var(--fc-space-ride-detail-badge-pad-y)]"
            style={{
              background: "var(--fc-hero-most-urgent-badge)",
              color: "var(--fc-hero-ring)",
            }}
          >
            {isPractice ? "15 min early for practices" : "45 min early for games"}
          </span>
        </div>
        <div
          data-testid="ride-route-leave-by"
          className="mb-2 text-[length:var(--fc-font-ride-detail-leave-by-size)] leading-[var(--fc-font-ride-detail-leave-by-line)] font-[number:var(--fc-font-ride-detail-leave-by-weight)]"
        >
          {toTime(leaveBy)}
        </div>
        <div
          data-testid="ride-route-hero-copy"
          className="text-[length:var(--fc-font-ride-detail-hero-copy-size)] leading-[var(--fc-font-ride-detail-hero-copy-line)] font-[number:var(--fc-font-ride-detail-hero-copy-weight)] text-[var(--fc-hero-on-secondary)]"
        >
          Leave home to arrive at {destinationName} by {toTime(arriveBy)} —{" "}
          {carpoolRoute.bufferMinutes} min before{" "}
          {isPractice ? "practice starts" : "puck drop"} at {eventStart}
        </div>
        <a
          href={navHref}
          target="_blank"
          rel="noreferrer"
          data-testid="ride-route-start-nav"
          className="mt-[var(--fc-space-ride-detail-cta-mt)] inline-flex items-center gap-2 rounded-[var(--fc-radius-xl)] px-[var(--fc-space-ride-detail-cta-pad-x)] py-[var(--fc-space-ride-detail-cta-pad-y)] text-[length:var(--fc-font-ride-detail-cta-size)] leading-[var(--fc-font-ride-detail-cta-line)] font-[number:var(--fc-font-ride-detail-cta-weight)]"
          style={{ background: "var(--fc-hero-on)", color: "var(--fc-hero-on-inverse)" }}
        >
          <Navigation aria-hidden size={16} /> Start navigation
        </a>
      </div>

      <div className="mb-[var(--fc-space-ride-detail-block-mb)]">
        <RouteMap stops={carpoolRoute.stops} apiKey={mapsEmbedApiKey} />
      </div>

      <div className="mb-3 uppercase tracking-wide text-[length:var(--fc-font-ride-detail-section-size)] leading-[var(--fc-font-ride-detail-section-line)] font-[number:var(--fc-font-ride-detail-section-weight)] text-[var(--fc-text-secondary)]">
        Stop by stop
      </div>
      <div data-testid="ride-route-stops">
        {carpoolRoute.stops.map((stop, index) => (
          <StopRow
            key={stop.name}
            stop={stop}
            time={stopTimes[index]!}
            isFirst={index === 0}
            isLast={index === carpoolRoute.stops.length - 1}
            notifyState={notifyStates[stop.name]}
            onNotify={handleNotify}
          />
        ))}
      </div>
    </div>
  )
}
