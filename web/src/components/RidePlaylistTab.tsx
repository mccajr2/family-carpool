import { useEffect, useMemo, useState } from "react"
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

import type { PlaylistClient } from "@/api/playlistClient"
import type { SpotifyPlaylistOption } from "@/api/types"
import type {
  FixturePlaylistRider,
  RideNotifyContact,
} from "@/components/rideDetailFixtures"
import type { RideNotifyState } from "@/components/RideRouteTab"
import {
  fmtMinSec,
  mergeTracks,
  type MergedTrack,
} from "@/components/rideScheduleUtils"
import { saveSpotifyOAuthReturn } from "@/components/spotifyOAuthReturn"

/** Demo Spotify URL from the mockup — not a live playlist (Open handoff is next task). */
export const SPOTIFY_DEMO_PLAYLIST_URL =
  "https://open.spotify.com/playlist/carpool-demo"

export type RidePlaylistTabProps = {
  riders: FixturePlaylistRider[]
  /**
   * Sum of live Route legMinutes when status is OK. When null/undefined, omit
   * the precise “~N min drive” number (qualitative copy only).
   */
  driveMinutes?: number | null
  shuffleSeed: number
  onRemix: () => void
  /** Invite delay ms — default matches mockup; override in tests. */
  inviteDelayMs?: number
  /** Live connect/designate — omit in fixture-only smoke tests. */
  playlistClient?: PlaylistClient
  accessToken?: string | null
  /**
   * Calendar item key for the open ride detail — stored across Spotify OAuth
   * redirect so designate can resume.
   */
  rideDetailItemKey?: string | null
  /** After a successful designation, parent should reload playlist riders. */
  onPlaylistChanged?: () => void
  /**
   * Kid id to open the designate picker for on mount (OAuth return). Cleared
   * via onConsumePendingDesignate.
   */
  pendingDesignateKidId?: string | null
  onConsumePendingDesignate?: () => void
  /** Override window.location.assign in tests. */
  assignLocation?: (url: string) => void
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

function DesignatePicker({
  rider,
  options,
  loading,
  error,
  saving,
  selectedId,
  onSelectId,
  onSave,
  onCancel,
}: {
  rider: FixturePlaylistRider
  options: SpotifyPlaylistOption[]
  loading: boolean
  error: string | null
  saving: boolean
  selectedId: string
  onSelectId: (id: string) => void
  onSave: () => void
  onCancel: () => void
}) {
  return (
    <div
      data-testid={`ride-playlist-designate-${rider.name}`}
      className="mt-2 space-y-2"
    >
      {loading ? (
        <div
          data-testid={`ride-playlist-designate-loading-${rider.name}`}
          className="inline-flex items-center gap-1.5 text-[length:var(--fc-font-ride-detail-notify-size)] leading-[var(--fc-font-ride-detail-notify-line)] text-[var(--fc-text-secondary)]"
        >
          <Loader2 aria-hidden size={12} className="animate-spin" /> Loading playlists…
        </div>
      ) : (
        <>
          <label className="block">
            <span className="sr-only">Choose a Spotify playlist for {rider.name}</span>
            <select
              data-testid={`ride-playlist-designate-select-${rider.name}`}
              value={selectedId}
              disabled={saving || options.length === 0}
              onChange={(event) => onSelectId(event.target.value)}
              className="w-full rounded-[var(--fc-radius-lg)] border border-[var(--fc-border)] bg-[var(--fc-surface)] px-2 py-1.5 text-[length:var(--fc-font-ride-detail-notify-size)] leading-[var(--fc-font-ride-detail-notify-line)] text-[var(--fc-text-primary)]"
            >
              {options.length === 0 ? (
                <option value="">No playlists found</option>
              ) : (
                options.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.name} ({option.trackCount} songs)
                  </option>
                ))
              )}
            </select>
          </label>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              data-testid={`ride-playlist-designate-save-${rider.name}`}
              disabled={saving || !selectedId}
              onClick={onSave}
              className="inline-flex items-center gap-1.5 rounded-[var(--fc-radius-lg)] bg-[var(--fc-accent)] px-[var(--fc-space-ride-detail-notify-pad-x)] py-[var(--fc-space-ride-detail-notify-pad-y)] text-[length:var(--fc-font-ride-detail-notify-size)] leading-[var(--fc-font-ride-detail-notify-line)] font-[number:var(--fc-font-ride-detail-notify-weight)] text-[var(--fc-accent-on)] disabled:opacity-50"
            >
              {saving ? (
                <>
                  <Loader2 aria-hidden size={12} className="animate-spin" /> Saving…
                </>
              ) : (
                "Use this playlist"
              )}
            </button>
            <button
              type="button"
              data-testid={`ride-playlist-designate-cancel-${rider.name}`}
              disabled={saving}
              onClick={onCancel}
              className="text-[length:var(--fc-font-ride-detail-notify-size)] leading-[var(--fc-font-ride-detail-notify-line)] text-[var(--fc-text-secondary)] underline underline-offset-2"
            >
              Cancel
            </button>
          </div>
        </>
      )}
      {error != null ? (
        <div
          data-testid={`ride-playlist-designate-error-${rider.name}`}
          role="alert"
          className="text-[length:var(--fc-font-ride-detail-notify-size)] leading-[var(--fc-font-ride-detail-notify-line)] text-[var(--fc-danger)]"
        >
          {error}
        </div>
      ) : null}
    </div>
  )
}

