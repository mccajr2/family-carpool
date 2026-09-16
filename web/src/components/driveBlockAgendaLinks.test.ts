import { describe, expect, it } from "vitest"

import type { CalendarDriveBlockLink, CalendarItem } from "@/api/types"
import {
  driveBlockLinkLabel,
  driveBlockWriteForClick,
  formatSiblingDriveClock,
  orderedDriveBlockPair,
} from "@/components/driveBlockAgendaLinks"

const baseItem: Pick<CalendarItem, "id" | "source" | "startsAt"> = {
  id: "e1",
  source: "FEED",
  startsAt: "2026-09-15T17:00:00.000Z",
}

function link(partial: Partial<CalendarDriveBlockLink> = {}): CalendarDriveBlockLink {
  return {
    leg: "TO",
    otherSource: "FEED",
    otherId: "e2",
    otherStartsAt: "2026-09-15T18:00:00.000Z",
    combined: true,
    overrideAction: null,
    ...partial,
  }
}

describe("driveBlockAgendaLinks", () => {
  it("formats sibling clock for copy", () => {
    const clock = formatSiblingDriveClock("2026-09-15T22:00:00.000Z")
    expect(clock).toMatch(/\d{1,2}:\d{2}/)
  })

  it("builds combined and splittable labels", () => {
    const clock = formatSiblingDriveClock("2026-09-15T18:00:00.000Z")
    expect(driveBlockLinkLabel(link({ combined: true }))).toBe(
      `Combined with your ${clock} drive · Split this out`,
    )
    expect(driveBlockLinkLabel(link({ combined: false }))).toBe(
      `Split from your ${clock} drive · Combine these`,
    )
  })

  it("orders the pair with earlier startsAt as left", () => {
    expect(orderedDriveBlockPair(baseItem, link())).toEqual({
      leg: "TO",
      leftSource: "FEED",
      leftItemId: "e1",
      rightSource: "FEED",
      rightItemId: "e2",
    })
    expect(
      orderedDriveBlockPair(
        { ...baseItem, startsAt: "2026-09-15T19:00:00.000Z" },
        link({ otherStartsAt: "2026-09-15T18:00:00.000Z" }),
      ),
    ).toEqual({
      leg: "TO",
      leftSource: "FEED",
      leftItemId: "e2",
      rightSource: "FEED",
      rightItemId: "e1",
    })
  })

  it("maps click to set FORCE_SPLIT / FORCE_MERGE or clear", () => {
    expect(driveBlockWriteForClick(baseItem, link({ combined: true }))).toEqual({
      kind: "set",
      action: "FORCE_SPLIT",
      leg: "TO",
      leftSource: "FEED",
      leftItemId: "e1",
      rightSource: "FEED",
      rightItemId: "e2",
    })
    expect(
      driveBlockWriteForClick(
        baseItem,
        link({ combined: true, overrideAction: "FORCE_MERGE" }),
      ),
    ).toEqual({
      kind: "clear",
      leg: "TO",
      leftSource: "FEED",
      leftItemId: "e1",
      rightSource: "FEED",
      rightItemId: "e2",
    })
    expect(driveBlockWriteForClick(baseItem, link({ combined: false }))).toEqual({
      kind: "set",
      action: "FORCE_MERGE",
      leg: "TO",
      leftSource: "FEED",
      leftItemId: "e1",
      rightSource: "FEED",
      rightItemId: "e2",
    })
    expect(
      driveBlockWriteForClick(
        baseItem,
        link({ combined: false, overrideAction: "FORCE_SPLIT" }),
      ),
    ).toEqual({
      kind: "clear",
      leg: "TO",
      leftSource: "FEED",
      leftItemId: "e1",
      rightSource: "FEED",
      rightItemId: "e2",
    })
  })
})
