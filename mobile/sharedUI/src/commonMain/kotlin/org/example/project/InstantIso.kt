package org.example.project

import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Date
import java.util.Locale
import java.util.TimeZone
import kotlin.time.Clock
import kotlin.time.Instant

/** Current UTC instant as ISO-8601 for API payloads. */
fun nowIsoUtc(): String = Clock.System.now().toString()

fun nowEpochMillis(): Long = Clock.System.now().toEpochMilliseconds()

/** Default start for a new event: 15 minutes from now (avoids immediate "in the past"). */
fun defaultNewEventStartsAtIso(): String =
    epochMillisToIsoUtc(nowEpochMillis() + 15 * 60 * 1000L)

/** Parse an ISO-8601 instant to epoch millis, or null if unparseable. */
fun parseIsoToEpochMillis(iso: String): Long? {
    val trimmed = iso.trim()
    if (trimmed.isEmpty()) return null
    return runCatching { Instant.parse(trimmed).toEpochMilliseconds() }.getOrNull()
}

/**
 * Client-side rules for manual event times (mirrors server endsAt ≥ startsAt,
 * and blocks past datetimes before the request is sent).
 *
 * @return human-readable error, or null when valid
 */
fun validateManualEventTimes(
    startsAtIso: String,
    endsAtIso: String?,
    nowMillis: Long = nowEpochMillis(),
): String? {
    val starts =
        parseIsoToEpochMillis(startsAtIso) ?: return "Start time is invalid"
    if (starts < nowMillis) {
        return "Start must be in the future"
    }
    val endsTrimmed = endsAtIso?.trim().orEmpty()
    if (endsTrimmed.isEmpty()) {
        return null
    }
    val ends = parseIsoToEpochMillis(endsTrimmed) ?: return "End time is invalid"
    if (ends < starts) {
        return "End must be on or after start"
    }
    return null
}

/** Format epoch millis as an ISO-8601 UTC instant string. */
fun epochMillisToIsoUtc(millis: Long): String =
    Instant.fromEpochMilliseconds(millis).toString()

/**
 * Local-friendly label for an ISO instant (device timezone).
 * Falls back to the raw string if parsing fails.
 */
fun formatIsoForDisplay(iso: String): String {
    val millis = parseIsoToEpochMillis(iso) ?: return iso
    val formatter =
        SimpleDateFormat("EEE, MMM d · h:mm a", Locale.getDefault()).apply {
            timeZone = TimeZone.getDefault()
        }
    return formatter.format(Date(millis))
}

fun formatEventWhen(startsAt: String, endsAt: String?): String {
    val start = formatIsoForDisplay(startsAt)
    val endsTrimmed = endsAt?.trim().orEmpty()
    if (endsTrimmed.isEmpty()) {
        return start
    }
    return "$start → ${formatIsoForDisplay(endsTrimmed)}"
}

/** Default agenda page size in local calendar days. */
const val CALENDAR_PAGE_DAYS = 30

/** Near-term leave-by fill-in: local today through +2 calendar days. */
const val LEAVE_BY_NEAR_TERM_DAYS = 2

/** Default agenda window: local start-of-today → +30 days, as UTC ISO instants. */
data class CalendarWindow(
    val from: String,
    val to: String,
)

fun defaultCalendarWindow(nowMillis: Long = nowEpochMillis()): CalendarWindow {
    val start =
        Calendar.getInstance().apply {
            timeInMillis = nowMillis
            set(Calendar.HOUR_OF_DAY, 0)
            set(Calendar.MINUTE, 0)
            set(Calendar.SECOND, 0)
            set(Calendar.MILLISECOND, 0)
        }
    return advanceCalendarWindow(epochMillisToIsoUtc(start.timeInMillis), CALENDAR_PAGE_DAYS)
}

fun advanceCalendarWindow(
    fromIso: String,
    days: Int = CALENDAR_PAGE_DAYS,
): CalendarWindow {
    val fromMillis = parseIsoToEpochMillis(fromIso) ?: nowEpochMillis()
    val from =
        Calendar.getInstance().apply {
            timeInMillis = fromMillis
        }
    val to =
        Calendar.getInstance().apply {
            timeInMillis = from.timeInMillis
            add(Calendar.DAY_OF_MONTH, days)
        }
    return CalendarWindow(
        from = epochMillisToIsoUtc(from.timeInMillis),
        to = epochMillisToIsoUtc(to.timeInMillis),
    )
}

fun calendarWindowThrough(
    loadedToIso: String,
    nowMillis: Long = nowEpochMillis(),
): CalendarWindow {
    val start =
        Calendar.getInstance().apply {
            timeInMillis = nowMillis
            set(Calendar.HOUR_OF_DAY, 0)
            set(Calendar.MINUTE, 0)
            set(Calendar.SECOND, 0)
            set(Calendar.MILLISECOND, 0)
        }
    return CalendarWindow(
        from = epochMillisToIsoUtc(start.timeInMillis),
        to = loadedToIso,
    )
}

