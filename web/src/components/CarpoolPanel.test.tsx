import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import type { CarpoolClient } from "@/api/carpoolClient"
import type { FamilyClient } from "@/api/familyClient"
import type {
  CarpoolRide,
  CarpoolRideEvent,
  CarpoolSummary,
  Garage,
  Kid,
} from "@/api/types"
import { CarpoolPanel } from "@/components/CarpoolPanel"

function mockCarpoolClient(partial: Partial<CarpoolClient>): CarpoolClient {
  return {
    listRides: vi.fn().mockResolvedValue([]),
    ...partial,
  } as CarpoolClient
}

function mockFamilyClient(partial: Partial<FamilyClient> = {}): FamilyClient {
  return {
    getGarage: vi.fn().mockResolvedValue({ members: [], vehicles: [] } satisfies Garage),
    ...partial,
  } as FamilyClient
}

const kids: Kid[] = [
  { id: "k1", displayName: "Mia" },
  { id: "k2", displayName: "Leo" },
]

function renderPanel(
  carpool: Partial<CarpoolClient>,
  extras: { family?: Partial<FamilyClient>; onJoined?: () => void } = {},
) {
  return render(
    <CarpoolPanel
      accessToken="tok"
      carpoolClient={mockCarpoolClient(carpool)}
      familyClient={mockFamilyClient(extras.family)}
      adultId="a1"
      circleId="c1"
      kids={kids}
      onJoined={extras.onJoined}
    />,
  )
}

const emptyOrganizer: CarpoolSummary = {
  circleRole: "ORGANIZER",
  feeds: [],
  spaces: [],
}

const emptyCaregiver: CarpoolSummary = {
  circleRole: "CAREGIVER",
  feeds: [],
  spaces: [],
}

const memberSpace: CarpoolSummary = {
  circleRole: "ORGANIZER",
  feeds: [],
  spaces: [
    {
      id: "s1",
      name: "Soccer",
      membership: "OWNER",
      inviteCode: "AB12CD34",
      callerFeedId: "f1",
      members: [{ circleId: "c1", circleName: "House A", membership: "OWNER" }],
      pendingRequests: [],
    },
  ],
}

function ride(partial: Partial<CarpoolRide> = {}): CarpoolRide {
  return {
    id: "ride-1",
    spaceId: "s1",
    eventKey: "UID:practice",
    requestingCircleId: "c2",
    requestingCircleName: "House B",
    requestedByAdultId: "a2",
    kidIds: ["k9"],
    kidFirstNames: ["Sam"],
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
    vehicleId: null,
    vehicleLabel: null,
    ...partial,
  }
}

function event(partial: Partial<CarpoolRideEvent> = {}): CarpoolRideEvent {
  return {
    eventKey: "UID:practice",
    title: "Practice",
    startsAt: "2026-08-21T16:00:00Z",
    endsAt: null,
    defaultKidIds: ["k1", "k2"],
    ownRequest: null,
    otherRequests: [],
    ...partial,
  }
}

const garageWithVan: Garage = {
  members: [{ adultId: "a1", displayName: "Alex", drives: true }],
  vehicles: [
    {
      id: "v1",
      ownerAdultId: "a1",
      driverAdultIds: ["a1"],
      keptAtPlaceId: null,
      label: "Van",
      year: 2019,
      make: "HONDA",
      model: "Odyssey",
      seats: 8,
      suggestedSeats: 8,
    },
  ],
}

