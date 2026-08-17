import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import App from "@/App"

describe("App", () => {
  it("does not constrain the root to max-w-5xl; Sign in still sits in the centered column", () => {
    const { container } = render(<App />)
    const root = container.firstElementChild
    expect(root?.className).toMatch(/min-h-svh/)
    expect(root?.className).not.toMatch(/max-w-5xl/)
    expect(container.querySelector("main")).toBeNull()
    const heading = screen.getByRole("heading", { name: "Sign in" })
    expect(heading.closest("[class*='max-w-5xl']")).not.toBeNull()
  })
})
