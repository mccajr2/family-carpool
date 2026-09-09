import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import { RideNeededLegsControl } from "@/components/RideNeededLegsControl"
import {
  choiceFromLegsNeeded,
  DEFAULT_RIDE_NEEDED_LEGS,
  defaultKidsNeedingCarpoolRequest,
  legsNeededFromChoice,
} from "@/components/rideNeededLegs"

describe("rideNeededLegs helpers", () => {
  it("maps Round trip to both legs and back", () => {
    expect(legsNeededFromChoice("BOTH")).toEqual(["TO", "FROM"])
    expect(legsNeededFromChoice("TO")).toEqual(["TO"])
    expect(legsNeededFromChoice("FROM")).toEqual(["FROM"])
    expect(choiceFromLegsNeeded(["TO", "FROM"])).toBe("BOTH")
    expect(choiceFromLegsNeeded(["FROM"])).toBe("FROM")
    expect(choiceFromLegsNeeded(["TO"])).toBe("TO")
  })

  it("defaults new needs to Round trip", () => {
    expect(DEFAULT_RIDE_NEEDED_LEGS).toBe("BOTH")
  })

  it("lists default kids who do not yet have a need", () => {
    expect(
      defaultKidsNeedingCarpoolRequest({
        eventKey: "UID:x",
        title: "Practice",
        startsAt: "2026-01-01T00:00:00Z",
        endsAt: null,
        defaultKidIds: ["k1", "k2"],
        ownRequests: [
          {
            id: "r1",
            spaceId: "s1",
            eventKey: "UID:x",
            requestingCircleId: "c1",
            requestingCircleName: "House",
            requestedByAdultId: "a1",
            kidId: "k1",
            kidFirstName: "Mia",
            legsNeeded: ["TO", "FROM"],
            legStatuses: [
              { leg: "TO", status: "OPEN" },
              { leg: "FROM", status: "OPEN" },
            ],
            pickupPlaceName: "Home",
            pickupAddress: "1 Main",
            pickupTown: null,
            detourMinutes: null,
            status: "UNCOVERED",
            passedByMe: false,
            passedByAdultNames: [],
          },
        ],
        otherRequests: [],
        rides: [],
      }),
    ).toEqual(["k2"])
  })
})

describe("RideNeededLegsControl", () => {
  it("defaults to Round trip and reports To / From selections", async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<RideNeededLegsControl onChange={onChange} />)

    expect(screen.getByText("Ride needed")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Round trip" })).toHaveAttribute(
      "aria-pressed",
      "true",
    )
    expect(screen.getByRole("button", { name: "To practice" })).toHaveAttribute(
      "aria-pressed",
      "false",
    )

    await user.click(screen.getByRole("button", { name: "To practice" }))
    expect(onChange).toHaveBeenCalledWith("TO")

    await user.click(screen.getByRole("button", { name: "From practice" }))
    expect(onChange).toHaveBeenCalledWith("FROM")
  })

  it("respects controlled value and disabled", () => {
    const onChange = vi.fn()
    render(<RideNeededLegsControl value="FROM" onChange={onChange} disabled />)

    expect(screen.getByRole("button", { name: "From practice" })).toHaveAttribute(
      "aria-pressed",
      "true",
    )
    expect(screen.getByRole("button", { name: "To practice" })).toBeDisabled()
    expect(screen.getByRole("button", { name: "Round trip" })).toBeDisabled()
  })
})
