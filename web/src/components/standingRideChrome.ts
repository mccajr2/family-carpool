/**
 * Standing series Ask chrome (team Ask for every matching weekday).
 * Eligibility reuses calendar `standingLockEligible` / Lock weekday props
 * (same ForwardRecurrenceGate ≥3 other matches).
 */

import type {
  CalendarItem,
  RecurringFeedFingerprint,
  StandingRideArrangement,
} from "@/api/types"
import type { CoverageGameEvent, QueueItem } from "@/components/coverageQueue"
import { standingWeekdayNames } from "@/components/standingBlockChrome"

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

/** Hero title for an inbound OPEN standing series Ask. */
export function standingInboundAskTitle(
  requestingCircleName: string | null | undefined,
  weekdaySingular: string,
): string {
  const circle =
    requestingCircleName != null && requestingCircleName.trim().length > 0
      ? requestingCircleName.trim()
      : "A family"
  return `${circle} needs a standing ride every ${weekdaySingular}`
}

/** Hero / Agenda caption — Accept once covers the series. */
export function standingInboundAskCaption(weekdayPlural: string): string {
  return `Accept once — you're the fixed primary for future ${weekdayPlural} until they end standing.`
}

/** Agenda list hint when the standing Ask is already in the Hero queue. */
export function standingAskHandleInHeroHint(): string {
  return "Standing Ask — handle in Needs your attention above"
}

/** Agenda / Focus End CTA for the requesting circle. */
export function endStandingAskLabel(weekdayPlural: string): string {
  return `End standing Ask for ${weekdayPlural}`
}

/** Compact Agenda status when this circle's standing Ask is still OPEN. */
export function standingAskOpenOwnStatus(weekdaySingular: string): string {
  return `Standing Ask open — every ${weekdaySingular}`
}

/** Compact Agenda status when this circle is the fixed primary. */
export function standingAskActivePrimaryStatus(weekdayPlural: string): string {
  return `You're the standing primary for ${weekdayPlural}`
}

const WEEKDAY_ENUM: Record<string, RecurringFeedFingerprint["dayOfWeek"]> = {
  sunday: "SUNDAY",
  monday: "MONDAY",
  tuesday: "TUESDAY",
  wednesday: "WEDNESDAY",
  thursday: "THURSDAY",
  friday: "FRIDAY",
  saturday: "SATURDAY",
}

function normalizeLocation(value: string | null | undefined): string {
  return value == null ? "" : value.trim().toLowerCase()
}

/** Local fingerprint parts for a FEED item in the arrangement's IANA zone. */
export function localFingerprintParts(
  isoStartsAt: string,
  timeZone: string,
  location: string | null | undefined,
): Pick<
  RecurringFeedFingerprint,
  "dayOfWeek" | "minuteOfDay" | "normalizedLocation"
> {
  const date = new Date(isoStartsAt)
  const weekdayLong = new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    timeZone,
  }).format(date)
  const dayOfWeek = WEEKDAY_ENUM[weekdayLong.toLowerCase()] ?? "MONDAY"
  const hour = Number(
    new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      hour12: false,
      timeZone,
    }).format(date),
  )
  const minute = Number(
    new Intl.DateTimeFormat("en-US", {
      minute: "numeric",
      timeZone,
    }).format(date),
  )
  // Hour can be "24" in some engines for midnight — normalize.
  const hourNorm = hour === 24 ? 0 : hour
  return {
    dayOfWeek,
    minuteOfDay: hourNorm * 60 + (Number.isFinite(minute) ? minute : 0),
    normalizedLocation: normalizeLocation(location),
  }
}

export function calendarItemMatchesStandingFingerprint(
  item: CalendarItem,
  fingerprint: RecurringFeedFingerprint,
  timeZone: string,
): boolean {
  if (item.source !== "FEED" || item.feedId !== fingerprint.feedId) {
    return false
  }
  const parts = localFingerprintParts(item.startsAt, timeZone, item.location)
  return (
    parts.dayOfWeek === fingerprint.dayOfWeek &&
    parts.minuteOfDay === fingerprint.minuteOfDay &&
    parts.normalizedLocation === fingerprint.normalizedLocation
  )
}

