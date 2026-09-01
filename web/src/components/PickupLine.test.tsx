import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { PickupLine } from "@/components/PickupLine"

describe("PickupLine", () => {
  it("renders nothing when pickupTown is null", () => {
    const { container } = render(
      <PickupLine pickupTown={null} detourMinutes={12} />,
    )

    expect(container).toBeEmptyDOMElement()
  })

  it("renders town only when detourMinutes is null", () => {
    render(<PickupLine pickupTown="Cambridge, MA" detourMinutes={null} />)

    const line = screen.getByTestId("pickup-line")
    expect(line).toHaveTextContent("Pickup in Cambridge, MA")
    expect(line).not.toHaveTextContent("min out of your way")
    expect(line.style.color).toBe("var(--fc-text-secondary)")
    expect(line.querySelector("svg")?.getAttribute("style")).toContain(
      "var(--fc-text-secondary)",
    )
  })

  it("renders town and tone-colored detour copy when minutes are present", () => {
    render(<PickupLine pickupTown="Cambridge, MA" detourMinutes={4} />)

    const line = screen.getByTestId("pickup-line")
    expect(line).toHaveTextContent(
      "Pickup in Cambridge, MA · ~4 min out of your way (On your way)",
    )
    expect(line.querySelector("svg")?.getAttribute("style")).toContain(
      "var(--fc-detour-on-way)",
    )
    expect(line).toHaveTextContent("On your way")
  })

  it("uses moderate and far tone labels at boundaries", () => {
    const { rerender } = render(
      <PickupLine pickupTown="Somerville, MA" detourMinutes={11} />,
    )
    expect(screen.getByTestId("pickup-line")).toHaveTextContent(
      "· ~11 min out of your way (Bit of a detour)",
    )

    rerender(<PickupLine pickupTown="Worcester, MA" detourMinutes={21} />)
    expect(screen.getByTestId("pickup-line")).toHaveTextContent(
      "· ~21 min out of your way (Far out of the way)",
    )
  })

  it("uses hero on-secondary base text on hero slides", () => {
    render(
      <PickupLine
        pickupTown="Medford, MA"
        detourMinutes={null}
        variant="hero"
      />,
    )

    expect(screen.getByTestId("pickup-line").style.color).toBe(
      "var(--fc-hero-on-secondary)",
    )
  })
})
