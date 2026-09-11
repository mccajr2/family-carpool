/**
 * Parked Spotify Playlist UI chrome (Carpool music parking lot).
 * Excluded from default `npm test`; run via `npm run test:parked`.
 * Pure remix helpers live in `RidePlaylistTab.remix.test.ts`.
 */
import { act, render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import type { PlaylistClient } from "@/api/playlistClient"
import { GAME_CARPOOL_ROUTE_FIXTURE } from "@/components/rideDetailFixtures"
import type { FixturePlaylistRider } from "@/components/rideDetailFixtures"
import {
  RidePlaylistTab,
  SPOTIFY_DEMO_PLAYLIST_URL,
  remixMergedTracks,
  remixedTrackUris,
} from "@/components/RidePlaylistTab"
import { fmtMinSec, mergeTracks } from "@/components/rideScheduleUtils"
import { SPOTIFY_OAUTH_RETURN_KEY } from "@/components/spotifyOAuthReturn"

const TWO_CONNECTED_RIDERS: FixturePlaylistRider[] = [
  {
    kidId: "k-declan",
    name: "Declan",
    connected: true,
    playlistName: "Declan's Warmup Mix",
    tracks: [
      { title: "Sunset Drive", artist: "Coastline", sec: 198, uri: "spotify:track:d1" },
      { title: "Overtime", artist: "Pace Car", sec: 176, uri: "spotify:track:d2" },
    ],
  },
  {
    kidId: "k-kwame",
    name: "Kwame",
    connected: true,
    playlistName: "Kwame picks",
    tracks: [
      { title: "Neon Static", artist: "Halfway House", sec: 221, uri: "spotify:track:k1" },
      { title: "Rink Lights", artist: "Coastline", sec: 204, uri: "spotify:track:k2" },
    ],
  },
]

describe("RidePlaylistTab", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    sessionStorage.clear()
  })

  afterEach(() => {
    vi.useRealTimers()
    sessionStorage.clear()
  })

  it("renders riders and merged tracks; hides Remix when only one playlist is connected", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    const onRemix = vi.fn()
    const openExternalUrl = vi.fn()
    const fair = mergeTracks(GAME_CARPOOL_ROUTE_FIXTURE.playlistRiders)
    const totalSec = fair.reduce((n, t) => n + t.sec, 0)

    render(
      <RidePlaylistTab
        riders={GAME_CARPOOL_ROUTE_FIXTURE.playlistRiders}
        driveMinutes={GAME_CARPOOL_ROUTE_FIXTURE.legMinutes.reduce((a, b) => a + b, 0)}
        shuffleSeed={0}
        onRemix={onRemix}
        openExternalUrl={openExternalUrl}
      />,
    )

    expect(screen.getByTestId("ride-playlist-tab")).toHaveAttribute(
      "data-shuffle-seed",
      "0",
    )
    expect(screen.getByTestId("ride-playlist-rider-Declan")).toHaveAttribute(
      "data-connected",
      "true",
    )
    expect(screen.getByTestId("ride-playlist-rider-Kwame")).toHaveAttribute(
      "data-connected",
      "false",
    )
    expect(screen.getByTestId("ride-playlist-queued-min")).toHaveTextContent(
      `${fmtMinSec(totalSec).split(":")[0]} min`,
    )
    expect(screen.getByTestId("ride-playlist-coverage")).toHaveTextContent(
      /Drive is ~30 min — add more songs to fill it/,
    )
    expect(screen.getByTestId("ride-playlist-spotify")).toHaveAttribute(
      "data-open-enabled",
      "true",
    )
    expect(screen.queryByTestId("ride-playlist-remix")).not.toBeInTheDocument()
    expect(screen.getByTestId("ride-playlist-premium-caveat")).toBeInTheDocument()

    const tracks = screen.getByTestId("ride-playlist-tracks")
    expect(within(tracks).getByTestId("ride-playlist-track-Sunset Drive")).toBeInTheDocument()
    expect(within(tracks).getAllByTestId(/ride-playlist-track-/)).toHaveLength(fair.length)

    await user.click(screen.getByTestId("ride-playlist-spotify"))
    expect(openExternalUrl).toHaveBeenCalledWith(SPOTIFY_DEMO_PLAYLIST_URL)
  })

  it("shows Remix for 2+ connected and Open passes remixed track URIs", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    const onRemix = vi.fn()
    const openExternalUrl = vi.fn()
    const onOpenInSpotify = vi.fn().mockResolvedValue({
      url: "https://open.spotify.com/playlist/merge-1",
    })
    const fair = mergeTracks(TWO_CONNECTED_RIDERS)

    const { rerender } = render(
      <RidePlaylistTab
        riders={TWO_CONNECTED_RIDERS}
        driveMinutes={30}
        shuffleSeed={0}
        onRemix={onRemix}
        onOpenInSpotify={onOpenInSpotify}
        openExternalUrl={openExternalUrl}
      />,
    )

    expect(screen.getByTestId("ride-playlist-remix")).toBeInTheDocument()
    await user.click(screen.getByTestId("ride-playlist-remix"))
    expect(onRemix).toHaveBeenCalledTimes(1)

    const remixed = remixMergedTracks(fair, 1)
    rerender(
      <RidePlaylistTab
        riders={TWO_CONNECTED_RIDERS}
        driveMinutes={30}
        shuffleSeed={1}
        onRemix={onRemix}
        onOpenInSpotify={onOpenInSpotify}
        openExternalUrl={openExternalUrl}
      />,
    )
    expect(screen.getByTestId("ride-playlist-tab")).toHaveAttribute(
      "data-shuffle-seed",
      "1",
    )
    const remixedRows = within(screen.getByTestId("ride-playlist-tracks")).getAllByTestId(
      /ride-playlist-track-/,
    )
    expect(remixedRows.map((row) => row.getAttribute("data-testid"))).toEqual(
      remixed.map((track) => `ride-playlist-track-${track.title}`),
    )

    await user.click(screen.getByTestId("ride-playlist-spotify"))
    expect(onOpenInSpotify).toHaveBeenCalledWith({
      trackUris: remixedTrackUris(remixed),
    })
    expect(openExternalUrl).toHaveBeenCalledWith(
      "https://open.spotify.com/playlist/merge-1",
    )
  })

  it("opens a single connected playlist without trackUris and disables Open when none connected", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    const openExternalUrl = vi.fn()
    const onOpenInSpotify = vi.fn().mockResolvedValue({
      url: "https://open.spotify.com/playlist/sam",
    })

    const { rerender } = render(
      <RidePlaylistTab
        riders={[
          {
            kidId: "k1",
            name: "Sam",
            connected: true,
            playlistName: "Sam gameday",
            tracks: [
              { title: "A", artist: "B", sec: 100, uri: "spotify:track:a1" },
            ],
          },
        ]}
        driveMinutes={null}
        shuffleSeed={0}
        onRemix={vi.fn()}
        onOpenInSpotify={onOpenInSpotify}
        openExternalUrl={openExternalUrl}
      />,
    )

    expect(screen.queryByTestId("ride-playlist-remix")).not.toBeInTheDocument()
    await user.click(screen.getByTestId("ride-playlist-spotify"))
    expect(onOpenInSpotify).toHaveBeenCalledWith(null)
    expect(openExternalUrl).toHaveBeenCalledWith("https://open.spotify.com/playlist/sam")

    rerender(
      <RidePlaylistTab
        riders={[
          {
            kidId: "k2",
            name: "Kwame",
            connected: false,
            tracks: [],
            contact: { channel: "push", to: "the Oseis" },
          },
        ]}
        driveMinutes={null}
        shuffleSeed={0}
        onRemix={vi.fn()}
        onOpenInSpotify={onOpenInSpotify}
        openExternalUrl={openExternalUrl}
      />,
    )
    expect(screen.getByTestId("ride-playlist-spotify")).toBeDisabled()
    expect(screen.getByTestId("ride-playlist-spotify")).toHaveAttribute(
      "data-open-enabled",
      "false",
    )
  })

  it("updates invite UI via soft-succeed invite call site", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    const deliverInvite = vi.fn().mockResolvedValue({ ok: true })
    render(
      <RidePlaylistTab
        riders={GAME_CARPOOL_ROUTE_FIXTURE.playlistRiders}
        driveMinutes={GAME_CARPOOL_ROUTE_FIXTURE.legMinutes.reduce((a, b) => a + b, 0)}
        shuffleSeed={0}
        onRemix={vi.fn()}
        inviteDelayMs={700}
        deliverInvite={deliverInvite}
      />,
    )

    const invite = screen.getByTestId("ride-playlist-invite-Kwame")
    expect(invite).toHaveAttribute("data-invite-status", "idle")
    await user.click(invite)

    expect(deliverInvite).toHaveBeenCalledWith({
      channel: "push",
      to: "the Oseis",
      kidName: "Kwame",
    })
    expect(screen.getByTestId("ride-playlist-invite-Kwame")).toHaveAttribute(
      "data-invite-status",
      "sending",
    )

    await act(async () => {
      vi.advanceTimersByTime(700)
    })

    const sent = screen.getByTestId("ride-playlist-invite-Kwame")
    expect(sent).toHaveAttribute("data-invite-status", "sent")
    expect(sent).toHaveTextContent(/Invite sent via push notification/)
  })

  it("uses qualitative coverage copy when drive minutes are unknown", () => {
    render(
      <RidePlaylistTab
        riders={GAME_CARPOOL_ROUTE_FIXTURE.playlistRiders}
        driveMinutes={null}
        shuffleSeed={0}
        onRemix={vi.fn()}
      />,
    )
    expect(screen.getByTestId("ride-playlist-coverage")).toHaveTextContent(
      "Music queued for the drive",
    )
  })

  it("connects Spotify and designates a playlist for a circle kid tile", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    const assignLocation = vi.fn()
    const onPlaylistChanged = vi.fn()
    const onConsumePendingDesignate = vi.fn()

    const riders: FixturePlaylistRider[] = [
      {
        kidId: "k-sam",
        name: "Sam",
        connected: false,
        tracks: [],
        viewerCanManage: true,
      },
      {
        kidId: "k-kwame",
        name: "Kwame",
        connected: false,
        tracks: [],
        viewerCanManage: false,
        contact: { channel: "push", to: "the Oseis" },
      },
    ]

    const playlistClient = {
      getSpotifyStatus: vi.fn().mockResolvedValue({ connected: false }),
      getSpotifyAuthorize: vi
        .fn()
        .mockResolvedValue({ authorizeUrl: "https://accounts.spotify.com/authorize?x=1", state: "s" }),
      listSpotifyPlaylists: vi.fn().mockResolvedValue([
        {
          id: "pl1",
          name: "Sam gameday",
          url: "https://open.spotify.com/playlist/pl1",
          trackCount: 4,
        },
        {
          id: "pl2",
          name: "Warmup",
          url: "https://open.spotify.com/playlist/pl2",
          trackCount: 2,
        },
      ]),
      setKidPlaylistDesignation: vi.fn().mockResolvedValue({
        kidId: "k-sam",
        kidDisplayName: "Sam",
        spotifyPlaylistId: "pl2",
        playlistName: "Warmup",
        playlistUrl: "https://open.spotify.com/playlist/pl2",
        trackCount: 2,
      }),
    } as unknown as PlaylistClient

    const { rerender } = render(
      <RidePlaylistTab
        riders={riders}
        driveMinutes={null}
        shuffleSeed={0}
        onRemix={vi.fn()}
        playlistClient={playlistClient}
        accessToken="tok"
        rideDetailItemKey="MANUAL:e1"
        assignLocation={assignLocation}
        onPlaylistChanged={onPlaylistChanged}
      />,
    )

    expect(screen.getByTestId("ride-playlist-rider-Sam")).toHaveAttribute(
      "data-viewer-can-manage",
      "true",
    )
    expect(screen.getByTestId("ride-playlist-invite-Kwame")).toBeInTheDocument()
    expect(screen.queryByTestId("ride-playlist-connect-Kwame")).not.toBeInTheDocument()

    expect(await screen.findByTestId("ride-playlist-connect-Sam")).toBeInTheDocument()
    await user.click(screen.getByTestId("ride-playlist-connect-Sam"))
    expect(playlistClient.getSpotifyAuthorize).toHaveBeenCalledWith("tok")
    expect(assignLocation).toHaveBeenCalledWith(
      "https://accounts.spotify.com/authorize?x=1",
    )
    expect(JSON.parse(sessionStorage.getItem(SPOTIFY_OAUTH_RETURN_KEY)!)).toEqual({
      rideDetailItemKey: "MANUAL:e1",
      designateKidId: "k-sam",
    })

    const connectedClient = {
      getSpotifyStatus: vi.fn().mockResolvedValue({
        connected: true,
        spotifyUserId: "u1",
      }),
      listSpotifyPlaylists: playlistClient.listSpotifyPlaylists,
      setKidPlaylistDesignation: playlistClient.setKidPlaylistDesignation,
    } as unknown as PlaylistClient

    rerender(
      <RidePlaylistTab
        riders={riders}
        driveMinutes={null}
        shuffleSeed={0}
        onRemix={vi.fn()}
        playlistClient={connectedClient}
        accessToken="tok-after-oauth"
        rideDetailItemKey="MANUAL:e1"
        pendingDesignateKidId="k-sam"
        onConsumePendingDesignate={onConsumePendingDesignate}
        assignLocation={assignLocation}
        onPlaylistChanged={onPlaylistChanged}
      />,
    )

    expect(await screen.findByTestId("ride-playlist-designate-Sam")).toBeInTheDocument()
    expect(onConsumePendingDesignate).toHaveBeenCalled()
    expect(connectedClient.listSpotifyPlaylists).toHaveBeenCalledWith("tok-after-oauth")

    await user.selectOptions(
      screen.getByTestId("ride-playlist-designate-select-Sam"),
      "pl2",
    )
    await user.click(screen.getByTestId("ride-playlist-designate-save-Sam"))

    expect(connectedClient.setKidPlaylistDesignation).toHaveBeenCalledWith(
      "tok-after-oauth",
      "k-sam",
      { spotifyPlaylistId: "pl2" },
    )
    expect(onPlaylistChanged).toHaveBeenCalled()
  })

  it("shows Change playlist on a connected circle kid tile", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    const riders: FixturePlaylistRider[] = [
      {
        kidId: "k-sam",
        name: "Sam",
        connected: true,
        playlistName: "Sam gameday",
        tracks: [{ title: "A", artist: "B", sec: 100 }],
        viewerCanManage: true,
      },
    ]
    const playlistClient = {
      getSpotifyStatus: vi.fn().mockResolvedValue({ connected: true, spotifyUserId: "u1" }),
      listSpotifyPlaylists: vi.fn().mockResolvedValue([
        {
          id: "pl1",
          name: "Sam gameday",
          url: "https://open.spotify.com/playlist/pl1",
          trackCount: 1,
        },
      ]),
      setKidPlaylistDesignation: vi.fn(),
    } as unknown as PlaylistClient

    render(
      <RidePlaylistTab
        riders={riders}
        driveMinutes={null}
        shuffleSeed={0}
        onRemix={vi.fn()}
        playlistClient={playlistClient}
        accessToken="tok"
      />,
    )

    expect(await screen.findByTestId("ride-playlist-change-Sam")).toBeInTheDocument()
    await user.click(screen.getByTestId("ride-playlist-change-Sam"))
    expect(await screen.findByTestId("ride-playlist-designate-Sam")).toBeInTheDocument()
  })
})
