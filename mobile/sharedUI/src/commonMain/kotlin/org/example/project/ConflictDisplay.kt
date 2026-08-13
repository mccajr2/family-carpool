package org.example.project

/** Shared Agenda conflict copy — match web `conflictDisplay.ts`. */

fun formatConflictLine(
    conflict: CalendarConflict,
    kids: List<Kid> = emptyList(),
): String {
    val peer = conflict.otherTitle.trim().ifEmpty { "another event" }
    return when (conflict.type) {
        CalendarConflictType.KID_TIME_OVERLAP -> {
            val kidName =
                conflict.kidId
                    ?.let { id -> kids.find { it.id == id }?.displayName }
                    ?.trim()
                    ?.takeIf { it.isNotEmpty() }
            if (kidName != null) {
                "$kidName overlaps $peer"
            } else {
                "Kid schedule overlaps $peer"
            }
        }
        CalendarConflictType.ADULT_COVERAGE_OVERLAP -> {
            val adult =
                conflict.adultDisplayName?.trim()?.takeIf { it.isNotEmpty() }
                    ?: if (conflict.adultId != null) "This adult" else "Adult"
            "$adult also covering $peer"
        }
    }
}

fun conflictDisplayLines(
    conflicts: List<CalendarConflict>?,
    kids: List<Kid> = emptyList(),
): List<String> {
    if (conflicts.isNullOrEmpty()) return emptyList()
    val seen = linkedSetOf<String>()
    val lines = mutableListOf<String>()
    for (conflict in conflicts) {
        val key =
            "${conflict.type}:${conflict.otherSource}:${conflict.otherItemId}:" +
                "${conflict.kidId.orEmpty()}:${conflict.adultId.orEmpty()}"
        if (!seen.add(key)) continue
        lines.add(formatConflictLine(conflict, kids))
    }
    return lines
}

fun coverageDoubleBookMessage(serverMessage: String?): String {
    val fallback =
        "Already confirmed on an overlapping event — decline or reassign first."
    if (serverMessage.isNullOrBlank()) return fallback
    val lower = serverMessage.lowercase()
    if ("overlapping" in lower && "confirmed" in lower) {
        return fallback
    }
    return serverMessage
}
