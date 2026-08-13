import type { ActivityFeed, FamilyCircle } from "@/api/types"

const STORAGE_PREFIX = "family-carpool.family-bootstrap:"

export type FamilyBootstrapSnapshot = {
  adultId: string
  email: string
  adultDisplayName: string | null
  circle: FamilyCircle
  inviteCode: string | null
  feeds: ActivityFeed[]
}

function storageKey(adultId: string): string {
  return `${STORAGE_PREFIX}${adultId}`
}

/** Last Ready shell per adult — paint before getCircle. */
export class FamilyBootstrapStore {
  private readonly storage: Pick<
    Storage,
    "getItem" | "setItem" | "removeItem"
  >

  constructor(
    storage: Pick<Storage, "getItem" | "setItem" | "removeItem"> = localStorage,
  ) {
    this.storage = storage
  }

  load(adultId: string): FamilyBootstrapSnapshot | null {
    const raw = this.storage.getItem(storageKey(adultId))
    if (!raw) {
      return null
    }
    try {
      const parsed = JSON.parse(raw) as FamilyBootstrapSnapshot
      if (
        parsed.adultId !== adultId ||
        !parsed.circle ||
        typeof parsed.circle.id !== "string"
      ) {
        return null
      }
      return parsed
    } catch {
      return null
    }
  }

  save(snapshot: FamilyBootstrapSnapshot): void {
    this.storage.setItem(storageKey(snapshot.adultId), JSON.stringify(snapshot))
  }

  clear(adultId: string): void {
    this.storage.removeItem(storageKey(adultId))
  }
}
