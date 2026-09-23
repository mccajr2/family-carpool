import { describe, expect, it } from "vitest"

import type { CalendarItem } from "@/api/types"
import {
  LOCK_THIS_PLAN,
  REMOVE_RECURRING_COVERAGE,
  standingBlockChrome,
} from "@/components/standingBlockChrome"

function feed(
  id: string,
  overrides: Partial<CalendarItem> = {},
): CalendarItem {
  return {
    id,
    source: "FEED",
    title: "Practice",
    startsAt: "2026-09-01T21:00:00Z",
    endsAt: null,
    location: "Rink",
    kidIds: ["k1"],
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
    uncoveredKidIds: [],
    conflicts: [],
    rsvps: [],
    driveBlockLinks: [],
    ...overrides,
  }
}

describe("standingBlockChrome", () => {
  it("hides Lock when any FEED member fails the gate", () => {
    expect(
      standingBlockChrome([
        feed("a", { standingLockEligible: true }),
        feed("b", { standingLockEligible: false }),
      ]),
    ).toEqual({ showLock: false, showRemove: false, templateId: null })
  })

  it("shows Lock when every FEED member is eligible", () => {
    expect(
      standingBlockChrome([
        feed("a", { standingLockEligible: true }),
        feed("b", { standingLockEligible: true }),
      ]),
    ).toEqual({ showLock: true, showRemove: false, templateId: null })
  })

  it("shows Remove when locked and hides Lock", () => {
    expect(
      standingBlockChrome([
        feed("a", {
          standingLocked: true,
          standingBlockTemplateId: "t1",
          standingLockEligible: true,
        }),
        feed("b", {
          standingLocked: true,
          standingBlockTemplateId: "t1",
        }),
      ]),
    ).toEqual({ showLock: false, showRemove: true, templateId: "t1" })
  })

  it("ignores MANUAL-only groups", () => {
    expect(
      standingBlockChrome([
        {
          ...feed("m"),
          source: "MANUAL",
          feedId: null,
          feedName: null,
          eventKey: null,
          standingLockEligible: true,
        },
      ]),
    ).toEqual({ showLock: false, showRemove: false, templateId: null })
  })

  it("exports stable chrome copy", () => {
    expect(LOCK_THIS_PLAN).toBe("Lock this plan")
    expect(REMOVE_RECURRING_COVERAGE).toBe("Remove recurring coverage")
  })
})
