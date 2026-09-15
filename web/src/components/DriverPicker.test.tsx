import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import type { FamilyCircle, FamilyMember } from "@/api/types"
import {
  ASK_THE_TEAM,
  DIFFERENT_PLANS_FOR_EACH_KID,
  DIFFERENT_PLANS_FOR_EACH_LEG,
  LEAVE_FROM_ADDRESS_PLACEHOLDER,
  PLACE_DROPPING_OFF_AT,
  PLACE_PICKING_UP_FROM,
  POST_TO_TEAM_ROUND_TRIP,
} from "@/components/coverageCopy"
import {
  confirmDriverLabel,
  DriverPicker,
  householdDriverChipLabel,
} from "@/components/DriverPicker"
import { LEAVE_FROM_ONE_TIME_VALUE } from "@/components/leaveFromDisplay"

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

const circle: FamilyCircle = {
  id: "c1",
  name: "House",
  role: "ORGANIZER",
  members,
  kids: [],
  places: [
    {
      id: "p-home",
      name: "Home",
      address: "1 Main St",
      latitude: 42,
      longitude: -71,
    },
    {
      id: "p-grandma",
      name: "Grandma",
      address: "9 Elm St",
      latitude: 42.1,
      longitude: -71.1,
    },
  ],
  defaultLeaveFromPlaceId: "p-home",
  defaultLeaveFromPlaceName: "Home",
}

const emptyPlace = { placeId: null, placeAddress: null }

