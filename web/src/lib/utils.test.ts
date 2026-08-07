import { describe, expect, it } from "vitest"

import { greetingUrl } from "@/api/greetingClient"
import { cn } from "@/lib/utils"

describe("web scaffold", () => {
  it("merges tailwind classes via cn()", () => {
    expect(cn("px-2", "px-4")).toBe("px-4")
  })

  it("builds absolute greeting URLs from a base", () => {
    expect(greetingUrl("http://localhost:8080", "Web")).toBe(
      "http://localhost:8080/api/greeting?name=Web",
    )
  })

  it("builds same-origin greeting paths when base is empty", () => {
    expect(greetingUrl("", "Web")).toBe("/api/greeting?name=Web")
  })
})
