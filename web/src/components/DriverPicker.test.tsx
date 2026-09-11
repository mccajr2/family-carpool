import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import type { FamilyMember } from "@/api/types"
import {
  ASK_THE_TEAM,
  DIFFERENT_PLANS_FOR_EACH_LEG,
  LEAVE_FROM_ADDRESS_PLACEHOLDER,
  POST_TO_TEAM_ROUND_TRIP,
} from "@/components/coverageCopy"
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
    expect(confirmDriverLabel("a1", members, "a1")).toBe(
      `Confirm — You'll drive round trip from ${LEAVE_FROM_ADDRESS_PLACEHOLDER}`,
    )
    expect(confirmDriverLabel("a2", members, "a1")).toBe(
      `Confirm — Jordan'll drive round trip from ${LEAVE_FROM_ADDRESS_PLACEHOLDER}`,
    )
    expect(confirmDriverLabel("a1", members, "a1", "Home")).toBe(
      "Confirm — You'll drive round trip from Home",
    )
    expect(confirmDriverLabel("a2", members, "a1", "Work")).toBe(
      "Confirm — Jordan'll drive round trip from Work",
    )
  })
})

describe("DriverPicker", () => {
  it("renders household member chips with You selected by default", () => {
    render(<DriverPicker {...defaultProps} leaveFromLabel="Home" />)

    const youChip = screen.getByRole("button", { name: "You" })
    const jordanChip = screen.getByRole("button", { name: "Jordan" })

    expect(youChip).toHaveAttribute("aria-pressed", "true")
    expect(jordanChip).toHaveAttribute("aria-pressed", "false")
    expect(
      screen.getByRole("button", { name: "Confirm — You'll drive round trip from Home" }),
    ).toBeInTheDocument()
  })

  it("updates selection when another adult is chosen", async () => {
    const user = userEvent.setup()
    const onSelectedAdultChange = vi.fn()

    render(
      <DriverPicker {...defaultProps} onSelectedAdultChange={onSelectedAdultChange} />,
    )

    await user.click(screen.getByRole("button", { name: "Jordan" }))

    expect(onSelectedAdultChange).toHaveBeenCalledWith("a2")
  })

  it("shows other-adult Confirm label when another adult is selected", () => {
    render(<DriverPicker {...defaultProps} selectedAdultId="a2" leaveFromLabel="Home" />)

    expect(
      screen.getByRole("button", {
        name: "Confirm — Jordan'll drive round trip from Home",
      }),
    ).toBeInTheDocument()
  })

  it("calls onAssignCoverage with selected adult and kid subset", async () => {
    const user = userEvent.setup()
    const onAssignCoverage = vi.fn()

    render(
      <DriverPicker
        {...defaultProps}
        selectedAdultId="a2"
        kidIds={["k1", "k2"]}
        leaveFromLabel="Home"
        onAssignCoverage={onAssignCoverage}
      />,
    )

    await user.click(
      screen.getByRole("button", {
        name: "Confirm — Jordan'll drive round trip from Home",
      }),
    )

    expect(onAssignCoverage).toHaveBeenCalledWith("a2", ["k1", "k2"])
  })

  it("puts Ask the team as a trailing chip in the driver row", () => {
    render(<DriverPicker {...defaultProps} leaveFromLabel="Home" />)

    const group = screen.getByRole("group", { name: "Household driver" })
    expect(group).toContainElement(screen.getByRole("button", { name: "You" }))
    expect(group).toContainElement(screen.getByRole("button", { name: ASK_THE_TEAM }))
    expect(screen.getByTestId("driver-picker-ask-team-chip")).toHaveAttribute(
      "aria-pressed",
      "false",
    )
    expect(screen.queryByTestId("driver-picker-team-section")).not.toBeInTheDocument()
    expect(screen.queryByText("Nobody in the household free?")).not.toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: "Ask the team for a ride" }),
    ).not.toBeInTheDocument()
  })

  it("switches primary to Post and calls onAskTeam when Ask the team is selected", async () => {
    const user = userEvent.setup()
    const onAskTeam = vi.fn()
    const onAssignCoverage = vi.fn()

    render(
      <DriverPicker
        {...defaultProps}
        leaveFromLabel="Home"
        onAskTeam={onAskTeam}
        onAssignCoverage={onAssignCoverage}
      />,
    )

    await user.click(screen.getByRole("button", { name: ASK_THE_TEAM }))

    expect(screen.getByRole("button", { name: "You" })).toHaveAttribute(
      "aria-pressed",
      "false",
    )
    expect(screen.getByTestId("driver-picker-ask-team-chip")).toHaveAttribute(
      "aria-pressed",
      "true",
    )
    expect(screen.getByRole("button", { name: POST_TO_TEAM_ROUND_TRIP })).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: POST_TO_TEAM_ROUND_TRIP }))

    expect(onAskTeam).toHaveBeenCalledOnce()
    expect(onAssignCoverage).not.toHaveBeenCalled()
  })

  it("returns to household Confirm after selecting an adult from Ask the team", async () => {
    const user = userEvent.setup()
    const onSelectedAdultChange = vi.fn()

    render(
      <DriverPicker
        {...defaultProps}
        leaveFromLabel="Home"
        onSelectedAdultChange={onSelectedAdultChange}
      />,
    )

    await user.click(screen.getByRole("button", { name: ASK_THE_TEAM }))
    expect(screen.getByRole("button", { name: POST_TO_TEAM_ROUND_TRIP })).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "You" }))
    expect(onSelectedAdultChange).toHaveBeenCalledWith("a1")
    expect(
      screen.getByRole("button", { name: "Confirm — You'll drive round trip from Home" }),
    ).toBeInTheDocument()
  })

  it("shows a non-activating Different plans link below the primary button", async () => {
    const user = userEvent.setup()
    render(<DriverPicker {...defaultProps} leaveFromLabel="Home" />)

    const link = screen.getByTestId("driver-picker-different-plans")
    expect(link).toHaveTextContent(DIFFERENT_PLANS_FOR_EACH_LEG)
    expect(link).toHaveAttribute("aria-disabled", "true")
    expect(link).toHaveAttribute("tabIndex", "-1")
    await user.click(link)
    expect(link).toBeInTheDocument()
  })

  it("disables chips and actions while loading", () => {
    render(<DriverPicker {...defaultProps} leaveFromLabel="Home" loading />)

    expect(screen.getByRole("button", { name: "You" })).toBeDisabled()
    expect(screen.getByRole("button", { name: "Jordan" })).toBeDisabled()
    expect(screen.getByRole("button", { name: ASK_THE_TEAM })).toBeDisabled()
    expect(
      screen.getByRole("button", { name: "Confirm — You'll drive round trip from Home" }),
    ).toBeDisabled()
  })

  it("disables confirm when kid subset is empty", () => {
    render(<DriverPicker {...defaultProps} kidIds={[]} leaveFromLabel="Home" />)

    expect(
      screen.getByRole("button", { name: "Confirm — You'll drive round trip from Home" }),
    ).toBeDisabled()
  })

  it("hides the Ask the team chip when showTeamSection is false", () => {
    render(<DriverPicker {...defaultProps} showTeamSection={false} leaveFromLabel="Home" />)

    expect(screen.queryByTestId("driver-picker-ask-team-chip")).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: ASK_THE_TEAM })).not.toBeInTheDocument()
  })

  it("wraps household chips inside a 390px container", () => {
    render(
      <div style={{ width: "390px" }}>
        <DriverPicker {...defaultProps} />
      </div>,
    )

    expect(screen.getByTestId("driver-picker").className).toMatch(/max-w-full/)
    expect(screen.getByRole("group", { name: "Household driver" }).className).toMatch(
      /flex-wrap/,
    )
    expect(screen.getByTestId("driver-picker-household-section").className).toMatch(
      /max-w-full/,
    )
  })
})

