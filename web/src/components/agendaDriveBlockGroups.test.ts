import { describe, expect, it } from "vitest"

import type { CalendarDriveBlockLink, CalendarItem } from "@/api/types"
import {
  agendaDriveBlockEntryKey,
  groupAgendaItemsByDriveBlock,
} from "@/components/agendaDriveBlockGroups"

function item(
  id: string,
  startsAt: string,
  overrides: Partial<CalendarItem> = {},
): CalendarItem {
  return {
    id,
    source: "FEED",
    title: id,
    startsAt,
    endsAt: null,
    location: null,
    kidIds: ["k1"],
    feedId: "f1",
    feedName: "Team",
    eventKey: null,
    leaveFromPlaceId: null,
    leaveFromPlaceName: null,
    leaveFromAddress: null,
    leaveByAt: null,
    leaveByStatus: "UNAVAILABLE",
    leaveByReason: "NO_ORIGIN",
    coverages: [],
    uncoveredKidIds: [],
    conflicts: [],
    rsvps: [{ kidId: "k1", status: "NO_RESPONSE" }],
    driveBlockLinks: [],
    ...overrides,
  }
}

function link(
  otherId: string,
  otherStartsAt: string,
  combined: boolean,
  partial: Partial<CalendarDriveBlockLink> = {},
): CalendarDriveBlockLink {
  return {
    leg: "TO",
    otherSource: "FEED",
    otherId,
    otherTitle: otherId,
    otherStartsAt,
    combined,
    overrideAction: null,
    ...partial,
  }
}

describe("groupAgendaItemsByDriveBlock", () => {
  it("keeps non-combined and singleton items as AgendaRow singletons", () => {
    const a = item("a", "2030-08-15T17:00:00.000Z")
    const b = item("b", "2030-08-15T18:00:00.000Z", {
      driveBlockLinks: [link("a", "2030-08-15T17:00:00.000Z", false)],
    })
    const c = item("c", "2030-08-15T19:00:00.000Z")

    expect(groupAgendaItemsByDriveBlock([a, b, c])).toEqual([
      { kind: "singleton", item: a },
      { kind: "singleton", item: b },
      { kind: "singleton", item: c },
    ])
  })

  it("collapses two combined items into one block entry", () => {
    const a = item("a", "2030-08-15T17:00:00.000Z", {
      driveBlockLinks: [link("b", "2030-08-15T18:00:00.000Z", true)],
    })
    const b = item("b", "2030-08-15T18:00:00.000Z", {
      driveBlockLinks: [link("a", "2030-08-15T17:00:00.000Z", true)],
    })
    const solo = item("solo", "2030-08-15T19:00:00.000Z")

    const entries = groupAgendaItemsByDriveBlock([a, b, solo])
    expect(entries).toHaveLength(2)
    expect(entries[0]).toEqual({ kind: "block", items: [a, b] })
    expect(entries[1]).toEqual({ kind: "singleton", item: solo })
  })

  it("merges transitive combined chains into one block", () => {
    const a = item("a", "2030-08-15T17:00:00.000Z", {
      driveBlockLinks: [link("b", "2030-08-15T18:00:00.000Z", true)],
    })
    const b = item("b", "2030-08-15T18:00:00.000Z", {
      driveBlockLinks: [
        link("a", "2030-08-15T17:00:00.000Z", true),
        link("c", "2030-08-15T19:00:00.000Z", true),
      ],
    })
    const c = item("c", "2030-08-15T19:00:00.000Z", {
      driveBlockLinks: [link("b", "2030-08-15T18:00:00.000Z", true)],
    })

    const entries = groupAgendaItemsByDriveBlock([c, a, b])
    expect(entries).toEqual([{ kind: "block", items: [a, b, c] }])
  })

  it("treats FORCE_MERGE combined links like auto-combined", () => {
    const a = item("a", "2030-08-15T17:00:00.000Z", {
      driveBlockLinks: [
        link("b", "2030-08-15T18:00:00.000Z", true, {
          overrideAction: "FORCE_MERGE",
        }),
      ],
    })
    const b = item("b", "2030-08-15T18:00:00.000Z", {
      driveBlockLinks: [
        link("a", "2030-08-15T17:00:00.000Z", true, {
          overrideAction: "FORCE_MERGE",
        }),
      ],
    })

    expect(groupAgendaItemsByDriveBlock([a, b])).toEqual([
      { kind: "block", items: [a, b] },
    ])
  })

  it("does not merge when the combined sibling is absent from the list", () => {
    const a = item("a", "2030-08-15T17:00:00.000Z", {
      driveBlockLinks: [link("b", "2030-08-15T18:00:00.000Z", true)],
    })

    expect(groupAgendaItemsByDriveBlock([a])).toEqual([
      { kind: "singleton", item: a },
    ])
  })

  it("builds a stable block entry key from member calendar keys", () => {
    const a = item("a", "2030-08-15T17:00:00.000Z")
    const b = item("b", "2030-08-15T18:00:00.000Z")
    expect(agendaDriveBlockEntryKey([a, b])).toBe("FEED-a|FEED-b")
  })
})
