import { describe, expect, it } from "vitest"

import {
  postStandingAskLabel,
  standingAskCheckboxLabel,
  standingAskGateOpen,
} from "@/components/standingRideChrome"

describe("standingRideChrome", () => {
  it("labels standing Ask checkbox and Post CTA with weekday", () => {
    expect(standingAskCheckboxLabel("Tuesday")).toBe(
      "Ask for every Tuesday practice",
    )
    expect(postStandingAskLabel("Tuesdays")).toBe(
      "Post standing Ask for Tuesdays",
    )
  })

  it("treats non-empty weekday singular as gate open", () => {
    expect(standingAskGateOpen("Tuesday")).toBe(true)
    expect(standingAskGateOpen(null)).toBe(false)
    expect(standingAskGateOpen(undefined)).toBe(false)
    expect(standingAskGateOpen("")).toBe(false)
  })
})
