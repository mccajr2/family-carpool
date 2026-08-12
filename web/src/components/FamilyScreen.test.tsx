import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import type { AuthClient } from "@/api/authClient"
import { AuthSessionHolder } from "@/api/authSession"
import { FamilyClient } from "@/api/familyClient"
import type { CalendarItem } from "@/api/types"
import { FamilyScreen } from "@/components/FamilyScreen"

function mockFamilyClient(partial: Partial<FamilyClient>): FamilyClient {
  return partial as FamilyClient
}

function mockAuthClient(partial: Partial<AuthClient>): AuthClient {
  return partial as AuthClient
}

/** Test fixture with leave-by fields required by the OpenAPI CalendarItem schema. */
function calendarItem(
  partial: Pick<CalendarItem, "id" | "source" | "title" | "startsAt" | "kidIds"> &
    Partial<CalendarItem>,
): CalendarItem {
  return {
    endsAt: null,
    location: null,
    feedId: null,
    feedName: null,
    leaveFromPlaceId: null,
    leaveFromPlaceName: null,
    leaveByAt: null,
    leaveByStatus: "UNAVAILABLE",
    leaveByReason: "NO_ORIGIN",
    coverages: [],
    uncoveredKidIds: [],
    ...partial,
  }
}

function circleFixture(
  partial: {
    id: string
    name: string | null
    role: "ORGANIZER" | "CAREGIVER"
    members: Array<{
      adultId: string
      email: string
      displayName: string | null
      role: "ORGANIZER" | "CAREGIVER"
    }>
    kids: Array<{ id: string; displayName: string }>
    places: Array<{
      id: string
      name: string
      address: string
      latitude: number | null
      longitude: number | null
    }>
  } & Partial<{
    defaultLeaveFromPlaceId: string | null
    defaultLeaveFromPlaceName: string | null
  }>,
) {
  return {
    defaultLeaveFromPlaceId: null,
    defaultLeaveFromPlaceName: null,
    ...partial,
  }
}

