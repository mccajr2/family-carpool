import { describe, expect, it } from "vitest"

import { authUrl } from "@/api/authClient"
import { cn } from "@/lib/utils"

describe("web utilities", () => {
  it("merges tailwind classes via cn()", () => {
    expect(cn("px-2", "px-4")).toBe("px-4")
  })

  it("builds absolute auth URLs from a base", () => {
    expect(authUrl("http://localhost:8080", "/api/auth/me")).toBe(
      "http://localhost:8080/api/auth/me",
    )
  })

  it("builds same-origin auth paths when base is empty", () => {
    expect(authUrl("", "/api/auth/me")).toBe("/api/auth/me")
  })
})
