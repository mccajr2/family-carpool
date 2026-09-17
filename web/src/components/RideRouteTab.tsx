import { useMemo, useState, type DragEvent } from "react"
import {
  Bell,
  Check,
  Flag,
  GripVertical,
  Home,
  Info,
  Loader2,
  MessageCircle,
  Navigation,
  Users,
} from "lucide-react"

import type {
  FixtureRideStop,
  RideNotifyContact,
} from "@/components/rideDetailFixtures"
import {
  type RideNotifyRequest,
  type RideNotifyResult,
  deliverRideReadyByNotify,
} from "@/components/rideNotify"
import {
  type RideRouteScheduleView,
  routeLeadCopy,
} from "@/components/rideScheduleFromCalendarRoute"
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
  /** Live OK schedule (or fixture schedule shape for tests). */
  carpoolRoute: RideRouteScheduleView
  /** Calendar item start ISO — converted to local `h:mm AM/PM` for schedule math. */
  startsAt: string
  /** Event venue label; falls back to destination stop name. */
  location?: string | null
  /** Optional override for tests / config. */
  mapsEmbedApiKey?: string | null
  /** Notify delay ms — default matches mockup; override in tests. */
  notifyDelayMs?: number
  /**
   * Channel-agnostic delivery hook. Defaults to {@link deliverRideReadyByNotify}
   * (no-op / soft-success, no network). Inject in tests; replace for push.
   */
  deliverNotify?: (request: RideNotifyRequest) => Promise<RideNotifyResult>
  /**
   * When true and there are 2+ middle stops, middle rows are drag-reorderable.
   * Hidden/inert for non-drivers, UNAVAILABLE hosts, or single-middle routes.
   */
  canReorderMiddles?: boolean
  /**
   * Persist a new middle-stop order (addresses). Host refreshes schedule
   * from the PUT response. Omitted when reorder is inert.
   */
  onReorderMiddles?: (middleStopIds: string[]) => Promise<void>
  /**
   * Active There/Back leg (informational for chrome / reorder). Tabs are owned
   * by the host when both legs are routable.
   */
  leg?: "TO" | "FROM"
}

