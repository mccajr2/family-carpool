import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { LogOut, MapPin } from "lucide-react"
import { describe, expect, it, vi } from "vitest"

import { AccountSummaryRow, SettingsRow, ShellNavButton } from "@/components/shellNav"

describe("shellNav", () => {
  it("marks the active destination with aria-current", () => {
    render(
      <>
        <ShellNavButton label="Calendar" active onClick={() => undefined} />
        <ShellNavButton label="Carpool" active={false} onClick={() => undefined} />
      </>,
    )
    expect(screen.getByRole("button", { name: "Calendar" })).toHaveAttribute(
      "aria-current",
      "page",
    )
    expect(screen.getByRole("button", { name: "Carpool" })).not.toHaveAttribute(
      "aria-current",
    )
  })

  it("shows a chevron on navigable settings rows and not on sign out", async () => {
    const user = userEvent.setup()
    const onPlaces = vi.fn()
    const onSignOut = vi.fn()
    const { container } = render(
      <>
        <SettingsRow label="Places" icon={MapPin} onClick={onPlaces} />
        <SettingsRow
          label="Sign out"
          icon={LogOut}
          onClick={onSignOut}
          chevron={false}
          danger
        />
      </>,
    )
    expect(container.querySelectorAll("svg").length).toBeGreaterThan(2)
    await user.click(screen.getByRole("button", { name: "Places" }))
    expect(onPlaces).toHaveBeenCalled()
    const signOut = screen.getByRole("button", { name: "Sign out" })
    expect(signOut.className).toMatch(/text-destructive/)
    await user.click(signOut)
    expect(onSignOut).toHaveBeenCalled()
  })

  it("renders account email and role without a button", () => {
    render(
      <AccountSummaryRow email="parent@example.com" role="ORGANIZER" icon={LogOut} />,
    )
    expect(screen.getByText("parent@example.com")).toBeInTheDocument()
    expect(screen.getByText("ORGANIZER")).toBeInTheDocument()
    expect(screen.queryByRole("button")).not.toBeInTheDocument()
  })
})
