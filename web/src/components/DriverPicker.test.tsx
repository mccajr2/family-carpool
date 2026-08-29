import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import type { FamilyMember } from "@/api/types"
import {
  confirmDriverLabel,
  DriverPicker,
  householdDriverChipLabel,
} from "@/components/DriverPicker"

const members: FamilyMember[] = [
  {
    adultId: "a1",
    email: "me@example.com",
    displayName: "Alex",
    role: "ORGANIZER",
  },
  {
    adultId: "a2",
    email: "partner@example.com",
    displayName: "Jordan",
    role: "CAREGIVER",
  },
]

const defaultProps = {
  members,
  currentAdultId: "a1",
  selectedAdultId: "a1",
  onSelectedAdultChange: vi.fn(),
  kidIds: ["k1"],
  onAssignCoverage: vi.fn(),
  onAskTeam: vi.fn(),
}

describe("DriverPicker helpers", () => {
  it("labels current user as You and others by display name", () => {
    expect(householdDriverChipLabel(members[0]!, "a1")).toBe("You")
    expect(householdDriverChipLabel(members[1]!, "a1")).toBe("Jordan")
  })

  it("builds confirm labels for self vs other adult", () => {
    expect(confirmDriverLabel("a1", members, "a1")).toBe("Confirm I'll drive")
    expect(confirmDriverLabel("a2", members, "a1")).toBe("Ask Jordan to drive")
  })
})

describe("DriverPicker", () => {
  it("renders household member chips with You selected by default", () => {
    render(<DriverPicker {...defaultProps} />)

    const youChip = screen.getByRole("button", { name: "You" })
    const jordanChip = screen.getByRole("button", { name: "Jordan" })

    expect(youChip).toHaveAttribute("aria-pressed", "true")
    expect(jordanChip).toHaveAttribute("aria-pressed", "false")
    expect(screen.getByRole("button", { name: "Confirm I'll drive" })).toBeInTheDocument()
  })

  it("updates selection and confirm label when another adult is chosen", async () => {
    const user = userEvent.setup()
    const onSelectedAdultChange = vi.fn()

    render(
      <DriverPicker {...defaultProps} onSelectedAdultChange={onSelectedAdultChange} />,
    )

    await user.click(screen.getByRole("button", { name: "Jordan" }))

    expect(onSelectedAdultChange).toHaveBeenCalledWith("a2")
  })

  it("shows Ask {name} to drive when another adult is selected", () => {
    render(<DriverPicker {...defaultProps} selectedAdultId="a2" />)

    expect(screen.getByRole("button", { name: "Ask Jordan to drive" })).toBeInTheDocument()
  })

  it("calls onAssignCoverage with selected adult and kid subset", async () => {
    const user = userEvent.setup()
    const onAssignCoverage = vi.fn()

    render(
      <DriverPicker
        {...defaultProps}
        selectedAdultId="a2"
        kidIds={["k1", "k2"]}
        onAssignCoverage={onAssignCoverage}
      />,
    )

    await user.click(screen.getByRole("button", { name: "Ask Jordan to drive" }))

    expect(onAssignCoverage).toHaveBeenCalledWith("a2", ["k1", "k2"])
  })

  it("separates the team section from household chips", () => {
    render(<DriverPicker {...defaultProps} />)

    const teamSection = screen.getByTestId("driver-picker-team-section")
    expect(teamSection.className).toMatch(/border-t/)
    expect(screen.getByText("Nobody in the household free?")).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "Ask the team for a ride" }),
    ).toBeInTheDocument()
  })

  it("calls onAskTeam from the team button", async () => {
    const user = userEvent.setup()
    const onAskTeam = vi.fn()

    render(<DriverPicker {...defaultProps} onAskTeam={onAskTeam} />)

    await user.click(screen.getByRole("button", { name: "Ask the team for a ride" }))

    expect(onAskTeam).toHaveBeenCalledOnce()
  })

  it("disables chips and actions while loading", () => {
    render(<DriverPicker {...defaultProps} loading />)

    expect(screen.getByRole("button", { name: "You" })).toBeDisabled()
    expect(screen.getByRole("button", { name: "Jordan" })).toBeDisabled()
    expect(screen.getByRole("button", { name: "Confirm I'll drive" })).toBeDisabled()
    expect(screen.getByRole("button", { name: "Ask the team for a ride" })).toBeDisabled()
  })

  it("disables confirm when kid subset is empty", () => {
    render(<DriverPicker {...defaultProps} kidIds={[]} />)

    expect(screen.getByRole("button", { name: "Confirm I'll drive" })).toBeDisabled()
  })

  it("hides the team section when showTeamSection is false", () => {
    render(<DriverPicker {...defaultProps} showTeamSection={false} />)

    expect(screen.queryByTestId("driver-picker-team-section")).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Ask the team for a ride" })).not.toBeInTheDocument()
  })
})

describe("DriverPicker hero styling", () => {
  it("uses white/ink chips and a white primary confirm on hero glow", () => {
    render(<DriverPicker {...defaultProps} hero />)

    const youChip = screen.getByRole("button", { name: "You" })
    const jordanChip = screen.getByRole("button", { name: "Jordan" })
    expect(youChip).toHaveAttribute("data-selected", "true")
    expect(youChip).toHaveStyle({
      background: "var(--fc-hero-on)",
      color: "var(--fc-text-primary)",
    })
    expect(jordanChip).toHaveAttribute("data-selected", "false")
    expect(jordanChip).toHaveStyle({
      background: "rgba(255, 255, 255, 0.1)",
      color: "var(--fc-hero-on)",
    })

    expect(screen.getByTestId("driver-picker-confirm")).toHaveStyle({
      background: "var(--fc-hero-on)",
      color: "var(--fc-text-primary)",
    })
  })

  it("separates the team ask with a divider and ghost button on hero", () => {
    render(<DriverPicker {...defaultProps} hero />)

    const teamSection = screen.getByTestId("driver-picker-team-section")
    expect(teamSection.className).toMatch(/border-t/)
    expect(teamSection.className).toMatch(/mt-5/)
    expect(teamSection).toHaveStyle({ borderColor: "rgba(255, 255, 255, 0.14)" })
    expect(screen.getByTestId("driver-picker-team-ask")).toHaveStyle({
      background: "var(--fc-hero-decline-bg)",
      color: "var(--fc-hero-on)",
    })
  })

  it("disables hero actions while loading", () => {
    render(<DriverPicker {...defaultProps} hero loading />)

    expect(screen.getByRole("button", { name: "You" })).toBeDisabled()
    expect(screen.getByTestId("driver-picker-confirm")).toBeDisabled()
    expect(screen.getByTestId("driver-picker-team-ask")).toBeDisabled()
  })
})
