import { act, render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import {
  GAME_CARPOOL_ROUTE_FIXTURE,
  PRACTICE_CARPOOL_ROUTE_FIXTURE,
} from "@/components/rideDetailFixtures"
import {
  RideRouteTab,
  eventStartClockFromIso,
} from "@/components/RideRouteTab"
import { computeSchedule, navigationUrl, toTime } from "@/components/rideScheduleUtils"

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
    render(
      <RideRouteTab
        carpoolRoute={GAME_CARPOOL_ROUTE_FIXTURE}
        startsAt="2030-08-15T16:40:00.000"
        mapsEmbedApiKey={null}
        notifyDelayMs={700}
      />,
    )

    const notify = screen.getByTestId("ride-route-notify-Kwame (the Oseis)")
    expect(notify).toHaveAttribute("data-notify-status", "idle")
    await user.click(within(notify).getByRole("button", { name: /Notify/i }))

    expect(
      screen.getByTestId("ride-route-notify-Kwame (the Oseis)"),
    ).toHaveAttribute("data-notify-status", "sending")

    await act(async () => {
      vi.advanceTimersByTime(700)
    })

    const sent = screen.getByTestId("ride-route-notify-Kwame (the Oseis)")
    expect(sent).toHaveAttribute("data-notify-status", "sent")
    expect(sent).toHaveTextContent(/Sent via push notification/)
  })
})
