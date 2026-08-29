import { fireEvent, render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import type { CalendarItem, CarpoolRideEvent, FamilyCircle, Garage } from "@/api/types"
import { HeroAttentionCarousel } from "@/components/HeroAttentionCarousel"
import type { HeroAttentionSlideProps } from "@/components/HeroAttentionSlide"
import type { CoverageGameEvent, QueueItem } from "@/components/coverageQueue"

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
    leaveByAt: null,
    leaveByStatus: "PENDING",
    leaveByReason: null,
    coverages: [],
    uncoveredKidIds: ["k1"],
    conflicts: [],
    rsvps: kidIds.map((kidId) => ({ kidId, status: "YES" as const })),
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

const garage: Garage = {
  members: [{ adultId: "a1", displayName: "Alex", drives: true }],
  vehicles: [
    {
      id: "v1",
      ownerAdultId: "a1",
      driverAdultIds: ["a1"],
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

const rideEvent: CarpoolRideEvent = {
  eventKey: "UID:game1",
  title: "Mass Admirals",
  startsAt: "2030-08-29T21:20:00.000Z",
  endsAt: "2030-08-29T22:20:00.000Z",
  defaultKidIds: ["k1"],
  ownRequest: null,
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
      status: "PENDING",
      passedByMe: false,
      passedByAdultNames: [],
      acceptedByAdultId: null,
      acceptingCircleId: null,
      acceptingCircleName: null,
      vehicleId: null,
      vehicleLabel: null,
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
    garage,
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
    const scrollIntoView = vi.fn()
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
      configurable: true,
      value: scrollIntoView,
    })

    render(
      <HeroAttentionCarousel
        queue={ownRideQueue}
        slidePropsForItem={(item, index) => baseSlideProps(item, index)}
      />,
    )

    const dots = screen.getAllByTestId("hero-attention-dot")
    expect(dots[0]).toHaveAttribute("data-active", "true")
    expect(dots[1]).toHaveAttribute("data-active", "false")

    await user.click(screen.getByRole("button", { name: "Next item" }))
    expect(scrollIntoView).toHaveBeenCalled()
    expect(dots[1]).toHaveAttribute("data-active", "true")
  })

  it("scrolls to a slide when a dot is clicked", async () => {
    const user = userEvent.setup()
    const scrollIntoView = vi.fn()
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
      configurable: true,
      value: scrollIntoView,
    })

    render(
      <HeroAttentionCarousel
        queue={ownRideQueue}
        slidePropsForItem={(item, index) => baseSlideProps(item, index)}
      />,
    )

    const dots = screen.getAllByTestId("hero-attention-dot")
    await user.click(dots[1]!)
    expect(scrollIntoView).toHaveBeenCalled()
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
    const track = scroller.firstElementChild as HTMLElement
    const shells = Array.from(track.children) as HTMLElement[]

    Object.defineProperty(scroller, "scrollLeft", { configurable: true, value: 0 })
    Object.defineProperty(shells[0]!, "offsetLeft", { configurable: true, value: 0 })
    Object.defineProperty(shells[1]!, "offsetLeft", { configurable: true, value: 420 })

    fireEvent.scroll(scroller)
    expect(screen.getAllByTestId("hero-attention-dot")[0]).toHaveAttribute("data-active", "true")

    Object.defineProperty(scroller, "scrollLeft", { configurable: true, value: 420 })
    fireEvent.scroll(scroller)
    expect(screen.getAllByTestId("hero-attention-dot")[1]).toHaveAttribute("data-active", "true")
  })

  it("advances active slide with keyboard arrows when focused", async () => {
    const user = userEvent.setup()
    const scrollIntoView = vi.fn()
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
      configurable: true,
      value: scrollIntoView,
    })

    render(
      <HeroAttentionCarousel
        queue={ownRideQueue}
        slidePropsForItem={(item, index) => baseSlideProps(item, index)}
      />,
    )

    const scroller = screen.getByTestId("hero-attention-scroller")
    scroller.focus()
    await user.keyboard("{ArrowRight}")

    const dots = screen.getAllByTestId("hero-attention-dot")
    expect(dots[1]).toHaveAttribute("data-active", "true")
    expect(scrollIntoView).toHaveBeenCalled()
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
    expect(within(slide).getByText(/Sharks · 2016\/2017 \(BILL\) vs Mass Admirals ·/)).toBeInTheDocument()
    expect(within(slide).getByText("Allied Veterans Rink, Everett")).toBeInTheDocument()
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
      "Nguyen home, Cambridge, MA",
    )

    await user.click(within(slide).getByRole("button", { name: "Accept" }))
    expect(onAcceptRide).toHaveBeenCalledWith("ride-1", "v1")
    await user.click(within(slide).getByRole("button", { name: "Decline" }))
    expect(onPassRide).toHaveBeenCalledWith("ride-1")
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
})
