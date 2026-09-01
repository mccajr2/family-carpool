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
import {
  advanceCalendarWindow,
  defaultCalendarWindow,
  formatLocalTodayLabel,
  nearTermLeaveByWindow,
  remainderAfterNearTermLeaveByWindow,
} from "@/components/eventTimes"
import { LEAVE_BY_PENDING_LABEL } from "@/components/leaveByDisplay"
import * as coverageQueue from "@/components/coverageQueue"
import { mapCalendarItemToCoverageGames } from "@/components/coverageQueue"
import { FamilyScreen } from "@/components/FamilyScreen"

/** Fixed "today" for 2030-dated calendar fixtures in this file. */
const AGENDA_TEST_NOW = new Date("2030-08-14T12:00:00.000Z")

function heroCarouselIn(agenda: HTMLElement) {
  return within(agenda).getByTestId("hero-attention-carousel")
}

function heroSlideIn(agenda: HTMLElement, title?: string) {
  const slides = within(heroCarouselIn(agenda)).getAllByTestId("hero-attention-slide")
  if (title) {
    const match = slides.find((slide) => within(slide).queryByText(title))
    if (match) {
      return match
    }
  }
  return slides[0]!
}

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
    listRides: vi.fn().mockResolvedValue([]),
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
    eventKey: null,
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

/** Earlier in-play item so a later fixture stays a collapsed Agenda row (not Focus). */
function earlierFocusDecoy(kidId = "k1"): CalendarItem {
  return calendarItem({
    id: "focus-decoy",
    source: "FEED",
    title: "Focus decoy",
    startsAt: "2030-08-01T12:00:00.000Z",
    kidIds: [kidId],
    feedName: "Decoy",
  })
}

async function expandAgendaItem(
  user: ReturnType<typeof userEvent.setup>,
  item: HTMLElement,
) {
  await user.click(within(item).getByRole("button", { expanded: false }))
}

