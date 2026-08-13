package org.example.project

import kotlin.test.Test
import kotlin.test.assertEquals

class ConflictDisplayTest {

    private val kidConflict =
        CalendarConflict(
            type = CalendarConflictType.KID_TIME_OVERLAP,
            kidId = "k1",
            otherSource = CalendarItemSource.MANUAL,
            otherItemId = "e2",
            otherTitle = "Game",
            otherStartsAt = "2026-08-15T17:30:00Z",
        )

    private val adultConflict =
        CalendarConflict(
            type = CalendarConflictType.ADULT_COVERAGE_OVERLAP,
            adultId = "a1",
            adultDisplayName = "Jordan",
            otherSource = CalendarItemSource.FEED,
            otherItemId = "e3",
            otherTitle = "Practice",
            otherStartsAt = "2026-08-15T17:00:00Z",
        )

    @Test
    fun formatConflictLineNamesKidWhenKnown() {
        assertEquals(
            "Sam overlaps Game",
            formatConflictLine(kidConflict, listOf(Kid(id = "k1", displayName = "Sam"))),
        )
    }

    @Test
    fun formatConflictLineFallsBackWithoutKidName() {
        assertEquals("Kid schedule overlaps Game", formatConflictLine(kidConflict))
    }

    @Test
    fun formatConflictLineNamesAdult() {
        assertEquals("Jordan also covering Practice", formatConflictLine(adultConflict))
    }

    @Test
    fun conflictDisplayLinesDedupes() {
        assertEquals(
            listOf("Kid schedule overlaps Game"),
            conflictDisplayLines(listOf(kidConflict, kidConflict)),
        )
    }

    @Test
    fun coverageDoubleBookMessageMapsOverlappingConfirmed() {
        assertEquals(
            "Already confirmed on an overlapping event — decline or reassign first.",
            coverageDoubleBookMessage(
                "Adult is already confirmed on an overlapping calendar item",
            ),
        )
        assertEquals(
            "Kid is already covered on this calendar item",
            coverageDoubleBookMessage("Kid is already covered on this calendar item"),
        )
    }
}
