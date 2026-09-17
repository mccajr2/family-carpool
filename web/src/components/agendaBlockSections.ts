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
import {
  isBlankTransportPlan,
  inboundLegOwnedByCircle,
  orderedTransportLegs,
  resolveOwnRidePlans,
} from "@/components/transportPlan"

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
   * Representative event for dual-leg Route entry: earliest member for TO,
   * latest for FROM (pickup after the hang).
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
  /** Viewing adult's circle — required to attribute ACCEPTED inbound asks. */
  circleId: string
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
  /** Inbound / non-circle kid display name when not in `kids`. */
  firstName?: string | null
  /** ACCEPTED otherRequest id when this seat is an added rider. */
  inboundRequestId?: string | null
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
  circleId: string,
  currentAdultId: string,
): OwnedKidLeg[] {
  const owned: OwnedKidLeg[] = []
  const seen = new Set<string>()

  function push(row: OwnedKidLeg) {
    const key = `${calendarItemKey(row.item)}:${row.leg}:${row.kidId}:${row.ownerAdultId}:${row.inboundRequestId ?? "own"}`
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
    /** Kids with a non-blank TO/FROM plan — coverage must not invent missing legs. */
    const kidsWithNonBlankPlan = new Set<string>()

    for (const plan of plans) {
      if (!isBlankTransportPlan(plan.legs)) {
        for (const kidId of plan.kidIds) {
          kidsWithNonBlankPlan.add(kidId)
        }
      }
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

    // Household coverage CONFIRMED is round-trip by default (both legs) when
    // there is no non-blank ride plan for that kid — matching DriverPicker /
    // AgendaRow "You're driving" without a PLAN line.
    for (const coverage of activeCoverages(item)) {
      if (coverage.status !== "CONFIRMED") {
        continue
      }
      for (const kidId of coverage.kidIds) {
        if (kidsWithNonBlankPlan.has(kidId)) {
          continue
        }
        for (const leg of ["TO", "FROM"] as const) {
          if (sawConfirmedLegForKid.has(`${kidId}:${leg}`)) {
            continue
          }
          push({
            kidId,
            item,
            leg,
            ownerAdultId: coverage.coveringAdultId,
            ownerDisplayName: coverage.coveringAdultDisplayName,
          })
        }
      }
    }

    // ACCEPTED inbound asks this circle drives — added riders on the same legs
    // (AgendaRow "You're driving · +n"). Without this, block runs omit Apollo etc.
    for (const request of rideEvent?.otherRequests ?? []) {
      if (request.status !== "ACCEPTED" || request.acceptingCircleId !== circleId) {
        continue
      }
      const ownerAdultId = request.acceptedByAdultId ?? currentAdultId
      for (const leg of orderedTransportLegs(request.legs)) {
        if (!inboundLegOwnedByCircle(leg, circleId)) {
          continue
        }
        request.kidIds.forEach((kidId, index) => {
          const firstName = request.kidFirstNames[index]?.trim() || null
          push({
            kidId,
            item,
            leg: leg.kind,
            ownerAdultId,
            ownerDisplayName: null,
            firstName,
            inboundRequestId: request.id,
          })
        })
      }
    }
  }

  return owned
}

function runClock(leg: CarpoolLegKind, rows: OwnedKidLeg[]): string {
  if (leg === "TO") {
    // Hang departure follows the earliest event — not min(leaveByAt) across
    // members (a later event's leave-by often still assumes leaving home solo).
    const byStart = [...rows].sort((a, b) =>
      a.item.startsAt.localeCompare(b.item.startsAt),
    )
    const first = byStart[0]!
    return formatSiblingDriveClock(first.item.leaveByAt ?? first.item.startsAt)
  }
  // Pickup after the hang: last event end in the combined FROM set.
  const times = rows.map((row) => row.item.endsAt ?? row.item.startsAt)
  times.sort()
  return formatSiblingDriveClock(times[times.length - 1] ?? rows[0]!.item.startsAt)
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

function representativeItemForRun(
  leg: CarpoolLegKind,
  rows: OwnedKidLeg[],
): CalendarItem {
  const sorted = [...rows].sort((a, b) =>
    a.item.startsAt.localeCompare(b.item.startsAt),
  )
  // TO: earliest leave/event. FROM: latest event (pickup after the hang).
  return (leg === "FROM" ? sorted[sorted.length - 1] : sorted[0]!)!.item
}

function riderFirstName(row: OwnedKidLeg, kids: readonly Kid[]): string {
  const fromRequest = row.firstName?.trim()
  if (fromRequest) {
    return fromRequest
  }
  return heroKidFirstName(row.kidId, kids)
}

function buildRun(
  leg: CarpoolLegKind,
  rows: OwnedKidLeg[],
  kids: readonly Kid[],
): AgendaBlockRunSection | null {
  if (rows.length === 0) {
    return null
  }
  const namesByKid = new Map<string, string>()
  for (const row of rows) {
    if (!namesByKid.has(row.kidId)) {
      namesByKid.set(row.kidId, riderFirstName(row, kids))
    }
  }
  const names = [...namesByKid.values()]
  return {
    leg,
    heading: agendaBlockRunHeading(leg, runClock(leg, rows)),
    chipLabel: agendaBlockRunStatusChip(names.length).label,
    summaryLine: agendaBlockRunSummaryLine({
      leg,
      kidFirstNames: names,
      venueName: sharedVenue(rows),
    }),
    detailLines: [],
    representativeItem: representativeItemForRun(leg, rows),
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
  const { items, currentAdultId, circleId, kids, members, rideEventFor } = options
  const viewerHouseholdKidIds =
    options.viewerHouseholdKidIds ?? new Set(kids.map((kid) => kid.id))
  const owned = collectOwnedKidLegs(items, rideEventFor, circleId, currentAdultId)

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
  const nameForKid = (kidId: string): string => {
    const row =
      viewerTo.find((entry) => entry.kidId === kidId) ??
      viewerFrom.find((entry) => entry.kidId === kidId)
    return row != null ? riderFirstName(row, kids) : heroKidFirstName(kidId, kids)
  }
  const roundTripBanner =
    roundTripKidIds.length > 0
      ? alreadyDrivingRoundTripBanner(roundTripKidIds.map(nameForKid))
      : null

  return {
    roundTripBanner,
    toRun: buildRun("TO", viewerTo, kids),
    eventBands,
    mutedBand,
    fromRun: buildRun("FROM", viewerFrom, kids),
  }
}
