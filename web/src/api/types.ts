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

export type CalendarItemSource = "MANUAL" | "FEED"

export type LeaveByStatus = "OK" | "UNAVAILABLE" | "PENDING"

/** Fill-in row from GET …/calendar/leave-by (never PENDING). */
export type CalendarLeaveBy = {
  id: string
  source: CalendarItemSource
  leaveFromPlaceId?: string | null
  leaveFromPlaceName?: string | null
  leaveFromAddress?: string | null
  leaveByAt?: string | null
  leaveByStatus: Exclude<LeaveByStatus, "PENDING">
  leaveByReason?: string | null
  coverages: CalendarCoverageLeaveBy[]
}

/** Coverage leave-from / leave-by patch on a fill-in row. */
export type CalendarCoverageLeaveBy = {
  id: string
  leaveFromPlaceId?: string | null
  leaveFromPlaceName?: string | null
  leaveFromAddress?: string | null
  leaveByAt?: string | null
  leaveByStatus: Exclude<LeaveByStatus, "PENDING">
  leaveByReason?: string | null
}

/** Multi-stop itinerary from GET …/calendar/{source}/{itemId}/route. */
export type CalendarRouteStatus = "OK" | "UNAVAILABLE"

export type CalendarRouteStopKind = "home" | "pickup" | "destination"

export type CalendarRouteNotifyChannel = "push" | "sms"

export type CalendarRouteNotifyContact = {
  channel: CalendarRouteNotifyChannel
  to: string
}

export type CalendarRouteStop = {
  name: string
  address: string
  kind: CalendarRouteStopKind
  contact?: CalendarRouteNotifyContact | null
}

export type CalendarRoute = {
  status: CalendarRouteStatus
  reason?: string | null
  bufferMinutes: number
  stops: CalendarRouteStop[]
  /** Length = stops − 1 when status is OK; empty when UNAVAILABLE. */
  legMinutes: number[]
}

/** Track row from GET …/calendar/{source}/{itemId}/playlist. */
export type CalendarPlaylistTrack = {
  title: string
  artist: string
  durationSec: number
  uri?: string | null
}

export type CalendarPlaylistInviteContact = {
  channel: CalendarRouteNotifyChannel
  to: string
}

export type CalendarPlaylistRider = {
  kidId: string
  kidDisplayName: string
  connected: boolean
  designatingAdultId?: string | null
  spotifyPlaylistId?: string | null
  playlistName?: string | null
  playlistUrl?: string | null
  trackCount?: number | null
  durationSec?: number | null
  tracks: CalendarPlaylistTrack[]
  inviteContact?: CalendarPlaylistInviteContact | null
}

export type CalendarPlaylist = {
  riders: CalendarPlaylistRider[]
}

export type OpenCalendarPlaylistRequest = {
  trackUris?: string[] | null
}

export type CalendarPlaylistOpen = {
  url: string
}

export type SpotifyAuthorize = {
  authorizeUrl: string
  state: string
}

export type SpotifyConnectionStatus = {
  connected: boolean
  spotifyUserId?: string | null
}

export type SpotifyPlaylistOption = {
  id: string
  name: string
  url: string
  trackCount: number
}

export type KidPlaylistDesignation = {
  kidId: string
  kidDisplayName: string
  spotifyPlaylistId: string
  playlistName: string
  playlistUrl: string
  trackCount?: number | null
}

export type SetKidPlaylistDesignationRequest = {
  spotifyPlaylistId: string
}

export type CoverageStatus = "PENDING" | "CONFIRMED" | "DECLINED"

export type RsvpStatus = "YES" | "NO" | "NO_RESPONSE"

export type CalendarRsvp = {
  kidId: string
  status: RsvpStatus
}

export type SetCalendarRsvpRequest = {
  status: RsvpStatus
}

export type CalendarCoverageAssignment = {
  id: string
  coveringAdultId: string
  coveringAdultDisplayName: string | null
  assignedByAdultId: string
  kidIds: string[]
  status: CoverageStatus
  leaveFromPlaceId: string | null
  leaveFromPlaceName: string | null
  leaveFromAddress: string | null
  leaveByAt: string | null
  leaveByStatus: LeaveByStatus | null
  leaveByReason: string | null
}

export type CalendarConflictType = "KID_TIME_OVERLAP" | "ADULT_COVERAGE_OVERLAP"

export type CalendarConflict = {
  type: CalendarConflictType
  kidId: string | null
  adultId: string | null
  adultDisplayName: string | null
  otherSource: CalendarItemSource
  otherItemId: string
  otherTitle: string
  otherStartsAt: string
}

export type AssignCalendarCoverageRequest = {
  coveringAdultId: string
  kidIds: string[]
}

export type CalendarItem = {
  id: string
  source: CalendarItemSource
  title: string
  startsAt: string
  endsAt: string | null
  location: string | null
  kidIds: string[]
  feedId: string | null
  feedName: string | null
  eventKey: string | null
  leaveFromPlaceId: string | null
  leaveFromPlaceName: string | null
  leaveFromAddress: string | null
  leaveByAt: string | null
  leaveByStatus: LeaveByStatus
  leaveByReason: string | null
  coverages: CalendarCoverageAssignment[]
  uncoveredKidIds: string[]
  conflicts: CalendarConflict[]
  rsvps: CalendarRsvp[]
}

