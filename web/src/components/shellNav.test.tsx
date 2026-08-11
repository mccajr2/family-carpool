import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import {
  AccountSummaryRow,
  SettingsGroupLabel,
  SettingsRow,
  ShellNavButton,
} from "@/components/shellNav"
import { resolveSemanticIcon, semanticIcons } from "@/components/uiIcons"

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

  it("uses semantic icons and token classes on settings rows", async () => {
    const user = userEvent.setup()
    const onPlaces = vi.fn()
    const onSignOut = vi.fn()
    const { container } = render(
      <section className="fc-more">
        <SettingsGroupLabel>Settings</SettingsGroupLabel>
        <SettingsRow label="Places" icon="icon.places" onClick={onPlaces} />
        <SettingsRow
          label="Sign out"
          icon="icon.signout"
          onClick={onSignOut}
          chevron={false}
          danger
        />
      </section>,
    )
    expect(screen.getByText("Settings")).toBeInTheDocument()
    expect(container.querySelector(".fc-more")).not.toBeNull()
    expect(container.querySelectorAll("svg").length).toBeGreaterThan(2)
    const places = screen.getByRole("button", { name: "Places" })
    expect(places.className).toMatch(/--fc-/)
    await user.click(places)
    expect(onPlaces).toHaveBeenCalled()
    const signOut = screen.getByRole("button", { name: "Sign out" })
    expect(signOut.className).toMatch(/--fc-danger/)
    await user.click(signOut)
    expect(onSignOut).toHaveBeenCalled()
  })

  it("renders account email and role without a button", () => {
    render(
      <AccountSummaryRow
        email="parent@example.com"
        role="ORGANIZER"
        icon="icon.family"
      />,
    )
    expect(screen.getByText("parent@example.com")).toBeInTheDocument()
    expect(screen.getByText("ORGANIZER")).toBeInTheDocument()
    expect(screen.queryByRole("button")).not.toBeInTheDocument()
  })
})

describe("uiIcons", () => {
  it("maps required semantic names to Lucide icons", () => {
    expect(semanticIcons["icon.places"]).toBeTruthy()
    expect(semanticIcons["icon.feeds"]).toBeTruthy()
    expect(semanticIcons["icon.signout"]).toBeTruthy()
    expect(resolveSemanticIcon("icon.chevron")).toBe(
      semanticIcons["icon.chevron"],
    )
  })
})
