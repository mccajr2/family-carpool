package org.example.project

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

class RsvpDisplayTest {
    private fun item(
        kidIds: List<String>,
        rsvps: List<CalendarRsvp>,
        coverages: List<CalendarCoverageAssignment> = emptyList(),
    ): CalendarItem =
        CalendarItem(
            id = "e1",
            source = CalendarItemSource.MANUAL,
            title = "Practice",
            startsAt = "2030-08-15T17:00:00Z",
            kidIds = kidIds,
            coverages = coverages,
            rsvps = rsvps,
        )

    @Test
    fun labelsRsvpStatuses() {
        assertEquals("Yes", rsvpStatusLabel(RsvpStatus.YES))
        assertEquals("No", rsvpStatusLabel(RsvpStatus.NO))
        assertEquals("No response", rsvpStatusLabel(RsvpStatus.NO_RESPONSE))
    }

    @Test
    fun defaultsMissingRsvpRowToNoResponse() {
        assertEquals(
            RsvpStatus.NO_RESPONSE,
            rsvpStatusForKid(item(kidIds = listOf("k1"), rsvps = emptyList()), "k1"),
        )
    }

    @Test
    fun outOfPlayWhenEveryKidIsNo() {
        assertTrue(
            isAgendaItemOutOfPlay(
                item(
                    kidIds = listOf("k1"),
                    rsvps = listOf(CalendarRsvp("k1", RsvpStatus.NO)),
                ),
            ),
        )
        assertTrue(
            isAgendaItemOutOfPlay(
                item(
                    kidIds = listOf("k1", "k2"),
                    rsvps =
                        listOf(
                            CalendarRsvp("k1", RsvpStatus.NO),
                            CalendarRsvp("k2", RsvpStatus.NO),
                        ),
                ),
            ),
        )
        assertFalse(
            isAgendaItemOutOfPlay(
                item(
                    kidIds = listOf("k1", "k2"),
                    rsvps =
                        listOf(
                            CalendarRsvp("k1", RsvpStatus.NO),
                            CalendarRsvp("k2", RsvpStatus.YES),
                        ),
                ),
            ),
        )
        assertFalse(isAgendaItemOutOfPlay(item(kidIds = emptyList(), rsvps = emptyList())))
    }

    @Test
    fun kidHasActiveCoverageDetectsPendingAndConfirmed() {
        val coverage =
            CalendarCoverageAssignment(
                id = "a1",
                coveringAdultId = "1",
                assignedByAdultId = "1",
                kidIds = listOf("k1"),
                status = CoverageStatus.PENDING,
            )
        assertTrue(
            kidHasActiveCoverage(
                item(kidIds = listOf("k1"), rsvps = emptyList(), coverages = listOf(coverage)),
                "k1",
            ),
        )
        assertFalse(
            kidHasActiveCoverage(
                item(kidIds = listOf("k1"), rsvps = emptyList(), coverages = listOf(coverage)),
                "k2",
            ),
        )
        assertEquals("This will remove coverage for Emma.", rsvpCoverageReleaseMessage("Emma"))
    }
}
