import { useMemo, useState } from "react"
import {
  Bell,
  Check,
  Info,
  Loader2,
  MessageCircle,
  Music,
  Play,
  Shuffle,
} from "lucide-react"

import type {
  FixtureCarpoolRoute,
  FixturePlaylistRider,
  RideNotifyContact,
} from "@/components/rideDetailFixtures"
import type { RideNotifyState } from "@/components/RideRouteTab"
import {
  fmtMinSec,
  mergeTracks,
  type MergedTrack,
} from "@/components/rideScheduleUtils"

/** Demo Spotify URL from the mockup — not a live playlist. */
export const SPOTIFY_DEMO_PLAYLIST_URL =
  "https://open.spotify.com/playlist/carpool-demo"

export type RidePlaylistTabProps = {
  carpoolRoute: FixtureCarpoolRoute
  shuffleSeed: number
  onRemix: () => void
  /** Invite delay ms — default matches mockup; override in tests. */
  inviteDelayMs?: number
}

function formatSentAt(now: Date = new Date()): string {
  return now.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
}

function channelLabel(channel: RideNotifyContact["channel"]): string {
  return channel === "push" ? "push notification" : "text message"
}

/**
 * Seeded Fisher–Yates remix used by "Remix merge order".
 * Seed 0 returns the fair merge order unchanged.
 */
export function remixMergedTracks(
  tracks: MergedTrack[],
  shuffleSeed: number,
): MergedTrack[] {
  if (shuffleSeed === 0) {
    return tracks
  }
  const arr = [...tracks]
  let seed = shuffleSeed
  for (let i = arr.length - 1; i > 0; i--) {
    seed = (seed * 9301 + 49297) % 233280
    const j = Math.floor((seed / 233280) * (i + 1))
    ;[arr[i], arr[j]] = [arr[j]!, arr[i]!]
  }
  return arr
}

function InviteAction({
  rider,
  state,
  onInvite,
}: {
  rider: FixturePlaylistRider & { contact: RideNotifyContact }
  state: RideNotifyState | undefined
  onInvite: (rider: FixturePlaylistRider) => void
}) {
  const channel = rider.contact.channel
  const ChannelIcon = channel === "push" ? Bell : MessageCircle
  const label = channelLabel(channel)

  if (state?.status === "sent") {
    return (
      <div
        data-testid={`ride-playlist-invite-${rider.name}`}
        data-invite-status="sent"
        className="mt-2 flex flex-wrap items-center gap-2"
      >
        <span className="inline-flex items-center gap-1.5 rounded-[var(--fc-radius-lg)] bg-[color-mix(in_srgb,var(--fc-success)_16%,transparent)] px-[var(--fc-space-ride-detail-notify-pad-x)] py-[var(--fc-space-ride-detail-notify-pad-y)] text-[length:var(--fc-font-ride-detail-notify-size)] leading-[var(--fc-font-ride-detail-notify-line)] font-[number:var(--fc-font-ride-detail-notify-weight)] text-[var(--fc-success)]">
          <Check aria-hidden size={12} /> Invite sent via {label} · {state.sentAt}
        </span>
        <button
          type="button"
          onClick={() => onInvite(rider)}
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
        data-testid={`ride-playlist-invite-${rider.name}`}
        data-invite-status="sending"
        className="mt-2 inline-flex items-center gap-1.5 rounded-[var(--fc-radius-lg)] bg-[var(--fc-hero-carousel-control-bg)] px-[var(--fc-space-ride-detail-notify-pad-x)] py-[var(--fc-space-ride-detail-notify-pad-y)] text-[length:var(--fc-font-ride-detail-notify-size)] leading-[var(--fc-font-ride-detail-notify-line)] font-[number:var(--fc-font-ride-detail-notify-weight)] text-[var(--fc-text-secondary)]"
      >
        <Loader2 aria-hidden size={12} className="animate-spin" /> Sending…
      </div>
    )
  }

  return (
    <button
      type="button"
      data-testid={`ride-playlist-invite-${rider.name}`}
      data-invite-status="idle"
      onClick={() => onInvite(rider)}
      className="mt-2 inline-flex items-center gap-1.5 rounded-[var(--fc-radius-lg)] bg-[var(--fc-hero-carousel-control-bg)] px-[var(--fc-space-ride-detail-notify-pad-x)] py-[var(--fc-space-ride-detail-notify-pad-y)] text-[length:var(--fc-font-ride-detail-notify-size)] leading-[var(--fc-font-ride-detail-notify-line)] font-[number:var(--fc-font-ride-detail-notify-weight)] text-[var(--fc-text-primary)]"
    >
      <ChannelIcon aria-hidden size={12} /> Ask {rider.name} to add a playlist
    </button>
  )
}