function ManagePlaylistAction({
  rider,
  spotifyConnected,
  statusLoading,
  connecting,
  designating,
  options,
  optionsLoading,
  designateError,
  designateSaving,
  selectedPlaylistId,
  onConnect,
  onOpenDesignate,
  onCancelDesignate,
  onSelectPlaylistId,
  onSaveDesignate,
}: {
  rider: FixturePlaylistRider
  spotifyConnected: boolean | null
  statusLoading: boolean
  connecting: boolean
  designating: boolean
  options: SpotifyPlaylistOption[]
  optionsLoading: boolean
  designateError: string | null
  designateSaving: boolean
  selectedPlaylistId: string
  onConnect: () => void
  onOpenDesignate: () => void
  onCancelDesignate: () => void
  onSelectPlaylistId: (id: string) => void
  onSaveDesignate: () => void
}) {
  if (designating) {
    return (
      <DesignatePicker
        rider={rider}
        options={options}
        loading={optionsLoading}
        error={designateError}
        saving={designateSaving}
        selectedId={selectedPlaylistId}
        onSelectId={onSelectPlaylistId}
        onSave={onSaveDesignate}
        onCancel={onCancelDesignate}
      />
    )
  }

  if (statusLoading || spotifyConnected == null) {
    return (
      <div
        data-testid={`ride-playlist-manage-loading-${rider.name}`}
        className="mt-2 inline-flex items-center gap-1.5 text-[length:var(--fc-font-ride-detail-notify-size)] leading-[var(--fc-font-ride-detail-notify-line)] text-[var(--fc-text-secondary)]"
      >
        <Loader2 aria-hidden size={12} className="animate-spin" /> Checking Spotify…
      </div>
    )
  }

  if (!spotifyConnected) {
    return (
      <button
        type="button"
        data-testid={`ride-playlist-connect-${rider.name}`}
        disabled={connecting}
        onClick={onConnect}
        className="mt-2 inline-flex items-center gap-1.5 rounded-[var(--fc-radius-lg)] bg-[var(--fc-hero-carousel-control-bg)] px-[var(--fc-space-ride-detail-notify-pad-x)] py-[var(--fc-space-ride-detail-notify-pad-y)] text-[length:var(--fc-font-ride-detail-notify-size)] leading-[var(--fc-font-ride-detail-notify-line)] font-[number:var(--fc-font-ride-detail-notify-weight)] text-[var(--fc-text-primary)] disabled:opacity-50"
      >
        {connecting ? (
          <>
            <Loader2 aria-hidden size={12} className="animate-spin" /> Connecting…
          </>
        ) : (
          <>
            <Music aria-hidden size={12} /> Connect Spotify
          </>
        )}
      </button>
    )
  }

  return (
    <button
      type="button"
      data-testid={
        rider.connected
          ? `ride-playlist-change-${rider.name}`
          : `ride-playlist-choose-${rider.name}`
      }
      onClick={onOpenDesignate}
      className="mt-2 inline-flex items-center gap-1.5 rounded-[var(--fc-radius-lg)] bg-[var(--fc-hero-carousel-control-bg)] px-[var(--fc-space-ride-detail-notify-pad-x)] py-[var(--fc-space-ride-detail-notify-pad-y)] text-[length:var(--fc-font-ride-detail-notify-size)] leading-[var(--fc-font-ride-detail-notify-line)] font-[number:var(--fc-font-ride-detail-notify-weight)] text-[var(--fc-text-primary)]"
    >
      <Music aria-hidden size={12} />{" "}
      {rider.connected ? "Change playlist" : "Choose a playlist"}
    </button>
  )
}

