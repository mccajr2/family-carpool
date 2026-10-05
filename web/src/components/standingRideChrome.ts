/**
 * Standing series Ask chrome (team Ask for every matching weekday).
 * Eligibility reuses calendar `standingLockEligible` / Lock weekday props
 * (same ForwardRecurrenceGate ≥3 other matches).
 */

/** Checkbox when Ask the team is selected and the series gate passes. */
export function standingAskCheckboxLabel(weekdaySingular: string): string {
  return `Ask for every ${weekdaySingular} practice`
}

/** Primary CTA when the standing Ask checkbox is checked. */
export function postStandingAskLabel(weekdayPlural: string): string {
  return `Post standing Ask for ${weekdayPlural}`
}

/**
 * True when weekday Lock/Ask gate props are present (parent passed them only
 * when standingLockEligible / showLock).
 */
export function standingAskGateOpen(
  weekdaySingular: string | null | undefined,
): boolean {
  return weekdaySingular != null && weekdaySingular.length > 0
}
