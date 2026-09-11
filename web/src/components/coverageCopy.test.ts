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
  LEG_ASKED_TEAM,
  LEG_COMING_BACK,
  LEG_GETTING_THERE,
  LEG_NEEDS_RIDE,
  NEEDS_COVERAGE,
  REVERT_CANCEL_TEAM_ASK,
  RIDE_NEEDED,
  WEEK_GLANCE_NEEDS_COVERAGE_PLURAL,
  WEEK_GLANCE_NEEDS_COVERAGE_SINGULAR,
  YOURE_DRIVING,
  confirmDriveFromLabel,
  cancelRequestToDriverLabel,
  legConfirmedStatusLabel,
  legKindLabel,
  legStatusChipLabel,
  markAsGoingAgainLabel,
  markAsNotGoingLabel,
  needsCoverageWithKids,
  waitingOnDriverLabel,
  weekGlanceCountCopy,
} from "@/components/coverageCopy"

describe("coverageCopy", () => {
  it("exports locked vocabulary constants", () => {
    expect(RIDE_NEEDED).toBe("Ride needed")
    expect(ASKED_THE_TEAM).toBe("Asked the team")
    expect(LEG_NEEDS_RIDE).toBe("Needs ride")
    expect(LEG_ASKED_TEAM).toBe("Asked team")
    expect(LEG_GETTING_THERE).toBe("Getting there")
    expect(LEG_COMING_BACK).toBe("Coming back")
    expect(NEEDS_COVERAGE).toBe("Needs coverage")
    expect(CONFIRM_ILL_DRIVE).toBe("Confirm I'll drive")
    expect(CONFIRM_YOU_WILL_DRIVE).toBe("Confirm you'll drive")
    expect(ATTENDANCE_NOT_GOING_CHIP).toBe("Not going")
    expect(HERO_ON_INVERSE).toBe("var(--fc-hero-on-inverse)")
  })

  it("builds Getting there / Coming back dual-chip labels", () => {
    expect(legKindLabel("TO")).toBe(LEG_GETTING_THERE)
    expect(legKindLabel("FROM")).toBe(LEG_COMING_BACK)
    expect(legStatusChipLabel("TO", LEG_ASKED_TEAM)).toBe("Getting there: Asked team")
    expect(legStatusChipLabel("FROM", LEG_NEEDS_RIDE)).toBe("Coming back: Needs ride")
    expect(legConfirmedStatusLabel("Katy")).toBe("Katy confirmed")
    expect(
      legConfirmedStatusLabel("Alex", {
        currentAdultId: "a1",
        assigneeAdultId: "a1",
      }),
    ).toBe(YOURE_DRIVING)
  })

  it("builds dynamic Confirm — drive from labels", () => {
    const members = [
      { adultId: "a1", displayName: "Alex" },
      { adultId: "a2", displayName: "Katy Smith" },
    ]
    expect(
      confirmDriveFromLabel({
        selectedAdultId: "a1",
        members,
        currentAdultId: "a1",
        leaveFromLabel: "Home",
      }),
    ).toBe("Confirm — you'll drive from Home")
    expect(
      confirmDriveFromLabel({
        selectedAdultId: "a2",
        members,
        currentAdultId: "a1",
        leaveFromLabel: "",
      }),
    ).toBe("Confirm — Katy will drive from the address you enter")
  })

  it("names cancel-request and waiting-on copy for pending household drivers", () => {
    expect(cancelRequestToDriverLabel("Katy")).toBe("Cancel request to Katy")
    expect(waitingOnDriverLabel("Katy")).toBe("Waiting on Katy")
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
