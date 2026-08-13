import { describe, expect, it } from "vitest"

import {
  CalendarCacheStore,
  CALENDAR_CACHE_SOFT_TTL_MS,
  maxIsoInstant,
} from "@/api/calendarCacheStore"
import type { CalendarItem } from "@/api/types"

function memoryStorage(): Storage {
  const map = new Map<string, string>()
  return {
    get length() {
      return map.size
    },
    clear() {
      map.clear()
    },
    getItem(key: string) {
      return map.has(key) ? map.get(key)! : null
    },
    key(index: number) {
      return [...map.keys()][index] ?? null
    },
    removeItem(key: string) {
      map.delete(key)
    },
    setItem(key: string, value: string) {
      map.set(key, value)
    },
  }
}

function item(partial: Partial<CalendarItem> & Pick<CalendarItem, "id" | "title">): CalendarItem {
  return {
    source: "MANUAL",
    startsAt: "2026-08-15T17:00:00.000Z",
    endsAt: null,
    location: null,
    kidIds: ["k1"],
    feedId: null,
    feedName: null,
    leaveFromPlaceId: null,
    leaveFromPlaceName: null,
    leaveByAt: null,
    leaveByStatus: "UNAVAILABLE",
    leaveByReason: "NO_ORIGIN",
    coverages: [],
    uncoveredKidIds: [],
    conflicts: [],
    rsvps: [],
    ...partial,
  }
}

describe("CalendarCacheStore", () => {
  it("round-trips a snapshot keyed by adult and circle", () => {
    const store = new CalendarCacheStore(memoryStorage())
    const snapshot = {
      adultId: "a1",
      circleId: "c1",
      from: "2026-08-12T04:00:00.000Z",
      to: "2026-09-11T04:00:00.000Z",
      items: [item({ id: "e1", title: "Practice" })],
      fetchedAt: 1_700_000_000_000,
    }
    store.save(snapshot)
    expect(store.load("a1", "c1")).toEqual(snapshot)
    expect(store.load("a1", "c2")).toBeNull()
    expect(store.load("a2", "c1")).toBeNull()
  })

  it("patches one item without changing window bounds", () => {
    const store = new CalendarCacheStore(memoryStorage())
    store.save({
      adultId: "a1",
      circleId: "c1",
      from: "from",
      to: "to",
      items: [
        item({ id: "e1", title: "Before" }),
        item({ id: "e2", title: "Other" }),
      ],
      fetchedAt: 10,
    })
    store.patchItem("a1", "c1", item({ id: "e1", title: "After", leaveByStatus: "OK", leaveByAt: "2026-08-15T16:00:00.000Z", leaveByReason: null }))
    const loaded = store.load("a1", "c1")!
    expect(loaded.from).toBe("from")
    expect(loaded.to).toBe("to")
    expect(loaded.fetchedAt).toBe(10)
    expect(loaded.items.map((row) => row.title)).toEqual(["After", "Other"])
  })

  it("clear removes one entry; clearAll removes every calendar key", () => {
    const storage = memoryStorage()
    const store = new CalendarCacheStore(storage)
    store.save({
      adultId: "a1",
      circleId: "c1",
      from: "f",
      to: "t",
      items: [],
      fetchedAt: 1,
    })
    store.save({
      adultId: "a1",
      circleId: "c2",
      from: "f",
      to: "t",
      items: [],
      fetchedAt: 1,
    })
    store.clear("a1", "c1")
    expect(store.load("a1", "c1")).toBeNull()
    expect(store.load("a1", "c2")).not.toBeNull()
    store.clearAll()
    expect(store.load("a1", "c2")).toBeNull()
  })

  it("reports soft-stale after the TTL window", () => {
    const store = new CalendarCacheStore(memoryStorage())
    const fetchedAt = 1_000_000
    expect(store.isStale({ fetchedAt }, fetchedAt + CALENDAR_CACHE_SOFT_TTL_MS)).toBe(false)
    expect(store.isStale({ fetchedAt }, fetchedAt + CALENDAR_CACHE_SOFT_TTL_MS + 1)).toBe(true)
  })

  it("maxIsoInstant picks the later instant", () => {
    expect(maxIsoInstant("2026-08-01T00:00:00.000Z", "2026-09-01T00:00:00.000Z")).toBe(
      "2026-09-01T00:00:00.000Z",
    )
  })
})
