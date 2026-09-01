import { describe, expect, it } from "vitest"

import type { CalendarItem } from "@/api/types"
import {
  heroAttentionSlideAriaLabel,
  heroEventContextLine,
  heroKidFirstName,
  heroPickupSummary,
  heroRequestTitle,
} from "@/components/heroAttentionCopy"
import { CONFIRM_COVERAGE } from "@/components/coverageCopy"
import type { CarpoolRequest } from "@/components/coverageQueue"

function calendarItem(partial: Partial<CalendarItem> = {}): CalendarItem {
  const kidIds = partial.kidIds ?? ["k1"]
  return {
    source: "MANUAL",
    id: "e1",
    title: "Rhode Island Junior Blues",
    startsAt: "2030-08-15T17:00:00.000Z",
    endsAt: "2030-08-15T18:00:00.000Z",
    location: "Allied Veterans Rink, Everett",
    kidIds,
    feedId: null,
    feedName: "Sharks · 2016/2017 (BILL)",
    eventKey: "UID:game",
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

describe("heroAttentionCopy", () => {
  it("uses kid first name only", () => {
    expect(heroKidFirstName("k1", [{ id: "k1", displayName: "Declan McCarthy" }])).toBe(
      "Declan",
    )
  })

  it("builds feed vs title context line with formatted when", () => {
    const item = calendarItem({ source: "FEED", feedName: "Sharks · 2016/2017 (BILL)" })
    const line = heroEventContextLine(item, new Date("2030-08-15T12:00:00.000Z"))
    expect(line).toContain("Sharks · 2016/2017 (BILL) vs Rhode Island Junior Blues ·")
    expect(line).toMatch(/\d{1,2}:\d{2} [AP]M – \d{1,2}:\d{2} [AP]M/)
  })

  it("builds request title with circle and kid names", () => {
    const request: CarpoolRequest = {
      id: "r1",
      requestingCircleName: "the Nguyens",
      kidFirstNames: ["Ben"],
      seats: 1,
      pickupPlaceName: "Nguyen home",
      pickupAddress: "Cambridge, MA",
      pickupTown: "Cambridge, MA",
      detourMinutes: null,
      status: "pending",
    }
    expect(heroRequestTitle(request)).toBe("the Nguyens need a ride for Ben")
  })

  it("formats pickup as place and address only", () => {
    expect(
      heroPickupSummary({
        id: "r1",
        requestingCircleName: "B",
        kidFirstNames: ["Ben"],
        seats: 1,
        pickupPlaceName: "Nguyen home",
        pickupAddress: "Cambridge, MA",
        pickupTown: "Cambridge, MA",
        detourMinutes: null,
        status: "pending",
      }),
    ).toBe("Nguyen home, Cambridge, MA")
  })

  it("builds slide aria labels for own-ride, pending confirm, and inbound ask", () => {
    const ownRide = {
      kind: "ownRide" as const,
      game: {
        id: "g1",
        kidId: "k1",
        title: "Game",
        startsAt: "2030-08-15T17:00:00.000Z",
        order: 0,
        attendance: "going" as const,
        ownRide: "unassigned" as const,
        requests: [],
      },
    }
    expect(
      heroAttentionSlideAriaLabel(ownRide, { kidFirstName: "Declan", pendingConfirm: false }),
    ).toBe("Declan needs a ride")
    expect(
      heroAttentionSlideAriaLabel(ownRide, { kidFirstName: "Declan", pendingConfirm: true }),
    ).toBe(CONFIRM_COVERAGE)

    const request = {
      kind: "request" as const,
      game: ownRide.game,
      request: {
        id: "r1",
        requestingCircleName: "the Nguyens",
        kidFirstNames: ["Ben"],
        seats: 1,
        pickupPlaceName: "Home",
        pickupAddress: "1 Main",
        pickupTown: "Cambridge, MA",
        detourMinutes: null,
        status: "pending" as const,
      },
    }
    expect(
      heroAttentionSlideAriaLabel(request, { kidFirstName: "Declan", pendingConfirm: false }),
    ).toBe("the Nguyens need a ride for Ben")
  })
})
