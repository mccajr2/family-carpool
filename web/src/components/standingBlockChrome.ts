import type { CalendarItem } from "@/api/types"

/** Lock CTA — explicit standing household plan on a drive block. */
export const LOCK_THIS_PLAN = "Lock this plan"

/** Deletes the standing template; already-applied weeks keep their data. */
export const REMOVE_RECURRING_COVERAGE = "Remove recurring coverage"

/**
 * Quiet hint when locked: one-off edits do not clear the pattern; use Remove
 * to change the standing plan going forward.
 */
export const RECURRING_ONE_OFF_HINT =
  "Recurring — edit this week anytime; remove to change the pattern"

export type StandingBlockChrome = {
  showLock: boolean
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
  const lockedMember = feed.find((item) => item.standingLocked === true)
  if (lockedMember != null) {
    return {
      showLock: false,
      showRemove: true,
      templateId: lockedMember.standingBlockTemplateId ?? null,
    }
  }
  const eligible = feed.every((item) => item.standingLockEligible === true)
  return {
    showLock: eligible,
    showRemove: false,
    templateId: null,
  }
}
