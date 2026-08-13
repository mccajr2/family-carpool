import { describe, expect, it } from "vitest"
import { FamilyBootstrapStore } from "@/api/familyBootstrapStore"

describe("FamilyBootstrapStore", () => {
  it("round-trips by adult id", () => {
    const memory = new Map<string, string>()
    const store = new FamilyBootstrapStore({
      getItem: (key) => memory.get(key) ?? null,
      setItem: (key, value) => {
        memory.set(key, value)
      },
      removeItem: (key) => {
        memory.delete(key)
      },
    })
    store.save({
      adultId: "a1",
      email: "parent@example.com",
      adultDisplayName: "Alex",
      circle: {
        id: "c1",
        name: "House",
        role: "ORGANIZER",
        members: [],
        kids: [],
        places: [],
        defaultLeaveFromPlaceId: null,
        defaultLeaveFromPlaceName: null,
      },
      inviteCode: "AB12",
      feeds: [],
    })
    expect(store.load("a1")?.circle.id).toBe("c1")
    expect(store.load("a2")).toBeNull()
    store.clear("a1")
    expect(store.load("a1")).toBeNull()
  })
})
