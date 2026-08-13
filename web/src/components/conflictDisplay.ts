/** Shared Agenda conflict copy for web (reference) — mobile ports should match. */

import type { CalendarConflict, Kid } from "@/api/types"

export function formatConflictLine(
  conflict: CalendarConflict,
  kids: Kid[] = [],
): string {
  const peer = conflict.otherTitle?.trim() || "another event"
  if (conflict.type === "KID_TIME_OVERLAP") {
    const kidName =
      conflict.kidId != null
        ? kids.find((kid) => kid.id === conflict.kidId)?.displayName
        : null
    if (kidName) {
      return `${kidName} overlaps ${peer}`
    }
    return `Kid schedule overlaps ${peer}`
  }
  const adult =
    conflict.adultDisplayName?.trim() ||
    (conflict.adultId != null ? "This adult" : "Adult")
  return `${adult} also covering ${peer}`
}

/** Stable, de-duplicated lines for Agenda chrome (order preserved). */
export function conflictDisplayLines(
  conflicts: CalendarConflict[] | null | undefined,
  kids: Kid[] = [],
): string[] {
  if (!conflicts || conflicts.length === 0) {
    return []
  }
  const seen = new Set<string>()
  const lines: string[] = []
  for (const conflict of conflicts) {
    const line = formatConflictLine(conflict, kids)
    const key = `${conflict.type}:${conflict.otherSource}:${conflict.otherItemId}:${conflict.kidId ?? ""}:${conflict.adultId ?? ""}`
    if (seen.has(key)) {
      continue
    }
    seen.add(key)
    lines.push(line)
  }
  return lines
}

/** Friendly copy when confirm/self-assign is blocked for double-CONFIRMED. */
export function coverageDoubleBookMessage(serverMessage: string | undefined): string {
  const fallback =
    "Already confirmed on an overlapping event — decline or reassign first."
  if (!serverMessage) {
    return fallback
  }
  if (/overlapping/i.test(serverMessage) && /confirmed/i.test(serverMessage)) {
    return fallback
  }
  return serverMessage
}
