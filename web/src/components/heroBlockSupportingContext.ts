import type { CalendarItem } from "@/api/types"
import {
  NOT_YOUR_JOB_TONIGHT,
  heroBlockSiblingLine,
} from "@/components/coverageCopy"
import { formatSiblingDriveClock } from "@/components/driveBlockAgendaLinks"

export type HeroBlockSupportingContext = {
  /** Combined sibling events — informational only (never a CTA). */
  siblingLines: string[]
  /**
   * Optional muted "not your job" lines for other block members.
   * Informational only — never actionable on Hero.
   */
  mutedLines: string[]
  mutedHeading: typeof NOT_YOUR_JOB_TONIGHT | null
}

/**
 * Optional supporting block context for a Focus/Hero slide.
 *
 * Does **not** merge queue items: callers still pass one QueueItem per
 * decision. Combined `driveBlockLinks` only add sibling / muted copy so the
 * decision isn't orphaned from the night.
 */
export function heroBlockSupportingContext(
  item: Pick<CalendarItem, "driveBlockLinks">,
  options?: {
    /** Pre-derived muted lines for this block (from Agenda section builder). */
    mutedLines?: readonly string[]
  },
): HeroBlockSupportingContext {
  const siblingLines = item.driveBlockLinks
    .filter((link) => link.combined)
    .map((link) =>
      heroBlockSiblingLine({
        otherTitle: link.otherTitle,
        clockLabel: formatSiblingDriveClock(link.otherStartsAt),
      }),
    )

  const mutedLines = [...(options?.mutedLines ?? [])]
  return {
    siblingLines,
    mutedLines,
    mutedHeading: mutedLines.length > 0 ? NOT_YOUR_JOB_TONIGHT : null,
  }
}

/** True when there is anything to paint under the Hero venue line. */
export function heroBlockSupportingContextHasContent(
  context: HeroBlockSupportingContext | null | undefined,
): boolean {
  if (context == null) {
    return false
  }
  return context.siblingLines.length > 0 || context.mutedLines.length > 0
}
