import { describe, expect, it } from "vitest"

import {
  postStandingAskLabel,
  standingAskCheckboxLabel,
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
})
