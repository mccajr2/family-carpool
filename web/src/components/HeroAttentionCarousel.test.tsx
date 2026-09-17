import { fireEvent, render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import type { CalendarItem, CarpoolRideEvent, FamilyCircle } from "@/api/types"
import { HeroAttentionCarousel } from "@/components/HeroAttentionCarousel"
import type { HeroAttentionSlideProps } from "@/components/HeroAttentionSlide"
import type { CoverageGameEvent, QueueItem } from "@/components/coverageQueue"
import { carpoolLeg, carpoolLegsBoth } from "@/api/carpoolLegs"

const circle: FamilyCircle = {
  id: "c1",
  name: "Test",
  role: "ORGANIZER",
  members: [
    { adultId: "a1", email: "a@example.com", displayName: "Alex", role: "ORGANIZER" },
    { adultId: "a2", email: "j@example.com", displayName: "Jordan", role: "CAREGIVER" },
  ],
  kids: [{ id: "k1", displayName: "Declan" }],
  places: [],
  defaultLeaveFromPlaceId: null,
  defaultLeaveFromPlaceName: null,
}

function calendarItem(partial: Partial<CalendarItem> = {}): CalendarItem {
  const kidIds = partial.kidIds ?? ["k1"]
  return {
    source: "FEED",
    id: "e1",
    title: "Mass Admirals",
    startsAt: "2030-08-29T21:20:00.000Z",
    endsAt: "2030-08-29T22:20:00.000Z",
    location: "Allied Veterans Rink, Everett",
    kidIds,
    feedId: "f1",
    feedName: "Sharks · 2016/2017 (BILL)",
    eventKey: "UID:game1",
    leaveFromPlaceId: null,
    leaveFromPlaceName: null,
    leaveFromAddress: null,
    leaveByAt: null,
    leaveByStatus: "PENDING",
    leaveByReason: null,
    coverages: [],
    uncoveredKidIds: ["k1"],
    conflicts: [],
    rsvps: kidIds.map((kidId) => ({ kidId, status: "YES" as const })),
    driveBlockLinks: [],
    ...partial,
  }
}

function game(partial: Partial<CoverageGameEvent> & Pick<CoverageGameEvent, "id">): CoverageGameEvent {
  return {
    kidId: "k1",
    title: "Mass Admirals",
    startsAt: "2030-08-29T21:20:00.000Z",
    order: Date.parse("2030-08-29T21:20:00.000Z"),
    attendance: "going",
    ownRide: "unassigned",
    requests: [],
    ...partial,
  }
}


const rideEvent: CarpoolRideEvent = {
  eventKey: "UID:game1",
  title: "Mass Admirals",
  startsAt: "2030-08-29T21:20:00.000Z",
  endsAt: "2030-08-29T22:20:00.000Z",
  defaultKidIds: ["k1"],
  ownLegs: carpoolLegsBoth("NEEDS_RIDE"),
  ownRequest: null,
  ownRequests: [],
  otherRequests: [
    {
      id: "ride-1",
      spaceId: "s1",
      eventKey: "UID:game1",
      requestingCircleId: "c2",
      requestingCircleName: "the Nguyens",
      requestedByAdultId: "a9",
      kidIds: ["k9"],
      kidFirstNames: ["Ben"],
      seats: 1,
      pickupPlaceName: "Nguyen home",
      pickupAddress: "Cambridge, MA",
      pickupTown: "Cambridge, MA",
      detourMinutes: 4,
      status: "PENDING",
      passedByMe: false,
      passedByAdultNames: [],
      acceptedByAdultId: null,
      acceptingCircleId: null,
      acceptingCircleName: null,
      legs: carpoolLegsBoth("ASKED_TEAM"),
    },
  ],
}

function baseSlideProps(
  item: QueueItem,
  index: number,
  overrides: Partial<HeroAttentionSlideProps> = {},
): HeroAttentionSlideProps {
  return {
    item,
    index,
    queueLength: 2,
    calendarItem: calendarItem(),
    circle,
    currentAdultId: "a1",
    loading: false,
    rideEvent,
    assignDraft: { adultId: "a1", kidIds: [item.game.kidId] },
    onUpdateAssignDraft: vi.fn(),
    onAssignCoverage: vi.fn(),
    onAskTeam: vi.fn(),
    onAcceptRide: vi.fn(),
    onPassRide: vi.fn(),
    now: new Date("2030-08-28T12:00:00.000Z"),
    ...overrides,
  }
}

const ownRideQueue: QueueItem[] = [
  { kind: "ownRide", game: game({ id: "UID:game1:k1" }) },
  {
    kind: "request",
    game: game({
      id: "UID:game2:k1",
      startsAt: "2030-08-30T21:20:00.000Z",
      order: Date.parse("2030-08-30T21:20:00.000Z"),
    }),
    request: {
      id: "ride-1",
      requestingCircleName: "the Nguyens",
      kidFirstNames: ["Ben"],
      seats: 1,
      pickupPlaceName: "Nguyen home",
      pickupAddress: "Cambridge, MA",
      pickupTown: "Cambridge, MA",
      detourMinutes: 4,
      status: "pending",
    },
  },
]

describe("HeroAttentionCarousel", () => {
  it("renders empty hero copy without carousel controls", () => {
    render(
      <HeroAttentionCarousel
        queue={[]}
        slidePropsForItem={() => baseSlideProps(ownRideQueue[0]!, 0)}
      />,
    )

    expect(screen.getByText("Needs your attention")).toBeInTheDocument()
    expect(screen.getByTestId("hero-attention-empty")).toBeInTheDocument()
    expect(screen.getByText("All caught up")).toBeInTheDocument()
    expect(screen.getByText("Nothing needs you right now")).toBeInTheDocument()
    expect(
      screen.getByText(
        /Every ride this week is either covered or waiting on someone else/,
      ),
    ).toBeInTheDocument()
    expect(screen.queryByTestId("hero-attention-controls")).not.toBeInTheDocument()
  })

  it("hides carousel controls when only one slide", () => {
    render(
      <HeroAttentionCarousel
        queue={[ownRideQueue[0]!]}
        slidePropsForItem={(item, index) => baseSlideProps(item, index, { queueLength: 1 })}
      />,
    )

    expect(screen.getByTestId("hero-attention-scroller")).toBeInTheDocument()
    expect(screen.queryByTestId("hero-attention-controls")).not.toBeInTheDocument()
  })

  it("shows dots and arrows when queue length is greater than one", () => {
    render(
      <HeroAttentionCarousel
        queue={ownRideQueue}
        slidePropsForItem={(item, index) => baseSlideProps(item, index)}
      />,
    )

    expect(screen.getByTestId("hero-attention-controls")).toBeInTheDocument()
    expect(screen.getAllByTestId("hero-attention-dot")).toHaveLength(2)
    expect(screen.getByRole("button", { name: "Previous item" })).toBeDisabled()
    expect(screen.getByRole("button", { name: "Next item" })).toBeEnabled()
  })

  it("marks the first dot active by default and advances via arrow click", async () => {
    const user = userEvent.setup()
    const scrollTo = vi.fn()
    Object.defineProperty(HTMLElement.prototype, "scrollTo", {
      configurable: true,
      value: scrollTo,
    })

    render(
      <HeroAttentionCarousel
        queue={ownRideQueue}
        slidePropsForItem={(item, index) => baseSlideProps(item, index)}
      />,
    )

    const scroller = screen.getByTestId("hero-attention-scroller")
    Object.defineProperty(scroller, "clientWidth", { configurable: true, value: 420 })

    const dots = screen.getAllByTestId("hero-attention-dot")
    expect(dots[0]).toHaveAttribute("data-active", "true")
    expect(dots[1]).toHaveAttribute("data-active", "false")

    await user.click(screen.getByRole("button", { name: "Next item" }))
    expect(scrollTo).toHaveBeenCalled()
    expect(dots[1]).toHaveAttribute("data-active", "true")
  })

  it("scrolls to a slide when a dot is clicked", async () => {
    const user = userEvent.setup()
    const scrollTo = vi.fn()
    Object.defineProperty(HTMLElement.prototype, "scrollTo", {
      configurable: true,
      value: scrollTo,
    })

    render(
      <HeroAttentionCarousel
        queue={ownRideQueue}
        slidePropsForItem={(item, index) => baseSlideProps(item, index)}
      />,
    )

    const scroller = screen.getByTestId("hero-attention-scroller")
    Object.defineProperty(scroller, "clientWidth", { configurable: true, value: 420 })

    const dots = screen.getAllByTestId("hero-attention-dot")
    await user.click(dots[1]!)
    expect(scrollTo).toHaveBeenCalled()
    expect(dots[1]).toHaveAttribute("data-active", "true")
  })

  it("syncs active dot to the closest slide on scroll", () => {
    render(
      <HeroAttentionCarousel
        queue={ownRideQueue}
        slidePropsForItem={(item, index) => baseSlideProps(item, index)}
      />,
    )

    const scroller = screen.getByTestId("hero-attention-scroller")
    Object.defineProperty(scroller, "clientWidth", { configurable: true, value: 420 })
    Object.defineProperty(scroller, "scrollLeft", { configurable: true, value: 0 })

    fireEvent.scroll(scroller)
    expect(screen.getAllByTestId("hero-attention-dot")[0]).toHaveAttribute("data-active", "true")

    Object.defineProperty(scroller, "scrollLeft", { configurable: true, value: 420 })
    fireEvent.scroll(scroller)
    expect(screen.getAllByTestId("hero-attention-dot")[1]).toHaveAttribute("data-active", "true")
  })

  it("advances active slide with keyboard arrows when focused", async () => {
    const user = userEvent.setup()
    const scrollTo = vi.fn()
    Object.defineProperty(HTMLElement.prototype, "scrollTo", {
      configurable: true,
      value: scrollTo,
    })

    render(
      <HeroAttentionCarousel
        queue={ownRideQueue}
        slidePropsForItem={(item, index) => baseSlideProps(item, index)}
      />,
    )

    const scroller = screen.getByTestId("hero-attention-scroller")
    Object.defineProperty(scroller, "clientWidth", { configurable: true, value: 420 })
    scroller.focus()
    await user.keyboard("{ArrowRight}")

    const dots = screen.getAllByTestId("hero-attention-dot")
    expect(dots[1]).toHaveAttribute("data-active", "true")
    expect(scrollTo).toHaveBeenCalled()
  })

  it("exposes visible focus rings on scroller, dots, and arrows", () => {
    render(
      <HeroAttentionCarousel
        queue={ownRideQueue}
        slidePropsForItem={(item, index) => baseSlideProps(item, index)}
      />,
    )

    const focusRing = /focus-visible:ring-2/
    expect(screen.getByTestId("hero-attention-scroller").className).toMatch(focusRing)
    expect(screen.getByRole("button", { name: "Previous item" }).className).toMatch(focusRing)
    expect(screen.getByRole("button", { name: "Next item" }).className).toMatch(focusRing)
    for (const dot of screen.getAllByTestId("hero-attention-dot")) {
      expect(dot.className).toMatch(focusRing)
    }
  })

  it("labels each slide shell from the slide title", () => {
    render(
      <HeroAttentionCarousel
        queue={ownRideQueue}
        slidePropsForItem={(item, index) => baseSlideProps(item, index)}
      />,
    )

    const shells = screen.getAllByTestId("hero-attention-slide-shell")
    expect(shells[0]).toHaveAttribute("aria-label", "Declan needs a ride")
    expect(shells[1]).toHaveAttribute("aria-label", "the Nguyens need a ride for Ben")
  })

  it("keeps carousel scroller and controls reflow-friendly at 390px", () => {
    render(
      <div style={{ width: "390px" }}>
        <HeroAttentionCarousel
          queue={ownRideQueue}
          slidePropsForItem={(item, index) => baseSlideProps(item, index)}
        />
      </div>,
    )

    expect(screen.getByTestId("hero-attention-scroller").className).toMatch(/overflow-x-auto/)
    expect(screen.getByTestId("hero-attention-controls").className).toMatch(/flex-wrap/)
    expect(screen.getByTestId("hero-attention-controls").className).toMatch(/max-w-full/)
    expect(screen.getByRole("tablist", { name: "Carousel slides" }).className).toMatch(
      /flex-wrap/,
    )
    for (const shell of screen.getAllByTestId("hero-attention-slide-shell")) {
      expect(shell.className).toMatch(/max-w-full/)
    }
  })

  it("announces the empty state when the queue clears", () => {
    const { rerender } = render(
      <HeroAttentionCarousel
        queue={ownRideQueue}
        slidePropsForItem={(item, index) => baseSlideProps(item, index)}
      />,
    )

    rerender(
      <HeroAttentionCarousel
        queue={[]}
        slidePropsForItem={(item, index) => baseSlideProps(item, index)}
      />,
    )

    expect(screen.getByTestId("hero-attention-live-region")).toHaveTextContent(
      "All caught up. Nothing needs you right now",
    )
  })

  it("announces a new queue item without re-announcing on slide index changes", async () => {
    const user = userEvent.setup()
    const scrollTo = vi.fn()
    Object.defineProperty(HTMLElement.prototype, "scrollTo", {
      configurable: true,
      value: scrollTo,
    })

    const { rerender } = render(
      <HeroAttentionCarousel
        queue={[ownRideQueue[0]!]}
        slidePropsForItem={(item, index) => baseSlideProps(item, index, { queueLength: 1 })}
      />,
    )

    rerender(
      <HeroAttentionCarousel
        queue={ownRideQueue}
        slidePropsForItem={(item, index) => baseSlideProps(item, index)}
      />,
    )

    expect(screen.getByTestId("hero-attention-live-region")).toHaveTextContent(
      "2 things need you",
    )

    const scroller = screen.getByTestId("hero-attention-scroller")
    Object.defineProperty(scroller, "clientWidth", { configurable: true, value: 420 })
    scroller.focus()
    await user.keyboard("{ArrowRight}")

    expect(screen.getByTestId("hero-attention-live-region")).toHaveTextContent(
      "2 things need you",
    )
  })
})

describe("HeroAttentionSlide", () => {
  it("renders ownRide mock copy and driver picker on slide zero", () => {
    render(
      <HeroAttentionCarousel
        queue={[ownRideQueue[0]!]}
        slidePropsForItem={(item, index) => baseSlideProps(item, index, { queueLength: 1 })}
      />,
    )

    const slide = screen.getByTestId("hero-attention-slide")
    expect(within(slide).getByText("Most urgent")).toBeInTheDocument()
    expect(within(slide).queryByText(/things need you/)).not.toBeInTheDocument()
    expect(within(slide).getByText("Declan needs a ride")).toBeInTheDocument()
    expect(within(slide).getByTestId("hero-attention-when")).toBeInTheDocument()
    expect(within(slide).getByTestId("hero-attention-where")).toHaveTextContent(
      "Allied Veterans Rink, Everett",
    )
    expect(within(slide).getByTestId("driver-picker")).toBeInTheDocument()
    expect(within(slide).getByTestId("hero-attention-days-ring")).toHaveTextContent("DAY")
  })

  it("renders request slide copy and accept/decline CTAs", async () => {
    const user = userEvent.setup()
    const onAcceptRide = vi.fn()
    const onPassRide = vi.fn()

    render(
      <HeroAttentionCarousel
        queue={[ownRideQueue[1]!]}
        slidePropsForItem={(item, index) =>
          baseSlideProps(item, index, {
            queueLength: 1,
            onAcceptRide,
            onPassRide,
          })
        }
      />,
    )

    const slide = screen.getByTestId("hero-attention-slide")
    expect(slide).toHaveAttribute("data-slide-kind", "request")
    expect(within(slide).getByText("the Nguyens need a ride for Ben")).toBeInTheDocument()
    expect(within(slide).getByText(/Declan is already going/)).toBeInTheDocument()
    expect(within(slide).getByTestId("hero-attention-pickup-summary")).toHaveTextContent(
      "Pickup in Cambridge, MA",
    )
    expect(
      within(slide).getByTestId("hero-attention-pickup-summary-detour-pill"),
    ).toHaveTextContent("~4 min out of your way")
    expect(within(slide).getByTestId("hero-attention-incoming-leg-chips")).toHaveTextContent(
      "Asked team",
    )
    expect(
      within(slide).getByTestId("hero-attention-incoming-leg-chips").textContent,
    ).not.toMatch(/Getting there:|Coming back:/)

    await user.click(within(slide).getByRole("button", { name: "Accept" }))
    expect(onAcceptRide).toHaveBeenCalledWith("ride-1")
    await user.click(within(slide).getByRole("button", { name: "Decline" }))
    expect(onPassRide).toHaveBeenCalledWith("ride-1")
  })

  it("shows TO-only inbound asks as distinct from round-trip on the hero", () => {
    const toOnlyRideEvent: CarpoolRideEvent = {
      ...rideEvent,
      otherRequests: [
        {
          ...rideEvent.otherRequests[0]!,
          legs: [
            carpoolLeg("TO", "ASKED_TEAM"),
            carpoolLeg("FROM", "NEEDS_RIDE"),
          ],
        },
      ],
    }

    render(
      <HeroAttentionCarousel
        queue={[ownRideQueue[1]!]}
        slidePropsForItem={(item, index) =>
          baseSlideProps(item, index, {
            queueLength: 1,
            rideEvent: toOnlyRideEvent,
          })
        }
      />,
    )

    const chips = within(screen.getByTestId("hero-attention-slide")).getByTestId(
      "hero-attention-incoming-leg-chips",
    )
    expect(within(chips).getByText("Getting there: Asked team")).toBeInTheDocument()
    expect(within(chips).getByText("Coming back: Needs ride")).toBeInTheDocument()
  })

  it("uses theme-independent ink on filled hero CTAs", () => {
    render(
      <HeroAttentionCarousel
        queue={[ownRideQueue[1]!]}
        slidePropsForItem={(item, index) =>
          baseSlideProps(item, index, { queueLength: 1 })
        }
      />,
    )

    const accept = within(screen.getByTestId("hero-attention-slide")).getByRole("button", {
      name: "Accept",
    })
    expect(accept).toHaveStyle({
      backgroundColor: "var(--fc-hero-on)",
      color: "var(--fc-hero-on-inverse)",
    })
  })

  it("shows up next chrome on non-zero slides", () => {
    render(
      <HeroAttentionCarousel
        queue={ownRideQueue}
        slidePropsForItem={(item, index) => baseSlideProps(item, index)}
      />,
    )

    const shells = screen.getAllByTestId("hero-attention-slide-shell")
    const secondSlide = within(shells[1]!).getByTestId("hero-attention-slide")
    expect(within(secondSlide).getByText("Up next")).toBeInTheDocument()
    expect(within(secondSlide).queryByText("Most urgent")).not.toBeInTheDocument()
  })

  it("shows most urgent pill and queue count on slide zero when multiple items", () => {
    render(
      <HeroAttentionCarousel
        queue={ownRideQueue}
        slidePropsForItem={(item, index) => baseSlideProps(item, index)}
      />,
    )

    const firstSlide = within(screen.getAllByTestId("hero-attention-slide-shell")[0]!).getByTestId(
      "hero-attention-slide",
    )
    expect(within(firstSlide).getByText("Most urgent")).toBeInTheDocument()
    expect(within(firstSlide).getByText("· 2 things need you")).toBeInTheDocument()
  })

  it("hides Ask the team when onAskTeam is omitted", () => {
    render(
      <HeroAttentionCarousel
        queue={[ownRideQueue[0]!]}
        slidePropsForItem={(item, index) =>
          baseSlideProps(item, index, { queueLength: 1, onAskTeam: undefined })
        }
      />,
    )

    const slide = screen.getByTestId("hero-attention-slide")
    expect(within(slide).getByTestId("driver-picker")).toBeInTheDocument()
    expect(within(slide).queryByRole("button", { name: "Ask the team" })).not.toBeInTheDocument()
    expect(within(slide).queryByTestId("driver-picker-ask-team-chip")).not.toBeInTheDocument()
  })

  it("wraps hero CTAs inside a 390px slide without horizontal overflow classes", () => {
    render(
      <div style={{ width: "390px" }}>
        <HeroAttentionCarousel
          queue={[ownRideQueue[0]!]}
          slidePropsForItem={(item, index) => baseSlideProps(item, index, { queueLength: 1 })}
        />
      </div>,
    )

    const slide = screen.getByTestId("hero-attention-slide")
    expect(slide.className).toMatch(/min-w-0/)
    const driverPicker = within(slide).getByTestId("driver-picker")
    expect(driverPicker.className).toMatch(/max-w-full/)
    expect(within(slide).getByRole("group", { name: "Household driver" }).className).toMatch(
      /flex-wrap/,
    )
  })

  it("hides the decorative days ring from assistive tech", () => {
    render(
      <HeroAttentionCarousel
        queue={[ownRideQueue[0]!]}
        slidePropsForItem={(item, index) => baseSlideProps(item, index, { queueLength: 1 })}
      />,
    )

    expect(screen.getByTestId("hero-attention-days-ring")).toHaveAttribute("aria-hidden", "true")
  })

  it("keeps separate decision slides for two attention items in one combined block", () => {
    const clockIso = "2030-08-15T18:00:00.000Z"
    const itemA = calendarItem({
      id: "drive-a",
      title: "Practice A",
      startsAt: "2030-08-15T17:00:00.000Z",
      eventKey: "UID:a",
      uncoveredKidIds: ["k1"],
      driveBlockLinks: [
        {
          leg: "TO",
          otherSource: "FEED",
          otherId: "drive-b",
          otherTitle: "Practice B",
          otherStartsAt: clockIso,
          combined: true,
          overrideAction: null,
        },
      ],
    })
    const itemB = calendarItem({
      id: "drive-b",
      title: "Practice B",
      startsAt: clockIso,
      eventKey: "UID:b",
      uncoveredKidIds: ["k1"],
      driveBlockLinks: [
        {
          leg: "TO",
          otherSource: "FEED",
          otherId: "drive-a",
          otherTitle: "Practice A",
          otherStartsAt: "2030-08-15T17:00:00.000Z",
          combined: true,
          overrideAction: null,
        },
      ],
    })
    const queue: QueueItem[] = [
      {
        kind: "ownRide",
        game: game({
          id: "FEED-drive-a:k1",
          title: "Practice A",
          startsAt: itemA.startsAt,
          order: Date.parse(itemA.startsAt),
        }),
      },
      {
        kind: "ownRide",
        game: game({
          id: "FEED-drive-b:k1",
          title: "Practice B",
          startsAt: itemB.startsAt,
          order: Date.parse(itemB.startsAt),
        }),
      },
    ]

    render(
      <HeroAttentionCarousel
        queue={queue}
        slidePropsForItem={(item, index) =>
          baseSlideProps(item, index, {
            queueLength: 2,
            calendarItem: item.game.id.startsWith("FEED-drive-a") ? itemA : itemB,
            blockSupportingContext: {
              siblingLines: [
                item.game.id.startsWith("FEED-drive-a")
                  ? `Also tonight · Practice B · ${new Date(clockIso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}`
                  : `Also tonight · Practice A · ${new Date(itemA.startsAt).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}`,
              ],
              mutedLines: [],
              mutedHeading: null,
            },
          })
        }
      />,
    )

    const shells = screen.getAllByTestId("hero-attention-slide-shell")
    expect(shells).toHaveLength(2)
    expect(screen.getAllByTestId("hero-attention-dot")).toHaveLength(2)

    for (const shell of shells) {
      const slide = within(shell).getByTestId("hero-attention-slide")
      expect(within(slide).getByTestId("hero-attention-block-sibling")).toBeInTheDocument()
      // One primary decision surface (DriverPicker) — not a second CTA for the
      // sibling block member on this slide.
      expect(within(slide).getAllByTestId("hero-attention-slide-title")).toHaveLength(1)
      expect(within(slide).getByTestId("driver-picker")).toBeInTheDocument()
      expect(within(slide).getAllByTestId("driver-picker")).toHaveLength(1)
      expect(within(slide).queryByRole("button", { name: /^Accept$/i })).not.toBeInTheDocument()
    }
  })

  it("shows Mark {firstName} as not going under gap Assign chrome and writes NO", async () => {
    const user = userEvent.setup()
    const onSetRsvp = vi.fn()

    render(
      <HeroAttentionCarousel
        queue={[ownRideQueue[0]!]}
        slidePropsForItem={(item, index) =>
          baseSlideProps(item, index, { queueLength: 1, onSetRsvp })
        }
      />,
    )

    const slide = screen.getByTestId("hero-attention-slide")
    expect(within(slide).getByTestId("driver-picker")).toBeInTheDocument()
    const notGoing = within(slide).getByRole("button", { name: "Mark Declan as not going" })
    expect(notGoing).toHaveAttribute("data-testid", "driver-picker-not-going-k1")
    expect(notGoing).toHaveStyle({ color: "var(--fc-hero-on-secondary)" })
    await user.click(notGoing)
    expect(onSetRsvp).toHaveBeenCalledWith("k1", "NO")
  })

  it("shows Mark {firstName} as not going under Confirm / Decline and writes NO", async () => {
    const user = userEvent.setup()
    const onSetRsvp = vi.fn()
    const pendingItem = calendarItem({
      uncoveredKidIds: [],
      coverages: [
        {
          id: "cov1",
          coveringAdultId: "a1",
          coveringAdultDisplayName: "Alex",
          assignedByAdultId: "a2",
          kidIds: ["k1"],
          status: "PENDING",
          leaveFromPlaceId: null,
          leaveFromPlaceName: null,
          leaveFromAddress: null,
          leaveByAt: null,
          leaveByStatus: "PENDING",
          leaveByReason: null,
        },
      ],
    })

    render(
      <HeroAttentionCarousel
        queue={[ownRideQueue[0]!]}
        slidePropsForItem={(item, index) =>
          baseSlideProps(item, index, {
            queueLength: 1,
            calendarItem: pendingItem,
            onConfirmCoverage: vi.fn(),
            onDeclineCoverage: vi.fn(),
            onSetRsvp,
          })
        }
      />,
    )

    const slide = screen.getByTestId("hero-attention-slide")
    expect(within(slide).getByTestId("hero-attention-confirm-coverage")).toBeInTheDocument()
    expect(within(slide).queryByTestId("driver-picker")).not.toBeInTheDocument()
    await user.click(within(slide).getByRole("button", { name: "Mark Declan as not going" }))
    expect(onSetRsvp).toHaveBeenCalledWith("k1", "NO")
  })

  it("shows one all-kids not-going link on multi-kid gap and Confirm simple views", async () => {
    const user = userEvent.setup()
    const onSetNotGoing = vi.fn()
    const onSetRsvp = vi.fn()
    const twinCircle: FamilyCircle = {
      ...circle,
      kids: [
        { id: "k1", displayName: "Graham" },
        { id: "k2", displayName: "Luke" },
      ],
    }
    const twinItem = calendarItem({
      kidIds: ["k1", "k2"],
      uncoveredKidIds: ["k1", "k2"],
      rsvps: [
        { kidId: "k1", status: "YES" },
        { kidId: "k2", status: "YES" },
      ],
    })
    const twinConfirmItem = calendarItem({
      kidIds: ["k1", "k2"],
      uncoveredKidIds: [],
      rsvps: [
        { kidId: "k1", status: "YES" },
        { kidId: "k2", status: "YES" },
      ],
      coverages: [
        {
          id: "cov-twins",
          coveringAdultId: "a1",
          coveringAdultDisplayName: "Alex",
          assignedByAdultId: "a2",
          kidIds: ["k1", "k2"],
          status: "PENDING",
          leaveFromPlaceId: null,
          leaveFromPlaceName: null,
          leaveFromAddress: null,
          leaveByAt: null,
          leaveByStatus: "PENDING",
          leaveByReason: null,
        },
      ],
    })

    const { rerender } = render(
      <HeroAttentionCarousel
        queue={[ownRideQueue[0]!]}
        slidePropsForItem={(item, index) =>
          baseSlideProps(item, index, {
            queueLength: 1,
            circle: twinCircle,
            calendarItem: twinItem,
            onSaveKidPlans: vi.fn(),
            onSetNotGoing,
            onSetRsvp,
          })
        }
      />,
    )

    let slide = screen.getByTestId("hero-attention-slide")
    const picker = within(slide).getByTestId("driver-picker")
    expect(picker).toHaveAttribute("data-mode", "simple")
    expect(
      within(slide).queryByRole("button", { name: "Mark Graham as not going" }),
    ).not.toBeInTheDocument()
    expect(
      within(slide).queryByRole("button", { name: "Mark Luke as not going" }),
    ).not.toBeInTheDocument()
    await user.click(
      within(picker).getByRole("button", { name: "Mark Graham and Luke as not going" }),
    )
    expect(onSetNotGoing).toHaveBeenCalledWith(["k1", "k2"])

    onSetNotGoing.mockClear()
    await user.click(within(picker).getByTestId("driver-picker-different-plans-kid"))
    expect(within(slide).getByTestId("driver-picker")).toHaveAttribute("data-mode", "kid-split")
    expect(
      within(slide).queryByRole("button", { name: "Mark Graham and Luke as not going" }),
    ).not.toBeInTheDocument()
    await user.click(within(slide).getByRole("button", { name: "Mark Graham as not going" }))
    expect(onSetRsvp).toHaveBeenCalledWith("k1", "NO")
    await user.click(within(slide).getByRole("button", { name: "Mark Luke as not going" }))
    expect(onSetRsvp).toHaveBeenCalledWith("k2", "NO")

    onSetNotGoing.mockClear()
    onSetRsvp.mockClear()
    rerender(
      <HeroAttentionCarousel
        queue={[ownRideQueue[0]!]}
        slidePropsForItem={(item, index) =>
          baseSlideProps(item, index, {
            queueLength: 1,
            circle: twinCircle,
            calendarItem: twinConfirmItem,
            onConfirmCoverage: vi.fn(),
            onDeclineCoverage: vi.fn(),
            onSetNotGoing,
            onSetRsvp,
          })
        }
      />,
    )

    slide = screen.getByTestId("hero-attention-slide")
    expect(within(slide).getByTestId("hero-attention-confirm-coverage")).toBeInTheDocument()
    expect(within(slide).getByTestId("hero-attention-decline-coverage")).toBeInTheDocument()
    expect(within(slide).queryByTestId("driver-picker")).not.toBeInTheDocument()
    await user.click(
      within(slide).getByRole("button", { name: "Mark Graham and Luke as not going" }),
    )
    expect(onSetNotGoing).toHaveBeenCalledWith(["k1", "k2"])

    onSetRsvp.mockClear()
    await user.click(
      within(slide).getByTestId("hero-attention-confirm-different-plans-kid"),
    )
    expect(
      within(slide).getByTestId("hero-attention-confirm-per-kid-not-going"),
    ).toBeInTheDocument()
    expect(
      within(slide).queryByRole("button", { name: "Mark Graham and Luke as not going" }),
    ).not.toBeInTheDocument()
    // Confirm / Decline stay; no ride-plan chrome.
    expect(within(slide).getByTestId("hero-attention-confirm-coverage")).toBeInTheDocument()
    expect(within(slide).getByTestId("hero-attention-decline-coverage")).toBeInTheDocument()
    expect(within(slide).queryByTestId("driver-picker")).not.toBeInTheDocument()
    expect(within(slide).queryByRole("button", { name: /Save ride plan/i })).not.toBeInTheDocument()
    expect(within(slide).queryByRole("button", { name: /Ask the team/i })).not.toBeInTheDocument()
    await user.click(within(slide).getByRole("button", { name: "Mark Luke as not going" }))
    expect(onSetRsvp).toHaveBeenCalledWith("k2", "NO")

    await user.click(within(slide).getByTestId("hero-attention-confirm-back-to-simple"))
    expect(
      within(slide).queryByTestId("hero-attention-confirm-per-kid-not-going"),
    ).not.toBeInTheDocument()
    expect(
      within(slide).getByRole("button", { name: "Mark Graham and Luke as not going" }),
    ).toBeInTheDocument()
  })

  it("omits not-going control on inbound ask slides", () => {
    render(
      <HeroAttentionCarousel
        queue={[ownRideQueue[1]!]}
        slidePropsForItem={(item, index) =>
          baseSlideProps(item, index, {
            queueLength: 1,
            onSetRsvp: vi.fn(),
            onSetNotGoing: vi.fn(),
          })
        }
      />,
    )

    const slide = screen.getByTestId("hero-attention-slide")
    expect(slide).toHaveAttribute("data-slide-kind", "request")
    expect(
      within(slide).queryByRole("button", { name: /not going/i }),
    ).not.toBeInTheDocument()
  })

  it("shows both peer labels and keep A / keep B / neither for a single-kid conflict", async () => {
    const user = userEvent.setup()
    const onResolvePlayerConflict = vi.fn()
    const peerItem = calendarItem({
      id: "e2",
      title: "Other game",
      feedName: "Admirals",
      startsAt: "2030-08-29T22:00:00.000Z",
      endsAt: "2030-08-29T23:00:00.000Z",
    })
    const conflictQueue: QueueItem[] = [
      {
        kind: "playerConflict",
        game: game({
          id: "FEED-e1:k1",
          title: "Mass Admirals",
          kidTimeOverlapPeerKeys: ["FEED-e2"],
        }),
        peerGame: game({
          id: "FEED-e2:k1",
          title: "Other game",
          startsAt: "2030-08-29T22:00:00.000Z",
          order: Date.parse("2030-08-29T22:00:00.000Z"),
          kidTimeOverlapPeerKeys: ["FEED-e1"],
        }),
        kidIds: ["k1"],
      },
    ]

    render(
      <HeroAttentionCarousel
        queue={conflictQueue}
        slidePropsForItem={(item, index) =>
          baseSlideProps(item, index, {
            queueLength: 1,
            peerCalendarItem: peerItem,
            onResolvePlayerConflict,
          })
        }
      />,
    )

    const slide = screen.getByTestId("hero-attention-slide")
    expect(slide).toHaveAttribute("data-slide-kind", "playerConflict")
    expect(within(slide).getByTestId("hero-attention-slide-title")).toHaveTextContent(
      "Declan is on two overlapping events",
    )
    expect(within(slide).getByTestId("hero-attention-conflict-peer-a")).toHaveTextContent(
      "Sharks · 2016/2017 (BILL) · Mass Admirals",
    )
    expect(within(slide).getByTestId("hero-attention-conflict-peer-b")).toHaveTextContent(
      "Admirals · Other game",
    )
    await user.click(
      within(slide).getByRole("button", {
        name: "Keep Sharks · 2016/2017 (BILL) · Mass Admirals",
      }),
    )
    expect(onResolvePlayerConflict).toHaveBeenCalledWith("keepA", ["k1"])

    onResolvePlayerConflict.mockClear()
    await user.click(
      within(slide).getByRole("button", { name: "Keep Admirals · Other game" }),
    )
    expect(onResolvePlayerConflict).toHaveBeenCalledWith("keepB", ["k1"])

    onResolvePlayerConflict.mockClear()
    const neither = within(slide).getByRole("button", { name: "Mark Declan as not going" })
    expect(neither).toHaveStyle({ color: "var(--fc-hero-on-secondary)" })
    await user.click(neither)
    expect(onResolvePlayerConflict).toHaveBeenCalledWith("neither", ["k1"])
    expect(within(slide).queryByRole("button", { name: /undo/i })).not.toBeInTheDocument()
  })

  it("applies one keep choice to all kids by default and allows per-kid split including neither", async () => {
    const user = userEvent.setup()
    const onResolvePlayerConflict = vi.fn()
    const twinsCircle: FamilyCircle = {
      ...circle,
      kids: [
        { id: "k1", displayName: "Graham" },
        { id: "k2", displayName: "Luke" },
      ],
    }
    const peerItem = calendarItem({
      id: "e2",
      title: "Game B",
      feedName: null,
      source: "MANUAL",
      kidIds: ["k1", "k2"],
    })
    const conflictQueue: QueueItem[] = [
      {
        kind: "playerConflict",
        game: game({ id: "MANUAL-e1:k1", kidId: "k1" }),
        peerGame: game({ id: "MANUAL-e2:k1", kidId: "k1", title: "Game B" }),
        kidIds: ["k1", "k2"],
      },
    ]

    render(
      <HeroAttentionCarousel
        queue={conflictQueue}
        slidePropsForItem={(item, index) =>
          baseSlideProps(item, index, {
            queueLength: 1,
            circle: twinsCircle,
            calendarItem: calendarItem({
              source: "MANUAL",
              feedName: null,
              title: "Game A",
              kidIds: ["k1", "k2"],
            }),
            peerCalendarItem: peerItem,
            onResolvePlayerConflict,
          })
        }
      />,
    )

    const slide = screen.getByTestId("hero-attention-slide")
    expect(within(slide).getByTestId("hero-attention-slide-title")).toHaveTextContent(
      "Graham and Luke are on two overlapping events",
    )
    expect(within(slide).getByTestId("hero-attention-conflict-peer-a")).toHaveTextContent(
      "Game A",
    )
    expect(within(slide).getByTestId("hero-attention-conflict-peer-b")).toHaveTextContent(
      "Game B",
    )

    await user.click(within(slide).getByRole("button", { name: "Keep Game A" }))
    expect(onResolvePlayerConflict).toHaveBeenCalledWith("keepA", ["k1", "k2"])

    onResolvePlayerConflict.mockClear()
    await user.click(
      within(slide).getByRole("button", { name: "Mark Graham and Luke as not going" }),
    )
    expect(onResolvePlayerConflict).toHaveBeenCalledWith("neither", ["k1", "k2"])

    await user.click(
      within(slide).getByRole("button", { name: "Different plans for each kid." }),
    )
    expect(within(slide).getByTestId("hero-attention-conflict-per-kid")).toBeInTheDocument()
    await user.click(within(slide).getByTestId("hero-attention-conflict-keep-a-k1"))
    expect(onResolvePlayerConflict).toHaveBeenCalledWith("keepA", ["k1"])
    onResolvePlayerConflict.mockClear()
    await user.click(within(slide).getByTestId("hero-attention-conflict-keep-b-k2"))
    expect(onResolvePlayerConflict).toHaveBeenCalledWith("keepB", ["k2"])
    onResolvePlayerConflict.mockClear()
    await user.click(within(slide).getByTestId("hero-attention-conflict-neither-k2"))
    expect(onResolvePlayerConflict).toHaveBeenCalledWith("neither", ["k2"])
    expect(within(slide).queryByRole("button", { name: /undo/i })).not.toBeInTheDocument()
  })
})
