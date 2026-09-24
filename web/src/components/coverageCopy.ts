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

/** Simple-view attendance — one control for every going kid on the event. */
export function markKidsAsNotGoingLabel(kidFirstNames: readonly string[]): string {
  return `Mark ${joinKidFirstNames(kidFirstNames)} as not going`
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
/** Trailing driver-row chip (Focus/Hero + expanded Agenda DriverPicker). */
export const ASK_THE_TEAM = "Ask the team" as const
/** Primary CTA when Ask the team is selected on DriverPicker. */
export const POST_TO_TEAM_ROUND_TRIP = "Post to team — round trip" as const
/** Progressive disclosure under Confirm / Post — opens the split editor. */
export const DIFFERENT_PLANS_FOR_EACH_LEG = "Different plans for each leg." as const
/** Progressive disclosure — opens per-kid nested DriverPicker sections. */
export const DIFFERENT_PLANS_FOR_EACH_KID = "Different plans for each kid." as const
/** Split-editor primary CTA (applies both legs). */
export const SAVE_RIDE_PLAN = "Save ride plan" as const
/** Split-editor link back to collapsed round-trip DriverPicker chrome. */
export const BACK_TO_SIMPLE_VIEW = "Back to simple view" as const
/** One-time leave-from still empty in the draft field. */
export const LEAVE_FROM_ADDRESS_PLACEHOLDER = "the address you enter" as const

// — Agenda driving-block card —

/** Multi-event Agenda block — TO leg run header. */
export const DROP_OFF_RUN = "Drop-off run" as const
/** Multi-event Agenda block — FROM leg run header. */
export const PICKUP_RUN = "Pickup run" as const
/** ADR-0004 rule 6 — muted band when viewer already has driving work on the card. */
export const NOT_YOUR_JOB_TONIGHT = "Not your job tonight" as const
/** ADR-0004 rule 6 — muted band when another's commitment covers the viewer's kids. */
export const ALREADY_COVERED = "Already covered" as const

/** Hero supporting context — sibling event in the same driving block (not a CTA). */
export const HERO_BLOCK_ALSO_TONIGHT = "Also tonight" as const

/** Block-run chip: You're driving · N rider(s). */
export function youreDrivingRidersLabel(riderCount: number): string {
  if (riderCount <= 0) {
    return YOURE_DRIVING
  }
  if (riderCount === 1) {
    return `${YOURE_DRIVING} · 1 rider`
  }
  return `${YOURE_DRIVING} · ${riderCount} riders`
}

/**
 * Viewer-owned Agenda block run chip. Uses the same `You're driving` stem as
 * {@link legConfirmedStatusLabel} for the viewing adult (ADR rule 1).
 */
export function agendaBlockViewerRunChipLabel(riderCount: number): string {
  return youreDrivingRidersLabel(riderCount)
}

/**
 * ADR-0004 rule 5 — never bare "Home" across a household boundary.
 * Viewer's own place stays "your home"; another kid's place is qualified.
 */
export function qualifiedHomeLabel(options: {
  kidFirstName: string
  /** True when the home belongs to the viewing adult's household. */
  isViewersHousehold: boolean
}): string {
  const kid = options.kidFirstName.trim() || "Kid"
  if (options.isViewersHousehold) {
    return "your home"
  }
  return `${kid}'s home`
}

/**
 * ADR-0004 rule 5 — qualify a free-text / venue place when it would otherwise
 * read as bare "Home".
 */
export function qualifiedPlaceLabel(options: {
  placeName: string | null | undefined
  kidFirstName: string
  isViewersHousehold: boolean
}): string {
  const raw = options.placeName?.trim() || ""
  if (raw === "" || /^home$/i.test(raw)) {
    return qualifiedHomeLabel({
      kidFirstName: options.kidFirstName,
      isViewersHousehold: options.isViewersHousehold,
    })
  }
  return raw
}

/**
 * ADR-0004 rules 2 + 4 + 6 — muted FROM line (home-side is a drop-off).
 * Kid-first; direction-correct drop-off label.
 */
export function mutedOtherJobFromLine(options: {
  kidFirstName: string
  driverFirstName: string
  clockLabel: string
  dropOffLabel: string
}): string {
  const kid = options.kidFirstName.trim() || "Kid"
  const driver = options.driverFirstName.trim() || "another parent"
  return `${kid} → ${options.dropOffLabel} with ${driver} at ${options.clockLabel}`
}

/**
 * ADR-0004 rules 2 + 6 — muted TO line (venue / covered-by).
 * Kid-first; perspective is the viewer's ("with {driver}", not raw status).
 */
export function mutedOtherJobToLine(options: {
  kidFirstName: string
  driverFirstName: string
  venueName?: string | null
}): string {
  const kid = options.kidFirstName.trim() || "Kid"
  const driver = options.driverFirstName.trim() || "another parent"
  const venue = options.venueName?.trim()
  if (venue) {
    return `${kid} → ${venue} with ${driver}`
  }
  return `${kid} · covered by ${driver}`
}

/**
 * Block-run heading: `{clock} · Drop-off run` / `Pickup run`.
 * Drop-off = TO (to event); Pickup = FROM (from event) — ADR rule 4.
 */
export function agendaBlockRunHeading(
  leg: "TO" | "FROM",
  clockLabel: string,
): string {
  const run = leg === "TO" ? DROP_OFF_RUN : PICKUP_RUN
  return `${clockLabel} · ${run}`
}

/** Ask the team needs a pickup snapshot — shown next to Save / Post. */
export const ASK_TEAM_NEEDS_PLACE =
  "Add a home address in Places before asking the team." as const

/** Meet-side control label on Ask the team legs. */
export const MEET_WHERE = "Meet where?" as const
/** Meet at the requesting circle's family-side place. */
export const MEET_OUR_PLACE = "Our place" as const
/** Meet at the accepting driver's place (bound on Accept). */
export const MEET_DRIVERS_PLACE = "Driver's place" as const
/** Helper under Driver's place while PENDING. */
export const MEET_DRIVERS_PLACE_HINT =
  "Address appears after someone accepts." as const

export const OVERLAPS_CHIP = "Overlaps" as const
export const RIDE_CONFLICT_CHIP = "Ride conflict" as const
export const RIDING_WITH_TEAMMATE = "Riding with a teammate" as const
export const CARPOOL_ASK_SINGULAR = "1 carpool ask" as const

export function alsoDrivingKidLabel(kidFirstName: string): string {
  return `Also driving ${kidFirstName.trim()}`
}

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

// — Per-leg transport chips (Getting there / Coming back) —

export const LEG_GETTING_THERE = "Getting there" as const
/** Family-side place label on the TO (Getting there) leg. */
export const PLACE_PICKING_UP_FROM = "Picking up from" as const
/** Family-side place label on the FROM (Coming back) leg. */
export const PLACE_DROPPING_OFF_AT = "Dropping off at" as const
export const LEG_COMING_BACK = "Coming back" as const
/** Leg-chip phase copy (shorter than collapsed Agenda `RIDE_NEEDED`). */
export const LEG_NEEDS_RIDE = "Needs ride" as const
export const LEG_ASKED_TEAM = "Asked team" as const

export function legKindLabel(kind: "TO" | "FROM"): string {
  return kind === "TO" ? LEG_GETTING_THERE : LEG_COMING_BACK
}

/** Confirmed-leg chip body: You're driving | {name} confirmed. */
export function legConfirmedStatusLabel(
  assigneeDisplayName: string | null | undefined,
  options?: { currentAdultId?: string; assigneeAdultId?: string | null },
): string {
  if (
    options?.currentAdultId != null &&
    options.assigneeAdultId != null &&
    options.assigneeAdultId === options.currentAdultId
  ) {
    return YOURE_DRIVING
  }
  const who = assigneeDisplayName?.trim()
  return who ? `${who} confirmed` : "Confirmed"
}

/** Full dual-chip label: `Getting there: Asked team`. */
export function legStatusChipLabel(kind: "TO" | "FROM", phaseStatus: string): string {
  return `${legKindLabel(kind)}: ${phaseStatus}`
}

/** Cancel a pending household assign to another adult. */
export function cancelRequestToDriverLabel(driver: string): string {
  return `Cancel request to ${driver}`
}

export function carpoolAskCountLabel(count: number): string {
  return count === 1 ? CARPOOL_ASK_SINGULAR : `${count} carpool asks`
}

export function askMemberToDriveLabel(name: string): string {
  return `Ask ${name} to drive`
}

/**
 * Dynamic Confirm CTA for household driver + leave-from:
 * "Confirm — You'll drive round trip from Home".
 * When {@code legKinds} is set, one-way assignments avoid round-trip copy.
 */
export function confirmDriveFromLabel(options: {
  selectedAdultId: string
  members: { adultId: string; displayName: string | null }[]
  currentAdultId: string
  leaveFromLabel: string
  /** Assigned TO/FROM kinds when already known (split plan). */
  legKinds?: readonly ("TO" | "FROM")[]
}): string {
  const origin = options.leaveFromLabel.trim() || LEAVE_FROM_ADDRESS_PLACEHOLDER
  const kinds = options.legKinds ?? null
  const hasTo = kinds == null ? true : kinds.includes("TO")
  const hasFrom = kinds == null ? true : kinds.includes("FROM")
  const you = options.selectedAdultId === options.currentAdultId
  const member = options.members.find((row) => row.adultId === options.selectedAdultId)
  const name = member?.displayName?.trim() || "them"
  const first = name.split(/\s+/)[0] ?? name
  const who = you ? "You'll" : `${first}'ll`

  if (hasTo && hasFrom) {
    return `Confirm — ${who} drive round trip from ${origin}`
  }
  if (hasFrom && !hasTo) {
    return you
      ? "Confirm — You'll drive home"
      : `Confirm — ${first}'ll drive home`
  }
  if (hasTo && !hasFrom) {
    return you
      ? `Confirm — You'll drive there from ${origin}`
      : `Confirm — ${first}'ll drive there from ${origin}`
  }
  return `Confirm — ${who} drive round trip from ${origin}`
}

/** "Luke", "Luke and Graham", "Luke, Graham, and Mia". */
export function joinKidFirstNames(kidFirstNames: readonly string[]): string {
  const names = kidFirstNames.map((name) => name.trim()).filter(Boolean)
  if (names.length === 0) {
    return "Kids"
  }
  if (names.length === 1) {
    return names[0]!
  }
  if (names.length === 2) {
    return `${names[0]} and ${names[1]}`
  }
  return `${names.slice(0, -1).join(", ")}, and ${names[names.length - 1]}`
}

/**
 * ADR-0004 rule 3 — plain informational banner when the viewer already owns
 * both TO and FROM for the listed kids (not a chip to decode).
 */
export function alreadyDrivingRoundTripBanner(
  kidFirstNames: readonly string[],
): string {
  return `You're already driving ${joinKidFirstNames(kidFirstNames)} round trip`
}

/**
 * Hero supporting line for a combined sibling in the same driving block.
 * Informational only — not a second primary decision (day-block-agenda).
 */
export function heroBlockSiblingLine(options: {
  otherTitle: string
  clockLabel: string
}): string {
  const title = options.otherTitle.trim() || "event"
  return `${HERO_BLOCK_ALSO_TONIGHT} · ${title} · ${options.clockLabel}`
}

/**
 * ADR-0004 rules 4 + 8 — always-visible run summary (single-stop multi-kid
 * names together). FROM uses venue → home (drop-off at home).
 */
export function agendaBlockRunSummaryLine(options: {
  leg: "TO" | "FROM"
  kidFirstNames: readonly string[]
  venueName?: string | null
}): string | null {
  if (options.kidFirstNames.length === 0) {
    return null
  }
  const kids = joinKidFirstNames(options.kidFirstNames)
  if (options.leg === "FROM") {
    const venue = options.venueName?.trim()
    return venue ? `${kids} · ${venue} → home` : kids
  }
  return kids
}

export function kidNeedsRideTitle(kidFirstName: string): string {
  return kidsNeedRideTitle([kidFirstName])
}

/** One or more kids needing a ride — singular/plural verb. */
export function kidsNeedRideTitle(kidFirstNames: readonly string[]): string {
  const joined = joinKidFirstNames(kidFirstNames)
  if (kidFirstNames.map((n) => n.trim()).filter(Boolean).length <= 1) {
    return `${joined} needs a ride`
  }
  return `${joined} need a ride`
}

/** Pending household assign — assigner asked the viewer to drive this kid. */
export function assignedYouToDriveTitle(
  assignerFirstName: string,
  kidFirstName: string,
): string {
  return assignedYouToDriveKidsTitle(assignerFirstName, [kidFirstName])
}

export function assignedYouToDriveKidsTitle(
  assignerFirstName: string,
  kidFirstNames: readonly string[],
): string {
  return `${assignerFirstName} assigned you to drive ${joinKidFirstNames(kidFirstNames)}`
}

/** Fallback when assigner is unknown on a pending confirm-for-self slide. */
export function confirmYoullDriveKidTitle(kidFirstName: string): string {
  return confirmYoullDriveKidsTitle([kidFirstName])
}

export function confirmYoullDriveKidsTitle(kidFirstNames: readonly string[]): string {
  return `Confirm you'll drive ${joinKidFirstNames(kidFirstNames)}`
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

/**
 * Hero / Agenda Confirm CTA when the viewer is WAITING_HOUSEHOLD on specific legs.
 */
export function confirmHouseholdCoverageLabel(
  legKinds: readonly ("TO" | "FROM")[],
): string {
  const hasTo = legKinds.includes("TO")
  const hasFrom = legKinds.includes("FROM")
  if (hasTo && hasFrom) {
    return CONFIRM_COVERAGE
  }
  if (hasFrom && !hasTo) {
    return "Confirm — You'll drive home"
  }
  if (hasTo && !hasFrom) {
    return "Confirm — You'll drive there"
  }
  return CONFIRM_COVERAGE
}

/** Leave-from applies to TO (and round-trip); not to FROM-only drive-home. */
export function householdConfirmShowsLeaveFrom(
  legKinds: readonly ("TO" | "FROM")[],
): boolean {
  return legKinds.includes("TO")
}

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
export const REASSIGN_THE_RIDE = "Reassign the ride" as const
export const REVERT_REASSIGN_YOU = "Can't drive anymore? Reassign the ride" as const

export function revertOtherDriverLabel(driver: string): string {
  return `${driver} can't drive anymore? Reassign the ride`
}

export function revertTeammateDriverLabel(driver: string): string {
  return `${driver} can't drive anymore? Find a new ride`
}
