import { act, fireEvent, render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import {
  GAME_CARPOOL_ROUTE_FIXTURE,
  PRACTICE_CARPOOL_ROUTE_FIXTURE,
} from "@/components/rideDetailFixtures"
import {
  RideRouteLegTabs,
  RideRouteTab,
  eventStartClockFromIso,
  reorderMiddleStopsByAddress,
  reorderPickupStopsByAddress,
} from "@/components/RideRouteTab"
import { computeSchedule, navigationUrl, toTime } from "@/components/rideScheduleUtils"

const TWO_PICKUP_ROUTE = {
  bufferMinutes: 20,
  stops: [
    { name: "Home", address: "1 Main", kind: "home" as const },
    { name: "Near kid", address: "Near St", kind: "pickup" as const },
    { name: "Far kid", address: "Far St", kind: "pickup" as const },
    { name: "Rink", address: "65 Elm", kind: "destination" as const },
  ],
  legMinutes: [2, 25, 5],
}

describe("eventStartClockFromIso", () => {
  it("formats local wall clock for schedule helpers", () => {
    const iso = "2030-08-15T17:00:00.000"
    const date = new Date(iso)
    const expected = toTime(date.getHours() * 60 + date.getMinutes())
    expect(eventStartClockFromIso(iso)).toBe(expected)
  })
})

describe("RideRouteTab", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("renders leave-by hero, navigation link, map placeholder, and stops from fixtures", () => {
    const startsAt = "2030-08-15T16:40:00.000"
    const eventStart = eventStartClockFromIso(startsAt)
    const { arriveBy, stopTimes } = computeSchedule(GAME_CARPOOL_ROUTE_FIXTURE, eventStart)

    render(
      <RideRouteTab
        carpoolRoute={GAME_CARPOOL_ROUTE_FIXTURE}
        startsAt={startsAt}
        location="Allied Veterans Rink, Everett"
        mapsEmbedApiKey={null}
      />,
    )

    expect(screen.getByTestId("ride-route-tab")).toBeInTheDocument()
    expect(screen.getByTestId("ride-route-leave-by")).toHaveTextContent(
      toTime(stopTimes[0]!),
    )
    expect(screen.getByTestId("ride-route-hero-copy")).toHaveTextContent(
      `arrive at Allied Veterans Rink, Everett by ${toTime(arriveBy)}`,
    )
    expect(screen.getByTestId("ride-route-hero-copy")).toHaveTextContent("puck drop")
    expect(screen.getByText("45 min early for games")).toBeInTheDocument()

    const nav = screen.getByTestId("ride-route-start-nav")
    expect(nav).toHaveAttribute(
      "href",
      navigationUrl(GAME_CARPOOL_ROUTE_FIXTURE.stops),
    )

    expect(screen.getByTestId("ride-route-map-placeholder")).toBeInTheDocument()
    expect(screen.queryByTestId("ride-route-map-embed")).not.toBeInTheDocument()

    const stops = screen.getByTestId("ride-route-stops")
    expect(within(stops).getByTestId("ride-route-stop-Home")).toBeInTheDocument()
    expect(
      within(stops).getByTestId("ride-route-stop-Kwame (the Oseis)"),
    ).toBeInTheDocument()
    expect(
      within(stops).getByTestId("ride-route-stop-Allied Veterans Rink"),
    ).toBeInTheDocument()
  })

  it("embeds the map when an API key is configured", () => {
    render(
      <RideRouteTab
        carpoolRoute={PRACTICE_CARPOOL_ROUTE_FIXTURE}
        startsAt="2030-08-15T18:00:00.000"
        mapsEmbedApiKey="test-embed-key"
      />,
    )
    expect(screen.getByTestId("ride-route-map-embed")).toBeInTheDocument()
    expect(screen.queryByTestId("ride-route-map-placeholder")).not.toBeInTheDocument()
    expect(screen.getByTitle("Carpool route").getAttribute("src")).toContain(
      "key=test-embed-key",
    )
    expect(screen.getByText("20 min early for practices")).toBeInTheDocument()
  })

  it("renders live schedule props without fixture kind", () => {
    render(
      <RideRouteTab
        carpoolRoute={{
          bufferMinutes: 0,
          stops: [
            { name: "Home", address: "1 Main", kind: "home" },
            { name: "Clinic", address: "2 Oak", kind: "destination" },
          ],
          legMinutes: [10],
        }}
        startsAt="2030-08-15T16:40:00.000"
        mapsEmbedApiKey={null}
      />,
    )
    expect(screen.getByText("Arrive on time")).toBeInTheDocument()
    expect(screen.getByTestId("ride-route-hero-copy")).toHaveTextContent("the event starts")
  })

  it("updates notify UI locally without network calls", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    const fetchMock = vi.fn()
    vi.stubGlobal("fetch", fetchMock)
    const deliverNotify = vi.fn().mockResolvedValue({ ok: true })

    render(
      <RideRouteTab
        carpoolRoute={GAME_CARPOOL_ROUTE_FIXTURE}
        startsAt="2030-08-15T16:40:00.000"
        mapsEmbedApiKey={null}
        notifyDelayMs={700}
        deliverNotify={deliverNotify}
      />,
    )

    const notify = screen.getByTestId("ride-route-notify-Kwame (the Oseis)")
    expect(notify).toHaveAttribute("data-notify-status", "idle")
    await user.click(within(notify).getByRole("button", { name: /Notify/i }))

    expect(
      screen.getByTestId("ride-route-notify-Kwame (the Oseis)"),
    ).toHaveAttribute("data-notify-status", "sending")
    expect(deliverNotify).toHaveBeenCalledWith(
      expect.objectContaining({
        channel: "push",
        to: "the Oseis",
        stopName: "Kwame (the Oseis)",
      }),
    )
    expect(fetchMock).not.toHaveBeenCalled()

    await act(async () => {
      vi.advanceTimersByTime(700)
    })

    const sent = screen.getByTestId("ride-route-notify-Kwame (the Oseis)")
    expect(sent).toHaveAttribute("data-notify-status", "sent")
    expect(sent).toHaveTextContent(/Sent via push notification/)
    expect(fetchMock).not.toHaveBeenCalled()
    vi.unstubAllGlobals()
  })

  it("soft-fails notify by returning to idle without failure chrome", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    const deliverNotify = vi
      .fn()
      .mockResolvedValue({ ok: false, reason: "CHANNEL_UNAVAILABLE" })

    render(
      <RideRouteTab
        carpoolRoute={GAME_CARPOOL_ROUTE_FIXTURE}
        startsAt="2030-08-15T16:40:00.000"
        mapsEmbedApiKey={null}
        notifyDelayMs={700}
        deliverNotify={deliverNotify}
      />,
    )

    await user.click(
      within(screen.getByTestId("ride-route-notify-Kwame (the Oseis)")).getByRole(
        "button",
        { name: /Notify/i },
      ),
    )
    expect(
      screen.getByTestId("ride-route-notify-Kwame (the Oseis)"),
    ).toHaveAttribute("data-notify-status", "sending")

    await act(async () => {
      vi.advanceTimersByTime(700)
    })

    expect(
      screen.getByTestId("ride-route-notify-Kwame (the Oseis)"),
    ).toHaveAttribute("data-notify-status", "idle")
  })

  it("exposes drag handles for drivers with two+ pickups and saves on drop", async () => {
    const onReorderMiddles = vi.fn().mockResolvedValue(undefined)
    render(
      <RideRouteTab
        carpoolRoute={TWO_PICKUP_ROUTE}
        startsAt="2030-08-15T18:00:00.000"
        mapsEmbedApiKey={null}
        canReorderMiddles
        onReorderMiddles={onReorderMiddles}
      />,
    )

    expect(screen.getByTestId("ride-route-drag-handle-Near St")).toBeInTheDocument()
    expect(screen.getByTestId("ride-route-drag-handle-Far St")).toBeInTheDocument()
    expect(screen.getByTestId("ride-route-stop-Near kid")).toHaveAttribute(
      "data-reorderable",
      "true",
    )
    expect(screen.getByTestId("ride-route-stop-Home")).not.toHaveAttribute(
      "data-reorderable",
    )

    const from = screen.getByTestId("ride-route-stop-Near kid")
    const to = screen.getByTestId("ride-route-stop-Far kid")
    const dataTransfer = {
      effectAllowed: "none",
      dropEffect: "none",
      setData: vi.fn(),
      getData: vi.fn().mockReturnValue("Near St"),
    }
    fireEvent.dragStart(from, { dataTransfer })
    fireEvent.dragOver(to, { dataTransfer })
    await act(async () => {
      fireEvent.drop(to, { dataTransfer })
    })

    expect(onReorderMiddles).toHaveBeenCalledWith(["Far St", "Near St"])
  })

  it("keeps pickup drag inert for non-drivers and single-middle routes", () => {
    const onReorderMiddles = vi.fn()
    const { rerender } = render(
      <RideRouteTab
        carpoolRoute={TWO_PICKUP_ROUTE}
        startsAt="2030-08-15T18:00:00.000"
        mapsEmbedApiKey={null}
        canReorderMiddles={false}
        onReorderMiddles={onReorderMiddles}
      />,
    )
    expect(screen.queryByTestId("ride-route-drag-handle-Near St")).not.toBeInTheDocument()
    expect(screen.getByTestId("ride-route-stop-Near kid")).not.toHaveAttribute(
      "data-reorderable",
    )

    rerender(
      <RideRouteTab
        carpoolRoute={GAME_CARPOOL_ROUTE_FIXTURE}
        startsAt="2030-08-15T16:40:00.000"
        mapsEmbedApiKey={null}
        canReorderMiddles
        onReorderMiddles={onReorderMiddles}
      />,
    )
    expect(
      screen.queryByTestId("ride-route-drag-handle-Somerville, MA"),
    ).not.toBeInTheDocument()
  })
})

