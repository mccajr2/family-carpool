import type {
  CalendarItem,
  CarpoolRide,
  CarpoolRideEvent,
  CarpoolRideLeg,
  FamilyMember,
  Kid,
} from "@/api/types"
import { activeCoverages, calendarItemKey } from "@/components/coverageDisplay"
import { formatSiblingDriveClock } from "@/components/driveBlockAgendaLinks"
import { formatCompactEventWhen } from "@/components/eventTimes"
import { heroAdultFirstName, heroKidFirstName } from "@/components/heroAttentionCopy"
import { riderInitial } from "@/components/riderChips"
import { goingKidIdsForItem } from "@/components/rsvpDisplay"
import {
  inboundLegOwnedByCircle,
  isBlankTransportPlan,
  orderedTransportLegs,
  ownRidePlanForKid,
  resolveOwnRidePlans,
} from "@/components/transportPlan"

export type CombinedLegFace = {
  /** Short assignee for the collapsed row: "You", "Katy", "Needs ride". */
  who: string
  /** Expanded box value: "You · 5:43 PM" or "Needs ride". */
  detail: string
}

export type CombinedKidRow = {
  key: string
  itemKey: string
  kidId: string
  firstName: string
  initial: string
  /** Feed when teams differ, otherwise the event title. */
  eventLabel: string
  /** Clock span without the date, e.g. "6:00 – 6:50 PM". */
  timeLabel: string
  there: CombinedLegFace
  back: CombinedLegFace
  /** Collapsed right-hand summary: "There You · Back Katy". */
  assignmentLine: string
}

export type CombinedPlanChip = {
  label: string
  tone: "mint" | "route"
}

export type CombinedEventLayout = {
  /** Small-caps line. Null when no member has a feed name. */
  eyebrow: string | null
  /** Same role as a single-event title. */
  title: string
  whenLabel: string
  kidRows: CombinedKidRow[]
  /**
   * One header chip when every leg is assigned.
   * Null when any leg still needs a ride or is asked of the team — callers
   * keep the urgent status chips in that case.
   */
  planChip: CombinedPlanChip | null
}

const NEEDS_RIDE = "Needs ride"
const ASKED_TEAM = "Asked team"

function wordsOf(title: string): string[] {
  return title.trim().split(/\s+/).filter((word) => word.length > 0)
}

function uniqueInOrder(values: readonly string[]): string[] {
  const seen = new Set<string>()
  const ordered: string[] = []
  for (const value of values) {
    if (seen.has(value)) {
      continue
    }
    seen.add(value)
    ordered.push(value)
  }
  return ordered
}

function commonWordPrefix(titles: readonly string[]): string {
  const lists = titles.map(wordsOf)
  const limit = Math.min(...lists.map((list) => list.length))
  const shared: string[] = []
  for (let index = 0; index < limit; index += 1) {
    const word = lists[0]![index]!
    if (lists.every((list) => list[index] === word)) {
      shared.push(word)
    } else {
      break
    }
  }
  if (shared.length === 0 || shared.length >= limit) {
    return ""
  }
  return shared.join(" ")
}

function commonWordSuffix(titles: readonly string[]): string {
  const lists = titles.map(wordsOf)
  const limit = Math.min(...lists.map((list) => list.length))
  const shared: string[] = []
  for (let index = 1; index <= limit; index += 1) {
    const word = lists[0]![lists[0]!.length - index]!
    if (lists.every((list) => list[list.length - index] === word)) {
      shared.unshift(word)
    } else {
      break
    }
  }
  if (shared.length === 0 || shared.length >= limit) {
    return ""
  }
  return shared.join(" ")
}

/**
 * Shared event name for a combined card.
 * Identical titles stay as-is. "CYH Mite 3 Practice" + "CYH Squirt 1 Practice"
 * becomes "CYH Practice". Unrelated titles join with " + ".
 */
export function combinedEventTitle(items: readonly { title: string }[]): string {
  const titles = uniqueInOrder(
    items.map((item) => item.title.trim()).filter((title) => title.length > 0),
  )
  if (titles.length === 0) {
    return "Events"
  }
  if (titles.length === 1) {
    return titles[0]!
  }
  const prefix = commonWordPrefix(titles)
  const suffix = commonWordSuffix(titles)
  if (prefix.length > 0 && suffix.length > 0) {
    const composed = `${prefix} ${suffix}`
    const prefixCount = wordsOf(prefix).length
    const suffixCount = wordsOf(suffix).length
    const overlaps = titles.some(
      (title) => wordsOf(title).length <= prefixCount + suffixCount,
    )
    if (!overlaps && !titles.includes(composed)) {
      return composed
    }
  }
  return titles.join(" + ")
}

/** Feed names in member order, joined when the block mixes teams. */
export function combinedEventEyebrow(
  items: readonly { feedName?: string | null }[],
): string | null {
  const names = uniqueInOrder(
    items
      .map((item) => item.feedName?.trim() || "")
      .filter((name) => name.length > 0),
  )
  if (names.length === 0) {
    return null
  }
  return names.join(" + ")
}

