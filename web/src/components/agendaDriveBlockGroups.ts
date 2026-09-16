import type { CalendarItem } from "@/api/types"
import { calendarItemKey } from "@/components/coverageDisplay"

export type AgendaDayListSingleton = {
  kind: "singleton"
  item: CalendarItem
}

export type AgendaDayListBlock = {
  kind: "block"
  /** Chronological members (by startsAt, then id). Always length ≥ 2. */
  items: CalendarItem[]
}

export type AgendaDayListEntry = AgendaDayListSingleton | AgendaDayListBlock

/**
 * Stable key for a multi-item Agenda block entry (joined calendar item keys).
 */
export function agendaDriveBlockEntryKey(items: CalendarItem[]): string {
  return items.map(calendarItemKey).join("|")
}

/**
 * Groups day-list items into driving blocks using `driveBlockLinks` with
 * `combined: true` (auto- or FORCE-merge adjacency). Transitive chains
 * (A↔B↔C) collapse to one block. `combined: false` links are ignored for
 * grouping. Members missing from `items` (e.g. kid filter) do not pull
 * absent siblings in — only co-present items merge.
 *
 * Multi-item components become `{ kind: "block" }`; everything else stays
 * `{ kind: "singleton" }` so one-item / non-combined rows keep AgendaRow.
 * Order follows the input list (first occurrence of each component).
 */
export function groupAgendaItemsByDriveBlock(
  items: CalendarItem[],
): AgendaDayListEntry[] {
  if (items.length === 0) {
    return []
  }

  const byKey = new Map<string, CalendarItem>()
  for (const item of items) {
    byKey.set(calendarItemKey(item), item)
  }

  const parent = new Map<string, string>()
  for (const key of byKey.keys()) {
    parent.set(key, key)
  }

  function find(key: string): string {
    let root = key
    while (parent.get(root) !== root) {
      root = parent.get(root)!
    }
    let walk = key
    while (walk !== root) {
      const next = parent.get(walk)!
      parent.set(walk, root)
      walk = next
    }
    return root
  }

  function union(a: string, b: string) {
    const ra = find(a)
    const rb = find(b)
    if (ra !== rb) {
      parent.set(ra, rb)
    }
  }

  for (const item of items) {
    const selfKey = calendarItemKey(item)
    for (const link of item.driveBlockLinks) {
      if (!link.combined) {
        continue
      }
      const otherKey = `${link.otherSource}-${link.otherId}`
      if (!byKey.has(otherKey)) {
        continue
      }
      union(selfKey, otherKey)
    }
  }

  const membersByRoot = new Map<string, CalendarItem[]>()
  for (const item of items) {
    const root = find(calendarItemKey(item))
    const bucket = membersByRoot.get(root)
    if (bucket != null) {
      bucket.push(item)
    } else {
      membersByRoot.set(root, [item])
    }
  }

  for (const members of membersByRoot.values()) {
    members.sort((a, b) => {
      const byStart = a.startsAt.localeCompare(b.startsAt)
      if (byStart !== 0) {
        return byStart
      }
      return a.id.localeCompare(b.id)
    })
  }

  const emitted = new Set<string>()
  const entries: AgendaDayListEntry[] = []
  for (const item of items) {
    const root = find(calendarItemKey(item))
    if (emitted.has(root)) {
      continue
    }
    emitted.add(root)
    const members = membersByRoot.get(root) ?? [item]
    if (members.length >= 2) {
      entries.push({ kind: "block", items: members })
    } else {
      entries.push({ kind: "singleton", item: members[0]! })
    }
  }
  return entries
}