function RiderTile({
  rider,
  inviteState,
  onInvite,
}: {
  rider: FixturePlaylistRider
  inviteState: RideNotifyState | undefined
  onInvite: (rider: FixturePlaylistRider) => void
}) {
  if (!rider.connected) {
    return (
      <div
        data-testid={`ride-playlist-rider-${rider.name}`}
        data-connected="false"
        className="rounded-[var(--fc-radius-xl)] border border-dashed border-[var(--fc-border)] bg-[var(--fc-surface-raised)] p-4"
      >
        <div className="flex items-center gap-2">
          <span
            aria-hidden
            className="flex items-center justify-center rounded-full text-[length:var(--fc-font-ride-detail-track-from-label-size)] leading-[var(--fc-font-ride-detail-track-from-label-line)] font-[number:var(--fc-font-ride-detail-track-from-label-weight)] text-[var(--fc-accent-on)] bg-[var(--fc-text-secondary)]"
            style={{
              width: "var(--fc-space-ride-detail-avatar)",
              height: "var(--fc-space-ride-detail-avatar)",
            }}
          >
            {rider.name.charAt(0).toUpperCase()}
          </span>
          <div>
            <div className="text-[length:var(--fc-font-ride-detail-stop-meta-size)] leading-[var(--fc-font-ride-detail-stop-meta-line)] font-[number:var(--fc-font-ride-detail-stop-meta-weight)] text-[var(--fc-text-primary)]">
              {rider.name}
            </div>
            <div className="text-[length:var(--fc-font-ride-detail-notify-size)] leading-[var(--fc-font-ride-detail-notify-line)] text-[var(--fc-text-secondary)]">
              Hasn&apos;t added a playlist yet
            </div>
          </div>
        </div>
        {rider.contact != null ? (
          <InviteAction
            rider={{ ...rider, contact: rider.contact }}
            state={inviteState}
            onInvite={onInvite}
          />
        ) : null}
      </div>
    )
  }

  const totalSec = rider.tracks.reduce((n, track) => n + track.sec, 0)
  return (
    <div
      data-testid={`ride-playlist-rider-${rider.name}`}
      data-connected="true"
      className="rounded-[var(--fc-radius-xl)] border border-[var(--fc-border)] bg-[var(--fc-surface-raised)] p-4"
    >
      <div className="flex items-center gap-2">
        <span
          aria-hidden
          className="flex items-center justify-center rounded-full bg-[var(--fc-accent)] text-[length:var(--fc-font-ride-detail-track-from-label-size)] leading-[var(--fc-font-ride-detail-track-from-label-line)] font-[number:var(--fc-font-ride-detail-track-from-label-weight)] text-[var(--fc-accent-on)]"
          style={{
            width: "var(--fc-space-ride-detail-avatar)",
            height: "var(--fc-space-ride-detail-avatar)",
          }}
        >
          {rider.name.charAt(0).toUpperCase()}
        </span>
        <div className="min-w-0">
          <div className="truncate text-[length:var(--fc-font-ride-detail-stop-meta-size)] leading-[var(--fc-font-ride-detail-stop-meta-line)] font-[number:var(--fc-font-ride-detail-stop-meta-weight)] text-[var(--fc-text-primary)]">
            {rider.name}
          </div>
          <div className="truncate text-[length:var(--fc-font-ride-detail-notify-size)] leading-[var(--fc-font-ride-detail-notify-line)] text-[var(--fc-text-secondary)]">
            {rider.playlistName} · {rider.tracks.length} songs · {fmtMinSec(totalSec)}
          </div>
        </div>
      </div>
    </div>
  )
}

