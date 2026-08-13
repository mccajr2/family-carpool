package org.example.project

fun rsvpStatusLabel(status: RsvpStatus): String =
    when (status) {
        RsvpStatus.YES -> "Yes"
        RsvpStatus.NO -> "No"
        RsvpStatus.NO_RESPONSE -> "No response"
    }

fun rsvpStatusForKid(
    item: CalendarItem,
    kidId: String,
): RsvpStatus = item.rsvps.find { it.kidId == kidId }?.status ?: RsvpStatus.NO_RESPONSE

/** Out of play when every kid on the item is RSVP No (includes one-kid No). */
fun isAgendaItemOutOfPlay(item: CalendarItem): Boolean {
    if (item.kidIds.isEmpty()) {
        return false
    }
    return item.kidIds.all { kidId -> rsvpStatusForKid(item, kidId) == RsvpStatus.NO }
}

fun kidHasActiveCoverage(
    item: CalendarItem,
    kidId: String,
): Boolean =
    item.coverages.any { coverage ->
        (
            coverage.status == CoverageStatus.PENDING ||
                coverage.status == CoverageStatus.CONFIRMED
        ) &&
            kidId in coverage.kidIds
    }

fun rsvpCoverageReleaseMessage(kidName: String): String = "This will remove coverage for $kidName."
