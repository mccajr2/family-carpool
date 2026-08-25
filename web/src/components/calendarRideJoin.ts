import type { CalendarItem, CarpoolRideEvent, CarpoolSummary } from "@/api/types"

/** feedId → spaceId for MEMBER/OWNER feeds (carpool-eligible). */
export function feedSpaceIdsFromSummary(summary: CarpoolSummary): Map<string, string> {
  const map = new Map<string, string>()
  for (const feed of summary.feeds) {
    if (
      feed.spaceId != null &&
      (feed.status === "MEMBER" || feed.status === "OWNER")
    ) {
      map.set(feed.feedId, feed.spaceId)
    }
  }
  return map
}

export function normalizeRideMatchText(value: string | null | undefined): string {
  return value == null ? "" : value.trim().toLowerCase()
}

/**
 * Location for match when the list payload has no location field: fingerprint
 * keys are `FP:<title>|<startsAt>|<normalized location>`. UID keys have none.
 */
export function rideEventLocationNormalized(event: CarpoolRideEvent): string {
  if (!event.eventKey.startsWith("FP:")) {
    return ""
  }
  const parts = event.eventKey.slice(3).split("|")
  if (parts.length < 3) {
    return ""
  }
  return parts[parts.length - 1] ?? ""
}

export function startsAtEqual(a: string, b: string): boolean {
  const left = Date.parse(a)
  const right = Date.parse(b)
  if (Number.isNaN(left) || Number.isNaN(right)) {
    return a === b
  }
  return left === right
}

/**
 * Match a FEED calendar row to a listed ride event by space + startsAt + title.
 * Location is used only to disambiguate when more than one candidate shares
 * title+startsAt (FP fingerprint drift must not block a unique match).
 * Manual / non-member feeds → null.
 */
export function matchCalendarItemToRideEvent(
  item: Pick<CalendarItem, "source" | "feedId" | "title" | "startsAt" | "location">,
  spaceIdByFeedId: ReadonlyMap<string, string>,
  ridesBySpaceId: ReadonlyMap<string, readonly CarpoolRideEvent[]>,
): CarpoolRideEvent | null {
  if (item.source !== "FEED" || item.feedId == null) {
    return null
  }
  const spaceId = spaceIdByFeedId.get(item.feedId)
  if (spaceId == null) {
    return null
  }
  const events = ridesBySpaceId.get(spaceId)
  if (events == null || events.length === 0) {
    return null
  }
  const title = normalizeRideMatchText(item.title)
  const candidates = events.filter(
    (event) =>
      startsAtEqual(event.startsAt, item.startsAt) &&
      normalizeRideMatchText(event.title) === title,
  )
  if (candidates.length === 0) {
    return null
  }
  if (candidates.length === 1) {
    return candidates[0] ?? null
  }
  const itemLocation = normalizeRideMatchText(item.location)
  if (itemLocation === "") {
    return null
  }
  const byLocation = candidates.filter(
    (event) => rideEventLocationNormalized(event) === itemLocation,
  )
  return byLocation.length === 1 ? (byLocation[0] ?? null) : null
}

export function ridesBySpaceRecordToMap(
  ridesBySpace: Record<string, CarpoolRideEvent[]>,
): Map<string, readonly CarpoolRideEvent[]> {
  return new Map(Object.entries(ridesBySpace))
}