async function goTo(
  user: ReturnType<typeof userEvent.setup>,
  destination: "Calendar" | "Carpool" | "Family" | "Places" | "Feeds",
) {
  await user.click(await screen.findByRole("button", { name: destination }))
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

    expect(await screen.findByRole("heading", { name: "Calendar" })).toBeInTheDocument()
    await goTo(user, "Family")
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

    expect(await screen.findByRole("heading", { name: "Calendar" })).toBeInTheDocument()
    await goTo(user, "Family")
    expect(await screen.findByRole("heading", { name: "House" })).toBeInTheDocument()
    expect(screen.getByText(/other@example.com · CAREGIVER/)).toBeInTheDocument()
    expect(joinCircle).toHaveBeenCalledWith("tok", {
      code: "AB12CD34",
      adultDisplayName: "Jordan",
    })
    expect(screen.queryByLabelText("New kid name")).not.toBeInTheDocument()
    await goTo(user, "Places")
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

    await goTo(user, "Family")
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

    await goTo(user, "Family")
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

    await goTo(user, "Places")
    expect(await screen.findByText("No places yet.")).toBeInTheDocument()
    await user.type(screen.getByLabelText("New place name"), "Mom's house")
    await user.type(screen.getByLabelText("New place address"), "123 Main St")
    await user.click(screen.getByRole("button", { name: "Add place" }))

    const places = await screen.findByLabelText("Places")
    expect(within(places).getByText("Mom's house")).toBeInTheDocument()
    expect(within(places).getByText("123 Main St")).toBeInTheDocument()
    expect(within(places).getByText("Located")).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Retry locate" })).not.toBeInTheDocument()
    expect(addPlace).toHaveBeenCalledWith("tok", "Mom's house", "123 Main St")

    await user.click(within(places).getByRole("button", { name: "Remove place" }))
    await waitFor(() => {
      expect(screen.queryByText("Mom's house")).not.toBeInTheDocument()
    })
    expect(deletePlace).toHaveBeenCalledWith("tok", "p1")
  })

  it("lets caregivers add and remove manual events from the agenda", async () => {
    const user = userEvent.setup()
    const session = new AuthSessionHolder()
    session.setSession("tok", {
      id: "2",
      email: "other@example.com",
      displayName: "Jordan",
    })

    const created = calendarItem({
      id: "e1",
      source: "MANUAL",
      title: "Dentist",
      startsAt: "2030-08-15T17:00:00.000Z",
      endsAt: "2030-08-15T18:00:00.000Z",
      location: "Clinic",
      kidIds: ["k1"],
    })
    let calendar: CalendarItem[] = []
    const listCalendar = vi.fn().mockImplementation(async () => [...calendar])
    const createEvent = vi.fn().mockImplementation(async () => {
      calendar = [created]
      return {
        id: created.id,
        title: created.title,
        startsAt: created.startsAt,
        endsAt: created.endsAt,
        location: created.location,
        kidIds: created.kidIds,
      }
    })
    const deleteEvent = vi.fn().mockImplementation(async () => {
      calendar = []
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
            kids: [{ id: "k1", displayName: "Sam" }],
            places: [],
          }),
          listCalendar,
          createEvent,
          deleteEvent,
        })}
        onSignedOut={vi.fn()}
      />,
    )

    const agenda = await screen.findByLabelText("Agenda")
    expect(
      within(agenda).getByText("No events in the loaded window."),
    ).toBeInTheDocument()
    expect(screen.queryByLabelText("New event title")).not.toBeInTheDocument()
    expect(screen.queryByLabelText("Event title")).not.toBeInTheDocument()
    expect(
      within(agenda).queryByRole("button", { name: "Add event" }),
    ).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Add event" })).toBeInTheDocument()
    expect(listCalendar).toHaveBeenCalledWith(
      "tok",
      expect.any(String),
      expect.any(String),
    )

    await user.click(screen.getByRole("button", { name: "Add event" }))
    const compose = await screen.findByRole("dialog", { name: "Add event" })
    await user.type(within(compose).getByLabelText("Event title"), "Dentist")
    const startInput = within(compose).getByLabelText("Event start")
    const endInput = within(compose).getByLabelText("Event end")
    await user.clear(startInput)
    await user.type(startInput, "2030-08-15T13:00")
    await user.clear(endInput)
    await user.type(endInput, "2030-08-15T14:00")
    await user.type(within(compose).getByLabelText("Event location"), "Clinic")
    await user.click(within(compose).getByLabelText("Assign Sam to event"))
    await user.click(within(compose).getByRole("button", { name: "Save" }))

    expect(await within(agenda).findByText("Dentist")).toBeInTheDocument()
    expect(within(agenda).getByText("Manual")).toBeInTheDocument()
    expect(within(agenda).getAllByText("Sam").length).toBeGreaterThanOrEqual(1)
    expect(createEvent).toHaveBeenCalledWith(
      "tok",
      "Dentist",
      expect.stringMatching(/2030-08-15T/),
      ["k1"],
      expect.stringMatching(/2030-08-15T/),
      "Clinic",
    )
    expect(screen.queryByRole("dialog", { name: "Add event" })).not.toBeInTheDocument()

    await user.click(within(agenda).getByRole("button", { name: "Remove event" }))
    await waitFor(() => {
      expect(within(agenda).queryByText("Dentist")).not.toBeInTheDocument()
    })
    expect(deleteEvent).toHaveBeenCalledWith("tok", "e1")
  })

  it("cancels edit compose without updating the event", async () => {
    const user = userEvent.setup()
    const session = new AuthSessionHolder()
    session.setSession("tok", {
      id: "2",
      email: "other@example.com",
      displayName: "Jordan",
    })

    const updateEvent = vi.fn()
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
                adultId: "2",
                email: "other@example.com",
                displayName: "Jordan",
                role: "CAREGIVER",
              },
            ],
            kids: [{ id: "k1", displayName: "Sam" }],
            places: [],
          }),
          listCalendar: vi.fn().mockResolvedValue([
            calendarItem({
              id: "e1",
              source: "MANUAL",
              title: "Dentist",
              startsAt: "2030-08-15T17:00:00.000Z",
              endsAt: "2030-08-15T18:00:00.000Z",
              location: "Clinic",
              kidIds: ["k1"],
            }),
          ]),
          updateEvent,
        })}
        onSignedOut={vi.fn()}
      />,
    )

    const agenda = await screen.findByLabelText("Agenda")
    expect(await within(agenda).findByText("Dentist")).toBeInTheDocument()
    await user.click(within(agenda).getByRole("button", { name: "Edit" }))

    const compose = await screen.findByRole("dialog", { name: "Edit event" })
    const title = within(compose).getByLabelText("Event title")
    await user.clear(title)
    await user.type(title, "Should discard")
    await user.click(within(compose).getByRole("button", { name: "Cancel" }))

    expect(screen.queryByRole("dialog", { name: "Edit event" })).not.toBeInTheDocument()
    expect(within(agenda).getByText("Dentist")).toBeInTheDocument()
    expect(within(agenda).queryByText("Should discard")).not.toBeInTheDocument()
    expect(updateEvent).not.toHaveBeenCalled()
  })

  it("opens the same compose dialog to edit a manual event", async () => {
    const user = userEvent.setup()
    const session = new AuthSessionHolder()
    session.setSession("tok", {
      id: "2",
      email: "other@example.com",
      displayName: "Jordan",
    })

    const created = calendarItem({
      id: "e1",
      source: "MANUAL",
      title: "Dentist",
      startsAt: "2030-08-15T17:00:00.000Z",
      endsAt: "2030-08-15T18:00:00.000Z",
      location: "Clinic",
      kidIds: ["k1"],
    })
    let calendar = [created]
    const listCalendar = vi.fn().mockImplementation(async () => [...calendar])
    const updateEvent = vi.fn().mockImplementation(async () => {
      calendar = [
        {
          ...created,
          title: "Orthodontist",
          location: "Ortho",
        },
      ]
      return {
        id: created.id,
        title: "Orthodontist",
        startsAt: created.startsAt,
        endsAt: created.endsAt,
        location: "Ortho",
        kidIds: created.kidIds,
      }
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
                adultId: "2",
                email: "other@example.com",
                displayName: "Jordan",
                role: "CAREGIVER",
              },
            ],
            kids: [{ id: "k1", displayName: "Sam" }],
            places: [],
          }),
          listCalendar,
          updateEvent,
        })}
        onSignedOut={vi.fn()}
      />,
    )

    const agenda = await screen.findByLabelText("Agenda")
    expect(await within(agenda).findByText("Dentist")).toBeInTheDocument()
    await user.click(within(agenda).getByRole("button", { name: "Edit" }))

    const compose = await screen.findByRole("dialog", { name: "Edit event" })
    const title = within(compose).getByLabelText("Event title")
    await user.clear(title)
    await user.type(title, "Orthodontist")
    const location = within(compose).getByLabelText("Event location")
    await user.clear(location)
    await user.type(location, "Ortho")
    await user.click(within(compose).getByRole("button", { name: "Save" }))

    expect(await within(agenda).findByText("Orthodontist")).toBeInTheDocument()
    expect(within(agenda).getByText("Ortho")).toBeInTheDocument()
    expect(updateEvent).toHaveBeenCalledWith(
      "tok",
      "e1",
      "Orthodontist",
      expect.stringMatching(/2030-08-15T/),
      ["k1"],
      expect.stringMatching(/2030-08-15T/),
      "Ortho",
    )
    expect(screen.queryByRole("dialog", { name: "Edit event" })).not.toBeInTheDocument()
  })

  it("loads the next 30 days when Load more is pressed", async () => {
    const user = userEvent.setup()
    const session = new AuthSessionHolder()
    session.setSession("tok", {
      id: "2",
      email: "other@example.com",
      displayName: "Jordan",
    })

    const listCalendar = vi
      .fn()
      .mockResolvedValueOnce([
        calendarItem({
          id: "e1",
          source: "MANUAL",
          title: "Near",
          startsAt: "2030-08-15T17:00:00.000Z",
          kidIds: ["k1"],
        }),
      ])
      .mockResolvedValueOnce([
        calendarItem({
          id: "e2",
          source: "MANUAL",
          title: "Later",
          startsAt: "2030-09-20T17:00:00.000Z",
          kidIds: ["k1"],
        }),
      ])

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
                adultId: "2",
                email: "other@example.com",
                displayName: "Jordan",
                role: "CAREGIVER",
              },
            ],
            kids: [{ id: "k1", displayName: "Sam" }],
            places: [],
          }),
          listCalendar,
        })}
        onSignedOut={vi.fn()}
      />,
    )

    const agenda = await screen.findByLabelText("Agenda")
    expect(await within(agenda).findByText("Near")).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Load more" }))
    expect(await within(agenda).findByText("Later")).toBeInTheDocument()
    expect(within(agenda).getByText("Near")).toBeInTheDocument()
    expect(listCalendar).toHaveBeenCalledTimes(2)
    const secondCall = listCalendar.mock.calls[1]
    expect(secondCall[1]).toBe(listCalendar.mock.calls[0][2])
  })

  it("filters agenda by kid and keeps feed rows read-only", async () => {
    const user = userEvent.setup()
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
                adultId: "2",
                email: "other@example.com",
                displayName: "Jordan",
                role: "CAREGIVER",
              },
            ],
            kids: [
              { id: "k1", displayName: "Sam" },
              { id: "k2", displayName: "Riley" },
            ],
            places: [],
          }),
          listCalendar: vi.fn().mockResolvedValue([
            calendarItem({
              id: "e1",
              source: "MANUAL",
              title: "Dentist",
              startsAt: "2030-08-15T17:00:00.000Z",
              kidIds: ["k1"],
            }),
            calendarItem({
              id: "f1",
              source: "FEED",
              title: "Practice",
              startsAt: "2030-08-16T17:00:00.000Z",
              location: "Field",
              kidIds: ["k2"],
              feedId: "feed1",
              feedName: "Soccer",
            }),
          ]),
        })}
        onSignedOut={vi.fn()}
      />,
    )

    const agenda = await screen.findByLabelText("Agenda")
    expect(within(agenda).getByText("Dentist")).toBeInTheDocument()
    expect(within(agenda).getByText("Practice")).toBeInTheDocument()
    expect(within(agenda).getByText("Soccer")).toBeInTheDocument()
    expect(within(agenda).getAllByRole("button", { name: "Edit" })).toHaveLength(1)
    expect(within(agenda).getAllByRole("button", { name: "Remove event" })).toHaveLength(1)

    await user.click(screen.getByRole("button", { name: "Riley" }))
    expect(within(agenda).queryByText("Dentist")).not.toBeInTheDocument()
    expect(within(agenda).getByText("Practice")).toBeInTheDocument()
    expect(within(agenda).queryByRole("button", { name: "Edit" })).not.toBeInTheDocument()
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

    await goTo(user, "Places")
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
    const listCalendar = vi.fn().mockResolvedValue([])

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
          listCalendar,
          createFeed,
          syncFeed,
          deleteFeed,
        })}
        onSignedOut={vi.fn()}
      />,
    )

    await goTo(user, "Feeds")
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
    expect(listCalendar.mock.calls.length).toBeGreaterThanOrEqual(2)

    const calendarCallsBeforeSync = listCalendar.mock.calls.length
    await user.click(screen.getByRole("button", { name: "Sync now" }))
    expect(await screen.findByText("Sam · Sync failed: Fetch failed")).toBeInTheDocument()
    expect(syncFeed).toHaveBeenCalledWith("tok", "f1")
    await waitFor(() => {
      expect(listCalendar.mock.calls.length).toBeGreaterThan(calendarCallsBeforeSync)
    })

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

    await goTo(user, "Feeds")
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
    const user = userEvent.setup()
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

    expect(await screen.findByRole("heading", { name: "Calendar" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Carpool" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Places" })).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Feeds" })).not.toBeInTheDocument()
    expect(screen.queryByLabelText("Activity feeds")).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Add feed" })).not.toBeInTheDocument()

    await goTo(user, "Carpool")
    expect(await screen.findByRole("heading", { name: "Carpool" })).toBeInTheDocument()
    expect(screen.getByLabelText("Carpool")).toHaveTextContent("Coming soon")
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

    await goTo(user, "Feeds")
    const feeds = await screen.findByLabelText("Activity feeds")
    expect(within(feeds).getByText("Synced · 2 events")).toBeInTheDocument()

    await user.click(within(feeds).getByRole("button", { name: "Refresh" }))

    expect(await within(feeds).findByText("Synced · 5 events")).toBeInTheDocument()
    expect(listFeeds).toHaveBeenCalledTimes(2)
    expect(syncFeed).not.toHaveBeenCalled()
  })

  it("shows sidebar destinations with Settings groups and carpool placeholder", async () => {
    const user = userEvent.setup()
    const session = new AuthSessionHolder()
    session.setSession("tok", {
      id: "1",
      email: "parent@example.com",
      displayName: "Alex",
    })
    const logout = vi.fn().mockResolvedValue(undefined)
    const onSignedOut = vi.fn()

    render(
      <FamilyScreen
        session={session}
        authClient={mockAuthClient({ logout })}
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
          listFeeds: vi.fn().mockResolvedValue([]),
          listCalendar: vi.fn().mockResolvedValue([]),
        })}
        onSignedOut={onSignedOut}
      />,
    )

    const nav = await screen.findByLabelText("App navigation")
    expect(within(nav).getByRole("button", { name: "Calendar" })).toHaveAttribute(
      "aria-current",
      "page",
    )
    expect(within(nav).getByRole("button", { name: "Carpool" })).toBeInTheDocument()
    expect(within(nav).getByRole("button", { name: "Family" })).toBeInTheDocument()
    expect(within(nav).getByLabelText("Settings")).toBeInTheDocument()
    expect(within(nav).getByLabelText("General")).toBeInTheDocument()
    expect(within(nav).getByRole("button", { name: "Places" })).toBeInTheDocument()
    expect(within(nav).getByRole("button", { name: "Feeds" })).toBeInTheDocument()
    expect(within(nav).getByLabelText("Account")).toBeInTheDocument()
    expect(within(nav).getByText("parent@example.com")).toBeInTheDocument()
    expect(within(nav).getByText("ORGANIZER")).toBeInTheDocument()

    await goTo(user, "Carpool")
    expect(await screen.findByRole("heading", { name: "Carpool" })).toBeInTheDocument()
    expect(screen.getByLabelText("Carpool")).toHaveTextContent("Coming soon")

    await user.click(within(nav).getByRole("button", { name: "Sign out" }))
    await waitFor(() => {
      expect(logout).toHaveBeenCalled()
      expect(onSignedOut).toHaveBeenCalled()
    })
  })

  it("shows leave-by estimate and lets the adult change leave-from", async () => {
    const user = userEvent.setup()
    const session = new AuthSessionHolder()
    session.setSession("tok", {
      id: "1",
      email: "parent@example.com",
      displayName: "Alex",
    })

    const setCalendarLeaveFrom = vi.fn().mockResolvedValue(
      calendarItem({
        id: "e1",
        source: "MANUAL",
        title: "Practice",
        startsAt: "2030-08-15T17:00:00.000Z",
        location: "Rink",
        kidIds: ["k1"],
        leaveFromPlaceId: "p2",
        leaveFromPlaceName: "Dad's house",
        leaveByAt: "2030-08-15T16:20:00.000Z",
        leaveByStatus: "OK",
        leaveByReason: null,
      }),
    )

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
            places: [
              {
                id: "p1",
                name: "Mom's house",
                address: "1 Main",
                latitude: 40.1,
                longitude: -74.1,
              },
              {
                id: "p2",
                name: "Dad's house",
                address: "2 Main",
                latitude: 40.2,
                longitude: -74.2,
              },
              {
                id: "p3",
                name: "Unlocated",
                address: "Mystery",
                latitude: null,
                longitude: null,
              },
            ],
          }),
          listCalendar: vi.fn().mockResolvedValue([
            calendarItem({
              id: "e1",
              source: "MANUAL",
              title: "Practice",
              startsAt: "2030-08-15T17:00:00.000Z",
              location: "Rink",
              kidIds: ["k1"],
              leaveFromPlaceId: "p1",
              leaveFromPlaceName: "Mom's house",
              leaveByAt: "2030-08-15T16:30:00.000Z",
              leaveByStatus: "OK",
              leaveByReason: null,
            }),
          ]),
          listFeeds: vi.fn().mockResolvedValue([]),
          getInvite: vi.fn().mockResolvedValue({ code: "AB12CD34" }),
          setCalendarLeaveFrom,
        })}
        onSignedOut={vi.fn()}
      />,
    )

    const agenda = await screen.findByLabelText("Agenda")
    const leaveBy = await within(agenda).findByTestId("leave-by-MANUAL-e1")
    expect(leaveBy.textContent).toMatch(/^Leave by ~/)
    expect(leaveBy.textContent).toMatch(/ · estimate$/)
    expect(leaveBy.textContent?.toLowerCase()).not.toMatch(/\beta\b/)
    expect(leaveBy.textContent?.toLowerCase()).not.toContain("live traffic")

    const leaveFrom = within(agenda).getByLabelText("Leave from for Practice")
    expect(leaveFrom).toHaveValue("p1")
    expect(within(leaveFrom).getByRole("option", { name: "Unlocated (not located)" })).toBeDisabled()

    await user.selectOptions(leaveFrom, "p2")
    await waitFor(() => {
      expect(setCalendarLeaveFrom).toHaveBeenCalledWith("tok", "MANUAL", "e1", {
        leaveFromPlaceId: "p2",
      })
    })
    expect(leaveFrom).toHaveValue("p2")
  })

  it("shows UNAVAILABLE reasons with Places and Edit location recovery", async () => {
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
            role: "CAREGIVER",
            members: [
              {
                adultId: "1",
                email: "parent@example.com",
                displayName: "Alex",
                role: "CAREGIVER",
              },
            ],
            kids: [{ id: "k1", displayName: "Sam" }],
            places: [],
          }),
          listCalendar: vi.fn().mockResolvedValue([
            calendarItem({
              id: "e-origin",
              source: "MANUAL",
              title: "No origin",
              startsAt: "2030-08-15T17:00:00.000Z",
              location: "Rink",
              kidIds: ["k1"],
              leaveByStatus: "UNAVAILABLE",
              leaveByReason: "NO_ORIGIN",
            }),
            calendarItem({
              id: "e-dest",
              source: "MANUAL",
              title: "No dest",
              startsAt: "2030-08-16T17:00:00.000Z",
              kidIds: ["k1"],
              leaveFromPlaceId: "p1",
              leaveFromPlaceName: "Home",
              leaveByStatus: "UNAVAILABLE",
              leaveByReason: "NO_DESTINATION",
            }),
            calendarItem({
              id: "e-feed",
              source: "FEED",
              title: "Feed game",
              startsAt: "2030-08-17T17:00:00.000Z",
              kidIds: ["k1"],
              feedId: "f1",
              feedName: "U12",
              leaveByStatus: "UNAVAILABLE",
              leaveByReason: "GEOCODE_FAILED",
            }),
          ]),
        })}
        onSignedOut={vi.fn()}
      />,
    )

    const agenda = await screen.findByLabelText("Agenda")
    expect(within(agenda).getByTestId("leave-by-MANUAL-e-origin")).toHaveTextContent(
      "No leave-from place yet",
    )
    expect(within(agenda).getByTestId("leave-by-MANUAL-e-dest")).toHaveTextContent(
      "Add a location to estimate leave-by",
    )
    expect(within(agenda).getByTestId("leave-by-FEED-e-feed")).toHaveTextContent(
      "Couldn't locate the destination",
    )

    await user.click(within(agenda).getByRole("button", { name: "Open Places" }))
    expect(await screen.findByRole("heading", { name: "Places" })).toBeInTheDocument()

    await goTo(user, "Calendar")
    const agendaAgain = await screen.findByLabelText("Agenda")
    await user.click(within(agendaAgain).getByRole("button", { name: "Edit location" }))
    expect(await screen.findByRole("dialog", { name: "Edit event" })).toBeInTheDocument()
    expect(screen.getByLabelText("Event location")).toBeInTheDocument()

    // FEED rows do not get Edit location
    expect(within(agendaAgain).queryAllByRole("button", { name: "Edit location" })).toHaveLength(1)
  })

  it("shows needs coverage when uncovered kids are present", async () => {
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
          getCircle: vi.fn().mockResolvedValue(
            circleFixture({
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
              kids: [
                { id: "k1", displayName: "Sam" },
                { id: "k2", displayName: "Riley" },
              ],
              places: [],
            }),
          ),
          listCalendar: vi.fn().mockResolvedValue([
            calendarItem({
              id: "e1",
              source: "MANUAL",
              title: "Practice",
              startsAt: "2030-08-15T17:00:00.000Z",
              kidIds: ["k1", "k2"],
              uncoveredKidIds: ["k2"],
            }),
          ]),
        })}
        onSignedOut={vi.fn()}
      />,
    )

    const agenda = await screen.findByLabelText("Agenda")
    expect(within(agenda).getByText("Needs coverage: Riley")).toBeInTheDocument()
  })

  it("assigns coverage for uncovered kids", async () => {
    const user = userEvent.setup()
    const session = new AuthSessionHolder()
    session.setSession("tok", {
      id: "1",
      email: "parent@example.com",
      displayName: "Alex",
    })

    const baseItem = calendarItem({
      id: "e1",
      source: "MANUAL",
      title: "Practice",
      startsAt: "2030-08-15T17:00:00.000Z",
      kidIds: ["k1", "k2"],
      uncoveredKidIds: ["k2"],
    })
    const assignCalendarCoverage = vi.fn().mockResolvedValue({
      ...baseItem,
      uncoveredKidIds: [],
      coverages: [
        {
          id: "cov1",
          coveringAdultId: "2",
          coveringAdultDisplayName: "Jordan",
          assignedByAdultId: "1",
          kidIds: ["k2"],
          status: "PENDING",
        },
      ],
    })

    render(
      <FamilyScreen
        session={session}
        familyClient={mockFamilyClient({
          getCircle: vi.fn().mockResolvedValue(
            circleFixture({
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
              kids: [
                { id: "k1", displayName: "Sam" },
                { id: "k2", displayName: "Riley" },
              ],
              places: [],
            }),
          ),
          listCalendar: vi.fn().mockResolvedValue([baseItem]),
          assignCalendarCoverage,
        })}
        onSignedOut={vi.fn()}
      />,
    )

    const agenda = await screen.findByLabelText("Agenda")
    await user.selectOptions(
      within(agenda).getByLabelText("Covering adult for Practice"),
      "2",
    )
    await user.click(within(agenda).getByLabelText("Cover Riley for Practice"))
    await user.click(within(agenda).getByRole("button", { name: "Assign coverage" }))

    await waitFor(() => {
      expect(assignCalendarCoverage).toHaveBeenCalledWith("tok", "MANUAL", "e1", {
        coveringAdultId: "2",
        kidIds: ["k2"],
      })
    })
    expect(within(agenda).getByText(/Jordan · Riley · Pending/)).toBeInTheDocument()
    expect(within(agenda).queryByText("Needs coverage: Riley")).not.toBeInTheDocument()
  })

  it("lets the assignee confirm a pending coverage assignment", async () => {
    const user = userEvent.setup()
    const session = new AuthSessionHolder()
    session.setSession("tok", {
      id: "2",
      email: "other@example.com",
      displayName: "Jordan",
    })

    const baseItem = calendarItem({
      id: "e1",
      source: "MANUAL",
      title: "Practice",
      startsAt: "2030-08-15T17:00:00.000Z",
      kidIds: ["k1"],
      uncoveredKidIds: [],
      coverages: [
        {
          id: "cov1",
          coveringAdultId: "2",
          coveringAdultDisplayName: "Jordan",
          assignedByAdultId: "1",
          kidIds: ["k1"],
          status: "PENDING",
        },
      ],
    })
    const confirmCalendarCoverage = vi.fn().mockResolvedValue({
      ...baseItem,
      coverages: [
        {
          ...baseItem.coverages[0],
          status: "CONFIRMED",
        },
      ],
    })

    render(
      <FamilyScreen
        session={session}
        familyClient={mockFamilyClient({
          getCircle: vi.fn().mockResolvedValue(
            circleFixture({
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
          ),
          listCalendar: vi.fn().mockResolvedValue([baseItem]),
          confirmCalendarCoverage,
        })}
        onSignedOut={vi.fn()}
      />,
    )

    const agenda = await screen.findByLabelText("Agenda")
    expect(within(agenda).getByText(/Jordan · Sam · Pending/)).toBeInTheDocument()
    await user.click(within(agenda).getByRole("button", { name: "Confirm coverage" }))

    await waitFor(() => {
      expect(confirmCalendarCoverage).toHaveBeenCalledWith("tok", "cov1")
    })
    expect(within(agenda).getByText(/Jordan · Sam · Confirmed/)).toBeInTheDocument()
    expect(
      within(agenda).queryByRole("button", { name: "Confirm coverage" }),
    ).not.toBeInTheDocument()
  })

  it("sets default leave-from from the Places screen", async () => {
    const user = userEvent.setup()
    const session = new AuthSessionHolder()
    session.setSession("tok", {
      id: "1",
      email: "parent@example.com",
      displayName: "Alex",
    })

    const setDefaultLeaveFrom = vi.fn().mockResolvedValue(
      circleFixture({
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
            name: "Mom's house",
            address: "1 Main",
            latitude: 40.1,
            longitude: -74.1,
          },
          {
            id: "p2",
            name: "Dad's house",
            address: "2 Main",
            latitude: 40.2,
            longitude: -74.2,
          },
        ],
        defaultLeaveFromPlaceId: "p2",
        defaultLeaveFromPlaceName: "Dad's house",
      }),
    )

    render(
      <FamilyScreen
        session={session}
        familyClient={mockFamilyClient({
          getCircle: vi.fn().mockResolvedValue(
            circleFixture({
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
                  name: "Mom's house",
                  address: "1 Main",
                  latitude: 40.1,
                  longitude: -74.1,
                },
                {
                  id: "p2",
                  name: "Dad's house",
                  address: "2 Main",
                  latitude: 40.2,
                  longitude: -74.2,
                },
              ],
            }),
          ),
          setDefaultLeaveFrom,
        })}
        onSignedOut={vi.fn()}
      />,
    )

    await goTo(user, "Places")
    const select = await screen.findByLabelText("My default leave-from")
    await user.selectOptions(select, "p2")

    await waitFor(() => {
      expect(setDefaultLeaveFrom).toHaveBeenCalledWith("tok", { placeId: "p2" })
    })
    expect(select).toHaveValue("p2")
  })
})
