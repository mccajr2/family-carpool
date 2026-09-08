/**
 * Persist ride-detail context across Spotify OAuth (full-page redirect).
 */

export const SPOTIFY_OAUTH_RETURN_KEY = "fc-spotify-oauth-return"

export type SpotifyOAuthReturn = {
  rideDetailItemKey: string
  designateKidId: string
}

export function saveSpotifyOAuthReturn(value: SpotifyOAuthReturn): void {
  try {
    sessionStorage.setItem(SPOTIFY_OAUTH_RETURN_KEY, JSON.stringify(value))
  } catch {
    // ignore quota / private mode
  }
}

export function takeSpotifyOAuthReturn(): SpotifyOAuthReturn | null {
  try {
    const raw = sessionStorage.getItem(SPOTIFY_OAUTH_RETURN_KEY)
    if (raw == null) {
      return null
    }
    sessionStorage.removeItem(SPOTIFY_OAUTH_RETURN_KEY)
    const parsed = JSON.parse(raw) as Partial<SpotifyOAuthReturn>
    if (
      typeof parsed.rideDetailItemKey !== "string" ||
      parsed.rideDetailItemKey.length === 0 ||
      typeof parsed.designateKidId !== "string" ||
      parsed.designateKidId.length === 0
    ) {
      return null
    }
    return {
      rideDetailItemKey: parsed.rideDetailItemKey,
      designateKidId: parsed.designateKidId,
    }
  } catch {
    return null
  }
}

/** True when the landing URL includes spotify=connected (OAuth success). */
export function consumeSpotifyConnectedQuery(
  search: string = typeof window !== "undefined" ? window.location.search : "",
): boolean {
  const params = new URLSearchParams(search)
  if (params.get("spotify") !== "connected") {
    return false
  }
  params.delete("spotify")
  const next = params.toString()
  const path = `${window.location.pathname}${next ? `?${next}` : ""}${window.location.hash}`
  window.history.replaceState(null, "", path)
  return true
}
