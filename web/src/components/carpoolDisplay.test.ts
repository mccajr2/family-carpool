import { describe, expect, it } from "vitest"

import {
  carpoolFeedStatusLabel,
  circleDisplayName,
  enableCarpoolConfirmMessage,
} from "@/components/carpoolDisplay"

describe("carpoolDisplay", () => {
  it("shows Your family when the circle name is blank", () => {
    expect(circleDisplayName(null)).toBe("Your family")
    expect(circleDisplayName("  ")).toBe("Your family")
    expect(circleDisplayName("House A")).toBe("House A")
  })

  it("labels feed carpool status", () => {
    expect(carpoolFeedStatusLabel("NONE")).toBe("No carpool")
    expect(carpoolFeedStatusLabel("AVAILABLE")).toBe("Carpool available")
    expect(carpoolFeedStatusLabel("REQUESTED")).toBe("Requested")
    expect(carpoolFeedStatusLabel("MEMBER")).toBe("Member")
    expect(carpoolFeedStatusLabel("OWNER")).toBe("Owned")
  })

  it("asks organizers to confirm ownership before Enable", () => {
    expect(enableCarpoolConfirmMessage("Soccer")).toContain("own the carpool for Soccer")
  })
})
