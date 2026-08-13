package org.example.project

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull

class CalendarLeaveByMergeTest {
    private fun item(
        id: String,
        title: String = "Practice",
        leaveByStatus: LeaveByStatus = LeaveByStatus.PENDING,
        leaveByAt: String? = null,
        leaveByReason: String? = null,
        leaveFromPlaceId: String? = "p1",
        source: CalendarItemSource = CalendarItemSource.MANUAL,
    ): CalendarItem =
        CalendarItem(
            id = id,
            source = source,
            title = title,
            startsAt = "2026-08-15T17:00:00Z",
            location = "Rink",
            kidIds = listOf("k1"),
            leaveFromPlaceId = leaveFromPlaceId,
            leaveFromPlaceName = if (leaveFromPlaceId == "p1") "Home" else "Dad's",
            leaveByAt = leaveByAt,
            leaveByStatus = leaveByStatus,
            leaveByReason = leaveByReason,
        )

    @Test
    fun incomingUnavailableClearsStaleOk() {
        val cached =
            item(
                id = "e1",
                leaveByStatus = LeaveByStatus.OK,
                leaveByAt = "2026-08-15T16:00:00Z",
            )
        val incoming =
            item(
                id = "e1",
                leaveByStatus = LeaveByStatus.UNAVAILABLE,
                leaveByReason = "NO_ORIGIN",
                leaveFromPlaceId = null,
            )
        assertEquals(incoming, mergeCheapCalendarItem(incoming, cached))
    }

    @Test
    fun pendingKeepsCachedOkWhenOriginMatches() {
        val cached =
            item(
                id = "e1",
                leaveByStatus = LeaveByStatus.OK,
                leaveByAt = "2026-08-15T16:00:00Z",
            )
        val incoming = item(id = "e1", title = "Practice refreshed")
        val merged = mergeCheapCalendarItem(incoming, cached)
        assertEquals("Practice refreshed", merged.title)
        assertEquals(LeaveByStatus.OK, merged.leaveByStatus)
        assertEquals("2026-08-15T16:00:00Z", merged.leaveByAt)
    }

    @Test
    fun pendingWhenOriginDiffersFromCachedOk() {
        val cached =
            item(
                id = "e1",
                leaveByStatus = LeaveByStatus.OK,
                leaveByAt = "2026-08-15T16:00:00Z",
                leaveFromPlaceId = "p1",
            )
        val incoming = item(id = "e1", leaveFromPlaceId = "p2")
        assertEquals(LeaveByStatus.PENDING, mergeCheapCalendarItem(incoming, cached).leaveByStatus)
    }

    @Test
    fun fillInOverwritesMatchingRowsAndIgnoresUnknownIds() {
        val items =
            listOf(
                item(id = "e1"),
                item(id = "e2", title = "Game"),
            )
        val next =
            applyLeaveByFillIn(
                items,
                listOf(
                    CalendarLeaveBy(
                        id = "e1",
                        source = CalendarItemSource.MANUAL,
                        leaveFromPlaceId = "p1",
                        leaveFromPlaceName = "Home",
                        leaveByAt = "2026-08-15T16:20:00Z",
                        leaveByStatus = LeaveByStatus.OK,
                        leaveByReason = null,
                    ),
                    CalendarLeaveBy(
                        id = "missing",
                        source = CalendarItemSource.MANUAL,
                        leaveByStatus = LeaveByStatus.OK,
                        leaveByAt = "2026-08-15T16:00:00Z",
                    ),
                ),
            )
        assertEquals(LeaveByStatus.OK, next[0].leaveByStatus)
        assertEquals("2026-08-15T16:20:00Z", next[0].leaveByAt)
        assertEquals(LeaveByStatus.PENDING, next[1].leaveByStatus)
        assertNull(next[1].leaveByAt)
    }
}
