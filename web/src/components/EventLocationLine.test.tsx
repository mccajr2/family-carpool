import { describe, expect, it, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import { EventLocationLine } from "@/components/EventLocationLine"

describe("EventLocationLine", () => {
  it("renders map-pin location with locationLine type", () => {
    render(<EventLocationLine location="Riverside Rink" />)
    const line = screen.getByTestId("event-location-line")
    expect(line).toHaveTextContent("Riverside Rink")
    expect(line.className).toMatch(/fc-font-location-line-size/)
    expect(line).toHaveAttribute("data-location-variant", "pin")
  })

  it("renders nothing when location is blank", () => {
    const { container } = render(<EventLocationLine location="  " />)
    expect(container).toBeEmptyDOMElement()
  })

  it("route variant calls onClick without relying on a parent control", async () => {
    const user = userEvent.setup()
    const onClick = vi.fn()
    render(
      <button type="button" onClick={vi.fn()}>
        <EventLocationLine
          location="2 stops"
          variant="route"
          onClick={onClick}
        />
      </button>,
    )
    const line = screen.getByTestId("event-location-line")
    expect(line).toHaveAttribute("data-location-variant", "route")
    await user.click(line)
    expect(onClick).toHaveBeenCalledTimes(1)
  })
})
