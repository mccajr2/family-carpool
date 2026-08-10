import { describe, expect, it } from "vitest"

import {
  feedSyncStatusLabel,
  isFeedSynced,
  isPlaceLocated,
  type ActivityFeed,
  type Place,
} from "@/api/types"

describe("isPlaceLocated", () => {
  const base: Place = {
    id: "p1",
    name: "School",
    address: "1 Rd",
    latitude: null,
    longitude: null,
  }

  it("is false when either coordinate is null", () => {
    expect(isPlaceLocated(base)).toBe(false)
    expect(isPlaceLocated({ ...base, latitude: 40 })).toBe(false)
    expect(isPlaceLocated({ ...base, longitude: -74 })).toBe(false)
  })

  it("is true when both coordinates are numbers", () => {
    expect(isPlaceLocated({ ...base, latitude: 40.1, longitude: -74.2 })).toBe(true)
  })
})

describe("isFeedSynced / feedSyncStatusLabel", () => {
  const base: ActivityFeed = {
    id: "f1",
    name: "Soccer",
    sourceUrl: "https://example.com/team.ics",
    kidIds: [],
    lastSyncedAt: null,
    lastSyncError: null,
    eventCount: 0,
  }

  it("treats successful sync as synced", () => {
    const feed = { ...base, lastSyncedAt: "2026-08-10T12:00:00Z", eventCount: 3 }
    expect(isFeedSynced(feed)).toBe(true)
    expect(feedSyncStatusLabel(feed)).toBe("Synced · 3 events")
  })

  it("surfaces soft-fail errors", () => {
    const feed = {
      ...base,
      lastSyncedAt: null,
      lastSyncError: "Fetch failed",
      eventCount: 0,
    }
    expect(isFeedSynced(feed)).toBe(false)
    expect(feedSyncStatusLabel(feed)).toBe("Sync failed: Fetch failed")
  })

  it("labels never-synced feeds", () => {
    expect(isFeedSynced(base)).toBe(false)
    expect(feedSyncStatusLabel(base)).toBe("Not synced")
  })
})
