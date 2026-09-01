import { render, screen, within } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { RiderChips } from "@/components/RiderChipsView"
import type { RiderDescriptor } from "@/components/riderChips"

const riders: RiderDescriptor[] = [
  { firstName: "Declan", initial: "D" },
  { firstName: "Ben", initial: "B" },
]

describe("RiderChips", () => {
  it("renders nothing when riders is empty", () => {
    const { container } = render(<RiderChips riders={[]} />)
    expect(container).toBeEmptyDOMElement()
  })

  it("renders inline initials and first-name labels with kid-avatar tokens", () => {
    render(<RiderChips riders={riders} variant="inline" />)

    const group = screen.getByTestId("rider-chips")
    expect(group).toHaveAttribute("aria-label", "Riding: Declan, Ben")
    expect(screen.getByText("Declan")).toBeInTheDocument()
    expect(screen.getByText("Ben")).toBeInTheDocument()

    const circles = within(group).getAllByText(/^[DB]$/)
    expect(circles).toHaveLength(2)
    for (const circle of circles) {
      expect(circle).toHaveAttribute("aria-hidden", "true")
      expect(circle.style.width).toBe("var(--fc-space-list-row-kid-avatar)")
      expect(circle.style.height).toBe("var(--fc-space-list-row-kid-avatar)")
      expect(circle.style.fontSize).toBe("var(--fc-font-list-row-avatar-label-size)")
    }
  })

  it("renders compact overlapping circles and comma-separated names", () => {
    render(<RiderChips riders={riders} variant="compact" />)

    const group = screen.getByTestId("rider-chips")
    expect(group).toHaveAttribute("aria-label", "Riding: Declan, Ben")
    expect(screen.getByTestId("rider-chips-names")).toHaveTextContent("Declan, Ben")

    const stack = screen.getByTestId("rider-chips-avatar-stack")
    const circles = within(stack).getAllByText(/^[DB]$/)
    expect(circles).toHaveLength(2)
    expect(circles[0]).toHaveAttribute("aria-hidden", "true")
    expect(circles[0]!.style.width).toBe("var(--fc-space-list-row-avatar)")
    expect(circles[0]!.style.borderWidth).toBe("var(--fc-space-list-row-avatar-border)")
    expect(circles[1]!.style.marginLeft).toBe(
      "calc(-1 * var(--fc-space-list-row-avatar-overlap))",
    )
  })

  it("defaults to inline layout", () => {
    render(<RiderChips riders={[{ firstName: "Maya", initial: "M" }]} />)

    expect(screen.getByTestId("rider-chips-name")).toHaveTextContent("Maya")
    expect(screen.queryByTestId("rider-chips-avatar-stack")).not.toBeInTheDocument()
  })
})
