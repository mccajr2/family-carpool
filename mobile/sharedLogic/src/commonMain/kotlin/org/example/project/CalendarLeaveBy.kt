package org.example.project

fun calendarRowKey(
    source: CalendarItemSource,
    id: String,
): String = "${source.name}:$id"

/**
 * Cheap list onto a cached row: settled UNAVAILABLE/OK replace; PENDING keeps
 * cached settled leave-by when origin is unchanged (avoid flicker).
 */
fun mergeCheapCalendarItem(
    incoming: CalendarItem,
    cached: CalendarItem?,
): CalendarItem {
    if (incoming.leaveByStatus != LeaveByStatus.PENDING) {
        return incoming
    }
    if (
        cached != null &&
            cached.leaveFromPlaceId == incoming.leaveFromPlaceId &&
            (
                cached.leaveByStatus == LeaveByStatus.OK ||
                    cached.leaveByStatus == LeaveByStatus.UNAVAILABLE
            )
    ) {
        return incoming.copy(
            leaveByAt = cached.leaveByAt,
            leaveByStatus = cached.leaveByStatus,
            leaveByReason = cached.leaveByReason,
        )
    }
    return incoming
}

fun mergeCheapCalendarItems(
    incoming: List<CalendarItem>,
    cached: List<CalendarItem>,
): List<CalendarItem> {
    val byKey = cached.associateBy { calendarRowKey(it.source, it.id) }
    return incoming.map { row ->
        mergeCheapCalendarItem(row, byKey[calendarRowKey(row.source, row.id)])
    }
}

/** Fill-in always overwrites leave-by fields for matching (source, id). */
fun applyLeaveByFillIn(
    items: List<CalendarItem>,
    rows: List<CalendarLeaveBy>,
): List<CalendarItem> {
    val byKey = rows.associateBy { calendarRowKey(it.source, it.id) }
    return items.map { item ->
        val fill = byKey[calendarRowKey(item.source, item.id)] ?: return@map item
        item.copy(
            leaveFromPlaceId = fill.leaveFromPlaceId,
            leaveFromPlaceName = fill.leaveFromPlaceName,
            leaveByAt = fill.leaveByAt,
            leaveByStatus = fill.leaveByStatus,
            leaveByReason = fill.leaveByReason,
        )
    }
}
