/** Shared Agenda conflict copy for web (reference) — mobile ports should match. */

import type { CalendarConflict, Kid } from "@/api/types"

export type ConflictLineTone = "attention" | "family"

export type ConflictDisplayLine = {
  text: string
  tone: ConflictLineTone
}

/** Kid/adult overlaps keep amber weight; family-only is quieter. */
export function isAttentionConflictType(
  type: CalendarConflict["type"],
): boolean {
  return type === "KID_TIME_OVERLAP" || type === "ADULT_COVERAGE_OVERLAP"
}

export function hasAttentionConflicts(
  conflicts: CalendarConflict[] | null | undefined,
): boolean {
  return Boolean(conflicts?.some((c) => isAttentionConflictType(c.type)))
}

/** True when there is at least one conflict and every conflict is family. */
export function isFamilyOnlyConflicts(
  conflicts: CalendarConflict[] | null | undefined,
): boolean {
  if (!conflicts || conflicts.length === 0) {
    return false
  }
  return conflicts.every((c) => c.type === "FAMILY_TIME_OVERLAP")
}

function kidName(kids: Kid[], kidId: string | null): string | null {
  if (kidId == null) {
    return null
  }
  return kids.find((kid) => kid.id === kidId)?.displayName?.trim() || null
}

export function formatConflictLine(
  conflict: CalendarConflict,
  kids: Kid[] = [],
): string {
  const peer = conflict.otherTitle?.trim() || "another event"
  if (conflict.type === "FAMILY_TIME_OVERLAP") {
    const local = kidName(kids, conflict.kidId)
    const peerKid = kidName(kids, conflict.otherKidId)
    if (local && peerKid) {
      return `${local} overlaps ${peerKid}'s ${peer}`
    }
    if (local) {
      return `${local} overlaps ${peer}`
    }
    if (peerKid) {
      return `Kid overlaps ${peerKid}'s ${peer}`
    }
    return `Kid schedule overlaps ${peer}`
  }
  if (conflict.type === "KID_TIME_OVERLAP") {
    const name = kidName(kids, conflict.kidId)
    if (name) {
      return `${name} overlaps ${peer}`
    }
    return `Kid schedule overlaps ${peer}`
  }
  const adult =
    conflict.adultDisplayName?.trim() ||
    (conflict.adultId != null ? "This adult" : "Adult")
  return `${adult} also covering ${peer}`
}

function conflictLineTone(conflict: CalendarConflict): ConflictLineTone {
  return conflict.type === "FAMILY_TIME_OVERLAP" ? "family" : "attention"
}

/** Stable, de-duplicated lines for Agenda chrome (order preserved). */
export function conflictDisplayLines(
  conflicts: CalendarConflict[] | null | undefined,
  kids: Kid[] = [],
): ConflictDisplayLine[] {
  if (!conflicts || conflicts.length === 0) {
    return []
  }
  const seen = new Set<string>()
  const lines: ConflictDisplayLine[] = []
  for (const conflict of conflicts) {
    const text = formatConflictLine(conflict, kids)
    const key = `${conflict.type}:${conflict.otherSource}:${conflict.otherItemId}:${conflict.kidId ?? ""}:${conflict.otherKidId ?? ""}:${conflict.adultId ?? ""}`
    if (seen.has(key)) {
      continue
    }
    seen.add(key)
    lines.push({ text, tone: conflictLineTone(conflict) })
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
