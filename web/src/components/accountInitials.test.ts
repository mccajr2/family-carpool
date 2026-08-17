import { describe, expect, it } from "vitest"

import { accountInitials, humanizeCircleRole } from "@/components/accountInitials"

describe("accountInitials", () => {
  it("uses up to two letters from the first two words of a display name", () => {
    expect(accountInitials("Alex", "parent@example.com")).toBe("A")
    expect(accountInitials("Alex Rivera", "parent@example.com")).toBe("AR")
    expect(accountInitials("alex rivera smith", "parent@example.com")).toBe("AR")
    expect(accountInitials("  Alex   Rivera  ", "parent@example.com")).toBe("AR")
  })

  it("falls back to the email local-part when the display name is empty", () => {
    expect(accountInitials(null, "parent@example.com")).toBe("P")
    expect(accountInitials(undefined, "parent@example.com")).toBe("P")
    expect(accountInitials("   ", "parent@example.com")).toBe("P")
    expect(accountInitials("", "parent+tag@example.com")).toBe("P")
  })

  it("returns empty when both display name and email local-part are empty", () => {
    expect(accountInitials(null, "")).toBe("")
    expect(accountInitials("", "@example.com")).toBe("")
  })
})

describe("humanizeCircleRole", () => {
  it("title-cases known circle roles", () => {
    expect(humanizeCircleRole("ORGANIZER")).toBe("Organizer")
    expect(humanizeCircleRole("CAREGIVER")).toBe("Caregiver")
  })

  it("leaves unknown roles unchanged", () => {
    expect(humanizeCircleRole("MEMBER")).toBe("MEMBER")
  })
})
