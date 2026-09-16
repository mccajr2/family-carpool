import type {
  CalendarItem,
  CarpoolLegKind,
  CarpoolRideEvent,
  FamilyMember,
  Kid,
} from "@/api/types"
import {
  ALREADY_COVERED,
  DROP_OFF_RUN,
  joinKidFirstNames,
  NOT_YOUR_JOB_TONIGHT,
  PICKUP_RUN,
  youreDrivingRidersLabel,
} from "@/components/coverageCopy"
import {
  activeCoverages,
  calendarItemKey,
} from "@/components/coverageDisplay"
import { formatSiblingDriveClock } from "@/components/driveBlockAgendaLinks"
import { heroAdultFirstName, heroKidFirstName } from "@/components/heroAttentionCopy"
import { resolveOwnRidePlans } from "@/components/transportPlan"

export type AgendaBlockRunSection = {
  leg: CarpoolLegKind
  /** e.g. "5:40 PM · Drop-off run" */
  heading: string
  /** e.g. "You're driving · 4 riders" */
  chipLabel: string
  /** Always-visible short rider line (kid names). */
  summaryLine: string | null
  /**
   * Non-ADR density (route-ish detail) — starts collapsed; empty until a later
   * task fills stop lists.
   */
  detailLines: string[]
}

export type AgendaBlockEventBand = {
  /** e.g. "6:00–7:00 PM · Practice A" */
  line: string
  itemKey: string
}

export type AgendaBlockMutedBand = {
  heading: typeof NOT_YOUR_JOB_TONIGHT | typeof ALREADY_COVERED
  lines: string[]
}

export type AgendaBlockSections = {
  toRun: AgendaBlockRunSection | null
  eventBands: AgendaBlockEventBand[]
  mutedBand: AgendaBlockMutedBand | null
  fromRun: AgendaBlockRunSection | null
}

export type BuildAgendaBlockSectionsOptions = {
  items: CalendarItem[]
  currentAdultId: string
  kids: readonly Kid[]
  members: readonly FamilyMember[]
  rideEventFor: (item: CalendarItem) => CarpoolRideEvent | null | undefined
}

type OwnedKidLeg = {
  kidId: string
  item: CalendarItem
  leg: CarpoolLegKind
  ownerAdultId: string
  ownerDisplayName: string | null
}

function formatEventBandClock(startsAt: string, endsAt: string | null): string {
  const start = formatSiblingDriveClock(startsAt)
  if (endsAt == null || endsAt === "") {
    return start
  }
  const end = formatSiblingDriveClock(endsAt)
  // Drop duplicate meridian on the start when both clocks share AM/PM.
  const startParts = start.match(/^(.+)\s+(AM|PM)$/i)
  const endParts = end.match(/^(.+)\s+(AM|PM)$/i)
  if (
    startParts != null &&
    endParts != null &&
    startParts[2]!.toUpperCase() === endParts[2]!.toUpperCase()
  ) {
    return `${startParts[1]}–${end}`
  }
  return `${start}–${end}`
}

function collectOwnedKidLegs(
  items: CalendarItem[],
  rideEventFor: BuildAgendaBlockSectionsOptions["rideEventFor"],
): OwnedKidLeg[] {
  const owned: OwnedKidLeg[] = []
  const seen = new Set<string>()

  function push(row: OwnedKidLeg) {
    const key = `${calendarItemKey(row.item)}:${row.leg}:${row.kidId}:${row.ownerAdultId}`
    if (seen.has(key)) {
      return
    }
    seen.add(key)
    owned.push(row)
  }

  for (const item of items) {
    const rideEvent = rideEventFor(item)
    const plans = resolveOwnRidePlans(rideEvent)
    const sawConfirmedLegForKid = new Set<string>()

    for (const plan of plans) {
      for (const leg of plan.legs) {
        if (leg.phase !== "CONFIRMED" || leg.assigneeAdultId == null) {
          continue
        }
        for (const kidId of plan.kidIds) {
          sawConfirmedLegForKid.add(`${kidId}:${leg.kind}`)
          push({
            kidId,
            item,
            leg: leg.kind,
            ownerAdultId: leg.assigneeAdultId,
            ownerDisplayName: leg.assigneeDisplayName,
          })
        }
      }
    }

    // Coverage CONFIRMED without a matching ride leg — treat as TO (matches
    // server drive-block enrichment for space-less feeds).
    for (const coverage of activeCoverages(item)) {
      if (coverage.status !== "CONFIRMED") {
        continue
      }
      for (const kidId of coverage.kidIds) {
        if (sawConfirmedLegForKid.has(`${kidId}:TO`)) {
          continue
        }
        push({
          kidId,
          item,
          leg: "TO",
          ownerAdultId: coverage.coveringAdultId,
          ownerDisplayName: coverage.coveringAdultDisplayName,
        })
      }
    }
  }

  return owned
}

