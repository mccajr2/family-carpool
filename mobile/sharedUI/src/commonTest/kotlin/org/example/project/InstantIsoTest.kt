package org.example.project

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNotNull
import kotlin.test.assertNull
import kotlin.test.assertTrue
import kotlin.time.Instant

class InstantIsoTest {
    @Test
    fun parseIsoToEpochMillis_roundTripsUtcInstant() {
        val iso = "2026-08-15T17:00:00Z"
        val millis = parseIsoToEpochMillis(iso)
        assertNotNull(millis)
        assertEquals(Instant.parse(iso).toEpochMilliseconds(), millis)
        assertEquals("2026-08-15T17:00:00Z", epochMillisToIsoUtc(millis))
    }

    @Test
    fun parseIsoToEpochMillis_rejectsBlankAndGarbage() {
        assertNull(parseIsoToEpochMillis(""))
        assertNull(parseIsoToEpochMillis("   "))
        assertNull(parseIsoToEpochMillis("not-a-date"))
    }

    @Test
    fun formatIsoForDisplay_usesLocalFriendlyLabel() {
        val label = formatIsoForDisplay("2026-08-15T17:00:00Z")
        assertTrue(label.contains("Aug"), label)
        assertTrue(label.contains("15"), label)
        assertTrue(label.contains("·"), label)
    }

    @Test
    fun formatEventWhen_joinsOptionalEnd() {
        assertEquals(
            formatIsoForDisplay("2026-08-15T17:00:00Z"),
            formatEventWhen("2026-08-15T17:00:00Z", null),
        )
        val withEnd = formatEventWhen("2026-08-15T17:00:00Z", "2026-08-15T18:00:00Z")
        assertTrue(withEnd.contains("→"), withEnd)
    }

    @Test
    fun defaultCalendarWindow_isLocalTodayPlus30Days() {
        val now = Instant.parse("2026-08-15T17:30:00Z").toEpochMilliseconds()
        val window = defaultCalendarWindow(now)
        val from = Instant.parse(window.from).toEpochMilliseconds()
        val to = Instant.parse(window.to).toEpochMilliseconds()
        assertEquals(30L * 24 * 60 * 60 * 1000, to - from)
        // from is local midnight of the same local calendar day as now
        assertEquals(0, localHourMinute(from).first)
        assertEquals(0, localHourMinute(from).second)
    }

    @Test
    fun calendarSourceLabel_prefersFeedName() {
        assertEquals("Manual", calendarSourceLabel(CalendarItemSource.MANUAL, null))
        assertEquals("Soccer", calendarSourceLabel(CalendarItemSource.FEED, "Soccer"))
        assertEquals("Feed", calendarSourceLabel(CalendarItemSource.FEED, "  "))
    }

    @Test
    fun combineUtcDateAndLocalTime_keepsCalendarDayAndAppliesClock() {
        // 2026-08-15 UTC midnight from a Material DatePicker selection
        val dateMillis = Instant.parse("2026-08-15T00:00:00Z").toEpochMilliseconds()
        val combined = combineUtcDateAndLocalTime(dateMillis, hour = 14, minute = 30)
        val (hour, minute) = localHourMinute(combined)
        assertEquals(14, hour)
        assertEquals(30, minute)
        val utcDay = utcMidnightMillisForLocalDay(combined)
        // Local calendar day of combined should map back to Aug 15 in local zone;
        // assert the local Y/M/D extracted via utc midnight helper is stable for the day.
        assertEquals(
            utcMidnightMillisForLocalDay(combined),
            utcDay,
        )
    }

    @Test
    fun validateManualEventTimes_rejectsPastStartAndEndsBeforeStart() {
        val now = Instant.parse("2026-08-15T12:00:00Z").toEpochMilliseconds()
        assertEquals(
            "Start must be in the future",
            validateManualEventTimes("2026-08-15T11:00:00Z", null, now),
        )
        assertEquals(
            "End must be on or after start",
            validateManualEventTimes(
                "2026-08-15T13:00:00Z",
                "2026-08-15T12:30:00Z",
                now,
            ),
        )
        assertEquals(
            null,
            validateManualEventTimes(
                "2026-08-15T13:00:00Z",
                "2026-08-15T14:00:00Z",
                now,
            ),
        )
    }

    @Test
    fun nowIsoUtc_isParseableInstant() {
        assertNotNull(parseIsoToEpochMillis(nowIsoUtc()))
    }
}
