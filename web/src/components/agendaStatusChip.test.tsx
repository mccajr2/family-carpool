import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { AgendaStatusChip } from "@/components/agendaStatusChip"

describe("AgendaStatusChip", () => {
  it("renders collapsed-row tags in uppercase without a leading dot", () => {
    render(<AgendaStatusChip label="Needs coverage" tone="amber" />)
    const chip = screen.getByText("Needs coverage")
    expect(chip.className).toMatch(/uppercase/)
    expect(chip.className).toMatch(/--fc-font-status-chip-size/)
    expect(screen.queryByTestId("agenda-status-pill-dot")).not.toBeInTheDocument()
  })

  it("renders default-variant pills in Title Case with a leading dot", () => {
    render(<AgendaStatusChip label="Confirmed" tone="mint" appearance="pill" />)
    const chip = screen.getByText("Confirmed")
    expect(chip.className).not.toMatch(/uppercase/)
    expect(chip.className).toMatch(/--fc-font-focus-status-pill-size/)
    expect(chip.querySelector("[data-testid='agenda-status-pill-dot']")).not.toBeNull()
  })

  it("renders Focus pills in Title Case with a leading dot", () => {
    render(
      <AgendaStatusChip label="Needs coverage" tone="amber" variant="hero" appearance="pill" />,
    )
    const chip = screen.getByText("Needs coverage")
    expect(chip.className).not.toMatch(/uppercase/)
    expect(chip.className).toMatch(/--fc-font-focus-status-pill-size/)
    expect(chip.className).toMatch(/--fc-font-focus-status-pill-weight/)
    expect(chip.querySelector("[data-testid='agenda-status-pill-dot']")).not.toBeNull()
  })
})
