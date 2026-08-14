import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import type { CarpoolFeedStatus } from "@/api/types"
import { CarpoolFeedActions } from "@/components/CarpoolFeedActions"
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
})