function runClock(
  leg: CarpoolLegKind,
  rows: OwnedKidLeg[],
): string {
  if (leg === "TO") {
    const times = rows.map((row) => row.item.leaveByAt ?? row.item.startsAt)
    times.sort()
    return formatSiblingDriveClock(times[0] ?? rows[0]!.item.startsAt)
  }
  const times = rows.map((row) => row.item.endsAt ?? row.item.startsAt)
  times.sort()
  // Pickup after the earliest ending event the viewer is driving home from.
  return formatSiblingDriveClock(times[0] ?? rows[0]!.item.startsAt)
}

function buildRun(
  leg: CarpoolLegKind,
  rows: OwnedKidLeg[],
  kids: readonly Kid[],
): AgendaBlockRunSection | null {
  if (rows.length === 0) {
    return null
  }
  const uniqueKidIds = [...new Set(rows.map((row) => row.kidId))]
  const names = uniqueKidIds.map((id) => heroKidFirstName(id, kids))
  const runLabel = leg === "TO" ? DROP_OFF_RUN : PICKUP_RUN
  const clock = runClock(leg, rows)
  return {
    leg,
    heading: `${clock} · ${runLabel}`,
    chipLabel: youreDrivingRidersLabel(uniqueKidIds.length),
    summaryLine: names.length > 0 ? joinKidFirstNames(names) : null,
    detailLines: [],
  }
}

function mutedLine(
  row: OwnedKidLeg,
  kids: readonly Kid[],
  members: readonly FamilyMember[],
): string {
  const kid = heroKidFirstName(row.kidId, kids)
  const driver =
    heroAdultFirstName(row.ownerAdultId, members, row.ownerDisplayName) ??
    (row.ownerDisplayName?.trim() || "another parent")
  if (row.leg === "FROM") {
    const when = formatSiblingDriveClock(row.item.endsAt ?? row.item.startsAt)
    return `${kid} → home with ${driver} at ${when}`
  }
  const place = row.item.location?.trim()
  if (place) {
    return `${kid} → ${place} with ${driver}`
  }
  return `${kid} · covered by ${driver}`
}

/**
 * Derives Agenda block card sections from event-shaped calendar + ride data.
 * Order matches the day-block mockup: drop-off → event bands → muted other
 * jobs → pickup.
 */
export function buildAgendaBlockSections(
  options: BuildAgendaBlockSectionsOptions,
): AgendaBlockSections {
  const { items, currentAdultId, kids, members, rideEventFor } = options
  const owned = collectOwnedKidLegs(items, rideEventFor)

  const viewerTo = owned.filter(
    (row) => row.leg === "TO" && row.ownerAdultId === currentAdultId,
  )
  const viewerFrom = owned.filter(
    (row) => row.leg === "FROM" && row.ownerAdultId === currentAdultId,
  )
  const other = owned.filter((row) => row.ownerAdultId !== currentAdultId)

  const eventBands: AgendaBlockEventBand[] = items.map((item) => ({
    itemKey: calendarItemKey(item),
    line: `${formatEventBandClock(item.startsAt, item.endsAt)} · ${item.title}`,
  }))

  const viewerHasRun = viewerTo.length > 0 || viewerFrom.length > 0
  let mutedBand: AgendaBlockMutedBand | null = null
  if (other.length > 0) {
    const lines = other.map((row) => mutedLine(row, kids, members))
    // Dedupe identical lines (siblings same driver/time).
    const uniqueLines = [...new Set(lines)]
    mutedBand = {
      heading: viewerHasRun ? NOT_YOUR_JOB_TONIGHT : ALREADY_COVERED,
      lines: uniqueLines,
    }
  }

  return {
    toRun: buildRun("TO", viewerTo, kids),
    eventBands,
    mutedBand,
    fromRun: buildRun("FROM", viewerFrom, kids),
  }
}