function RiderTile({
  rider,
  inviteState,
  onInvite,
  canManage,
  spotifyConnected,
  statusLoading,
  connecting,
  designating,
  options,
  optionsLoading,
  designateError,
  designateSaving,
  selectedPlaylistId,
  onConnect,
  onOpenDesignate,
  onCancelDesignate,
  onSelectPlaylistId,
  onSaveDesignate,
}: {
  rider: FixturePlaylistRider
  inviteState: RideNotifyState | undefined
  onInvite: (rider: FixturePlaylistRider) => void
  canManage: boolean
  spotifyConnected: boolean | null
  statusLoading: boolean
  connecting: boolean
  designating: boolean
  options: SpotifyPlaylistOption[]
  optionsLoading: boolean
  designateError: string | null
  designateSaving: boolean
  selectedPlaylistId: string
  onConnect: () => void
  onOpenDesignate: () => void
  onCancelDesignate: () => void
  onSelectPlaylistId: (id: string) => void
  onSaveDesignate: () => void
}) {
  if (!rider.connected) {
    return (
      <div
        data-testid={`ride-playlist-rider-${rider.name}`}
        data-connected="false"
        data-viewer-can-manage={canManage ? "true" : "false"}
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
        {canManage ? (
          <ManagePlaylistAction
            rider={rider}
            spotifyConnected={spotifyConnected}
            statusLoading={statusLoading}
            connecting={connecting}
            designating={designating}
            options={options}
            optionsLoading={optionsLoading}
            designateError={designateError}
            designateSaving={designateSaving}
            selectedPlaylistId={selectedPlaylistId}
            onConnect={onConnect}
            onOpenDesignate={onOpenDesignate}
            onCancelDesignate={onCancelDesignate}
            onSelectPlaylistId={onSelectPlaylistId}
            onSaveDesignate={onSaveDesignate}
          />
        ) : rider.contact != null ? (
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
      data-viewer-can-manage={canManage ? "true" : "false"}
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
            {rider.playlistName ?? "Playlist"} · {rider.tracks.length} songs ·{" "}
            {fmtMinSec(totalSec)}
          </div>
        </div>
      </div>
      {canManage ? (
        <ManagePlaylistAction
          rider={rider}
          spotifyConnected={spotifyConnected}
          statusLoading={statusLoading}
          connecting={connecting}
          designating={designating}
          options={options}
          optionsLoading={optionsLoading}
          designateError={designateError}
          designateSaving={designateSaving}
          selectedPlaylistId={selectedPlaylistId}
          onConnect={onConnect}
          onOpenDesignate={onOpenDesignate}
          onCancelDesignate={onCancelDesignate}
          onSelectPlaylistId={onSelectPlaylistId}
          onSaveDesignate={onSaveDesignate}
        />
      ) : null}
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
 * Connect / designate for viewer-managed kid tiles when playlistClient is provided.
 */
export function RidePlaylistTab({
  riders,
  driveMinutes = null,
  shuffleSeed,
  onRemix,
  inviteDelayMs = 700,
  playlistClient,
  accessToken = null,
  rideDetailItemKey = null,
  onPlaylistChanged,
  pendingDesignateKidId = null,
  onConsumePendingDesignate,
  assignLocation = (url) => {
    window.location.assign(url)
  },
}: RidePlaylistTabProps) {
  const [inviteStates, setInviteStates] = useState<Record<string, RideNotifyState>>({})
  const [spotifyConnected, setSpotifyConnected] = useState<boolean | null>(
    playlistClient == null || accessToken == null ? false : null,
  )
  const [statusLoading, setStatusLoading] = useState(
    playlistClient != null && accessToken != null,
  )
  const [statusError, setStatusError] = useState<string | null>(null)
  const [connectingKidId, setConnectingKidId] = useState<string | null>(null)
  const [designatingKidId, setDesignatingKidId] = useState<string | null>(null)
  const [playlistOptions, setPlaylistOptions] = useState<SpotifyPlaylistOption[]>([])
  const [optionsLoading, setOptionsLoading] = useState(false)
  const [designateError, setDesignateError] = useState<string | null>(null)
  const [designateSaving, setDesignateSaving] = useState(false)
  const [selectedPlaylistId, setSelectedPlaylistId] = useState("")

  const manageEnabled = playlistClient != null && accessToken != null

  useEffect(() => {
    if (!manageEnabled || playlistClient == null || accessToken == null) {
      setSpotifyConnected(false)
      setStatusLoading(false)
      return
    }
    let cancelled = false
    setStatusLoading(true)
    setStatusError(null)
    void playlistClient
      .getSpotifyStatus(accessToken)
      .then((status) => {
        if (cancelled) {
          return
        }
        setSpotifyConnected(status.connected)
        setStatusLoading(false)
      })
      .catch((error: unknown) => {
        if (cancelled) {
          return
        }
        setSpotifyConnected(false)
        setStatusLoading(false)
        setStatusError(
          error instanceof Error ? error.message : "Could not check Spotify connection",
        )
      })
    return () => {
      cancelled = true
    }
  }, [manageEnabled, playlistClient, accessToken])

  useEffect(() => {
    if (
      pendingDesignateKidId == null ||
      !manageEnabled ||
      spotifyConnected !== true
    ) {
      return
    }
    setDesignatingKidId(pendingDesignateKidId)
    onConsumePendingDesignate?.()
  }, [
    pendingDesignateKidId,
    manageEnabled,
    spotifyConnected,
    onConsumePendingDesignate,
  ])

  useEffect(() => {
    if (
      designatingKidId == null ||
      !manageEnabled ||
      playlistClient == null ||
      accessToken == null ||
      spotifyConnected !== true
    ) {
      return
    }
    let cancelled = false
    setOptionsLoading(true)
    setDesignateError(null)
    void playlistClient
      .listSpotifyPlaylists(accessToken)
      .then((options) => {
        if (cancelled) {
          return
        }
        setPlaylistOptions(options)
        setSelectedPlaylistId(options[0]?.id ?? "")
        setOptionsLoading(false)
      })
      .catch((error: unknown) => {
        if (cancelled) {
          return
        }
        setPlaylistOptions([])
        setSelectedPlaylistId("")
        setOptionsLoading(false)
        setDesignateError(
          error instanceof Error ? error.message : "Could not load Spotify playlists",
        )
      })
    return () => {
      cancelled = true
    }
  }, [designatingKidId, manageEnabled, playlistClient, accessToken, spotifyConnected])

  const merged = useMemo(() => {
    return remixMergedTracks(mergeTracks(riders), shuffleSeed)
  }, [riders, shuffleSeed])

  const totalSec = merged.reduce((n, track) => n + track.sec, 0)
  const driveSec = driveMinutes != null ? driveMinutes * 60 : null
  const coversDrive = driveSec != null ? totalSec >= driveSec : false
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

  async function handleConnect(rider: FixturePlaylistRider) {
    if (playlistClient == null || accessToken == null || rider.kidId == null) {
      return
    }
    setConnectingKidId(rider.kidId)
    setStatusError(null)
    try {
      const { authorizeUrl } = await playlistClient.getSpotifyAuthorize(accessToken)
      if (rideDetailItemKey != null) {
        saveSpotifyOAuthReturn({
          rideDetailItemKey,
          designateKidId: rider.kidId,
        })
      }
      assignLocation(authorizeUrl)
    } catch (error: unknown) {
      setConnectingKidId(null)
      setStatusError(
        error instanceof Error ? error.message : "Could not start Spotify connect",
      )
    }
  }

  async function handleSaveDesignate(rider: FixturePlaylistRider) {
    if (
      playlistClient == null ||
      accessToken == null ||
      rider.kidId == null ||
      !selectedPlaylistId
    ) {
      return
    }
    setDesignateSaving(true)
    setDesignateError(null)
    try {
      await playlistClient.setKidPlaylistDesignation(accessToken, rider.kidId, {
        spotifyPlaylistId: selectedPlaylistId,
      })
      setDesignatingKidId(null)
      setDesignateSaving(false)
      onPlaylistChanged?.()
    } catch (error: unknown) {
      setDesignateSaving(false)
      setDesignateError(
        error instanceof Error ? error.message : "Could not save playlist designation",
      )
    }
  }

  const coverageCopy =
    driveMinutes == null
      ? connectedCount > 0
        ? "Music queued for the drive"
        : "Connect a playlist to cover the drive"
      : coversDrive
        ? `Covers the ~${driveMinutes} min drive with room to spare`
        : `Drive is ~${driveMinutes} min — add more songs to fill it`

  return (
    <div data-testid="ride-playlist-tab" data-shuffle-seed={shuffleSeed}>
      {statusError != null ? (
        <div
          data-testid="ride-playlist-spotify-status-error"
          role="alert"
          className="mb-3 text-[length:var(--fc-font-ride-detail-notify-size)] leading-[var(--fc-font-ride-detail-notify-line)] text-[var(--fc-danger)]"
        >
          {statusError}
        </div>
      ) : null}
      <div className="mb-3 uppercase tracking-wide text-[length:var(--fc-font-ride-detail-section-size)] leading-[var(--fc-font-ride-detail-section-line)] font-[number:var(--fc-font-ride-detail-section-weight)] text-[var(--fc-text-secondary)]">
        Who&apos;s in the car
      </div>
      <div className="mb-[var(--fc-space-ride-detail-rider-mb)] grid grid-cols-1 gap-3 sm:grid-cols-2">
        {riders.map((rider) => {
          const canManage =
            manageEnabled && rider.viewerCanManage === true && rider.kidId != null
          const kidId = rider.kidId ?? null
          return (
            <RiderTile
              key={kidId ?? rider.name}
              rider={rider}
              inviteState={inviteStates[rider.name]}
              onInvite={handleInvite}
              canManage={canManage}
              spotifyConnected={spotifyConnected}
              statusLoading={statusLoading}
              connecting={connectingKidId != null && connectingKidId === kidId}
              designating={designatingKidId != null && designatingKidId === kidId}
              options={playlistOptions}
              optionsLoading={optionsLoading}
              designateError={
                designatingKidId != null && designatingKidId === kidId
                  ? designateError
                  : null
              }
              designateSaving={
                designatingKidId != null &&
                designatingKidId === kidId &&
                designateSaving
              }
              selectedPlaylistId={selectedPlaylistId}
              onConnect={() => void handleConnect(rider)}
              onOpenDesignate={() => {
                if (kidId != null) {
                  setDesignatingKidId(kidId)
                  setDesignateError(null)
                }
              }}
              onCancelDesignate={() => {
                setDesignatingKidId(null)
                setDesignateError(null)
              }}
              onSelectPlaylistId={setSelectedPlaylistId}
              onSaveDesignate={() => void handleSaveDesignate(rider)}
            />
          )
        })}
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
            color:
              driveMinutes != null && coversDrive
                ? "var(--fc-hero-success)"
                : "var(--fc-hero-ring)",
          }}
        >
          {coverageCopy}
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
