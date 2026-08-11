package org.example.project

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

class LeaveByDisplayTest {
    @Test
    fun estimateLineUsesTildeAndEstimateLabel() {
        val line = formatLeaveByEstimateLine("2026-08-15T15:25:00Z")
        assertTrue(line.startsWith("Leave by ~"))
        assertTrue(line.endsWith(" · estimate"))
        assertFalse(Regex("""\beta\b""").containsMatchIn(line.lowercase()))
        assertFalse(line.lowercase().contains("live traffic"))
        assertFalse(line.lowercase().contains("live-traffic"))
    }

    @Test
    fun unavailableReasonsMapToShortCopy() {
        assertEquals("No leave-from place yet", leaveByUnavailableLabel("NO_ORIGIN"))
        assertEquals(
            "Add a location to estimate leave-by",
            leaveByUnavailableLabel("NO_DESTINATION"),
        )
        assertEquals("Couldn't locate the destination", leaveByUnavailableLabel("GEOCODE_FAILED"))
        assertEquals("Leave-by estimate unavailable", leaveByUnavailableLabel(null))
    }

    @Test
    fun agendaLinePrefersEstimateWhenOk() {
        val ok =
            CalendarItem(
                id = "e1",
                source = CalendarItemSource.MANUAL,
                title = "Practice",
                startsAt = "2026-08-15T17:00:00Z",
                leaveByAt = "2026-08-15T16:30:00Z",
                leaveByStatus = LeaveByStatus.OK,
            )
        assertTrue(leaveByAgendaLine(ok).contains(" · estimate"))

        val unavailable =
            ok.copy(
                leaveByAt = null,
                leaveByStatus = LeaveByStatus.UNAVAILABLE,
                leaveByReason = "NO_ORIGIN",
            )
        assertEquals("No leave-from place yet", leaveByAgendaLine(unavailable))
    }
}
