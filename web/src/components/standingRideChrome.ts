/**
 * Standing series Ask chrome (team Ask for every matching weekday).
 * Eligibility reuses calendar `standingLockEligible` (same ForwardRecurrenceGate).
 */

/** Checkbox when Ask the team is selected and the series gate passes. */
export function standingAskCheckboxLabel(weekdaySingular: string): string {
  return `Ask for every ${weekdaySingular} practice`
}

/** Primary CTA when the standing Ask checkbox is checked. */
export function postStandingAskLabel(weekdayPlural: string): string {
  return `Post standing Ask for ${weekdayPlural}`
}