describe("reorderPickupStopsByAddress", () => {
  it("swaps pickup order and keeps home/destination fixed", () => {
    const next = reorderPickupStopsByAddress(
      TWO_PICKUP_ROUTE.stops,
      "Near St",
      "Far St",
    )
    expect(next?.map((stop) => stop.address)).toEqual([
      "1 Main",
      "Far St",
      "Near St",
      "65 Elm",
    ])
  })
})

describe("reorderMiddleStopsByAddress", () => {
  it("reorders FROM dropoffs with venue start and home end", () => {
    const fromRoute = [
      { name: "Rink", address: "65 Elm", kind: "destination" as const },
      { name: "Near", address: "Near St", kind: "dropoff" as const },
      { name: "Far", address: "Far St", kind: "dropoff" as const },
      { name: "Home", address: "1 Main", kind: "home" as const },
    ]
    const next = reorderMiddleStopsByAddress(fromRoute, "Near St", "Far St")
    expect(next?.map((stop) => stop.address)).toEqual([
      "65 Elm",
      "Far St",
      "Near St",
      "1 Main",
    ])
  })
})

describe("RideRouteLegTabs", () => {
  it("renders There/Back and switches leg", async () => {
    const user = userEvent.setup()
    const onLegChange = vi.fn()
    render(
      <RideRouteLegTabs
        leg="TO"
        availableLegs={["TO", "FROM"]}
        onLegChange={onLegChange}
      />,
    )
    expect(screen.getByTestId("ride-route-leg-tabs")).toBeInTheDocument()
    expect(screen.getByTestId("ride-route-leg-there")).toHaveAttribute(
      "aria-selected",
      "true",
    )
    await user.click(screen.getByTestId("ride-route-leg-back"))
    expect(onLegChange).toHaveBeenCalledWith("FROM")
  })

  it("hides when only one leg is available", () => {
    render(
      <RideRouteLegTabs leg="TO" availableLegs={["TO"]} onLegChange={vi.fn()} />,
    )
    expect(screen.queryByTestId("ride-route-leg-tabs")).not.toBeInTheDocument()
  })
})

