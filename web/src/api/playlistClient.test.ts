import { describe, expect, it, vi } from "vitest"

import { PlaylistClient } from "@/api/playlistClient"

describe("PlaylistClient", () => {
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    })

  it("authorizes, lists playlists, and manages designations", async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(
        json({
          authorizeUrl: "https://accounts.spotify.com/authorize?state=abc",
          state: "abc",
        }),
      )
      .mockResolvedValueOnce(json({ connected: true, spotifyUserId: "u1" }))
      .mockResolvedValueOnce(
        json([
          {
            id: "p1",
            name: "Sam gameday",
            url: "https://open.spotify.com/playlist/p1",
            trackCount: 12,
          },
        ]),
      )
      .mockResolvedValueOnce(json([]))
      .mockResolvedValueOnce(
        json({
          kidId: "k1",
          kidDisplayName: "Sam",
          spotifyPlaylistId: "p1",
          playlistName: "Sam gameday",
          playlistUrl: "https://open.spotify.com/playlist/p1",
          trackCount: 12,
        }),
      )
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ message: "Spotify is not connected for this adult" }), {
          status: 409,
          headers: { "Content-Type": "application/json" },
        }),
      )

    const client = new PlaylistClient("http://localhost:8080", fetchFn)

    await expect(client.getSpotifyAuthorize("tok")).resolves.toMatchObject({
      state: "abc",
    })
    await expect(client.getSpotifyStatus("tok")).resolves.toEqual({
      connected: true,
      spotifyUserId: "u1",
    })
    await expect(client.listSpotifyPlaylists("tok")).resolves.toHaveLength(1)
    await expect(client.listKidPlaylistDesignations("tok")).resolves.toEqual([])
    await expect(
      client.setKidPlaylistDesignation("tok", "k1", { spotifyPlaylistId: "p1" }),
    ).resolves.toMatchObject({ playlistName: "Sam gameday" })
    await expect(client.clearKidPlaylistDesignation("tok", "k1")).resolves.toBeUndefined()
    await expect(client.revokeSpotify("tok")).resolves.toBeUndefined()
    await expect(client.listSpotifyPlaylists("tok")).rejects.toThrow(
      /Spotify is not connected/,
    )

    expect(fetchFn.mock.calls[0]?.[0]).toBe(
      "http://localhost:8080/api/playlist/spotify/authorize",
    )
    expect(fetchFn.mock.calls[4]?.[0]).toBe(
      "http://localhost:8080/api/playlist/designations/k1",
    )
    expect(fetchFn.mock.calls[4]?.[1]).toMatchObject({ method: "PUT" })
    expect(fetchFn.mock.calls[5]?.[1]).toMatchObject({ method: "DELETE" })
    expect(fetchFn.mock.calls[6]?.[1]).toMatchObject({ method: "POST" })
  })
})
