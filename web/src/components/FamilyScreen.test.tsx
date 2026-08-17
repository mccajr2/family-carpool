import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import type { AuthClient } from "@/api/authClient"
import { AuthSessionHolder } from "@/api/authSession"
import { CalendarCacheStore, CALENDAR_CACHE_SOFT_TTL_MS } from "@/api/calendarCacheStore"
import { FamilyBootstrapStore } from "@/api/familyBootstrapStore"
import { CarpoolClient } from "@/api/carpoolClient"
import { FamilyClient } from "@/api/familyClient"
import type { CalendarItem } from "@/api/types"
import { defaultCalendarWindow, nearTermLeaveByWindow, remainderAfterNearTermLeaveByWindow } from "@/components/eventTimes"
import { LEAVE_BY_PENDING_LABEL } from "@/components/leaveByDisplay"
import { FamilyScreen } from "@/components/FamilyScreen"

function mockFamilyClient(partial: Partial<FamilyClient>): FamilyClient {
  return {
    listCalendarLeaveBy: vi.fn().mockResolvedValue([]),
    getGarage: vi.fn().mockResolvedValue({ members: [], vehicles: [] }),
    ...partial,
  } as FamilyClient
}

function mockCarpoolClient(partial: Partial<CarpoolClient> = {}): CarpoolClient {
  return {
    getSummary: vi.fn().mockResolvedValue({
      circleRole: "ORGANIZER",
      feeds: [],
      spaces: [],
    }),
    ...partial,
  } as CarpoolClient
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
    conflicts: [],
    rsvps: partial.kidIds.map((kidId) => ({ kidId, status: "NO_RESPONSE" as const })),
    ...partial,
  }
}

/** Earlier uncovered item so a later fixture stays a collapsed Agenda row. */
function earlierFocusDecoy(kidId = "k1"): CalendarItem {
  return calendarItem({
    id: "focus-decoy",
    source: "FEED",
    title: "Focus decoy",
    startsAt: "2030-08-01T12:00:00.000Z",
    kidIds: [kidId],
    uncoveredKidIds: [kidId],
    feedName: "Decoy",
  })
}

