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
  /** Circle activity feed link for team carpool; null = standalone. */
  feedId: string | null
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

/** Multi-stop itinerary from GET/PUT …/calendar/{source}/{itemId}/route. */
export type CalendarRouteStatus = "OK" | "UNAVAILABLE"

export type CalendarRouteLeg = "TO" | "FROM"

export type CalendarRouteStopKind = "home" | "pickup" | "dropoff" | "destination"

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

export type CalendarRouteMemberItem = {
  source: CalendarItemSource
  itemId: string
}

export type CalendarRoute = {
  status: CalendarRouteStatus
  reason?: string | null
  bufferMinutes: number
  stops: CalendarRouteStop[]
  /** Length = stops − 1 when status is OK; empty when UNAVAILABLE. */
  legMinutes: number[]
  /** Echo of assembled leg; optional for older responses. */
  leg?: CalendarRouteLeg | null
  /** Ordered block member refs for the member-set cache key. */
  memberItemIds?: CalendarRouteMemberItem[] | null
  /**
   * Itinerary home-side override for this leg (Leaving from / Returning to).
   * Null with null leaveFromAddress = Default. Not Agenda leave-from.
   */
  leaveFromPlaceId?: string | null
  leaveFromPlaceName?: string | null
  leaveFromAddress?: string | null
}