describe("RideRouteTab FROM leg", () => {
  it("exposes drag handles for dropoff middles on Back", async () => {
    const fromRoute = {
      bufferMinutes: 0,
      stops: [
        { name: "Rink", address: "65 Elm", kind: "destination" as const },
        { name: "Near", address: "Near St", kind: "dropoff" as const },
        { name: "Far", address: "Far St", kind: "dropoff" as const },
        { name: "Home", address: "1 Main", kind: "home" as const },
      ],
      legMinutes: [10, 12, 8],
    }
    const onReorderMiddles = vi.fn().mockResolvedValue(undefined)
    render(
      <RideRouteTab
        carpoolRoute={fromRoute}
        startsAt="2030-08-15T18:00:00.000"
        mapsEmbedApiKey={null}
        leg="FROM"
        canReorderMiddles
        onReorderMiddles={onReorderMiddles}
      />,
    )
    expect(screen.getByTestId("ride-route-tab")).toHaveAttribute(
      "data-route-leg",
      "FROM",
    )
    expect(screen.getByTestId("ride-route-drag-handle-Near St")).toBeInTheDocument()
    const from = screen.getByTestId("ride-route-stop-Near")
    const to = screen.getByTestId("ride-route-stop-Far")
    const dataTransfer = {
      effectAllowed: "none",
      dropEffect: "none",
      setData: vi.fn(),
      getData: vi.fn().mockReturnValue("Near St"),
    }
    fireEvent.dragStart(from, { dataTransfer })
    fireEvent.dragOver(to, { dataTransfer })
    await act(async () => {
      fireEvent.drop(to, { dataTransfer })
    })
    expect(onReorderMiddles).toHaveBeenCalledWith(["Far St", "Near St"])
  })
})
