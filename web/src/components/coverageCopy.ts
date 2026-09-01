/**
 * Single source for Agenda coverage/ride user-facing copy (Calendar hero + list).
 * Vocabulary: attendance → going / not going; ride → drive / driving / ride;
 * coverage API gap → coverage. See docs/specs/active/coverage-copy-a11y-polish.md.
 */

import { circleDisplayName } from "@/components/carpoolDisplay"

// — Attendance (ADR-0003) —

export const ATTENDANCE_NOT_GOING_CHIP = "Not going" as const

export function markAsNotGoingLabel(displayName: string): string {
  return `Mark ${displayName} as not going`
}

export function markedNotGoingMessage(displayName: string): string {
  return `${displayName} is marked not going.`
}

export function markAsGoingAgainLabel(): string {
  return "Mark as going again"
}

// — Ride / transport —

export const RIDE_NEEDED = "Ride needed" as const
export const ASKED_THE_TEAM = "Asked the team" as const
export const CONFIRM_YOU_WILL_DRIVE = "Confirm you'll drive" as const
export const YOURE_DRIVING = "You're driving" as const
export const CONFIRM_ILL_DRIVE = "Confirm I'll drive" as const
export const ASK_THE_TEAM_FOR_RIDE = "Ask the team for a ride" as const
export const NOBODY_IN_HOUSEHOLD_FREE = "Nobody in the household free?" as const
export const OVERLAPS_CHIP = "Overlaps" as const
export const RIDING_WITH_TEAMMATE = "Riding with a teammate" as const
export const CARPOOL_ASK_SINGULAR = "1 carpool ask" as const

export function ridingWithCircleLabel(circleName: string): string {
  return `Riding with ${circleDisplayName(circleName)}`
}

export function drivingChipLabel(driver: string, riderCount: number): string {
  const base = driver === "You" ? YOURE_DRIVING : `${driver} driving`
  return riderCount > 0 ? `${base} · +${riderCount}` : base
}

export function waitingOnDriverLabel(driver: string): string {
  return `Waiting on ${driver}`
}

export function carpoolAskCountLabel(count: number): string {
  return count === 1 ? CARPOOL_ASK_SINGULAR : `${count} carpool asks`
}

export function askMemberToDriveLabel(name: string): string {
  return `Ask ${name} to drive`
}

export function kidNeedsRideTitle(kidFirstName: string): string {
  return `${kidFirstName} needs a ride`
}

export function kidAlreadyGoingSuffix(kidFirstName: string): string {
  return `${kidFirstName} is already going`
}

// — Coverage API gap —

export const NEEDS_COVERAGE = "Needs coverage" as const
export const CONFIRM_COVERAGE = "Confirm coverage" as const
export const DECLINE_COVERAGE = "Decline coverage" as const
export const AWAITING_CONFIRM = "Awaiting confirm" as const
export const COVERAGE_CONFIRMED = "Confirmed" as const
export const ALL_SET = "All set" as const

export function needsCoverageWithKids(kidNames: string): string {
  return kidNames ? `${NEEDS_COVERAGE}: ${kidNames}` : NEEDS_COVERAGE
}

// — Agenda list section chrome (all-caps; Feeds-aligned) —

export const AGENDA_LIST_SECTION_LABEL = {
  needsAttention: "NEEDS YOUR ATTENTION",
  restOfToday: "REST OF TODAY",
  tomorrow: "TOMORROW",
  thisWeek: "THIS WEEK",
  later: "LATER",
} as const

export type AgendaListSectionLabel =
  (typeof AGENDA_LIST_SECTION_LABEL)[keyof typeof AGENDA_LIST_SECTION_LABEL]

// — Week glance (sentence-lowercase density) —

export const WEEK_GLANCE_NO_EVENTS = "No events" as const
export const WEEK_GLANCE_NEEDS_COVERAGE_SINGULAR = "needs coverage" as const
export const WEEK_GLANCE_NEEDS_COVERAGE_PLURAL = "need coverage" as const
export const WEEK_GLANCE_OVERLAPS_SINGULAR = "overlaps" as const
export const WEEK_GLANCE_OVERLAPS_PLURAL = "overlap" as const
export const WEEK_GLANCE_TO_CONFIRM = "to confirm" as const

export function weekGlanceCountCopy(n: number, singular: string, plural: string): string {
  return n === 1 ? `1 ${singular}` : `${n} ${plural}`
}

// — Hero carousel —

/** Theme-independent ink for labels on filled heroOn (white) controls — not page textPrimary. */
export const HERO_ON_INVERSE = "var(--fc-hero-on-inverse)" as const

export const HERO_SECTION_LABEL = "Needs your attention" as const
export const HERO_MOST_URGENT = "Most urgent" as const
export const HERO_UP_NEXT = "Up next" as const
export const HERO_ALL_CAUGHT_UP = "All caught up" as const
export const HERO_NOTHING_NEEDS_YOU = "Nothing needs you right now" as const
export const HERO_EMPTY_BODY =
  "Every ride this week is either covered or waiting on someone else. We'll bring the next thing here the moment it needs a decision from you." as const

export function heroQueueCountLabel(count: number): string {
  return `· ${count} things need you`
}

export function heroQueueCountAnnouncement(count: number): string {
  return `${count} things need you`
}

export function heroCarouselDotLabel(index: number, total: number): string {
  return `Go to item ${index + 1} of ${total}`
}

export const HERO_CAROUSEL_PREVIOUS = "Previous item" as const
export const HERO_CAROUSEL_NEXT = "Next item" as const
export const HERO_CAROUSEL_ARIA_LABEL = HERO_SECTION_LABEL

// — Inbound handoff + status —

export const INBOUND_HERO_HANDOFF = "Handle in Needs your attention above" as const
export const INBOUND_ACCEPTED = "Accepted" as const
export const INBOUND_PASSED = "Passed" as const
export const INBOUND_DECLINED_NEEDED_RIDE = "Declined — you needed a ride too" as const

// — Own-ride revert (drive vocabulary) —

export const REVERT_INBOUND_CANT_TAKE_THEM = "Can't take them anymore" as const
export const REVERT_INBOUND_RECONSIDER = "Reconsider" as const
export const REVERT_INBOUND_UNDO = "Undo" as const
export const REVERT_CANCEL_TEAM_ASK = "No longer need a ride? Cancel this ask" as const
export const REVERT_REASSIGN_YOU = "Can't drive anymore? Reassign the ride" as const

export function revertOtherDriverLabel(driver: string): string {
  return `${driver} can't drive anymore? Reassign the ride`
}

export function revertTeammateDriverLabel(driver: string): string {
  return `${driver} can't drive anymore? Find a new ride`
}
