import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import { RideDetailScreen } from "@/components/RideDetailScreen"

describe("RideDetailScreen", () => {
  it("renders back, when, title, and Route body without Playlist tab chrome", () => {
    render(
      <RideDetailScreen
        title="vs Belmont"
        whenLabel="Fri, Aug 28 · 5:20 – 6:20 PM"
        onBack={vi.fn()}
        routePanel={<div>Route body</div>}
      />,
    )

    expect(screen.getByTestId("ride-detail-screen")).toBeInTheDocument()
    expect(screen.getByTestId("ride-detail-back")).toHaveTextContent("Back to schedule")
    expect(screen.getByTestId("ride-detail-when")).toHaveTextContent(
      "Fri, Aug 28 · 5:20 – 6:20 PM",
    )
    expect(screen.getByTestId("ride-detail-title")).toHaveTextContent("vs Belmont")
    expect(screen.getByTestId("ride-detail-title").className).toMatch(
      /--fc-font-ride-detail-title-size/,
    )
    expect(screen.getByTestId("ride-detail-panel-route")).toHaveTextContent("Route body")
    expect(screen.queryByRole("tablist")).not.toBeInTheDocument()
    expect(screen.queryByTestId("ride-detail-tabs")).not.toBeInTheDocument()
    expect(screen.queryByTestId("ride-detail-tab-route")).not.toBeInTheDocument()
    expect(screen.queryByTestId("ride-detail-tab-playlist")).not.toBeInTheDocument()
    expect(screen.queryByTestId("ride-detail-panel-playlist")).not.toBeInTheDocument()
  })

  it("calls onBack from Back to schedule", async () => {
    const user = userEvent.setup()
    const onBack = vi.fn()
    render(
      <RideDetailScreen
        title="Practice"
        whenLabel="Wed · 5:00 PM"
        onBack={onBack}
      />,
    )
    await user.click(screen.getByTestId("ride-detail-back"))
    expect(onBack).toHaveBeenCalledTimes(1)
  })
})
