import { describe, expect, it } from "vitest"

import type { CarpoolRide, CarpoolRideEvent } from "@/api/types"
import {
  acceptedByUsRequest,
  acceptedByUsRideDetailLine,
  carpoolFeedStatusLabel,
  circleDisplayName,
  eligiblePendingRideAccept,
  enableCarpoolConfirmMessage,
  agendaOwnRideStatusChip,
  isAcceptedByCircle,
  kidDisplayName,
  incomingRideAskSummary,
  ownRideDetailLine,
  ownRideStatusLine,
  rideKidsSeatsPickup,
  rideSeatsLabel,
} from "@/components/carpoolDisplay"
import { ASKED_THE_TEAM, RIDING_WITH_TEAMMATE, ridingWithCircleLabel } from "@/components/coverageCopy"

describe("carpoolDisplay", () => {
  it("shows Your family when the circle name is blank", () => {
    expect(circleDisplayName(null)).toBe("Your family")
    expect(circleDisplayName("  ")).toBe("Your family")
    expect(circleDisplayName("House A")).toBe("House A")
  })

  it("labels feed carpool status", () => {
    expect(carpoolFeedStatusLabel("NONE")).toBe("No carpool")
    expect(carpoolFeedStatusLabel("AVAILABLE")).toBe("Carpool available")
    expect(carpoolFeedStatusLabel("REQUESTED")).toBe("Requested")
    expect(carpoolFeedStatusLabel("MEMBER")).toBe("Member")
    expect(carpoolFeedStatusLabel("OWNER")).toBe("Owned")
  })

  it("asks organizers to confirm ownership before Enable", () => {
    expect(enableCarpoolConfirmMessage("Soccer")).toContain("own the carpool for Soccer")
  })

  it("labels kids and seats", () => {
    expect(kidDisplayName([{ id: "k1", displayName: "Mia" }], "k1")).toBe("Mia")
    expect(kidDisplayName([], "k1")).toBe("Kid")
    expect(rideSeatsLabel(1)).toBe("1 seat")
    expect(rideSeatsLabel(2)).toBe("2 seats")
  })

  it("labels own ride chips and status lines for Agenda", () => {
    expect(agendaOwnRideStatusChip(null)).toBeNull()
    expect(
      agendaOwnRideStatusChip(ride({ status: "PENDING", acceptingCircleName: null })),
    ).toEqual({ label: ASKED_THE_TEAM, tone: "amber" })
    expect(
      agendaOwnRideStatusChip(ride({ status: "ACCEPTED", acceptingCircleName: "House B" })),
    ).toEqual({ label: ridingWithCircleLabel("House B"), tone: "mint" })
    expect(
      agendaOwnRideStatusChip(ride({ status: "ACCEPTED", acceptingCircleName: "  " })),
    ).toEqual({ label: RIDING_WITH_TEAMMATE, tone: "mint" })
    expect(ownRideStatusLine(ride({ status: "PENDING" }))).toBe("Requested")
    expect(
      ownRideStatusLine(
        ride({ status: "PENDING", passedByAdultNames: ["Sam", "Alex"] }),
      ),
    ).toBe("Passed by Sam, Alex")
    expect(
      ownRideStatusLine(ride({ status: "ACCEPTED", acceptingCircleName: "House B" })),
    ).toBe("Riding with House B")
    expect(ownRideStatusLine(ride({ status: "ACCEPTED", acceptingCircleName: null }))).toBe(
      "Riding with a teammate",
    )
  })

  it("formats kids · seats · pickup for shared ride detail tails", () => {
    expect(
      rideKidsSeatsPickup(
        ride({
          kidFirstNames: ["Mia", "Leo"],
          seats: 2,
          pickupPlaceName: "Home",
          pickupAddress: "1 Main St",
        }),
      ),
    ).toBe("Mia, Leo · 2 seats · Home, 1 Main St")
  })

  it("summarizes an incoming ask with seats for Focus Accept/Pass", () => {
    expect(
      incomingRideAskSummary(
        ride({
          requestingCircleName: "House B",
          kidFirstNames: ["Mia", "Leo"],
          seats: 2,
          pickupPlaceName: "Home",
          pickupAddress: "1 Main St",
        }),
      ),
    ).toBe("House B · Mia, Leo · 2 seats · Home, 1 Main St")
    expect(
      incomingRideAskSummary(
        ride({
          requestingCircleName: "  ",
          kidFirstNames: ["Mia"],
          seats: 1,
          pickupPlaceName: "School",
          pickupAddress: "2 Oak",
        }),
      ),
    ).toBe("Your family · Mia · 1 seat · School, 2 Oak")
  })

  it("builds own and accepted-by-us ride detail lines with Calendar field density", () => {
    expect(
      ownRideDetailLine(
        ride({
          status: "PENDING",
          kidFirstNames: ["Maya"],
          seats: 1,
          pickupPlaceName: "Home",
          pickupAddress: "1 Main",
        }),
      ),
    ).toBe("Requested · Maya · 1 seat · Home, 1 Main")
    expect(
      ownRideDetailLine(
        ride({
          status: "ACCEPTED",
          acceptingCircleName: "House B",
          kidFirstNames: ["Maya"],
          seats: 1,
          pickupPlaceName: "Home",
          pickupAddress: "1 Main",
        }),
      ),
    ).toBe("Riding with House B · Maya · 1 seat · Home, 1 Main")
    expect(
      ownRideDetailLine(
        ride({
          status: "ACCEPTED",
          acceptingCircleName: "House B",
          kidFirstNames: ["Maya"],
          seats: 1,
          pickupPlaceName: "Home",
          pickupAddress: "1 Main",
        }),
        "Accepted by House B",
      ),
    ).toBe("Accepted by House B · Maya · 1 seat · Home, 1 Main")
    expect(
      acceptedByUsRideDetailLine(
        ride({
          requestingCircleName: "House B",
          kidFirstNames: ["Mia"],
          seats: 1,
          pickupPlaceName: "Home",
          pickupAddress: "1 Main",
        }),
      ),
    ).toBe("House B · Mia · 1 seat · Home, 1 Main")
  })

  it("picks the first pending otherRequest that can be accepted without garage", () => {
    const pending = ride({ id: "ask-1", status: "PENDING", passedByMe: false })
    const eventRow = event({ otherRequests: [pending] })
    expect(eligiblePendingRideAccept(eventRow, { adultId: "a1" })?.id).toBe("ask-1")
  })

  it("skips passed asks and own requests for Focus accept eligibility", () => {
    expect(
      eligiblePendingRideAccept(
        event({
          ownRequest: ride({ id: "own", status: "PENDING" }),
          otherRequests: [ride({ id: "passed", passedByMe: true })],
        }),
        { adultId: "a1" },
      ),
    ).toBeNull()
  })

  it("detects teammate asks this circle accepted", () => {
    const ours = ride({
      id: "accepted-us",
      status: "ACCEPTED",
      acceptingCircleId: "c1",
      acceptingCircleName: "Ours",
    })
    const theirs = ride({
      id: "accepted-them",
      status: "ACCEPTED",
      acceptingCircleId: "c9",
      acceptingCircleName: "Them",
    })
    expect(isAcceptedByCircle(ours, "c1")).toBe(true)
    expect(isAcceptedByCircle(theirs, "c1")).toBe(false)
    expect(acceptedByUsRequest(event({ otherRequests: [theirs, ours] }), "c1")?.id).toBe(
      "accepted-us",
    )
    expect(acceptedByUsRequest(event({ otherRequests: [theirs] }), "c1")).toBeNull()
    expect(acceptedByUsRequest(null, "c1")).toBeNull()
  })
})

function ride(partial: Partial<CarpoolRide> = {}): CarpoolRide {
  return {
    id: "r1",
    spaceId: "s1",
    eventKey: "UID:game",
    requestingCircleId: "c2",
    requestingCircleName: "House B",
    requestedByAdultId: "a2",
    kidIds: ["k2"],
    kidFirstNames: ["Mia"],
    seats: 1,
    pickupPlaceName: "Home",
    pickupAddress: "1 Main St",
    pickupTown: null,
    detourMinutes: null,
    status: "PENDING",
    passedByMe: false,
    passedByAdultNames: [],
    acceptedByAdultId: null,
    acceptingCircleId: null,
    acceptingCircleName: null,
    ...partial,
  }
}

function event(partial: Partial<CarpoolRideEvent> = {}): CarpoolRideEvent {
  return {
    eventKey: "UID:game",
    title: "Practice",
    startsAt: "2026-08-21T16:00:00Z",
    endsAt: null,
    defaultKidIds: [],
    ownRequest: null,
    otherRequests: [],
    ...partial,
  }
}