/** Soonest matching FEED occurrence in `items` (by startsAt). */
export function findStandingAskAnchorItem(
  arrangement: StandingRideArrangement,
  items: readonly CalendarItem[],
): CalendarItem | null {
  const matches = items
    .filter((item) =>
      calendarItemMatchesStandingFingerprint(
        item,
        arrangement.fingerprint,
        arrangement.timeZone,
      ),
    )
    .sort(
      (left, right) =>
        Date.parse(left.startsAt) - Date.parse(right.startsAt),
    )
  return matches[0] ?? null
}

export type StandingAskQueuePayload = {
  arrangementId: string
  spaceId: string
  requestingCircleId: string
  requestingCircleName: string | null
  kidFirstNames: string[]
  seats: number
  weekdaySingular: string
  weekdayPlural: string
  passedByMe: boolean
  anchorStartsAt: string
}

/** View payload for Hero queue from an OPEN inbound arrangement + anchor item. */
export function standingAskQueuePayload(
  arrangement: StandingRideArrangement,
  anchor: CalendarItem,
  requestingCircleName: string | null = null,
): StandingAskQueuePayload {
  const weekdays = standingWeekdayNames(anchor.startsAt, arrangement.timeZone)
  return {
    arrangementId: arrangement.id,
    spaceId: arrangement.spaceId,
    requestingCircleId: arrangement.requestingCircleId,
    requestingCircleName,
    kidFirstNames: arrangement.askTemplate.kids.map((kid) => kid.firstName),
    seats: arrangement.askTemplate.kids.length,
    weekdaySingular: weekdays.singular,
    weekdayPlural: weekdays.plural,
    passedByMe: arrangement.passedByMe,
    anchorStartsAt: anchor.startsAt,
  }
}

function syntheticStandingAskGame(
  anchor: CalendarItem,
  _payload: StandingAskQueuePayload,
): CoverageGameEvent {
  const kidId = "standing-ask"
  return {
    id: `${anchor.source}-${anchor.id}:${kidId}`,
    kidId,
    title: anchor.title,
    startsAt: anchor.startsAt,
    order: Date.parse(anchor.startsAt) || 0,
    attendance: "going",
    ownRide: "unassigned",
    requests: [],
  }
}

/**
 * Merge inbound OPEN standing Asks into the attention queue — one item per
 * arrangementId, ordered by anchor startsAt among existing queue items.
 */
export function mergeStandingAsksIntoQueue(
  queue: readonly QueueItem[],
  standingItems: readonly {
    payload: StandingAskQueuePayload
    anchor: CalendarItem
  }[],
): QueueItem[] {
  if (standingItems.length === 0) {
    return [...queue]
  }
  const existingIds = new Set(
    queue
      .filter(
        (item): item is Extract<QueueItem, { kind: "standingAsk" }> =>
          item.kind === "standingAsk",
      )
      .map((item) => item.standingAsk.arrangementId),
  )
  const extras: QueueItem[] = []
  for (const { payload, anchor } of standingItems) {
    if (existingIds.has(payload.arrangementId)) {
      continue
    }
    existingIds.add(payload.arrangementId)
    extras.push({
      kind: "standingAsk",
      game: syntheticStandingAskGame(anchor, payload),
      standingAsk: payload,
    })
  }
  if (extras.length === 0) {
    return [...queue]
  }
  return [...queue, ...extras].sort(
    (left, right) => left.game.order - right.game.order,
  )
}

/** Arrangements visible as inbound OPEN Asks for this circle. */
export function inboundOpenStandingArrangements(
  arrangements: readonly StandingRideArrangement[],
  viewerCircleId: string,
): StandingRideArrangement[] {
  return arrangements.filter(
    (row) =>
      row.status === "OPEN" &&
      row.requestingCircleId !== viewerCircleId &&
      !row.passedByMe,
  )
}