describe("DriverPicker hero styling", () => {
  it("uses white/ink chips and a white primary confirm on hero glow", () => {
    render(<DriverPicker {...defaultProps} hero leaveFromLabel="Home" />)

    const youChip = screen.getByRole("button", { name: "You" })
    const jordanChip = screen.getByRole("button", { name: "Jordan" })
    expect(youChip).toHaveAttribute("data-selected", "true")
    expect(youChip).toHaveStyle({
      backgroundColor: "var(--fc-hero-on)",
      color: "var(--fc-hero-on-inverse)",
    })
    expect(youChip.className).toMatch(/focus-visible:ring-2/)
    expect(jordanChip).toHaveAttribute("data-selected", "false")
    expect(jordanChip).toHaveStyle({ color: "var(--fc-hero-on)" })
    expect(jordanChip.getAttribute("style") ?? "").toMatch(/transparent/)

    expect(screen.getByTestId("driver-picker-confirm")).toHaveStyle({
      backgroundColor: "var(--fc-hero-on)",
      color: "var(--fc-hero-on-inverse)",
    })
  })

  it("styles Ask the team as a trailing chip on hero without a team footer", async () => {
    const user = userEvent.setup()
    render(<DriverPicker {...defaultProps} hero leaveFromLabel="Home" />)

    const askChip = screen.getByTestId("driver-picker-ask-team-chip")
    expect(screen.getByRole("group", { name: "Household driver" })).toContainElement(askChip)
    expect(screen.queryByTestId("driver-picker-team-section")).not.toBeInTheDocument()

    await user.click(askChip)
    expect(askChip).toHaveAttribute("data-selected", "true")
    expect(askChip).toHaveStyle({
      backgroundColor: "var(--fc-hero-on)",
      color: "var(--fc-hero-on-inverse)",
    })
    expect(screen.getByTestId("driver-picker-confirm")).toHaveTextContent(
      POST_TO_TEAM_ROUND_TRIP,
    )
  })

  it("disables hero actions while loading", () => {
    render(<DriverPicker {...defaultProps} hero loading leaveFromLabel="Home" />)

    expect(screen.getByRole("button", { name: "You" })).toBeDisabled()
    expect(screen.getByTestId("driver-picker-confirm")).toBeDisabled()
    expect(screen.getByTestId("driver-picker-ask-team-chip")).toBeDisabled()
  })
})