async function expandAgendaItem(
  user: ReturnType<typeof userEvent.setup>,
  item: HTMLElement,
) {
  await user.click(within(item).getByRole("button", { expanded: false }))
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
  destination: "Calendar" | "Carpool" | "Family" | "Places" | "Garage" | "Feeds",
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
    expect(screen.getByRole("button", { name: "Create family" }).closest("[class*='max-w-5xl']")).not.toBeNull()
    expect(screen.getByRole("button", { name: "Have an invite code?" })).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Create family" }))
    expect(screen.getByRole("heading", { name: "Create your family" })).toBeInTheDocument()

    await user.type(screen.getByLabelText("Your name"), "Alex")
    await user.click(screen.getByRole("button", { name: "Create family" }))

    const calendarHeading = await screen.findByRole("heading", { name: "Calendar" })
    expect(calendarHeading).toHaveClass("fc-display")
    await goTo(user, "Family")
    expect(await screen.findByRole("heading", { name: "Your family" })).toBeInTheDocument()
    expect(screen.getByLabelText("App navigation").closest("[class*='max-w-5xl']")).toBeNull()
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

  it("clears bootstrap and calendar cache when leaving the circle", async () => {
    const user = userEvent.setup()
    const session = new AuthSessionHolder()
    session.setSession("tok", {
      id: "1",
      email: "parent@example.com",
      displayName: "Alex",
    })
    const circle = circleFixture({
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
    const window = defaultCalendarWindow()
    const bootstrap = new FamilyBootstrapStore()
    bootstrap.save({
      adultId: "1",
      email: "parent@example.com",
      adultDisplayName: "Alex",
      circle,
      inviteCode: "AB12CD34",
      feeds: [],
    })
    const cache = new CalendarCacheStore()
    cache.save({
      adultId: "1",
      circleId: "c1",
      from: window.from,
      to: window.to,
      items: [
        calendarItem({
          id: "e1",
          source: "MANUAL",
          title: "Cached Practice",
          startsAt: "2030-08-15T17:00:00.000Z",
          kidIds: ["k1"],
        }),
      ],
      fetchedAt: Date.now(),
    })
    const leaveCircle = vi.fn().mockResolvedValue(undefined)

    render(
      <FamilyScreen
        session={session}
        calendarCacheStore={cache}
        bootstrapCacheStore={bootstrap}
        familyClient={mockFamilyClient({
          getCircle: vi.fn().mockResolvedValue(circle),
          getInvite: vi.fn().mockResolvedValue({ code: "AB12CD34" }),
          listFeeds: vi.fn().mockResolvedValue([]),
          listCalendar: vi.fn().mockResolvedValue([]),
          leaveCircle,
        })}
        onSignedOut={vi.fn()}
      />,
    )

    await goTo(user, "Family")
    await user.click(await screen.findByRole("button", { name: "Leave family" }))
    expect(leaveCircle).toHaveBeenCalledWith("tok")
    expect(await screen.findByRole("button", { name: "Create family" })).toBeInTheDocument()
    expect(bootstrap.load("1")).toBeNull()
    expect(cache.load("1", "c1")).toBeNull()
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

  it("shows Saving on the event dialog and keeps Sign out labeled while busy", async () => {
    const user = userEvent.setup()
    const session = new AuthSessionHolder()
    session.setSession("tok", {
      id: "2",
      email: "other@example.com",
      displayName: "Jordan",
    })

    let finishSave!: () => void
    const updateEvent = vi.fn().mockImplementation(
      () =>
        new Promise((resolve) => {
          finishSave = () =>
            resolve({
              id: "e1",
              title: "Orthodontist",
              startsAt: "2030-08-15T17:00:00.000Z",
              endsAt: "2030-08-15T18:00:00.000Z",
              location: "Clinic",
              kidIds: ["k1"],
            })
        }),
    )

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
    await user.click(within(agenda).getByRole("button", { name: "Edit" }))
    const compose = await screen.findByRole("dialog", { name: "Edit event" })
    await user.click(within(compose).getByRole("button", { name: "Save" }))

    expect(await within(compose).findByRole("button", { name: "Saving…" })).toBeDisabled()
    expect(compose).toHaveAttribute("aria-busy", "true")
    const nav = screen.getByLabelText("App navigation")
    expect(within(nav).getByRole("button", { name: "Sign out" })).toBeInTheDocument()
    expect(within(nav).queryByRole("button", { name: "Working…" })).not.toBeInTheDocument()
    expect(within(agenda).queryByTestId("agenda-busy")).not.toBeInTheDocument()
    expect(within(compose).queryByTestId("event-compose-busy")).not.toBeInTheDocument()

    finishSave()
    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: "Edit event" })).not.toBeInTheDocument()
    })
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
    expect(await within(agenda).findByTestId("agenda-item-MANUAL-e2")).toBeInTheDocument()
    expect(within(agenda).getByText("Near")).toBeInTheDocument()
    expect(listCalendar).toHaveBeenCalledTimes(2)
    const secondCall = listCalendar.mock.calls[1]
    expect(secondCall[1]).toBe(listCalendar.mock.calls[0][2])
  })

  it("hides empty agenda copy while Load more is in flight", async () => {
    const user = userEvent.setup()
    const session = new AuthSessionHolder()
    session.setSession("tok", {
      id: "2",
      email: "other@example.com",
      displayName: "Jordan",
    })

    let finishLoadMore!: () => void
    const listCalendar = vi
      .fn()
      .mockResolvedValueOnce([])
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            finishLoadMore = () => resolve([])
          }),
      )

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
    expect(
      within(agenda).getByText("No events in the loaded window."),
    ).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Load more" }))
    await waitFor(() => {
      expect(
        within(agenda).queryByText("No events in the loaded window."),
      ).not.toBeInTheDocument()
      expect(screen.getByRole("button", { name: /Loading/ })).toBeInTheDocument()
    })

    finishLoadMore()
    expect(
      await within(agenda).findByText("No events in the loaded window."),
    ).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Load more" })).toBeInTheDocument()
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
    await expandAgendaItem(user, within(agenda).getByTestId("agenda-item-FEED-f1"))
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
        carpoolClient={mockCarpoolClient()}
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
        carpoolClient={mockCarpoolClient()}
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
        carpoolClient={mockCarpoolClient({
          getSummary: vi.fn().mockResolvedValue({
            circleRole: "CAREGIVER",
            feeds: [],
            spaces: [],
          }),
        })}
        onSignedOut={vi.fn()}
      />,
    )

    expect(await screen.findByRole("heading", { name: "Calendar" })).toBeInTheDocument()
    const nav = screen.getByLabelText("App navigation")
    expect(screen.getByLabelText("Context")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Carpool" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Places" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Garage" })).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Feeds" })).not.toBeInTheDocument()
    const account = within(nav).getByLabelText("Account")
    expect(within(account).getByText("J")).toBeInTheDocument()
    expect(within(account).getByText("other@example.com")).toBeInTheDocument()
    expect(within(account).getByText("Caregiver")).toBeInTheDocument()
    expect(screen.queryByLabelText("Activity feeds")).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Add feed" })).not.toBeInTheDocument()

    await goTo(user, "Carpool")
    expect(await screen.findByRole("heading", { name: "Carpool" })).toBeInTheDocument()
    expect(screen.queryByLabelText("Context")).not.toBeInTheDocument()
    expect(
      await screen.findByText("Paste an invite code to join a team carpool."),
    ).toBeInTheDocument()
    expect(screen.queryByText("Coming soon")).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Enable" })).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Have a code?" })).toBeInTheDocument()
  })

  it("lets organizers enable carpool from Feeds after confirming ownership", async () => {
    const user = userEvent.setup()
    vi.spyOn(window, "confirm").mockReturnValue(true)
    const session = new AuthSessionHolder()
    session.setSession("tok", {
      id: "1",
      email: "parent@example.com",
      displayName: "Alex",
    })
    const noneSummary = {
      circleRole: "ORGANIZER" as const,
      feeds: [
        {
          feedId: "f1",
          feedName: "U12 Travel",
          status: "NONE" as const,
          spaceId: null,
          spaceName: null,
        },
      ],
      spaces: [],
    }
    const ownerSummary = {
      circleRole: "ORGANIZER" as const,
      feeds: [
        {
          feedId: "f1",
          feedName: "U12 Travel",
          status: "OWNER" as const,
          spaceId: "s1",
          spaceName: "U12 Travel",
        },
      ],
      spaces: [],
    }
    const getSummary = vi.fn().mockResolvedValue(noneSummary)
    const enable = vi.fn().mockImplementation(async () => {
      getSummary.mockResolvedValue(ownerSummary)
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
              sourceUrl: "https://example.com/team.ics",
              kidIds: [],
              lastSyncedAt: "2026-08-10T12:00:00Z",
              lastSyncError: null,
              eventCount: 4,
            },
          ]),
        })}
        carpoolClient={mockCarpoolClient({ getSummary, enable })}
        onSignedOut={vi.fn()}
      />,
    )

    await goTo(user, "Feeds")
    const feeds = await screen.findByLabelText("Activity feeds")
    await user.click(await within(feeds).findByRole("button", { name: "Enable" }))
    expect(enable).toHaveBeenCalledWith("tok", "f1")
    expect(await within(feeds).findByRole("button", { name: "Open" })).toBeInTheDocument()
    expect(within(feeds).getByText("Owned")).toBeInTheDocument()
  })

  it("reloads feeds and calendar after joining a carpool by code", async () => {
    const user = userEvent.setup()
    const session = new AuthSessionHolder()
    session.setSession("tok", {
      id: "1",
      email: "parent@example.com",
      displayName: "Alex",
    })
    let joined = false
    const soccerFeed = {
      id: "f1",
      name: "Soccer",
      sourceUrl: "https://example.com/team.ics",
      kidIds: [] as string[],
      lastSyncedAt: "2026-08-10T12:00:00Z",
      lastSyncError: null,
      eventCount: 3,
    }
    const practice = calendarItem({
      id: "e1",
      source: "FEED",
      title: "Practice",
      startsAt: "2026-08-20T16:00:00Z",
      kidIds: [],
      feedId: "f1",
      feedName: "Soccer",
    })
    const emptySummary = {
      circleRole: "ORGANIZER" as const,
      feeds: [] as const,
      spaces: [] as const,
    }
    const memberSummary = {
      circleRole: "ORGANIZER" as const,
      feeds: [
        {
          feedId: "f1",
          feedName: "Soccer",
          status: "MEMBER" as const,
          spaceId: "s1",
          spaceName: "Soccer",
        },
      ],
      spaces: [
        {
          id: "s1",
          name: "Soccer",
          membership: "MEMBER" as const,
          inviteCode: "AB12CD34",
          callerFeedId: "f1",
          members: [
            { circleId: "c1", circleName: "House A", membership: "OWNER" as const },
            { circleId: "c2", circleName: "House B", membership: "MEMBER" as const },
          ],
          pendingRequests: [],
        },
      ],
    }
    const listFeeds = vi.fn().mockImplementation(async () => (joined ? [soccerFeed] : []))
    const listCalendar = vi.fn().mockImplementation(async () => (joined ? [practice] : []))
    const getSummary = vi.fn().mockImplementation(async () =>
      joined ? memberSummary : emptySummary,
    )
    const join = vi.fn().mockImplementation(async () => {
      joined = true
    })

    render(
      <FamilyScreen
        session={session}
        familyClient={mockFamilyClient({
          getCircle: vi.fn().mockResolvedValue({
            id: "c2",
            name: "House B",
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
          listFeeds,
          listCalendar,
        })}
        carpoolClient={mockCarpoolClient({ getSummary, join })}
        onSignedOut={vi.fn()}
      />,
    )

    expect(await screen.findByRole("heading", { name: "Calendar" })).toBeInTheDocument()
    expect(screen.queryByText("Practice")).not.toBeInTheDocument()

    await goTo(user, "Carpool")
    await user.click(await screen.findByRole("button", { name: "Have a code?" }))
    await user.type(screen.getByLabelText("Carpool invite code"), "AB12CD34")
    await user.click(screen.getByRole("button", { name: "Join" }))
    await waitFor(() => {
      expect(join).toHaveBeenCalledWith("tok", "AB12CD34")
    })

    await goTo(user, "Feeds")
    const feeds = await screen.findByLabelText("Activity feeds")
    expect(await within(feeds).findByText("Soccer")).toBeInTheDocument()
    expect(listFeeds.mock.calls.length).toBeGreaterThanOrEqual(2)

    await goTo(user, "Calendar")
    expect(await screen.findByText("Practice")).toBeInTheDocument()
    expect(listCalendar.mock.calls.length).toBeGreaterThanOrEqual(2)
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
        carpoolClient={mockCarpoolClient()}
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

  it("shows sidebar destinations with Settings groups and a live Carpool tab", async () => {
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
        carpoolClient={mockCarpoolClient()}
        onSignedOut={onSignedOut}
      />,
    )

    const nav = await screen.findByLabelText("App navigation")
    expect(nav.className).toMatch(/--fc-rail-surface/)
    expect(nav.className).toMatch(/min-h-svh/)
    expect(nav.className).toMatch(/md:h-svh/)
    expect(nav.className).toMatch(/md:w-60/)
    expect(nav.className).not.toMatch(/md:w-56/)
    expect(nav.className).toMatch(/md:sticky/)
    expect(nav.className).not.toMatch(/fixed/)
    expect(nav.className).not.toMatch(/--fc-hero-/)
    expect(nav.className).not.toMatch(/--fc-surface-raised/)
    expect(nav.className).not.toMatch(/--fc-text-primary/)
    expect(nav.className).not.toMatch(/--fc-accent/)
    const wordmark = within(nav).getByLabelText("Wordmark")
    expect(wordmark.tagName).not.toBe("BUTTON")
    expect(wordmark.querySelector("button")).toBeNull()
    expect(wordmark.className).toMatch(/shrink-0/)
    expect(wordmark.querySelector(".fc-display")).not.toBeNull()
    expect(wordmark.querySelector("[class*='--fc-rail-accent']")).not.toBeNull()
    const calendar = within(nav).getByRole("button", { name: "Calendar" })
    expect(calendar).toHaveAttribute("aria-current", "page")
    expect(calendar.className).toMatch(/--fc-rail-active/)
    expect(calendar.className).toMatch(/text-\[var\(--fc-rail-on\)\]/)
    expect(calendar.className).not.toMatch(/--fc-rail-on-secondary/)
    expect(calendar.querySelector("svg")).not.toBeNull()
    const carpool = within(nav).getByRole("button", { name: "Carpool" })
    expect(carpool.className).toMatch(/--fc-rail-on-secondary/)
    expect(carpool.className).not.toMatch(/text-\[var\(--fc-rail-on\)\]/)
    expect(within(nav).getByRole("button", { name: "Family" })).toBeInTheDocument()
    const settings = within(nav).getByLabelText("Settings")
    expect(settings).toBeInTheDocument()
    expect(within(nav).queryByLabelText("General")).not.toBeInTheDocument()
    expect(within(nav).getByRole("button", { name: "Places" })).toBeInTheDocument()
    expect(within(nav).getByRole("button", { name: "Garage" })).toBeInTheDocument()
    expect(within(nav).getByRole("button", { name: "Feeds" })).toBeInTheDocument()
    const account = within(nav).getByLabelText("Account")
    expect(account.className).toMatch(/shrink-0/)
    expect(settings.closest("[class*='overflow-y-auto']")).not.toBeNull()
    expect(within(nav).getByLabelText("Primary").closest("[class*='overflow-y-auto']")).not.toBeNull()
    expect(account.closest("[class*='overflow-y-auto']")).toBeNull()
    expect(within(account).getByText("A")).toBeInTheDocument()
    expect(within(account).getByText("parent@example.com")).toBeInTheDocument()
    expect(within(account).getByText("Organizer")).toBeInTheDocument()
    const signOut = within(account).getByRole("button", { name: "Sign out" })
    expect(signOut.className).toMatch(/--fc-rail-danger/)
    expect(
      within(settings).queryByRole("button", {
        name: "Sign out",
      }),
    ).not.toBeInTheDocument()

    await goTo(user, "Garage")
    expect(await screen.findByRole("heading", { name: "Garage" })).toBeInTheDocument()
    expect(await screen.findByLabelText("Garage")).toBeInTheDocument()

    await goTo(user, "Carpool")
    expect(await screen.findByRole("heading", { name: "Carpool" })).toBeInTheDocument()
    expect(
      await screen.findByText("Add a team calendar in Feeds, or paste an invite code."),
    ).toBeInTheDocument()
    expect(screen.queryByText("Coming soon")).not.toBeInTheDocument()

    await user.click(within(nav).getByRole("button", { name: "Sign out" }))
    await waitFor(() => {
      expect(logout).toHaveBeenCalled()
      expect(onSignedOut).toHaveBeenCalled()
    })
  })

  it("uses an uncarded page frame with a Calendar-only Context aside", async () => {
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
          listFeeds: vi.fn().mockResolvedValue([]),
          listCalendar: vi.fn().mockResolvedValue([]),
        })}
        carpoolClient={mockCarpoolClient()}
        onSignedOut={vi.fn()}
      />,
    )

    const heading = await screen.findByRole("heading", { name: "Calendar" })
    const main = heading.closest("main")
    expect(main).not.toBeNull()
    expect(main?.className).toMatch(/flex-1/)
    expect(main?.className).not.toMatch(/shadow-sm/)
    expect(main?.className).not.toMatch(/border-border/)
    expect(main?.firstElementChild?.className).toMatch(/max-w-\[820px\]/)

    const context = screen.getByLabelText("Context")
    expect(context.tagName).toBe("ASIDE")
    expect(context.className).toMatch(/hidden/)
    expect(context.className).toMatch(/md:w-80/)
    expect(context.className).toMatch(/md:flex/)
    expect(context.className).toMatch(/--fc-border/)
    expect(context).toBeEmptyDOMElement()

    for (const destination of ["Carpool", "Family", "Places", "Garage", "Feeds"] as const) {
      await goTo(user, destination)
      expect(screen.queryByLabelText("Context")).not.toBeInTheDocument()
    }

    await goTo(user, "Calendar")
    expect(screen.getByLabelText("Context")).toBeInTheDocument()
  })

  it("offers Retry instead of Create family when the circle load fails", async () => {
    const user = userEvent.setup()
    const session = new AuthSessionHolder()
    session.setSession("tok", {
      id: "1",
      email: "parent@example.com",
      displayName: "Alex",
    })
    const getCircle = vi
      .fn()
      .mockRejectedValueOnce(new Error("Failed to fetch"))
      .mockResolvedValue({
        id: "c1",
        name: "House",
        role: "CAREGIVER",
        members: [],
        kids: [],
        places: [],
      })

    render(
      <FamilyScreen
        session={session}
        familyClient={mockFamilyClient({
          getCircle,
          listCalendar: vi.fn().mockResolvedValue([]),
        })}
        onSignedOut={vi.fn()}
      />,
    )

    expect(await screen.findByRole("alert")).toHaveTextContent("Failed to fetch")
    expect(screen.getByRole("alert").closest("[class*='max-w-5xl']")).not.toBeNull()
    expect(screen.queryByRole("button", { name: "Create family" })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Have an invite code?" })).not.toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Retry" }))

    expect(await screen.findByRole("heading", { name: "Calendar" })).toBeInTheDocument()
    expect(getCircle).toHaveBeenCalledTimes(2)
  })

  it("signs out locally when the backend cannot be reached", async () => {
    const user = userEvent.setup()
    const session = new AuthSessionHolder()
    session.setSession("tok", {
      id: "1",
      email: "parent@example.com",
      displayName: "Alex",
    })
    const logout = vi.fn().mockRejectedValue(new Error("Failed to fetch"))
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
    await user.click(within(nav).getByRole("button", { name: "Sign out" }))

    await waitFor(() => {
      expect(onSignedOut).toHaveBeenCalled()
    })
    expect(session.getAccessToken()).toBeNull()
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
    const card = await within(agenda).findByTestId("agenda-focus-MANUAL-e1")
    const leaveBy = within(card).getByText(/^Leave by ~/)
    expect(leaveBy.textContent).toMatch(/^Leave by ~/)
    expect(leaveBy.textContent).toMatch(/ · estimate$/)
    expect(leaveBy.textContent?.toLowerCase()).not.toMatch(/\beta\b/)
    expect(leaveBy.textContent?.toLowerCase()).not.toContain("live traffic")

    const leaveFrom = within(card).getByLabelText("Leave from for Practice")
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

  it("shows UNAVAILABLE leave-by reasons with Open Places recovery only", async () => {
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
    expect(
      within(agenda).getByTestId("agenda-focus-MANUAL-e-origin"),
    ).toHaveTextContent("No leave-from place yet")
    await expandAgendaItem(
      user,
      within(agenda).getByTestId("agenda-item-MANUAL-e-dest"),
    )
    await expandAgendaItem(
      user,
      within(agenda).getByTestId("agenda-item-FEED-e-feed"),
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
    // Destination recovery is via the row Edit control, not a duplicate Edit location.
    expect(
      within(agendaAgain).queryByRole("button", { name: "Edit location" }),
    ).not.toBeInTheDocument()
    expect(within(agendaAgain).getAllByRole("button", { name: "Edit" }).length).toBeGreaterThan(
      0,
    )
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

  it("separates agenda items with a clear vertical buffer", async () => {
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
              kids: [{ id: "k1", displayName: "Sam" }],
              places: [],
            }),
          ),
          listCalendar: vi.fn().mockResolvedValue([
            calendarItem({
              id: "e1",
              source: "MANUAL",
              title: "Practice",
              startsAt: "2030-08-15T17:00:00.000Z",
              kidIds: ["k1"],
            }),
            calendarItem({
              id: "e2",
              source: "MANUAL",
              title: "Game",
              startsAt: "2030-08-16T17:00:00.000Z",
              kidIds: ["k1"],
            }),
          ]),
        })}
        onSignedOut={vi.fn()}
      />,
    )

    const agenda = await screen.findByLabelText("Agenda")
    expect(agenda.className).toContain("--fc-space-xl")
    expect(within(agenda).getByTestId("agenda-kid-filter")).toBeInTheDocument()
    expect(within(agenda).getByTestId("agenda-focus-MANUAL-e1")).toBeInTheDocument()
    expect(within(agenda).queryByTestId("agenda-item-MANUAL-e1")).not.toBeInTheDocument()
    const list = within(agenda).getByTestId("agenda-list")
    expect(list.className).toContain("--fc-space-2xl")
    expect(within(list).getByRole("heading", { name: "Later" })).toBeInTheDocument()
    const rows = within(list).getAllByRole("listitem")
    expect(rows).toHaveLength(1)
    expect(rows[0]).toHaveAttribute("data-testid", "agenda-item-MANUAL-e2")
    const card = within(rows[0]).getByTestId("agenda-row-MANUAL-e2")
    expect(card.className).toContain("border-[var(--fc-border)]")
    expect(card.className).toContain("rounded-[var(--fc-radius-md)]")
    expect(card.className).toContain("bg-[var(--fc-surface-raised)]")
    expect(within(card).queryByTestId("agenda-band-people")).not.toBeInTheDocument()
  })

  it("does not also render the focus item as a flat row", async () => {
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
              kids: [{ id: "k1", displayName: "Sam" }],
              places: [],
            }),
          ),
          listCalendar: vi.fn().mockResolvedValue([
            calendarItem({
              id: "e1",
              source: "MANUAL",
              title: "Covered practice",
              startsAt: "2030-08-15T17:00:00.000Z",
              kidIds: ["k1"],
            }),
            calendarItem({
              id: "e2",
              source: "MANUAL",
              title: "Uncovered game",
              startsAt: "2030-08-16T17:00:00.000Z",
              kidIds: ["k1"],
              uncoveredKidIds: ["k1"],
            }),
          ]),
        })}
        onSignedOut={vi.fn()}
      />,
    )

    const agenda = await screen.findByLabelText("Agenda")
    expect(within(agenda).getAllByTestId(/^agenda-focus-/)).toHaveLength(1)
    expect(within(agenda).getByTestId("agenda-focus-MANUAL-e2")).toBeInTheDocument()
    expect(within(agenda).queryByTestId("agenda-item-MANUAL-e2")).not.toBeInTheDocument()
    expect(within(agenda).getByTestId("agenda-item-MANUAL-e1")).toBeInTheDocument()
    expect(within(agenda).queryByTestId("agenda-focus-MANUAL-e1")).not.toBeInTheDocument()
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
    // Single uncovered kid is auto-selected — no checkbox to click.
    expect(
      within(agenda).queryByLabelText("Cover Riley for Practice"),
    ).not.toBeInTheDocument()
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

  it("pre-selects uncovered kids and keeps default adult when deselecting", async () => {
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
      uncoveredKidIds: ["k1", "k2"],
    })
    const assignCalendarCoverage = vi.fn().mockResolvedValue({
      ...baseItem,
      uncoveredKidIds: ["k2"],
      coverages: [
        {
          id: "cov1",
          coveringAdultId: "1",
          coveringAdultDisplayName: "Alex",
          assignedByAdultId: "1",
          kidIds: ["k1"],
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
          listCalendar: vi.fn().mockResolvedValue([earlierFocusDecoy(), baseItem]),
          assignCalendarCoverage,
        })}
        onSignedOut={vi.fn()}
      />,
    )

    const agenda = await screen.findByLabelText("Agenda")
    const item = within(agenda).getByTestId("agenda-item-MANUAL-e1")
    await expandAgendaItem(user, item)
    const assignButton = within(item).getByRole("button", { name: "Assign coverage" })
    expect(assignButton).toBeEnabled()
    expect(within(item).getByLabelText("Cover Sam for Practice")).toBeChecked()
    expect(within(item).getByLabelText("Cover Riley for Practice")).toBeChecked()
    // Deselect Riley — Assign stays enabled and must not clear default adult.
    await user.click(within(item).getByLabelText("Cover Riley for Practice"))
    expect(assignButton).toBeEnabled()
    await user.click(assignButton)

    await waitFor(() => {
      expect(assignCalendarCoverage).toHaveBeenCalledWith("tok", "MANUAL", "e1", {
        coveringAdultId: "1",
        kidIds: ["k1"],
      })
    })
    expect(within(agenda).getByText(/Alex · Sam · Confirmed/)).toBeInTheDocument()
  })

  it("keeps uncovered kids pre-selected when changing covering adult", async () => {
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
      uncoveredKidIds: ["k1", "k2"],
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
          kidIds: ["k1", "k2"],
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
          listCalendar: vi.fn().mockResolvedValue([earlierFocusDecoy(), baseItem]),
          assignCalendarCoverage,
        })}
        onSignedOut={vi.fn()}
      />,
    )

    const agenda = await screen.findByLabelText("Agenda")
    const item = within(agenda).getByTestId("agenda-item-MANUAL-e1")
    await expandAgendaItem(user, item)
    const assignButton = within(item).getByRole("button", { name: "Assign coverage" })
    expect(assignButton).toBeEnabled()
    expect(within(item).getByLabelText("Cover Sam for Practice")).toBeChecked()
    expect(within(item).getByLabelText("Cover Riley for Practice")).toBeChecked()

    await user.selectOptions(
      within(item).getByLabelText("Covering adult for Practice"),
      "2",
    )
    expect(within(item).getByLabelText("Cover Sam for Practice")).toBeChecked()
    expect(within(item).getByLabelText("Cover Riley for Practice")).toBeChecked()
    expect(assignButton).toBeEnabled()

    await user.click(assignButton)
    await waitFor(() => {
      expect(assignCalendarCoverage).toHaveBeenCalledWith("tok", "MANUAL", "e1", {
        coveringAdultId: "2",
        kidIds: ["k1", "k2"],
      })
    })
  })

  it("self-assigns a sole uncovered kid without choosers", async () => {
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
      kidIds: ["k1"],
      uncoveredKidIds: ["k1"],
    })
    const assignCalendarCoverage = vi.fn().mockResolvedValue({
      ...baseItem,
      uncoveredKidIds: [],
      coverages: [
        {
          id: "cov1",
          coveringAdultId: "1",
          coveringAdultDisplayName: "Alex",
          assignedByAdultId: "1",
          kidIds: ["k1"],
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
          ),
          listCalendar: vi.fn().mockResolvedValue([baseItem]),
          assignCalendarCoverage,
        })}
        onSignedOut={vi.fn()}
      />,
    )

    const agenda = await screen.findByLabelText("Agenda")
    expect(
      within(agenda).queryByLabelText("Covering adult for Practice"),
    ).not.toBeInTheDocument()
    expect(
      within(agenda).queryByLabelText("Cover Sam for Practice"),
    ).not.toBeInTheDocument()
    await user.click(within(agenda).getByRole("button", { name: "Assign coverage" }))

    await waitFor(() => {
      expect(assignCalendarCoverage).toHaveBeenCalledWith("tok", "MANUAL", "e1", {
        coveringAdultId: "1",
        kidIds: ["k1"],
      })
    })
    expect(within(agenda).getByText(/Alex · Sam · Confirmed/)).toBeInTheDocument()
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

  it("shows amber conflict lines from server conflicts on Agenda items", async () => {
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
              kids: [{ id: "k1", displayName: "Sam" }],
              places: [],
            }),
          ),
          listCalendar: vi.fn().mockResolvedValue([
            calendarItem({
              id: "e1",
              source: "MANUAL",
              title: "Practice",
              startsAt: "2030-08-15T17:00:00.000Z",
              endsAt: "2030-08-15T18:00:00.000Z",
              kidIds: ["k1"],
              conflicts: [
                {
                  type: "KID_TIME_OVERLAP",
                  kidId: "k1",
                  adultId: null,
                  adultDisplayName: null,
                  otherSource: "MANUAL",
                  otherItemId: "e2",
                  otherTitle: "Game",
                  otherStartsAt: "2030-08-15T17:30:00.000Z",
                },
              ],
            }),
          ]),
        })}
        onSignedOut={vi.fn()}
      />,
    )

    const agenda = await screen.findByLabelText("Agenda")
    const conflicts = within(agenda).getByTestId("agenda-focus-MANUAL-e1")
    expect(within(conflicts).getByText("Sam overlaps Game")).toBeInTheDocument()
  })

  it("surfaces friendly copy when confirm hits overlapping double-CONFIRMED 409", async () => {
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
    const confirmCalendarCoverage = vi
      .fn()
      .mockRejectedValue(
        new Error("Adult is already confirmed on an overlapping calendar item"),
      )

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
    await user.click(within(agenda).getByRole("button", { name: "Confirm coverage" }))

    await waitFor(() => {
      expect(within(agenda).getByRole("alert")).toHaveTextContent(
        "Already confirmed on an overlapping event — decline or reassign first.",
      )
    })
    const item = within(agenda).getByTestId("agenda-focus-MANUAL-e1")
    expect(
      within(item).getByText(
        "Already confirmed on an overlapping event — decline or reassign first.",
      ),
    ).toBeInTheDocument()
    expect(within(agenda).getByText(/Jordan · Sam · Pending/)).toBeInTheDocument()
  })

  it("groups Agenda item bands and emphasizes Confirm as the primary CTA", async () => {
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
              places: [
                {
                  id: "p1",
                  name: "Mom's house",
                  address: "1 Main",
                  latitude: 40.1,
                  longitude: -74.1,
                },
              ],
            }),
          ),
          listCalendar: vi.fn().mockResolvedValue([
            earlierFocusDecoy(),
            calendarItem({
              id: "e1",
              source: "MANUAL",
              title: "Practice",
              startsAt: "2030-08-15T17:00:00.000Z",
              location: "Field",
              kidIds: ["k1"],
              uncoveredKidIds: [],
              leaveFromPlaceId: "p1",
              leaveFromPlaceName: "Mom's house",
              leaveByStatus: "OK",
              leaveByAt: "2030-08-15T16:30:00.000Z",
              leaveByReason: null,
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
            }),
          ]),
        })}
        onSignedOut={vi.fn()}
      />,
    )

    const agenda = await screen.findByLabelText("Agenda")
    const item = within(agenda).getByTestId("agenda-item-MANUAL-e1")
    await expandAgendaItem(user, item)
    const primary = within(item).getByTestId("agenda-band-primary")
    const travel = within(item).getByTestId("agenda-band-travel")
    const people = within(item).getByTestId("agenda-band-people")
    const coverage = within(item).getByTestId("agenda-band-coverage")

    expect(primary.compareDocumentPosition(travel) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(travel.compareDocumentPosition(people) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(people.compareDocumentPosition(coverage) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()

    expect(within(primary).getByText("Practice")).toBeInTheDocument()
    expect(within(primary).getByText(/Field/)).toBeInTheDocument()
    expect(within(travel).getByTestId("leave-by-MANUAL-e1")).toBeInTheDocument()
    expect(within(travel).getByTestId("leave-from-label-MANUAL-e1")).toHaveTextContent(
      "Mom's house",
    )
    expect(within(people).getByText("Manual")).toBeInTheDocument()
    expect(within(people).getByText("Sam")).toBeInTheDocument()
    expect(within(coverage).getByText(/Jordan · Sam · Pending/)).toBeInTheDocument()

    const primaryCta = within(coverage).getByTestId("agenda-cta-primary")
    expect(primaryCta).toHaveTextContent("Confirm coverage")
    const manualActions = within(item).getByTestId("agenda-band-manual-actions")
    expect(coverage.compareDocumentPosition(manualActions) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(within(manualActions).getByRole("button", { name: "Edit" })).toBeInTheDocument()
    expect(within(manualActions).getByRole("button", { name: "Remove event" })).toBeInTheDocument()
  })

  it("emphasizes Assign coverage as primary when Confirm is not shown", async () => {
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
              kids: [{ id: "k1", displayName: "Sam" }],
              places: [],
            }),
          ),
          listCalendar: vi.fn().mockResolvedValue([
            calendarItem({
              id: "e1",
              source: "MANUAL",
              title: "Practice",
              startsAt: "2030-08-15T17:00:00.000Z",
              kidIds: ["k1"],
              uncoveredKidIds: ["k1"],
            }),
          ]),
        })}
        onSignedOut={vi.fn()}
      />,
    )

    const agenda = await screen.findByLabelText("Agenda")
    const coverage = within(agenda).getByTestId("agenda-focus-MANUAL-e1")
    expect(within(coverage).getByRole("button", { name: "Assign coverage" })).toBeInTheDocument()
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
    expect(select.closest("[data-testid='field-row']")).toBeTruthy()
    await user.selectOptions(select, "p2")

    await waitFor(() => {
      expect(setDefaultLeaveFrom).toHaveBeenCalledWith("tok", { placeId: "p2" })
    })
    expect(select).toHaveValue("p2")
  })

  it("paints agenda from calendar cache before revalidate completes", async () => {
    const session = new AuthSessionHolder()
    session.setSession("tok", {
      id: "1",
      email: "parent@example.com",
      displayName: "Alex",
    })
    const window = defaultCalendarWindow()
    const circle = circleFixture({
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
    })
    const bootstrap = new FamilyBootstrapStore()
    bootstrap.save({
      adultId: "1",
      email: "parent@example.com",
      adultDisplayName: "Alex",
      circle,
      inviteCode: "AB12CD34",
      feeds: [],
    })
    const cache = new CalendarCacheStore()
    cache.save({
      adultId: "1",
      circleId: "c1",
      from: window.from,
      to: window.to,
      items: [
        calendarItem({
          id: "e1",
          source: "MANUAL",
          title: "Cached Practice",
          startsAt: "2030-08-15T17:00:00.000Z",
          kidIds: ["k1"],
        }),
      ],
      fetchedAt: Date.now(),
    })

    let releaseCircle!: (value: typeof circle) => void
    const getCircle = vi.fn().mockImplementation(
      () =>
        new Promise<typeof circle>((resolve) => {
          releaseCircle = resolve
        }),
    )
    let release!: (items: CalendarItem[]) => void
    const listCalendar = vi.fn().mockImplementation(
      () =>
        new Promise<CalendarItem[]>((resolve) => {
          release = resolve
        }),
    )

    render(
      <FamilyScreen
        session={session}
        calendarCacheStore={cache}
        bootstrapCacheStore={bootstrap}
        familyClient={mockFamilyClient({
          getCircle,
          getInvite: vi.fn().mockResolvedValue({ code: "AB12CD34" }),
          listFeeds: vi.fn().mockResolvedValue([]),
          listCalendar,
        })}
        onSignedOut={vi.fn()}
      />,
    )

    // Bootstrap + calendar cache paint before getCircle resolves.
    expect(screen.getByText("Cached Practice")).toBeInTheDocument()
    expect(screen.getByTestId("agenda-revalidating")).toBeInTheDocument()
    expect(listCalendar).not.toHaveBeenCalled()

    releaseCircle(circle)
    await waitFor(() => {
      expect(listCalendar).toHaveBeenCalled()
    })

    release([
      calendarItem({
        id: "e1",
        source: "MANUAL",
        title: "Fresh Practice",
        startsAt: "2030-08-15T17:00:00.000Z",
        kidIds: ["k1"],
      }),
    ])

    expect(await screen.findByText("Fresh Practice")).toBeInTheDocument()
    await waitFor(() => {
      expect(screen.queryByTestId("agenda-revalidating")).not.toBeInTheDocument()
    })
    expect(cache.load("1", "c1")?.items[0]?.title).toBe("Fresh Practice")
  })

  it("keeps cached agenda when background revalidate fails", async () => {
    const session = new AuthSessionHolder()
    session.setSession("tok", {
      id: "1",
      email: "parent@example.com",
      displayName: "Alex",
    })
    const window = defaultCalendarWindow()
    const circle = circleFixture({
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
    })
    const bootstrap = new FamilyBootstrapStore()
    bootstrap.save({
      adultId: "1",
      email: "parent@example.com",
      adultDisplayName: "Alex",
      circle,
      inviteCode: null,
      feeds: [],
    })
    const cache = new CalendarCacheStore()
    cache.save({
      adultId: "1",
      circleId: "c1",
      from: window.from,
      to: window.to,
      items: [
        calendarItem({
          id: "e1",
          source: "MANUAL",
          title: "Cached Practice",
          startsAt: "2030-08-15T17:00:00.000Z",
          kidIds: ["k1"],
        }),
      ],
      fetchedAt: Date.now(),
    })

    render(
      <FamilyScreen
        session={session}
        calendarCacheStore={cache}
        bootstrapCacheStore={bootstrap}
        familyClient={mockFamilyClient({
          getCircle: vi.fn().mockResolvedValue(circle),
          listCalendar: vi.fn().mockRejectedValue(new Error("network down")),
        })}
        onSignedOut={vi.fn()}
      />,
    )

    expect(await screen.findByText("Cached Practice")).toBeInTheDocument()
    const agenda = screen.getByLabelText("Agenda")
    expect(within(agenda).getByRole("alert")).toHaveTextContent("network down")
    expect(cache.load("1", "c1")?.items[0]?.title).toBe("Cached Practice")
  })

  it("patches persisted calendar cache on single-item coverage mutation and keeps cache after sign-out", async () => {
    const user = userEvent.setup()
    const session = new AuthSessionHolder()
    session.setSession("tok", {
      id: "1",
      email: "parent@example.com",
      displayName: "Alex",
    })
    const cache = new CalendarCacheStore()
    const confirmCalendarCoverage = vi.fn().mockResolvedValue(
      calendarItem({
        id: "e1",
        source: "MANUAL",
        title: "Game",
        startsAt: "2030-08-15T17:00:00.000Z",
        kidIds: ["k1"],
        coverages: [
          {
            id: "cov1",
            coveringAdultId: "1",
            coveringAdultDisplayName: "Alex",
            assignedByAdultId: "2",
            kidIds: ["k1"],
            status: "CONFIRMED",
          },
        ],
        uncoveredKidIds: [],
      }),
    )
    const logout = vi.fn().mockResolvedValue(undefined)
    const onSignedOut = vi.fn()

    render(
      <FamilyScreen
        session={session}
        calendarCacheStore={cache}
        authClient={mockAuthClient({ logout })}
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
              kids: [{ id: "k1", displayName: "Sam" }],
              places: [],
            }),
          ),
          getInvite: vi.fn().mockResolvedValue({ code: "AB12CD34" }),
          listFeeds: vi.fn().mockResolvedValue([]),
          listCalendar: vi.fn().mockResolvedValue([
            calendarItem({
              id: "e1",
              source: "MANUAL",
              title: "Game",
              startsAt: "2030-08-15T17:00:00.000Z",
              kidIds: ["k1"],
              coverages: [
                {
                  id: "cov1",
                  coveringAdultId: "1",
                  coveringAdultDisplayName: "Alex",
                  assignedByAdultId: "2",
                  kidIds: ["k1"],
                  status: "PENDING",
                },
              ],
              uncoveredKidIds: [],
            }),
          ]),
          confirmCalendarCoverage,
        })}
        onSignedOut={onSignedOut}
      />,
    )

    const agenda = await screen.findByLabelText("Agenda")
    expect(await within(agenda).findByText("Game")).toBeInTheDocument()
    await waitFor(() => {
      expect(cache.load("1", "c1")?.items).toHaveLength(1)
    })

    await user.click(within(agenda).getByRole("button", { name: "Confirm coverage" }))
    await waitFor(() => {
      expect(confirmCalendarCoverage).toHaveBeenCalled()
    })
    await waitFor(() => {
      expect(cache.load("1", "c1")?.items[0]?.coverages[0]?.status).toBe("CONFIRMED")
    })

    const nav = screen.getByLabelText("App navigation")
    await user.click(within(nav).getByRole("button", { name: "Sign out" }))
    await waitFor(() => {
      expect(onSignedOut).toHaveBeenCalled()
    })
    // Same adult should still have a snapshot for the next sign-in paint.
    expect(cache.load("1", "c1")?.items[0]?.coverages[0]?.status).toBe("CONFIRMED")
  })

  it("revalidates when returning to Calendar after soft TTL, not when fresh", async () => {
    const user = userEvent.setup()
    let now = 1_700_000_000_000
    vi.spyOn(Date, "now").mockImplementation(() => now)

    const session = new AuthSessionHolder()
    session.setSession("tok", {
      id: "1",
      email: "parent@example.com",
      displayName: "Alex",
    })
    const listCalendar = vi.fn().mockResolvedValue([
      calendarItem({
        id: "e1",
        source: "MANUAL",
        title: "Practice",
        startsAt: "2030-08-15T17:00:00.000Z",
        kidIds: ["k1"],
      }),
    ])

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
              kids: [{ id: "k1", displayName: "Sam" }],
              places: [],
            }),
          ),
          getInvite: vi.fn().mockResolvedValue({ code: "AB12CD34" }),
          listFeeds: vi.fn().mockResolvedValue([]),
          listCalendar,
        })}
        onSignedOut={vi.fn()}
      />,
    )

    expect(await screen.findByText("Practice")).toBeInTheDocument()
    await waitFor(() => {
      expect(listCalendar.mock.calls.length).toBeGreaterThanOrEqual(1)
    })
    const afterLoad = listCalendar.mock.calls.length

    await goTo(user, "Family")
    await goTo(user, "Calendar")
    expect(listCalendar.mock.calls.length).toBe(afterLoad)

    await goTo(user, "Family")
    now += CALENDAR_CACHE_SOFT_TTL_MS + 1
    await goTo(user, "Calendar")
    await waitFor(() => {
      expect(listCalendar.mock.calls.length).toBeGreaterThan(afterLoad)
    })

    vi.restoreAllMocks()
  })

  it("paints agenda from a cheap list before leave-by fill-in completes", async () => {
    const session = new AuthSessionHolder()
    session.setSession("tok", {
      id: "1",
      email: "parent@example.com",
      displayName: "Alex",
    })
    let releaseFill!: (rows: unknown[]) => void
    const listCalendarLeaveBy = vi.fn().mockImplementation(
      () =>
        new Promise((resolve) => {
          releaseFill = resolve
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
              ],
            }),
          ),
          getInvite: vi.fn().mockResolvedValue({ code: "AB12CD34" }),
          listFeeds: vi.fn().mockResolvedValue([]),
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
              leaveByStatus: "PENDING",
              leaveByReason: null,
            }),
          ]),
          listCalendarLeaveBy,
        })}
        onSignedOut={vi.fn()}
      />,
    )

    expect(await screen.findByText("Practice")).toBeInTheDocument()
    const card = screen.getByTestId("agenda-focus-MANUAL-e1")
    expect(within(card).getByText(LEAVE_BY_PENDING_LABEL)).toBeInTheDocument()
    const leaveFrom = screen.getByLabelText("Leave from for Practice")
    expect(leaveFrom).toBeEnabled()
    expect(within(card).getByText("Sam")).toBeInTheDocument()
    expect(listCalendarLeaveBy).toHaveBeenCalled()
    expect(screen.queryByText(/^Leave by ~/)).not.toBeInTheDocument()

    releaseFill([
      {
        id: "e1",
        source: "MANUAL",
        leaveFromPlaceId: "p1",
        leaveFromPlaceName: "Mom's house",
        leaveByAt: "2030-08-15T16:30:00.000Z",
        leaveByStatus: "OK",
        leaveByReason: null,
      },
    ])

    await waitFor(() => {
      expect(
        within(screen.getByTestId("agenda-focus-MANUAL-e1")).getByText(/^Leave by ~/),
      ).toBeInTheDocument()
    })
    expect(screen.getByText("Practice")).toBeInTheDocument()
  })

  it("requests near-term leave-by before the later loaded window", async () => {
    const session = new AuthSessionHolder()
    session.setSession("tok", {
      id: "1",
      email: "parent@example.com",
      displayName: "Alex",
    })
    const loaded = defaultCalendarWindow()
    const near = nearTermLeaveByWindow(loaded.from, loaded.to)!
    const rest = remainderAfterNearTermLeaveByWindow(loaded.from, loaded.to)!
    let releaseNear!: (rows: unknown[]) => void
    const listCalendarLeaveBy = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            releaseNear = resolve
          }),
      )
      .mockResolvedValueOnce([])

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
                  role: "CAREGIVER",
                },
              ],
              kids: [{ id: "k1", displayName: "Sam" }],
              places: [],
            }),
          ),
          listCalendar: vi.fn().mockResolvedValue([
            calendarItem({
              id: "e1",
              source: "MANUAL",
              title: "Practice",
              startsAt: "2030-08-15T17:00:00.000Z",
              kidIds: ["k1"],
              leaveByStatus: "PENDING",
              leaveByReason: null,
            }),
          ]),
          listCalendarLeaveBy,
        })}
        onSignedOut={vi.fn()}
      />,
    )

    expect(await screen.findByText("Practice")).toBeInTheDocument()
    await waitFor(() => {
      expect(listCalendarLeaveBy).toHaveBeenCalledTimes(1)
    })
    expect(listCalendarLeaveBy.mock.calls[0]?.[1]).toBe(near.from)
    expect(listCalendarLeaveBy.mock.calls[0]?.[2]).toBe(near.to)

    releaseNear([])
    await waitFor(() => {
      expect(listCalendarLeaveBy).toHaveBeenCalledTimes(2)
    })
    expect(listCalendarLeaveBy.mock.calls[1]?.[1]).toBe(rest.from)
    expect(listCalendarLeaveBy.mock.calls[1]?.[2]).toBe(rest.to)
  })

  it("keeps cached OK leave-by when cheap revalidate is PENDING for the same origin", async () => {
    const session = new AuthSessionHolder()
    session.setSession("tok", {
      id: "1",
      email: "parent@example.com",
      displayName: "Alex",
    })
    const window = defaultCalendarWindow()
    const circle = circleFixture({
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
    })
    const bootstrap = new FamilyBootstrapStore()
    bootstrap.save({
      adultId: "1",
      email: "parent@example.com",
      adultDisplayName: "Alex",
      circle,
      inviteCode: "AB12CD34",
      feeds: [],
    })
    const cache = new CalendarCacheStore()
    cache.save({
      adultId: "1",
      circleId: "c1",
      from: window.from,
      to: window.to,
      items: [
        calendarItem({
          id: "e1",
          source: "MANUAL",
          title: "Practice",
          startsAt: "2030-08-15T17:00:00.000Z",
          kidIds: ["k1"],
          leaveFromPlaceId: "p1",
          leaveFromPlaceName: "Home",
          leaveByAt: "2030-08-15T16:30:00.000Z",
          leaveByStatus: "OK",
          leaveByReason: null,
        }),
      ],
      fetchedAt: Date.now(),
    })
    let releaseFill!: (rows: unknown[]) => void
    const listCalendarLeaveBy = vi.fn().mockImplementation(
      () =>
        new Promise((resolve) => {
          releaseFill = resolve
        }),
    )

    render(
      <FamilyScreen
        session={session}
        calendarCacheStore={cache}
        bootstrapCacheStore={bootstrap}
        familyClient={mockFamilyClient({
          getCircle: vi.fn().mockResolvedValue(circle),
          getInvite: vi.fn().mockResolvedValue({ code: "AB12CD34" }),
          listFeeds: vi.fn().mockResolvedValue([]),
          listCalendar: vi.fn().mockResolvedValue([
            calendarItem({
              id: "e1",
              source: "MANUAL",
              title: "Practice",
              startsAt: "2030-08-15T17:00:00.000Z",
              kidIds: ["k1"],
              leaveFromPlaceId: "p1",
              leaveFromPlaceName: "Home",
              leaveByStatus: "PENDING",
              leaveByReason: null,
            }),
          ]),
          listCalendarLeaveBy,
        })}
        onSignedOut={vi.fn()}
      />,
    )

    expect(await screen.findByText("Practice")).toBeInTheDocument()
    await waitFor(() => {
      expect(listCalendarLeaveBy).toHaveBeenCalled()
    })
    expect(
      within(screen.getByTestId("agenda-focus-MANUAL-e1")).getByText(/^Leave by ~/),
    ).toBeInTheDocument()
    expect(screen.queryByText(LEAVE_BY_PENDING_LABEL)).not.toBeInTheDocument()

    releaseFill([
      {
        id: "e1",
        source: "MANUAL",
        leaveFromPlaceId: "p1",
        leaveFromPlaceName: "Home",
        leaveByAt: "2030-08-15T16:10:00.000Z",
        leaveByStatus: "OK",
        leaveByReason: null,
      },
    ])
    await waitFor(() => {
      expect(cache.load("1", "c1")?.items[0]?.leaveByAt).toBe(
        "2030-08-15T16:10:00.000Z",
      )
    })
  })

  it("drops cached OK to PENDING when cheap list origin changes", async () => {
    const session = new AuthSessionHolder()
    session.setSession("tok", {
      id: "1",
      email: "parent@example.com",
      displayName: "Alex",
    })
    const window = defaultCalendarWindow()
    const circle = circleFixture({
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
    })
    const bootstrap = new FamilyBootstrapStore()
    bootstrap.save({
      adultId: "1",
      email: "parent@example.com",
      adultDisplayName: "Alex",
      circle,
      inviteCode: null,
      feeds: [],
    })
    const cache = new CalendarCacheStore()
    cache.save({
      adultId: "1",
      circleId: "c1",
      from: window.from,
      to: window.to,
      items: [
        calendarItem({
          id: "e1",
          source: "MANUAL",
          title: "Practice",
          startsAt: "2030-08-15T17:00:00.000Z",
          kidIds: ["k1"],
          leaveFromPlaceId: "p1",
          leaveFromPlaceName: "Home",
          leaveByAt: "2030-08-15T16:30:00.000Z",
          leaveByStatus: "OK",
          leaveByReason: null,
        }),
      ],
      fetchedAt: Date.now(),
    })
    const listCalendarLeaveBy = vi.fn().mockImplementation(
      () => new Promise(() => {}),
    )

    render(
      <FamilyScreen
        session={session}
        calendarCacheStore={cache}
        bootstrapCacheStore={bootstrap}
        familyClient={mockFamilyClient({
          getCircle: vi.fn().mockResolvedValue(circle),
          listCalendar: vi.fn().mockResolvedValue([
            calendarItem({
              id: "e1",
              source: "MANUAL",
              title: "Practice",
              startsAt: "2030-08-15T17:00:00.000Z",
              kidIds: ["k1"],
              leaveFromPlaceId: "p2",
              leaveFromPlaceName: "Dad's house",
              leaveByStatus: "PENDING",
              leaveByReason: null,
            }),
          ]),
          listCalendarLeaveBy,
        })}
        onSignedOut={vi.fn()}
      />,
    )

    expect(await screen.findByText("Practice")).toBeInTheDocument()
    await waitFor(() => {
      expect(screen.getByTestId("agenda-focus-MANUAL-e1")).toHaveTextContent(
        LEAVE_BY_PENDING_LABEL,
      )
    })
  })

  it("keeps agenda rows when leave-by fill-in fails", async () => {
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
          ),
          listCalendar: vi.fn().mockResolvedValue([
            calendarItem({
              id: "e1",
              source: "MANUAL",
              title: "Practice",
              startsAt: "2030-08-15T17:00:00.000Z",
              kidIds: ["k1"],
              leaveByStatus: "PENDING",
              leaveByReason: null,
            }),
          ]),
          listCalendarLeaveBy: vi.fn().mockRejectedValue(new Error("leave-by down")),
        })}
        onSignedOut={vi.fn()}
      />,
    )

    expect(await screen.findByText("Practice")).toBeInTheDocument()
    await waitFor(() => {
      expect(screen.getByTestId("agenda-focus-MANUAL-e1")).toHaveTextContent(
        LEAVE_BY_PENDING_LABEL,
      )
    })
    expect(screen.queryByRole("alert")).not.toBeInTheDocument()
  })

  it("fills leave-by for a Load more page after the near-term request", async () => {
    const user = userEvent.setup()
    const session = new AuthSessionHolder()
    session.setSession("tok", {
      id: "1",
      email: "parent@example.com",
      displayName: "Alex",
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
          leaveByStatus: "PENDING",
          leaveByReason: null,
        }),
      ])
      .mockResolvedValueOnce([
        calendarItem({
          id: "e2",
          source: "MANUAL",
          title: "Later",
          startsAt: "2030-09-20T17:00:00.000Z",
          kidIds: ["k1"],
          leaveByStatus: "PENDING",
          leaveByReason: null,
        }),
      ])
    const listCalendarLeaveBy = vi.fn().mockResolvedValue([])

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
                  role: "CAREGIVER",
                },
              ],
              kids: [{ id: "k1", displayName: "Sam" }],
              places: [],
            }),
          ),
          listCalendar,
          listCalendarLeaveBy,
        })}
        onSignedOut={vi.fn()}
      />,
    )

    expect(await screen.findByText("Near")).toBeInTheDocument()
    await waitFor(() => {
      expect(listCalendarLeaveBy).toHaveBeenCalledTimes(2)
    })
    const nearTermTo = listCalendarLeaveBy.mock.calls[0]?.[2] as string

    await user.click(screen.getByRole("button", { name: "Load more" }))
    expect(await screen.findByTestId("agenda-item-MANUAL-e2")).toBeInTheDocument()
    await waitFor(() => {
      expect(listCalendarLeaveBy).toHaveBeenCalledTimes(3)
    })
    const pageCall = listCalendarLeaveBy.mock.calls[2]
    expect(pageCall?.[1]).toBe(listCalendar.mock.calls[1]?.[1])
    expect(pageCall?.[2]).toBe(listCalendar.mock.calls[1]?.[2])
    expect(listCalendarLeaveBy.mock.calls[0]?.[2]).toBe(nearTermTo)
  })

  it("sets RSVP Yes and patches the Agenda item", async () => {
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
      kidIds: ["k1"],
      uncoveredKidIds: ["k1"],
    })
    const setCalendarRsvp = vi.fn().mockResolvedValue({
      ...baseItem,
      rsvps: [{ kidId: "k1", status: "YES" }],
      uncoveredKidIds: ["k1"],
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
              kids: [{ id: "k1", displayName: "Sam" }],
              places: [],
            }),
          ),
          listCalendar: vi.fn().mockResolvedValue([baseItem]),
          setCalendarRsvp,
        })}
        onSignedOut={vi.fn()}
      />,
    )

    const agenda = await screen.findByLabelText("Agenda")
    const rsvp = within(agenda).getByTestId("rsvp-MANUAL-e1-k1")
    await user.selectOptions(rsvp, "YES")

    await waitFor(() => {
      expect(setCalendarRsvp).toHaveBeenCalledWith("tok", "MANUAL", "e1", "k1", {
        status: "YES",
      })
    })
    expect(rsvp).toHaveValue("YES")
    expect(within(agenda).getByText(/Needs coverage/)).toBeInTheDocument()
  })

  it("deemphasizes out-of-play rows and hides leave-by and coverage", async () => {
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
              kids: [{ id: "k1", displayName: "Sam" }],
              places: [],
            }),
          ),
          listCalendar: vi.fn().mockResolvedValue([
            calendarItem({
              id: "e1",
              source: "MANUAL",
              title: "Practice",
              startsAt: "2030-08-15T17:00:00.000Z",
              kidIds: ["k1"],
              uncoveredKidIds: [],
              rsvps: [{ kidId: "k1", status: "NO" }],
            }),
          ]),
        })}
        onSignedOut={vi.fn()}
      />,
    )

    const item = await screen.findByTestId("agenda-item-MANUAL-e1")
    expect(item).toHaveAttribute("data-out-of-play", "true")
    expect(within(item).getByText("Not going")).toBeInTheDocument()
    expect(within(item).queryByTestId("agenda-band-travel")).not.toBeInTheDocument()
    expect(within(item).queryByTestId("agenda-band-coverage")).not.toBeInTheDocument()
    await expandAgendaItem(user, item)
    expect(within(item).queryByTestId("agenda-band-travel")).not.toBeInTheDocument()
    expect(within(item).queryByTestId("agenda-band-coverage")).not.toBeInTheDocument()
    expect(within(item).getByTestId("rsvp-MANUAL-e1-k1")).toHaveValue("NO")
    expect(within(item).getByRole("button", { name: "Edit" })).toBeInTheDocument()
  })

  it("confirms before No when the kid has active coverage", async () => {
    const user = userEvent.setup()
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true)
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
      kidIds: ["k1"],
      uncoveredKidIds: [],
      rsvps: [{ kidId: "k1", status: "YES" }],
      coverages: [
        {
          id: "cov1",
          coveringAdultId: "1",
          coveringAdultDisplayName: "Alex",
          assignedByAdultId: "1",
          kidIds: ["k1"],
          status: "CONFIRMED",
        },
      ],
    })
    const setCalendarRsvp = vi.fn().mockResolvedValue({
      ...baseItem,
      coverages: [],
      uncoveredKidIds: [],
      rsvps: [{ kidId: "k1", status: "NO" }],
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
              kids: [{ id: "k1", displayName: "Sam" }],
              places: [],
            }),
          ),
          listCalendar: vi.fn().mockResolvedValue([baseItem]),
          setCalendarRsvp,
        })}
        onSignedOut={vi.fn()}
      />,
    )

    const agenda = await screen.findByLabelText("Agenda")
    await user.selectOptions(within(agenda).getByTestId("rsvp-MANUAL-e1-k1"), "NO")

    expect(confirmSpy).toHaveBeenCalledWith("This will remove coverage for Sam.")
    await waitFor(() => {
      expect(setCalendarRsvp).toHaveBeenCalledWith("tok", "MANUAL", "e1", "k1", {
        status: "NO",
      })
    })
    expect(within(agenda).queryByText(/Alex · Sam · Confirmed/)).not.toBeInTheDocument()
    confirmSpy.mockRestore()
  })

  it("does not set RSVP No when coverage release confirm is cancelled", async () => {
    const user = userEvent.setup()
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false)
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
      kidIds: ["k1"],
      uncoveredKidIds: [],
      rsvps: [{ kidId: "k1", status: "YES" }],
      coverages: [
        {
          id: "cov1",
          coveringAdultId: "1",
          coveringAdultDisplayName: "Alex",
          assignedByAdultId: "1",
          kidIds: ["k1"],
          status: "CONFIRMED",
        },
      ],
    })
    const setCalendarRsvp = vi.fn()

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
              kids: [{ id: "k1", displayName: "Sam" }],
              places: [],
            }),
          ),
          listCalendar: vi.fn().mockResolvedValue([baseItem]),
          setCalendarRsvp,
        })}
        onSignedOut={vi.fn()}
      />,
    )

    const agenda = await screen.findByLabelText("Agenda")
    await user.selectOptions(within(agenda).getByTestId("rsvp-MANUAL-e1-k1"), "NO")

    expect(confirmSpy).toHaveBeenCalled()
    expect(setCalendarRsvp).not.toHaveBeenCalled()
    expect(within(agenda).getByTestId("rsvp-MANUAL-e1-k1")).toHaveValue("YES")
    confirmSpy.mockRestore()
  })

  it("keeps mixed Yes/No rows in play and only shows uncovered Yes kids", async () => {
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
              title: "Game",
              startsAt: "2030-08-15T17:00:00.000Z",
              kidIds: ["k1", "k2"],
              uncoveredKidIds: ["k1"],
              rsvps: [
                { kidId: "k1", status: "YES" },
                { kidId: "k2", status: "NO" },
              ],
            }),
          ]),
        })}
        onSignedOut={vi.fn()}
      />,
    )

    const item = await screen.findByTestId("agenda-focus-MANUAL-e1")
    expect(within(item).getByText(/Needs coverage: Sam/)).toBeInTheDocument()
    expect(within(item).getByRole("button", { name: "Assign coverage" })).toBeInTheDocument()
  })
})
