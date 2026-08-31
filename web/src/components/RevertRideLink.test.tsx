import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import { RevertRideLink } from "@/components/RevertRideLink"

describe("RevertRideLink", () => {
  it("renders You confirmed copy and calls onCantMakeIt with no dialog", async () => {
    const user = userEvent.setup()
    const onCantMakeIt = vi.fn()

    render(
      <RevertRideLink
        ownRide={{ driver: "You", confirmed: true }}
        onCantMakeIt={onCantMakeIt}
      />,
    )

    const link = screen.getByRole("button", {
      name: "Can't drive anymore? Reassign the ride",
    })
    expect(link.className).toMatch(/underline/)
    expect(link.className).toMatch(/underline-offset-2/)
    expect(link.className).toMatch(/text-xs/)
    expect(link.className).toMatch(/--fc-text-secondary/)

    await user.click(link)

    expect(onCantMakeIt).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  })

  it("renders other household and teammate variants", () => {
    const { rerender } = render(
      <RevertRideLink
        ownRide={{ driver: "Jordan", confirmed: true }}
        onCantMakeIt={vi.fn()}
      />,
    )
    expect(
      screen.getByRole("button", {
        name: "Jordan can't drive anymore? Reassign the ride",
      }),
    ).toBeInTheDocument()

    rerender(
      <RevertRideLink
        ownRide={{ driver: "the Nguyens", confirmed: true }}
        teammateRide
        onCantMakeIt={vi.fn()}
      />,
    )
    expect(
      screen.getByRole("button", {
        name: "the Nguyens can't drive anymore? Find a new ride",
      }),
    ).toBeInTheDocument()

    rerender(
      <RevertRideLink ownRide="requested" onCantMakeIt={vi.fn()} />,
    )
    expect(
      screen.getByRole("button", {
        name: "No longer need a ride? Cancel this ask",
      }),
    ).toBeInTheDocument()
  })

  it("renders nothing for unresolved ownRide (DriverPicker territory)", () => {
    const { container, rerender } = render(
      <RevertRideLink ownRide="unassigned" onCantMakeIt={vi.fn()} />,
    )
    expect(container).toBeEmptyDOMElement()

    rerender(
      <RevertRideLink
        ownRide={{ driver: "You", confirmed: false }}
        onCantMakeIt={vi.fn()}
      />,
    )
    expect(container).toBeEmptyDOMElement()
  })

  it("does not fire when disabled", async () => {
    const user = userEvent.setup()
    const onCantMakeIt = vi.fn()

    render(
      <RevertRideLink
        ownRide={{ driver: "You", confirmed: true }}
        onCantMakeIt={onCantMakeIt}
        disabled
      />,
    )

    await user.click(
      screen.getByRole("button", {
        name: "Can't drive anymore? Reassign the ride",
      }),
    )
    expect(onCantMakeIt).not.toHaveBeenCalled()
  })
})