function TrackRow({ track }: { track: MergedTrack }) {
  return (
    <div
      data-testid={`ride-playlist-track-${track.title}`}
      className="flex items-center justify-between border-b border-[var(--fc-border)] px-1 py-2 last:border-b-0"
    >
      <div className="flex min-w-0 items-center gap-3">
        <span
          aria-hidden
          className="flex shrink-0 items-center justify-center rounded-full bg-[var(--fc-ride-detail-track-from)] text-[length:var(--fc-font-ride-detail-track-from-label-size)] leading-[var(--fc-font-ride-detail-track-from-label-line)] font-[number:var(--fc-font-ride-detail-track-from-label-weight)] text-[var(--fc-ride-detail-track-from-on)]"
          style={{
            width: "var(--fc-space-ride-detail-track-avatar)",
            height: "var(--fc-space-ride-detail-track-avatar)",
          }}
        >
          {track.from.charAt(0).toUpperCase()}
        </span>
        <div className="min-w-0">
          <div className="truncate text-[length:var(--fc-font-ride-detail-stop-meta-size)] leading-[var(--fc-font-ride-detail-stop-meta-line)] font-[number:var(--fc-font-ride-detail-hero-copy-weight)] text-[var(--fc-text-primary)]">
            {track.title}
          </div>
          <div className="truncate text-[length:var(--fc-font-ride-detail-notify-size)] leading-[var(--fc-font-ride-detail-notify-line)] text-[var(--fc-text-secondary)]">
            {track.artist}
          </div>
        </div>
      </div>
      <div className="shrink-0 pl-3 text-[length:var(--fc-font-ride-detail-notify-size)] leading-[var(--fc-font-ride-detail-notify-line)] text-[var(--fc-text-secondary)]">
        {fmtMinSec(track.sec)}
      </div>
    </div>
  )
}

/**
 * Playlist tab: riders, invite stub, merged hero, Spotify demo link, remix, tracks.
 * Merge math from rideScheduleUtils; invite is local UI only.
 */