/** Local wall-clock `h:mm AM/PM` from an ISO instant (matches `toMinutes` / `toTime`). */
export function eventStartClockFromIso(startsAt: string): string {
  const date = new Date(startsAt)
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid startsAt: ${startsAt}`)
  }
  return toTime(date.getHours() * 60 + date.getMinutes())
}

/** Pure reorder of middle stops by address identity (fixed start/end). */
export function reorderMiddleStopsByAddress(
  stops: FixtureRideStop[],
  fromAddress: string,
  toAddress: string,
): FixtureRideStop[] | null {
  if (fromAddress === toAddress || stops.length < 3) {
    return null
  }
  const fixedStart = stops[0]
  const fixedEnd = stops[stops.length - 1]
  if (fixedStart == null || fixedEnd == null) {
    return null
  }
  const toShape =
    fixedStart.kind === "home" && fixedEnd.kind === "destination"
  const fromShape =
    fixedStart.kind === "destination" && fixedEnd.kind === "home"
  if (!toShape && !fromShape) {
    return null
  }
  const expectedMiddle = toShape ? "pickup" : "dropoff"
  const middles = stops.slice(1, -1)
  if (middles.some((stop) => stop.kind !== expectedMiddle)) {
    return null
  }
  const fromIndex = middles.findIndex((stop) => stop.address === fromAddress)
  const toIndex = middles.findIndex((stop) => stop.address === toAddress)
  if (fromIndex < 0 || toIndex < 0) {
    return null
  }
  const next = [...middles]
  const [moved] = next.splice(fromIndex, 1)
  next.splice(toIndex, 0, moved!)
  return [fixedStart, ...next, fixedEnd]
}

/** @deprecated Prefer {@link reorderMiddleStopsByAddress}. */
export function reorderPickupStopsByAddress(
  stops: FixtureRideStop[],
  fromAddress: string,
  toAddress: string,
): FixtureRideStop[] | null {
  return reorderMiddleStopsByAddress(stops, fromAddress, toAddress)
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
          <div key={`${stop.kind}-${stop.address}`} className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 rounded-full border border-[var(--fc-border)] bg-[var(--fc-surface-raised)] px-3 py-1.5 text-xs font-semibold text-[var(--fc-text-primary)]">
              {stop.kind === "home" ? <Home aria-hidden size={12} /> : null}
              {stop.kind === "pickup" || stop.kind === "dropoff" ? (
                <Users aria-hidden size={12} />
              ) : null}
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
  onNotify: (stop: FixtureRideStop, readyByLabel: string) => void
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
          onClick={() => onNotify(stop, toTime(time))}
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
        onClick={() => onNotify(stop, toTime(time))}
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
  reorderable,
  reorderBusy,
  onDragStartPickup,
  onDragOverPickup,
  onDropPickup,
}: {
  stop: FixtureRideStop
  time: number
  isFirst: boolean
  isLast: boolean
  notifyState: RideNotifyState | undefined
  onNotify: (stop: FixtureRideStop, readyByLabel: string) => void
  reorderable: boolean
  reorderBusy: boolean
  onDragStartPickup: (address: string, event: DragEvent<HTMLDivElement>) => void
  onDragOverPickup: (event: DragEvent<HTMLDivElement>) => void
  onDropPickup: (address: string, event: DragEvent<HTMLDivElement>) => void
}) {
  const label = isFirst ? "Leave by" : isLast ? "Arrive by" : "Be ready by"
  const Icon =
    stop.kind === "home" ? Home : stop.kind === "destination" ? Flag : Users

  return (
    <div
      data-testid={`ride-route-stop-${stop.name}`}
      data-stop-address={stop.address}
      data-reorderable={reorderable ? "true" : undefined}
      draggable={reorderable && !reorderBusy}
      onDragStart={
        reorderable
          ? (event) => onDragStartPickup(stop.address, event)
          : undefined
      }
      onDragOver={reorderable ? onDragOverPickup : undefined}
      onDrop={reorderable ? (event) => onDropPickup(stop.address, event) : undefined}
      className={`flex gap-4 ${reorderable ? "cursor-grab active:cursor-grabbing" : ""} ${
        reorderBusy && reorderable ? "opacity-60" : ""
      }`}
    >
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
          <div className="flex min-w-0 items-center gap-2">
            {reorderable ? (
              <span
                data-testid={`ride-route-drag-handle-${stop.address}`}
                className="shrink-0 text-[var(--fc-text-secondary)]"
                aria-hidden
              >
                <GripVertical size={14} />
              </span>
            ) : null}
            <div className="text-[length:var(--fc-font-ride-detail-stop-name-size)] leading-[var(--fc-font-ride-detail-stop-name-line)] font-[number:var(--fc-font-ride-detail-stop-name-weight)] text-[var(--fc-text-primary)]">
              {stop.name}
            </div>
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

export type RideRouteLegTabsProps = {
  leg: "TO" | "FROM"
  availableLegs: Array<"TO" | "FROM">
  onLegChange: (leg: "TO" | "FROM") => void
}

/** There / Back tabs when both legs are routable for the viewer. */
export function RideRouteLegTabs({
  leg,
  availableLegs,
  onLegChange,
}: RideRouteLegTabsProps) {
  if (availableLegs.length < 2) {
    return null
  }
  return (
    <div
      role="tablist"
      aria-label="Route direction"
      data-testid="ride-route-leg-tabs"
      className="mb-[var(--fc-space-ride-detail-block-mb)] flex gap-2"
    >
      {availableLegs.includes("TO") ? (
        <button
          type="button"
          role="tab"
          aria-selected={leg === "TO"}
          data-testid="ride-route-leg-there"
          onClick={() => onLegChange("TO")}
          className={`rounded-[var(--fc-radius-lg)] px-3 py-1.5 text-sm font-semibold ${
            leg === "TO"
              ? "bg-[var(--fc-text-primary)] text-[var(--fc-surface-raised)]"
              : "bg-[var(--fc-hero-carousel-control-bg)] text-[var(--fc-text-secondary)]"
          }`}
        >
          There
        </button>
      ) : null}
      {availableLegs.includes("FROM") ? (
        <button
          type="button"
          role="tab"
          aria-selected={leg === "FROM"}
          data-testid="ride-route-leg-back"
          onClick={() => onLegChange("FROM")}
          className={`rounded-[var(--fc-radius-lg)] px-3 py-1.5 text-sm font-semibold ${
            leg === "FROM"
              ? "bg-[var(--fc-text-primary)] text-[var(--fc-surface-raised)]"
              : "bg-[var(--fc-hero-carousel-control-bg)] text-[var(--fc-text-secondary)]"
          }`}
        >
          Back
        </button>
      ) : null}
    </div>
  )
}

/**
 * Route tab: leave-by hero, map/placeholder, stop list, local notify UI.
 * Delivery goes through {@link deliverRideReadyByNotify} (no network until push).
 */
export function RideRouteTab({
  carpoolRoute,
  startsAt,
  location = null,
  mapsEmbedApiKey = googleMapsEmbedApiKey,
  notifyDelayMs = 700,
  deliverNotify = deliverRideReadyByNotify,
  canReorderMiddles = false,
  onReorderMiddles,
  leg = "TO",
}: RideRouteTabProps) {
  const [notifyStates, setNotifyStates] = useState<Record<string, RideNotifyState>>({})
  const [reorderBusy, setReorderBusy] = useState(false)
  const [dragFromAddress, setDragFromAddress] = useState<string | null>(null)
  const eventStart = eventStartClockFromIso(startsAt)
  const lead = routeLeadCopy(carpoolRoute.bufferMinutes)
  const { arriveBy, stopTimes } = useMemo(
    () => computeSchedule(carpoolRoute, eventStart),
    [carpoolRoute, eventStart],
  )
  const leaveBy = stopTimes[0] ?? arriveBy
  const firstStopName = carpoolRoute.stops[0]?.name?.trim() || null
  const lastStopName =
    carpoolRoute.stops[carpoolRoute.stops.length - 1]?.name?.trim() || null
  const leavePlaceName =
    leg === "FROM"
      ? location?.trim() || firstStopName || "venue"
      : carpoolRoute.stops[0]?.kind === "home"
        ? "home"
        : firstStopName || "home"
  const arrivePlaceName =
    leg === "TO"
      ? location?.trim() || lastStopName || "destination"
      : carpoolRoute.stops[carpoolRoute.stops.length - 1]?.kind === "home"
        ? "home"
        : lastStopName || "home"
  const navHref = navigationUrl(carpoolRoute.stops)
  const middleKind = leg === "FROM" ? "dropoff" : "pickup"
  const middleCount = carpoolRoute.stops.filter((stop) => stop.kind === middleKind).length
  const reorderEnabled =
    canReorderMiddles && onReorderMiddles != null && middleCount >= 2

  function handleNotify(stop: FixtureRideStop, readyByLabel: string) {
    const contact = stop.contact
    if (contact == null) {
      return
    }
    setNotifyStates((current) => ({
      ...current,
      [stop.name]: { status: "sending" },
    }))
    void deliverNotify({
      channel: contact.channel,
      to: contact.to,
      stopName: stop.name,
      readyByLabel,
    }).then((result) => {
      window.setTimeout(() => {
        setNotifyStates((current) => {
          if (!result.ok) {
            // Soft-fail: drop sending state. Failure chrome → ride-detail-polish.
            const next = { ...current }
            delete next[stop.name]
            return next
          }
          return {
            ...current,
            [stop.name]: { status: "sent", sentAt: formatSentAt() },
          }
        })
      }, notifyDelayMs)
    })
  }

  function handleDragStartPickup(address: string, event: DragEvent<HTMLDivElement>) {
    setDragFromAddress(address)
    event.dataTransfer.effectAllowed = "move"
    event.dataTransfer.setData("text/plain", address)
  }

  function handleDragOverPickup(event: DragEvent<HTMLDivElement>) {
    event.preventDefault()
    event.dataTransfer.dropEffect = "move"
  }

  function handleDropPickup(toAddress: string, event: DragEvent<HTMLDivElement>) {
    event.preventDefault()
    const fromAddress = dragFromAddress ?? event.dataTransfer.getData("text/plain")
    setDragFromAddress(null)
    if (fromAddress === "" || onReorderMiddles == null) {
      return
    }
    const reordered = reorderMiddleStopsByAddress(
      carpoolRoute.stops,
      fromAddress,
      toAddress,
    )
    if (reordered == null) {
      return
    }
    const middleStopIds = reordered
      .filter((stop) => stop.kind === middleKind)
      .map((stop) => stop.address)
    setReorderBusy(true)
    void onReorderMiddles(middleStopIds)
      .catch(() => {
        // Host keeps prior route; leave UI as-is.
      })
      .finally(() => {
        setReorderBusy(false)
      })
  }

  return (
    <div data-testid="ride-route-tab" data-route-leg={leg}>
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
            {lead.badge}
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
          Leave {leavePlaceName} to arrive at {arrivePlaceName} by {toTime(arriveBy)} —{" "}
          {carpoolRoute.bufferMinutes} min before {lead.eventNoun} at {eventStart}
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
            key={`${stop.kind}-${stop.address}-${index}`}
            stop={stop}
            time={stopTimes[index]!}
            isFirst={index === 0}
            isLast={index === carpoolRoute.stops.length - 1}
            notifyState={notifyStates[stop.name]}
            onNotify={handleNotify}
            reorderable={reorderEnabled && stop.kind === middleKind}
            reorderBusy={reorderBusy}
            onDragStartPickup={handleDragStartPickup}
            onDragOverPickup={handleDragOverPickup}
            onDropPickup={handleDropPickup}
          />
        ))}
      </div>
    </div>
  )
}
