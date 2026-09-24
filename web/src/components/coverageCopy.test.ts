import { describe, expect, it } from "vitest"

import {
  AGENDA_LIST_SECTION_LABEL,
  ASKED_THE_TEAM,
  ASK_THE_TEAM,
  ATTENDANCE_NOT_GOING_CHIP,
  BACK_TO_SIMPLE_VIEW,
  CONFIRM_ILL_DRIVE,
  CONFIRM_YOU_WILL_DRIVE,
  DIFFERENT_PLANS_FOR_EACH_KID,
  DIFFERENT_PLANS_FOR_EACH_LEG,
  HERO_ALL_CAUGHT_UP,
  HERO_ON_INVERSE,
  HERO_SECTION_LABEL,
  LEG_ASKED_TEAM,
  LEG_COMING_BACK,
  LEG_GETTING_THERE,
  LEG_NEEDS_RIDE,
  LEAVE_FROM_ADDRESS_PLACEHOLDER,
  MEET_DRIVERS_PLACE,
  MEET_OUR_PLACE,
  MEET_WHERE,
  NEEDS_COVERAGE,
  POST_TO_TEAM_ROUND_TRIP,
  REVERT_CANCEL_TEAM_ASK,
  RIDE_NEEDED,
  SAVE_RIDE_PLAN,
  WEEK_GLANCE_NEEDS_COVERAGE_PLURAL,
  WEEK_GLANCE_NEEDS_COVERAGE_SINGULAR,
  YOURE_DRIVING,
  alreadyDrivingRoundTripBanner,
  agendaBlockRunHeading,
  agendaBlockRunSummaryLine,
  agendaBlockViewerRunChipLabel,
  confirmDriveFromLabel,
  confirmHouseholdCoverageLabel,
  cancelRequestToDriverLabel,
  householdConfirmShowsLeaveFrom,
  legConfirmedStatusLabel,
  legKindLabel,
  legStatusChipLabel,
  markAsGoingAgainLabel,
  markAsNotGoingLabel,
  markKidsAsNotGoingLabel,
  mutedOtherJobFromLine,
  mutedOtherJobToLine,
  needsCoverageWithKids,
  qualifiedHomeLabel,
  qualifiedPlaceLabel,
  waitingOnDriverLabel,
  weekGlanceCountCopy,
  youreDrivingRidersLabel,
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

  it("builds dynamic Confirm — round trip from labels", () => {
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
    ).toBe("Confirm — You'll drive round trip from Home")
    expect(
      confirmDriveFromLabel({
        selectedAdultId: "a2",
        members,
        currentAdultId: "a1",
        leaveFromLabel: "",
      }),
    ).toBe(`Confirm — Katy'll drive round trip from ${LEAVE_FROM_ADDRESS_PLACEHOLDER}`)
    expect(
      confirmDriveFromLabel({
        selectedAdultId: "a2",
        members,
        currentAdultId: "a1",
        leaveFromLabel: "  Work  ",
      }),
    ).toBe("Confirm — Katy'll drive round trip from Work")
    expect(
      confirmDriveFromLabel({
        selectedAdultId: "a1",
        members,
        currentAdultId: "a1",
        leaveFromLabel: "Home",
        legKinds: ["FROM"],
      }),
    ).toBe("Confirm — You'll drive home")
    expect(
      confirmDriveFromLabel({
        selectedAdultId: "a1",
        members,
        currentAdultId: "a1",
        leaveFromLabel: "Home",
        legKinds: ["TO"],
      }),
    ).toBe("Confirm — You'll drive there from Home")
  })

  it("builds household confirm labels for split legs", () => {
    expect(confirmHouseholdCoverageLabel(["TO", "FROM"])).toBe("Confirm coverage")
    expect(confirmHouseholdCoverageLabel(["FROM"])).toBe(
      "Confirm — You'll drive home",
    )
    expect(confirmHouseholdCoverageLabel(["TO"])).toBe(
      "Confirm — You'll drive there",
    )
    expect(householdConfirmShowsLeaveFrom(["FROM"])).toBe(false)
    expect(householdConfirmShowsLeaveFrom(["TO"])).toBe(true)
    expect(householdConfirmShowsLeaveFrom(["TO", "FROM"])).toBe(true)
  })

  it("exports Ask the team chip and Post / Different plans DriverPicker copy", () => {
    expect(ASK_THE_TEAM).toBe("Ask the team")
    expect(POST_TO_TEAM_ROUND_TRIP).toBe("Post to team — round trip")
    expect(DIFFERENT_PLANS_FOR_EACH_LEG).toBe("Different plans for each leg.")
    expect(DIFFERENT_PLANS_FOR_EACH_KID).toBe("Different plans for each kid.")
    expect(SAVE_RIDE_PLAN).toBe("Save ride plan")
    expect(BACK_TO_SIMPLE_VIEW).toBe("Back to simple view")
    expect(MEET_WHERE).toBe("Meet where?")
    expect(MEET_OUR_PLACE).toBe("Our place")
    expect(MEET_DRIVERS_PLACE).toBe("Driver's place")
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
    expect(markKidsAsNotGoingLabel(["Graham", "Luke"])).toBe(
      "Mark Graham and Luke as not going",
    )
    expect(markKidsAsNotGoingLabel(["Graham", "Luke", "Mia"])).toBe(
      "Mark Graham, Luke, and Mia as not going",
    )
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

  it("builds ADR-0004 Agenda block copy through shared helpers", () => {
    expect(agendaBlockRunHeading("TO", "5:40 PM")).toBe("5:40 PM · Drop-off run")
    expect(agendaBlockRunHeading("FROM", "8:00 PM")).toBe("8:00 PM · Pickup run")
    expect(agendaBlockViewerRunChipLabel(2)).toBe(youreDrivingRidersLabel(2))
    expect(agendaBlockViewerRunChipLabel(2)).toContain(YOURE_DRIVING)
    expect(alreadyDrivingRoundTripBanner(["Luke", "Graham"])).toBe(
      "You're already driving Luke and Graham round trip",
    )
    expect(qualifiedHomeLabel({ kidFirstName: "Declan", isViewersHousehold: true })).toBe(
      "your home",
    )
    expect(qualifiedHomeLabel({ kidFirstName: "Declan", isViewersHousehold: false })).toBe(
      "Declan's home",
    )
    expect(
      qualifiedPlaceLabel({
        placeName: "Home",
        kidFirstName: "Apollo",
        isViewersHousehold: false,
      }),
    ).toBe("Apollo's home")
    expect(
      mutedOtherJobFromLine({
        kidFirstName: "Kian",
        driverFirstName: "Mom",
        clockLabel: "7:00 PM",
        dropOffLabel: "Kian's home",
      }),
    ).toBe("Kian → Kian's home with Mom at 7:00 PM")
    expect(
      mutedOtherJobToLine({
        kidFirstName: "Apollo",
        driverFirstName: "Chris",
        venueName: "Simoni Rink",
      }),
    ).toBe("Apollo → Simoni Rink with Chris")
    expect(
      agendaBlockRunSummaryLine({
        leg: "FROM",
        kidFirstNames: ["Declan"],
        venueName: "Simoni Rink",
      }),
    ).toBe("Declan · Simoni Rink → home")
  })
})
