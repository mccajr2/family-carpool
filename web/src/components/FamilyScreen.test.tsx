import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import type { AuthClient } from "@/api/authClient"
import { AuthSessionHolder } from "@/api/authSession"
import { FamilyClient } from "@/api/familyClient"
import { FamilyScreen } from "@/components/FamilyScreen"

function mockFamilyClient(partial: Partial<FamilyClient>): FamilyClient {
  return partial as FamilyClient
}

function mockAuthClient(partial: Partial<AuthClient>): AuthClient {
  return partial as AuthClient
}

describe("FamilyScreen", () => {
  it("creates a circle then adds and removes a kid", async () => {
    const user = userEvent.setup()
    const session = new AuthSessionHolder()
    session.setSession("tok", {
      id: "1",
      email: "parent@example.com",
      displayName: null,
    })

    const getCircle = vi.fn().mockResolvedValue(null)
    const createCircle = vi.fn().mockResolvedValue({
      id: "c1",
      name: null,
      role: "ORGANIZER",
      members: [
        {
          adultId: "1",
          email: "parent@example.com",
          displayName: "Alex",
          role: "ORGANIZER",
        },
      ],
      kids: [],
      places: [],
    })
    const getInvite = vi.fn().mockResolvedValue({ code: "AB12CD34" })
    const addKid = vi.fn().mockResolvedValue({ id: "k1", displayName: "Sam" })
    const deleteKid = vi.fn().mockResolvedValue(undefined)
    const getMe = vi.fn().mockResolvedValue({
      id: "1",
      email: "parent@example.com",
      displayName: "Alex",
    })
    const logout = vi.fn().mockResolvedValue(undefined)
    const onSignedOut = vi.fn()

    render(
      <FamilyScreen
        session={session}
        authClient={mockAuthClient({ getMe, logout })}
        familyClient={mockFamilyClient({
          getCircle,
          createCircle,
          getInvite,
          addKid,
          deleteKid,
        })}
        onSignedOut={onSignedOut}
      />,
    )

    expect(await screen.findByRole("button", { name: "Create family" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Have an invite code?" })).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Create family" }))
    expect(screen.getByRole("heading", { name: "Create your family" })).toBeInTheDocument()

    await user.type(screen.getByLabelText("Your name"), "Alex")
    await user.click(screen.getByRole("button", { name: "Create family" }))

    expect(await screen.findByRole("heading", { name: "Your family" })).toBeInTheDocument()
    expect(await screen.findByText(/Invite code:/)).toHaveTextContent("AB12CD34")
    expect(createCircle).toHaveBeenCalledWith("tok", {
      adultDisplayName: "Alex",
      name: null,
    })
    expect(session.getAdult()?.displayName).toBe("Alex")

    await user.type(screen.getByLabelText("New kid name"), "Sam")
    await user.click(screen.getByRole("button", { name: "Add kid" }))
    expect(await screen.findByText("Sam")).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Remove" }))
    await waitFor(() => {
      expect(screen.queryByText("Sam")).not.toBeInTheDocument()
    })
    expect(deleteKid).toHaveBeenCalledWith("tok", "k1")
  })

  it("joins a circle with an invite code", async () => {
    const user = userEvent.setup()
    const session = new AuthSessionHolder()
    session.setSession("tok", {
      id: "2",
      email: "other@example.com",
      displayName: null,
    })

    const joinCircle = vi.fn().mockResolvedValue({
      id: "c1",
      name: "House",
      role: "CAREGIVER",
      members: [
        {
          adultId: "1",
          email: "parent@example.com",
          displayName: "Alex",
          role: "ORGANIZER",
        },
        {
          adultId: "2",
          email: "other@example.com",
          displayName: "Jordan",
          role: "CAREGIVER",
        },
      ],
      kids: [],
      places: [],
    })
    const getMe = vi.fn().mockResolvedValue({
      id: "2",
      email: "other@example.com",
      displayName: "Jordan",
    })

    render(
      <FamilyScreen
        session={session}
        authClient={mockAuthClient({ getMe })}
        familyClient={mockFamilyClient({
          getCircle: vi.fn().mockResolvedValue(null),
          joinCircle,
        })}
        onSignedOut={vi.fn()}
      />,
    )

    await user.click(await screen.findByRole("button", { name: "Have an invite code?" }))
    await user.type(screen.getByLabelText("Invite code"), "AB12CD34")
    await user.type(screen.getByLabelText("Your name"), "Jordan")
    await user.click(screen.getByRole("button", { name: "Join family" }))

    expect(await screen.findByRole("heading", { name: "House" })).toBeInTheDocument()
    expect(screen.getByText(/other@example.com · CAREGIVER/)).toBeInTheDocument()
    expect(joinCircle).toHaveBeenCalledWith("tok", {
      code: "AB12CD34",
      adultDisplayName: "Jordan",
    })
    expect(screen.queryByLabelText("New kid name")).not.toBeInTheDocument()
    expect(screen.getByLabelText("New place name")).toBeInTheDocument()
  })

  it("organizer can promote demote remove and leave", async () => {
    const user = userEvent.setup()
    const session = new AuthSessionHolder()
    session.setSession("tok", {
      id: "1",
      email: "parent@example.com",
      displayName: "Alex",
    })

    const updateMemberRole = vi.fn().mockResolvedValue({
      id: "c1",
      name: "House",
      role: "ORGANIZER",
      members: [
        {
          adultId: "1",
          email: "parent@example.com",
          displayName: "Alex",
          role: "ORGANIZER",
        },
        {
          adultId: "2",
          email: "other@example.com",
          displayName: "Jordan",
          role: "ORGANIZER",
        },
      ],
      kids: [],
      places: [],
    })
    const removeMember = vi.fn().mockResolvedValue(undefined)
    const leaveCircle = vi.fn().mockResolvedValue(undefined)

    render(
      <FamilyScreen
        session={session}
        familyClient={mockFamilyClient({
          getCircle: vi.fn().mockResolvedValue({
            id: "c1",
            name: "House",
            role: "ORGANIZER",
            members: [
              {
                adultId: "1",
                email: "parent@example.com",
                displayName: "Alex",
                role: "ORGANIZER",
              },
              {
                adultId: "2",
                email: "other@example.com",
                displayName: "Jordan",
                role: "CAREGIVER",
              },
            ],
            kids: [],
            places: [],
          }),
          getInvite: vi.fn().mockResolvedValue({ code: "AB12CD34" }),
          updateMemberRole,
          removeMember,
          leaveCircle,
        })}
        onSignedOut={vi.fn()}
      />,
    )

    expect(await screen.findByText(/Jordan · CAREGIVER/)).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Promote" }))
    expect(updateMemberRole).toHaveBeenCalledWith("tok", "2", "ORGANIZER")

    await user.click(screen.getByRole("button", { name: "Remove" }))
    expect(removeMember).toHaveBeenCalledWith("tok", "2")

    await user.click(screen.getByRole("button", { name: "Leave family" }))
    expect(leaveCircle).toHaveBeenCalledWith("tok")
    expect(await screen.findByRole("button", { name: "Create family" })).toBeInTheDocument()
  })

  it("shows named circle title when name is set", async () => {
    const session = new AuthSessionHolder()
    session.setSession("tok", {
      id: "1",
      email: "parent@example.com",
      displayName: "Alex",
    })

    render(
      <FamilyScreen
        session={session}
        familyClient={mockFamilyClient({
          getCircle: vi.fn().mockResolvedValue({
            id: "c1",
            name: "McCarthy house",
            role: "ORGANIZER",
            members: [
              {
                adultId: "1",
                email: "parent@example.com",
                displayName: "Alex",
                role: "ORGANIZER",
              },
            ],
            kids: [],
            places: [],
          }),
          getInvite: vi.fn().mockResolvedValue({ code: "ZZ99YY88" }),
        })}
        onSignedOut={vi.fn()}
      />,
    )

    expect(await screen.findByRole("heading", { name: "McCarthy house" })).toBeInTheDocument()
  })

  it("caregiver can add and remove a place", async () => {
    const user = userEvent.setup()
    const session = new AuthSessionHolder()
    session.setSession("tok", {
      id: "2",
      email: "other@example.com",
      displayName: "Jordan",
    })

    const addPlace = vi.fn().mockResolvedValue({
      id: "p1",
      name: "Mom's house",
      address: "123 Main St",
      latitude: 40.1,
      longitude: -74.2,
    })
    const deletePlace = vi.fn().mockResolvedValue(undefined)

    render(
      <FamilyScreen
        session={session}
        familyClient={mockFamilyClient({
          getCircle: vi.fn().mockResolvedValue({
            id: "c1",
            name: "House",
            role: "CAREGIVER",
            members: [
              {
                adultId: "1",
                email: "parent@example.com",
                displayName: "Alex",
                role: "ORGANIZER",
              },
              {
                adultId: "2",
                email: "other@example.com",
                displayName: "Jordan",
                role: "CAREGIVER",
              },
            ],
            kids: [],
            places: [],
          }),
          addPlace,
          deletePlace,
        })}
        onSignedOut={vi.fn()}
      />,
    )

    expect(await screen.findByText("No places yet.")).toBeInTheDocument()
    await user.type(screen.getByLabelText("New place name"), "Mom's house")
    await user.type(screen.getByLabelText("New place address"), "123 Main St")
    await user.click(screen.getByRole("button", { name: "Add place" }))

    expect(await screen.findByText("Mom's house")).toBeInTheDocument()
    expect(screen.getByText("123 Main St")).toBeInTheDocument()
    expect(screen.getByText("Located")).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Retry locate" })).not.toBeInTheDocument()
    expect(addPlace).toHaveBeenCalledWith("tok", "Mom's house", "123 Main St")

    await user.click(screen.getByRole("button", { name: "Remove place" }))
    await waitFor(() => {
      expect(screen.queryByText("Mom's house")).not.toBeInTheDocument()
    })
    expect(deletePlace).toHaveBeenCalledWith("tok", "p1")
  })

  it("shows not located and retries locate", async () => {
    const user = userEvent.setup()
    const session = new AuthSessionHolder()
    session.setSession("tok", {
      id: "1",
      email: "parent@example.com",
      displayName: "Alex",
    })

    const locatePlace = vi.fn().mockResolvedValue({
      id: "p1",
      name: "School",
      address: "1 School Rd",
      latitude: 40.5,
      longitude: -74.1,
    })

    render(
      <FamilyScreen
        session={session}
        familyClient={mockFamilyClient({
          getCircle: vi.fn().mockResolvedValue({
            id: "c1",
            name: "House",
            role: "ORGANIZER",
            members: [
              {
                adultId: "1",
                email: "parent@example.com",
                displayName: "Alex",
                role: "ORGANIZER",
              },
            ],
            kids: [],
            places: [
              {
                id: "p1",
                name: "School",
                address: "1 School Rd",
                latitude: null,
                longitude: null,
              },
            ],
          }),
          locatePlace,
        })}
        onSignedOut={vi.fn()}
      />,
    )

    expect(await screen.findByText("Not located")).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Retry locate" }))
    expect(await screen.findByText("Located")).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Retry locate" })).not.toBeInTheDocument()
    expect(locatePlace).toHaveBeenCalledWith("tok", "p1")
  })

  it("loads the circle only once when using the default FamilyClient", async () => {
    const session = new AuthSessionHolder()
    session.setSession("tok", {
      id: "1",
      email: "parent@example.com",
      displayName: null,
    })
    const getCircle = vi
      .spyOn(FamilyClient.prototype, "getCircle")
      .mockResolvedValue(null)

    render(<FamilyScreen session={session} onSignedOut={vi.fn()} />)

    expect(await screen.findByRole("button", { name: "Create family" })).toBeInTheDocument()
    await waitFor(() => {
      expect(getCircle).toHaveBeenCalledTimes(1)
    })
    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(getCircle).toHaveBeenCalledTimes(1)

    getCircle.mockRestore()
  })
})