/** Own OPEN or ACTIVE arrangements (End chrome). */
export function ownStandingArrangementsForEnd(
  arrangements: readonly StandingRideArrangement[],
  viewerCircleId: string,
): StandingRideArrangement[] {
  return arrangements.filter(
    (row) =>
      row.requestingCircleId === viewerCircleId &&
      (row.status === "OPEN" || row.status === "ACTIVE"),
  )
}

/**
 * While this circle has an OPEN standing Ask, suppress ownRide Hero gaps for
 * matching FEED weeks — the series Ask is already the decision. After expire
 * (ENDED), gaps return as the calm one-off path.
 */
export function ownOpenStandingCoversCalendarItem(
  item: CalendarItem,
  arrangements: readonly StandingRideArrangement[],
  viewerCircleId: string,
): boolean {
  return arrangements.some(
    (row) =>
      row.requestingCircleId === viewerCircleId &&
      row.status === "OPEN" &&
      calendarItemMatchesStandingFingerprint(
        item,
        row.fingerprint,
        row.timeZone,
      ),
  )
}

export type StandingRideAgendaChrome = {
  arrangementId: string
  weekdaySingular: string
  weekdayPlural: string
  /** Inbound OPEN Ask for another circle — hand off to Hero when queued. */
  inboundOpen: boolean
  /** This circle requested; still OPEN. */
  ownOpen: boolean
  /** This circle requested; ACTIVE (End still available). */
  ownActive: boolean
  /** This circle is the fixed primary. */
  primaryActive: boolean
}

/** Agenda / Focus chrome for a calendar row under a standing arrangement. */
export function standingRideAgendaChromeForItem(
  item: CalendarItem,
  arrangements: readonly StandingRideArrangement[],
  viewerCircleId: string,
): StandingRideAgendaChrome | null {
  for (const row of arrangements) {
    if (
      !calendarItemMatchesStandingFingerprint(
        item,
        row.fingerprint,
        row.timeZone,
      )
    ) {
      continue
    }
    const weekdays = standingWeekdayNames(item.startsAt, row.timeZone)
    if (row.status === "OPEN" && row.requestingCircleId !== viewerCircleId) {
      if (row.passedByMe) {
        continue
      }
      return {
        arrangementId: row.id,
        weekdaySingular: weekdays.singular,
        weekdayPlural: weekdays.plural,
        inboundOpen: true,
        ownOpen: false,
        ownActive: false,
        primaryActive: false,
      }
    }
    if (
      row.requestingCircleId === viewerCircleId &&
      (row.status === "OPEN" || row.status === "ACTIVE")
    ) {
      return {
        arrangementId: row.id,
        weekdaySingular: weekdays.singular,
        weekdayPlural: weekdays.plural,
        inboundOpen: false,
        ownOpen: row.status === "OPEN",
        ownActive: row.status === "ACTIVE",
        primaryActive: false,
      }
    }
    if (
      row.status === "ACTIVE" &&
      row.primaryCircleId === viewerCircleId &&
      row.requestingCircleId !== viewerCircleId
    ) {
      return {
        arrangementId: row.id,
        weekdaySingular: weekdays.singular,
        weekdayPlural: weekdays.plural,
        inboundOpen: false,
        ownOpen: false,
        ownActive: false,
        primaryActive: true,
      }
    }
  }
  return null
}

/** Build Hero merge inputs for inbound OPEN standing Asks with a FEED anchor. */
export function standingAskHeroMergeItems(
  arrangements: readonly StandingRideArrangement[],
  calendarItems: readonly CalendarItem[],
  viewerCircleId: string,
  requestingCircleNameFor: (
    requestingCircleId: string,
  ) => string | null = () => null,
): { payload: StandingAskQueuePayload; anchor: CalendarItem }[] {
  const out: { payload: StandingAskQueuePayload; anchor: CalendarItem }[] = []
  for (const arrangement of inboundOpenStandingArrangements(
    arrangements,
    viewerCircleId,
  )) {
    const anchor = findStandingAskAnchorItem(arrangement, calendarItems)
    if (anchor == null) {
      continue
    }
    out.push({
      payload: standingAskQueuePayload(
        arrangement,
        anchor,
        requestingCircleNameFor(arrangement.requestingCircleId),
      ),
      anchor,
    })
  }
  return out
}