export function combinedEventWhen(
  items: readonly { startsAt: string; endsAt?: string | null }[],
): string {
  if (items.length === 0) {
    return ""
  }
  const sorted = [...items].sort((left, right) =>
    left.startsAt.localeCompare(right.startsAt),
  )
  const start = sorted[0]!.startsAt
  let end = start
  for (const item of items) {
    const candidate =
      item.endsAt != null && item.endsAt.length > 0 ? item.endsAt : item.startsAt
    if (candidate > end) {
      end = candidate
    }
  }
  return formatCompactEventWhen(start, end === start ? null : end)
}

/** Clock span without the date. Shared meridian stays on the end only. */
export function formatClockSpan(
  startsAt: string,
  endsAt: string | null | undefined,
): string {
  const start = formatSiblingDriveClock(startsAt)
  if (endsAt == null || endsAt.length === 0) {
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
    return `${startParts[1]} – ${end}`
  }
  return `${start} – ${end}`
}

export function collapsedAssignmentLine(thereWho: string, backWho: string): string {
  return `There ${thereWho} · Back ${backWho}`
}

function needsRideFace(): CombinedLegFace {
  return { who: NEEDS_RIDE, detail: NEEDS_RIDE }
}

function askedTeamFace(): CombinedLegFace {
  return { who: ASKED_TEAM, detail: ASKED_TEAM }
}

function faceForAdult(
  adultId: string | null | undefined,
  displayName: string | null | undefined,
  clock: string | null,
  currentAdultId: string,
  members: readonly FamilyMember[],
): CombinedLegFace {
  const you = adultId != null && adultId.length > 0 && adultId === currentAdultId
  const who = you
    ? "You"
    : (heroAdultFirstName(adultId, members, displayName) ??
      displayName?.trim().split(/\s+/)[0] ??
      "Assigned")
  return { who, detail: clock != null && clock.length > 0 ? `${who} · ${clock}` : who }
}

function faceFromLeg(
  leg: CarpoolRideLeg | undefined,
  clock: string | null,
  currentAdultId: string,
  members: readonly FamilyMember[],
): CombinedLegFace {
  if (leg == null || leg.phase === "NEEDS_RIDE") {
    return needsRideFace()
  }
  if (leg.phase === "ASKED_TEAM") {
    return askedTeamFace()
  }
  return faceForAdult(
    leg.assigneeAdultId,
    leg.assigneeDisplayName ?? leg.assigneeCircleName,
    clock,
    currentAdultId,
    members,
  )
}

function eventLabelFor(
  item: CalendarItem,
  feedsDiffer: boolean,
  titlesDiffer: boolean,
): string {
  const feed = item.feedName?.trim() || ""
  const title = item.title.trim()
  if (feedsDiffer && feed.length > 0) {
    return feed
  }
  if (titlesDiffer && title.length > 0) {
    return title
  }
  return feed || title || "Event"
}

function kidRow(options: {
  item: CalendarItem
  kidId: string
  firstName: string
  eventLabel: string
  there: CombinedLegFace
  back: CombinedLegFace
}): CombinedKidRow {
  const itemKey = calendarItemKey(options.item)
  return {
    key: `${itemKey}-${options.kidId}`,
    itemKey,
    kidId: options.kidId,
    firstName: options.firstName,
    initial: riderInitial(options.firstName),
    eventLabel: options.eventLabel,
    timeLabel: formatClockSpan(options.item.startsAt, options.item.endsAt),
    there: options.there,
    back: options.back,
    assignmentLine: collapsedAssignmentLine(options.there.who, options.back.who),
  }
}

function legsForKid(options: {
  item: CalendarItem
  kidId: string
  plans: readonly CarpoolRide[]
  currentAdultId: string
  members: readonly FamilyMember[]
}): { there: CombinedLegFace; back: CombinedLegFace } {
  const thereClock = formatSiblingDriveClock(
    options.item.leaveByAt ?? options.item.startsAt,
  )
  const backClock = formatSiblingDriveClock(
    options.item.endsAt ?? options.item.startsAt,
  )
  const plan = ownRidePlanForKid(options.plans, options.kidId)
  if (plan != null && !isBlankTransportPlan(plan.legs)) {
    const to = plan.legs.find((leg) => leg.kind === "TO")
    const from = plan.legs.find((leg) => leg.kind === "FROM")
    return {
      there: faceFromLeg(to, thereClock, options.currentAdultId, options.members),
      back: faceFromLeg(from, backClock, options.currentAdultId, options.members),
    }
  }
  const coverage = activeCoverages(options.item).find((row) =>
    row.kidIds.includes(options.kidId),
  )
  if (coverage != null) {
    const face = (clock: string) =>
      faceForAdult(
        coverage.coveringAdultId,
        coverage.coveringAdultDisplayName,
        clock,
        options.currentAdultId,
        options.members,
      )
    return { there: face(thereClock), back: face(backClock) }
  }
  return { there: needsRideFace(), back: needsRideFace() }
}