async function editAgendaItemById(
  user: ReturnType<typeof userEvent.setup>,
  agenda: HTMLElement,
  testId: string,
) {
  const item = within(agenda).getByTestId(testId)
  await expandAgendaItem(user, item)
  await user.click(within(item).getByRole("button", { name: "Edit" }))
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

function calendarPageHeading() {
  return screen.getByRole("heading", { level: 1, name: "Today" })
}

function findCalendarPageHeading() {
  return screen.findByRole("heading", { level: 1, name: "Today" })
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
        now={AGENDA_TEST_NOW}
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

    const calendarHeading = await findCalendarPageHeading()
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
        now={AGENDA_TEST_NOW}
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
    expect(screen.getByRole("heading", { name: "Join a family" }).closest("[class*='max-w-5xl']")).not.toBeNull()
    await user.type(screen.getByLabelText("Invite code"), "AB12CD34")
    await user.type(screen.getByLabelText("Your name"), "Jordan")
    await user.click(screen.getByRole("button", { name: "Join family" }))

    expect(await findCalendarPageHeading()).toBeInTheDocument()
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
        now={AGENDA_TEST_NOW}
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
    const window = defaultCalendarWindow(AGENDA_TEST_NOW)
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
        now={AGENDA_TEST_NOW}
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
        now={AGENDA_TEST_NOW}
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
        now={AGENDA_TEST_NOW}
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
        now={AGENDA_TEST_NOW}
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

    await editAgendaItemById(user, agenda, "agenda-item-MANUAL-e1")
    const edit = await screen.findByRole("dialog", { name: "Edit event" })
    await user.click(within(edit).getByRole("button", { name: "Remove event" }))
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
        now={AGENDA_TEST_NOW}
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
    await editAgendaItemById(user, agenda, "agenda-item-MANUAL-e1")

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
        now={AGENDA_TEST_NOW}
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
    await editAgendaItemById(user, agenda, "agenda-item-MANUAL-e1")
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
        now={AGENDA_TEST_NOW}
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
    await editAgendaItemById(user, agenda, "agenda-item-MANUAL-e1")

    const compose = await screen.findByRole("dialog", { name: "Edit event" })
    const title = within(compose).getByLabelText("Event title")
    await user.clear(title)
    await user.type(title, "Orthodontist")
    const location = within(compose).getByLabelText("Event location")
    await user.clear(location)
    await user.type(location, "Ortho")
    await user.click(within(compose).getByRole("button", { name: "Save" }))

    expect(await within(agenda).findByText("Orthodontist")).toBeInTheDocument()
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
        now={AGENDA_TEST_NOW}
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

  it("keeps Load more rows when now is omitted (AuthScreen path)", async () => {
    const user = userEvent.setup()
    const session = new AuthSessionHolder()
    session.setSession("tok", {
      id: "2",
      email: "other@example.com",
      displayName: "Jordan",
    })

    const anchor = new Date()
    anchor.setHours(12, 0, 0, 0)
    const nearStart = new Date(anchor)
    nearStart.setDate(nearStart.getDate() + 1)
    const laterStart = new Date(anchor)
    laterStart.setDate(laterStart.getDate() + 40)

    const listCalendar = vi
      .fn()
      .mockResolvedValueOnce([
        calendarItem({
          id: "e1",
          source: "MANUAL",
          title: "Near",
          startsAt: nearStart.toISOString(),
          kidIds: ["k1"],
        }),
      ])
      .mockResolvedValueOnce([
        calendarItem({
          id: "e2",
          source: "MANUAL",
          title: "Later",
          startsAt: laterStart.toISOString(),
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
    await waitFor(() => {
      expect(screen.queryByTestId("agenda-revalidating")).not.toBeInTheDocument()
    })

    await user.click(screen.getByRole("button", { name: "Load more" }))
    expect(await within(agenda).findByTestId("agenda-item-MANUAL-e2")).toBeInTheDocument()

    await waitFor(() => {
      expect(within(agenda).getByTestId("agenda-item-MANUAL-e2")).toBeInTheDocument()
      expect(screen.queryByTestId("agenda-revalidating")).not.toBeInTheDocument()
    })
    expect(listCalendar).toHaveBeenCalledTimes(2)
  })

  it("restores an extended cached agenda window after reload", async () => {
    const session = new AuthSessionHolder()
    session.setSession("tok", {
      id: "1",
      email: "parent@example.com",
      displayName: "Alex",
    })
    const initialWindow = defaultCalendarWindow(AGENDA_TEST_NOW)
    const extendedTo = advanceCalendarWindow(initialWindow.to).to
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
      from: initialWindow.from,
      to: extendedTo,
      items: [
        calendarItem({
          id: "e1",
          source: "MANUAL",
          title: "Near",
          startsAt: "2030-08-15T17:00:00.000Z",
          kidIds: ["k1"],
        }),
        calendarItem({
          id: "e2",
          source: "MANUAL",
          title: "Later",
          startsAt: "2030-09-20T17:00:00.000Z",
          kidIds: ["k1"],
        }),
      ],
      fetchedAt: Date.now(),
    })

    const listCalendar = vi.fn().mockResolvedValue([
      calendarItem({
        id: "e1",
        source: "MANUAL",
        title: "Near",
        startsAt: "2030-08-15T17:00:00.000Z",
        kidIds: ["k1"],
      }),
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
        now={AGENDA_TEST_NOW}
        session={session}
        calendarCacheStore={cache}
        bootstrapCacheStore={bootstrap}
        familyClient={mockFamilyClient({
          getCircle: vi.fn().mockResolvedValue(circle),
          listCalendar,
        })}
        onSignedOut={vi.fn()}
      />,
    )

    const agenda = await screen.findByLabelText("Agenda")
    expect(await within(agenda).findByTestId("agenda-item-MANUAL-e2")).toBeInTheDocument()
    await waitFor(() => {
      expect(listCalendar).toHaveBeenCalled()
      const [, from, to] = listCalendar.mock.calls[0]!
      expect(from).toBe(initialWindow.from)
      expect(to).toBe(extendedTo)
    })
    await waitFor(() => {
      expect(within(agenda).getByTestId("agenda-item-MANUAL-e2")).toBeInTheDocument()
    })
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
        now={AGENDA_TEST_NOW}
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
      expect(screen.getByRole("button", { name: /Loading/ })).toBeInTheDocument()
    })
    expect(
      within(agenda).getByText("No events in the loaded window."),
    ).toBeInTheDocument()

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
        now={AGENDA_TEST_NOW}
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
    const filter = within(agenda).getByTestId("agenda-kid-filter")
    const allKids = within(filter).getByRole("button", { name: "All kids" })
    const riley = within(filter).getByRole("button", { name: "Riley" })
    expect(allKids).toHaveAttribute("aria-pressed", "true")
    expect(riley).toHaveAttribute("aria-pressed", "false")
    expect(allKids.className).toMatch(/--fc-font-filter-chip-size/)
    expect(filter.className).toMatch(/--fc-space-filter-chip-gap/)
    await expandAgendaItem(user, within(agenda).getByTestId("agenda-item-FEED-f1"))
    const feedRow = within(agenda).getByTestId("agenda-row-FEED-f1")
    expect(within(feedRow).getByTestId("agenda-row-team")).toHaveTextContent("Soccer")
    expect(within(agenda).getAllByText("Soccer").length).toBeGreaterThanOrEqual(1)
    expect(within(agenda).queryByRole("button", { name: "Remove event" })).not.toBeInTheDocument()
    await expandAgendaItem(user, within(agenda).getByTestId("agenda-item-MANUAL-e1"))
    expect(within(agenda).getAllByRole("button", { name: "Edit" })).toHaveLength(1)

    await user.click(riley)
    expect(riley).toHaveAttribute("aria-pressed", "true")
    expect(allKids).toHaveAttribute("aria-pressed", "false")
    expect(within(agenda).queryByText("Dentist")).not.toBeInTheDocument()
    expect(within(agenda).getByText("Practice")).toBeInTheDocument()
    expect(within(agenda).queryByRole("button", { name: "Edit" })).not.toBeInTheDocument()

    await user.click(allKids)
    expect(allKids).toHaveAttribute("aria-pressed", "true")
    expect(within(agenda).getByText("Dentist")).toBeInTheDocument()
    expect(within(agenda).getByText("Practice")).toBeInTheDocument()
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
        now={AGENDA_TEST_NOW}
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

    render(
      <FamilyScreen now={AGENDA_TEST_NOW} session={session} onSignedOut={vi.fn()} />,
    )

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
        now={AGENDA_TEST_NOW}
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
    expect(screen.queryByText("Activity feeds")).not.toBeInTheDocument()
    expect(screen.getByText("Add a feed").className).toMatch(/uppercase/)
    expect(screen.getByText("Add a feed").className).toMatch(/--fc-font-feed-section-label-size/)
    const card = screen.getByTestId("feed-card")
    expect(card.className).toMatch(/--fc-space-feed-card-pad-x/)
    expect(card.className).toMatch(/--fc-surface-raised/)
    const noneChip = within(screen.getByLabelText("Activity feeds")).getByText("No carpool")
    expect(noneChip.className).toMatch(/uppercase/)
    expect(noneChip.className).toMatch(/--fc-font-feed-chip-size/)
    expect(
      within(screen.getByLabelText("Activity feeds")).getByRole("button", {
        name: "Enable carpool",
      }),
    ).toBeInTheDocument()
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
        now={AGENDA_TEST_NOW}
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
        now={AGENDA_TEST_NOW}
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

    expect(await findCalendarPageHeading()).toBeInTheDocument()
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
        now={AGENDA_TEST_NOW}
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
    await user.click(await within(feeds).findByRole("button", { name: "Enable carpool" }))
    expect(enable).toHaveBeenCalledWith("tok", "f1")
    expect(await within(feeds).findByRole("button", { name: "Open carpool" })).toBeInTheDocument()
    const owned = within(feeds).getByText("Owned")
    expect(owned.className).toMatch(/uppercase/)
    expect(owned.className).toMatch(/--fc-font-feed-chip-size/)
    expect(within(feeds).queryByRole("button", { name: /^Enable$/ })).not.toBeInTheDocument()
    expect(within(feeds).queryByRole("button", { name: /^Open$/ })).not.toBeInTheDocument()
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
      startsAt: "2030-08-20T16:00:00Z",
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
        now={AGENDA_TEST_NOW}
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

    expect(await findCalendarPageHeading()).toBeInTheDocument()
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

  it("loads carpool rides on Calendar and joins FEED rows by space+time+title", async () => {
    const session = new AuthSessionHolder()
    session.setSession("tok", {
      id: "1",
      email: "parent@example.com",
      displayName: "Alex",
    })

    const feedItem = calendarItem({
      id: "e-feed",
      source: "FEED",
      title: "Practice",
      startsAt: "2030-08-15T17:00:00.000Z",
      kidIds: ["k1"],
      feedId: "f1",
      feedName: "Soccer",
      uncoveredKidIds: [],
      rsvps: [{ kidId: "k1", status: "YES" }],
    })
    const listRides = vi.fn().mockResolvedValue([
      {
        eventKey: "UID:practice-1",
        title: "Practice",
        startsAt: "2030-08-15T17:00:00.000Z",
        endsAt: null,
        defaultKidIds: ["k1"],
        ownRequest: null,
        otherRequests: [],
      },
    ])
    const getSummary = vi.fn().mockResolvedValue({
      circleRole: "ORGANIZER",
      feeds: [
        {
          feedId: "f1",
          feedName: "Soccer",
          status: "OWNER",
          spaceId: "s1",
          spaceName: "Soccer",
        },
      ],
      spaces: [
        {
          id: "s1",
          name: "Soccer",
          membership: "OWNER",
          inviteCode: "AB12CD34",
          callerFeedId: "f1",
          members: [{ circleId: "c1", circleName: "House", membership: "OWNER" }],
          pendingRequests: [],
        },
      ],
    })

    render(
      <FamilyScreen
        now={AGENDA_TEST_NOW}
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
          listCalendar: vi.fn().mockResolvedValue([earlierFocusDecoy(), feedItem]),
        })}
        carpoolClient={mockCarpoolClient({ getSummary, listRides })}
        onSignedOut={vi.fn()}
      />,
    )

    expect(await findCalendarPageHeading()).toBeInTheDocument()
    await waitFor(() => {
      expect(listRides).toHaveBeenCalledWith(
        "tok",
        "s1",
        expect.any(String),
        expect.any(String),
      )
    })
    const from = listRides.mock.calls[0]?.[2] as string
    const to = listRides.mock.calls[0]?.[3] as string
    expect(
      (new Date(to).getTime() - new Date(from).getTime()) / (24 * 60 * 60 * 1000),
    ).toBe(14)

    const agenda = await screen.findByLabelText("Agenda")
    const row = within(agenda).getByTestId("agenda-item-FEED-e-feed")
    await waitFor(() => {
      expect(row).toHaveAttribute("data-carpool-ride-key", "UID:practice-1")
    })
    const focus = within(agenda).getByTestId("hero-attention-empty")
    expect(focus).toBeInTheDocument()
  })

  it("shows Request primary and Assign secondary on Focus for joined requestable uncovered FEED", async () => {
    const user = userEvent.setup()
    const session = new AuthSessionHolder()
    session.setSession("tok", {
      id: "1",
      email: "parent@example.com",
      displayName: "Alex",
    })

    const feedItem = calendarItem({
      id: "e-feed",
      source: "FEED",
      title: "Practice",
      startsAt: "2030-08-15T17:00:00.000Z",
      kidIds: ["k1"],
      feedId: "f1",
      feedName: "Soccer",
      eventKey: "UID:practice-1",
      uncoveredKidIds: ["k1"],
      rsvps: [{ kidId: "k1", status: "YES" }],
    })
    const listRides = vi.fn().mockResolvedValue([
      {
        eventKey: "UID:practice-1",
        title: "Practice",
        startsAt: "2030-08-15T17:00:00.000Z",
        endsAt: null,
        defaultKidIds: ["k1"],
        ownRequest: null,
        otherRequests: [],
      },
    ])
    const createRide = vi.fn().mockResolvedValue({
      id: "ride-1",
      spaceId: "s1",
      eventKey: "UID:practice-1",
      requestingCircleId: "c1",
      requestingCircleName: "House",
      requestedByAdultId: "1",
      kidIds: ["k1"],
      kidFirstNames: ["Sam"],
      seats: 1,
      pickupPlaceName: "Home",
      pickupAddress: "1 Main",
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
    })
    const getSummary = vi.fn().mockResolvedValue({
      circleRole: "ORGANIZER",
      feeds: [
        {
          feedId: "f1",
          feedName: "Soccer",
          status: "MEMBER",
          spaceId: "s1",
          spaceName: "Soccer",
        },
      ],
      spaces: [
        {
          id: "s1",
          name: "Soccer",
          membership: "MEMBER",
          inviteCode: "AB12CD34",
          callerFeedId: "f1",
          members: [
            { circleId: "c1", circleName: "House", membership: "MEMBER" },
          ],
          pendingRequests: [],
        },
      ],
    })

    render(
      <FamilyScreen
        now={AGENDA_TEST_NOW}
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
          listCalendar: vi.fn().mockResolvedValue([feedItem]),
        })}
        carpoolClient={mockCarpoolClient({ getSummary, listRides, createRide })}
        onSignedOut={vi.fn()}
      />,
    )

    expect(await findCalendarPageHeading()).toBeInTheDocument()
    const agenda = await screen.findByLabelText("Agenda")
    const focus = heroSlideIn(agenda)
    expect(within(agenda).getByTestId("agenda-item-FEED-e-feed")).toBeInTheDocument()
    expect(within(agenda).getByTestId("agenda-row-FEED-e-feed")).toHaveAttribute(
      "data-focused",
      "true",
    )
    expect(within(focus).getByText("Sam needs a ride")).toBeInTheDocument()

    expect(within(focus).queryByRole("button", { name: "Request" })).not.toBeInTheDocument()
    expect(within(focus).getByTestId("driver-picker")).toBeInTheDocument()
    expect(within(focus).getByRole("button", { name: "Confirm I'll drive" })).toBeInTheDocument()
    const teamAsk = within(focus).getByRole("button", { name: "Ask the team for a ride" })
    expect(screen.queryByRole("button", { name: "Accept" })).not.toBeInTheDocument()

    await user.click(teamAsk)
    await waitFor(() => {
      expect(createRide).toHaveBeenCalledWith("tok", "s1", {
        eventKey: "UID:practice-1",
        kidIds: ["k1"],
      })
    })
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
        now={AGENDA_TEST_NOW}
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
        now={AGENDA_TEST_NOW}
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
    expect(nav.className).toMatch(/h-svh/)
    expect(nav.className).toMatch(/w-60/)
    expect(nav.className).toMatch(/--fc-space-rail-x/)
    expect(nav.className).toMatch(/--fc-space-rail-y/)
    expect(nav.className).not.toMatch(/w-full/)
    expect(nav.className).not.toMatch(/md:w-56/)
    expect(nav.className).toMatch(/sticky/)
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
        now={AGENDA_TEST_NOW}
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

    const heading = await findCalendarPageHeading()
    const main = heading.closest("main")
    expect(main).not.toBeNull()
    // Grid item is a block with max-width 820 only. These bans are the
    // reverted wrong turns: nested App <main>, flex-on-main, w-full,
    // min-w-0 / min-w-[820px], md:flex-col rail stack.
    expect(main?.className).toMatch(/max-w-\[820px\]/)
    expect(main?.className).not.toMatch(/w-full/)
    expect(main?.className).not.toMatch(/min-w-/)
    expect(main?.className).not.toMatch(/\bflex\b/)
    expect(main?.className).not.toMatch(/flex-1/)
    expect(main?.className).not.toMatch(/shadow-sm/)
    expect(main?.className).not.toMatch(/border-border/)
    expect(main?.parentElement?.tagName).not.toBe("MAIN")
    const shell = main?.parentElement
    expect(shell?.className).toMatch(/(?:^|\s)grid(?:\s|$)/)
    expect(shell?.className).not.toMatch(/w-full/)
    expect(shell?.className).not.toMatch(/min-w-min/)
    expect(shell?.className).toMatch(/grid-cols-\[15rem_1fr_20rem\]/)
    expect(shell?.className).not.toMatch(/flex-col/)

    const context = screen.getByLabelText("Context")
    expect(context.tagName).toBe("ASIDE")
    expect(context.className).not.toMatch(/hidden/)
    expect(context.className).toMatch(/w-80/)
    expect(context.className).toMatch(/--fc-border/)
    expect(context.className).toMatch(/--fc-space-week-glance-pad-x/)
    expect(context.className).toMatch(/--fc-space-main-y/)
    expect(
      within(context).getByRole("heading", { name: "Week at a glance" }),
    ).toBeInTheDocument()
    expect(within(context).getAllByRole("listitem")).toHaveLength(7)
    expect(screen.queryByText(/open in maps/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/need drivers/i)).not.toBeInTheDocument()

    for (const destination of ["Carpool", "Family", "Places", "Garage", "Feeds"] as const) {
      await goTo(user, destination)
      expect(screen.queryByLabelText("Context")).not.toBeInTheDocument()
      const destHeading = screen.getByRole("heading", {
        name: destination === "Family" ? "House" : destination,
      })
      expect(destHeading.closest("main")?.parentElement?.className).toMatch(
        /grid-cols-\[15rem_1fr\]/,
      )
      expect(destHeading.closest("main")?.parentElement?.className).not.toMatch(
        /1fr_20rem/,
      )
    }

    await goTo(user, "Calendar")
    const calendarContext = screen.getByLabelText("Context")
    expect(
      within(calendarContext).getByRole("heading", { name: "Week at a glance" }),
    ).toBeInTheDocument()
    expect(
      calendarPageHeading().closest("main")?.parentElement
        ?.className,
    ).toMatch(/grid-cols-\[15rem_1fr_20rem\]/)
  })

  it("styles destination headers with token type and Calendar Today/date", async () => {
    const user = userEvent.setup()
    const session = new AuthSessionHolder()
    session.setSession("tok", {
      id: "1",
      email: "parent@example.com",
      displayName: "Alex",
    })

    render(
      <FamilyScreen
        now={AGENDA_TEST_NOW}
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

    const heading = await findCalendarPageHeading()
    expect(heading.tagName).toBe("H1")
    expect(heading).toHaveClass("fc-display")
    expect(heading.className).toMatch(/--fc-font-page-size/)
    expect(heading.className).toMatch(/--fc-text-primary/)
    expect(heading.className).not.toMatch(/text-2xl/)
    expect(heading.className).not.toMatch(/--fc-hero-on/)
    expect(heading.className).not.toMatch(/--fc-hero-surface/)
    expect(heading.className).not.toMatch(/--fc-font-hero-size/)
    const header = heading.closest("header")
    expect(header).not.toBeNull()
    expect(header?.className).toMatch(/mb-\[var\(--fc-space-header\)\]/)
    const date = within(header!).getByText(formatLocalTodayLabel())
    expect(date.tagName).toBe("P")
    expect(date.className).toMatch(/--fc-font-subtitle-size/)
    expect(date.className).toMatch(/--fc-text-secondary/)
    const main = heading.closest("main")
    expect(main?.className).toMatch(/max-w-\[820px\]/)
    expect(main?.className).toMatch(/space-y-4/)
    expect(main?.className).toMatch(/\[&>header\+\*\]:!mt-0/)
    expect(main?.className).toMatch(/--fc-space-main-x/)
    expect(main?.className).toMatch(/--fc-space-main-y/)
    expect(main?.className).not.toMatch(/md:px-/)
    expect(screen.getByRole("button", { name: "Add event" })).toBeInTheDocument()
    expect(
      within(screen.getByLabelText("App navigation")).getByRole("button", {
        name: "Calendar",
      }),
    ).toBeInTheDocument()

    for (const destination of ["Carpool", "Places", "Garage", "Feeds"] as const) {
      await goTo(user, destination)
      const destHeading = screen.getByRole("heading", { level: 1, name: destination })
      expect(destHeading).toHaveClass("fc-display")
      expect(destHeading.className).toMatch(/--fc-font-page-size/)
      expect(destHeading.className).toMatch(/--fc-text-primary/)
      expect(destHeading.closest("header")?.querySelectorAll("p")).toHaveLength(0)
      expect(screen.queryByRole("button", { name: "Add event" })).not.toBeInTheDocument()
    }

    await goTo(user, "Family")
    const familyHeading = screen.getByRole("heading", { level: 1, name: "House" })
    expect(familyHeading.className).toMatch(/--fc-font-page-size/)
    const familyHeader = familyHeading.closest("header")
    const familySub = within(familyHeader!).getByText("Alex · parent@example.com · ORGANIZER")
    expect(familySub.className).toMatch(/--fc-font-subtitle-size/)
    expect(familySub.className).toMatch(/--fc-text-secondary/)
    expect(screen.queryByRole("heading", { level: 1, name: "Today" })).not.toBeInTheDocument()
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
        now={AGENDA_TEST_NOW}
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

    expect(await findCalendarPageHeading()).toBeInTheDocument()
    expect(getCircle).toHaveBeenCalledTimes(2)
  })

  it("keeps the circle-loading Card in the centered column", async () => {
    const session = new AuthSessionHolder()
    session.setSession("tok", {
      id: "1",
      email: "parent@example.com",
      displayName: "Alex",
    })

    render(
      <FamilyScreen
        now={AGENDA_TEST_NOW}
        session={session}
        familyClient={mockFamilyClient({
          getCircle: vi.fn().mockReturnValue(new Promise(() => {})),
        })}
        onSignedOut={vi.fn()}
      />,
    )

    const heading = await screen.findByRole("heading", { name: "Your family" })
    await waitFor(() => {
      expect(screen.queryByRole("button", { name: "Create family" })).not.toBeInTheDocument()
    })
    expect(heading.closest("[class*='max-w-5xl']")).not.toBeNull()
    expect(screen.queryByLabelText("App navigation")).not.toBeInTheDocument()
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
        now={AGENDA_TEST_NOW}
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

  it("lets Edit on the Focus card set leave-from when several places exist", async () => {
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
      location: "Rink",
      kidIds: ["k1"],
      leaveFromPlaceId: "p1",
      leaveFromPlaceName: "Mom's house",
      leaveByAt: "2030-08-15T16:30:00.000Z",
      leaveByStatus: "OK",
      leaveByReason: null,
    })
    const updateEvent = vi.fn().mockResolvedValue({
      id: baseItem.id,
      title: baseItem.title,
      startsAt: baseItem.startsAt,
      endsAt: baseItem.endsAt,
      location: baseItem.location,
      kidIds: baseItem.kidIds,
    })
    const setCalendarLeaveFrom = vi.fn().mockResolvedValue({
      ...baseItem,
      leaveFromPlaceId: "p2",
      leaveFromPlaceName: "Dad's house",
    })

    render(
      <FamilyScreen
        now={AGENDA_TEST_NOW}
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
          listCalendar: vi.fn().mockResolvedValue([baseItem]),
          updateEvent,
          setCalendarLeaveFrom,
        })}
        onSignedOut={vi.fn()}
      />,
    )

    const agenda = await screen.findByLabelText("Agenda")
    await editAgendaItemById(user, agenda, "agenda-item-MANUAL-e1")

    const compose = await screen.findByRole("dialog", { name: "Edit event" })
    const leaveFrom = within(compose).getByLabelText("Leave from for event")
    expect(leaveFrom).toHaveValue("p1")
    await user.selectOptions(leaveFrom, "p2")
    await user.click(within(compose).getByRole("button", { name: "Save" }))

    await waitFor(() => {
      expect(updateEvent).toHaveBeenCalled()
      expect(setCalendarLeaveFrom).toHaveBeenCalledWith("tok", "MANUAL", "e1", {
        leaveFromPlaceId: "p2",
      })
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
        now={AGENDA_TEST_NOW}
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
            earlierFocusDecoy(),
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
    const item = within(agenda).getByTestId("agenda-item-MANUAL-e1")
    await expandAgendaItem(user, item)
    const leaveBy = within(item).getByText(/^Leave by ~/)
    expect(leaveBy.textContent).toMatch(/^Leave by ~/)
    expect(leaveBy.textContent).toMatch(/ · estimate$/)
    expect(leaveBy.textContent?.toLowerCase()).not.toMatch(/\beta\b/)
    expect(leaveBy.textContent?.toLowerCase()).not.toContain("live traffic")

    const leaveFrom = within(item).getByLabelText("Leave from for Practice")
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
        now={AGENDA_TEST_NOW}
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
    const origin = within(agenda).getByTestId("agenda-item-MANUAL-e-origin")
    await expandAgendaItem(user, origin)
    expect(within(origin).getByRole("button", { name: "Open Places" })).toBeInTheDocument()
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
    await expandAgendaItem(user, within(agendaAgain).getByTestId("agenda-item-MANUAL-e-dest"))
    expect(
      within(agendaAgain).getAllByRole("button", { name: "Edit" }).length,
    ).toBeGreaterThan(0)
  })

  it("shows ride needed when uncovered kids are present", async () => {
    const session = new AuthSessionHolder()
    session.setSession("tok", {
      id: "1",
      email: "parent@example.com",
      displayName: "Alex",
    })

    render(
      <FamilyScreen
        now={AGENDA_TEST_NOW}
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
    const slide = heroSlideIn(agenda, "Riley needs a ride")
    expect(within(slide).getByTestId("driver-picker")).toBeInTheDocument()
    expect(within(slide).getByText("Riley needs a ride")).toBeInTheDocument()
  })

  it("renders hero attention carousel from getQueue and includes queued items in the list", async () => {
    const session = new AuthSessionHolder()
    session.setSession("tok", {
      id: "1",
      email: "parent@example.com",
      displayName: "Alex",
    })

    render(
      <FamilyScreen
        now={AGENDA_TEST_NOW}
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
              rsvps: [{ kidId: "k1", status: "YES" }],
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
    expect(heroCarouselIn(agenda)).toBeInTheDocument()
    expect(within(heroSlideIn(agenda)).getByText("Sam needs a ride")).toBeInTheDocument()
    expect(within(agenda).getByTestId("agenda-item-MANUAL-e1")).toBeInTheDocument()
    expect(within(agenda).getByTestId("agenda-item-MANUAL-e2")).toBeInTheDocument()
    expect(within(agenda).getByTestId("agenda-row-MANUAL-e1")).toHaveAttribute(
      "data-focused",
      "true",
    )
    expect(within(agenda).getByTestId("agenda-row-MANUAL-e2")).toHaveAttribute(
      "data-focused",
      "false",
    )
  })

  it("shows carousel controls for a multi-item queue and drops resolved slides on rerender", async () => {
    const user = userEvent.setup()
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
      configurable: true,
      value: vi.fn(),
    })
    const session = new AuthSessionHolder()
    session.setSession("tok", {
      id: "1",
      email: "parent@example.com",
      displayName: "Alex",
    })

    const gapSam = calendarItem({
      id: "e1",
      source: "MANUAL",
      title: "Sam practice",
      startsAt: "2030-08-15T17:00:00.000Z",
      kidIds: ["k1"],
      uncoveredKidIds: ["k1"],
      rsvps: [{ kidId: "k1", status: "YES" }],
    })
    const gapRiley = calendarItem({
      id: "e2",
      source: "MANUAL",
      title: "Riley game",
      startsAt: "2030-08-16T17:00:00.000Z",
      kidIds: ["k2"],
      uncoveredKidIds: ["k2"],
      rsvps: [{ kidId: "k2", status: "YES" }],
    })
    const assignCalendarCoverage = vi.fn().mockResolvedValue({
      ...gapSam,
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
        now={AGENDA_TEST_NOW}
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
          listCalendar: vi.fn().mockResolvedValue([gapSam, gapRiley]),
          assignCalendarCoverage,
        })}
        onSignedOut={vi.fn()}
      />,
    )

    const agenda = await screen.findByLabelText("Agenda")
    const carousel = heroCarouselIn(agenda)
    expect(within(carousel).getByTestId("hero-attention-controls")).toBeInTheDocument()
    expect(within(carousel).getAllByTestId("hero-attention-slide")).toHaveLength(2)
    expect(within(carousel).getByText("· 2 things need you")).toBeInTheDocument()

    const firstSlide = heroSlideIn(agenda, "Sam needs a ride")
    await user.click(within(firstSlide).getByRole("button", { name: "Confirm I'll drive" }))

    await waitFor(() => {
      expect(assignCalendarCoverage).toHaveBeenCalledWith("tok", "MANUAL", "e1", {
        coveringAdultId: "1",
        kidIds: ["k1"],
      })
    })
    await waitFor(() => {
      expect(within(carousel).getAllByTestId("hero-attention-slide")).toHaveLength(1)
    })
    expect(within(carousel).getByText("Riley needs a ride")).toBeInTheDocument()
    expect(within(carousel).queryByTestId("hero-attention-controls")).not.toBeInTheDocument()
    expect(within(agenda).getByTestId("agenda-item-MANUAL-e1")).toBeInTheDocument()
    expect(within(agenda).getByTestId("agenda-item-MANUAL-e2")).toBeInTheDocument()
    expect(within(agenda).getByTestId("agenda-row-MANUAL-e2")).toHaveAttribute(
      "data-focused",
      "true",
    )
  })

  it("lets the second carousel slide stay actionable without resolving the first", async () => {
    const user = userEvent.setup()
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
      configurable: true,
      value: vi.fn(),
    })
    const session = new AuthSessionHolder()
    session.setSession("tok", {
      id: "1",
      email: "parent@example.com",
      displayName: "Alex",
    })

    const gapSam = calendarItem({
      id: "e1",
      source: "MANUAL",
      title: "Sam practice",
      startsAt: "2030-08-15T17:00:00.000Z",
      kidIds: ["k1"],
      uncoveredKidIds: ["k1"],
      rsvps: [{ kidId: "k1", status: "YES" }],
    })
    const gapRiley = calendarItem({
      id: "e2",
      source: "MANUAL",
      title: "Riley game",
      startsAt: "2030-08-16T17:00:00.000Z",
      kidIds: ["k2"],
      uncoveredKidIds: ["k2"],
      rsvps: [{ kidId: "k2", status: "YES" }],
    })
    const assignCalendarCoverage = vi.fn().mockResolvedValue({
      ...gapRiley,
      uncoveredKidIds: [],
      coverages: [
        {
          id: "cov2",
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
        now={AGENDA_TEST_NOW}
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
          listCalendar: vi.fn().mockResolvedValue([gapSam, gapRiley]),
          assignCalendarCoverage,
        })}
        onSignedOut={vi.fn()}
      />,
    )

    const agenda = await screen.findByLabelText("Agenda")
    const carousel = heroCarouselIn(agenda)
    expect(within(carousel).getByText("Sam needs a ride")).toBeInTheDocument()

    await user.click(within(carousel).getByRole("button", { name: "Next item" }))
    const secondSlide = heroSlideIn(agenda, "Riley needs a ride")
    expect(within(carousel).getByText("Sam needs a ride")).toBeInTheDocument()
    await user.click(within(secondSlide).getByRole("button", { name: "Jordan" }))
    await user.click(within(secondSlide).getByRole("button", { name: "Ask Jordan to drive" }))

    await waitFor(() => {
      expect(assignCalendarCoverage).toHaveBeenCalledWith("tok", "MANUAL", "e2", {
        coveringAdultId: "2",
        kidIds: ["k2"],
      })
    })
    await waitFor(() => {
      expect(within(carousel).getAllByTestId("hero-attention-slide")).toHaveLength(1)
    })
    expect(within(carousel).getByText("Sam needs a ride")).toBeInTheDocument()
    expect(within(carousel).queryByText("Riley needs a ride")).not.toBeInTheDocument()
  })

  it("shows All caught up when the last carousel item is resolved", async () => {
    const user = userEvent.setup()
    const session = new AuthSessionHolder()
    session.setSession("tok", {
      id: "1",
      email: "parent@example.com",
      displayName: "Alex",
    })

    const gapSam = calendarItem({
      id: "e1",
      source: "MANUAL",
      title: "Sam practice",
      startsAt: "2030-08-15T17:00:00.000Z",
      kidIds: ["k1"],
      uncoveredKidIds: ["k1"],
      rsvps: [{ kidId: "k1", status: "YES" }],
    })
    const assignCalendarCoverage = vi.fn().mockResolvedValue({
      ...gapSam,
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
        now={AGENDA_TEST_NOW}
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
          listCalendar: vi.fn().mockResolvedValue([gapSam]),
          assignCalendarCoverage,
        })}
        onSignedOut={vi.fn()}
      />,
    )

    const agenda = await screen.findByLabelText("Agenda")
    expect(within(heroCarouselIn(agenda)).getByTestId("hero-attention-slide")).toBeInTheDocument()

    await user.click(
      within(heroSlideIn(agenda)).getByRole("button", { name: "Confirm I'll drive" }),
    )

    await waitFor(() => {
      expect(within(agenda).getByTestId("hero-attention-empty")).toBeInTheDocument()
    })
    expect(within(agenda).getByText("All caught up")).toBeInTheDocument()
    expect(within(agenda).getByText("Nothing needs you right now")).toBeInTheDocument()
    expect(
      within(agenda).getByText(
        /Every ride this week is either covered or waiting on someone else/,
      ),
    ).toBeInTheDocument()
    expect(within(agenda).queryByTestId("hero-attention-slide")).not.toBeInTheDocument()
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
        now={AGENDA_TEST_NOW}
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
              startsAt: "2030-08-25T17:00:00.000Z",
              kidIds: ["k1"],
            }),
            calendarItem({
              id: "e2",
              source: "MANUAL",
              title: "Game",
              startsAt: "2030-08-26T17:00:00.000Z",
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
    const filter = within(agenda).getByTestId("agenda-kid-filter")
    expect(filter.className).toMatch(/--fc-space-filter-chip-gap/)
    expect(within(filter).getByRole("button", { name: "All kids" })).toHaveAttribute(
      "aria-pressed",
      "true",
    )
    expect(within(agenda).getByTestId("hero-attention-empty")).toBeInTheDocument()
    expect(within(agenda).getByTestId("agenda-item-MANUAL-e1")).toBeInTheDocument()
    const list = within(agenda).getByTestId("agenda-list")
    expect(list.className).toContain("--fc-space-2xl")
    expect(within(list).queryByRole("heading", { name: "NEEDS YOUR ATTENTION" })).not.toBeInTheDocument()
    expect(within(list).getByRole("heading", { name: "LATER" })).toBeInTheDocument()
    const laterHeading = within(list).getByRole("heading", { name: "LATER" })
    expect(laterHeading.className).toMatch(/--fc-font-feed-section-label-size/)
    expect(laterHeading.className).toMatch(/--fc-font-feed-section-label-weight/)
    expect(laterHeading.className).toMatch(/uppercase/)
    expect(laterHeading.className).toMatch(/--fc-text-secondary/)
    expect(laterHeading.className).not.toMatch(/font-semibold/)
    expect(laterHeading.className).not.toMatch(/--fc-text-primary/)
    const rows = within(list).getAllByRole("listitem")
    expect(rows).toHaveLength(2)
    expect(rows[0]).toHaveAttribute("data-testid", "agenda-item-MANUAL-e1")
    expect(rows[1]).toHaveAttribute("data-testid", "agenda-item-MANUAL-e2")
    const card = within(rows[1]).getByTestId("agenda-row-MANUAL-e2")
    expect(card.className).toContain("border-[var(--fc-border)]")
    expect(card.className).toContain("rounded-[var(--fc-radius-xl)]")
    expect(card.className).toContain("bg-[var(--fc-surface-raised)]")
    expect(card).toHaveAttribute("data-focused", "false")
    expect(within(rows[0]).getByTestId("agenda-row-MANUAL-e1")).toHaveAttribute(
      "data-focused",
      "false",
    )
    expect(within(card).getByTestId("agenda-row-title")).toBeInTheDocument()
    expect(within(card).getByTestId("agenda-row-when")).toBeInTheDocument()
    expect(within(card).queryByTestId("agenda-band-people")).not.toBeInTheDocument()
    expect(within(agenda).getByTestId("hero-attention-empty")).toBeInTheDocument()
    expect(within(card).queryByTestId("agenda-status-pill-dot")).not.toBeInTheDocument()
  })

  it("places decision hero carousel above the list and splits today list rows", async () => {
    const session = new AuthSessionHolder()
    session.setSession("tok", {
      id: "1",
      email: "parent@example.com",
      displayName: "Alex",
    })

    const todayStart = new Date(AGENDA_TEST_NOW)
    todayStart.setHours(0, 0, 0, 0)
    const todayAfternoon = new Date(todayStart)
    todayAfternoon.setHours(15, 0, 0, 0)
    const todayEvening = new Date(todayStart)
    todayEvening.setHours(18, 0, 0, 0)
    const tomorrowMorning = new Date(todayStart)
    tomorrowMorning.setDate(tomorrowMorning.getDate() + 1)
    tomorrowMorning.setHours(10, 0, 0, 0)

    render(
      <FamilyScreen
        now={AGENDA_TEST_NOW}
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
              id: "gap",
              source: "MANUAL",
              title: "Gap practice",
              startsAt: todayAfternoon.toISOString(),
              kidIds: ["k1"],
              uncoveredKidIds: ["k1"],
            }),
            calendarItem({
              id: "calm",
              source: "MANUAL",
              title: "Calm later today",
              startsAt: todayEvening.toISOString(),
              kidIds: ["k1"],
            }),
            calendarItem({
              id: "tmw",
              source: "MANUAL",
              title: "Tomorrow game",
              startsAt: tomorrowMorning.toISOString(),
              kidIds: ["k1"],
            }),
          ]),
        })}
        onSignedOut={vi.fn()}
      />,
    )

    const agenda = await screen.findByLabelText("Agenda")
    expect(heroCarouselIn(agenda)).toBeInTheDocument()
    expect(within(heroSlideIn(agenda)).getByText("Sam needs a ride")).toBeInTheDocument()
    const list = within(agenda).getByTestId("agenda-list")
    expect(within(list).queryByRole("heading", { name: "NEEDS YOUR ATTENTION" })).not.toBeInTheDocument()
    expect(within(list).getByTestId("agenda-item-MANUAL-gap")).toBeInTheDocument()
    expect(within(list).getByTestId("agenda-row-MANUAL-gap")).toHaveAttribute(
      "data-focused",
      "true",
    )
    expect(within(list).getByRole("heading", { name: "REST OF TODAY" })).toBeInTheDocument()
    const todayRows = within(list)
      .getByRole("heading", { name: "REST OF TODAY" })
      .closest("section")
      ?.querySelectorAll("[data-testid^='agenda-item-']")
    expect(todayRows?.[0]).toHaveAttribute("data-testid", "agenda-item-MANUAL-gap")
    expect(todayRows?.[1]).toHaveAttribute("data-testid", "agenda-item-MANUAL-calm")
    expect(within(list).getByTestId("agenda-item-MANUAL-calm")).toBeInTheDocument()
    expect(within(list).getByRole("heading", { name: "TOMORROW" })).toBeInTheDocument()
    expect(within(list).getByTestId("agenda-item-MANUAL-tmw")).toBeInTheDocument()
    expect(within(list).queryByRole("heading", { name: "LATER" })).not.toBeInTheDocument()
    expect(within(list).queryByRole("heading", { name: "Today" })).not.toBeInTheDocument()
  })

  it("renders the most urgent queue item in both carousel and flat list", async () => {
    const session = new AuthSessionHolder()
    session.setSession("tok", {
      id: "1",
      email: "parent@example.com",
      displayName: "Alex",
    })

    render(
      <FamilyScreen
        now={AGENDA_TEST_NOW}
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
    expect(heroCarouselIn(agenda)).toBeInTheDocument()
    expect(within(heroSlideIn(agenda)).getByText("Sam needs a ride")).toBeInTheDocument()
    expect(within(agenda).getByTestId("agenda-item-MANUAL-e1")).toBeInTheDocument()
    expect(within(agenda).getByTestId("agenda-item-MANUAL-e2")).toBeInTheDocument()
    expect(within(agenda).getByTestId("agenda-row-MANUAL-e2")).toHaveAttribute(
      "data-focused",
      "true",
    )
    expect(within(agenda).getByTestId("agenda-row-MANUAL-e1")).toHaveAttribute(
      "data-focused",
      "false",
    )
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
        now={AGENDA_TEST_NOW}
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
    const slide = heroSlideIn(agenda, "Riley needs a ride")
    await user.click(within(slide).getByRole("button", { name: "Jordan" }))
    // Single uncovered kid is auto-selected — no checkbox to click.
    expect(
      within(agenda).queryByLabelText("Cover Riley for Practice"),
    ).not.toBeInTheDocument()
    await user.click(within(slide).getByRole("button", { name: "Ask Jordan to drive" }))

    await waitFor(() => {
      expect(assignCalendarCoverage).toHaveBeenCalledWith("tok", "MANUAL", "e1", {
        coveringAdultId: "2",
        kidIds: ["k2"],
      })
    })
    expect(within(agenda).queryByText("Needs coverage: Riley")).not.toBeInTheDocument()
    const resolved = (await assignCalendarCoverage.mock.results[0]!.value) as CalendarItem
    const rows = mapCalendarItemToCoverageGames(resolved, null, {
      currentAdultId: "1",
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
    })
    expect(rows.find((row) => row.kidId === "k2")?.ownRide).toEqual({
      driver: "Jordan",
      confirmed: false,
    })
  })

  it("self-assign via DriverPicker maps to You confirmed in the queue", async () => {
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
        now={AGENDA_TEST_NOW}
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
    await user.click(within(agenda).getByRole("button", { name: "Confirm I'll drive" }))

    await waitFor(() => {
      expect(assignCalendarCoverage).toHaveBeenCalled()
    })
    const resolved = await assignCalendarCoverage.mock.results[0]!.value
    expect(
      mapCalendarItemToCoverageGames(resolved, null, {
        currentAdultId: "1",
        members: [
          {
            adultId: "1",
            email: "parent@example.com",
            displayName: "Alex",
            role: "ORGANIZER",
          },
        ],
      })[0]?.ownRide,
    ).toEqual({ driver: "You", confirmed: true })
    expect(within(agenda).queryByTestId("driver-picker")).not.toBeInTheDocument()
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
        now={AGENDA_TEST_NOW}
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
    const slide = heroSlideIn(agenda, "Sam needs a ride")
    await user.click(within(slide).getByRole("button", { name: "Confirm I'll drive" }))

    await waitFor(() => {
      expect(assignCalendarCoverage).toHaveBeenCalledWith("tok", "MANUAL", "e1", {
        coveringAdultId: "1",
        kidIds: ["k1"],
      })
    })
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
        now={AGENDA_TEST_NOW}
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
    const slide = heroSlideIn(agenda, "Sam needs a ride")
    await user.click(within(slide).getByRole("button", { name: "Jordan" }))
    expect(within(slide).getByRole("button", { name: "Ask Jordan to drive" })).toBeEnabled()
    await user.click(within(slide).getByRole("button", { name: "Ask Jordan to drive" }))

    await waitFor(() => {
      expect(assignCalendarCoverage).toHaveBeenCalledWith("tok", "MANUAL", "e1", {
        coveringAdultId: "2",
        kidIds: ["k1"],
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
        now={AGENDA_TEST_NOW}
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
    await user.click(within(agenda).getByRole("button", { name: "Confirm I'll drive" }))

    await waitFor(() => {
      expect(assignCalendarCoverage).toHaveBeenCalledWith("tok", "MANUAL", "e1", {
        coveringAdultId: "1",
        kidIds: ["k1"],
      })
    })
    const item = within(agenda).getByTestId("agenda-item-MANUAL-e1")
    await expandAgendaItem(user, item)
    expect(within(item).getAllByText("You're driving").length).toBeGreaterThan(0)
    expect(
      within(item).getByRole("button", { name: "Can't drive anymore? Reassign the ride" }),
    ).toBeInTheDocument()
    expect(within(item).queryByRole("button", { name: "Remove coverage" })).not.toBeInTheDocument()
  })

  it("assigns a gap kid after marking them going again from not going", async () => {
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
      rsvps: [
        { kidId: "k1", status: "YES" },
        { kidId: "k2", status: "NO" },
      ],
    })
    const goingAgainItem = {
      ...baseItem,
      rsvps: [
        { kidId: "k1", status: "YES" },
        { kidId: "k2", status: "YES" },
      ],
    }
    const assignCalendarCoverage = vi.fn().mockResolvedValue({
      ...goingAgainItem,
      uncoveredKidIds: [],
      coverages: [
        {
          id: "cov1",
          coveringAdultId: "1",
          coveringAdultDisplayName: "Alex",
          assignedByAdultId: "1",
          kidIds: ["k2"],
          status: "CONFIRMED",
        },
      ],
    })
    const setCalendarRsvp = vi.fn().mockResolvedValue(goingAgainItem)

    render(
      <FamilyScreen
        now={AGENDA_TEST_NOW}
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
          listCalendar: vi.fn().mockResolvedValue([baseItem]),
          assignCalendarCoverage,
          setCalendarRsvp,
        })}
        onSignedOut={vi.fn()}
      />,
    )

    const agenda = await screen.findByLabelText("Agenda")
    const item = within(agenda).getByTestId("agenda-item-MANUAL-e1")
    await expandAgendaItem(user, item)
    const rileyRow = within(item).getByTestId("agenda-kid-row-k2")
    expect(within(rileyRow).queryByTestId("driver-picker")).not.toBeInTheDocument()
    await user.click(within(rileyRow).getByRole("button", { name: "Mark as going again" }))
    await waitFor(() => {
      expect(setCalendarRsvp).toHaveBeenCalledWith("tok", "MANUAL", "e1", "k2", {
        status: "YES",
      })
    })
    await waitFor(() => {
      expect(within(rileyRow).getByTestId("driver-picker")).toBeInTheDocument()
    })
    await user.click(within(rileyRow).getByRole("button", { name: "Confirm I'll drive" }))

    await waitFor(() => {
      expect(assignCalendarCoverage).toHaveBeenCalledWith("tok", "MANUAL", "e1", {
        coveringAdultId: "1",
        kidIds: ["k2"],
      })
    })
    expect(setCalendarRsvp).toHaveBeenCalledTimes(1)
  })

  it("does not reset RSVP when assigned kids are already going", async () => {
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
      rsvps: [{ kidId: "k1", status: "YES" }],
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
    const setCalendarRsvp = vi.fn()

    render(
      <FamilyScreen
        now={AGENDA_TEST_NOW}
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
          setCalendarRsvp,
        })}
        onSignedOut={vi.fn()}
      />,
    )

    const agenda = await screen.findByLabelText("Agenda")
    await user.click(within(agenda).getByRole("button", { name: "Confirm I'll drive" }))

    await waitFor(() => {
      expect(assignCalendarCoverage).toHaveBeenCalled()
    })
    expect(setCalendarRsvp).not.toHaveBeenCalled()
  })

  it("resets RSVP to Yes when assign includes a kid still marked not going", async () => {
    const user = userEvent.setup()
    const getQueueSpy = vi.spyOn(coverageQueue, "getQueue").mockReturnValue([
      {
        kind: "ownRide",
        game: {
          id: "MANUAL-e1:k1",
          kidId: "k1",
          title: "Practice",
          startsAt: "2030-08-15T17:00:00.000Z",
          order: Date.parse("2030-08-15T17:00:00.000Z"),
          attendance: "going",
          ownRide: "unassigned",
          requests: [],
        },
      },
    ])
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
      rsvps: [{ kidId: "k1", status: "NO" }],
    })
    const assignedItem = {
      ...baseItem,
      uncoveredKidIds: [],
      coverages: [
        {
          id: "cov1",
          coveringAdultId: "1",
          coveringAdultDisplayName: "Alex",
          assignedByAdultId: "1",
          kidIds: ["k1"],
          status: "CONFIRMED" as const,
        },
      ],
    }
    const assignCalendarCoverage = vi.fn().mockResolvedValue(assignedItem)
    const setCalendarRsvp = vi.fn().mockResolvedValue({
      ...assignedItem,
      rsvps: [{ kidId: "k1", status: "YES" }],
    })

    render(
      <FamilyScreen
        now={AGENDA_TEST_NOW}
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
          setCalendarRsvp,
        })}
        onSignedOut={vi.fn()}
      />,
    )

    const agenda = await screen.findByLabelText("Agenda")
    await user.click(within(heroSlideIn(agenda)).getByRole("button", { name: "Confirm I'll drive" }))

    await waitFor(() => {
      expect(assignCalendarCoverage).toHaveBeenCalledWith("tok", "MANUAL", "e1", {
        coveringAdultId: "1",
        kidIds: ["k1"],
      })
      expect(setCalendarRsvp).toHaveBeenCalledWith("tok", "MANUAL", "e1", "k1", {
        status: "YES",
      })
    })

    getQueueSpy.mockRestore()
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
        now={AGENDA_TEST_NOW}
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
    expect(within(agenda).queryByTestId("driver-picker")).not.toBeInTheDocument()
    expect(within(agenda).getByRole("button", { name: "Confirm coverage" })).toBeInTheDocument()
    await user.click(within(agenda).getByRole("button", { name: "Confirm coverage" }))

    await waitFor(() => {
      expect(confirmCalendarCoverage).toHaveBeenCalledWith("tok", "cov1")
    })
    const item = within(agenda).getByTestId("agenda-item-MANUAL-e1")
    await expandAgendaItem(user, item)
    expect(within(item).getAllByText("You're driving").length).toBeGreaterThan(0)
    expect(
      within(item).getByRole("button", {
        name: "Can't drive anymore? Reassign the ride",
      }),
    ).toBeInTheDocument()
    expect(within(item).queryByRole("button", { name: "Remove coverage" })).not.toBeInTheDocument()
    expect(
      within(agenda).queryByRole("button", { name: "Confirm coverage" }),
    ).not.toBeInTheDocument()
  })

  it("removes confirmed coverage from the Focus card", async () => {
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
    const removeCalendarCoverage = vi.fn().mockResolvedValue({
      ...baseItem,
      uncoveredKidIds: ["k1"],
      coverages: [],
    })

    render(
      <FamilyScreen
        now={AGENDA_TEST_NOW}
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
          removeCalendarCoverage,
        })}
        onSignedOut={vi.fn()}
      />,
    )

    const agenda = await screen.findByLabelText("Agenda")
    const item = within(agenda).getByTestId("agenda-item-MANUAL-e1")
    await expandAgendaItem(user, item)
    await user.click(
      within(item).getByRole("button", { name: "Can't drive anymore? Reassign the ride" }),
    )

    await waitFor(() => {
      expect(removeCalendarCoverage).toHaveBeenCalledWith("tok", "cov1")
    })
    expect(within(heroSlideIn(agenda)).getByTestId("driver-picker")).toBeInTheDocument()
    expect(within(heroSlideIn(agenda)).getByRole("button", { name: "Confirm I'll drive" })).toBeInTheDocument()
    // List row stays expanded after revert — gap shows DriverPicker, no revert link.
    expect(within(item).getByTestId("driver-picker")).toBeInTheDocument()
    expect(
      within(item).queryByRole("button", { name: "Can't drive anymore? Reassign the ride" }),
    ).not.toBeInTheDocument()
  })

  it("reassigns Focus coverage when the covering combobox changes", async () => {
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
    const reassignCalendarCoverage = vi.fn().mockResolvedValue({
      ...baseItem,
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

    render(
      <FamilyScreen
        now={AGENDA_TEST_NOW}
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
              kids: [{ id: "k1", displayName: "Sam" }],
              places: [],
            }),
          ),
          listCalendar: vi.fn().mockResolvedValue([baseItem]),
          reassignCalendarCoverage,
        })}
        onSignedOut={vi.fn()}
      />,
    )

    const agenda = await screen.findByLabelText("Agenda")
    const item = within(agenda).getByTestId("agenda-item-MANUAL-e1")
    await expandAgendaItem(user, item)
    expect(within(item).getAllByText("You're driving").length).toBeGreaterThan(0)
    expect(within(item).queryByLabelText("Covering adult for Practice")).not.toBeInTheDocument()
  })

  it("shows amber conflict lines from server conflicts on Agenda items", async () => {
    const user = userEvent.setup()
    const session = new AuthSessionHolder()
    session.setSession("tok", {
      id: "1",
      email: "parent@example.com",
      displayName: "Alex",
    })

    render(
      <FamilyScreen
        now={AGENDA_TEST_NOW}
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
    const item = within(agenda).getByTestId("agenda-item-MANUAL-e1")
    await expandAgendaItem(user, item)
    expect(within(item).getByText("Overlaps")).toBeInTheDocument()
    expect(within(item).getByText("Sam overlaps Game")).toBeInTheDocument()
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
        now={AGENDA_TEST_NOW}
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
    await user.click(within(agenda).getByTestId("hero-attention-confirm-coverage"))

    await waitFor(() => {
      expect(confirmCalendarCoverage).toHaveBeenCalledWith("tok", "cov1")
    })
    expect(within(agenda).queryByTestId("hero-attention-confirm-coverage")).toBeInTheDocument()
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
        now={AGENDA_TEST_NOW}
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
                  status: "CONFIRMED",
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
    const kids = within(item).getByTestId("agenda-band-kids")
    const travel = within(item).getByTestId("agenda-band-travel")
    const people = within(item).getByTestId("agenda-band-people")

    expect(primary.compareDocumentPosition(kids) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(kids.compareDocumentPosition(travel) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(travel.compareDocumentPosition(people) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()

    expect(within(primary).getByText("Practice")).toBeInTheDocument()
    expect(within(primary).getByText(/Field/)).toBeInTheDocument()
    expect(within(kids).getByText("You're driving")).toBeInTheDocument()
    expect(
      within(kids).getByRole("button", {
        name: "Can't drive anymore? Reassign the ride",
      }),
    ).toBeInTheDocument()
    expect(within(item).queryByTestId("agenda-band-coverage")).not.toBeInTheDocument()
    expect(within(travel).getByTestId("leave-by-MANUAL-e1")).toBeInTheDocument()
    expect(within(travel).getByTestId("leave-from-label-MANUAL-e1")).toHaveTextContent(
      "Mom's house",
    )
    expect(within(people).getByText("Manual")).toBeInTheDocument()
    expect(
      within(kids).getByRole("button", { name: "Mark Sam as not going" }),
    ).toBeInTheDocument()

    expect(within(item).queryByTestId("agenda-cta-primary")).not.toBeInTheDocument()
    const manualActions = within(item).getByTestId("agenda-band-manual-actions")
    expect(people.compareDocumentPosition(manualActions) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(within(manualActions).getByRole("button", { name: "Edit" })).toBeInTheDocument()
    expect(within(manualActions).getByRole("button", { name: "Remove event" })).toBeInTheDocument()
  })

  it("emphasizes DriverPicker when Confirm is not shown", async () => {
    const session = new AuthSessionHolder()
    session.setSession("tok", {
      id: "1",
      email: "parent@example.com",
      displayName: "Alex",
    })

    render(
      <FamilyScreen
        now={AGENDA_TEST_NOW}
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
    const slide = heroSlideIn(agenda, "Sam needs a ride")
    expect(within(slide).getByTestId("driver-picker")).toBeInTheDocument()
    expect(within(slide).getByRole("button", { name: "Confirm I'll drive" })).toBeInTheDocument()
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
        now={AGENDA_TEST_NOW}
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
    const window = defaultCalendarWindow(AGENDA_TEST_NOW)
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
        now={AGENDA_TEST_NOW}
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
    const window = defaultCalendarWindow(AGENDA_TEST_NOW)
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
        now={AGENDA_TEST_NOW}
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
        now={AGENDA_TEST_NOW}
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
    expect(await within(agenda).findByText("Sam needs a ride")).toBeInTheDocument()
    await waitFor(() => {
      expect(cache.load("1", "c1")?.items).toHaveLength(1)
    })

    await user.click(within(agenda).getByTestId("hero-attention-confirm-coverage"))
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
        now={AGENDA_TEST_NOW}
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
        now={AGENDA_TEST_NOW}
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
    expect(screen.getByTestId("agenda-item-MANUAL-e1")).toBeInTheDocument()
    expect(listCalendarLeaveBy).toHaveBeenCalled()
    expect(screen.queryByText(LEAVE_BY_PENDING_LABEL)).not.toBeInTheDocument()
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
      expect(screen.getByTestId("agenda-item-MANUAL-e1")).toHaveTextContent("Practice")
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
    const loaded = defaultCalendarWindow(AGENDA_TEST_NOW)
    const near = nearTermLeaveByWindow(loaded.from, loaded.to, AGENDA_TEST_NOW)!
    const rest = remainderAfterNearTermLeaveByWindow(loaded.from, loaded.to, AGENDA_TEST_NOW)!
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
        now={AGENDA_TEST_NOW}
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
    const window = defaultCalendarWindow(AGENDA_TEST_NOW)
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
        now={AGENDA_TEST_NOW}
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
    expect(screen.getByTestId("agenda-item-MANUAL-e1")).toHaveTextContent("Practice")
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
    const window = defaultCalendarWindow(AGENDA_TEST_NOW)
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
        now={AGENDA_TEST_NOW}
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
      expect(screen.getByTestId("agenda-item-MANUAL-e1")).toHaveTextContent("Practice")
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
        now={AGENDA_TEST_NOW}
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
      expect(screen.getByTestId("agenda-item-MANUAL-e1")).toHaveTextContent("Practice")
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
        now={AGENDA_TEST_NOW}
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

  it("removes kid from hero queue when marked not going and never enqueues attendance", async () => {
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
      rsvps: [{ kidId: "k1", status: "YES" }],
    })
    const setCalendarRsvp = vi.fn().mockResolvedValue({
      ...baseItem,
      rsvps: [{ kidId: "k1", status: "NO" }],
      uncoveredKidIds: [],
    })

    render(
      <FamilyScreen
        now={AGENDA_TEST_NOW}
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
    expect(within(heroSlideIn(agenda)).getByText("Sam needs a ride")).toBeInTheDocument()

    const item = within(agenda).getByTestId("agenda-item-MANUAL-e1")
    await expandAgendaItem(user, item)
    await user.click(
      within(item).getByRole("button", { name: "Mark Sam as not going" }),
    )

    await waitFor(() => {
      expect(setCalendarRsvp).toHaveBeenCalledWith("tok", "MANUAL", "e1", "k1", {
        status: "NO",
      })
    })
    await waitFor(() => {
      expect(within(agenda).getByText("All caught up")).toBeInTheDocument()
    })
    expect(within(agenda).queryByText("Sam needs a ride")).not.toBeInTheDocument()
    expect(within(agenda).queryByText(/mark.*attendance|RSVP reminder|not sure/i)).not.toBeInTheDocument()
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
      uncoveredKidIds: [],
      rsvps: [{ kidId: "k1", status: "NO" }],
    })
    const setCalendarRsvp = vi.fn().mockResolvedValue({
      ...baseItem,
      rsvps: [{ kidId: "k1", status: "YES" }],
      uncoveredKidIds: ["k1"],
    })

    render(
      <FamilyScreen
        now={AGENDA_TEST_NOW}
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
    const item = within(agenda).getByTestId("agenda-item-MANUAL-e1")
    await expandAgendaItem(user, item)
    await user.click(
      within(item).getByRole("button", { name: "Mark as going again" }),
    )

    await waitFor(() => {
      expect(setCalendarRsvp).toHaveBeenCalledWith("tok", "MANUAL", "e1", "k1", {
        status: "YES",
      })
    })
    await waitFor(() => {
      expect(within(heroSlideIn(agenda)).getByText("Sam needs a ride")).toBeInTheDocument()
    })
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
        now={AGENDA_TEST_NOW}
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
    expect(within(item).getByTestId("rsvp-MANUAL-e1-k1")).toHaveAttribute(
      "data-attendance",
      "not_going",
    )
    expect(within(item).getByRole("button", { name: "Edit" })).toBeInTheDocument()
  })

  it("confirms before marking not going when the kid has active coverage", async () => {
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
        now={AGENDA_TEST_NOW}
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
          listCalendar: vi.fn().mockResolvedValue([earlierFocusDecoy(), baseItem]),
          setCalendarRsvp,
        })}
        onSignedOut={vi.fn()}
      />,
    )

    const agenda = await screen.findByLabelText("Agenda")
    const covered = within(agenda).getByTestId("agenda-item-MANUAL-e1")
    await expandAgendaItem(user, covered)
    await user.click(
      within(covered).getByRole("button", { name: "Mark Sam as not going" }),
    )

    expect(confirmSpy).toHaveBeenCalledWith("This will remove coverage for Sam.")
    await waitFor(() => {
      expect(setCalendarRsvp).toHaveBeenCalledWith("tok", "MANUAL", "e1", "k1", {
        status: "NO",
      })
    })
    expect(within(agenda).queryByText(/Alex · Sam · Confirmed/)).not.toBeInTheDocument()
    await waitFor(() => {
      expect(within(covered).getByTestId("rsvp-MANUAL-e1-k1")).toHaveAttribute(
        "data-attendance",
        "not_going",
      )
    })
    confirmSpy.mockRestore()
  })

  it("disables attendance toggle while RSVP write is in flight", async () => {
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
      rsvps: [{ kidId: "k1", status: "YES" }],
    })
    let resolveRsvp!: (value: CalendarItem) => void
    const setCalendarRsvp = vi.fn(
      () =>
        new Promise<CalendarItem>((resolve) => {
          resolveRsvp = resolve
        }),
    )

    render(
      <FamilyScreen
        now={AGENDA_TEST_NOW}
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
    const item = within(agenda).getByTestId("agenda-item-MANUAL-e1")
    await expandAgendaItem(user, item)
    const toggle = within(item).getByRole("button", { name: "Mark Sam as not going" })
    void user.click(toggle)

    await waitFor(() => {
      expect(toggle).toBeDisabled()
    })
    expect(setCalendarRsvp).toHaveBeenCalledWith("tok", "MANUAL", "e1", "k1", {
      status: "NO",
    })

    resolveRsvp({
      ...baseItem,
      rsvps: [{ kidId: "k1", status: "NO" }],
      uncoveredKidIds: [],
    })
    await waitFor(() => {
      expect(
        within(item).getByRole("button", { name: "Mark as going again" }),
      ).not.toBeDisabled()
    })
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
        now={AGENDA_TEST_NOW}
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
          listCalendar: vi.fn().mockResolvedValue([earlierFocusDecoy(), baseItem]),
          setCalendarRsvp,
        })}
        onSignedOut={vi.fn()}
      />,
    )

    const agenda = await screen.findByLabelText("Agenda")
    const covered = within(agenda).getByTestId("agenda-item-MANUAL-e1")
    await expandAgendaItem(user, covered)
    await user.click(
      within(covered).getByRole("button", { name: "Mark Sam as not going" }),
    )

    expect(confirmSpy).toHaveBeenCalled()
    expect(setCalendarRsvp).not.toHaveBeenCalled()
    expect(within(covered).getByTestId("rsvp-MANUAL-e1-k1")).toHaveAttribute(
      "data-attendance",
      "going",
    )
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
        now={AGENDA_TEST_NOW}
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

    const agenda = await screen.findByLabelText("Agenda")
    const slide = heroSlideIn(agenda, "Sam needs a ride")
    expect(within(slide).getByText("Sam needs a ride")).toBeInTheDocument()
    expect(within(slide).getByTestId("driver-picker")).toBeInTheDocument()
    expect(within(slide).getByRole("button", { name: "Confirm I'll drive" })).toBeInTheDocument()
  })

  describe("weekly list focus sync", () => {
    function weeklyListSession() {
      const session = new AuthSessionHolder()
      session.setSession("tok", {
        id: "1",
        email: "parent@example.com",
        displayName: "Alex",
      })
      return session
    }

    function weeklyListCircle() {
      return circleFixture({
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
    }

    it("applies list-row focus ring only on attentionQueue[0]", async () => {
      render(
        <FamilyScreen
          now={AGENDA_TEST_NOW}
          session={weeklyListSession()}
          familyClient={mockFamilyClient({
            getCircle: vi.fn().mockResolvedValue(weeklyListCircle()),
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
      const focusedRow = within(agenda).getByTestId("agenda-row-MANUAL-e2")
      const calmRow = within(agenda).getByTestId("agenda-row-MANUAL-e1")

      expect(focusedRow).toHaveAttribute("data-focused", "true")
      expect(focusedRow.className).toMatch(/--fc-list-row-focus-border/)
      expect(focusedRow.style.boxShadow).toContain("--fc-list-row-focus-halo")

      expect(calmRow).toHaveAttribute("data-focused", "false")
      expect(calmRow.className).toContain("border-[var(--fc-border)]")
      expect(calmRow.className).not.toMatch(/--fc-list-row-focus-border/)
      expect(calmRow.style.boxShadow).toBe("")
    })

    it("renders attentionQueue[0] in the hero carousel and flat list together", async () => {
      render(
        <FamilyScreen
          now={AGENDA_TEST_NOW}
          session={weeklyListSession()}
          familyClient={mockFamilyClient({
            getCircle: vi.fn().mockResolvedValue(weeklyListCircle()),
            listCalendar: vi.fn().mockResolvedValue([
              calendarItem({
                id: "gap",
                source: "MANUAL",
                title: "Gap practice",
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
      expect(heroCarouselIn(agenda)).toBeInTheDocument()
      expect(within(heroSlideIn(agenda)).getByText("Sam needs a ride")).toBeInTheDocument()
      expect(within(agenda).getByTestId("agenda-item-MANUAL-gap")).toBeInTheDocument()
      expect(within(agenda).getByTestId("agenda-row-MANUAL-gap")).toHaveAttribute(
        "data-focused",
        "true",
      )
    })

    it("shows DriverPicker in an expanded list gap row without legacy assign controls", async () => {
      const user = userEvent.setup()

      render(
        <FamilyScreen
          now={AGENDA_TEST_NOW}
          session={weeklyListSession()}
          familyClient={mockFamilyClient({
            getCircle: vi.fn().mockResolvedValue(weeklyListCircle()),
            listCalendar: vi.fn().mockResolvedValue([
              calendarItem({
                id: "gap",
                source: "MANUAL",
                title: "Gap practice",
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
      const listRow = within(agenda).getByTestId("agenda-item-MANUAL-gap")
      await expandAgendaItem(user, listRow)

      expect(within(listRow).getByTestId("driver-picker")).toBeInTheDocument()
      expect(within(listRow).queryByRole("button", { name: "Assign coverage" })).not.toBeInTheDocument()
      expect(within(listRow).queryByRole("combobox", { name: /driver/i })).not.toBeInTheDocument()
    })

    it("hides inbound Accept and Pass on the list row when the ask is in the hero queue", async () => {
      const user = userEvent.setup()
      const pendingInbound = {
        id: "pending-inbound",
        spaceId: "s1",
        eventKey: "UID:practice-inbound",
        requestingCircleId: "c2",
        requestingCircleName: "House B",
        requestedByAdultId: "a2",
        kidIds: ["k2"],
        kidFirstNames: ["Mia"],
        seats: 1,
        pickupPlaceName: "Home",
        pickupAddress: "1 Main",
pickupTown: null,
detourMinutes: null,
        status: "PENDING" as const,
        passedByMe: false,
        passedByAdultNames: [],
        acceptedByAdultId: null,
        acceptingCircleId: null,
        acceptingCircleName: null,
        vehicleId: null,
        vehicleLabel: null,
      }
      const feedItem = calendarItem({
        id: "e-feed-inbound",
        source: "FEED",
        title: "Practice",
        startsAt: "2030-08-15T17:00:00.000Z",
        kidIds: ["k1"],
        feedId: "f1",
        feedName: "Soccer",
        eventKey: "UID:practice-inbound",
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
      const listRides = vi.fn().mockResolvedValue([
        {
          eventKey: "UID:practice-inbound",
          title: "Practice",
          startsAt: "2030-08-15T17:00:00.000Z",
          endsAt: null,
          defaultKidIds: ["k1"],
          ownRequest: null,
          otherRequests: [pendingInbound],
        },
      ])
      const getSummary = vi.fn().mockResolvedValue({
        circleRole: "ORGANIZER",
        feeds: [
          {
            feedId: "f1",
            feedName: "Soccer",
            status: "OWNER",
            spaceId: "s1",
            spaceName: "Soccer",
          },
        ],
        spaces: [
          {
            id: "s1",
            name: "Soccer",
            membership: "OWNER",
            inviteCode: "AB12CD34",
            callerFeedId: "f1",
            members: [{ circleId: "c1", circleName: "House", membership: "OWNER" }],
            pendingRequests: [],
          },
        ],
      })

      render(
        <FamilyScreen
          now={AGENDA_TEST_NOW}
          session={weeklyListSession()}
          familyClient={mockFamilyClient({
            getCircle: vi.fn().mockResolvedValue(weeklyListCircle()),
            getInvite: vi.fn().mockResolvedValue({ code: "AB12CD34" }),
            listFeeds: vi.fn().mockResolvedValue([]),
            listCalendar: vi.fn().mockResolvedValue([feedItem]),
            getGarage: vi.fn().mockResolvedValue({
              members: [{ adultId: "1", displayName: "Alex", drives: true }],
              vehicles: [
                {
                  id: "v1",
                  ownerAdultId: "1",
                  driverAdultIds: ["1"],
                  keptAtPlaceId: null,
                  label: "SUV",
                  year: 2021,
                  make: "Honda",
                  model: "Pilot",
                  seats: 5,
                  suggestedSeats: null,
                },
              ],
            }),
          })}
          carpoolClient={mockCarpoolClient({ getSummary, listRides })}
          onSignedOut={vi.fn()}
        />,
      )

      const agenda = await screen.findByLabelText("Agenda")
      const listRow = within(agenda).getByTestId("agenda-item-FEED-e-feed-inbound")
      await waitFor(() => {
        expect(listRides).toHaveBeenCalledWith(
          "tok",
          "s1",
          expect.any(String),
          expect.any(String),
        )
      })
      await waitFor(() => {
        expect(listRow).toHaveAttribute("data-carpool-ride-key", "UID:practice-inbound")
      })

      const slide = heroSlideIn(agenda)
      expect(within(slide).getByText("House B need a ride for Mia")).toBeInTheDocument()
      expect(within(slide).getByRole("button", { name: "Accept" })).toBeInTheDocument()

      expect(within(listRow).getByTestId("agenda-row-FEED-e-feed-inbound")).toHaveAttribute(
        "data-focused",
        "true",
      )

      await expandAgendaItem(user, listRow)
      const inbound = within(listRow).getByTestId("agenda-band-inbound-requests")
      expect(within(inbound).getByText("Handle in Needs your attention above")).toBeInTheDocument()
      expect(within(inbound).queryByRole("button", { name: "Accept" })).not.toBeInTheDocument()
      expect(within(inbound).queryByRole("button", { name: "Pass" })).not.toBeInTheDocument()
    })

    it("leaves every list row unfocused when attentionQueue is empty", async () => {
      render(
        <FamilyScreen
          now={AGENDA_TEST_NOW}
          session={weeklyListSession()}
          familyClient={mockFamilyClient({
            getCircle: vi.fn().mockResolvedValue(weeklyListCircle()),
            listCalendar: vi.fn().mockResolvedValue([
              calendarItem({
                id: "e1",
                source: "MANUAL",
                title: "Practice",
                startsAt: "2030-08-25T17:00:00.000Z",
                kidIds: ["k1"],
              }),
            ]),
          })}
          onSignedOut={vi.fn()}
        />,
      )

      const agenda = await screen.findByLabelText("Agenda")
      expect(within(agenda).getByTestId("hero-attention-empty")).toBeInTheDocument()
      expect(within(agenda).getByTestId("agenda-row-MANUAL-e1")).toHaveAttribute(
        "data-focused",
        "false",
      )
    })
  })

  describe("ride revert undo", () => {
    function revertSession() {
      const session = new AuthSessionHolder()
      session.setSession("tok", {
        id: "1",
        email: "parent@example.com",
        displayName: "Alex",
      })
      return session
    }

    function revertCircle() {
      return circleFixture({
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
    }

    const garage = {
      members: [{ adultId: "1", displayName: "Alex", drives: true }],
      vehicles: [
        {
          id: "v1",
          ownerAdultId: "1",
          driverAdultIds: ["1"],
          keptAtPlaceId: null,
          label: "SUV",
          year: 2021,
          make: "Honda",
          model: "Pilot",
          seats: 5,
          suggestedSeats: null,
        },
      ],
    }

    const carpoolSummary = {
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
          members: [{ circleId: "c1", circleName: "House", membership: "OWNER" as const }],
          pendingRequests: [],
        },
      ],
    }

    it("cancels a PENDING team ask via RevertRideLink without a dialog", async () => {
      const user = userEvent.setup()
      const cancelRide = vi.fn().mockResolvedValue({
        id: "ride-ask",
        spaceId: "s1",
        eventKey: "UID:ask",
        requestingCircleId: "c1",
        requestingCircleName: "House",
        requestedByAdultId: "1",
        kidIds: ["k1"],
        kidFirstNames: ["Sam"],
        seats: 1,
        pickupPlaceName: "Home",
        pickupAddress: "1 Main",
pickupTown: null,
detourMinutes: null,
        status: "CANCELLED",
        passedByMe: false,
        passedByAdultNames: [],
        acceptedByAdultId: null,
        acceptingCircleId: null,
        acceptingCircleName: null,
        vehicleId: null,
        vehicleLabel: null,
      })
      const ownPending = {
        id: "ride-ask",
        spaceId: "s1",
        eventKey: "UID:ask",
        requestingCircleId: "c1",
        requestingCircleName: "House",
        requestedByAdultId: "1",
        kidIds: ["k1"],
        kidFirstNames: ["Sam"],
        seats: 1,
        pickupPlaceName: "Home",
        pickupAddress: "1 Main",
pickupTown: null,
detourMinutes: null,
        status: "PENDING" as const,
        passedByMe: false,
        passedByAdultNames: [],
        acceptedByAdultId: null,
        acceptingCircleId: null,
        acceptingCircleName: null,
        vehicleId: null,
        vehicleLabel: null,
      }
      const listRides = vi
        .fn()
        .mockResolvedValueOnce([
          {
            eventKey: "UID:ask",
            title: "Practice",
            startsAt: "2030-08-15T17:00:00.000Z",
            endsAt: null,
            defaultKidIds: ["k1"],
            ownRequest: ownPending,
            otherRequests: [],
          },
        ])
        .mockResolvedValue([
          {
            eventKey: "UID:ask",
            title: "Practice",
            startsAt: "2030-08-15T17:00:00.000Z",
            endsAt: null,
            defaultKidIds: ["k1"],
            ownRequest: null,
            otherRequests: [],
          },
        ])

      render(
        <FamilyScreen
          now={AGENDA_TEST_NOW}
          session={revertSession()}
          familyClient={mockFamilyClient({
            getCircle: vi.fn().mockResolvedValue(revertCircle()),
            getInvite: vi.fn().mockResolvedValue({ code: "AB12CD34" }),
            listFeeds: vi.fn().mockResolvedValue([]),
            listCalendar: vi.fn().mockResolvedValue([
              calendarItem({
                id: "e-ask",
                source: "FEED",
                title: "Practice",
                startsAt: "2030-08-15T17:00:00.000Z",
                kidIds: ["k1"],
                feedId: "f1",
                feedName: "Soccer",
                eventKey: "UID:ask",
                uncoveredKidIds: ["k1"],
                rsvps: [{ kidId: "k1", status: "YES" }],
              }),
            ]),
            getGarage: vi.fn().mockResolvedValue(garage),
          })}
          carpoolClient={mockCarpoolClient({
            getSummary: vi.fn().mockResolvedValue(carpoolSummary),
            listRides,
            cancelRide,
          })}
          onSignedOut={vi.fn()}
        />,
      )

      const agenda = await screen.findByLabelText("Agenda")
      await waitFor(() => expect(listRides).toHaveBeenCalled())
      const item = within(agenda).getByTestId("agenda-item-FEED-e-ask")
      await expandAgendaItem(user, item)
      await user.click(
        within(item).getByRole("button", {
          name: "No longer need a ride? Cancel this ask",
        }),
      )
      await waitFor(() => {
        expect(cancelRide).toHaveBeenCalledWith("tok", "s1", "ride-ask")
      })
    })

    it("shows Undo after withdraw and re-accepts on click", async () => {
      const user = userEvent.setup()
      const acceptedInbound = {
        id: "ask-in",
        spaceId: "s1",
        eventKey: "UID:withdraw",
        requestingCircleId: "c2",
        requestingCircleName: "House B",
        requestedByAdultId: "a2",
        kidIds: ["k2"],
        kidFirstNames: ["Mia"],
        seats: 1,
        pickupPlaceName: "Home",
        pickupAddress: "1 Main",
pickupTown: null,
detourMinutes: null,
        status: "ACCEPTED" as const,
        passedByMe: false,
        passedByAdultNames: [],
        acceptedByAdultId: "1",
        acceptingCircleId: "c1",
        acceptingCircleName: "House",
        vehicleId: "v1",
        vehicleLabel: "SUV",
      }
      const pendingAfterWithdraw = {
        ...acceptedInbound,
        status: "PENDING" as const,
        acceptedByAdultId: null,
        acceptingCircleId: null,
        acceptingCircleName: null,
        vehicleId: null,
        vehicleLabel: null,
      }
      const withdrawRide = vi.fn().mockResolvedValue(pendingAfterWithdraw)
      const acceptRide = vi.fn().mockResolvedValue(acceptedInbound)
      const listRides = vi
        .fn()
        .mockResolvedValueOnce([
          {
            eventKey: "UID:withdraw",
            title: "Practice",
            startsAt: "2030-08-15T17:00:00.000Z",
            endsAt: null,
            defaultKidIds: ["k1"],
            ownRequest: null,
            otherRequests: [acceptedInbound],
          },
        ])
        .mockResolvedValue([
          {
            eventKey: "UID:withdraw",
            title: "Practice",
            startsAt: "2030-08-15T17:00:00.000Z",
            endsAt: null,
            defaultKidIds: ["k1"],
            ownRequest: null,
            otherRequests: [pendingAfterWithdraw],
          },
        ])

      render(
        <FamilyScreen
          now={AGENDA_TEST_NOW}
          session={revertSession()}
          familyClient={mockFamilyClient({
            getCircle: vi.fn().mockResolvedValue(revertCircle()),
            getInvite: vi.fn().mockResolvedValue({ code: "AB12CD34" }),
            listFeeds: vi.fn().mockResolvedValue([]),
            listCalendar: vi.fn().mockResolvedValue([
              calendarItem({
                id: "e-w",
                source: "FEED",
                title: "Practice",
                startsAt: "2030-08-15T17:00:00.000Z",
                kidIds: ["k1"],
                feedId: "f1",
                feedName: "Soccer",
                eventKey: "UID:withdraw",
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
              }),
            ]),
            getGarage: vi.fn().mockResolvedValue(garage),
          })}
          carpoolClient={mockCarpoolClient({
            getSummary: vi.fn().mockResolvedValue(carpoolSummary),
            listRides,
            withdrawRide,
            acceptRide,
          })}
          onSignedOut={vi.fn()}
        />,
      )

      const agenda = await screen.findByLabelText("Agenda")
      await waitFor(() => expect(listRides).toHaveBeenCalled())
      const item = within(agenda).getByTestId("agenda-item-FEED-e-w")
      await expandAgendaItem(user, item)
      await user.click(
        within(item).getByRole("button", { name: "Can't take them anymore" }),
      )
      await waitFor(() => {
        expect(withdrawRide).toHaveBeenCalledWith("tok", "s1", "ask-in")
      })
      // ADR-0002 §2: withdraw inbound does not drop caller's own coverage.
      expect(within(item).getAllByText("You're driving").length).toBeGreaterThan(0)
      await waitFor(() => {
        expect(within(item).getByRole("button", { name: "Undo" })).toBeInTheDocument()
      })
      expect(within(item).queryByRole("button", { name: "Accept" })).not.toBeInTheDocument()
      await user.click(within(item).getByRole("button", { name: "Undo" }))
      await waitFor(() => {
        expect(acceptRide).toHaveBeenCalledWith("tok", "s1", "ask-in", { vehicleId: "v1" })
      })
    })

    it("clears auto-declined session id on Reconsider accept", async () => {
      const user = userEvent.setup()
      const inboundPending = {
        id: "ask-in",
        spaceId: "s1",
        eventKey: "UID:reconsider",
        requestingCircleId: "c2",
        requestingCircleName: "House B",
        requestedByAdultId: "a2",
        kidIds: ["k2"],
        kidFirstNames: ["Mia"],
        seats: 1,
        pickupPlaceName: "Home",
        pickupAddress: "1 Main",
pickupTown: null,
detourMinutes: null,
        status: "PENDING" as const,
        passedByMe: false,
        passedByAdultNames: [],
        acceptedByAdultId: null,
        acceptingCircleId: null,
        acceptingCircleName: null,
        vehicleId: null,
        vehicleLabel: null,
      }
      const inboundAccepted = {
        ...inboundPending,
        status: "ACCEPTED" as const,
        acceptedByAdultId: "1",
        acceptingCircleId: "c1",
        acceptingCircleName: "House",
        vehicleId: "v1",
        vehicleLabel: "SUV",
      }
      const ownPending = {
        id: "own-ask",
        spaceId: "s1",
        eventKey: "UID:reconsider",
        requestingCircleId: "c1",
        requestingCircleName: "House",
        requestedByAdultId: "1",
        kidIds: ["k1"],
        kidFirstNames: ["Sam"],
        seats: 1,
        pickupPlaceName: "Home",
        pickupAddress: "1 Main",
pickupTown: null,
detourMinutes: null,
        status: "PENDING" as const,
        passedByMe: false,
        passedByAdultNames: [],
        acceptedByAdultId: null,
        acceptingCircleId: null,
        acceptingCircleName: null,
        vehicleId: null,
        vehicleLabel: null,
      }
      const cancelRide = vi.fn().mockResolvedValue({ ...ownPending, status: "CANCELLED" as const })
      const acceptRide = vi.fn().mockResolvedValue(inboundAccepted)
      const withdrawRide = vi.fn().mockResolvedValue(inboundPending)
      const listRides = vi
        .fn()
        .mockResolvedValueOnce([
          {
            eventKey: "UID:reconsider",
            title: "Practice",
            startsAt: "2030-08-15T17:00:00.000Z",
            endsAt: null,
            defaultKidIds: ["k1"],
            ownRequest: ownPending,
            otherRequests: [inboundPending],
          },
        ])
        .mockResolvedValueOnce([
          {
            eventKey: "UID:reconsider",
            title: "Practice",
            startsAt: "2030-08-15T17:00:00.000Z",
            endsAt: null,
            defaultKidIds: ["k1"],
            ownRequest: null,
            otherRequests: [inboundPending],
          },
        ])
        .mockResolvedValueOnce([
          {
            eventKey: "UID:reconsider",
            title: "Practice",
            startsAt: "2030-08-15T17:00:00.000Z",
            endsAt: null,
            defaultKidIds: ["k1"],
            ownRequest: null,
            otherRequests: [inboundAccepted],
          },
        ])
        .mockResolvedValue([
          {
            eventKey: "UID:reconsider",
            title: "Practice",
            startsAt: "2030-08-15T17:00:00.000Z",
            endsAt: null,
            defaultKidIds: ["k1"],
            ownRequest: null,
            otherRequests: [inboundPending],
          },
        ])

      render(
        <FamilyScreen
          now={AGENDA_TEST_NOW}
          session={revertSession()}
          familyClient={mockFamilyClient({
            getCircle: vi.fn().mockResolvedValue(revertCircle()),
            getInvite: vi.fn().mockResolvedValue({ code: "AB12CD34" }),
            listFeeds: vi.fn().mockResolvedValue([]),
            listCalendar: vi.fn().mockResolvedValue([
              calendarItem({
                id: "e-reconsider",
                source: "FEED",
                title: "Practice",
                startsAt: "2030-08-15T17:00:00.000Z",
                kidIds: ["k1"],
                feedId: "f1",
                feedName: "Soccer",
                eventKey: "UID:reconsider",
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
              }),
            ]),
            getGarage: vi.fn().mockResolvedValue(garage),
          })}
          carpoolClient={mockCarpoolClient({
            getSummary: vi.fn().mockResolvedValue(carpoolSummary),
            listRides,
            cancelRide,
            acceptRide,
            withdrawRide,
          })}
          onSignedOut={vi.fn()}
        />,
      )

      const agenda = await screen.findByLabelText("Agenda")
      await waitFor(() => expect(listRides).toHaveBeenCalled())
      const item = within(agenda).getByTestId("agenda-item-FEED-e-reconsider")
      await expandAgendaItem(user, item)
      expect(within(item).getByText("Declined — you needed a ride too")).toBeInTheDocument()
      expect(within(item).queryByRole("button", { name: "Reconsider" })).not.toBeInTheDocument()

      await user.click(
        within(item).getByRole("button", {
          name: "No longer need a ride? Cancel this ask",
        }),
      )
      await waitFor(() => {
        expect(cancelRide).toHaveBeenCalledWith("tok", "s1", "own-ask")
      })
      await waitFor(() => {
        expect(within(item).getByRole("button", { name: "Reconsider" })).toBeInTheDocument()
      })
      expect(within(item).getByText("Declined — you needed a ride too")).toBeInTheDocument()

      await user.click(within(item).getByRole("button", { name: "Reconsider" }))
      await waitFor(() => {
        expect(acceptRide).toHaveBeenCalledWith("tok", "s1", "ask-in", { vehicleId: "v1" })
      })
      await waitFor(() => {
        expect(
          within(item).getByRole("button", { name: "Can't take them anymore" }),
        ).toBeInTheDocument()
      })

      await user.click(
        within(item).getByRole("button", { name: "Can't take them anymore" }),
      )
      await waitFor(() => {
        expect(withdrawRide).toHaveBeenCalledWith("tok", "s1", "ask-in")
      })
      await waitFor(() => {
        expect(within(item).getByRole("button", { name: "Undo" })).toBeInTheDocument()
      })
      // Cleared autoDeclined session id — withdraw shows Undo, not sticky Reconsider.
      expect(within(item).queryByText("Declined — you needed a ride too")).not.toBeInTheDocument()
      expect(within(item).queryByRole("button", { name: "Reconsider" })).not.toBeInTheDocument()
    })

    it("re-applies auto-decline on load while own ride is still requested", async () => {
      const user = userEvent.setup()
      const createRide = vi.fn()
      const listRides = vi.fn().mockResolvedValue([
        {
          eventKey: "UID:reload-decline",
          title: "Practice",
          startsAt: "2030-08-15T17:00:00.000Z",
          endsAt: null,
          defaultKidIds: ["k1"],
          ownRequest: {
            id: "own-ask",
            spaceId: "s1",
            eventKey: "UID:reload-decline",
            requestingCircleId: "c1",
            requestingCircleName: "House",
            requestedByAdultId: "1",
            kidIds: ["k1"],
            kidFirstNames: ["Sam"],
            seats: 1,
            pickupPlaceName: "Home",
            pickupAddress: "1 Main",
pickupTown: null,
detourMinutes: null,
            status: "PENDING" as const,
            passedByMe: false,
            passedByAdultNames: [],
            acceptedByAdultId: null,
            acceptingCircleId: null,
            acceptingCircleName: null,
            vehicleId: null,
            vehicleLabel: null,
          },
          otherRequests: [
            {
              id: "inbound-ask",
              spaceId: "s1",
              eventKey: "UID:reload-decline",
              requestingCircleId: "c2",
              requestingCircleName: "House B",
              requestedByAdultId: "a2",
              kidIds: ["k2"],
              kidFirstNames: ["Mia"],
              seats: 1,
              pickupPlaceName: "Home",
              pickupAddress: "1 Main",
pickupTown: null,
detourMinutes: null,
              status: "PENDING" as const,
              passedByMe: false,
              passedByAdultNames: [],
              acceptedByAdultId: null,
              acceptingCircleId: null,
              acceptingCircleName: null,
              vehicleId: null,
              vehicleLabel: null,
            },
          ],
        },
      ])

      render(
        <FamilyScreen
          now={AGENDA_TEST_NOW}
          session={revertSession()}
          familyClient={mockFamilyClient({
            getCircle: vi.fn().mockResolvedValue(revertCircle()),
            getInvite: vi.fn().mockResolvedValue({ code: "AB12CD34" }),
            listFeeds: vi.fn().mockResolvedValue([]),
            listCalendar: vi.fn().mockResolvedValue([
              calendarItem({
                id: "e-reload-decline",
                source: "FEED",
                title: "Practice",
                startsAt: "2030-08-15T17:00:00.000Z",
                kidIds: ["k1"],
                feedId: "f1",
                feedName: "Soccer",
                eventKey: "UID:reload-decline",
                uncoveredKidIds: ["k1"],
                rsvps: [{ kidId: "k1", status: "YES" }],
              }),
            ]),
            getGarage: vi.fn().mockResolvedValue(garage),
          })}
          carpoolClient={mockCarpoolClient({
            getSummary: vi.fn().mockResolvedValue(carpoolSummary),
            listRides,
            createRide,
          })}
          onSignedOut={vi.fn()}
        />,
      )

      const agenda = await screen.findByLabelText("Agenda")
      await waitFor(() => expect(listRides).toHaveBeenCalled())
      // Remap central step — not createRide — excludes inbound from the hero.
      expect(createRide).not.toHaveBeenCalled()
      expect(within(agenda).getByTestId("hero-attention-empty")).toBeInTheDocument()
      expect(within(agenda).queryByText(/House B needs a ride/i)).not.toBeInTheDocument()

      const item = within(agenda).getByTestId("agenda-item-FEED-e-reload-decline")
      await expandAgendaItem(user, item)
      expect(within(item).getByText("Declined — you needed a ride too")).toBeInTheDocument()
      expect(within(item).queryByRole("button", { name: "Accept" })).not.toBeInTheDocument()
      expect(within(item).queryByRole("button", { name: "Pass" })).not.toBeInTheDocument()
      expect(within(item).queryByText("1 carpool ask")).not.toBeInTheDocument()
    })

    it("auto-declines inbound after Ask the team succeeds", async () => {
      const user = userEvent.setup()
      const inboundPending = {
        id: "inbound-ask",
        spaceId: "s1",
        eventKey: "UID:ask-decline",
        requestingCircleId: "c2",
        requestingCircleName: "House B",
        requestedByAdultId: "a2",
        kidIds: ["k2"],
        kidFirstNames: ["Mia"],
        seats: 1,
        pickupPlaceName: "Home",
        pickupAddress: "1 Main",
pickupTown: null,
detourMinutes: null,
        status: "PENDING" as const,
        passedByMe: false,
        passedByAdultNames: [],
        acceptedByAdultId: null,
        acceptingCircleId: null,
        acceptingCircleName: null,
        vehicleId: null,
        vehicleLabel: null,
      }
      const ownPending = {
        id: "own-ask",
        spaceId: "s1",
        eventKey: "UID:ask-decline",
        requestingCircleId: "c1",
        requestingCircleName: "House",
        requestedByAdultId: "1",
        kidIds: ["k1"],
        kidFirstNames: ["Sam"],
        seats: 1,
        pickupPlaceName: "Home",
        pickupAddress: "1 Main",
pickupTown: null,
detourMinutes: null,
        status: "PENDING" as const,
        passedByMe: false,
        passedByAdultNames: [],
        acceptedByAdultId: null,
        acceptingCircleId: null,
        acceptingCircleName: null,
        vehicleId: null,
        vehicleLabel: null,
      }
      const createRide = vi.fn().mockResolvedValue(ownPending)
      const listRides = vi
        .fn()
        .mockResolvedValueOnce([
          {
            eventKey: "UID:ask-decline",
            title: "Practice",
            startsAt: "2030-08-15T17:00:00.000Z",
            endsAt: null,
            defaultKidIds: ["k1"],
            ownRequest: null,
            otherRequests: [inboundPending],
          },
        ])
        .mockResolvedValue([
          {
            eventKey: "UID:ask-decline",
            title: "Practice",
            startsAt: "2030-08-15T17:00:00.000Z",
            endsAt: null,
            defaultKidIds: ["k1"],
            ownRequest: ownPending,
            otherRequests: [inboundPending],
          },
        ])

      render(
        <FamilyScreen
          now={AGENDA_TEST_NOW}
          session={revertSession()}
          familyClient={mockFamilyClient({
            getCircle: vi.fn().mockResolvedValue(revertCircle()),
            getInvite: vi.fn().mockResolvedValue({ code: "AB12CD34" }),
            listFeeds: vi.fn().mockResolvedValue([]),
            listCalendar: vi.fn().mockResolvedValue([
              calendarItem({
                id: "e-ask-decline",
                source: "FEED",
                title: "Practice",
                startsAt: "2030-08-15T17:00:00.000Z",
                kidIds: ["k1"],
                feedId: "f1",
                feedName: "Soccer",
                eventKey: "UID:ask-decline",
                uncoveredKidIds: ["k1"],
                rsvps: [{ kidId: "k1", status: "YES" }],
              }),
            ]),
            getGarage: vi.fn().mockResolvedValue(garage),
          })}
          carpoolClient={mockCarpoolClient({
            getSummary: vi.fn().mockResolvedValue(carpoolSummary),
            listRides,
            createRide,
          })}
          onSignedOut={vi.fn()}
        />,
      )

      const agenda = await screen.findByLabelText("Agenda")
      await waitFor(() => expect(listRides).toHaveBeenCalled())
      const slide = heroSlideIn(agenda, "Sam needs a ride")
      // No warning copy before Ask the team (spec non-goal).
      expect(within(slide).queryByText(/warning/i)).not.toBeInTheDocument()
      await user.click(within(slide).getByRole("button", { name: "Ask the team for a ride" }))
      await waitFor(() => {
        expect(createRide).toHaveBeenCalledWith("tok", "s1", {
          eventKey: "UID:ask-decline",
          kidIds: ["k1"],
        })
      })

      await waitFor(() => {
        expect(within(agenda).getByTestId("hero-attention-empty")).toBeInTheDocument()
      })
      expect(within(agenda).queryByText(/House B needs a ride/i)).not.toBeInTheDocument()

      const item = within(agenda).getByTestId("agenda-item-FEED-e-ask-decline")
      await expandAgendaItem(user, item)
      expect(within(item).getByText("Declined — you needed a ride too")).toBeInTheDocument()
      expect(within(item).queryByRole("button", { name: "Accept" })).not.toBeInTheDocument()
      expect(within(item).queryByRole("button", { name: "Pass" })).not.toBeInTheDocument()
    })

    it("cancels PENDING own team ask when Assign covers intersecting kids", async () => {
      const user = userEvent.setup()
      const ownPending = {
        id: "own-ask",
        spaceId: "s1",
        eventKey: "UID:assign-cancel",
        requestingCircleId: "c1",
        requestingCircleName: "House",
        requestedByAdultId: "1",
        kidIds: ["k1"],
        kidFirstNames: ["Sam"],
        seats: 1,
        pickupPlaceName: "Home",
        pickupAddress: "1 Main",
pickupTown: null,
detourMinutes: null,
        status: "PENDING" as const,
        passedByMe: false,
        passedByAdultNames: [],
        acceptedByAdultId: null,
        acceptingCircleId: null,
        acceptingCircleName: null,
        vehicleId: null,
        vehicleLabel: null,
      }
      const cancelRide = vi.fn().mockResolvedValue({ ...ownPending, status: "CANCELLED" as const })
      const assignCalendarCoverage = vi.fn().mockResolvedValue(
        calendarItem({
          id: "e-assign-cancel",
          source: "FEED",
          title: "Practice",
          startsAt: "2030-08-15T17:00:00.000Z",
          kidIds: ["k1"],
          feedId: "f1",
          feedName: "Soccer",
          eventKey: "UID:assign-cancel",
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
        }),
      )
      const listRides = vi
        .fn()
        .mockResolvedValueOnce([
          {
            eventKey: "UID:assign-cancel",
            title: "Practice",
            startsAt: "2030-08-15T17:00:00.000Z",
            endsAt: null,
            defaultKidIds: ["k1"],
            ownRequest: ownPending,
            otherRequests: [],
          },
        ])
        .mockResolvedValue([
          {
            eventKey: "UID:assign-cancel",
            title: "Practice",
            startsAt: "2030-08-15T17:00:00.000Z",
            endsAt: null,
            defaultKidIds: ["k1"],
            ownRequest: null,
            otherRequests: [],
          },
        ])

      render(
        <FamilyScreen
          now={AGENDA_TEST_NOW}
          session={revertSession()}
          familyClient={mockFamilyClient({
            getCircle: vi.fn().mockResolvedValue(revertCircle()),
            getInvite: vi.fn().mockResolvedValue({ code: "AB12CD34" }),
            listFeeds: vi.fn().mockResolvedValue([]),
            listCalendar: vi.fn().mockResolvedValue([
              calendarItem({
                id: "e-assign-cancel",
                source: "FEED",
                title: "Practice",
                startsAt: "2030-08-15T17:00:00.000Z",
                kidIds: ["k1"],
                feedId: "f1",
                feedName: "Soccer",
                eventKey: "UID:assign-cancel",
                uncoveredKidIds: ["k1"],
                rsvps: [{ kidId: "k1", status: "YES" }],
              }),
            ]),
            getGarage: vi.fn().mockResolvedValue(garage),
            assignCalendarCoverage,
          })}
          carpoolClient={mockCarpoolClient({
            getSummary: vi.fn().mockResolvedValue(carpoolSummary),
            listRides,
            cancelRide,
          })}
          onSignedOut={vi.fn()}
        />,
      )

      const agenda = await screen.findByLabelText("Agenda")
      await waitFor(() => expect(listRides).toHaveBeenCalled())
      const item = within(agenda).getByTestId("agenda-item-FEED-e-assign-cancel")
      await expandAgendaItem(user, item)
      expect(
        within(item).getByRole("button", {
          name: "No longer need a ride? Cancel this ask",
        }),
      ).toBeInTheDocument()
      await user.click(within(item).getByRole("button", { name: "Confirm I'll drive" }))
      await waitFor(() => {
        expect(assignCalendarCoverage).toHaveBeenCalledWith("tok", "FEED", "e-assign-cancel", {
          coveringAdultId: "1",
          kidIds: ["k1"],
        })
      })
      await waitFor(() => {
        expect(cancelRide).toHaveBeenCalledWith("tok", "s1", "own-ask")
      })
      expect(cancelRide.mock.invocationCallOrder[0]!).toBeGreaterThan(
        assignCalendarCoverage.mock.invocationCallOrder[0]!,
      )
      await waitFor(() => {
        expect(within(item).queryByText("Asked the team")).not.toBeInTheDocument()
      })
      // No confirmation dialog on Assign→cancel-own-ask (ADR-0002).
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    })

    it("cancels an ACCEPTED teammate ride via RevertRideLink", async () => {
      const user = userEvent.setup()
      const cancelRide = vi.fn().mockResolvedValue({
        id: "ride-teammate",
        spaceId: "s1",
        eventKey: "UID:team",
        requestingCircleId: "c1",
        requestingCircleName: "House",
        requestedByAdultId: "1",
        kidIds: ["k1"],
        kidFirstNames: ["Sam"],
        seats: 1,
        pickupPlaceName: "Home",
        pickupAddress: "1 Main",
pickupTown: null,
detourMinutes: null,
        status: "CANCELLED",
        passedByMe: false,
        passedByAdultNames: [],
        acceptedByAdultId: null,
        acceptingCircleId: null,
        acceptingCircleName: null,
        vehicleId: null,
        vehicleLabel: null,
      })
      const acceptedOwn = {
        id: "ride-teammate",
        spaceId: "s1",
        eventKey: "UID:team",
        requestingCircleId: "c1",
        requestingCircleName: "House",
        requestedByAdultId: "1",
        kidIds: ["k1"],
        kidFirstNames: ["Sam"],
        seats: 1,
        pickupPlaceName: "Home",
        pickupAddress: "1 Main",
pickupTown: null,
detourMinutes: null,
        status: "ACCEPTED" as const,
        passedByMe: false,
        passedByAdultNames: [],
        acceptedByAdultId: "a2",
        acceptingCircleId: "c2",
        acceptingCircleName: "House B",
        vehicleId: "v9",
        vehicleLabel: "Van",
      }
      const listRides = vi
        .fn()
        .mockResolvedValueOnce([
          {
            eventKey: "UID:team",
            title: "Practice",
            startsAt: "2030-08-15T17:00:00.000Z",
            endsAt: null,
            defaultKidIds: [],
            ownRequest: acceptedOwn,
            otherRequests: [],
          },
        ])
        .mockResolvedValue([
          {
            eventKey: "UID:team",
            title: "Practice",
            startsAt: "2030-08-15T17:00:00.000Z",
            endsAt: null,
            defaultKidIds: ["k1"],
            ownRequest: null,
            otherRequests: [],
          },
        ])

      render(
        <FamilyScreen
          now={AGENDA_TEST_NOW}
          session={revertSession()}
          familyClient={mockFamilyClient({
            getCircle: vi.fn().mockResolvedValue(revertCircle()),
            getInvite: vi.fn().mockResolvedValue({ code: "AB12CD34" }),
            listFeeds: vi.fn().mockResolvedValue([]),
            listCalendar: vi.fn().mockResolvedValue([
              calendarItem({
                id: "e-team",
                source: "FEED",
                title: "Practice",
                startsAt: "2030-08-15T17:00:00.000Z",
                kidIds: ["k1"],
                feedId: "f1",
                feedName: "Soccer",
                eventKey: "UID:team",
                uncoveredKidIds: ["k1"],
                rsvps: [{ kidId: "k1", status: "YES" }],
              }),
            ]),
            getGarage: vi.fn().mockResolvedValue(garage),
          })}
          carpoolClient={mockCarpoolClient({
            getSummary: vi.fn().mockResolvedValue(carpoolSummary),
            listRides,
            cancelRide,
          })}
          onSignedOut={vi.fn()}
        />,
      )

      const agenda = await screen.findByLabelText("Agenda")
      await waitFor(() => expect(listRides).toHaveBeenCalled())
      const item = within(agenda).getByTestId("agenda-item-FEED-e-team")
      await expandAgendaItem(user, item)
      await user.click(
        within(item).getByRole("button", {
          name: "House B can't drive anymore? Find a new ride",
        }),
      )
      await waitFor(() => {
        expect(cancelRide).toHaveBeenCalledWith("tok", "s1", "ride-teammate")
      })
    })

    it("does not put RevertRideLink on hero carousel gap slides", async () => {
      render(
        <FamilyScreen
          now={AGENDA_TEST_NOW}
          session={revertSession()}
          familyClient={mockFamilyClient({
            getCircle: vi.fn().mockResolvedValue(revertCircle()),
            listCalendar: vi.fn().mockResolvedValue([
              calendarItem({
                id: "gap",
                source: "MANUAL",
                title: "Gap practice",
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
      const slide = heroSlideIn(agenda)
      expect(within(slide).getByTestId("driver-picker")).toBeInTheDocument()
      expect(
        within(slide).queryByRole("button", { name: /can't drive anymore/i }),
      ).not.toBeInTheDocument()
      expect(
        within(slide).queryByRole("button", { name: /cancel this ask/i }),
      ).not.toBeInTheDocument()
      expect(
        within(slide).queryByRole("button", { name: /find a new ride/i }),
      ).not.toBeInTheDocument()
    })
  })
})
