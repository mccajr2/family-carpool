import { describe, expect, it } from "vitest"

import {
  AGENDA_LIST_SECTION_LABEL,
  ASKED_THE_TEAM,
  ATTENDANCE_NOT_GOING_CHIP,
  CONFIRM_ILL_DRIVE,
  CONFIRM_YOU_WILL_DRIVE,
  HERO_ALL_CAUGHT_UP,
  HERO_ON_INVERSE,
  HERO_SECTION_LABEL,
  NEEDS_COVERAGE,
  REVERT_CANCEL_TEAM_ASK,
  RIDE_NEEDED,
  WEEK_GLANCE_NEEDS_COVERAGE_PLURAL,
  WEEK_GLANCE_NEEDS_COVERAGE_SINGULAR,
  markAsGoingAgainLabel,
  markAsNotGoingLabel,
  needsCoverageWithKids,
  weekGlanceCountCopy,
} from "@/components/coverageCopy"

describe("coverageCopy", () => {
  it("exports locked vocabulary constants", () => {
    expect(RIDE_NEEDED).toBe("Ride needed")
    expect(ASKED_THE_TEAM).toBe("Asked the team")
    expect(NEEDS_COVERAGE).toBe("Needs coverage")
    expect(CONFIRM_ILL_DRIVE).toBe("Confirm I'll drive")
    expect(CONFIRM_YOU_WILL_DRIVE).toBe("Confirm you'll drive")
    expect(ATTENDANCE_NOT_GOING_CHIP).toBe("Not going")
    expect(HERO_ON_INVERSE).toBe("var(--fc-hero-on-inverse)")
  })

  it("unifies ride gap and team-ask chip labels", () => {
    expect(RIDE_NEEDED).not.toBe("Needs a ride")
    expect(ASKED_THE_TEAM).not.toBe("Requested")
    expect(RIDE_NEEDED).not.toMatch(/coverage/i)
    expect(ASKED_THE_TEAM).not.toMatch(/coverage/i)
  })

  it("keeps attendance and ride vocabulary separate", () => {
    expect(markAsNotGoingLabel("Sam")).toMatch(/not going/)
    expect(markAsGoingAgainLabel()).toMatch(/going/)
    expect(markAsNotGoingLabel("Sam")).not.toMatch(/drive|ride/i)
    expect(CONFIRM_ILL_DRIVE).toMatch(/drive/)
    expect(CONFIRM_ILL_DRIVE).not.toMatch(/going/i)
    expect(REVERT_CANCEL_TEAM_ASK).toMatch(/ride/)
    expect(REVERT_CANCEL_TEAM_ASK).not.toMatch(/going/i)
  })

  it("uses coverage wording for API-gap labels and week glance", () => {
    expect(needsCoverageWithKids("Riley")).toBe("Needs coverage: Riley")
    expect(weekGlanceCountCopy(1, WEEK_GLANCE_NEEDS_COVERAGE_SINGULAR, WEEK_GLANCE_NEEDS_COVERAGE_PLURAL)).toBe(
      "1 needs coverage",
    )
    expect(weekGlanceCountCopy(2, WEEK_GLANCE_NEEDS_COVERAGE_SINGULAR, WEEK_GLANCE_NEEDS_COVERAGE_PLURAL)).toBe(
      "2 need coverage",
    )
    expect(WEEK_GLANCE_NEEDS_COVERAGE_SINGULAR).not.toMatch(/ride/i)
    expect(WEEK_GLANCE_NEEDS_COVERAGE_PLURAL).not.toMatch(/ride/i)
  })

  it("exports hero carousel copy constants", () => {
    expect(HERO_SECTION_LABEL).toBe("Needs your attention")
    expect(HERO_ALL_CAUGHT_UP).toBe("All caught up")
    expect(AGENDA_LIST_SECTION_LABEL.needsAttention).toBe("NEEDS YOUR ATTENTION")
  })
})
