package org.example.project

import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone

/** Time-only label for leave-by (device timezone). */
fun formatLeaveByTime(iso: String): String {
    val millis = parseIsoToEpochMillis(iso) ?: return iso
    val formatter =
        SimpleDateFormat("h:mm a", Locale.getDefault()).apply {
            timeZone = TimeZone.getDefault()
        }
    return formatter.format(Date(millis))
}

/** e.g. "Leave by ~3:40 PM · estimate" — never live traffic / ETA. */
fun formatLeaveByEstimateLine(leaveByAtIso: String): String =
    "Leave by ~${formatLeaveByTime(leaveByAtIso)} · estimate"

/** Short human reason when leaveByStatus is UNAVAILABLE. */
fun leaveByUnavailableLabel(reason: String?): String =
    when (reason) {
        "NO_ORIGIN" -> "No leave-from place yet"
        "NO_DESTINATION" -> "Add a location to estimate leave-by"
        "GEOCODE_FAILED" -> "Couldn't locate the destination"
        else -> "Leave-by estimate unavailable"
    }

fun leaveByAgendaLine(item: CalendarItem): String =
    if (item.leaveByStatus == LeaveByStatus.OK && !item.leaveByAt.isNullOrBlank()) {
        formatLeaveByEstimateLine(item.leaveByAt!!)
    } else {
        leaveByUnavailableLabel(item.leaveByReason)
    }
