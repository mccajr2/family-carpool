import { describe, expect, it } from "vitest"

import { isPlaceLocated, type Place } from "@/api/types"

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
