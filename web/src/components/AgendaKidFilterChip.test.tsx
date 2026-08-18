import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import { AgendaKidFilterChip } from "@/components/AgendaKidFilterChip"

describe("AgendaKidFilterChip", () => {
  it("uses filter-chip tokens and selected ink fill when pressed", () => {
    render(<AgendaKidFilterChip label="Sam" selected onClick={vi.fn()} />)
    const chip = screen.getByRole("button", { name: "Sam" })
    expect(chip).toHaveAttribute("aria-pressed", "true")
    expect(chip.className).toMatch(/--fc-font-filter-chip-size/)
    expect(chip.className).toMatch(/--fc-space-filter-chip-pad-x/)
    expect(chip.className).toMatch(/bg-\[var\(--fc-text-primary\)\]/)
    expect(chip.className).toMatch(/text-\[var\(--fc-accent-on\)\]/)
  })

  it("uses quiet raised surface when unselected", () => {
    render(<AgendaKidFilterChip label="All kids" selected={false} onClick={vi.fn()} />)
    const chip = screen.getByRole("button", { name: "All kids" })
    expect(chip).toHaveAttribute("aria-pressed", "false")
    expect(chip.className).toMatch(/bg-\[var\(--fc-surface-raised\)\]/)
    expect(chip.className).toMatch(/text-\[var\(--fc-text-secondary\)\]/)
  })

  it("calls onClick when enabled", async () => {
    const user = userEvent.setup()
    const onClick = vi.fn()
    render(<AgendaKidFilterChip label="Riley" selected={false} onClick={onClick} />)
    await user.click(screen.getByRole("button", { name: "Riley" }))
    expect(onClick).toHaveBeenCalledOnce()
  })
})
