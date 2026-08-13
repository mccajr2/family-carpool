package org.example.project

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull
import platform.Foundation.NSUserDefaults

class IosCalendarCacheStoreTest {
    @Test
    fun roundTripsAndClearAllViaUserDefaults() {
        val suite = "family-carpool.calendar-cache-test.${kotlin.random.Random.nextLong()}"
        val defaults = NSUserDefaults(suiteName = suite)
        val store = IosCalendarCacheStore(defaults)
        val snapshot =
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
                            title = "Practice",
                            startsAt = "2026-08-15T17:00:00.000Z",
                        ),
                    ),
                fetchedAt = 42L,
            )
        store.save(snapshot)
        assertEquals("Practice", store.load("a1", "c1")!!.items.single().title)
        store.clearAll()
        assertNull(store.load("a1", "c1"))
        defaults.removePersistentDomainForName(suite)
    }
}
