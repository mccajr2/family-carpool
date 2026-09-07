import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import { RideDetailScreen } from "@/components/RideDetailScreen"

describe("RideDetailScreen", () => {
  it("renders back, when, title, and Route selected by default", () => {
    render(
      <RideDetailScreen
        title="vs Belmont"
        whenLabel="Fri, Aug 28 · 5:20 – 6:20 PM"
        tab="route"
        onTabChange={vi.fn()}
        onBack={vi.fn()}
        routePanel={<div>Route body</div>}
        playlistPanel={<div>Playlist body</div>}
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
    expect(screen.getByTestId("ride-detail-tab-route")).toHaveAttribute(
      "aria-selected",
      "true",
    )
    expect(screen.getByTestId("ride-detail-tab-playlist")).toHaveAttribute(
      "aria-selected",
      "false",
    )
    expect(screen.getByTestId("ride-detail-panel-route")).toHaveTextContent("Route body")
    expect(screen.queryByText("Playlist body")).not.toBeInTheDocument()
  })

  it("switches tabs while keeping the open event header", async () => {
    const user = userEvent.setup()
    const onTabChange = vi.fn()
    const { rerender } = render(
      <RideDetailScreen
        title="vs Belmont"
        whenLabel="Fri, Aug 28 · 5:20 – 6:20 PM"
        tab="route"
        onTabChange={onTabChange}
        onBack={vi.fn()}
        routePanel={<div>Route body</div>}
        playlistPanel={<div>Playlist body</div>}
      />,
    )

    await user.click(screen.getByTestId("ride-detail-tab-playlist"))
    expect(onTabChange).toHaveBeenCalledWith("playlist")

    rerender(
      <RideDetailScreen
        title="vs Belmont"
        whenLabel="Fri, Aug 28 · 5:20 – 6:20 PM"
        tab="playlist"
        onTabChange={onTabChange}
        onBack={vi.fn()}
        routePanel={<div>Route body</div>}
        playlistPanel={<div>Playlist body</div>}
      />,
    )

    expect(screen.getByTestId("ride-detail-title")).toHaveTextContent("vs Belmont")
    expect(screen.getByTestId("ride-detail-tab-playlist")).toHaveAttribute(
      "aria-selected",
      "true",
    )
    expect(screen.getByTestId("ride-detail-panel-playlist")).toHaveTextContent(
      "Playlist body",
    )
  })

  it("calls onBack from Back to schedule", async () => {
    const user = userEvent.setup()
    const onBack = vi.fn()
    render(
      <RideDetailScreen
        title="Practice"
        whenLabel="Wed · 5:00 PM"
        tab="route"
        onTabChange={vi.fn()}
        onBack={onBack}
      />,
    )
    await user.click(screen.getByTestId("ride-detail-back"))
    expect(onBack).toHaveBeenCalledTimes(1)
  })
})
