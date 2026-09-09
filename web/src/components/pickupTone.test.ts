import { describe, expect, it } from "vitest"

import { pickupTone } from "@/components/pickupTone"

describe("pickupTone", () => {
  it("marks 0–10 minutes as on your way", () => {
    expect(pickupTone(0)).toEqual({
      colorVar: "var(--fc-detour-on-way)",
      label: "On your way",
    })
    expect(pickupTone(10)).toEqual({
      colorVar: "var(--fc-detour-on-way)",
      label: "On your way",
    })
  })

  it("marks 11–20 minutes as a bit of a detour", () => {
    expect(pickupTone(11)).toEqual({
      colorVar: "var(--fc-detour-moderate)",
      label: "Bit of a detour",
    })
    expect(pickupTone(20)).toEqual({
      colorVar: "var(--fc-detour-moderate)",
      label: "Bit of a detour",
    })
  })

  it("marks 21+ minutes as far out of the way", () => {
    expect(pickupTone(21)).toEqual({
      colorVar: "var(--fc-detour-far)",
      label: "Far out of the way",
    })
    expect(pickupTone(40)).toEqual({
      colorVar: "var(--fc-detour-far)",
      label: "Far out of the way",
    })
  })
})
