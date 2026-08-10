/** Mirrors schemas in `contracts/openapi.yaml`. */
export type Adult = {
  id: string
  email: string
  displayName: string | null
}

export type RequestAuthCodeResponse = {
  email: string
  expiresInSeconds: number
  devCode?: string
}

export type AuthSessionResponse = {
  accessToken: string
  tokenType: "Bearer"
  adult: Adult
}

export type FamilyRole = "ORGANIZER" | "CAREGIVER"

export type Kid = {
  id: string
  displayName: string
}

export type Place = {
  id: string
  name: string
  address: string
  latitude: number | null
  longitude: number | null
}

/** True when both coordinates are present (geocode succeeded). */
export function isPlaceLocated(place: Place): boolean {
  return place.latitude != null && place.longitude != null
}

export type ActivityFeed = {
  id: string
  name: string
  sourceUrl: string
  kidIds: string[]
  lastSyncedAt: string | null
  lastSyncError: string | null
  eventCount: number
}

/** True when the last sync succeeded (no error and a sync timestamp). */
export function isFeedSynced(feed: ActivityFeed): boolean {
  return feed.lastSyncError == null && feed.lastSyncedAt != null
}

export function feedSyncStatusLabel(feed: ActivityFeed): string {
  if (feed.lastSyncError) {
    return `Sync failed: ${feed.lastSyncError}`
  }
  if (feed.lastSyncedAt) {
    return `Synced · ${feed.eventCount} events`
  }
  return "Not synced"
}

export type ManualEvent = {
  id: string
  title: string
  startsAt: string
  endsAt: string | null
  location: string | null
  kidIds: string[]
}

export type FamilyMember = {
  adultId: string
  email: string
  displayName: string | null
  role: FamilyRole
}

export type FamilyCircle = {
  id: string
  name: string | null
  role: FamilyRole
  members: FamilyMember[]
  kids: Kid[]
  places: Place[]
}

export type FamilyInvite = {
  code: string
}

export type CreateFamilyCircleRequest = {
  adultDisplayName: string
  name?: string | null
}

export type JoinFamilyCircleRequest = {
  code: string
  adultDisplayName?: string | null
}

export type ErrorResponse = {
  message: string
}
