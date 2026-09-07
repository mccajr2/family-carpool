import { act, render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { GAME_CARPOOL_ROUTE_FIXTURE } from "@/components/rideDetailFixtures"
import {
  RidePlaylistTab,
  SPOTIFY_DEMO_PLAYLIST_URL,
  remixMergedTracks,
} from "@/components/RidePlaylistTab"
import { fmtMinSec, mergeTracks } from "@/components/rideScheduleUtils"

describe("remixMergedTracks", () => {
  it("leaves fair merge order alone at seed 0 and reshuffles for later seeds", () => {
    const base = mergeTracks(GAME_CARPOOL_ROUTE_FIXTURE.playlistRiders)
    expect(remixMergedTracks(base, 0)).toEqual(base)
    const remixed = remixMergedTracks(base, 1)
    expect(remixed).toHaveLength(base.length)
    expect(remixed.map((t) => t.title).sort()).toEqual(base.map((t) => t.title).sort())
    expect(remixed).not.toEqual(base)
  })
})

describe("RidePlaylistTab", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("renders riders, merged tracks, Spotify demo link, and remix control", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    const onRemix = vi.fn()
    const fair = mergeTracks(GAME_CARPOOL_ROUTE_FIXTURE.playlistRiders)
    const totalSec = fair.reduce((n, t) => n + t.sec, 0)

    const { rerender } = render(
      <RidePlaylistTab
        carpoolRoute={GAME_CARPOOL_ROUTE_FIXTURE}
        shuffleSeed={0}
        onRemix={onRemix}
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
      "href",
      SPOTIFY_DEMO_PLAYLIST_URL,
    )
    expect(screen.getByTestId("ride-playlist-premium-caveat")).toBeInTheDocument()

    const tracks = screen.getByTestId("ride-playlist-tracks")
    expect(within(tracks).getByTestId("ride-playlist-track-Sunset Drive")).toBeInTheDocument()
    expect(within(tracks).getAllByTestId(/ride-playlist-track-/)).toHaveLength(fair.length)

    await user.click(screen.getByTestId("ride-playlist-remix"))
    expect(onRemix).toHaveBeenCalledTimes(1)

    const remixed = remixMergedTracks(fair, 1)
    rerender(
      <RidePlaylistTab
        carpoolRoute={GAME_CARPOOL_ROUTE_FIXTURE}
        shuffleSeed={1}
        onRemix={onRemix}
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
  })

  it("updates invite UI locally without network calls", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    render(
      <RidePlaylistTab
        carpoolRoute={GAME_CARPOOL_ROUTE_FIXTURE}
        shuffleSeed={0}
        onRemix={vi.fn()}
        inviteDelayMs={700}
      />,
    )

    const invite = screen.getByTestId("ride-playlist-invite-Kwame")
    expect(invite).toHaveAttribute("data-invite-status", "idle")
    await user.click(invite)

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
})