/** Body for PUT …/calendar/{source}/{itemId}/route (driving adult only). */
export type ReorderCalendarRouteRequest = {
  /** Ordered middle-stop addresses as returned on the route (pickup or dropoff). */
  middleStopIds: string[]
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

export type CalendarConflictType =
  | "KID_TIME_OVERLAP"
  | "ADULT_COVERAGE_OVERLAP"
  | "FAMILY_TIME_OVERLAP"

export type CalendarConflict = {
  type: CalendarConflictType
  kidId: string | null
  /** Peer in-play kid when type is FAMILY_TIME_OVERLAP; null otherwise. */
  otherKidId: string | null
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
  driveBlockLinks: CalendarDriveBlockLink[]
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

export type CarpoolRideStatus = "PENDING" | "ACCEPTED" | "CANCELLED" | "PLAN"

export type CarpoolLegKind = "TO" | "FROM"

/** Persisted override that wins over the auto driving-block merge rule. */
export type DriveBlockOverrideAction = "FORCE_MERGE" | "FORCE_SPLIT"

/**
 * Adjacent confirmed-driving sibling for the viewing adult (interim Agenda
 * merge/split control). Empty on items where the adult is not driving.
 */
export type CalendarDriveBlockLink = {
  leg: CarpoolLegKind
  otherSource: CalendarItemSource
  otherId: string
  /** Sibling event title for Agenda copy (not leave-by). */
  otherTitle: string
  /** Sibling event startsAt (UTC) — not leave-by. */
  otherStartsAt: string
  combined: boolean
  overrideAction: DriveBlockOverrideAction | null
}

export type SetDriveBlockOverrideRequest = {
  leg: CarpoolLegKind
  leftSource: CalendarItemSource
  leftItemId: string
  rightSource: CalendarItemSource
  rightItemId: string
  action: DriveBlockOverrideAction
}

export type ClearDriveBlockOverrideRequest = {
  leg: CarpoolLegKind
  leftSource: CalendarItemSource
  leftItemId: string
  rightSource: CalendarItemSource
  rightItemId: string
}

export type CarpoolLegPhase =
  | "NEEDS_RIDE"
  | "WAITING_HOUSEHOLD"
  | "ASKED_TEAM"
  | "CONFIRMED"

/** Whose place is the meet point on an Ask-the-team leg. */
export type CarpoolMeetSide = "REQUESTER" | "ACCEPTOR"

export type CarpoolRideLeg = {
  kind: CarpoolLegKind
  phase: CarpoolLegPhase
  assigneeAdultId: string | null
  assigneeDisplayName: string | null
  assigneeCircleId: string | null
  assigneeCircleName: string | null
  /** Named place id when mode is named place; null for Default / one-time. */
  placeId: string | null
  /** Display name of the family-side place (snapshot or Default resolve). */
  placeName: string | null
  /** Display / one-time address of the family-side place. */
  placeAddress: string | null
  /** Meet side; REQUESTER for household / NEEDS_RIDE. */
  meetSide: CarpoolMeetSide
}

export type CarpoolRide = {
  id: string
  spaceId: string | null
  eventKey: string
  requestingCircleId: string
  requestingCircleName: string | null
  requestedByAdultId: string
  kidIds: string[]
  kidFirstNames: string[]
  seats: number
  pickupPlaceName: string
  pickupAddress: string
  pickupTown: string | null
  detourMinutes: number | null
  status: CarpoolRideStatus
  legs: CarpoolRideLeg[]
  passedByMe: boolean
  passedByAdultNames: string[]
  acceptedByAdultId: string | null
  acceptingCircleId: string | null
  acceptingCircleName: string | null
}

export type CarpoolRideEvent = {
  eventKey: string
  title: string
  startsAt: string
  endsAt: string | null
  defaultKidIds: string[]
  /** All active own plans for the event (prefer over singular fields). */
  ownRequests: CarpoolRide[]
  /**
   * Sole plan's legs when `ownRequests.length === 1`; null when 0 or 2+.
   */
  ownLegs: CarpoolRideLeg[] | null
  /** Adult who saved/created the active plan(s); null when no plan. */
  requestedByAdultId?: string | null
  requestedByDisplayName?: string | null
  /**
   * Sole entry when `ownRequests.length === 1`; null when 0 or 2+
   * (and null for circle-local PLAN-only rows).
   */
  ownRequest: CarpoolRide | null
  otherRequests: CarpoolRide[]
}

export type CreateCarpoolRideRequest = {
  eventKey: string
  kidIds?: string[]
  /** Omit for round-trip (both TO and FROM). */
  legs?: CarpoolLegKind[]
}

export type CancelCarpoolRideRequest = {
  legs?: CarpoolLegKind[]
}

export type WithdrawCarpoolRideRequest = {
  legs?: CarpoolLegKind[]
}

export type ClearCarpoolRidePlanRequest = {
  eventKey: string
  legs?: CarpoolLegKind[]
}

/** Per-leg driver intent for Save ride plan (server maps HOUSEHOLD → phase). */
export type CarpoolRidePlanLegAction = "HOUSEHOLD" | "ASK_TEAM" | "NEEDS_RIDE"

export type SaveCarpoolRidePlanLeg = {
  kind: CarpoolLegKind
  action: CarpoolRidePlanLegAction
  /** Required when action is HOUSEHOLD; omit/null otherwise. */
  assigneeAdultId?: string | null
  /**
   * Named located circle place. Mutually exclusive with `placeAddress`.
   * Both null/omitted = Default. Omit for NEEDS_RIDE and when meetSide is
   * ACCEPTOR.
   */
  placeId?: string | null
  /**
   * One-time free-text family-side address. Mutually exclusive with `placeId`.
   * Omit for NEEDS_RIDE and when meetSide is ACCEPTOR.
   */
  placeAddress?: string | null
  /**
   * Meet side for ASK_TEAM. Omit/null = REQUESTER. Omit for HOUSEHOLD /
   * NEEDS_RIDE. When ACCEPTOR, omit place fields.
   */
  meetSide?: CarpoolMeetSide | null
}

/** One kid bag + TO/FROM outcomes; server may merge identical groups. */
export type SaveCarpoolRidePlanGroup = {
  kidIds: string[]
  /** Exactly one TO and one FROM. */
  legs: SaveCarpoolRidePlanLeg[]
}

export type SaveCarpoolRidePlanRequest = {
  eventKey: string
  /** Atomic replace of this circle's active plans for the event. */
  plans: SaveCarpoolRidePlanGroup[]
}

export type SaveCarpoolRidePlanResponse = {
  ownRequests: CarpoolRide[]
  /** Set only when `ownRequests.length === 1`; otherwise null. */
  ownLegs: CarpoolRideLeg[] | null
  /** Set only when `ownRequests.length === 1`; otherwise null. */
  ownRequest: CarpoolRide | null
}

/** Confirm or decline WAITING_HOUSEHOLD legs assigned to the caller. */
export type HouseholdRidePlanActionRequest = {
  eventKey: string
}
