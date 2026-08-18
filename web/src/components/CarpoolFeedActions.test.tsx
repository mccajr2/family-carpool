import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import type { CarpoolFeedStatus } from "@/api/types"
import { CarpoolFeedActions, CarpoolFeedStatusChip } from "@/components/CarpoolFeedActions"
import { enableCarpoolConfirmMessage } from "@/components/carpoolDisplay"

const noneFeed: CarpoolFeedStatus = {
  feedId: "f1",
  feedName: "Soccer",
  status: "NONE",
  spaceId: null,
  spaceName: null,
}

describe("CarpoolFeedActions", () => {
  it("shows Enable for Organizer when no space exists, after confirm", async () => {
    const user = userEvent.setup()
    const onEnable = vi.fn()
    vi.spyOn(window, "confirm").mockReturnValue(true)

    render(
      <CarpoolFeedActions
        feed={noneFeed}
        circleRole="ORGANIZER"
        onEnable={onEnable}
        onRequest={vi.fn()}
        onOpen={vi.fn()}
      />,
    )

    expect(screen.getByText("No carpool")).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Enable" }))
    expect(window.confirm).toHaveBeenCalledWith(enableCarpoolConfirmMessage("Soccer"))
    expect(onEnable).toHaveBeenCalledWith("f1")
  })

  it("hides Enable for Caregivers", () => {
    render(
      <CarpoolFeedActions
        feed={noneFeed}
        circleRole="CAREGIVER"
        onEnable={vi.fn()}
        onRequest={vi.fn()}
        onOpen={vi.fn()}
      />,
    )

    expect(screen.getByText("No carpool")).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Enable" })).not.toBeInTheDocument()
  })

  it("shows Request when a space is available", async () => {
    const user = userEvent.setup()
    const onRequest = vi.fn()

    render(
      <CarpoolFeedActions
        feed={{
          feedId: "f1",
          feedName: "Soccer",
          status: "AVAILABLE",
          spaceId: "s1",
          spaceName: "Soccer",
        }}
        circleRole="CAREGIVER"
        onEnable={vi.fn()}
        onRequest={onRequest}
        onOpen={vi.fn()}
      />,
    )

    await user.click(screen.getByRole("button", { name: "Request" }))
    expect(onRequest).toHaveBeenCalledWith("s1")
    expect(screen.queryByRole("button", { name: "Enable" })).not.toBeInTheDocument()
  })

  it("shows Requested with no primary CTA", () => {
    render(
      <CarpoolFeedActions
        feed={{
          feedId: "f1",
          feedName: "Soccer",
          status: "REQUESTED",
          spaceId: "s1",
          spaceName: "Soccer",
        }}
        circleRole="ORGANIZER"
        onEnable={vi.fn()}
        onRequest={vi.fn()}
        onOpen={vi.fn()}
      />,
    )

    expect(screen.getByText("Requested")).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Enable" })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Request" })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Open" })).not.toBeInTheDocument()
  })

  it("shows Open for members in the default layout, not Open carpool", async () => {
    const user = userEvent.setup()
    const onOpen = vi.fn()
    render(
      <CarpoolFeedActions
        feed={{
          feedId: "f1",
          feedName: "Soccer",
          status: "OWNER",
          spaceId: "s1",
          spaceName: "Soccer",
        }}
        circleRole="ORGANIZER"
        onEnable={vi.fn()}
        onRequest={vi.fn()}
        onOpen={onOpen}
      />,
    )

    expect(screen.getByText("Owned")).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: /^Open$/ }))
    expect(onOpen).toHaveBeenCalledWith("s1")
    expect(screen.queryByRole("button", { name: "Open carpool" })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Enable carpool" })).not.toBeInTheDocument()
  })

  it("uses Enable carpool / Open carpool and a chip in the Feeds layout", async () => {
    const user = userEvent.setup()
    const onEnable = vi.fn()
    const onOpen = vi.fn()
    vi.spyOn(window, "confirm").mockReturnValue(true)

    const { rerender } = render(
      <CarpoolFeedActions
        layout="feeds"
        feed={noneFeed}
        circleRole="ORGANIZER"
        onEnable={onEnable}
        onRequest={vi.fn()}
        onOpen={onOpen}
      />,
    )

    expect(screen.queryByText("No carpool")).not.toBeInTheDocument()
    const enable = screen.getByRole("button", { name: "Enable carpool" })
    expect(enable.className).toMatch(/--fc-font-feed-action-size/)
    expect(enable.className).toMatch(/--fc-accent/)
    await user.click(enable)
    expect(onEnable).toHaveBeenCalledWith("f1")

    rerender(
      <CarpoolFeedActions
        layout="feeds"
        feed={{
          feedId: "f1",
          feedName: "Soccer",
          status: "OWNER",
          spaceId: "s1",
          spaceName: "Soccer",
        }}
        circleRole="ORGANIZER"
        onEnable={onEnable}
        onRequest={vi.fn()}
        onOpen={onOpen}
      />,
    )
    const open = screen.getByRole("button", { name: "Open carpool" })
    expect(open.className).toMatch(/--fc-font-feed-action-size/)
    await user.click(open)
    expect(onOpen).toHaveBeenCalledWith("s1")
    expect(screen.queryByRole("button", { name: /^Enable$/ })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /^Open$/ })).not.toBeInTheDocument()
  })
})

describe("CarpoolFeedStatusChip", () => {
  it("renders Owned and No carpool with feed-chip tokens and uppercase", () => {
    const { rerender } = render(<CarpoolFeedStatusChip status="OWNER" />)
    let chip = screen.getByText("Owned")
    expect(chip.className).toMatch(/uppercase/)
    expect(chip.className).toMatch(/--fc-font-feed-chip-size/)
    expect(chip.className).toMatch(/--fc-space-feed-chip-pad-x/)
    expect(chip.className).toMatch(/--fc-success/)

    rerender(<CarpoolFeedStatusChip status="NONE" />)
    chip = screen.getByText("No carpool")
    expect(chip.className).toMatch(/uppercase/)
    expect(chip.className).toMatch(/--fc-text-secondary/)
  })
})
