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
  it("marks the active destination with aria-current and a quiet rail fill", () => {
    render(
      <>
        <ShellNavButton
          label="Calendar"
          icon="icon.calendar"
          active
          onClick={() => undefined}
        />
        <ShellNavButton
          label="Carpool"
          icon="icon.carpool"
          active={false}
          onClick={() => undefined}
        />
      </>,
    )
    const calendar = screen.getByRole("button", { name: "Calendar" })
    expect(calendar).toHaveAttribute("aria-current", "page")
    expect(calendar.className).toMatch(/--fc-rail-active/)
    expect(calendar.className).not.toMatch(/--fc-accent/)
    expect(calendar.className).not.toMatch(/--fc-hero-/)
    expect(calendar.querySelector("svg")).not.toBeNull()
    const carpool = screen.getByRole("button", { name: "Carpool" })
    expect(carpool).not.toHaveAttribute("aria-current")
    expect(carpool.className).toMatch(/--fc-rail-on/)
    expect(carpool.querySelector("svg")?.getAttribute("class") ?? "").toMatch(
      /--fc-rail-accent/,
    )
  })

  it("uses icon+label settings rows without chips or chevrons", async () => {
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
          danger
        />
      </section>,
    )
    expect(screen.getByText("Settings").className).toMatch(/--fc-rail-on-secondary/)
    expect(container.querySelector(".fc-more")).not.toBeNull()
    const places = screen.getByRole("button", { name: "Places" })
    expect(places.className).toMatch(/--fc-rail-on/)
    expect(places.className).not.toMatch(/--fc-accent/)
    expect(places.querySelectorAll("svg")).toHaveLength(1)
    await user.click(places)
    expect(onPlaces).toHaveBeenCalled()
    const signOut = screen.getByRole("button", { name: "Sign out" })
    expect(signOut.className).toMatch(/--fc-rail-danger/)
    expect(signOut.className).not.toMatch(/--fc-danger[^-]/)
    expect(signOut.querySelectorAll("svg")).toHaveLength(1)
    await user.click(signOut)
    expect(onSignOut).toHaveBeenCalled()
  })

  it("marks an active settings row with a quiet rail fill, not an accent pill", () => {
    render(
      <SettingsRow
        label="Garage"
        icon="icon.garage"
        active
        onClick={() => undefined}
      />,
    )
    const garage = screen.getByRole("button", { name: "Garage" })
    expect(garage).toHaveAttribute("aria-current", "page")
    expect(garage.className).toMatch(/--fc-rail-active/)
    expect(garage.className).not.toMatch(/--fc-accent/)
    expect(garage.className).not.toMatch(/--fc-hero-/)
  })

  it("renders initials, truncated email, and a humanized role without a button", () => {
    render(
      <AccountSummaryRow
        email="parent@example.com"
        role="ORGANIZER"
        displayName="Alex Rivera"
      />,
    )
    expect(screen.getByText("AR")).toBeInTheDocument()
    expect(screen.getByText("parent@example.com")).toBeInTheDocument()
    expect(screen.getByText("Organizer")).toBeInTheDocument()
    expect(screen.queryByText("ORGANIZER")).not.toBeInTheDocument()
    expect(screen.queryByRole("button")).not.toBeInTheDocument()
  })

  it("falls back to the email local-part for initials when display name is missing", () => {
    render(<AccountSummaryRow email="parent@example.com" role="CAREGIVER" />)
    expect(screen.getByText("P")).toBeInTheDocument()
    expect(screen.getByText("Caregiver")).toBeInTheDocument()
  })
})

describe("uiIcons", () => {
  it("maps required semantic names to Lucide icons", () => {
    expect(semanticIcons["icon.places"]).toBeTruthy()
    expect(semanticIcons["icon.garage"]).toBeTruthy()
    expect(semanticIcons["icon.feeds"]).toBeTruthy()
    expect(semanticIcons["icon.signout"]).toBeTruthy()
    expect(resolveSemanticIcon("icon.chevron")).toBe(
      semanticIcons["icon.chevron"],
    )
  })
})