function pushInboundRows(options: {
  item: CalendarItem
  rideEvent: CarpoolRideEvent | null | undefined
  circleId: string
  currentAdultId: string
  members: readonly FamilyMember[]
  eventLabel: string
  seen: Set<string>
  rows: CombinedKidRow[]
}) {
  const thereClock = formatSiblingDriveClock(
    options.item.leaveByAt ?? options.item.startsAt,
  )
  const backClock = formatSiblingDriveClock(
    options.item.endsAt ?? options.item.startsAt,
  )
  for (const request of options.rideEvent?.otherRequests ?? []) {
    if (request.status !== "ACCEPTED" || request.acceptingCircleId !== options.circleId) {
      continue
    }
    request.kidIds.forEach((kidId, index) => {
      const itemKey = calendarItemKey(options.item)
      const key = `${itemKey}-${kidId}`
      if (options.seen.has(key)) {
        return
      }
      const rawName = request.kidFirstNames[index]?.trim() || "Rider"
      const firstName = rawName.split(/\s+/)[0] || rawName
      const adultId = request.acceptedByAdultId ?? options.currentAdultId
      const owned = (kind: "TO" | "FROM", clock: string): CombinedLegFace => {
        const leg = orderedTransportLegs(request.legs).find((row) => row.kind === kind)
        if (leg == null || !inboundLegOwnedByCircle(leg, options.circleId)) {
          return leg == null ? needsRideFace() : faceFromLeg(leg, clock, options.currentAdultId, options.members)
        }
        return faceForAdult(
          adultId,
          null,
          clock,
          options.currentAdultId,
          options.members,
        )
      }
      options.seen.add(key)
      options.rows.push(
        kidRow({
          item: options.item,
          kidId,
          firstName,
          eventLabel: options.eventLabel,
          there: owned("TO", thereClock),
          back: owned("FROM", backClock),
        }),
      )
    })
  }
}

const OPEN_LEG = new Set([NEEDS_RIDE, ASKED_TEAM])

export function combinedPlanChip(rows: readonly CombinedKidRow[]): CombinedPlanChip | null {
  const slots = rows.flatMap((row) => [row.there.who, row.back.who])
  if (slots.length === 0 || slots.some((who) => OPEN_LEG.has(who))) {
    return null
  }
  const roundTrip =
    new Set(slots).size === 1 && rows.every((row) => row.there.who === row.back.who)
  if (roundTrip) {
    return { label: `${slots[0]} · round trip`, tone: "mint" }
  }
  const youCount = slots.filter((who) => who === "You").length
  if (youCount > 0) {
    return { label: `You · ${youCount} of ${slots.length} legs`, tone: "route" }
  }
  const counts = new Map<string, number>()
  for (const who of slots) {
    counts.set(who, (counts.get(who) ?? 0) + 1)
  }
  const top = [...counts.entries()].sort((left, right) => right[1] - left[1])[0]
  if (top == null) {
    return null
  }
  return { label: `${top[0]} · ${top[1]} of ${slots.length} legs`, tone: "route" }
}

export function buildCombinedEventLayout(options: {
  items: readonly CalendarItem[]
  currentAdultId: string
  circleId: string
  kids: readonly Kid[]
  members: readonly FamilyMember[]
  rideEventFor: (item: CalendarItem) => CarpoolRideEvent | null | undefined
}): CombinedEventLayout {
  const items = [...options.items].sort((left, right) =>
    left.startsAt.localeCompare(right.startsAt),
  )
  const titles = uniqueInOrder(
    items.map((item) => item.title.trim()).filter((title) => title.length > 0),
  )
  const feeds = uniqueInOrder(
    items
      .map((item) => item.feedName?.trim() || "")
      .filter((name) => name.length > 0),
  )
  const feedsDiffer = feeds.length > 1
  const titlesDiffer = titles.length > 1
  const kidRows: CombinedKidRow[] = []
  const seen = new Set<string>()

  for (const item of items) {
    const rideEvent = options.rideEventFor(item)
    const plans = resolveOwnRidePlans(rideEvent)
    const eventLabel = eventLabelFor(item, feedsDiffer, titlesDiffer)
    for (const kidId of goingKidIdsForItem(item)) {
      const key = `${calendarItemKey(item)}-${kidId}`
      if (seen.has(key)) {
        continue
      }
      seen.add(key)
      const legs = legsForKid({
        item,
        kidId,
        plans,
        currentAdultId: options.currentAdultId,
        members: options.members,
      })
      kidRows.push(
        kidRow({
          item,
          kidId,
          firstName: heroKidFirstName(kidId, options.kids),
          eventLabel,
          there: legs.there,
          back: legs.back,
        }),
      )
    }
    pushInboundRows({
      item,
      rideEvent,
      circleId: options.circleId,
      currentAdultId: options.currentAdultId,
      members: options.members,
      eventLabel,
      seen,
      rows: kidRows,
    })
  }

  return {
    eyebrow: combinedEventEyebrow(items),
    title: combinedEventTitle(items),
    whenLabel: combinedEventWhen(items),
    kidRows,
    planChip: combinedPlanChip(kidRows),
  }
}
