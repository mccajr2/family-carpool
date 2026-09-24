import type { CalendarItem } from "@/api/types"

/** @deprecated Prefer confirm-time checkbox — kept for test/copy stability. */
export const LOCK_THIS_PLAN = "Lock this plan"

/** Deletes the standing template and clears assignments from this date forward. */
export const REMOVE_RECURRING_COVERAGE = "Remove recurring coverage"

/** One-off edit entry on a locked block — does not call Remove. */
export const EDIT_LOCKED_PLAN = "Edit plan"

/**
 * Quiet hint when locked: one-off edits do not clear the pattern; use Remove
 * to change the standing plan going forward.
 * @deprecated Prefer {@link lockedPlanScopeCaption}.
 */
export const RECURRING_ONE_OFF_HINT =
  "Recurring — edit this week anytime; remove to change the pattern"

export type StandingWeekdayNames = {
  /** e.g. "Tuesday" */
  singular: string
  /** e.g. "Tuesdays" */
  plural: string
}

/** Local weekday labels for Lock chrome (Agenda day grouping zone). */
export function standingWeekdayNames(
  isoStartsAt: string,
  timeZone?: string,
): StandingWeekdayNames {
  const singular = new Intl.DateTimeFormat(undefined, {
    weekday: "long",
    ...(timeZone != null && timeZone.length > 0 ? { timeZone } : {}),
  }).format(new Date(isoStartsAt))
  const plural = singular.endsWith("s") ? singular : `${singular}s`
  return { singular, plural }
}

export function lockCheckboxLabel(weekdaySingular: string): string {
  return `Use this plan for every ${weekdaySingular} practice`
}

export function confirmAndLockLabel(weekdayPlural: string): string {
  return `Confirm and lock for ${weekdayPlural}`
}

export function lockedPlanTitle(weekdaySingular: string): string {
  return `Plan locked — repeats every ${weekdaySingular}`
}

export function lockedPlanScopeCaption(weekdayPlural: string): string {
  return `Editing changes just this week. Removing clears coverage from this date forward and stops auto-planning future ${weekdayPlural}.`
}

/** Hero title when a standing Lock assigned the viewer across the series. */
export function standingAssignedYouTitle(
  assignerFirstName: string,
  weekdaySingular: string,
): string {
  return `${assignerFirstName} assigned you to drive every ${weekdaySingular}`
}

/** Hero caption under standing assignment confirm. */
export function standingAssignedYouCaption(weekdayPlural: string): string {
  return `Confirm once — you're on for future ${weekdayPlural} until the plan is removed.`
}

export function markAsNotGoingThisWeekLabel(displayName: string): string {
  return `Mark ${displayName} as not going this week`
}

export function markKidsAsNotGoingThisWeekLabel(
  kidFirstNames: readonly string[],
): string {
  const names = kidFirstNames.map((n) => n.trim()).filter(Boolean)
  if (names.length === 0) {
    return "Mark kids as not going this week"
  }
  if (names.length === 1) {
    return markAsNotGoingThisWeekLabel(names[0]!)
  }
  if (names.length === 2) {
    return `Mark ${names[0]} and ${names[1]} as not going this week`
  }
  return `Mark ${names.slice(0, -1).join(", ")}, and ${names[names.length - 1]} as not going this week`
}

export type StandingBlockChrome = {
  /** Eligible for Lock checkbox on confirm (gate passed, not yet locked). */
  showLock: boolean
  /** Active template on this block — locked summary chrome. */
  showRemove: boolean
  templateId: string | null
}

/**
 * Lock / Remove chrome for an Agenda drive-block (multi-item or singleton).
 * Gate: every FEED member must be standingLockEligible. Locked: any FEED
 * member with standingLocked (server stamps the whole component).
 */
export function standingBlockChrome(items: CalendarItem[]): StandingBlockChrome {
  const feed = items.filter((item) => item.source === "FEED")
  if (feed.length === 0) {
    return { showLock: false, showRemove: false, templateId: null }
  }
  const lockedMembers = feed.filter((item) => item.standingLocked === true)
  if (lockedMembers.length > 0) {
    // Prefer a member that still carries the template id — single-item mutation
    // responses used to omit standing enrich and could wipe id on one row while
    // a sibling in a combined block kept the stamp.
    const withTemplateId = lockedMembers.find(
      (item) =>
        item.standingBlockTemplateId != null &&
        item.standingBlockTemplateId.length > 0,
    )
    return {
      showLock: false,
      showRemove: true,
      templateId:
        withTemplateId?.standingBlockTemplateId ??
        lockedMembers[0]!.standingBlockTemplateId ??
        null,
    }
  }
  const eligible = feed.every((item) => item.standingLockEligible === true)
  return {
    showLock: eligible,
    showRemove: false,
    templateId: null,
  }
}

/**
 * Single-item mutation responses (assign, leave-from, RSVP) historically omit
 * standing enrich and default to unlocked. Keep the prior stamp so Remove /
 * locked chrome does not vanish until a full list refresh (or Remove) clears it.
 */
export function mergeStandingFieldsFromPrevious(
  incoming: CalendarItem,
  previous: CalendarItem,
): CalendarItem {
  const incomingLocked = incoming.standingLocked === true
  const previousLocked = previous.standingLocked === true
  if (incomingLocked || !previousLocked) {
    return incoming
  }
  const incomingLooksUnenriched =
    incoming.standingLockEligible !== true &&
    (incoming.standingBlockTemplateId == null ||
      incoming.standingBlockTemplateId.length === 0)
  if (!incomingLooksUnenriched) {
    return incoming
  }
  return {
    ...incoming,
    standingLocked: previous.standingLocked,
    standingBlockTemplateId: previous.standingBlockTemplateId ?? null,
    standingLockEligible: previous.standingLockEligible,
  }
}
