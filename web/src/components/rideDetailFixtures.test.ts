import { describe, expect, it } from "vitest"

import {
  GAME_CARPOOL_ROUTE_FIXTURE,
  PRACTICE_CARPOOL_ROUTE_FIXTURE,
  carpoolRouteFixtureForCalendarItem,
  isPracticeEventTitle,
} from "@/components/rideDetailFixtures"
import { computeSchedule, mergeTracks } from "@/components/rideScheduleUtils"

describe("isPracticeEventTitle", () => {
  it("matches practice as a whole word, case-insensitive", () => {
    expect(isPracticeEventTitle("Practice")).toBe(true)
    expect(isPracticeEventTitle("Sharks Practice")).toBe(true)
    expect(isPracticeEventTitle("  morning PRACTICE skate ")).toBe(true)
    expect(isPracticeEventTitle("vs Belmont")).toBe(false)
    expect(isPracticeEventTitle("Practicing hard")).toBe(false)
  })
})

describe("carpoolRouteFixtureForCalendarItem", () => {
  it("returns the three-stop game fixture by default", () => {
    const route = carpoolRouteFixtureForCalendarItem({ title: "vs East Coast Thunder" })
    expect(route.kind).toBe("game")
    expect(route).toBe(GAME_CARPOOL_ROUTE_FIXTURE)
    expect(route.bufferMinutes).toBe(45)
    expect(route.stops).toHaveLength(3)
    expect(route.legMinutes).toEqual([12, 18])
    expect(route.playlistRiders).toHaveLength(2)
    expect(route.stops[1]?.contact).toEqual({ channel: "push", to: "the Oseis" })
  })

  it("returns the two-stop practice fixture when title looks like practice", () => {
    const route = carpoolRouteFixtureForCalendarItem({ title: "Tuesday Practice" })
    expect(route.kind).toBe("practice")
    expect(route).toBe(PRACTICE_CARPOOL_ROUTE_FIXTURE)
    expect(route.bufferMinutes).toBe(15)
    expect(route.stops).toHaveLength(2)
    expect(route.legMinutes).toEqual([14])
    expect(route.playlistRiders).toHaveLength(1)
  })

  it("is usable by schedule and merge helpers", () => {
    const game = GAME_CARPOOL_ROUTE_FIXTURE
    const schedule = computeSchedule(game, "12:40 PM")
    expect(schedule.stopTimes).toHaveLength(3)
    expect(mergeTracks(game.playlistRiders).length).toBeGreaterThan(0)

    const practice = PRACTICE_CARPOOL_ROUTE_FIXTURE
    expect(computeSchedule(practice, "6:00 PM").stopTimes).toHaveLength(2)
    expect(mergeTracks(practice.playlistRiders)).toHaveLength(3)
  })
})
