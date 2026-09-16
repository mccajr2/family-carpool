import type {
  CalendarDriveBlockLink,
  CalendarItem,
  CalendarItemSource,
  DriveBlockOverrideAction,
} from "@/api/types"

/** Local clock for sibling event start in Agenda drive-block copy. */
export function formatSiblingDriveClock(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) {
    return iso
  }
  return date.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  })
}

/**
 * Names the sibling event + its start clock so the control aligns with an
 * Agenda row, not a leave-by estimate.
 */
export function driveBlockLinkLabel(link: CalendarDriveBlockLink): string {
  const clock = formatSiblingDriveClock(link.otherStartsAt)
  const title = link.otherTitle.trim() || "drive"
  if (link.combined) {
    return `Combined with ${title} · ${clock} · Split this out`
  }
  return `Split from ${title} · ${clock} · Combine these`
}

export type DriveBlockOrderedPair = {
  leg: CalendarDriveBlockLink["leg"]
  leftSource: CalendarItemSource
  leftItemId: string
  rightSource: CalendarItemSource
  rightItemId: string
}

export type DriveBlockWrite =
  | (DriveBlockOrderedPair & { kind: "set"; action: DriveBlockOverrideAction })
  | (DriveBlockOrderedPair & { kind: "clear" })

export function orderedDriveBlockPair(
  item: Pick<CalendarItem, "id" | "source" | "startsAt">,
  link: CalendarDriveBlockLink,
): DriveBlockOrderedPair {
  const itemFirst =
    item.startsAt < link.otherStartsAt ||
    (item.startsAt === link.otherStartsAt && item.id <= link.otherId)
  if (itemFirst) {
    return {
      leg: link.leg,
      leftSource: item.source,
      leftItemId: item.id,
      rightSource: link.otherSource,
      rightItemId: link.otherId,
    }
  }
  return {
    leg: link.leg,
    leftSource: link.otherSource,
    leftItemId: link.otherId,
    rightSource: item.source,
    rightItemId: item.id,
  }
}

/**
 * Combined + FORCE_MERGE → clear; combined + auto → FORCE_SPLIT.
 * Split + FORCE_SPLIT → clear; split + auto → FORCE_MERGE.
 */
export function driveBlockWriteForClick(
  item: Pick<CalendarItem, "id" | "source" | "startsAt">,
  link: CalendarDriveBlockLink,
): DriveBlockWrite {
  const pair = orderedDriveBlockPair(item, link)
  if (link.combined) {
    if (link.overrideAction === "FORCE_MERGE") {
      return { kind: "clear", ...pair }
    }
    return { kind: "set", action: "FORCE_SPLIT", ...pair }
  }
  if (link.overrideAction === "FORCE_SPLIT") {
    return { kind: "clear", ...pair }
  }
  return { kind: "set", action: "FORCE_MERGE", ...pair }
}
