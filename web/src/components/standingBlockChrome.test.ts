import { describe, expect, it } from "vitest"

import type { CalendarItem } from "@/api/types"
import {
  LOCK_THIS_PLAN,
  REMOVE_RECURRING_COVERAGE,
  confirmAndLockLabel,
  lockCheckboxLabel,
  lockedPlanScopeCaption,
  lockedPlanTitle,
  markAsNotGoingThisWeekLabel,
  mergeStandingFieldsFromPrevious,
  standingAssignedYouCaption,
  standingAssignedYouTitle,
  standingBlockChrome,
  standingWeekdayNames,
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

  it("uses a sibling template id when the first locked member lost it", () => {
    expect(
      standingBlockChrome([
        feed("a", { standingLocked: true, standingBlockTemplateId: null }),
        feed("b", {
          standingLocked: true,
          standingBlockTemplateId: "tmpl-kept",
        }),
      ]),
    ).toEqual({
      showLock: false,
      showRemove: true,
      templateId: "tmpl-kept",
    })
  })

  it("preserves prior standing stamp on unenriched mutation responses", () => {
    const previous = feed("a", {
      standingLocked: true,
      standingBlockTemplateId: "tmpl-9",
      standingLockEligible: false,
      title: "Before",
    })
    const incoming = feed("a", {
      standingLocked: false,
      standingBlockTemplateId: null,
      standingLockEligible: false,
      title: "After leave-from",
      leaveFromPlaceId: "p1",
      leaveFromPlaceName: "Home",
    })
    expect(mergeStandingFieldsFromPrevious(incoming, previous)).toEqual({
      ...incoming,
      standingLocked: true,
      standingBlockTemplateId: "tmpl-9",
      standingLockEligible: false,
    })
  })

  it("does not re-lock when the refresh intentionally cleared standing", () => {
    const previous = feed("a", {
      standingLocked: true,
      standingBlockTemplateId: "tmpl-9",
    })
    const incoming = feed("a", {
      standingLocked: false,
      standingBlockTemplateId: null,
      standingLockEligible: true,
    })
    expect(mergeStandingFieldsFromPrevious(incoming, previous)).toEqual(incoming)
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

  it("exports standing Lock chrome copy helpers", () => {
    expect(LOCK_THIS_PLAN).toBe("Lock this plan")
    expect(REMOVE_RECURRING_COVERAGE).toBe("Remove recurring coverage")
    expect(lockCheckboxLabel("Tuesday")).toBe(
      "Use this plan for every Tuesday practice",
    )
    expect(confirmAndLockLabel("Tuesdays")).toBe("Confirm and lock for Tuesdays")
    expect(lockedPlanTitle("Tuesday")).toBe(
      "Plan locked — repeats every Tuesday",
    )
    expect(lockedPlanScopeCaption("Tuesdays")).toMatch(/from this date forward/)
    expect(standingAssignedYouTitle("Jason", "Tuesday")).toBe(
      "Jason assigned you to drive every Tuesday",
    )
    expect(standingAssignedYouCaption("Tuesdays")).toMatch(/Confirm once/)
    expect(markAsNotGoingThisWeekLabel("Declan")).toBe(
      "Mark Declan as not going this week",
    )
  })

  it("derives weekday singular and plural from startsAt", () => {
    // 2026-09-01 is a Tuesday in America/New_York
    expect(standingWeekdayNames("2026-09-01T21:00:00Z", "America/New_York")).toEqual({
      singular: "Tuesday",
      plural: "Tuesdays",
    })
  })
})