export function RidePlaylistTab({
  carpoolRoute,
  shuffleSeed,
  onRemix,
  inviteDelayMs = 700,
}: RidePlaylistTabProps) {
  const [inviteStates, setInviteStates] = useState<Record<string, RideNotifyState>>({})
  const riders = carpoolRoute.playlistRiders
  const driveMinutes = useMemo(
    () => carpoolRoute.legMinutes.reduce((a, b) => a + b, 0),
    [carpoolRoute.legMinutes],
  )

  const merged = useMemo(() => {
    return remixMergedTracks(mergeTracks(riders), shuffleSeed)
  }, [riders, shuffleSeed])

  const totalSec = merged.reduce((n, track) => n + track.sec, 0)
  const driveSec = driveMinutes * 60
  const coversDrive = totalSec >= driveSec
  const connectedCount = riders.filter((rider) => rider.connected).length
  const allConnected = connectedCount === riders.length
  const disconnectedNames = riders
    .filter((rider) => !rider.connected)
    .map((rider) => rider.name)
  const queuedMinutesLabel = fmtMinSec(totalSec).split(":")[0]

  function handleInvite(rider: FixturePlaylistRider) {
    setInviteStates((current) => ({
      ...current,
      [rider.name]: { status: "sending" },
    }))
    window.setTimeout(() => {
      setInviteStates((current) => ({
        ...current,
        [rider.name]: { status: "sent", sentAt: formatSentAt() },
      }))
    }, inviteDelayMs)
  }

  return (
    <div data-testid="ride-playlist-tab" data-shuffle-seed={shuffleSeed}>
      <div className="mb-3 uppercase tracking-wide text-[length:var(--fc-font-ride-detail-section-size)] leading-[var(--fc-font-ride-detail-section-line)] font-[number:var(--fc-font-ride-detail-section-weight)] text-[var(--fc-text-secondary)]">
        Who&apos;s in the car
      </div>
      <div className="mb-[var(--fc-space-ride-detail-rider-mb)] grid grid-cols-1 gap-3 sm:grid-cols-2">
        {riders.map((rider) => (
          <RiderTile
            key={rider.name}
            rider={rider}
            inviteState={inviteStates[rider.name]}
            onInvite={handleInvite}
          />
        ))}
      </div>

      <div
        data-testid="ride-playlist-hero"
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
            Merged from {connectedCount} playlist{connectedCount !== 1 ? "s" : ""}
          </span>
        </div>
        <div className="mb-1 flex items-baseline gap-2">
          <div
            data-testid="ride-playlist-queued-min"
            className="text-[length:var(--fc-font-ride-detail-queued-min-size)] leading-[var(--fc-font-ride-detail-queued-min-line)] font-[number:var(--fc-font-ride-detail-queued-min-weight)]"
          >
            {queuedMinutesLabel} min
          </div>
          <div className="text-[length:var(--fc-font-ride-detail-hero-copy-size)] leading-[var(--fc-font-ride-detail-hero-copy-line)] font-[number:var(--fc-font-ride-detail-hero-copy-weight)] text-[var(--fc-hero-on-secondary)]">
            of music queued
          </div>
        </div>
        <div
          data-testid="ride-playlist-coverage"
          className="text-[length:var(--fc-font-ride-detail-hero-copy-size)] leading-[var(--fc-font-ride-detail-hero-copy-line)] font-[number:var(--fc-font-ride-detail-hero-copy-weight)]"
          style={{
            color: coversDrive ? "var(--fc-hero-success)" : "var(--fc-hero-ring)",
          }}
        >
          {coversDrive
            ? `Covers the ~${driveMinutes} min drive with room to spare`
            : `Drive is ~${driveMinutes} min — add more songs to fill it`}
        </div>
        {!allConnected ? (
          <div className="mt-1 text-[length:var(--fc-font-ride-detail-notify-size)] leading-[var(--fc-font-ride-detail-notify-line)] text-[var(--fc-hero-on-secondary)]">
            Only counting riders who&apos;ve connected so far —{" "}
            {disconnectedNames.join(", ")} isn&apos;t included yet
          </div>
        ) : null}
        <div className="mt-[var(--fc-space-ride-detail-cta-mt)] flex flex-wrap gap-3">
          <a
            href={SPOTIFY_DEMO_PLAYLIST_URL}
            target="_blank"
            rel="noreferrer"
            data-testid="ride-playlist-spotify"
            className="inline-flex items-center gap-2 rounded-[var(--fc-radius-xl)] px-[var(--fc-space-ride-detail-cta-pad-x)] py-[var(--fc-space-ride-detail-cta-pad-y)] text-[length:var(--fc-font-ride-detail-cta-size)] leading-[var(--fc-font-ride-detail-cta-line)] font-[number:var(--fc-font-ride-detail-cta-weight)]"
            style={{ background: "var(--fc-hero-on)", color: "var(--fc-hero-on-inverse)" }}
          >
            <Play aria-hidden size={16} /> Open in Spotify
          </a>
          <button
            type="button"
            data-testid="ride-playlist-remix"
            onClick={onRemix}
            className="inline-flex items-center gap-2 rounded-[var(--fc-radius-xl)] px-[var(--fc-space-ride-detail-cta-pad-x)] py-[var(--fc-space-ride-detail-cta-pad-y)] text-[length:var(--fc-font-ride-detail-cta-size)] leading-[var(--fc-font-ride-detail-cta-line)] font-[number:var(--fc-font-ride-detail-cta-weight)] text-[var(--fc-hero-on)]"
            style={{ background: "var(--fc-hero-decline-bg)" }}
          >
            <Shuffle aria-hidden size={16} /> Remix merge order
          </button>
        </div>
      </div>

      <div
        data-testid="ride-playlist-premium-caveat"
        className="mb-[var(--fc-space-ride-detail-block-mb)] rounded-[var(--fc-radius-xl)] border border-dashed border-[var(--fc-border)] bg-[var(--fc-hero-carousel-control-bg)] p-[var(--fc-space-ride-detail-caveat-pad)]"
      >
        <div className="flex items-start gap-3">
          <Info
            aria-hidden
            size={17}
            className="mt-0.5 shrink-0 text-[var(--fc-text-secondary)]"
          />
          <div className="text-[length:var(--fc-font-ride-detail-hero-copy-size)] leading-[var(--fc-font-ride-detail-hero-copy-line)] font-[number:var(--fc-font-ride-detail-hero-copy-weight)] text-[var(--fc-text-secondary)]">
            <span className="font-[number:var(--fc-font-ride-detail-stop-meta-weight)] text-[var(--fc-text-primary)]">
              This builds the playlist automatically, but doesn&apos;t press play for you.{" "}
            </span>
            Spotify&apos;s free-tier API can create and merge playlists for any account. Remotely
            starting playback on the car&apos;s speakers needs Spotify Connect, which requires the
            driver to have Premium. To stay free for everyone, &quot;Open in Spotify&quot; hands
            the merged queue to the driver&apos;s phone — they tap play like normal.
          </div>
        </div>
      </div>

      <div className="mb-2 flex items-center gap-1.5 uppercase tracking-wide text-[length:var(--fc-font-ride-detail-section-size)] leading-[var(--fc-font-ride-detail-section-line)] font-[number:var(--fc-font-ride-detail-section-weight)] text-[var(--fc-text-secondary)]">
        <Music aria-hidden size={13} /> Merge order
      </div>
      <div
        data-testid="ride-playlist-tracks"
        className="rounded-[var(--fc-radius-xl)] border border-[var(--fc-border)] bg-[var(--fc-surface-raised)] p-4"
      >
        {merged.map((track, index) => (
          <TrackRow key={`${track.title}-${track.from}-${index}`} track={track} />
        ))}
      </div>
    </div>
  )
}
