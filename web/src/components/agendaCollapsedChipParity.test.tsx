import { render, screen, within } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import type { CalendarItem, FamilyCircle } from "@/api/types"
import { AgendaBlockCard } from "@/components/AgendaBlockCard"
import { AgendaRow } from "@/components/AgendaRow"
import { AgendaStatusChip } from "@/components/agendaStatusChip"
import { RIDE_NEEDED } from "@/components/coverageCopy"

/**
 * Collapsed Agenda chips must share one size/weight via AgendaStatusChip —
 * assert token classes on the shared component, not PDF pixel snapshots.
 * (AgendaStatusChip consumes feedChip geometry; statusChip role matches those metrics.)
 */
const SHARED_CHIP_SIZE = /--fc-font-feed-chip-size/
const SHARED_CHIP_WEIGHT = /--fc-font-feed-chip-weight/

const circle: FamilyCircle = {
  id: "c1",
  name: "House",
  role: "ORGANIZER",
  members: [
    {
      adultId: "a1",
      email: "chris@example.com",
      displayName: "Chris",
      role: "ORGANIZER",
    },
    {
      adultId: "a2",
      email: "katy@example.com",
      displayName: "Katy",
      role: "CAREGIVER",
    },
  ],
  kids: [
    { id: "k1", displayName: "Declan" },
    { id: "k2", displayName: "Kian" },
  ],
  places: [],
  defaultLeaveFromPlaceId: null,
  defaultLeaveFromPlaceName: null,
}

const noopRowHandlers = {
  onUpdateAssignDraft: vi.fn(),
  onAssignCoverage: vi.fn(),
  onConfirmCoverage: vi.fn(),
  onDeclineCoverage: vi.fn(),
  onRemoveCoverage: vi.fn(),
  onSetLeaveFrom: vi.fn(),
  onSetCoverageLeaveFrom: vi.fn(),
  onSetRsvp: vi.fn(),
  onOpenPlaces: vi.fn(),
  onEdit: vi.fn(),
  onRemoveEvent: vi.fn(),
}

function calendarItem(
  id: string,
  overrides: Partial<CalendarItem> = {},
): CalendarItem {
  const kidIds = overrides.kidIds ?? ["k1"]
  return {
    id,
    source: "FEED",
    title: "Practice",
    startsAt: "2030-08-15T18:00:00.000Z",
    endsAt: null,
    location: "Rink",
    kidIds,
    feedId: "f1",
    feedName: "U12",
    eventKey: `UID:${id}`,
    leaveFromPlaceId: null,
    leaveFromPlaceName: null,
    leaveFromAddress: null,
    leaveByAt: null,
    leaveByStatus: "UNAVAILABLE",
    leaveByReason: "NO_ORIGIN",
    coverages: [],
    uncoveredKidIds: kidIds,
    conflicts: [],
    rsvps: kidIds.map((kidId) => ({ kidId, status: "YES" as const })),
    driveBlockLinks: [],
    ...overrides,
  }
}

function chipEls(strip: HTMLElement): HTMLElement[] {
  return Array.from(strip.querySelectorAll("span")).filter((el) =>
    SHARED_CHIP_SIZE.test(el.className),
  )
}

describe("collapsed Agenda chip size/weight parity", () => {
  it("locks size and weight on AgendaStatusChip for every tone (shared component)", () => {
    render(
      <>
        <AgendaStatusChip label="Ride needed" tone="amber" />
        <AgendaStatusChip label="Katy · round trip" tone="route" />
        <AgendaStatusChip label="You · round trip" tone="mint" />
        <AgendaStatusChip label="Not going" tone="muted" />
        <AgendaStatusChip label="Overlaps" tone="family" />
      </>,
    )

    for (const label of [
      "Ride needed",
      "Katy · round trip",
      "You · round trip",
      "Not going",
      "Overlaps",
    ]) {
      const chip = screen.getByText(label)
      expect(chip.className).toMatch(SHARED_CHIP_SIZE)
      expect(chip.className).toMatch(SHARED_CHIP_WEIGHT)
      expect(chip.className).toMatch(/uppercase/)
    }
  })

  it("uses the same AgendaStatusChip size/weight on single and combined collapsed strips", () => {
    render(
      <>
        <AgendaRow
          item={calendarItem("single", {
            id: "single",
            uncoveredKidIds: ["k1"],
          })}
          circle={circle}
          currentAdultId="a1"
          loading={false}
          assignDraft={{
            adultId: "a1",
            kidIds: ["k1"],
            soleAdult: true,
            soleKid: true,
          }}
          {...noopRowHandlers}
        />
        <AgendaBlockCard
          items={[
            calendarItem("a", {
              id: "a",
              feedName: "Mite 3",
              title: "CYH Mite 3 Practice",
              startsAt: "2030-08-15T18:00:00.000Z",
              kidIds: ["k1"],
              uncoveredKidIds: ["k1"],
            }),
            calendarItem("b", {
              id: "b",
              feedName: "Squirt 1",
              title: "CYH Squirt 1 Practice",
              startsAt: "2030-08-15T19:00:00.000Z",
              kidIds: ["k2"],
              uncoveredKidIds: ["k2"],
            }),
          ]}
          circle={circle}
          currentAdultId="a1"
          rideEventFor={() => null}
        />
      </>,
    )

    const rowStrip = screen.getByTestId("agenda-row-chip-strip")
    const blockStrip = screen.getByTestId("agenda-block-chip-strip")
    expect(within(rowStrip).getByText(RIDE_NEEDED)).toBeInTheDocument()
    expect(within(blockStrip).getByText(RIDE_NEEDED)).toBeInTheDocument()

    const rowChips = chipEls(rowStrip)
    const blockChips = chipEls(blockStrip)
    expect(rowChips.length).toBeGreaterThan(0)
    expect(blockChips.length).toBeGreaterThan(0)

    for (const chip of [...rowChips, ...blockChips]) {
      expect(chip.className).toMatch(SHARED_CHIP_SIZE)
      expect(chip.className).toMatch(SHARED_CHIP_WEIGHT)
    }

    const rowSizeClass = rowChips[0]!.className.match(SHARED_CHIP_SIZE)![0]
    const rowWeightClass = rowChips[0]!.className.match(SHARED_CHIP_WEIGHT)![0]
    for (const chip of blockChips) {
      expect(chip.className).toContain(rowSizeClass)
      expect(chip.className).toContain(rowWeightClass)
    }
  })
})
