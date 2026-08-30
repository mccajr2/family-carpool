import type { CalendarItem, CarpoolRide } from "@/api/types"
import { agendaItemNeedsAttention } from "@/components/coverageDisplay"
import { isAgendaItemOutOfPlay } from "@/components/rsvpDisplay"

export type AgendaDayGroup = {
  /** "Today" | "Tomorrow" | "This week" | "Later" */
  label: string
  /** e.g. "Aug 14" — present on every group except "Today" */
  dateLabel?: string
  items: CalendarItem[]
}

/** All-caps Agenda list section chrome (Feeds-aligned labels). */
export const AGENDA_LIST_SECTION_LABEL = {
  needsAttention: "NEEDS YOUR ATTENTION",
  restOfToday: "REST OF TODAY",
  tomorrow: "TOMORROW",
  thisWeek: "THIS WEEK",
  later: "LATER",
} as const

export type AgendaListSectionLabel =
  (typeof AGENDA_LIST_SECTION_LABEL)[keyof typeof AGENDA_LIST_SECTION_LABEL]

export type AgendaListSection = {
  label: AgendaListSectionLabel
  /** e.g. "Aug 16" — optional secondary on TOMORROW */
  dateLabel?: string
  items: CalendarItem[]
}

export type AgendaListGrouping = {
  /**
   * When true, the hero carousel floats above all list sections (no duplicate
   * NEEDS YOUR ATTENTION header in the flat list).
   */
  floatFocusAbove: boolean
  sections: AgendaListSection[]
}

/** Today / Tomorrow / This week (days 3–6) / Later — matches groupAgendaByDay buckets. */
export type AgendaDayBucket = "today" | "tomorrow" | "this-week" | "later"

/** Local calendar days in the hero carousel and week-at-a-glance strip (today + next 6). */
export const AGENDA_NEAR_TERM_DAYS = 7

export type AgendaDayBoundaries = {
  todayStart: Date
  tomorrowStart: Date
  dayAfterTomorrowStart: Date
  weekEnd: Date
}

export function startOfLocalDay(d: Date): Date {
  const s = new Date(d)
  s.setHours(0, 0, 0, 0)
  return s
}

export function addDays(d: Date, days: number): Date {
  const next = new Date(d)
  next.setDate(next.getDate() + days)
  return next
}

export function agendaDayBoundaries(now: Date = new Date()): AgendaDayBoundaries {
  const todayStart = startOfLocalDay(now)
  return {
    todayStart,
    tomorrowStart: addDays(todayStart, 1),
    dayAfterTomorrowStart: addDays(todayStart, 2),
    weekEnd: addDays(todayStart, AGENDA_NEAR_TERM_DAYS),
  }
}

/**
 * Classifies a start time into the same day bucket used by `groupAgendaByDay`.
 * Unparseable dates return `"later"` (same as grouping).
 */
export function agendaDayBucketForStartsAt(
  startsAt: string | Date,
  now: Date = new Date(),
): AgendaDayBucket {
  const start = typeof startsAt === "string" ? new Date(startsAt) : startsAt
  if (Number.isNaN(start.getTime())) {
    return "later"
  }
  const { tomorrowStart, dayAfterTomorrowStart, weekEnd } = agendaDayBoundaries(now)
  if (start < tomorrowStart) {
    return "today"
  }
  if (start < dayAfterTomorrowStart) {
    return "tomorrow"
  }
  if (start < weekEnd) {
    return "this-week"
  }
  return "later"
}

function compactDateLabel(d: Date): string {
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" })
}

/**
 * Groups already-sorted-by-startsAt agenda items into Today / Tomorrow /
 * This week / Later buckets, using the viewer's local calendar day — not UTC
 * day boundaries, so "today" matches what the person actually sees on a
 * clock. Empty buckets are omitted entirely (no "This week" header with
 * nothing under it).
 */
