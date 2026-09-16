import { describe, expect, it } from "vitest"

import type { CalendarDriveBlockLink, CalendarItem } from "@/api/types"
import { NOT_YOUR_JOB_TONIGHT } from "@/components/coverageCopy"
import { formatSiblingDriveClock } from "@/components/driveBlockAgendaLinks"
import {
  heroBlockSupportingContext,
  heroBlockSupportingContextHasContent,
} from "@/components/heroBlockSupportingContext"

function link(
  partial: Partial<CalendarDriveBlockLink> &
    Pick<CalendarDriveBlockLink, "otherId" | "otherTitle" | "otherStartsAt" | "combined">,
): CalendarDriveBlockLink {
  return {
    leg: "TO",
    otherSource: "FEED",
    overrideAction: null,
    ...partial,
  }
}

function item(links: CalendarDriveBlockLink[]): Pick<CalendarItem, "driveBlockLinks"> {
  return { driveBlockLinks: links }
}

describe("heroBlockSupportingContext", () => {
  it("builds sibling lines from combined driveBlockLinks only", () => {
    const clockIso = "2030-08-15T18:00:00.000Z"
    const context = heroBlockSupportingContext(
      item([
        link({
          otherId: "b",
          otherTitle: "Practice B",
          otherStartsAt: clockIso,
          combined: true,
        }),
        link({
          otherId: "c",
          otherTitle: "Earlier",
          otherStartsAt: "2030-08-15T16:00:00.000Z",
          combined: false,
        }),
      ]),
    )

    expect(context.siblingLines).toEqual([
      `Also tonight · Practice B · ${formatSiblingDriveClock(clockIso)}`,
    ])
    expect(context.mutedLines).toEqual([])
    expect(context.mutedHeading).toBeNull()
    expect(heroBlockSupportingContextHasContent(context)).toBe(true)
  })

  it("attaches muted not-your-job lines without inventing CTAs", () => {
    const context = heroBlockSupportingContext(item([]), {
      mutedLines: ["Kian → your home with Mom at 7:00 PM"],
    })
    expect(context.mutedHeading).toBe(NOT_YOUR_JOB_TONIGHT)
    expect(context.mutedLines).toEqual(["Kian → your home with Mom at 7:00 PM"])
    expect(heroBlockSupportingContextHasContent(context)).toBe(true)
  })

  it("reports empty when there is no supporting context", () => {
    expect(heroBlockSupportingContextHasContent(heroBlockSupportingContext(item([])))).toBe(
      false,
    )
  })
})
