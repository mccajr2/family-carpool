package org.example.project

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNull
import kotlin.test.assertTrue

class CalendarCacheStoreTest {
    @Test
    fun roundTripsSnapshotKeyedByAdultAndCircle() {
        val store = InMemoryCalendarCacheStore()
        val snapshot =
            CalendarCacheSnapshot(
                adultId = "a1",
                circleId = "c1",
                from = "2026-08-12T04:00:00.000Z",
                to = "2026-09-11T04:00:00.000Z",
                items =
                    listOf(
                        CalendarItem(
                            id = "e1",
                            source = CalendarItemSource.MANUAL,
                            title = "Practice",
                            startsAt = "2026-08-15T17:00:00.000Z",
                            kidIds = listOf("k1"),
                        ),
                    ),
                fetchedAt = 1_700_000_000_000L,
            )
        store.save(snapshot)
        assertEquals(snapshot, store.load("a1", "c1"))
        assertNull(store.load("a1", "c2"))
        assertNull(store.load("a2", "c1"))
    }

    @Test
    fun patchItemUpdatesOneRowWithoutChangingWindow() {
        val store = InMemoryCalendarCacheStore()
        store.save(
            CalendarCacheSnapshot(
                adultId = "a1",
                circleId = "c1",
                from = "from",
                to = "to",
                items =
                    listOf(
                        CalendarItem(
                            id = "e1",
                            source = CalendarItemSource.MANUAL,
                            title = "Before",
                            startsAt = "2026-08-15T17:00:00.000Z",
                        ),
                        CalendarItem(
                            id = "e2",
                            source = CalendarItemSource.MANUAL,
                            title = "Other",
                            startsAt = "2026-08-16T17:00:00.000Z",
                        ),
                    ),
                fetchedAt = 10L,
            ),
        )
        store.patchItem(
            "a1",
            "c1",
            CalendarItem(
                id = "e1",
                source = CalendarItemSource.MANUAL,
                title = "After",
                startsAt = "2026-08-15T17:00:00.000Z",
                leaveByStatus = LeaveByStatus.OK,
                leaveByAt = "2026-08-15T16:00:00.000Z",
            ),
        )
        val loaded = store.load("a1", "c1")!!
        assertEquals("from", loaded.from)
        assertEquals("to", loaded.to)
        assertEquals(10L, loaded.fetchedAt)
        assertEquals(listOf("After", "Other"), loaded.items.map { it.title })
    }

    @Test
    fun clearAndClearAll() {
        val store = InMemoryCalendarCacheStore()
        store.save(
            CalendarCacheSnapshot(
                adultId = "a1",
                circleId = "c1",
                from = "f",
                to = "t",
                items = emptyList(),
                fetchedAt = 1L,
            ),
        )
        store.save(
            CalendarCacheSnapshot(
                adultId = "a1",
                circleId = "c2",
                from = "f",
                to = "t",
                items = emptyList(),
                fetchedAt = 1L,
            ),
        )
        store.clear("a1", "c1")
        assertNull(store.load("a1", "c1"))
        assertEquals("c2", store.load("a1", "c2")!!.circleId)
        store.clearAll()
        assertNull(store.load("a1", "c2"))
    }

    @Test
    fun softStaleAfterTtl() {
        val store = InMemoryCalendarCacheStore()
        val fetchedAt = 1_000_000L
        assertFalse(store.isStale(fetchedAt, fetchedAt + CALENDAR_CACHE_SOFT_TTL_MS))
        assertTrue(store.isStale(fetchedAt, fetchedAt + CALENDAR_CACHE_SOFT_TTL_MS + 1))
    }

    @Test
    fun maxIsoInstantPicksLater() {
        assertEquals(
            "2026-09-01T00:00:00.000Z",
            maxIsoInstant("2026-08-01T00:00:00.000Z", "2026-09-01T00:00:00.000Z"),
        )
    }
}