export function groupAgendaByDay(
  items: CalendarItem[],
  now: Date = new Date(),
): AgendaDayGroup[] {
  const { tomorrowStart } = agendaDayBoundaries(now)

  const buckets: AgendaDayGroup[] = [
    { label: "Today", items: [] },
    { label: "Tomorrow", dateLabel: compactDateLabel(tomorrowStart), items: [] },
    { label: "This week", items: [] },
    { label: "Later", items: [] },
  ]

  for (const item of items) {
    const bucket = agendaDayBucketForStartsAt(item.startsAt, now)
    if (bucket === "today") {
      buckets[0].items.push(item)
    } else if (bucket === "tomorrow") {
      buckets[1].items.push(item)
    } else if (bucket === "this-week") {
      buckets[2].items.push(item)
    } else {
      buckets[3].items.push(item)
    }
  }

  return buckets.filter((b) => b.items.length > 0)
}

export type GroupAgendaListSectionsOptions = {
  now?: Date
  currentAdultId: string
  /** True when the hero carousel has queue slides (carousel owns NEEDS YOUR ATTENTION). */
  queueHasItems: boolean
  ownRequestFor?: (item: CalendarItem) => CarpoolRide | null | undefined
}

/**
 * Agenda list sections for Calendar: NEEDS YOUR ATTENTION / REST OF TODAY /
 * TOMORROW / THIS WEEK / LATER. Pass the full in-window calendar set (same
 * items as the hero carousel — queue rows are not excluded). Empty sections
 * omitted. When `queueHasItems`, the carousel owns NEEDS YOUR ATTENTION chrome
 * and today attention rows stay under REST OF TODAY in chronological order.
 */
export function groupAgendaListSections(
  items: CalendarItem[],
  options: GroupAgendaListSectionsOptions,
): AgendaListGrouping {
  const now = options.now ?? new Date()
  const ownRequestFor = options.ownRequestFor ?? (() => null)
  const { tomorrowStart } = agendaDayBoundaries(now)

  const today: CalendarItem[] = []
  const tomorrow: CalendarItem[] = []
  const thisWeek: CalendarItem[] = []
  const later: CalendarItem[] = []

  for (const item of items) {
    const bucket = agendaDayBucketForStartsAt(item.startsAt, now)
    if (bucket === "today") {
      today.push(item)
    } else if (bucket === "tomorrow") {
      tomorrow.push(item)
    } else if (bucket === "this-week") {
      thisWeek.push(item)
    } else {
      later.push(item)
    }
  }

  const needsAttentionItems: CalendarItem[] = []
  const restOfTodayItems: CalendarItem[] = []
  for (const item of today) {
    const outOfPlay = isAgendaItemOutOfPlay(item)
    if (
      agendaItemNeedsAttention(
        item,
        options.currentAdultId,
        outOfPlay,
        ownRequestFor(item),
      )
    ) {
      if (options.queueHasItems) {
        restOfTodayItems.push(item)
      } else {
        needsAttentionItems.push(item)
      }
    } else {
      restOfTodayItems.push(item)
    }
  }

  const sections: AgendaListSection[] = []
  if (!options.queueHasItems && needsAttentionItems.length > 0) {
    sections.push({
      label: AGENDA_LIST_SECTION_LABEL.needsAttention,
      items: needsAttentionItems,
    })
  }
  if (restOfTodayItems.length > 0) {
    sections.push({
      label: AGENDA_LIST_SECTION_LABEL.restOfToday,
      items: restOfTodayItems,
    })
  }
  if (tomorrow.length > 0) {
    sections.push({
      label: AGENDA_LIST_SECTION_LABEL.tomorrow,
      dateLabel: compactDateLabel(tomorrowStart),
      items: tomorrow,
    })
  }
  if (thisWeek.length > 0) {
    sections.push({
      label: AGENDA_LIST_SECTION_LABEL.thisWeek,
      items: thisWeek,
    })
  }
  if (later.length > 0) {
    sections.push({
      label: AGENDA_LIST_SECTION_LABEL.later,
      items: later,
    })
  }

  return {
    floatFocusAbove: options.queueHasItems,
    sections,
  }
}
