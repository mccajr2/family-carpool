import { authUrl } from "@/api/authClient"
import type {
  KidPlaylistDesignation,
  SetKidPlaylistDesignationRequest,
  SpotifyAuthorize,
  SpotifyConnectionStatus,
  SpotifyPlaylistOption,
} from "@/api/types"
import { apiBaseUrl } from "@/config"

async function readErrorMessage(response: Response, fallback: string): Promise<string> {
  try {
    const body = (await response.json()) as { message?: string }
    if (typeof body.message === "string" && body.message.length > 0) {
      return body.message
    }
  } catch {
    // ignore non-JSON error bodies
  }
  return `${fallback} (${response.status})`
}

export class PlaylistClient {
  private readonly baseUrl: string
  private readonly fetchFn: typeof fetch

  constructor(
    baseUrl: string = apiBaseUrl,
    fetchFn: typeof fetch = globalThis.fetch.bind(globalThis),
  ) {
    this.baseUrl = baseUrl
    this.fetchFn = fetchFn
  }

  async getSpotifyAuthorize(accessToken: string): Promise<SpotifyAuthorize> {
    const response = await this.fetchFn(
      authUrl(this.baseUrl, "/api/playlist/spotify/authorize"),
      { headers: { Authorization: `Bearer ${accessToken}` } },
    )
    if (!response.ok) {
      throw new Error(await readErrorMessage(response, "Spotify authorize failed"))
    }
    return (await response.json()) as SpotifyAuthorize
  }

  async getSpotifyStatus(accessToken: string): Promise<SpotifyConnectionStatus> {
    const response = await this.fetchFn(
      authUrl(this.baseUrl, "/api/playlist/spotify/status"),
      { headers: { Authorization: `Bearer ${accessToken}` } },
    )
    if (!response.ok) {
      throw new Error(await readErrorMessage(response, "Spotify status failed"))
    }
    return (await response.json()) as SpotifyConnectionStatus
  }

  async revokeSpotify(accessToken: string): Promise<void> {
    const response = await this.fetchFn(
      authUrl(this.baseUrl, "/api/playlist/spotify/revoke"),
      {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    )
    if (!response.ok) {
      throw new Error(await readErrorMessage(response, "Spotify revoke failed"))
    }
  }

  async listSpotifyPlaylists(accessToken: string): Promise<SpotifyPlaylistOption[]> {
    const response = await this.fetchFn(
      authUrl(this.baseUrl, "/api/playlist/spotify/playlists"),
      { headers: { Authorization: `Bearer ${accessToken}` } },
    )
    if (!response.ok) {
      throw new Error(await readErrorMessage(response, "List Spotify playlists failed"))
    }
    return (await response.json()) as SpotifyPlaylistOption[]
  }

  async listKidPlaylistDesignations(
    accessToken: string,
  ): Promise<KidPlaylistDesignation[]> {
    const response = await this.fetchFn(
      authUrl(this.baseUrl, "/api/playlist/designations"),
      { headers: { Authorization: `Bearer ${accessToken}` } },
    )
    if (!response.ok) {
      throw new Error(await readErrorMessage(response, "List playlist designations failed"))
    }
    return (await response.json()) as KidPlaylistDesignation[]
  }

  async setKidPlaylistDesignation(
    accessToken: string,
    kidId: string,
    body: SetKidPlaylistDesignationRequest,
  ): Promise<KidPlaylistDesignation> {
    const response = await this.fetchFn(
      authUrl(this.baseUrl, `/api/playlist/designations/${kidId}`),
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      },
    )
    if (!response.ok) {
      throw new Error(await readErrorMessage(response, "Set playlist designation failed"))
    }
    return (await response.json()) as KidPlaylistDesignation
  }

  async clearKidPlaylistDesignation(accessToken: string, kidId: string): Promise<void> {
    const response = await this.fetchFn(
      authUrl(this.baseUrl, `/api/playlist/designations/${kidId}`),
      {
        method: "DELETE",
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    )
    if (!response.ok) {
      throw new Error(await readErrorMessage(response, "Clear playlist designation failed"))
    }
  }
}
