import type {
  CalendarItem,
  CarpoolLegKind,
  CarpoolRideEvent,
  FamilyMember,
  Kid,
} from "@/api/types"
import {
  ALREADY_COVERED,
  NOT_YOUR_JOB_TONIGHT,
  alreadyDrivingRoundTripBanner,
  agendaBlockRunHeading,
  agendaBlockRunSummaryLine,
  mutedOtherJobFromLine,
  mutedOtherJobToLine,
  qualifiedPlaceLabel,
} from "@/components/coverageCopy"
import {
  activeCoverages,
  calendarItemKey,
} from "@/components/coverageDisplay"
import { formatSiblingDriveClock } from "@/components/driveBlockAgendaLinks"
import { heroAdultFirstName, heroKidFirstName } from "@/components/heroAttentionCopy"
import { agendaBlockRunStatusChip } from "@/components/rideStatusChip"
import { resolveOwnRidePlans } from "@/components/transportPlan"

export type AgendaBlockRunSection = {
  leg: CarpoolLegKind
  /** e.g. "5:40 PM · Drop-off run" */
  heading: string
  /** e.g. "You're driving · 4 riders" */
  chipLabel: string
  /** Always-visible short rider line (kid names / direction summary). */
  summaryLine: string | null
  /**
   * Non-ADR density (route-ish detail) — starts collapsed; empty until a later
   * task fills stop lists.
   */
  detailLines: string[]
  /**
   * Earliest event in this leg's combined viewer-owned set — target for
   * single-event "View route" until day-block-route.
   */
  representativeItem: CalendarItem
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
  /** ADR rule 3 — visible when viewer owns TO+FROM for the same kids. */
  roundTripBanner: string | null
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
  /**
   * Kid ids that belong to the viewing adult's household (circle kids).
   * Used to qualify "home" across household boundaries (ADR rule 5).
   */
  viewerHouseholdKidIds?: ReadonlySet<string>
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

function runClock(leg: CarpoolLegKind, rows: OwnedKidLeg[]): string {
  if (leg === "TO") {
    const times = rows.map((row) => row.item.leaveByAt ?? row.item.startsAt)
    times.sort()
    return formatSiblingDriveClock(times[0] ?? rows[0]!.item.startsAt)
  }
  const times = rows.map((row) => row.item.endsAt ?? row.item.startsAt)
  times.sort()
  return formatSiblingDriveClock(times[0] ?? rows[0]!.item.startsAt)
}

function sharedVenue(rows: OwnedKidLeg[]): string | null {
  const locations = rows
    .map((row) => row.item.location?.trim() || null)
    .filter((value): value is string => value != null)
  if (locations.length === 0) {
    return null
  }
  const first = locations[0]!
  return locations.every((value) => value === first) ? first : first
}

function earliestItemInRun(rows: OwnedKidLeg[]): CalendarItem {
  const sorted = [...rows].sort((a, b) =>
    a.item.startsAt.localeCompare(b.item.startsAt),
  )
  return sorted[0]!.item
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
  return {
    leg,
    heading: agendaBlockRunHeading(leg, runClock(leg, rows)),
    chipLabel: agendaBlockRunStatusChip(uniqueKidIds.length).label,
    summaryLine: agendaBlockRunSummaryLine({
      leg,
      kidFirstNames: names,
      venueName: sharedVenue(rows),
    }),
    detailLines: [],
    representativeItem: earliestItemInRun(rows),
  }
}

function mutedLine(
  row: OwnedKidLeg,
  kids: readonly Kid[],
  members: readonly FamilyMember[],
  viewerHouseholdKidIds: ReadonlySet<string>,
): string {
  const kid = heroKidFirstName(row.kidId, kids)
  const driver =
    heroAdultFirstName(row.ownerAdultId, members, row.ownerDisplayName) ??
    (row.ownerDisplayName?.trim() || "another parent")
  if (row.leg === "FROM") {
    const when = formatSiblingDriveClock(row.item.endsAt ?? row.item.startsAt)
    const dropOffLabel = qualifiedPlaceLabel({
      placeName: "Home",
      kidFirstName: kid,
      isViewersHousehold: viewerHouseholdKidIds.has(row.kidId),
    })
    return mutedOtherJobFromLine({
      kidFirstName: kid,
      driverFirstName: driver,
      clockLabel: when,
      dropOffLabel,
    })
  }
  return mutedOtherJobToLine({
    kidFirstName: kid,
    driverFirstName: driver,
    venueName: row.item.location,
  })
}

/**
 * Derives Agenda block card sections from event-shaped calendar + ride data.
 * Copy flows through coverageCopy + rideStatusChip (ADR-0004); no local forks.
 */
export function buildAgendaBlockSections(
  options: BuildAgendaBlockSectionsOptions,
): AgendaBlockSections {
  const { items, currentAdultId, kids, members, rideEventFor } = options
  const viewerHouseholdKidIds =
    options.viewerHouseholdKidIds ?? new Set(kids.map((kid) => kid.id))
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
    const lines = other.map((row) =>
      mutedLine(row, kids, members, viewerHouseholdKidIds),
    )
    mutedBand = {
      heading: viewerHasRun ? NOT_YOUR_JOB_TONIGHT : ALREADY_COVERED,
      lines: [...new Set(lines)],
    }
  }

  const toKidIds = new Set(viewerTo.map((row) => row.kidId))
  const roundTripKidIds = [
    ...new Set(
      viewerFrom.map((row) => row.kidId).filter((kidId) => toKidIds.has(kidId)),
    ),
  ]
  const roundTripBanner =
    roundTripKidIds.length > 0
      ? alreadyDrivingRoundTripBanner(
          roundTripKidIds.map((id) => heroKidFirstName(id, kids)),
        )
      : null

  return {
    roundTripBanner,
    toRun: buildRun("TO", viewerTo, kids),
    eventBands,
    mutedBand,
    fromRun: buildRun("FROM", viewerFrom, kids),
  }
}
