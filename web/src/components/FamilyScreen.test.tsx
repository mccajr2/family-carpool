import { render, screen, waitFor, within } from "@testing-library/react"
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
    expect(await within(screen.getByLabelText("Kids")).findByText("Sam")).toBeInTheDocument()

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

  it("lets caregivers add and remove manual events", async () => {
    const user = userEvent.setup()
    const session = new AuthSessionHolder()
    session.setSession("tok", {
      id: "2",
      email: "other@example.com",
      displayName: "Jordan",
    })

    const listEvents = vi.fn().mockResolvedValue([])
    const createEvent = vi.fn().mockResolvedValue({
      id: "e1",
      title: "Dentist",
      startsAt: "2026-08-15T17:00:00.000Z",
      endsAt: "2026-08-15T18:00:00.000Z",
      location: "Clinic",
      kidIds: ["k1"],
    })
    const deleteEvent = vi.fn().mockResolvedValue(undefined)

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
            kids: [{ id: "k1", displayName: "Sam" }],
            places: [],
          }),
          listEvents,
          createEvent,
          deleteEvent,
        })}
        onSignedOut={vi.fn()}
      />,
    )

    const events = await screen.findByLabelText("Manual events")
    expect(within(events).getByText("No manual events yet.")).toBeInTheDocument()
    expect(listEvents).toHaveBeenCalledWith("tok")

    await user.type(screen.getByLabelText("New event title"), "Dentist")
    const startInput = screen.getByLabelText("New event start")
    const endInput = screen.getByLabelText("New event end")
    await user.clear(startInput)
    await user.type(startInput, "2030-08-15T13:00")
    await user.clear(endInput)
    await user.type(endInput, "2030-08-15T14:00")
    await user.type(screen.getByLabelText("New event location"), "Clinic")
    await user.click(screen.getByLabelText("Assign Sam to new event"))
    await user.click(screen.getByRole("button", { name: "Add event" }))

    expect(await within(events).findByText("Dentist")).toBeInTheDocument()
    expect(within(events).getByText("Sam")).toBeInTheDocument()
    expect(createEvent).toHaveBeenCalledWith(
      "tok",
      "Dentist",
      expect.stringMatching(/2030-08-15T/),
      ["k1"],
      expect.stringMatching(/2030-08-15T/),
      "Clinic",
    )

    await user.click(within(events).getByRole("button", { name: "Remove event" }))
    await waitFor(() => {
      expect(within(events).queryByText("Dentist")).not.toBeInTheDocument()
    })
    expect(deleteEvent).toHaveBeenCalledWith("tok", "e1")
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

  it("lets organizers add sync and remove activity feeds", async () => {
    const user = userEvent.setup()
    const session = new AuthSessionHolder()
    session.setSession("tok", {
      id: "1",
      email: "parent@example.com",
      displayName: "Alex",
    })

    const createFeed = vi.fn().mockResolvedValue({
      id: "f1",
      name: "U12 Travel",
      sourceUrl: "https://example.com/team.ics",
      kidIds: ["k1"],
      lastSyncedAt: "2026-08-10T12:00:00Z",
      lastSyncError: null,
      eventCount: 4,
    })
    const syncFeed = vi.fn().mockResolvedValue({
      id: "f1",
      name: "U12 Travel",
      sourceUrl: "https://example.com/team.ics",
      kidIds: ["k1"],
      lastSyncedAt: "2026-08-10T12:05:00Z",
      lastSyncError: "Fetch failed",
      eventCount: 4,
    })
    const deleteFeed = vi.fn().mockResolvedValue(undefined)

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
            kids: [{ id: "k1", displayName: "Sam" }],
            places: [],
          }),
          getInvite: vi.fn().mockResolvedValue({ code: "AB12CD34" }),
          listFeeds: vi.fn().mockResolvedValue([]),
          createFeed,
          syncFeed,
          deleteFeed,
        })}
        onSignedOut={vi.fn()}
      />,
    )

    expect(await screen.findByText("No feeds yet.")).toBeInTheDocument()
    await user.type(screen.getByLabelText("New feed name"), "U12 Travel")
    await user.type(screen.getByLabelText("New feed URL"), "https://example.com/team.ics")
    await user.click(screen.getByLabelText("Assign Sam to new feed"))
    await user.click(screen.getByRole("button", { name: "Add feed" }))

    expect(await screen.findByText("U12 Travel")).toBeInTheDocument()
    expect(screen.getByText("Sam · Synced · 4 events")).toBeInTheDocument()
    expect(createFeed).toHaveBeenCalledWith(
      "tok",
      "U12 Travel",
      "https://example.com/team.ics",
      ["k1"],
    )

    await user.click(screen.getByRole("button", { name: "Sync now" }))
    expect(await screen.findByText("Sam · Sync failed: Fetch failed")).toBeInTheDocument()
    expect(syncFeed).toHaveBeenCalledWith("tok", "f1")

    await user.click(
      within(screen.getByLabelText("Activity feeds")).getByRole("button", {
        name: "Remove",
      }),
    )
    await waitFor(() => {
      expect(screen.queryByText("U12 Travel")).not.toBeInTheDocument()
    })
    expect(deleteFeed).toHaveBeenCalledWith("tok", "f1")
  })

  it("hides the source URL in the feed list until editing", async () => {
    const user = userEvent.setup()
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
            places: [],
          }),
          getInvite: vi.fn().mockResolvedValue({ code: "AB12CD34" }),
          listFeeds: vi.fn().mockResolvedValue([
            {
              id: "f1",
              name: "U12 Travel",
              sourceUrl: "https://very-long.example.com/path/to/calendar/subscribe.ics",
              kidIds: [],
              lastSyncedAt: "2026-08-10T12:00:00Z",
              lastSyncError: null,
              eventCount: 4,
            },
          ]),
        })}
        onSignedOut={vi.fn()}
      />,
    )

    const feeds = await screen.findByLabelText("Activity feeds")
    expect(within(feeds).getByText("U12 Travel")).toBeInTheDocument()
    expect(within(feeds).getByText("Synced · 4 events")).toBeInTheDocument()
    expect(
      screen.queryByText("https://very-long.example.com/path/to/calendar/subscribe.ics"),
    ).not.toBeInTheDocument()

    await user.click(within(feeds).getByRole("button", { name: "Edit" }))
    expect(
      within(feeds).getByDisplayValue(
        "https://very-long.example.com/path/to/calendar/subscribe.ics",
      ),
    ).toBeInTheDocument()
  })

  it("hides activity feed management from caregivers", async () => {
    const session = new AuthSessionHolder()
    session.setSession("tok", {
      id: "2",
      email: "other@example.com",
      displayName: "Jordan",
    })

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
        })}
        onSignedOut={vi.fn()}
      />,
    )

    expect(await screen.findByText("No places yet.")).toBeInTheDocument()
    expect(screen.queryByLabelText("Activity feeds")).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Add feed" })).not.toBeInTheDocument()
  })

  it("refreshes feeds from the list endpoint without syncing", async () => {
    const user = userEvent.setup()
    const session = new AuthSessionHolder()
    session.setSession("tok", {
      id: "1",
      email: "parent@example.com",
      displayName: "Alex",
    })

    const listFeeds = vi
      .fn()
      .mockResolvedValueOnce([
        {
          id: "f1",
          name: "U12 Travel",
          sourceUrl: "https://example.com/team.ics",
          kidIds: [],
          lastSyncedAt: "2026-08-10T12:00:00Z",
          lastSyncError: null,
          eventCount: 2,
        },
      ])
      .mockResolvedValueOnce([
        {
          id: "f1",
          name: "U12 Travel",
          sourceUrl: "https://example.com/team.ics",
          kidIds: [],
          lastSyncedAt: "2026-08-10T12:30:00Z",
          lastSyncError: null,
          eventCount: 5,
        },
      ])
    const syncFeed = vi.fn()

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
            places: [],
          }),
          getInvite: vi.fn().mockResolvedValue({ code: "AB12CD34" }),
          listFeeds,
          syncFeed,
        })}
        onSignedOut={vi.fn()}
      />,
    )

    const feeds = await screen.findByLabelText("Activity feeds")
    expect(within(feeds).getByText("Synced · 2 events")).toBeInTheDocument()

    await user.click(within(feeds).getByRole("button", { name: "Refresh" }))

    expect(await within(feeds).findByText("Synced · 5 events")).toBeInTheDocument()
    expect(listFeeds).toHaveBeenCalledTimes(2)
    expect(syncFeed).not.toHaveBeenCalled()
  })
})