private fun laterIso(
    a: String,
    b: String,
): String = if (a >= b) a else b

private fun earlierIso(
    a: String,
    b: String,
): String = if (a <= b) a else b

fun intersectIsoWindows(
    a: CalendarWindow,
    b: CalendarWindow,
): CalendarWindow? {
    val from = laterIso(a.from, b.from)
    val to = earlierIso(a.to, b.to)
    if (from >= to) return null
    return CalendarWindow(from = from, to = to)
}

/** `[localTodayStart, localTodayStart + 2d)` ∩ loaded window. */
fun nearTermLeaveByWindow(
    loadedFromIso: String,
    loadedToIso: String,
    nowMillis: Long = nowEpochMillis(),
): CalendarWindow? {
    val near =
        advanceCalendarWindow(defaultCalendarWindow(nowMillis).from, LEAVE_BY_NEAR_TERM_DAYS)
    return intersectIsoWindows(near, CalendarWindow(loadedFromIso, loadedToIso))
}

/** Remainder of the loaded window after the near-term slice. */
fun remainderAfterNearTermLeaveByWindow(
    loadedFromIso: String,
    loadedToIso: String,
    nowMillis: Long = nowEpochMillis(),
): CalendarWindow? {
    val near =
        advanceCalendarWindow(defaultCalendarWindow(nowMillis).from, LEAVE_BY_NEAR_TERM_DAYS)
    val from = laterIso(loadedFromIso, near.to)
    if (from >= loadedToIso) return null
    return CalendarWindow(from = from, to = loadedToIso)
}

fun ensureCalendarWindowCovers(
    loadedToIso: String,
    instantIso: String,
    days: Int = CALENDAR_PAGE_DAYS,
): String {
    var to = loadedToIso
    var guard = 0
    while (instantIso >= to && guard < 120) {
        to = advanceCalendarWindow(to, days).to
        guard++
    }
    return to
}

fun mergeCalendarItems(
    current: List<CalendarItem>,
    more: List<CalendarItem>,
): List<CalendarItem> {
    val seen = current.map { "${it.source}:${it.id}" }.toMutableSet()
    val merged = current.toMutableList()
    for (item in more) {
        val key = "${item.source}:${item.id}"
        if (key in seen) continue
        seen.add(key)
        merged.add(item)
    }
    return merged.sortedWith(
        compareBy({ it.startsAt }, { it.source.name }, { it.id }),
    )
}

fun calendarSourceLabel(
    source: CalendarItemSource,
    feedName: String?,
): String =
    when (source) {
        CalendarItemSource.FEED -> feedName?.trim()?.takeIf { it.isNotEmpty() } ?: "Feed"
        CalendarItemSource.MANUAL -> "Manual"
    }

/**
 * Material DatePicker [selectedDateMillis] is UTC midnight of the chosen calendar day.
 * Combine with local hour/minute into a single instant.
 */
fun combineUtcDateAndLocalTime(
    selectedDateMillis: Long,
    hour: Int,
    minute: Int,
): Long {
    val utc =
        Calendar.getInstance(TimeZone.getTimeZone("UTC")).apply {
            timeInMillis = selectedDateMillis
        }
    return Calendar.getInstance().apply {
        set(Calendar.YEAR, utc.get(Calendar.YEAR))
        set(Calendar.MONTH, utc.get(Calendar.MONTH))
        set(Calendar.DAY_OF_MONTH, utc.get(Calendar.DAY_OF_MONTH))
        set(Calendar.HOUR_OF_DAY, hour)
        set(Calendar.MINUTE, minute)
        set(Calendar.SECOND, 0)
        set(Calendar.MILLISECOND, 0)
    }.timeInMillis
}

/** Local hour-of-day and minute for an instant. */
fun localHourMinute(millis: Long): Pair<Int, Int> {
    val cal = Calendar.getInstance().apply { timeInMillis = millis }
    return cal.get(Calendar.HOUR_OF_DAY) to cal.get(Calendar.MINUTE)
}

/**
 * UTC midnight millis for the local calendar day of [millis], suitable as
 * DatePicker initial selection.
 */
fun utcMidnightMillisForLocalDay(millis: Long): Long {
    val local = Calendar.getInstance().apply { timeInMillis = millis }
    return Calendar.getInstance(TimeZone.getTimeZone("UTC")).apply {
        set(Calendar.YEAR, local.get(Calendar.YEAR))
        set(Calendar.MONTH, local.get(Calendar.MONTH))
        set(Calendar.DAY_OF_MONTH, local.get(Calendar.DAY_OF_MONTH))
        set(Calendar.HOUR_OF_DAY, 0)
        set(Calendar.MINUTE, 0)
        set(Calendar.SECOND, 0)
        set(Calendar.MILLISECOND, 0)
    }.timeInMillis
}
