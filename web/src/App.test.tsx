import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import App from "@/App"

describe("App", () => {
  it("does not constrain the root to max-w-5xl; Sign in still sits in the centered column", () => {
    const { container } = render(<App />)
    const main = container.querySelector("main")
    expect(main).not.toBeNull()
    expect(main?.className).not.toMatch(/max-w-5xl/)
    const heading = screen.getByRole("heading", { name: "Sign in" })
    expect(heading.closest("[class*='max-w-5xl']")).not.toBeNull()
    expect(heading.closest("main")?.className).not.toMatch(/max-w-5xl/)
  })
})
