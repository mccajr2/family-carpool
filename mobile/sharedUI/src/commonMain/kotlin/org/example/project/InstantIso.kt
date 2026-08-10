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
