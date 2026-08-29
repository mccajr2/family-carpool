import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { AgendaStatusChip } from "@/components/agendaStatusChip"

describe("AgendaStatusChip", () => {
  it("renders tag chips with feedChip tokens, uppercase, and no leading dot", () => {
    render(<AgendaStatusChip label="Needs coverage" tone="amber" />)
    const chip = screen.getByText("Needs coverage")
    expect(chip.className).toMatch(/uppercase/)
    expect(chip.className).toMatch(/--fc-font-feed-chip-size/)
    expect(chip.className).toMatch(/--fc-font-feed-chip-weight/)
    expect(chip.className).toMatch(/--fc-space-feed-chip-pad-x/)
    expect(chip.className).toMatch(/--fc-space-feed-chip-pad-y/)
    expect(chip.className).not.toMatch(/--fc-font-status-chip-size/)
    expect(screen.queryByTestId("agenda-status-pill-dot")).not.toBeInTheDocument()
  })

  it("keeps hero tone fills on tag chips", () => {
    render(
      <AgendaStatusChip label="Needs coverage" tone="amber" variant="hero" />,
    )
    const chip = screen.getByText("Needs coverage")
    expect(chip.className).toMatch(/--fc-hero-danger/)
    expect(chip.className).toMatch(/uppercase/)
    expect(chip.className).toMatch(/--fc-font-feed-chip-size/)
    expect(screen.queryByTestId("agenda-status-pill-dot")).not.toBeInTheDocument()
  })

  it("uses hero accent fill for route tone on Focus chips", () => {
    render(
      <AgendaStatusChip label="You're driving · +1" tone="route" variant="hero" />,
    )
    const chip = screen.getByText("You're driving · +1")
    expect(chip.className).toMatch(/--fc-hero-accent/)
    expect(chip.className).toMatch(/uppercase/)
  })

  it("still supports retired pill appearance for migration", () => {
    render(<AgendaStatusChip label="Confirmed" tone="mint" appearance="pill" />)
    const chip = screen.getByText("Confirmed")
    expect(chip.className).not.toMatch(/uppercase/)
    expect(chip.className).toMatch(/--fc-font-focus-status-pill-size/)
    expect(chip.querySelector("[data-testid='agenda-status-pill-dot']")).not.toBeNull()
  })
})
