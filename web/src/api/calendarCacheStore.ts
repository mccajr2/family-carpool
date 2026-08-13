import type { CalendarItem } from "@/api/types"

/** Soft TTL before returning to Calendar forces a background revalidate. */
export const CALENDAR_CACHE_SOFT_TTL_MS = 5 * 60 * 1000

const STORAGE_PREFIX = "family-carpool.calendar-cache:"

export type CalendarCacheSnapshot = {
  adultId: string
  circleId: string
  from: string
  to: string
  items: CalendarItem[]
  fetchedAt: number
}

function storageKey(adultId: string, circleId: string): string {
  return `${STORAGE_PREFIX}${adultId}:${circleId}`
}

/**
 * Persists the last successful calendar GET per (adultId, circleId).
 * Not a secret store — calendar enrichment is adult-scoped but not credentials.
 */
export class CalendarCacheStore {
  private readonly storage: Pick<
    Storage,
    "getItem" | "setItem" | "removeItem" | "key" | "length"
  >

  constructor(
    storage: Pick<
      Storage,
      "getItem" | "setItem" | "removeItem" | "key" | "length"
    > = localStorage,
  ) {
    this.storage = storage
  }

  load(adultId: string, circleId: string): CalendarCacheSnapshot | null {
    const raw = this.storage.getItem(storageKey(adultId, circleId))
    if (!raw) {
      return null
    }
    try {
      const parsed = JSON.parse(raw) as CalendarCacheSnapshot
      if (
        parsed.adultId !== adultId ||
        parsed.circleId !== circleId ||
        typeof parsed.from !== "string" ||
        typeof parsed.to !== "string" ||
        !Array.isArray(parsed.items) ||
        typeof parsed.fetchedAt !== "number"
      ) {
        return null
      }
      return parsed
    } catch {
      return null
    }
  }

  save(snapshot: CalendarCacheSnapshot): void {
    this.storage.setItem(
      storageKey(snapshot.adultId, snapshot.circleId),
      JSON.stringify(snapshot),
    )
  }

  /** Replace one calendar row in the persisted snapshot when present. */
  patchItem(adultId: string, circleId: string, updated: CalendarItem): void {
    const existing = this.load(adultId, circleId)
    if (!existing) {
      return
    }
    this.save({
      ...existing,
      items: existing.items.map((row) =>
        row.source === updated.source && row.id === updated.id ? updated : row,
      ),
    })
  }

  clear(adultId: string, circleId: string): void {
    this.storage.removeItem(storageKey(adultId, circleId))
  }

  /** Remove every calendar snapshot (sign-out). */
  clearAll(): void {
    const keys: string[] = []
    for (let i = 0; i < this.storage.length; i++) {
      const key = this.storage.key(i)
      if (key?.startsWith(STORAGE_PREFIX)) {
        keys.push(key)
      }
    }
    for (const key of keys) {
      this.storage.removeItem(key)
    }
  }

  isStale(snapshot: Pick<CalendarCacheSnapshot, "fetchedAt">, nowMs: number = Date.now()): boolean {
    return nowMs - snapshot.fetchedAt > CALENDAR_CACHE_SOFT_TTL_MS
  }
}

/** Later of two ISO-8601 UTC instants (lexicographic compare is safe for this format). */
export function maxIsoInstant(a: string, b: string): string {
  return a >= b ? a : b
}
