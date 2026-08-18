import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import type { CarpoolClient } from "@/api/carpoolClient"
import type { CarpoolSummary } from "@/api/types"
import { CarpoolPanel } from "@/components/CarpoolPanel"

function mockCarpoolClient(partial: Partial<CarpoolClient>): CarpoolClient {
  return partial as CarpoolClient
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

describe("CarpoolPanel", () => {
  it("shows loading then empty copy without sending caregivers to Feeds", async () => {
    const getSummary = vi.fn().mockResolvedValue(emptyCaregiver)
    render(
      <CarpoolPanel
        accessToken="tok"
        carpoolClient={mockCarpoolClient({ getSummary })}
      />,
    )

    expect(screen.getByText("Loading carpool…")).toBeInTheDocument()
    expect(
      await screen.findByText("Paste an invite code to join a team carpool."),
    ).toBeInTheDocument()
    expect(screen.queryByText(/Feeds/)).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Have a code?" })).toBeInTheDocument()
  })

  it("surfaces load errors", async () => {
    const getSummary = vi.fn().mockRejectedValue(new Error("backend not reachable"))
    render(
      <CarpoolPanel
        accessToken="tok"
        carpoolClient={mockCarpoolClient({ getSummary })}
      />,
    )

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

    render(
      <CarpoolPanel
        accessToken="tok"
        carpoolClient={mockCarpoolClient({ getSummary, enable })}
      />,
    )

    await user.click(await screen.findByRole("button", { name: "Enable" }))
    expect(enable).toHaveBeenCalledWith("tok", "f1")
    expect(await screen.findByText("AB12CD34")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Open" })).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Enable carpool" })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Open carpool" })).not.toBeInTheDocument()
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

    render(
      <CarpoolPanel
        accessToken="tok"
        carpoolClient={mockCarpoolClient({ getSummary, admit, join })}
        onJoined={onJoined}
      />,
    )

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
    render(
      <CarpoolPanel
        accessToken="tok"
        carpoolClient={mockCarpoolClient({
          getSummary: vi.fn().mockResolvedValue(emptyOrganizer),
        })}
      />,
    )

    expect(
      await screen.findByText("Add a team calendar in Feeds, or paste an invite code."),
    ).toBeInTheDocument()
  })
})
