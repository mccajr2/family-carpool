import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import { AttendanceToggle } from "@/components/AttendanceToggle"

describe("AttendanceToggle", () => {
  it("shows Mark {name} as not going when going and writes not_going", async () => {
    const user = userEvent.setup()
    const onSetAttendance = vi.fn()
    render(
      <AttendanceToggle
        displayName="Sam"
        attendance="going"
        onSetAttendance={onSetAttendance}
        data-testid="rsvp-MANUAL-e1-k1"
      />,
    )

    const control = screen.getByTestId("rsvp-MANUAL-e1-k1")
    expect(control).toHaveAttribute("data-attendance", "going")
    expect(control).toHaveTextContent("Mark Sam as not going")
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument()
    expect(screen.queryByText(/Yes|No response/)).not.toBeInTheDocument()

    await user.click(control)
    expect(onSetAttendance).toHaveBeenCalledWith("not_going")
  })

  it("shows marked-not-going copy and Mark as going again when not going", async () => {
    const user = userEvent.setup()
    const onSetAttendance = vi.fn()
    render(
      <AttendanceToggle
        displayName="Sam"
        attendance="not_going"
        onSetAttendance={onSetAttendance}
        data-testid="rsvp-MANUAL-e1-k1"
      />,
    )

    const control = screen.getByTestId("rsvp-MANUAL-e1-k1")
    expect(control).toHaveAttribute("data-attendance", "not_going")
    expect(control).toHaveTextContent("Sam is marked not going.")
    expect(
      screen.getByRole("button", { name: "Mark as going again" }),
    ).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Mark as going again" }))
    expect(onSetAttendance).toHaveBeenCalledWith("going")
  })
})
