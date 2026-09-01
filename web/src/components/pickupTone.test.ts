import { describe, expect, it } from "vitest"

import { pickupTone } from "@/components/pickupTone"

describe("pickupTone", () => {
  it("uses on-your-way tone through 10 minutes", () => {
    expect(pickupTone(0)).toEqual({
      colorVar: "var(--fc-detour-on-way)",
      label: "On your way",
    })
    expect(pickupTone(10)).toEqual({
      colorVar: "var(--fc-detour-on-way)",
      label: "On your way",
    })
  })

  it("uses moderate tone from 11 through 20 minutes", () => {
    expect(pickupTone(11)).toEqual({
      colorVar: "var(--fc-detour-moderate)",
      label: "Bit of a detour",
    })
    expect(pickupTone(20)).toEqual({
      colorVar: "var(--fc-detour-moderate)",
      label: "Bit of a detour",
    })
  })

  it("uses far tone from 21 minutes up", () => {
    expect(pickupTone(21)).toEqual({
      colorVar: "var(--fc-detour-far)",
      label: "Far out of the way",
    })
  })
})