const defaultProps = {
  members,
  currentAdultId: "a1",
  selectedAdultId: "a1",
  onSelectedAdultChange: vi.fn(),
  kidIds: ["k1"],
  onAssignCoverage: vi.fn(),
  onAskTeam: vi.fn(),
  circle,
  sharedPlaceValue: {
    leaveFromPlaceId: null as string | null,
    leaveFromPlaceName: "Home",
    leaveFromAddress: null as string | null,
  },
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

  it("Confirm uses goingKids rather than a stale kidIds subset", async () => {
    const user = userEvent.setup()
    const onAssignCoverage = vi.fn()

    render(
      <DriverPicker
        {...defaultProps}
        selectedAdultId="a1"
        kidIds={["k1"]}
        goingKids={[
          { id: "k1", firstName: "Graham" },
          { id: "k2", firstName: "Luke" },
        ]}
        leaveFromLabel="Home"
        onAssignCoverage={onAssignCoverage}
      />,
    )

    await user.click(
      screen.getByRole("button", {
        name: "Confirm — You'll drive round trip from Home",
      }),
    )

    expect(onAssignCoverage).toHaveBeenCalledWith("a1", ["k1", "k2"])
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

  it("disables Post and shows inline error when Ask the team needs a place", async () => {
    const user = userEvent.setup()
    const onAskTeam = vi.fn()
    render(
      <DriverPicker
        {...defaultProps}
        leaveFromLabel="Home"
        hasPickupPlace={false}
        onAskTeam={onAskTeam}
      />,
    )

    await user.click(screen.getByTestId("driver-picker-ask-team-chip"))
    const post = screen.getByTestId("driver-picker-confirm")
    expect(post).toBeDisabled()
    expect(screen.getByTestId("driver-picker-action-error")).toHaveTextContent(
      "Add a home address in Places before asking the team.",
    )
    await user.click(post)
    expect(onAskTeam).not.toHaveBeenCalled()
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

  it("shows a non-activating Different plans link when Save ride plan is unavailable", async () => {
    const user = userEvent.setup()
    render(<DriverPicker {...defaultProps} leaveFromLabel="Home" />)

    const link = screen.getByTestId("driver-picker-different-plans")
    expect(link).toHaveTextContent(DIFFERENT_PLANS_FOR_EACH_LEG)
    expect(link).toHaveAttribute("aria-disabled", "true")
    expect(link).toHaveAttribute("tabIndex", "-1")
    await user.click(link)
    expect(screen.getByTestId("driver-picker")).toHaveAttribute("data-mode", "simple")
  })

  it("opens the split editor without Ask chips when Save is provided and team section is hidden", async () => {
    const user = userEvent.setup()
    render(
      <DriverPicker
        {...defaultProps}
        leaveFromLabel="Home"
        onSaveRidePlan={vi.fn()}
        showTeamSection={false}
      />,
    )

    const link = screen.getByTestId("driver-picker-different-plans")
    expect(link).not.toHaveAttribute("aria-disabled", "true")
    await user.click(link)
    expect(screen.getByTestId("driver-picker")).toHaveAttribute("data-mode", "split")
    expect(screen.queryByTestId("driver-picker-to-ask-team-chip")).not.toBeInTheDocument()
    expect(screen.queryByTestId("driver-picker-from-ask-team-chip")).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: ASK_THE_TEAM })).not.toBeInTheDocument()
  })

  it("opens split editor, saves both legs, and returns to simple view", async () => {
    const user = userEvent.setup()
    const onSaveRidePlan = vi.fn()
    render(
      <DriverPicker
        {...defaultProps}
        leaveFromLabel="Home"
        onSaveRidePlan={onSaveRidePlan}
      />,
    )

    await user.click(screen.getByTestId("driver-picker-different-plans"))
    expect(screen.getByTestId("driver-picker")).toHaveAttribute("data-mode", "split")
    expect(screen.getByText("Getting there")).toBeInTheDocument()
    expect(screen.getByText("Coming back")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Save ride plan" })).toBeInTheDocument()

    await user.click(screen.getByTestId("driver-picker-from-ask-team-chip"))
    await user.click(screen.getByRole("button", { name: "Save ride plan" }))

    expect(onSaveRidePlan).toHaveBeenCalledWith({
      to: { action: "HOUSEHOLD", assigneeAdultId: "a1" },
      from: { action: "ASK_TEAM" },
      toPlace: emptyPlace,
      fromPlace: emptyPlace,
      toMeetSide: "REQUESTER",
      fromMeetSide: "REQUESTER",
    })

    await user.click(screen.getByTestId("driver-picker-back-to-simple"))
    expect(screen.getByTestId("driver-picker")).toHaveAttribute("data-mode", "simple")
    expect(
      screen.getByRole("button", { name: "Confirm — You'll drive round trip from Home" }),
    ).toBeInTheDocument()
  })

  it("shows per-leg place controls in split mode for household and Ask", async () => {
    const user = userEvent.setup()
    render(
      <DriverPicker
        {...defaultProps}
        leaveFromLabel="Home"
        leaveFromSlot={<div data-testid="leave-from-slot">Leave from</div>}
        onSaveRidePlan={vi.fn()}
      />,
    )

    await user.click(screen.getByTestId("driver-picker-different-plans"))
    expect(screen.queryByTestId("leave-from-slot")).not.toBeInTheDocument()
    expect(screen.getByTestId("driver-picker-to-label")).toHaveTextContent(
      PLACE_PICKING_UP_FROM,
    )
    expect(screen.getByTestId("driver-picker-from-label")).toHaveTextContent(
      PLACE_DROPPING_OFF_AT,
    )

    await user.click(screen.getByTestId("driver-picker-to-ask-team-chip"))
    await user.click(screen.getByTestId("driver-picker-from-ask-team-chip"))
    expect(screen.getByTestId("driver-picker-to-place")).toBeInTheDocument()
    expect(screen.getByTestId("driver-picker-from-place")).toBeInTheDocument()
  })

  it("saves diverging per-leg places from the split editor", async () => {
    const user = userEvent.setup()
    const onSaveRidePlan = vi.fn()
    render(
      <DriverPicker
        {...defaultProps}
        leaveFromLabel="Home"
        onSaveRidePlan={onSaveRidePlan}
      />,
    )

    await user.click(screen.getByTestId("driver-picker-different-plans"))
    await user.selectOptions(
      screen.getByTestId("driver-picker-to-place-select"),
      "p-grandma",
    )
    await user.selectOptions(
      screen.getByTestId("driver-picker-from-place-select"),
      "p-home",
    )
    // Selecting the resolved default place stores Default (both null).
    await user.click(screen.getByRole("button", { name: "Save ride plan" }))

    expect(onSaveRidePlan).toHaveBeenCalledWith({
      to: { action: "HOUSEHOLD", assigneeAdultId: "a1" },
      from: { action: "HOUSEHOLD", assigneeAdultId: "a1" },
      toPlace: { placeId: "p-grandma", placeAddress: null },
      fromPlace: emptyPlace,
      toMeetSide: "REQUESTER",
      fromMeetSide: "REQUESTER",
    })
  })

  it("posts simple Ask through saveRidePlan with the shared place on both legs", async () => {
    const user = userEvent.setup()
    const onSaveRidePlan = vi.fn()
    const onAskTeam = vi.fn()
    render(
      <DriverPicker
        {...defaultProps}
        leaveFromLabel="Home"
        onAskTeam={onAskTeam}
        onSaveRidePlan={onSaveRidePlan}
        sharedPlaceValue={{
          leaveFromPlaceId: "p-grandma",
          leaveFromPlaceName: "Grandma",
          leaveFromAddress: null,
        }}
      />,
    )

    await user.click(screen.getByTestId("driver-picker-ask-team-chip"))
    await user.click(screen.getByRole("button", { name: POST_TO_TEAM_ROUND_TRIP }))

    expect(onAskTeam).not.toHaveBeenCalled()
    expect(onSaveRidePlan).toHaveBeenCalledWith({
      to: { action: "ASK_TEAM" },
      from: { action: "ASK_TEAM" },
      toPlace: { placeId: "p-grandma", placeAddress: null },
      fromPlace: { placeId: "p-grandma", placeAddress: null },
      toMeetSide: "REQUESTER",
      fromMeetSide: "REQUESTER",
    })
  })

  it("shows Meet where? on Ask and hides leave-from when both are Driver's place", async () => {
    const user = userEvent.setup()
    const onSaveRidePlan = vi.fn()
    render(
      <DriverPicker
        {...defaultProps}
        leaveFromLabel="Home"
        leaveFromSlot={<div data-testid="leave-from-slot">Leave from</div>}
        onSaveRidePlan={onSaveRidePlan}
        hasPickupPlace={false}
      />,
    )

    await user.click(screen.getByTestId("driver-picker-ask-team-chip"))
    expect(screen.getByTestId("driver-picker-simple-to-meet-where")).toBeInTheDocument()
    expect(screen.getByTestId("driver-picker-simple-from-meet-where")).toBeInTheDocument()
    expect(screen.getByTestId("leave-from-slot")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: POST_TO_TEAM_ROUND_TRIP })).toBeDisabled()

    await user.click(screen.getByTestId("driver-picker-simple-to-meet-drivers-place"))
    await user.click(screen.getByTestId("driver-picker-simple-from-meet-drivers-place"))
    expect(screen.queryByTestId("leave-from-slot")).not.toBeInTheDocument()
    expect(screen.getByTestId("driver-picker-simple-to-meet-drivers-hint")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: POST_TO_TEAM_ROUND_TRIP })).toBeEnabled()

    await user.click(screen.getByRole("button", { name: POST_TO_TEAM_ROUND_TRIP }))
    expect(onSaveRidePlan).toHaveBeenCalledWith({
      to: { action: "ASK_TEAM" },
      from: { action: "ASK_TEAM" },
      toPlace: emptyPlace,
      fromPlace: emptyPlace,
      toMeetSide: "ACCEPTOR",
      fromMeetSide: "ACCEPTOR",
    })
  })

  it("hides place picker for Driver's place Ask legs in split mode", async () => {
    const user = userEvent.setup()
    render(
      <DriverPicker
        {...defaultProps}
        leaveFromLabel="Home"
        onSaveRidePlan={vi.fn()}
      />,
    )

    await user.click(screen.getByTestId("driver-picker-different-plans"))
    await user.click(screen.getByTestId("driver-picker-to-ask-team-chip"))
    expect(screen.getByTestId("driver-picker-to-meet-where")).toBeInTheDocument()
    expect(screen.getByTestId("driver-picker-to-place")).toBeInTheDocument()

    await user.click(screen.getByTestId("driver-picker-to-meet-drivers-place"))
    expect(screen.queryByTestId("driver-picker-to-place")).not.toBeInTheDocument()
    expect(screen.getByTestId("driver-picker-to-meet-drivers-hint")).toBeInTheDocument()
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

  it("omits Different plans for each kid when only one going kid", () => {
    render(
      <DriverPicker
        {...defaultProps}
        leaveFromLabel="Home"
        onSaveRidePlan={vi.fn()}
        onSaveKidPlans={vi.fn()}
        goingKids={[{ id: "k1", firstName: "Sam" }]}
      />,
    )

    expect(screen.queryByTestId("driver-picker-different-plans-kid")).not.toBeInTheDocument()
  })

  it("shows a non-activating kid-split link without onSaveKidPlans", async () => {
    const user = userEvent.setup()
    render(
      <DriverPicker
        {...defaultProps}
        leaveFromLabel="Home"
        onSaveRidePlan={vi.fn()}
        goingKids={[
          { id: "k1", firstName: "Sam" },
          { id: "k2", firstName: "Mia" },
        ]}
      />,
    )

    const link = screen.getByTestId("driver-picker-different-plans-kid")
    expect(link).toHaveTextContent(DIFFERENT_PLANS_FOR_EACH_KID)
    expect(link).toHaveAttribute("aria-disabled", "true")
    await user.click(link)
    expect(screen.getByTestId("driver-picker")).toHaveAttribute("data-mode", "simple")
  })

  it("opens kid-split, saves per-kid plans, and returns to simple view", async () => {
    const user = userEvent.setup()
    const onSaveKidPlans = vi.fn()
    render(
      <DriverPicker
        {...defaultProps}
        leaveFromLabel="Home"
        leaveFromSlot={<div data-testid="leave-from-slot">Leave from</div>}
        onSaveRidePlan={vi.fn()}
        onSaveKidPlans={onSaveKidPlans}
        goingKids={[
          { id: "k1", firstName: "Sam" },
          { id: "k2", firstName: "Mia" },
        ]}
      />,
    )

    await user.click(screen.getByTestId("driver-picker-different-plans-kid"))
    expect(screen.getByTestId("driver-picker")).toHaveAttribute("data-mode", "kid-split")
    expect(screen.getByTestId("driver-picker-kid-header-k1")).toHaveTextContent("Sam")
    expect(screen.getByTestId("driver-picker-kid-header-k2")).toHaveTextContent("Mia")
    expect(screen.queryByTestId("leave-from-slot")).not.toBeInTheDocument()
    expect(screen.getByTestId("driver-picker-kid-k1-place-label")).toHaveTextContent(
      "Leave from",
    )
    expect(screen.getByTestId("driver-picker-kid-k2-place-label")).toHaveTextContent(
      "Leave from",
    )

    await user.click(screen.getByTestId("driver-picker-kid-k2-ask-team-chip"))
    await user.click(screen.getByTestId("driver-picker-kid-k1-ask-team-chip"))

    await user.click(screen.getByRole("button", { name: "Save ride plan" }))
    expect(onSaveKidPlans).toHaveBeenCalledWith([
      {
        kidId: "k1",
        legs: {
          to: { action: "ASK_TEAM" },
          from: { action: "ASK_TEAM" },
          toPlace: emptyPlace,
          fromPlace: emptyPlace,
          toMeetSide: "REQUESTER",
          fromMeetSide: "REQUESTER",
        },
      },
      {
        kidId: "k2",
        legs: {
          to: { action: "ASK_TEAM" },
          from: { action: "ASK_TEAM" },
          toPlace: emptyPlace,
          fromPlace: emptyPlace,
          toMeetSide: "REQUESTER",
          fromMeetSide: "REQUESTER",
        },
      },
    ])

    await user.click(screen.getByTestId("driver-picker-back-to-simple"))
    expect(screen.getByTestId("driver-picker")).toHaveAttribute("data-mode", "simple")
  })

  it("supports nested leg-split per kid and jumps from shared leg editor", async () => {
    const user = userEvent.setup()
    const onSaveKidPlans = vi.fn()
    render(
      <DriverPicker
        {...defaultProps}
        leaveFromLabel="Home"
        onSaveRidePlan={vi.fn()}
        onSaveKidPlans={onSaveKidPlans}
        goingKids={[
          { id: "k1", firstName: "Sam" },
          { id: "k2", firstName: "Mia" },
        ]}
      />,
    )

    await user.click(screen.getByTestId("driver-picker-different-plans"))
    expect(screen.getByTestId("driver-picker")).toHaveAttribute("data-mode", "split")
    await user.click(screen.getByTestId("driver-picker-from-ask-team-chip"))
    await user.click(screen.getByTestId("driver-picker-different-plans-kid"))
    expect(screen.getByTestId("driver-picker")).toHaveAttribute("data-mode", "kid-split")

    await user.click(screen.getByTestId("driver-picker-kid-k1-different-plans-leg"))
    expect(screen.getByTestId("driver-picker-kid-k1-leg-to")).toBeInTheDocument()
    expect(screen.getByTestId("driver-picker-kid-k1-to-label")).toHaveTextContent(
      PLACE_PICKING_UP_FROM,
    )
    expect(screen.getByTestId("driver-picker-kid-k1-from-label")).toHaveTextContent(
      PLACE_DROPPING_OFF_AT,
    )
    await user.click(screen.getByTestId("driver-picker-kid-k1-from-ask-team-chip"))
    await user.click(screen.getByRole("button", { name: "Save ride plan" }))

    expect(onSaveKidPlans).toHaveBeenCalledWith([
      {
        kidId: "k1",
        legs: {
          to: { action: "HOUSEHOLD", assigneeAdultId: "a1" },
          from: { action: "ASK_TEAM" },
          toPlace: emptyPlace,
          fromPlace: emptyPlace,
          toMeetSide: "REQUESTER",
          fromMeetSide: "REQUESTER",
        },
      },
      {
        kidId: "k2",
        legs: {
          to: { action: "HOUSEHOLD", assigneeAdultId: "a1" },
          from: { action: "HOUSEHOLD", assigneeAdultId: "a1" },
          toPlace: emptyPlace,
          fromPlace: emptyPlace,
          toMeetSide: "REQUESTER",
          fromMeetSide: "REQUESTER",
        },
      },
    ])
  })

  it("saves diverging per-leg places inside kid-split nested leg editor", async () => {
    const user = userEvent.setup()
    const onSaveKidPlans = vi.fn()
    render(
      <DriverPicker
        {...defaultProps}
        leaveFromLabel="Home"
        onSaveRidePlan={vi.fn()}
        onSaveKidPlans={onSaveKidPlans}
        goingKids={[
          { id: "k1", firstName: "Sam" },
          { id: "k2", firstName: "Mia" },
        ]}
      />,
    )

    await user.click(screen.getByTestId("driver-picker-different-plans-kid"))
    await user.click(screen.getByTestId("driver-picker-kid-k1-different-plans-leg"))
    await user.selectOptions(
      screen.getByTestId("driver-picker-kid-k1-to-place-select"),
      "p-grandma",
    )
    await user.selectOptions(
      screen.getByTestId("driver-picker-kid-k1-from-place-select"),
      LEAVE_FROM_ONE_TIME_VALUE,
    )
    await user.type(
      screen.getByTestId("driver-picker-kid-k1-from-one-time-input"),
      "12 Oak St",
    )
    await user.tab()
    await user.click(screen.getByRole("button", { name: "Save ride plan" }))

    expect(onSaveKidPlans).toHaveBeenCalledWith([
      {
        kidId: "k1",
        legs: {
          to: { action: "HOUSEHOLD", assigneeAdultId: "a1" },
          from: { action: "HOUSEHOLD", assigneeAdultId: "a1" },
          toPlace: { placeId: "p-grandma", placeAddress: null },
          fromPlace: { placeId: null, placeAddress: "12 Oak St" },
          toMeetSide: "REQUESTER",
          fromMeetSide: "REQUESTER",
        },
      },
      {
        kidId: "k2",
        legs: {
          to: { action: "HOUSEHOLD", assigneeAdultId: "a1" },
          from: { action: "HOUSEHOLD", assigneeAdultId: "a1" },
          toPlace: emptyPlace,
          fromPlace: emptyPlace,
          toMeetSide: "REQUESTER",
          fromMeetSide: "REQUESTER",
        },
      },
    ])
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