export type SetCalendarLeaveFromRequest = {
  leaveFromPlaceId?: string | null
  leaveFromAddress?: string | null
}

export type SetDefaultLeaveFromRequest = {
  placeId: string | null
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
  defaultLeaveFromPlaceId: string | null
  defaultLeaveFromPlaceName: string | null
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

export type GarageMemberDrives = {
  adultId: string
  displayName: string
  drives: boolean
}

export type Vehicle = {
  id: string
  ownerAdultId: string
  driverAdultIds: string[]
  keptAtPlaceId: string | null
  label: string
  year: number
  make: string
  model: string
  seats: number
  suggestedSeats: number | null
}

export type Garage = {
  members: GarageMemberDrives[]
  vehicles: Vehicle[]
}

export type CreateVehicleRequest = {
  label: string
  year: number
  make: string
  model: string
  seats: number
  driverAdultIds?: string[]
  keptAtPlaceId?: string | null
}

export type UpdateVehicleRequest = {
  label: string
  year: number
  make: string
  model: string
  seats: number
  driverAdultIds?: string[]
  keptAtPlaceId?: string | null
}

export type SuggestSeatsRequest = {
  year: number
  make: string
  model: string
}

export type SuggestSeatsResponse = {
  seats: number | null
}

export type VehicleMake = {
  name: string
}

export type VehicleModel = {
  name: string
}

export type ErrorResponse = {
  message: string
}

export type CarpoolSpaceMembership = "OWNER" | "MEMBER"

export type CarpoolFeedStatusKind =
  | "NONE"
  | "AVAILABLE"
  | "REQUESTED"
  | "MEMBER"
  | "OWNER"

export type CarpoolFeedStatus = {
  feedId: string
  feedName: string
  status: CarpoolFeedStatusKind
  spaceId: string | null
  spaceName: string | null
}

export type CarpoolSpaceMember = {
  circleId: string
  circleName: string | null
  membership: CarpoolSpaceMembership
}

export type CarpoolJoinRequest = {
  id: string
  spaceId: string
  circleId: string
  circleName: string | null
  requestedByAdultId: string
  requestedByDisplayName: string | null
}

export type CarpoolInvite = {
  code: string
}

export type CarpoolSpace = {
  id: string
  name: string
  membership: CarpoolSpaceMembership
  inviteCode: string
  callerFeedId: string | null
  members: CarpoolSpaceMember[]
  pendingRequests: CarpoolJoinRequest[]
}

export type CarpoolSummary = {
  circleRole: FamilyRole
  feeds: CarpoolFeedStatus[]
  spaces: CarpoolSpace[]
}

export type CarpoolLeg = "TO" | "FROM" | "BOTH"
export type CarpoolNeededLeg = Exclude<CarpoolLeg, "BOTH">
export type CarpoolLegCoverageStatus = "OPEN" | "CONFIRMED"
export type CarpoolRequestStatus = "UNCOVERED" | "PARTIAL" | "FULLY_COVERED"
export type CarpoolRideStatus = "ACTIVE" | "CANCELLED" | "WITHDRAWN"

export type CarpoolLegStatus = {
  leg: CarpoolNeededLeg
  status: CarpoolLegCoverageStatus
}

export type CarpoolRequest = {
  id: string
  spaceId: string
  eventKey: string
  requestingCircleId: string
  requestingCircleName: string | null
  requestedByAdultId: string
  kidId: string
  kidFirstName: string
  legsNeeded: CarpoolNeededLeg[]
  legStatuses: CarpoolLegStatus[]
  pickupPlaceName: string
  pickupAddress: string
  pickupTown: string | null
  detourMinutes: number | null
  status: CarpoolRequestStatus
  passedByMe: boolean
  passedByAdultNames: string[]
  acceptedByAdultId: string | null
  acceptingCircleId: string | null
  acceptingCircleName: string | null
  vehicleId: string | null
  vehicleLabel: string | null
}

export type CarpoolRide = {
  id: string
  spaceId: string
  eventKey: string
  leg: CarpoolNeededLeg
  driverAdultId: string
  drivingCircleId: string
  drivingCircleName: string | null
  vehicleId: string
  vehicleLabel: string | null
  passengerRequestIds: string[]
  status: CarpoolRideStatus
}

export type CarpoolRideEvent = {
  eventKey: string
  title: string
  startsAt: string
  endsAt: string | null
  defaultKidIds: string[]
  ownRequest: CarpoolRequest | null
  otherRequests: CarpoolRequest[]
  rides?: CarpoolRide[]
}

export type CreateCarpoolRequestRequest = {
  eventKey: string
  kidId: string
  legs?: CarpoolLeg
  legsNeeded?: CarpoolNeededLeg[]
}

export type PatchCarpoolRequestRequest = {
  legs?: CarpoolLeg
  legsNeeded: CarpoolNeededLeg[]
}

export type CreateCarpoolRideRequest = {
  eventKey: string
  leg: CarpoolNeededLeg
  vehicleId: string
  passengerRequestIds: string[]
}

/** @deprecated Transitional alias while callers migrate to request-based naming. */
export type LegacyCarpoolRideRequest = CarpoolRequest