describe("CarpoolPanel", () => {
  it("shows loading then empty copy without sending caregivers to Feeds", async () => {
    const getSummary = vi.fn().mockResolvedValue(emptyCaregiver)
    renderPanel({ getSummary })

    expect(screen.getByText("Loading carpool…")).toBeInTheDocument()
    expect(
      await screen.findByText("Paste an invite code to join a team carpool."),
    ).toBeInTheDocument()
    expect(screen.queryByText(/Feeds/)).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Have a code?" })).toBeInTheDocument()
  })

  it("surfaces load errors", async () => {
    const getSummary = vi.fn().mockRejectedValue(new Error("backend not reachable"))
    renderPanel({ getSummary })

    expect(await screen.findByRole("alert")).toHaveTextContent("backend not reachable")
  })

  it("enables for Organizer and hides Enable for Caregiver NONE rows", async () => {
    const user = userEvent.setup()
    vi.spyOn(window, "confirm").mockReturnValue(true)
    const noneSummary = {
      circleRole: "ORGANIZER" as const,
      feeds: [
        {
          feedId: "f1",
          feedName: "Soccer",
          status: "NONE" as const,
          spaceId: null,
          spaceName: null,
        },
      ],
      spaces: [],
    } satisfies CarpoolSummary
    const ownerSummary = {
      circleRole: "ORGANIZER" as const,
      feeds: [
        {
          feedId: "f1",
          feedName: "Soccer",
          status: "OWNER" as const,
          spaceId: "s1",
          spaceName: "Soccer",
        },
      ],
      spaces: [
        {
          id: "s1",
          name: "Soccer",
          membership: "OWNER" as const,
          inviteCode: "AB12CD34",
          callerFeedId: "f1",
          members: [{ circleId: "c1", circleName: "House A", membership: "OWNER" as const }],
          pendingRequests: [],
        },
      ],
    } satisfies CarpoolSummary
    const getSummary = vi.fn().mockResolvedValue(noneSummary)
    const enable = vi.fn().mockImplementation(async () => {
      getSummary.mockResolvedValue(ownerSummary)
    })
    const listRides = vi.fn().mockResolvedValue([])

    renderPanel({ getSummary, enable, listRides })

    await user.click(await screen.findByRole("button", { name: "Enable" }))
    expect(enable).toHaveBeenCalledWith("tok", "f1")
    expect(await screen.findByText("AB12CD34")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Open" })).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Enable carpool" })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Open carpool" })).not.toBeInTheDocument()
    expect(listRides).toHaveBeenCalledWith(
      "tok",
      "s1",
      expect.any(String),
      expect.any(String),
    )
    const from = listRides.mock.calls[0]?.[2] as string
    const to = listRides.mock.calls[0]?.[3] as string
    expect((new Date(to).getTime() - new Date(from).getTime()) / (24 * 60 * 60 * 1000)).toBe(
      14,
    )
  })

  it("joins by code and admits a pending request", async () => {
    const user = userEvent.setup()
    const pendingSummary = {
      circleRole: "ORGANIZER",
      feeds: [],
      spaces: [
        {
          id: "s1",
          name: "Soccer",
          membership: "OWNER",
          inviteCode: "AB12CD34",
          callerFeedId: "f1",
          members: [{ circleId: "c1", circleName: "House A", membership: "OWNER" }],
          pendingRequests: [
            {
              id: "r1",
              spaceId: "s1",
              circleId: "c2",
              circleName: "House B",
              requestedByAdultId: "a2",
              requestedByDisplayName: "Sam",
            },
          ],
        },
      ],
    } satisfies CarpoolSummary
    const admittedSummary = {
      circleRole: "ORGANIZER",
      feeds: [],
      spaces: [
        {
          id: "s1",
          name: "Soccer",
          membership: "OWNER",
          inviteCode: "AB12CD34",
          callerFeedId: "f1",
          members: [
            { circleId: "c1", circleName: "House A", membership: "OWNER" },
            { circleId: "c2", circleName: "House B", membership: "MEMBER" },
          ],
          pendingRequests: [],
        },
      ],
    } satisfies CarpoolSummary
    let admitted = false
    const getSummary = vi.fn().mockImplementation(async () =>
      admitted ? admittedSummary : pendingSummary,
    )
    const admit = vi.fn().mockImplementation(async () => {
      admitted = true
    })
    const join = vi.fn().mockResolvedValue({})
    const onJoined = vi.fn()

    renderPanel({ getSummary, admit, join }, { onJoined })

    expect(await screen.findByText("House B · requested by Sam")).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Admit" }))
    expect(admit).toHaveBeenCalledWith("tok", "s1", "r1")
    await waitFor(() => {
      expect(screen.queryByRole("button", { name: "Admit" })).not.toBeInTheDocument()
    })
    expect(screen.getByText(/House B/)).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Have a code?" }))
    await user.type(screen.getByLabelText("Carpool invite code"), "XY98ZW76")
    await user.click(screen.getByRole("button", { name: "Join" }))
    await waitFor(() => {
      expect(join).toHaveBeenCalledWith("tok", "XY98ZW76")
    })
    expect(onJoined).toHaveBeenCalledTimes(1)
  })

  it("does not mention Feeds in caregiver empty copy", async () => {
    renderPanel({
      getSummary: vi.fn().mockResolvedValue(emptyOrganizer),
    })

    expect(
      await screen.findByText("Add a team calendar in Feeds, or paste an invite code."),
    ).toBeInTheDocument()
  })

  it("shows no upcoming events for an empty ride window", async () => {
    renderPanel({
      getSummary: vi.fn().mockResolvedValue(memberSpace),
      listRides: vi.fn().mockResolvedValue([]),
    })

    expect(await screen.findByText("No upcoming events.")).toBeInTheDocument()
  })

  it("tells the family no kids need a ride when defaults are empty", async () => {
    renderPanel({
      getSummary: vi.fn().mockResolvedValue(memberSpace),
      listRides: vi.fn().mockResolvedValue([event({ defaultKidIds: [] })]),
    })

    expect(await screen.findByText("No kids need a ride for this event.")).toBeInTheDocument()
    expect(
      screen.queryByText("Mark who's going on Calendar to request a ride."),
    ).not.toBeInTheDocument()
  })

  it("requests a ride with all attending kids and a deselected subset", async () => {
    const user = userEvent.setup()
    const createRide = vi.fn().mockResolvedValue(ride({ requestingCircleId: "c1", status: "PENDING" }))
    const listRides = vi.fn().mockResolvedValue([event()])
    renderPanel({
      getSummary: vi.fn().mockResolvedValue(memberSpace),
      listRides,
      createRide,
    })

    expect(await screen.findByRole("checkbox", { name: "Mia" })).toBeChecked()
    expect(screen.getByRole("checkbox", { name: "Leo" })).toBeChecked()
    await user.click(screen.getByRole("button", { name: "Request" }))
    expect(createRide).toHaveBeenCalledWith("tok", "s1", { eventKey: "UID:practice" })
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Request" })).toBeEnabled()
    })

    await user.click(screen.getByRole("checkbox", { name: "Leo" }))
    await user.click(screen.getByRole("button", { name: "Request" }))
    expect(createRide).toHaveBeenLastCalledWith("tok", "s1", {
      eventKey: "UID:practice",
      kidIds: ["k1"],
    })
  })

  it("accepts with the default eligible vehicle, cancels, and withdraws", async () => {
    const user = userEvent.setup()
    const pendingOther = event({
      defaultKidIds: [],
      otherRequests: [ride({ id: "ride-1", status: "PENDING", seats: 1 })],
    })
    const acceptedOther = event({
      defaultKidIds: [],
      otherRequests: [
        ride({
          id: "ride-1",
          status: "ACCEPTED",
          seats: 1,
          acceptingCircleId: "c1",
          acceptingCircleName: "House A",
          vehicleId: "v1",
          vehicleLabel: "Van",
        }),
      ],
    })
    const ownPending = event({
      defaultKidIds: [],
      ownRequest: ride({
        id: "ride-2",
        requestingCircleId: "c1",
        status: "PENDING",
        kidFirstNames: ["Mia"],
      }),
    })
    let phase: "accept" | "withdraw" | "own" = "accept"
    const listRides = vi.fn().mockImplementation(async () => {
      if (phase === "accept") return [pendingOther]
      if (phase === "withdraw") return [acceptedOther]
      return [ownPending]
    })
    const acceptRide = vi.fn().mockImplementation(async () => {
      phase = "withdraw"
    })
    const withdrawRide = vi.fn().mockImplementation(async () => {
      phase = "own"
    })
    const cancelRide = vi.fn().mockResolvedValue({})

    renderPanel(
      {
        getSummary: vi.fn().mockResolvedValue(memberSpace),
        listRides,
        acceptRide,
        withdrawRide,
        cancelRide,
      },
      { family: { getGarage: vi.fn().mockResolvedValue(garageWithVan) } },
    )

    await user.click(await screen.findByRole("button", { name: "Accept" }))
    expect(acceptRide).toHaveBeenCalledWith("tok", "s1", "ride-1", { vehicleId: "v1" })
    expect(await screen.findByRole("button", { name: "Withdraw" })).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Withdraw" }))
    expect(withdrawRide).toHaveBeenCalledWith("tok", "s1", "ride-1")
    expect(await screen.findByRole("button", { name: "Cancel" })).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Cancel" }))
    expect(cancelRide).toHaveBeenCalledWith("tok", "s1", "ride-2")
  })

  it("passes a pending other ask and keeps Accept-after-Pass", async () => {
    const user = userEvent.setup()
    let passed = false
    const listRides = vi.fn().mockImplementation(async () => [
      event({
        defaultKidIds: [],
        otherRequests: [ride({ id: "ride-1", status: "PENDING", passedByMe: passed })],
      }),
    ])
    const passRide = vi.fn().mockImplementation(async () => {
      passed = true
    })

    renderPanel(
      {
        getSummary: vi.fn().mockResolvedValue(memberSpace),
        listRides,
        passRide,
      },
      { family: { getGarage: vi.fn().mockResolvedValue(garageWithVan) } },
    )

    await user.click(await screen.findByRole("button", { name: "Pass" }))
    expect(passRide).toHaveBeenCalledWith("tok", "s1", "ride-1")
    expect(await screen.findByText("Passed")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Accept" })).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Pass" })).not.toBeInTheDocument()
  })
})
