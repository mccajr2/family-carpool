import { describe, expect, it } from "vitest"
import { render, screen } from "@testing-library/react"

import { EventLocationLine } from "@/components/EventLocationLine"

describe("EventLocationLine", () => {
  it("renders map-pin location with locationLine type", () => {
    render(<EventLocationLine location="Riverside Rink" />)
    const line = screen.getByTestId("event-location-line")
    expect(line).toHaveTextContent("Riverside Rink")
    expect(line.className).toMatch(/fc-font-location-line-size/)
  })

  it("renders nothing when location is blank", () => {
    const { container } = render(<EventLocationLine location="  " />)
    expect(container).toBeEmptyDOMElement()
  })
})
